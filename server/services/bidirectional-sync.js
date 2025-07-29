const { createClient } = require('@supabase/supabase-js');
const TokenManager = require('../lib/token-manager');

class BiDirectionalSyncService {
  constructor() {
    // Environment configuration
    this.SYNC_INTERVAL_MS = (process.env.SYNC_INTERVAL_MINUTES || 5) * 60 * 1000;
    this.MIN_CHANGES = parseInt(process.env.SYNC_MIN_CHANGES || '5');
    this.BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE || '100');
    this.MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES || '3');
    this.RETRY_BACKOFF_MS = (process.env.SYNC_RETRY_BACKOFF_MINUTES || 10) * 60 * 1000;
    
    // Initialize services
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
    this.tokenManager = new TokenManager();
    
    // State management
    this.syncTimer = null;
    this.retryAttempts = new Map();
    this.isProcessing = false;
    this.lastProcessedTime = null;
  }

  async startPeriodicSync() {
    // Clear any existing timer
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    // Initial sync
    await this.processSyncQueue();

    // Start periodic sync
    this.syncTimer = setInterval(async () => {
      if (!this.isProcessing) {
        await this.processSyncQueue();
      }
    }, this.SYNC_INTERVAL_MS);

    console.log(`[BiDirectionalSync] Started periodic sync every ${this.SYNC_INTERVAL_MS / 60000} minutes`);
  }

  stopPeriodicSync() {
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
      this.syncTimer = null;
      console.log('[BiDirectionalSync] Stopped periodic sync');
    }
  }

  async processSyncQueue() {
    if (this.isProcessing) {
      console.log('[BiDirectionalSync] Already processing, skipping this cycle');
      return;
    }

    this.isProcessing = true;
    const startTime = Date.now();

    try {
      // Get pending changes from sync_queue
      const { data: pendingChanges, error } = await this.supabase
        .from('sync_queue')
        .select('*')
        .lt('sync_attempts', this.MAX_RETRIES)
        .order('created_at', { ascending: true });

      if (error) {
        console.error('[BiDirectionalSync] Error fetching sync queue:', error);
        return;
      }

      if (!pendingChanges || pendingChanges.length === 0) {
        console.log('[BiDirectionalSync] No pending changes to sync');
        return;
      }

      console.log(`[BiDirectionalSync] Found ${pendingChanges.length} pending changes`);

      // Check if we should sync based on:
      // 1. Having retries pending
      // 2. Having minimum changes
      // 3. Having old changes (older than 15 minutes)
      const hasRetries = pendingChanges.some(change => change.sync_attempts > 0);
      const oldestChange = pendingChanges[0]; // Already sorted by created_at ascending
      const oldestChangeAge = oldestChange ? Date.now() - new Date(oldestChange.created_at).getTime() : 0;
      const hasOldChanges = oldestChangeAge > 15 * 60 * 1000; // 15 minutes
      
      if (!hasRetries && pendingChanges.length < this.MIN_CHANGES && !hasOldChanges) {
        const ageInMinutes = Math.floor(oldestChangeAge / 60000);
        console.log(
          `[BiDirectionalSync] Only ${pendingChanges.length} changes pending, waiting for minimum of ${this.MIN_CHANGES}. ` +
          `Oldest change is ${ageInMinutes} minutes old.`
        );
        return;
      }

      // Group changes by action type for efficient batching
      const groupedChanges = this.groupChangesByAction(pendingChanges);

      // Process each action type
      for (const [actionType, changes] of Object.entries(groupedChanges)) {
        await this.syncActionBatch(actionType, changes);
      }

      const duration = Date.now() - startTime;
      console.log(`[BiDirectionalSync] Sync completed in ${duration}ms`);
      
      // Update last processed time
      this.lastProcessedTime = new Date().toISOString();

    } catch (error) {
      console.error('[BiDirectionalSync] Error processing sync queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  groupChangesByAction(changes) {
    return changes.reduce((acc, change) => {
      if (!acc[change.action_type]) {
        acc[change.action_type] = [];
      }
      acc[change.action_type].push(change);
      return acc;
    }, {});
  }

  async syncActionBatch(actionType, changes) {
    console.log(`[BiDirectionalSync] Processing ${changes.length} ${actionType} changes`);

    // Process in batches of BATCH_SIZE
    for (let i = 0; i < changes.length; i += this.BATCH_SIZE) {
      const batch = changes.slice(i, i + this.BATCH_SIZE);
      
      try {
        await this.sendBatchToInoreader(actionType, batch);
        
        // Mark batch as synced by deleting from queue
        const ids = batch.map(c => c.id);
        const { error } = await this.supabase
          .from('sync_queue')
          .delete()
          .in('id', ids);

        if (error) {
          console.error('[BiDirectionalSync] Error deleting synced items:', error);
        } else {
          console.log(`[BiDirectionalSync] Successfully synced ${batch.length} ${actionType} changes`);
        }
        
      } catch (error) {
        // Handle retry logic
        await this.handleSyncError(batch, error);
      }
    }
  }

  async sendBatchToInoreader(actionType, batch) {
    // Prepare parameters based on action type
    const params = new URLSearchParams();
    
    // Add all article IDs
    for (const item of batch) {
      params.append('i', item.inoreader_id);
    }

    // Set appropriate tags based on action
    switch (actionType) {
      case 'read':
        params.append('a', 'user/-/state/com.google/read');
        break;
      case 'unread':
        params.append('r', 'user/-/state/com.google/read');
        break;
      case 'star':
        params.append('a', 'user/-/state/com.google/starred');
        break;
      case 'unstar':
        params.append('r', 'user/-/state/com.google/starred');
        break;
      default:
        throw new Error(`Unknown action type: ${actionType}`);
    }

    // Make API call
    const response = await this.tokenManager.makeAuthenticatedRequest(
      'https://www.inoreader.com/reader/api/0/edit-tag',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Inoreader sync failed: ${response.status} ${response.statusText} - ${text}`);
    }

    // Track API usage
    await this.trackApiUsage();
  }

  async handleSyncError(batch, error) {
    console.error('[BiDirectionalSync] Batch sync failed:', error);

    // Update retry attempts for each item in the batch
    for (const item of batch) {
      const attempts = (this.retryAttempts.get(item.id) || item.sync_attempts || 0) + 1;
      this.retryAttempts.set(item.id, attempts);

      const { error: updateError } = await this.supabase
        .from('sync_queue')
        .update({
          sync_attempts: attempts,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', item.id);

      if (updateError) {
        console.error('[BiDirectionalSync] Error updating retry attempts:', updateError);
      }

      // Log retry information
      if (attempts < this.MAX_RETRIES) {
        const backoffMs = this.RETRY_BACKOFF_MS * Math.pow(2, attempts - 1);
        console.log(`[BiDirectionalSync] Will retry ${item.id} in ${backoffMs / 60000} minutes (attempt ${attempts}/${this.MAX_RETRIES})`);
      } else {
        console.log(`[BiDirectionalSync] Max retries reached for ${item.id}, will not retry`);
      }
    }
  }

  async trackApiUsage() {
    const today = new Date().toISOString().split('T')[0];
    
    // Temporary fix: Use direct table update instead of RPC function
    // TODO: Create proper RPC function or update schema
    try {
      // First, try to update existing record
      const { data: existing, error: selectError } = await this.supabase
        .from('api_usage')
        .select('*')
        .eq('service', 'inoreader')
        .eq('date', today)
        .single();

      if (selectError && selectError.code !== 'PGRST116') {
        // PGRST116 = no rows found, which is expected for new days
        console.error('[BiDirectionalSync] Error checking API usage:', selectError);
        return;
      }

      if (existing) {
        // Update existing record
        const { error: updateError } = await this.supabase
          .from('api_usage')
          .update({ count: existing.count + 1 })
          .eq('id', existing.id);

        if (updateError) {
          console.error('[BiDirectionalSync] Error updating API usage:', updateError);
        }
      } else {
        // Insert new record
        const { error: insertError } = await this.supabase
          .from('api_usage')
          .insert({
            service: 'inoreader',
            date: today,
            count: 1,
            created_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('[BiDirectionalSync] Error inserting API usage:', insertError);
        }
      }
    } catch (error) {
      console.error('[BiDirectionalSync] Unexpected error tracking API usage:', error);
    }
  }

  // Manual sync trigger (called from API endpoint)
  async triggerManualSync() {
    console.log('[BiDirectionalSync] Manual sync triggered');
    await this.processSyncQueue();
  }

  // Get sync queue statistics
  async getSyncQueueStats() {
    const { data, error } = await this.supabase
      .from('sync_queue_stats')
      .select('*')
      .single();

    if (error) {
      console.error('[BiDirectionalSync] Error getting sync stats:', error);
      return null;
    }

    return data;
  }

  // Clear failed items from sync queue (maintenance)
  async clearFailedItems() {
    const { data, error } = await this.supabase
      .from('sync_queue')
      .delete()
      .gte('sync_attempts', this.MAX_RETRIES)
      .select();

    if (error) {
      console.error('[BiDirectionalSync] Error clearing failed items:', error);
      return 0;
    }

    console.log(`[BiDirectionalSync] Cleared ${data.length} failed items from sync queue`);
    return data.length;
  }
}

// Export singleton instance
module.exports = BiDirectionalSyncService;