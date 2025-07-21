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
            is_starred: article.categories?.includes('user/-/state/com.google/starred') || false
          };
        });

      if (articlesToUpsert.length > 0) {
        // Batch insert in chunks
        const chunkSize = 50;
        for (let i = 0; i < articlesToUpsert.length; i += chunkSize) {
          const chunk = articlesToUpsert.slice(i, i + chunkSize);
          await supabase
            .from('articles')
            .upsert(chunk, { onConflict: 'inoreader_id' });
          
          status.progress = 70 + Math.floor((i / articlesToUpsert.length) * 20);
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