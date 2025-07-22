# Implementation Strategy - Shayon's News

## Overview

This document outlines the strategic approach to implementing the RSS Reader PWA with the server-client architecture, where the server handles all Inoreader communication and the client reads from Supabase.

## Server-Client Architecture

### Core Philosophy

Clean separation of concerns with the server as the single source of truth for all external API communication. The client is a pure presentation layer that reads from Supabase and triggers server operations.

### Implementation Strategy

#### 1. Server Architecture

```typescript
// Server components architecture
const serverArchitecture = {
  // API Routes - Handle client requests
  apiRoutes: {
    "/api/sync": "Trigger manual sync",
    "/api/sync/status/:id": "Check sync progress",
    "/api/articles/:id/fetch-content": "Fetch full content",
    "/api/articles/:id/summarize": "Generate AI summary"
  },

  // Background Services
  services: {
    syncService: "Handles all Inoreader API calls",
    cronScheduler: "Runs daily sync at midnight",
    tokenManager: "Manages OAuth tokens and refresh",
    contentExtractor: "Mozilla Readability integration"
  },

  // Process Management
  pm2: {
    script: "npm start",
    instances: 1,
    maxMemory: "1G",
    autoRestart: true
  }
};
```

#### 2. Server Sync Implementation

```typescript
// Server-side sync orchestration
class ServerSyncService {
  private apiCallCount = 0;
  private dailyLimit = 100;

  async performSync(syncId: string) {
    // Update sync status in Supabase
    await this.updateSyncStatus(syncId, 'running');

    try {
      // Efficient API usage: 4-5 calls total
      const subscriptions = await this.inoreader.getSubscriptions(); // 1 call
      const tags = await this.inoreader.getTags(); // 1 call
      
      // Single stream endpoint for ALL articles
      const articles = await this.inoreader.getStreamContents({
        n: 100,
        ot: await this.getLastSyncTimestamp()
      }); // 1 call
      
      const unreadCounts = await this.inoreader.getUnreadCounts(); // 1 call

      // Write everything to Supabase
      await this.supabase.transaction(async (tx) => {
        await tx.upsertFeeds(subscriptions);
        await tx.upsertTags(tags);
        await tx.upsertArticles(articles);
        await tx.updateUnreadCounts(unreadCounts);
      });

      await this.updateSyncStatus(syncId, 'completed');
    } catch (error) {
      await this.logSyncError(syncId, error);
      await this.updateSyncStatus(syncId, 'failed');
    }
  }
}
```

#### 3. Automatic Daily Sync Implementation

```javascript
// Node-cron based automatic sync service
const cron = require('node-cron');
const fs = require('fs').promises;
const path = require('path');

class CronSyncService {
  constructor() {
    this.logPath = process.env.SYNC_LOG_PATH || './logs/sync-cron.jsonl';
    this.isEnabled = process.env.ENABLE_AUTO_SYNC === 'true';
    this.schedule = process.env.SYNC_CRON_SCHEDULE || '0 2,14 * * *'; // 2am, 2pm
  }

  async start() {
    if (!this.isEnabled) {
      console.log('[Cron] Automatic sync is disabled');
      return;
    }

    // Schedule cron job
    cron.schedule(this.schedule, async () => {
      const trigger = this.getTriggerName();
      await this.executeSyncWithLogging(trigger);
    }, {
      timezone: 'America/Toronto'
    });

    console.log(`[Cron] Automatic sync scheduled: ${this.schedule}`);
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
      const response = await fetch('http://localhost:3000/api/sync', {
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

      // Update sync metadata
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
      const status = await this.checkSyncStatus(syncId);
      
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

      // Log progress updates
      if (status.progress % 20 === 0) {
        await this.logEvent({
          timestamp: new Date().toISOString(),
          trigger,
          status: 'running',
          progress: status.progress,
          message: status.message
        });
      }

      await new Promise(resolve => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error('Sync timeout after 2 minutes');
  }

  async logEvent(event) {
    const line = JSON.stringify(event) + '\n';
    await fs.appendFile(this.logPath, line);
  }

  getTriggerName() {
    const hour = new Date().getHours();
    return hour < 12 ? 'cron-2am' : 'cron-2pm';
  }
}

// Entry point for PM2
if (require.main === module) {
  const cronService = new CronSyncService();
  cronService.start();
  
  // Keep process alive
  process.stdin.resume();
}

module.exports = CronSyncService;
```

#### 4. OAuth Setup Automation

```typescript
// Automated OAuth setup with Playwright
class OAuthSetupService {
  async setupOAuth() {
    // Start temporary Express server
    const server = express();
    let capturedTokens: TokenData | null = null;
    
    server.get('/auth/callback', (req, res) => {
      capturedTokens = {
        access_token: req.query.access_token,
        refresh_token: req.query.refresh_token,
        expires_in: parseInt(req.query.expires_in)
      };
      res.send('OAuth setup complete! You can close this window.');
    });
    
    const httpServer = server.listen(8080);
    
    // Launch Playwright
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    
    // Navigate to Inoreader OAuth
    await page.goto(this.buildOAuthUrl());
    
    // Auto-fill credentials
    await page.fill('#email', process.env.TEST_INOREADER_EMAIL!);
    await page.fill('#password', process.env.TEST_INOREADER_PASSWORD!);
    await page.click('button[type="submit"]');
    
    // Wait for redirect
    await page.waitForURL('http://localhost:8080/auth/callback*');
    
    // Store tokens securely
    await this.storeTokens(capturedTokens!);
    
    // Cleanup
    await browser.close();
    httpServer.close();
  }
}
```

## State Management Architecture

### Client State (Zustand)

```typescript
// Simplified client state - read from Supabase
interface ClientState {
  articles: Article[];
  feeds: Feed[];
  tags: Tag[];
  filters: FilterState;
  settings: SettingsState;
  syncStatus: SyncStatusState;
}

// Article slice - read only from Supabase
const createArticleSlice: StateCreator<ClientState, [], [], ArticleSlice> = (
  set
) => ({
  articles: [],

  loadArticles: async () => {
    const { data } = await supabase
      .from('articles')
      .select('*')
      .order('published_at', { ascending: false })
      .limit(500);
    
    set({ articles: data || [] });
  },

  markAsRead: async (articleId: string) => {
    // Update Supabase immediately
    await supabase
      .from('articles')
      .update({ is_read: true })
      .eq('id', articleId);
    
    // Update local state
    set((state) => ({
      articles: state.articles.map(a => 
        a.id === articleId ? { ...a, is_read: true } : a
      )
    }));
  },
});
```

### Server State Management

```typescript
// Server maintains all external API state
class ServerStateManager {
  private tokenManager: TokenManager;
  private apiUsageTracker: ApiUsageTracker;
  
  constructor() {
    this.tokenManager = new TokenManager({
      storagePath: process.env.RSS_READER_TOKENS_PATH,
      encryption: 'keychain' // or 'aes256'
    });
    
    this.apiUsageTracker = new ApiUsageTracker({
      limits: {
        inoreader: { daily: 100 },
        anthropic: { monthly: 10000 }
      }
    });
  }
  
  async canPerformSync(): Promise<boolean> {
    const usage = await this.apiUsageTracker.getDailyUsage('inoreader');
    return usage < 100;
  }
  
  async refreshTokenIfNeeded() {
    const token = await this.tokenManager.getToken();
    if (this.isTokenExpiring(token)) {
      const newToken = await this.inoreaderApi.refreshToken(token.refresh_token);
      await this.tokenManager.storeToken(newToken);
    }
  }
}
```

## JSONL Logging and Analysis

### Sync Log Format

```jsonl
{"timestamp":"2025-01-22T07:00:00.123Z","trigger":"cron-2am","status":"started","syncId":"uuid-here"}
{"timestamp":"2025-01-22T07:00:02.456Z","trigger":"cron-2am","status":"running","progress":30,"message":"Found 22 feeds..."}
{"timestamp":"2025-01-22T07:00:45.789Z","trigger":"cron-2am","status":"completed","duration":45666,"feeds":22,"articles":156}
{"timestamp":"2025-01-22T14:00:00.123Z","trigger":"cron-2pm","status":"started","syncId":"uuid-here"}
{"timestamp":"2025-01-22T14:00:01.234Z","trigger":"cron-2pm","status":"error","error":"Rate limit exceeded","duration":1111}
```

### Log Analysis Commands

```bash
# Watch sync logs in real-time
tail -f logs/sync-cron.jsonl | jq .

# Count syncs by status
cat logs/sync-cron.jsonl | jq -r .status | sort | uniq -c

# See failed syncs with details
cat logs/sync-cron.jsonl | jq 'select(.status == "error")'

# Calculate average sync duration
cat logs/sync-cron.jsonl | jq 'select(.duration) | .duration' | awk '{sum+=$1; count++} END {print sum/count}'

# Get sync stats by trigger
cat logs/sync-cron.jsonl | jq -r .trigger | sort | uniq -c

# Find syncs that took longer than 1 minute
cat logs/sync-cron.jsonl | jq 'select(.duration > 60000)'

# Get daily sync summary
cat logs/sync-cron.jsonl | jq 'select(.status == "completed") | {date: .timestamp[0:10], articles: .articles}' | jq -s 'group_by(.date) | map({date: .[0].date, total_articles: map(.articles) | add})'
```

### Sync Metadata Management

```typescript
// Update sync metadata in Supabase
class SyncMetadataManager {
  async updateSyncMetadata(updates: Partial<SyncMetadata>) {
    const operations = [];
    
    for (const [key, value] of Object.entries(updates)) {
      if (typeof value === 'object' && value.increment) {
        // Handle increment operations
        const current = await this.getMetadataValue(key) || 0;
        operations.push({
          key,
          value: (parseInt(current) + value.increment).toString()
        });
      } else {
        // Direct value update
        operations.push({ key, value: String(value) });
      }
    }
    
    // Batch upsert
    await supabase
      .from('sync_metadata')
      .upsert(operations, { onConflict: 'key' });
  }
  
  async getSyncStats() {
    const keys = [
      'last_sync_time',
      'last_sync_status',
      'last_sync_error',
      'sync_success_count',
      'sync_failure_count'
    ];
    
    const { data } = await supabase
      .from('sync_metadata')
      .select('key, value')
      .in('key', keys);
    
    return data.reduce((acc, { key, value }) => {
      acc[key] = value;
      return acc;
    }, {});
  }
}
```

## API Conservation Strategies

### Efficient Inoreader API Usage

```typescript
class InoreaderApiOptimizer {
  // Use single stream endpoint instead of per-feed calls
  async fetchAllArticles(since: number): Promise<Article[]> {
    // This single call replaces potentially 20+ feed-specific calls
    const response = await this.api.get('/stream/contents/user/-/state/com.google/reading-list', {
      params: {
        n: 100, // max articles
        ot: since, // only articles since timestamp
        r: 'n', // newest first
        c: 'user/-/state/com.google/read' // exclude read items
      }
    });
    
    return response.items;
  }
  
  // Batch read/unread state updates
  async syncReadStates(changes: ReadStateChange[]) {
    if (changes.length === 0) return;
    
    // Single API call for all changes
    await this.api.post('/edit-tag', {
      i: changes.map(c => c.articleId),
      a: changes.filter(c => c.isRead).map(() => 'user/-/state/com.google/read'),
      r: changes.filter(c => !c.isRead).map(() => 'user/-/state/com.google/read')
    });
  }
}
```

### Article Distribution Algorithm

```typescript
// Round-robin distribution for fair feed representation
class ArticleDistributor {
  private readonly MAX_TOTAL = 100;
  private readonly MAX_PER_FEED = 20;
  
  async distributeArticles(feeds: Feed[]): Promise<DistributionPlan> {
    const activeFeedsWithUnread = feeds
      .filter(f => f.unread_count > 0)
      .sort((a, b) => a.last_fetched - b.last_fetched); // oldest first
    
    const distribution = new Map<string, number>();
    let totalAllocated = 0;
    let feedIndex = 0;
    
    // Round-robin allocation
    while (totalAllocated < this.MAX_TOTAL && activeFeedsWithUnread.length > 0) {
      const feed = activeFeedsWithUnread[feedIndex % activeFeedsWithUnread.length];
      const currentAllocation = distribution.get(feed.id) || 0;
      
      if (currentAllocation < this.MAX_PER_FEED && currentAllocation < feed.unread_count) {
        distribution.set(feed.id, currentAllocation + 1);
        totalAllocated++;
      } else {
        // Remove feed if it's maxed out
        activeFeedsWithUnread.splice(feedIndex % activeFeedsWithUnread.length, 1);
        if (activeFeedsWithUnread.length === 0) break;
      }
      
      feedIndex++;
    }
    
    return { distribution, totalAllocated };
  }
}
```

### Server API Monitoring

```typescript
// Server-side API usage tracking
class ServerApiMonitor {
  private readonly LOG_PATH = 'logs/inoreader-api-calls.jsonl';
  
  async logApiCall(details: ApiCallDetails) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint: details.endpoint,
      method: details.method,
      trigger: details.trigger, // 'manual-sync', 'auto-sync', etc.
      responseTime: details.responseTime,
      success: details.success,
      apiCallsToday: await this.getDailyCallCount()
    };
    
    // Append to JSONL file
    await fs.appendFile(this.LOG_PATH, JSON.stringify(logEntry) + '\n');
    
    // Check if approaching limit
    if (logEntry.apiCallsToday > 90) {
      await this.sendLimitWarning(logEntry.apiCallsToday);
    }
  }
  
  async getDailyStats() {
    const today = new Date().toISOString().split('T')[0];
    const logs = await this.readLogs();
    
    return logs
      .filter(log => log.timestamp.startsWith(today))
      .reduce((stats, log) => {
        stats.totalCalls++;
        stats.byEndpoint[log.endpoint] = (stats.byEndpoint[log.endpoint] || 0) + 1;
        stats.byTrigger[log.trigger] = (stats.byTrigger[log.trigger] || 0) + 1;
        return stats;
      }, { totalCalls: 0, byEndpoint: {}, byTrigger: {} });
  }
}
```

## Error Handling & Recovery

### Server Error Handling

```typescript
class ServerErrorHandler {
  async handleSyncError(syncId: string, error: any) {
    const errorType = this.classifyError(error);
    
    switch (errorType) {
      case 'RATE_LIMIT':
        await this.supabase.from('sync_errors').insert({
          sync_id: syncId,
          error_type: 'rate_limit',
          error_message: 'Daily API limit reached (100 calls)',
          item_reference: null
        });
        return { retry: false, message: 'Sync will resume tomorrow' };
        
      case 'TOKEN_EXPIRED':
        // Attempt token refresh
        try {
          await this.tokenManager.refreshToken();
          return { retry: true, message: 'Token refreshed, retrying...' };
        } catch {
          return { retry: false, message: 'OAuth re-authentication required' };
        }
        
      case 'NETWORK_ERROR':
        // Retry with exponential backoff
        return { retry: true, delay: this.calculateBackoff(error.attempt) };
        
      case 'PARTIAL_SYNC':
        // Log failed items but continue
        await this.logPartialSyncErrors(syncId, error.failedItems);
        return { retry: false, message: `Synced ${error.successCount} items, ${error.failedCount} failed` };
        
      default:
        await this.logUnknownError(syncId, error);
        return { retry: false, message: 'Sync failed, please try again later' };
    }
  }
}
```

### Client Error Display

```typescript
interface ClientErrorDisplay {
  // User-friendly error messages
  getErrorMessage(error: ApiError): ErrorDisplay {
    const errorMap = {
      // Tailscale errors
      TAILSCALE_NOT_CONNECTED: {
        title: "Tailscale Required",
        message: "Connect to Tailscale VPN to access the reader",
        action: "Open Tailscale",
        icon: "network-off"
      },
      
      // Server API errors
      RATE_LIMIT_EXCEEDED: {
        title: "Daily Limit Reached",
        message: "You've used 100/100 API calls today. Limit resets at midnight.",
        action: null,
        icon: "alert-circle"
      },
      
      // Supabase errors
      SUPABASE_CONNECTION_ERROR: {
        title: "Database Unavailable",
        message: "Cannot connect to database. Please check your connection.",
        action: "Retry",
        icon: "database-off"
      },
      
      // Sync errors
      SYNC_IN_PROGRESS: {
        title: "Sync Already Running",
        message: "Please wait for the current sync to complete",
        action: null,
        icon: "refresh"
      }
    };
    
    return errorMap[error.code] || {
      title: "Something went wrong",
      message: "Please try again later",
      action: "Retry",
      icon: "alert-triangle"
    };
  }
}
```

## Performance Optimization Strategies

### Client Performance

```typescript
// Minimal client bundle - server handles complexity
const ClientOptimizations = {
  // Lazy load non-critical views
  ArticleDetail: lazy(() => import("./ArticleDetail")),
  Settings: lazy(() => import("./Settings")),
  
  // Use Supabase realtime for live updates (future)
  useRealtimeSync: () => {
    const { articles } = useStore();
    
    useEffect(() => {
      const subscription = supabase
        .channel('articles')
        .on('postgres_changes', 
          { event: '*', schema: 'public', table: 'articles' },
          (payload) => {
            // Update local state from Supabase changes
            articles.handleRealtimeUpdate(payload);
          }
        )
        .subscribe();
        
      return () => subscription.unsubscribe();
    }, []);
  }
};
```

### Server Performance

```typescript
// Server-side optimizations
class ServerPerformanceOptimizer {
  // Parallel API calls where possible
  async performOptimizedSync() {
    // Run independent calls in parallel
    const [subscriptions, tags, unreadCounts] = await Promise.all([
      this.inoreader.getSubscriptions(),
      this.inoreader.getTags(),
      this.inoreader.getUnreadCounts()
    ]);
    
    // Then fetch articles (depends on nothing)
    const articles = await this.inoreader.getStreamContents({ n: 100 });
    
    // Batch database writes
    await this.supabase.transaction(async (tx) => {
      await Promise.all([
        tx.batchUpsert('feeds', subscriptions),
        tx.batchUpsert('tags', tags),
        tx.batchUpsert('articles', articles),
        tx.updateCounts(unreadCounts)
      ]);
    });
  }
  
  // Content extraction caching
  async fetchFullContent(articleId: string, url: string) {
    // Check if already fetched
    const existing = await this.supabase
      .from('articles')
      .select('full_content')
      .eq('id', articleId)
      .single();
      
    if (existing.data?.full_content) {
      return existing.data.full_content;
    }
    
    // Extract and store
    const content = await this.readability.parse(url);
    await this.supabase
      .from('articles')
      .update({ 
        full_content: content,
        has_full_content: true 
      })
      .eq('id', articleId);
      
    return content;
  }
}
```

### Image Optimization Strategy

```typescript
// Progressive image loading with blur-up technique
const OptimizedImage = ({ src, alt, className }: ImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false)
  const [hasError, setHasError] = useState(false)

  // Generate blur placeholder from dominant color
  const blurDataURL = generateBlurDataURL(src)

  return (
    <div className={`relative ${className}`}>
      <Image
        src={src}
        alt={alt}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
        placeholder="blur"
        blurDataURL={blurDataURL}
        onLoad={() => setIsLoaded(true)}
        onError={() => setHasError(true)}
        className={`transition-opacity duration-300 ${
          isLoaded ? 'opacity-100' : 'opacity-0'
        }`}
      />
      {hasError && (
        <div className="flex items-center justify-center bg-gray-100">
          <ImageIcon className="text-gray-400" />
        </div>
      )}
    </div>
  )
}
```

## User Experience Patterns

### Sync Status Communication

```typescript
// Real-time sync status updates
const useSyncStatus = () => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>({ status: 'idle' });
  
  const triggerSync = async () => {
    try {
      // Call server API
      const { syncId } = await fetch('/api/sync', { method: 'POST' }).then(r => r.json());
      setSyncStatus({ status: 'pending', syncId });
      
      // Poll for status
      const pollInterval = setInterval(async () => {
        const status = await fetch(`/api/sync/status/${syncId}`).then(r => r.json());
        setSyncStatus(status);
        
        if (status.status === 'completed' || status.status === 'failed') {
          clearInterval(pollInterval);
          
          // Refresh data from Supabase
          if (status.status === 'completed') {
            await refreshArticles();
          }
        }
      }, 2000);
    } catch (error) {
      setSyncStatus({ status: 'failed', error: error.message });
    }
  };
  
  return { syncStatus, triggerSync };
};
```

### Filter State Management

```typescript
// Mutually exclusive feed/tag filtering
const useArticleFilters = () => {
  const [activeFilter, setActiveFilter] = useState<Filter>({ type: 'all' });
  
  const setFeedFilter = (feedId: string) => {
    setActiveFilter({ type: 'feed', feedId });
  };
  
  const setTagFilter = (tagId: string) => {
    setActiveFilter({ type: 'tag', tagId });
  };
  
  const clearFilter = () => {
    setActiveFilter({ type: 'all' });
  };
  
  const getFilteredArticles = (articles: Article[]) => {
    switch (activeFilter.type) {
      case 'feed':
        return articles.filter(a => a.feed_id === activeFilter.feedId);
      case 'tag':
        return articles.filter(a => 
          a.tags?.some(t => t.tag_id === activeFilter.tagId)
        );
      default:
        return articles;
    }
  };
  
  return {
    activeFilter,
    setFeedFilter,
    setTagFilter,
    clearFilter,
    getFilteredArticles
  };
};
```

### Read Status Filtering with Database Counts

```typescript
// Enhanced read status filtering with accurate database counts
interface ArticleCountCache {
  counts: {
    total: number;
    unread: number;
    read: number;
  };
  timestamp: number;
  feedId?: string;
  folderId?: string;
}

class ArticleCountManager {
  private cache: Map<string, ArticleCountCache> = new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  
  // Get counts from database with smart caching
  async getArticleCounts(feedId?: string, folderId?: string): Promise<ArticleCounts> {
    const cacheKey = `${feedId || 'all'}-${folderId || 'all'}`;
    const cached = this.cache.get(cacheKey);
    
    // Return cached if still valid
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.counts;
    }
    
    // Fetch fresh counts from database
    const counts = await this.fetchCountsFromDatabase(feedId, folderId);
    
    // Update cache
    this.cache.set(cacheKey, {
      counts,
      timestamp: Date.now(),
      feedId,
      folderId
    });
    
    return counts;
  }
  
  // Fetch actual counts from Supabase
  private async fetchCountsFromDatabase(feedId?: string, folderId?: string) {
    let query = supabase
      .from('articles')
      .select('is_read', { count: 'exact', head: true });
    
    // Apply feed/folder filters
    if (feedId) {
      query = query.eq('feed_id', feedId);
    } else if (folderId) {
      // Get feeds in folder first
      const { data: feeds } = await supabase
        .from('feeds')
        .select('id')
        .eq('folder_id', folderId);
      
      const feedIds = feeds?.map(f => f.id) || [];
      if (feedIds.length > 0) {
        query = query.in('feed_id', feedIds);
      }
    }
    
    // Get total count
    const { count: total } = await query;
    
    // Get unread count
    const { count: unread } = await query.eq('is_read', false);
    
    return {
      total: total || 0,
      unread: unread || 0,
      read: (total || 0) - (unread || 0)
    };
  }
  
  // Invalidate cache when articles change
  invalidateCache(feedId?: string) {
    if (feedId) {
      // Invalidate specific feed and 'all' cache
      for (const [key, value] of this.cache.entries()) {
        if (key.includes(feedId) || key.startsWith('all-')) {
          this.cache.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
    }
  }
}

// Dynamic header based on read status filter
const getDynamicPageTitle = (
  readStatusFilter: 'all' | 'unread' | 'read',
  selectedFeed?: Feed,
  selectedFolder?: Folder
) => {
  // Base title from feed/folder selection
  let baseTitle: string;
  if (selectedFeed) {
    baseTitle = selectedFeed.title;
  } else if (selectedFolder) {
    baseTitle = selectedFolder.title;
  } else {
    baseTitle = 'Articles';
  }
  
  // Apply read status prefix
  switch (readStatusFilter) {
    case 'unread':
      return selectedFeed || selectedFolder 
        ? `Unread from ${baseTitle}` 
        : 'Unread Articles';
        
    case 'read':
      return selectedFeed || selectedFolder 
        ? `Read from ${baseTitle}` 
        : 'Read Articles';
        
    case 'all':
    default:
      return selectedFeed || selectedFolder 
        ? `All from ${baseTitle}` 
        : 'All Articles';
  }
};

// Header component with accurate counts
const ArticleHeader = () => {
  const { readStatusFilter, selectedFeedId, selectedFolderId } = useArticleStore();
  const [counts, setCounts] = useState<ArticleCounts>({ total: 0, unread: 0, read: 0 });
  const countManager = useRef(new ArticleCountManager());
  
  // Fetch counts when filters change
  useEffect(() => {
    const fetchCounts = async () => {
      const newCounts = await countManager.current.getArticleCounts(
        selectedFeedId || undefined,
        selectedFolderId || undefined
      );
      setCounts(newCounts);
    };
    
    fetchCounts();
  }, [readStatusFilter, selectedFeedId, selectedFolderId]);
  
  // Invalidate cache on article actions
  const handleArticleAction = () => {
    countManager.current.invalidateCache(selectedFeedId || undefined);
  };
  
  // Get dynamic title
  const pageTitle = getDynamicPageTitle(
    readStatusFilter,
    selectedFeed,
    selectedFolder
  );
  
  // Get count display based on filter
  const getCountDisplay = () => {
    switch (readStatusFilter) {
      case 'unread':
        return `${counts.unread} unread articles`;
      case 'read':
        return `${counts.read} read articles`;
      case 'all':
        return `${counts.total} total articles (${counts.unread} unread)`;
    }
  };
  
  return (
    <header className="border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{pageTitle}</h1>
          <p className="text-sm text-muted-foreground">{getCountDisplay()}</p>
        </div>
        <ReadStatusFilter />
      </div>
    </header>
  );
};
```

### Gesture-Based Navigation

```typescript
// Swipe gestures for article navigation
const useSwipeNavigation = (
  onSwipeLeft: () => void,
  onSwipeRight: () => void
) => {
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  const minSwipeDistance = 50;

  const onTouchStart = (e: TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e: TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;

    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) onSwipeLeft();
    if (isRightSwipe) onSwipeRight();
  };

  return { onTouchStart, onTouchMove, onTouchEnd };
};
```

## Security Implementation

### Token Storage Security

```typescript
// Secure server-side token management
class SecureTokenManager {
  private readonly TOKENS_PATH = process.env.RSS_READER_TOKENS_PATH || '~/.rss-reader/tokens.json';
  
  async storeTokens(tokens: TokenData) {
    // Encrypt tokens
    const encrypted = await this.encrypt(tokens);
    
    // Write with secure permissions
    await fs.writeFile(this.TOKENS_PATH, encrypted, { mode: 0o600 });
    
    // Log access (no sensitive data)
    await this.auditLog('tokens_stored', { timestamp: new Date() });
  }
  
  async getTokens(): Promise<TokenData> {
    try {
      const encrypted = await fs.readFile(this.TOKENS_PATH, 'utf-8');
      const tokens = await this.decrypt(encrypted);
      
      // Validate token structure
      if (!this.validateTokenStructure(tokens)) {
        throw new Error('Invalid token structure');
      }
      
      return tokens;
    } catch (error) {
      throw new Error('Token retrieval failed - run setup:oauth');
    }
  }
  
  private async encrypt(data: any): Promise<string> {
    // Use system keychain if available, otherwise AES-256
    if (await this.hasKeychain()) {
      return this.keychainEncrypt(data);
    }
    return this.aes256Encrypt(data);
  }
}
```

### Tailscale Access Control

```typescript
// Server monitors Tailscale health
class TailscaleMonitor {
  private readonly CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
  
  startMonitoring() {
    setInterval(async () => {
      try {
        const status = await this.checkTailscaleStatus();
        
        if (!status.connected) {
          console.error('Tailscale disconnected, attempting restart...');
          await this.restartTailscale();
        }
      } catch (error) {
        console.error('Tailscale health check failed:', error);
      }
    }, this.CHECK_INTERVAL);
  }
  
  private async checkTailscaleStatus() {
    const result = await exec('tailscale status --json');
    const status = JSON.parse(result.stdout);
    
    return {
      connected: status.BackendState === 'Running',
      ip: status.Self?.TailscaleIPs?.[0]
    };
  }
  
  private async restartTailscale() {
    // Requires sudo configuration in /etc/sudoers.d/tailscale
    await exec('sudo tailscale up');
    
    // Log restart attempt
    await this.logRestart();
  }
}
```

## Testing Strategy

### Playwright MCP for Development Testing

```typescript
// Use existing Playwright MCP setup for testing
const testScenarios = {
  // OAuth flow testing
  oauthSetup: async () => {
    // MCP server already configured with test credentials
    // Run OAuth setup and verify token storage
  },
  
  // Sync flow testing
  manualSync: async () => {
    // Trigger sync via UI
    // Monitor API calls in server logs
    // Verify article appearance in UI
  },
  
  // Content operations
  contentOperations: async () => {
    // Test full content fetching
    // Test AI summarization
    // Verify Supabase updates
  },
  
  // Read state management
  readStates: async () => {
    // Mark articles as read
    // Verify Supabase updates
    // Check sync to Inoreader
  }
};

// Mock data for development
const useMockData = process.env.USE_MOCK_DATA === 'true';

if (useMockData) {
  // Override Inoreader API calls with mock responses
  // Preserves daily API limit for production
}
```

## Deployment Strategy

### Production Deployment on Mac Mini

```typescript
// PM2 ecosystem configuration with cron service
module.exports = {
  apps: [{
    name: 'rss-reader',
    script: 'npm',
    args: 'start',
    cwd: '/path/to/rss-reader',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      NEXT_PUBLIC_BASE_PATH: '/reader'
    },
    max_memory_restart: '1G',
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    merge_logs: true,
    time: true,
    autorestart: true,
    watch: false
  }, {
    name: 'rss-sync-cron',
    script: './src/server/cron.js',
    cwd: '/path/to/rss-reader',
    instances: 1,
    env: {
      NODE_ENV: 'production',
      ENABLE_AUTO_SYNC: 'true',
      SYNC_CRON_SCHEDULE: '0 2,14 * * *',
      SYNC_LOG_PATH: './logs/sync-cron.jsonl'
    },
    max_memory_restart: '256M',
    error_file: 'logs/cron-error.log',
    out_file: 'logs/cron-out.log',
    merge_logs: true,
    time: true,
    autorestart: true,
    watch: false
  }]
};

// PM2 Management Commands
const pm2Commands = {
  // Start all services
  startAll: 'pm2 start ecosystem.config.js',
  
  // Check status
  status: 'pm2 status',
  
  // View logs
  logs: {
    all: 'pm2 logs',
    cron: 'pm2 logs rss-sync-cron',
    app: 'pm2 logs rss-reader'
  },
  
  // Restart services
  restart: {
    all: 'pm2 restart all',
    cron: 'pm2 restart rss-sync-cron',
    app: 'pm2 restart rss-reader'
  },
  
  // Monitor resources
  monitor: 'pm2 monit'
};

// Caddy configuration
const caddyConfig = `
100.96.166.53 {
  handle_path /reader* {
    reverse_proxy localhost:3000
  }
}
`;

// Deployment steps
class ProductionDeployment {
  async deploy() {
    // 1. Pull latest code
    await exec('git pull origin main');
    
    // 2. Install dependencies (including node-cron)
    await exec('npm ci --production');
    
    // 3. Build Next.js app
    await exec('npm run build');
    
    // 4. Run database migrations
    await this.runMigrations();
    
    // 5. Restart PM2 processes
    await exec('pm2 restart ecosystem.config.js');
    
    // 6. Verify deployment
    await this.verifyDeployment();
    
    // 7. Check cron service
    await this.verifyCronService();
  }
  
  async verifyCronService() {
    // Check if cron is running
    const status = await exec('pm2 show rss-sync-cron');
    console.log('Cron service status:', status);
    
    // Check recent logs
    const logs = await exec('tail -n 10 logs/sync-cron.jsonl');
    console.log('Recent sync activity:', logs);
  }
}
```

### Development Milestones

```typescript
// Implementation milestones from PRD
const milestones = [
  {
    id: 1,
    name: "Server Foundation",
    tasks: [
      "Implement OAuth setup script with Playwright",
      "Create token storage with encryption",
      "Build sync service (Inoreader → Supabase)",
      "Configure node-cron for daily sync",
      "Implement API endpoints for client",
      "Integrate Mozilla Readability"
    ]
  },
  {
    id: 2,
    name: "Client Simplification",
    tasks: [
      "Remove all Inoreader API calls from client",
      "Convert to Supabase-only data source",
      "Remove client authentication entirely",
      "Update sync button to call server API",
      "Configure Caddy reverse proxy for /reader"
    ]
  },
  {
    id: 3,
    name: "Core Reading Experience",
    tasks: [
      "Build article list and detail views",
      "Implement folder/feed hierarchy display",
      "Add tag display and filtering",
      "Implement read/unread management",
      "Add 'Fetch Full Content' button",
      "Ensure responsive design"
    ]
  },
  {
    id: 4,
    name: "AI Integration",
    tasks: [
      "Integrate Anthropic API server-side",
      "Create summarization endpoint",
      "Store summaries in Supabase",
      "Add re-summarize functionality",
      "Track API usage server-side"
    ]
  },
  {
    id: 5,
    name: "Polish & Production",
    tasks: [
      "Implement dark/light theme toggle",
      "Optimize performance",
      "Improve error handling",
      "Update PWA manifest for /reader path",
      "Configure service worker for Tailscale",
      "Prepare for open source release"
    ]
  }
];
```

## Bi-directional Sync Implementation (TODO-037)

### Overview

Implement two-way synchronization between the RSS Reader app and Inoreader for read/unread and starred status, ensuring changes made in either platform are reflected in both.

### Technical Architecture

#### 1. Sync Queue Service

```typescript
// Server-side sync queue management
class BiDirectionalSyncService {
  private readonly SYNC_INTERVAL_MS = (process.env.SYNC_INTERVAL_MINUTES || 5) * 60 * 1000;
  private readonly MIN_CHANGES = parseInt(process.env.SYNC_MIN_CHANGES || '5');
  private readonly BATCH_SIZE = parseInt(process.env.SYNC_BATCH_SIZE || '100');
  private readonly MAX_RETRIES = parseInt(process.env.SYNC_MAX_RETRIES || '3');
  private readonly RETRY_BACKOFF_MS = (process.env.SYNC_RETRY_BACKOFF_MINUTES || 10) * 60 * 1000;
  
  private syncTimer: NodeJS.Timer | null = null;
  private retryAttempts = new Map<string, number>();

  async startPeriodicSync() {
    // Clear any existing timer
    if (this.syncTimer) {
      clearInterval(this.syncTimer);
    }

    // Start periodic sync
    this.syncTimer = setInterval(async () => {
      await this.processSyncQueue();
    }, this.SYNC_INTERVAL_MS);

    console.log(`[BiDirectionalSync] Started periodic sync every ${this.SYNC_INTERVAL_MS / 60000} minutes`);
  }

  async processSyncQueue() {
    try {
      // Get pending changes from sync_queue
      const { data: pendingChanges } = await supabase
        .from('sync_queue')
        .select('*')
        .lt('sync_attempts', this.MAX_RETRIES)
        .order('created_at', { ascending: true });

      if (!pendingChanges || pendingChanges.length < this.MIN_CHANGES) {
        console.log(`[BiDirectionalSync] Only ${pendingChanges?.length || 0} changes pending, skipping sync`);
        return;
      }

      // Group changes by action type for efficient batching
      const groupedChanges = this.groupChangesByAction(pendingChanges);

      // Process each action type
      for (const [actionType, changes] of Object.entries(groupedChanges)) {
        await this.syncActionBatch(actionType, changes);
      }

    } catch (error) {
      console.error('[BiDirectionalSync] Error processing sync queue:', error);
    }
  }

  private groupChangesByAction(changes: SyncQueueItem[]): Record<string, SyncQueueItem[]> {
    return changes.reduce((acc, change) => {
      if (!acc[change.action_type]) {
        acc[change.action_type] = [];
      }
      acc[change.action_type].push(change);
      return acc;
    }, {} as Record<string, SyncQueueItem[]>);
  }

  async syncActionBatch(actionType: string, changes: SyncQueueItem[]) {
    // Process in batches of BATCH_SIZE
    for (let i = 0; i < changes.length; i += this.BATCH_SIZE) {
      const batch = changes.slice(i, i + this.BATCH_SIZE);
      
      try {
        await this.sendBatchToInoreader(actionType, batch);
        
        // Mark batch as synced
        const ids = batch.map(c => c.id);
        await supabase
          .from('sync_queue')
          .delete()
          .in('id', ids);
          
        console.log(`[BiDirectionalSync] Synced ${batch.length} ${actionType} changes`);
        
      } catch (error) {
        // Handle retry logic
        await this.handleSyncError(batch, error);
      }
    }
  }

  private async sendBatchToInoreader(actionType: string, batch: SyncQueueItem[]) {
    const tokenManager = require('../lib/token-manager.js');
    const tm = new tokenManager();

    // Prepare parameters based on action type
    const params = new URLSearchParams();
    
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
    }

    // Make API call
    const response = await tm.makeAuthenticatedRequest(
      'https://www.inoreader.com/reader/api/0/edit-tag',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
      }
    );

    if (!response.ok) {
      throw new Error(`Inoreader sync failed: ${response.statusText}`);
    }
  }

  private async handleSyncError(batch: SyncQueueItem[], error: any) {
    console.error('[BiDirectionalSync] Batch sync failed:', error);

    // Update retry attempts
    for (const item of batch) {
      const attempts = (this.retryAttempts.get(item.id) || 0) + 1;
      this.retryAttempts.set(item.id, attempts);

      await supabase
        .from('sync_queue')
        .update({
          sync_attempts: attempts,
          last_attempt_at: new Date().toISOString()
        })
        .eq('id', item.id);

      // Exponential backoff for next retry
      if (attempts < this.MAX_RETRIES) {
        const backoffMs = this.RETRY_BACKOFF_MS * Math.pow(2, attempts - 1);
        console.log(`[BiDirectionalSync] Will retry ${item.id} in ${backoffMs / 60000} minutes`);
      }
    }
  }
}
```

#### 2. Client-Side Change Tracking

```typescript
// Enhanced article store with sync queue integration
const useArticleStoreWithSync = create<ArticleStoreState>((set, get) => ({
  // ... existing store implementation ...

  markAsRead: async (articleId: string) => {
    const article = get().articles.get(articleId);
    if (!article) return;

    // Update local state immediately
    await supabase
      .from('articles')
      .update({ 
        is_read: true,
        last_local_update: new Date().toISOString()
      })
      .eq('id', articleId);

    // Queue for sync
    await supabase
      .from('sync_queue')
      .insert({
        article_id: articleId,
        inoreader_id: article.inoreaderItemId,
        action_type: 'read',
        action_timestamp: new Date().toISOString()
      });

    // Update UI
    set((state) => ({
      articles: new Map(state.articles).set(articleId, { ...article, isRead: true })
    }));
  },

  markAsUnread: async (articleId: string) => {
    const article = get().articles.get(articleId);
    if (!article) return;

    // Update local state
    await supabase
      .from('articles')
      .update({ 
        is_read: false,
        last_local_update: new Date().toISOString()
      })
      .eq('id', articleId);

    // Queue for sync
    await supabase
      .from('sync_queue')
      .insert({
        article_id: articleId,
        inoreader_id: article.inoreaderItemId,
        action_type: 'unread',
        action_timestamp: new Date().toISOString()
      });

    // Update UI
    set((state) => ({
      articles: new Map(state.articles).set(articleId, { ...article, isRead: false })
    }));
  },

  toggleStar: async (articleId: string) => {
    const article = get().articles.get(articleId);
    if (!article) return;

    const newStarred = !article.tags.includes('starred');

    // Update local state
    await supabase
      .from('articles')
      .update({ 
        is_starred: newStarred,
        last_local_update: new Date().toISOString()
      })
      .eq('id', articleId);

    // Queue for sync
    await supabase
      .from('sync_queue')
      .insert({
        article_id: articleId,
        inoreader_id: article.inoreaderItemId,
        action_type: newStarred ? 'star' : 'unstar',
        action_timestamp: new Date().toISOString()
      });

    // Update UI
    const newTags = newStarred 
      ? [...article.tags, 'starred']
      : article.tags.filter(t => t !== 'starred');

    set((state) => ({
      articles: new Map(state.articles).set(articleId, { ...article, tags: newTags })
    }));
  },

  // Special handling for "Mark All as Read"
  markAllAsRead: async (feedId?: string, folderId?: string) => {
    if (feedId) {
      // Use efficient mark-all-as-read API
      const response = await fetch('/api/mark-all-read', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedId })
      });

      if (response.ok) {
        // Update all articles in this feed locally
        await supabase
          .from('articles')
          .update({ 
            is_read: true,
            last_local_update: new Date().toISOString()
          })
          .eq('feed_id', feedId);

        // Update UI
        set((state) => {
          const newArticles = new Map(state.articles);
          for (const [id, article] of newArticles) {
            if (article.feedId === feedId) {
              newArticles.set(id, { ...article, isRead: true });
            }
          }
          return { articles: newArticles };
        });
      }
    }
  }
}));
```

#### 3. Server API Endpoint for Mark All as Read

```typescript
// New API endpoint: /api/mark-all-read
export async function POST(request: Request) {
  try {
    const { feedId, folderId } = await request.json();
    
    // Get the appropriate stream ID
    let streamId: string;
    if (feedId) {
      // Get feed's Inoreader ID
      const { data: feed } = await supabase
        .from('feeds')
        .select('inoreader_id')
        .eq('id', feedId)
        .single();
      
      streamId = feed?.inoreader_id;
    } else if (folderId) {
      // Get folder's Inoreader ID
      const { data: folder } = await supabase
        .from('folders')
        .select('inoreader_id')
        .eq('id', folderId)
        .single();
      
      streamId = folder?.inoreader_id;
    } else {
      streamId = 'user/-/state/com.google/reading-list'; // All articles
    }

    // Call Inoreader mark-all-as-read API
    const tokenManager = require('../../../../server/lib/token-manager.js');
    const tm = new tokenManager();

    const response = await tm.makeAuthenticatedRequest(
      'https://www.inoreader.com/reader/api/0/mark-all-as-read',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          s: streamId,
          ts: Math.floor(Date.now() / 1000).toString() // Current timestamp
        })
      }
    );

    if (!response.ok) {
      throw new Error(`Mark all as read failed: ${response.statusText}`);
    }

    // Track API usage
    await trackApiUsage('inoreader', 1);

    return NextResponse.json({ success: true });
    
  } catch (error) {
    console.error('Mark all as read error:', error);
    return NextResponse.json(
      { error: 'Failed to mark all as read' },
      { status: 500 }
    );
  }
}
```

#### 4. Sync Loop Prevention

```typescript
// Enhanced sync service with loop prevention
class SyncLoopPrevention {
  async performServerSync(syncId: string) {
    // ... existing sync code ...

    // When processing articles from Inoreader
    const articles = streamData.items || [];
    
    // Mark sync timestamp
    const syncTimestamp = new Date().toISOString();
    
    // Process articles with sync tracking
    const articlesToUpsert = articles.map((article: any) => ({
      // ... existing mapping ...
      is_read: article.categories?.includes('user/-/state/com.google/read') || false,
      is_starred: article.categories?.includes('user/-/state/com.google/starred') || false,
      last_sync_update: syncTimestamp // Mark as from sync
    }));

    // Clear any pending sync queue items for these articles
    const inoreaderIds = articles.map(a => a.id);
    if (inoreaderIds.length > 0) {
      await supabase
        .from('sync_queue')
        .delete()
        .in('inoreader_id', inoreaderIds);
    }
  }
}
```

#### 5. Database Migration

```sql
-- Migration: Add bi-directional sync support
CREATE TABLE IF NOT EXISTS sync_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  inoreader_id TEXT NOT NULL,
  action_type TEXT NOT NULL CHECK (action_type IN ('read', 'unread', 'star', 'unstar')),
  action_timestamp TIMESTAMPTZ NOT NULL,
  sync_attempts INTEGER DEFAULT 0,
  last_attempt_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sync_queue_created ON sync_queue(created_at);
CREATE INDEX idx_sync_queue_attempts ON sync_queue(sync_attempts);
CREATE INDEX idx_sync_queue_inoreader_id ON sync_queue(inoreader_id);

-- Add tracking columns to articles
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS last_local_update TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_sync_update TIMESTAMPTZ;

-- Add RLS policies for sync_queue
ALTER TABLE sync_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable all operations for anon users" ON sync_queue
  FOR ALL USING (true) WITH CHECK (true);
```

#### 6. Integration with Existing Features

**Auto-mark on Scroll (TODO-029)**:
```typescript
// Enhanced scroll observer for auto-marking
const useAutoMarkAsRead = () => {
  const markAsRead = useArticleStore(state => state.markAsRead);
  
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (!entry.isIntersecting && entry.boundingClientRect.top < 0) {
            // Article scrolled out of view at top
            const articleId = entry.target.getAttribute('data-article-id');
            if (articleId && !entry.target.hasAttribute('data-marked-read')) {
              markAsRead(articleId); // This now queues for sync
              entry.target.setAttribute('data-marked-read', 'true');
            }
          }
        });
      },
      { threshold: 0, rootMargin: '-10% 0px 0px 0px' }
    );

    // Observe all article elements
    document.querySelectorAll('[data-article-id]').forEach(el => {
      observer.observe(el);
    });

    return () => observer.disconnect();
  }, [markAsRead]);
};
```

### Deployment Considerations

1. **Environment Variables**: Add to `.env` and deployment configs
2. **PM2 Configuration**: Include bi-directional sync in cron service
3. **API Usage Monitoring**: Update tracking to include bi-directional calls
4. **Database Migration**: Run before deploying feature

### Testing Strategy

1. **Unit Tests**: Test sync queue operations
2. **Integration Tests**: Test API batching and error handling
3. **E2E Tests**: Test full sync flow with Playwright
4. **Manual Testing**: Verify cross-platform consistency

## Summary

This implementation strategy now includes comprehensive bi-directional sync, ensuring:

1. **Server handles everything complex**: OAuth, Inoreader API, content extraction, AI summarization, and bi-directional sync
2. **Client is purely presentational**: Reads from Supabase, calls server endpoints, queues local changes
3. **Clean-slate migration**: No data migration complexity
4. **Single-user optimization**: Dramatic simplification throughout
5. **Tailscale security**: Network-level access control
6. **Efficient sync**: Batched operations, smart timing, and conflict resolution

The strategy ensures efficient API usage (4-5 calls per sync + bi-directional sync calls), automated setup (Playwright OAuth), and a maintainable architecture suitable for open-sourcing.
