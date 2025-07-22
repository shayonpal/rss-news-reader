const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

class CronSyncService {
  constructor() {
    this.logPath = process.env.SYNC_LOG_PATH || './logs/sync-cron.jsonl';
    this.isEnabled = process.env.ENABLE_AUTO_SYNC === 'true';
    this.schedule = process.env.SYNC_CRON_SCHEDULE || '0 2,14 * * *'; // 2am, 2pm
    this.apiUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  }

  async start() {
    if (!this.isEnabled) {
      console.log('[Cron] Automatic sync is disabled');
      return;
    }

    // Ensure log directory exists
    const logDir = path.dirname(this.logPath);
    await fs.mkdir(logDir, { recursive: true });

    // Schedule cron job
    cron.schedule(this.schedule, async () => {
      const trigger = this.getTriggerName();
      await this.executeSyncWithLogging(trigger);
    }, {
      timezone: 'America/Toronto'
    });

    console.log(`[Cron] Automatic sync scheduled: ${this.schedule} (America/Toronto)`);
  }

  async executeSyncWithLogging(trigger) {
    const syncId = uuidv4();
    const startTime = Date.now();

    // Log sync start
    await this.logEvent({
      timestamp: new Date().toISOString(),
      trigger,
      status: 'started',
      syncId
    });

    try {
      // Call the sync API endpoint
      const response = await fetch(`${this.apiUrl}/api/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      if (!response.ok) {
        throw new Error(`Sync API returned ${response.status}`);
      }

      const result = await response.json();
      
      // Poll for completion
      await this.pollSyncStatus(result.syncId, trigger, startTime);
      
    } catch (error) {
      const duration = Date.now() - startTime;
      
      // Log sync error
      await this.logEvent({
        timestamp: new Date().toISOString(),
        trigger,
        status: 'error',
        error: error.message,
        duration
      });

      // Update sync metadata in Supabase
      await this.updateSyncMetadata({
        last_sync_status: 'failed',
        last_sync_error: error.message,
        sync_failure_count: { increment: 1 }
      });
    }
  }

  async pollSyncStatus(syncId, trigger, startTime) {
    const maxAttempts = 60; // 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(`${this.apiUrl}/api/sync/status/${syncId}`);
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }
        
        const status = await response.json();
        
        if (status.status === 'completed') {
          const duration = Date.now() - startTime;
          
          // Log success
          await this.logEvent({
            timestamp: new Date().toISOString(),
            trigger,
            status: 'completed',
            duration,
            feeds: status.feedsCount,
            articles: status.articlesCount
          });

          // Update sync metadata
          await this.updateSyncMetadata({
            last_sync_time: new Date().toISOString(),
            last_sync_status: 'success',
            last_sync_error: null,
            sync_success_count: { increment: 1 }
          });
          
          return;
        } else if (status.status === 'failed') {
          throw new Error(status.error || 'Sync failed');
        }

        // Log progress updates at 20% intervals
        if (status.progress && status.progress % 20 === 0) {
          await this.logEvent({
            timestamp: new Date().toISOString(),
            trigger,
            status: 'running',
            progress: status.progress,
            message: status.message
          });
        }
      } catch (error) {
        // Ignore transient errors during polling
        console.error(`[Cron] Status check error: ${error.message}`);
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Sync timeout after 2 minutes');
  }

  async logEvent(event) {
    try {
      const line = JSON.stringify(event) + '\n';
      await fs.appendFile(this.logPath, line);
    } catch (error) {
      console.error('[Cron] Failed to write log:', error);
    }
  }

  async updateSyncMetadata(updates) {
    try {
      // We need to update this via the API since we can't directly access Supabase from here
      const response = await fetch(`${this.apiUrl}/api/sync/metadata`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        console.error('[Cron] Failed to update sync metadata:', response.status);
      }
    } catch (error) {
      console.error('[Cron] Failed to update sync metadata:', error);
    }
  }

  getTriggerName() {
    const hour = new Date().getHours();
    return hour < 12 ? 'cron-2am' : 'cron-2pm';
  }
}

// Entry point for PM2
if (require.main === module) {
  const cronService = new CronSyncService();
  cronService.start().catch(error => {
    console.error('[Cron] Failed to start service:', error);
    process.exit(1);
  });
  
  // Keep process alive
  process.stdin.resume();
  
  // Graceful shutdown
  process.on('SIGTERM', () => {
    console.log('[Cron] Shutting down...');
    process.exit(0);
  });
}

module.exports = CronSyncService;