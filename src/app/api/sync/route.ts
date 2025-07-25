import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// In-memory sync status tracking (for MVP - should use Redis or DB in production)
declare global {
  // eslint-disable-next-line no-var
  var syncStatus: Map<string, {
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    message?: string;
    error?: string;
    startTime: number;
  }>;
}

// Initialize if not exists
if (!global.syncStatus) {
  global.syncStatus = new Map();
}

const syncStatus = global.syncStatus;

export async function POST() {
  try {
    // Check rate limit
    const rateLimit = await checkRateLimit();
    
    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'rate_limit_exceeded',
          message: 'Inoreader API rate limit exceeded',
          limit: rateLimit.limit,
          used: rateLimit.used,
          remaining: 0
        },
        { status: 429 }
      );
    }

    // Generate sync ID
    const syncId = uuidv4();
    
    // Initialize sync status
    syncStatus.set(syncId, {
      status: 'pending',
      progress: 0,
      startTime: Date.now()
    });

    // Start sync in background (non-blocking)
    performServerSync(syncId).catch(error => {
      console.error('Sync failed:', error);
      const status = syncStatus.get(syncId);
      if (status) {
        status.status = 'failed';
        status.error = error.message;
      }
    });

    return NextResponse.json({
      success: true,
      syncId,
      message: 'Sync started successfully',
      rateLimit: {
        remaining: rateLimit.remaining,
        limit: rateLimit.limit,
        used: rateLimit.used
      }
    });
  } catch (error) {
    console.error('Failed to start sync:', error);
    return NextResponse.json(
      {
        error: 'sync_start_failed',
        message: 'Failed to start sync',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function performServerSync(syncId: string) {
  const status = syncStatus.get(syncId);
  if (!status) return;

  try {
    // Update status to running
    status.status = 'running';
    status.progress = 10;
    status.message = 'Loading server tokens...';

    // Import the token manager (CommonJS module)
    const TokenManager = require('../../../../server/lib/token-manager.js');
    const tokenManager = new TokenManager();

    // Get access token
    const accessToken = await tokenManager.getAccessToken();
    
    status.progress = 20;
    status.message = 'Fetching subscriptions...';

    // Step 1: Fetch subscriptions
    const subsResponse = await tokenManager.makeAuthenticatedRequest(
      'https://www.inoreader.com/reader/api/0/subscription/list'
    );

    if (!subsResponse.ok) {
      throw new Error(`Failed to fetch subscriptions: ${subsResponse.statusText}`);
    }

    const subsData = await subsResponse.json();
    const subscriptions = subsData.subscriptions || [];

    status.progress = 30;
    status.message = `Found ${subscriptions.length} feeds...`;

    // Step 2: Fetch unread counts
    const countsResponse = await tokenManager.makeAuthenticatedRequest(
      'https://www.inoreader.com/reader/api/0/unread-count'
    );

    if (!countsResponse.ok) {
      throw new Error(`Failed to fetch unread counts: ${countsResponse.statusText}`);
    }

    const countsData = await countsResponse.json();
    const unreadCounts = new Map(
      countsData.unreadcounts?.map((item: any) => [item.id, item.count]) || []
    );

    status.progress = 40;
    status.message = 'Syncing feeds to Supabase...';

    // Get or create the single user
    const SINGLE_USER_ID = 'shayon';
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('inoreader_id', SINGLE_USER_ID)
      .single();

    let userId = user?.id;
    
    if (!userId) {
      const { data: newUser, error } = await supabase
        .from('users')
        .insert({
          email: 'shayon@local',
          inoreader_id: SINGLE_USER_ID,
          preferences: {}
        })
        .select('id')
        .single();

      if (error) throw new Error(`Failed to create user: ${error.message}`);
      userId = newUser.id;
    }

    // Process folders
    const processedFolders = new Set<string>();
    for (const sub of subscriptions) {
      for (const category of sub.categories || []) {
        if (!processedFolders.has(category.id)) {
          processedFolders.add(category.id);
          
          await supabase
            .from('folders')
            .upsert({
              user_id: userId,
              inoreader_id: category.id,
              name: category.label,
              parent_id: null
            }, { onConflict: 'inoreader_id' });
        }
      }
    }

    status.progress = 50;
    status.message = 'Syncing feeds...';

    // Process feeds
    const feedsToUpsert = subscriptions.map((sub: any) => ({
      user_id: userId,
      inoreader_id: sub.id,
      title: sub.title,
      url: sub.url,
      folder_id: sub.categories?.[0]?.id || null,
      unread_count: unreadCounts.get(sub.id) || 0
    }));

    if (feedsToUpsert.length > 0) {
      await supabase
        .from('feeds')
        .upsert(feedsToUpsert, { onConflict: 'inoreader_id' });
    }

    status.progress = 60;
    status.message = 'Fetching recent articles...';

    // Step 3: Fetch recent articles (single stream call)
    const maxArticles = process.env.SYNC_MAX_ARTICLES ? parseInt(process.env.SYNC_MAX_ARTICLES) : 100;
    const streamResponse = await tokenManager.makeAuthenticatedRequest(
      `https://www.inoreader.com/reader/api/0/stream/contents/user/-/state/com.google/reading-list?n=${maxArticles}`
    );

    if (!streamResponse.ok) {
      throw new Error(`Failed to fetch articles: ${streamResponse.statusText}`);
    }

    const streamData = await streamResponse.json();
    const articles = streamData.items || [];

    status.progress = 70;
    status.message = `Processing ${articles.length} articles...`;

    // Get feed IDs mapping
    const { data: feeds } = await supabase
      .from('feeds')
      .select('id, inoreader_id')
      .eq('user_id', userId);

    const feedIdMap = new Map(
      feeds?.map(f => [f.inoreader_id, f.id]) || []
    );

    // Mark sync timestamp for loop prevention
    const syncTimestamp = new Date().toISOString();

    // Process articles
    if (articles.length > 0 && feedIdMap.size > 0) {
      const articlesToUpsert = articles
        .filter((article: any) => {
          // Find which feed this article belongs to
          const feedInorId = article.origin?.streamId;
          return feedInorId && feedIdMap.has(feedInorId);
        })
        .map((article: any) => {
          const feedInorId = article.origin?.streamId;
          const feedId = feedIdMap.get(feedInorId);
          
          return {
            feed_id: feedId,
            inoreader_id: article.id,
            title: article.title || 'Untitled',
            content: article.content?.content || article.summary?.content || '',
            url: article.canonical?.[0]?.href || article.alternate?.[0]?.href || '',
            published_at: article.published ? new Date(article.published * 1000).toISOString() : null,
            is_read: article.categories?.includes('user/-/state/com.google/read') || false,
            is_starred: article.categories?.includes('user/-/state/com.google/starred') || false,
            last_sync_update: syncTimestamp // Mark as from sync
          };
        });

      if (articlesToUpsert.length > 0) {
        // Clear any pending sync queue items for these articles
        const inoreaderIds = articlesToUpsert.map((a: any) => a.inoreader_id);
        await supabase
          .from('sync_queue')
          .delete()
          .in('inoreader_id', inoreaderIds);

        // BIDIRECTIONAL SYNC CONFLICT RESOLUTION
        // ========================================
        // Get existing articles to check for local changes that need to be preserved.
        // We need to compare timestamps to avoid overwriting user actions made between syncs.
        const { data: existingArticles } = await supabase
          .from('articles')
          .select('inoreader_id, is_read, is_starred, last_local_update, last_sync_update, updated_at')
          .in('inoreader_id', inoreaderIds);

        const existingMap = new Map(
          existingArticles?.map(a => [a.inoreader_id, a]) || []
        );

        // Apply conflict resolution to preserve local changes
        const articlesWithConflictResolution = articlesToUpsert.map((article: any) => {
          const existing = existingMap.get(article.inoreader_id);
          
          if (existing && existing.last_local_update) {
            // IMPORTANT: We compare last_local_update with last_sync_update (not current time)
            // This ensures we only preserve changes made AFTER the last sync from Inoreader.
            // Using current time would cause a race condition where all local changes would
            // always win, preventing Inoreader changes from ever being applied.
            const lastSyncTime = existing.last_sync_update || existing.updated_at;
            if (new Date(existing.last_local_update) > new Date(lastSyncTime)) {
              // Local changes are newer than last sync - preserve local state
              // This handles the case where user marked articles as read/starred
              // between the last sync and now. Without this, their changes would
              // be lost every time we sync from Inoreader.
              console.log(`[Sync] Preserving local state for article ${article.inoreader_id}`);
              return {
                ...article,
                is_read: existing.is_read,
                is_starred: existing.is_starred,
                // Update sync timestamp but keep local changes
                last_sync_update: syncTimestamp
              };
            }
          }
          
          // No local changes or Inoreader state is newer - use Inoreader state
          // This is the normal case for articles that haven't been modified locally
          return article;
        });

        // Batch insert in chunks
        const chunkSize = 50;
        for (let i = 0; i < articlesWithConflictResolution.length; i += chunkSize) {
          const chunk = articlesWithConflictResolution.slice(i, i + chunkSize);
          await supabase
            .from('articles')
            .upsert(chunk, { onConflict: 'inoreader_id' });
          
          status.progress = 70 + Math.floor((i / articlesWithConflictResolution.length) * 20);
        }
      }
    }

    status.progress = 90;
    status.message = 'Refreshing feed statistics...';
    console.log('[Sync] Refreshing feed statistics...');

    // Refresh the materialized view for accurate unread counts
    try {
      const { error: refreshError } = await supabase.rpc('refresh_feed_stats');
      if (refreshError) {
        console.error('Failed to refresh feed stats:', refreshError);
        // Don't fail the sync if refresh fails - just log it
      } else {
        console.log('[Sync] Feed stats refreshed successfully');
      }
    } catch (error) {
      console.error('Error refreshing feed stats:', error);
      // Continue with sync completion even if refresh fails
    }

    // Auto-fetch full content for partial feeds
    status.progress = 92;
    status.message = 'Checking for partial content feeds...';
    console.log('[Sync] Starting auto-fetch for partial content feeds...');
    
    try {
      await performAutoFetch(userId);
    } catch (error) {
      console.error('[Sync] Auto-fetch error:', error);
      // Don't fail the sync if auto-fetch fails - just log it
    }

    status.progress = 95;
    status.message = 'Updating sync metadata...';
    console.log('[Sync] Updating sync metadata...');

    // Update sync metadata
    await supabase
      .from('sync_metadata')
      .upsert({
        key: 'last_sync_time',
        value: new Date().toISOString()
      }, { onConflict: 'key' });

    // Track API usage (approximately 4-5 calls per sync)
    await trackApiUsage('inoreader', 4);

    // Trigger bidirectional sync to push local changes to Inoreader
    status.progress = 98;
    status.message = 'Syncing local changes to Inoreader...';
    console.log('[Sync] Triggering bidirectional sync...');
    
    try {
      const syncServerUrl = process.env.SYNC_SERVER_URL || 'http://localhost:3001';
      const syncResponse = await fetch(`${syncServerUrl}/server/sync/trigger`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ force: true }) // Force sync even if < 5 changes
      });
      
      if (syncResponse.ok) {
        console.log('[Sync] Bidirectional sync triggered successfully');
      } else {
        console.error('[Sync] Failed to trigger bidirectional sync:', await syncResponse.text());
      }
    } catch (error) {
      console.error('[Sync] Error triggering bidirectional sync:', error);
      // Don't fail the main sync if bidirectional sync fails
    }

    // Complete
    status.status = 'completed';
    status.progress = 100;
    status.message = `Sync completed. Synced ${subscriptions.length} feeds and ${articles.length} articles.`;

  } catch (error) {
    console.error('Sync error:', error);
    status.status = 'failed';
    status.error = error instanceof Error ? error.message : 'Unknown error';
    throw error;
  }
}

// Check rate limit for Inoreader API
async function checkRateLimit() {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('api_usage')
    .select('count')
    .eq('service', 'inoreader')
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found error is ok
    console.error('Rate limit check error:', error);
    return { allowed: true, remaining: 100, used: 0, limit: 100 };
  }

  const used = data?.count || 0;
  const limit = 100;
  const remaining = limit - used;

  // Warn at 80% and 95%
  if (remaining <= 20 && remaining > 5) {
    console.warn(`Inoreader API rate limit warning: ${remaining} calls remaining today`);
  } else if (remaining <= 5) {
    console.error(`Inoreader API rate limit critical: Only ${remaining} calls remaining today`);
  }

  return {
    allowed: remaining > 0,
    remaining,
    used,
    limit
  };
}

// Track API usage
async function trackApiUsage(service: string, count: number = 1) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Try to update existing record
    const { data: existing } = await supabase
      .from('api_usage')
      .select('count')
      .eq('service', service)
      .eq('date', today)
      .single();

    if (existing) {
      await supabase
        .from('api_usage')
        .update({ count: existing.count + count })
        .eq('service', service)
        .eq('date', today);
    } else {
      // Create new record
      await supabase
        .from('api_usage')
        .insert({
          service,
          date: today,
          count
        });
    }
  } catch (error) {
    console.error('Failed to track API usage:', error);
  }
}

// Auto-fetch full content for articles from partial feeds
async function performAutoFetch(userId: string) {
  const AUTO_FETCH_RATE_LIMIT = 50; // Max 50 articles per 30 minutes
  const AUTO_FETCH_TIME_WINDOW = 30 * 60 * 1000; // 30 minutes in milliseconds
  
  try {
    // Check rate limit - count auto-fetch attempts in last 30 minutes
    const thirtyMinutesAgo = new Date(Date.now() - AUTO_FETCH_TIME_WINDOW).toISOString();
    const { count: recentFetches } = await supabase
      .from('fetch_logs')
      .select('*', { count: 'exact', head: true })
      .eq('fetch_type', 'auto')
      .gte('created_at', thirtyMinutesAgo);
    
    if (recentFetches && recentFetches >= AUTO_FETCH_RATE_LIMIT) {
      console.log(`[Auto-fetch] Rate limit reached: ${recentFetches}/${AUTO_FETCH_RATE_LIMIT} in last 30 minutes`);
      return;
    }
    
    const remainingFetches = AUTO_FETCH_RATE_LIMIT - (recentFetches || 0);
    console.log(`[Auto-fetch] Rate limit: ${remainingFetches} fetches remaining`);
    
    // Get feeds marked as partial content
    const { data: partialFeeds } = await supabase
      .from('feeds')
      .select('id')
      .eq('user_id', userId)
      .eq('is_partial_content', true);
    
    if (!partialFeeds || partialFeeds.length === 0) {
      console.log('[Auto-fetch] No partial content feeds found');
      return;
    }
    
    const feedIds = partialFeeds.map(f => f.id);
    console.log(`[Auto-fetch] Found ${partialFeeds.length} partial content feeds`);
    
    // Get recent articles from partial feeds that don't have full content
    const { data: articlesToFetch } = await supabase
      .from('articles')
      .select('id, url, feed_id')
      .in('feed_id', feedIds)
      .eq('has_full_content', false)
      .order('published_at', { ascending: false })
      .limit(remainingFetches);
    
    if (!articlesToFetch || articlesToFetch.length === 0) {
      console.log('[Auto-fetch] No articles need content extraction');
      return;
    }
    
    console.log(`[Auto-fetch] Fetching content for ${articlesToFetch.length} articles`);
    
    // Process articles
    for (const article of articlesToFetch) {
      const startTime = Date.now();
      
      try {
        // Log attempt
        await supabase
          .from('fetch_logs')
          .insert({
            article_id: article.id,
            feed_id: article.feed_id,
            fetch_type: 'auto',
            status: 'attempt'
          });
        
        // Fetch content using the existing endpoint
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
        const response = await fetch(`${baseUrl}/reader/api/articles/${article.id}/fetch-content`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });
        
        const duration = Date.now() - startTime;
        
        if (response.ok) {
          // Log success
          await supabase
            .from('fetch_logs')
            .insert({
              article_id: article.id,
              feed_id: article.feed_id,
              fetch_type: 'auto',
              status: 'success',
              duration_ms: duration
            });
          
          console.log(`[Auto-fetch] Success: Article ${article.id} (${duration}ms)`);
        } else {
          const error = await response.json();
          
          // Log failure
          await supabase
            .from('fetch_logs')
            .insert({
              article_id: article.id,
              feed_id: article.feed_id,
              fetch_type: 'auto',
              status: 'failure',
              error_reason: error.error || 'fetch_failed',
              error_details: error,
              duration_ms: duration
            });
          
          console.log(`[Auto-fetch] Failed: Article ${article.id} - ${error.error}`);
        }
        
      } catch (error) {
        const duration = Date.now() - startTime;
        
        // Log error
        await supabase
          .from('fetch_logs')
          .insert({
            article_id: article.id,
            feed_id: article.feed_id,
            fetch_type: 'auto',
            status: 'failure',
            error_reason: 'exception',
            error_details: { message: error instanceof Error ? error.message : 'Unknown error' },
            duration_ms: duration
          });
        
        console.error(`[Auto-fetch] Exception: Article ${article.id}`, error);
      }
      
      // Small delay between fetches to avoid overwhelming servers
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
  } catch (error) {
    console.error('[Auto-fetch] Error in performAutoFetch:', error);
    throw error;
  }
}