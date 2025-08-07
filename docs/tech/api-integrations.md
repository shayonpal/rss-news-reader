# API Integrations - Shayon's News

## Overview

The RSS Reader integrates with two primary APIs:

1. **Inoreader API** - Feed management and article synchronization
2. **Anthropic Claude API** - AI-powered article summarization

## Inoreader API Integration

### Authentication

**OAuth 2.0 Flow:**

```typescript
// OAuth configuration
const OAUTH_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID,
  redirectUri: process.env.NEXT_PUBLIC_INOREADER_REDIRECT_URI,
  scope: "read write",
  authUrl: "https://www.inoreader.com/oauth2/auth",
  tokenUrl: "https://www.inoreader.com/oauth2/token",
};

// Token storage and refresh
interface TokenStorage {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  userId: string;
}
```

**Implementation Details:**

- Tokens stored securely in httpOnly cookies with 365-day expiration
- Proactive token refresh at 360-day mark (5-day buffer before expiration)
- Automatic refresh integrated into auth status checks
- Periodic 24-hour authentication checks for long-running sessions
- Fallback to re-authentication if refresh fails
- Clear error handling for authentication failures

**Key Changes (Issue #36 - July 16, 2025):**

- Extended token lifetime from 1 hour to 365 days
- Eliminated daily login requirement for users
- Reduced API calls from ~10 per app startup to 0 calls
- Manual sync-only approach preserves 100 calls/day rate limit

### Core Endpoints

#### 1. User Information

```typescript
GET / reader / api / 0 / user - info;
```

**Purpose**: Get user account details and verify authentication
**Frequency**: Once per session
**Response**:

```json
{
  "userId": "1005921515",
  "userName": "shayon@example.com",
  "userProfileId": "1005921515",
  "userEmail": "shayon@example.com"
}
```

#### 2. Subscription List

```typescript
GET / reader / api / 0 / subscription / list;
```

**Purpose**: Fetch all RSS feeds and folder structure
**Frequency**: Every sync (6 hours) or manual refresh
**Rate Limit Impact**: 1 call per sync
**Response**:

```json
{
  "subscriptions": [
    {
      "id": "feed/https://example.com/rss",
      "title": "Example Blog",
      "categories": [
        {
          "id": "user/1005921515/label/Tech",
          "label": "Tech"
        }
      ],
      "url": "https://example.com/rss",
      "htmlUrl": "https://example.com"
    }
  ]
}
```

#### 3. Stream Contents (Bulk Article Fetch)

```typescript
GET /reader/api/0/stream/contents/{stream_id}?n={count}&r=o
```

**Purpose**: Fetch articles from feeds or folders
**Frequency**: Every sync
**Rate Limit Impact**: 1-3 calls per sync (depending on folder structure)
**Parameters**:

- `stream_id`: Feed ID or folder ID (e.g., `user/{userId}/state/com.google/reading-list`)
- `n`: Number of articles (max 1000)
- `r=o`: Sort by oldest first for better pagination

**Implementation Strategy**:

```typescript
// Fetch from "All Items" stream to get up to 100 articles across all feeds
const ALL_ITEMS_STREAM = `user/${userId}/state/com.google/reading-list`;
const response = await fetch(`/stream/contents/${ALL_ITEMS_STREAM}?n=100&r=n`);

// Use round-robin approach if we need feed-specific limits
const feedPromises = subscriptions
  .slice(0, 5)
  .map((feed) => fetch(`/stream/contents/${feed.id}?n=20&r=n`));
```

#### 4. Unread Counts

```typescript
GET / reader / api / 0 / unread - count;
```

**Purpose**: Get unread count for each feed and folder
**Frequency**: Every sync
**Rate Limit Impact**: 1 call per sync
**Response**:

```json
{
  "unreadcounts": [
    {
      "id": "feed/https://example.com/rss",
      "count": 15,
      "newestItemTimestampUsec": "1672531200000000"
    }
  ]
}
```

#### 5. Mark Items as Read/Unread

```typescript
POST / reader / api / 0 / edit - tag;
```

**Purpose**: Sync read/unread states
**Frequency**: Every 30 minutes or on app close
**Rate Limit Impact**: 1 call per batch (up to 100 items)
**Payload**:

```json
{
  "i": ["item_id_1", "item_id_2"],
  "a": "user/{userId}/state/com.google/read",
  "ac": "edit-tags"
}
```

### Rate Limiting Strategy

**Current Limits** (Inoreader Free Tier):

- 100 API calls per day for Zone 1 (basic operations)
- Resets at midnight UTC

**Optimization Approach**:

```typescript
// Target: 5-6 API calls per complete sync
const syncStrategy = {
  subscriptionList: 1, // Get feeds structure
  streamContents: 1, // Bulk fetch from "All Items"
  unreadCounts: 1, // Get unread counts
  editTags: 1, // Batch read/unread updates
  userInfo: 0.2, // Only when needed (once per day)
};

// Total per sync: ~4-5 calls
// Daily usage: ~24-30 calls (6 incremental syncs + occasional full sync)
// Leaves 75+ calls for manual operations
```

**Rate Limit Management**:

```typescript
class RateLimitManager {
  private callsToday = 0;
  private lastReset = new Date().toDateString();

  async makeCall<T>(apiCall: () => Promise<T>): Promise<T> {
    if (this.callsToday >= 95) {
      throw new Error("API_LIMIT_REACHED");
    }

    this.callsToday++;
    return await apiCall();
  }

  getUsageStats() {
    return {
      used: this.callsToday,
      remaining: 100 - this.callsToday,
      resetTime: "Midnight UTC",
    };
  }
}
```

### Error Handling

**Common Error Scenarios**:

```typescript
interface ApiErrorHandler {
  401: () => triggerReAuthentication()
  403: () => showPermissionError()
  429: () => handleRateLimit()
  500: () => retryWithBackoff()
  502: () => showServiceUnavailable()
  timeout: () => retryWithExponentialBackoff()
}

// Retry strategy
const retryConfig = {
  maxRetries: 3,
  baseDelay: 1000,
  maxDelay: 10000,
  backoffFactor: 2
}
```

## Anthropic Claude API Integration

### Authentication

**API Key Authentication**:

```typescript
const headers = {
  Authorization: `Bearer ${process.env.ANTHROPIC_API_KEY}`,
  "Content-Type": "application/json",
  "x-api-key": process.env.ANTHROPIC_API_KEY,
};
```

### Core Endpoint

#### Messages API

```typescript
POST https://api.anthropic.com/v1/messages
```

**Configuration**:

```typescript
const CLAUDE_CONFIG = {
  model: "claude-sonnet-4-20250514",
  maxTokens: 200, // 100-120 word summaries
  temperature: 0.3, // Consistent, factual summaries
  topP: 0.9,
};
```

### Content Selection for Summarization

**IMPORTANT: Full Content Requirement**

Once the "Fetch Full Content" feature is implemented (US-104), the summarization endpoint will need to be updated to handle the distinction between partial RSS content and full article content:

```typescript
// Current implementation (already prefers full_content when available)
const contentToSummarize = article.full_content || article.content;

// Future consideration: Once full_content fetching is implemented,
// we should ALWAYS require full_content for summarization because:
// 1. RSS content may be truncated and miss key information
// 2. The system cannot reliably detect if RSS content is partial or complete
// 3. Summaries from partial content may be misleading or incomplete
// 4. Full content is user-triggered, ensuring intentional resource usage

// Recommended future implementation:
if (!article.full_content && !article.has_full_content) {
  return NextResponse.json(
    {
      error: "full_content_required",
      message: "Please fetch full article content before generating summary",
      requiresAction: "fetch_content",
    },
    { status: 400 }
  );
}
```

**Implementation Note**: The `has_full_content` flag should be set to `true` when content extraction is attempted, even if it fails (falling back to RSS content). This prevents repeated extraction attempts and allows summarization to proceed with available content.

### Prompt Engineering

**Optimized Prompt Template**:

```typescript
const SUMMARY_PROMPT = `You are a news summarization assistant. Create a concise summary of the following article in 150-175 words. Focus on the key facts, main arguments, and important conclusions. Maintain objectivity and preserve the author's core message.

IMPORTANT: Do NOT include the article title in your summary. Start directly with the content summary.

Article Details:
Title: {title}
Author: {author}
Published: {publishedDate}

Article Content:
{content}

Write a clear, informative summary that captures the essence of this article without repeating the title.`;

// Dynamic prompt based on content type
const promptVariants = {
  news: "Focus on who, what, when, where, why...",
  opinion: "Summarize the main argument and supporting points...",
  tech: "Explain the technical concepts and implications...",
  review: "Cover the main verdict and key pros/cons...",
};
```

### Token Management & Cost Optimization

**Token Estimation**:

```typescript
class TokenManager {
  // Rough estimation: 1 token ≈ 4 characters for English
  estimateTokens(text: string): number {
    return Math.ceil(text.length / 4);
  }

  // Truncate if content exceeds limits
  truncateContent(content: string, maxTokens: number = 8000): string {
    const estimatedTokens = this.estimateTokens(content);
    if (estimatedTokens <= maxTokens) return content;

    const maxChars = maxTokens * 4;
    return content.substring(0, maxChars) + "...";
  }
}
```

**Cost Tracking**:

```typescript
interface CostTracker {
  inputTokens: number
  outputTokens: number
  totalCost: number
  summariesGenerated: number

  calculateCost(): number {
    // Claude 4 Sonnet pricing (example)
    const inputCostPer1k = 0.003   // $3 per 1M tokens
    const outputCostPer1k = 0.015  // $15 per 1M tokens

    return (this.inputTokens / 1000 * inputCostPer1k) +
           (this.outputTokens / 1000 * outputCostPer1k)
  }
}
```

### Caching Strategy

**Summary Caching**:

```typescript
interface SummaryCache {
  articleId: string;
  contentHash: string; // MD5 of article content
  summary: string;
  generatedAt: Date;
  model: string;
  cost: number;
}

// Cache key based on content hash to detect updates
const getCacheKey = (articleId: string, content: string) => {
  const contentHash = md5(content);
  return `summary:${articleId}:${contentHash}`;
};
```

### Rate Limiting & Error Handling

**Rate Limits** (Anthropic):

- No specific documented limits, but implement conservative approach
- Monitor response times and implement backoff

**Error Handling**:

```typescript
interface ClaudeErrorHandler {
  400: (error) => handleInvalidRequest(error)    // Bad prompt/content
  401: () => handleInvalidApiKey()               // Auth error
  429: () => handleRateLimit()                   // Too many requests
  500: () => retryWithBackoff()                  // Server error
  overloaded: () => retryAfterDelay()           // Service overloaded
}

// Content validation before API call
const validateContent = (content: string) => {
  if (!content.trim()) throw new Error('EMPTY_CONTENT')
  if (content.length < 100) throw new Error('CONTENT_TOO_SHORT')
  if (content.length > 200000) throw new Error('CONTENT_TOO_LONG')
}
```

### Request Optimization

**Batch Processing**:

```typescript
// Don't batch Claude API calls - each article needs individual attention
// Instead, implement smart queuing

class SummaryQueue {
  private queue: SummaryRequest[] = [];
  private processing = false;

  async addToQueue(articleId: string, content: string) {
    this.queue.push({ articleId, content, timestamp: Date.now() });
    this.processQueue();
  }

  private async processQueue() {
    if (this.processing) return;
    this.processing = true;

    while (this.queue.length > 0) {
      const request = this.queue.shift()!;
      try {
        await this.generateSummary(request);
        await this.delay(1000); // 1 second between requests
      } catch (error) {
        if (error.status === 429) {
          await this.delay(5000); // Longer delay for rate limits
        }
      }
    }

    this.processing = false;
  }
}
```

## Full Content Extraction

For articles with partial content in RSS feeds, we implement direct content extraction from the original URLs. See **[Content Extraction Strategy](./content-extraction-strategy.md)** for detailed implementation.

### Key Components:

- **Primary**: `@mozilla/readability` + `jsdom` for Firefox-quality extraction
- **Fallback**: `@extractus/article-extractor` for difficult sites
- **Sanitization**: DOMPurify for security
- **Caching**: Memory + IndexedDB for performance

### Integration Points:

```typescript
// Detect partial content and trigger extraction
const needsExtraction =
  article.content.length < 500 ||
  article.content.includes("...") ||
  article.content.endsWith("[Read more]");

if (needsExtraction) {
  const extractedContent = await contentExtractor.extractFromUrl(article.url);
  // Cache and display full content
}
```

## API Integration Architecture

### Service Layer Structure

```typescript
// api/
├── inoreader/
│   ├── auth.ts           # OAuth flow management
│   ├── feeds.ts          # Subscription and folder operations
│   ├── articles.ts       # Article fetching and management
│   ├── sync.ts           # Read/unread state synchronization
│   └── rateLimiter.ts    # Rate limiting logic
├── claude/
│   ├── summarizer.ts     # Summary generation
│   ├── costTracker.ts    # Usage and cost monitoring
│   └── queue.ts          # Request queuing and processing
├── extraction/
│   ├── contentExtractor.ts    # Mozilla Readability implementation
│   ├── fallbackExtractor.ts   # Alternative extraction methods
│   └── extractionService.ts   # Orchestration and caching
└── common/
    ├── httpClient.ts     # Shared HTTP client with interceptors
    ├── errorHandler.ts   # Common error handling
    └── cache.ts          # Response caching utilities
```

### Sync Orchestration

```typescript
class SyncOrchestrator {
  async performSync(): Promise<SyncResult> {
    // Determine sync type (incremental vs full)
    const syncType = await this.determineSyncType();
    
    const steps = [
      this.syncUserInfo,
      this.syncSubscriptions,
      () => this.syncArticles(syncType), // Pass sync type for parameter selection
      this.syncUnreadCounts,
      this.syncReadStates,
      this.enforceArticleRetention, // NEW: Clean up old articles
    ];

    const results = [];
    for (const step of steps) {
      try {
        const result = await step();
        results.push(result);
      } catch (error) {
        if (this.isCriticalError(error)) throw error;
        results.push({ error: error.message });
      }
    }

    // Update sync metadata with appropriate timestamps
    await this.updateSyncMetadata(syncType);
    
    return this.consolidateResults(results);
  }
  
  private async determineSyncType(): Promise<'incremental' | 'full'> {
    const lastFullSync = await getSyncMetadata('last_full_sync_time');
    if (!lastFullSync) return 'full';
    
    const daysSince = (Date.now() - lastFullSync.getTime()) / (1000 * 60 * 60 * 24);
    return daysSince >= 7 ? 'full' : 'incremental';
  }
}
```

## Development & Testing Strategies

### Mock Data for Development

```typescript
// Mock Inoreader responses for development
const mockInoreaderData = {
  subscriptions: generateMockFeeds(10),
  articles: generateMockArticles(100),
  unreadCounts: generateMockCounts(),
};

// Mock Claude responses
const mockSummaries = new Map([
  ["article-1", "This is a mock summary for development..."],
  ["article-2", "Another mock summary to avoid API costs..."],
]);
```

### API Usage Monitoring

```typescript
interface ApiUsageMonitor {
  inoreader: {
    callsToday: number
    callsThisWeek: number
    lastReset: Date
  }
  claude: {
    summariesToday: number
    tokensUsed: number
    estimatedCost: number
  }
}

// Dashboard component for monitoring
const ApiUsageDashboard = () => {
  const usage = useApiUsage()

  return (
    <div>
      <ProgressBar
        value={usage.inoreader.callsToday}
        max={100}
        label="Inoreader API Calls"
      />
      <CostTracker
        cost={usage.claude.estimatedCost}
        summaries={usage.claude.summariesToday}
      />
    </div>
  )
}
```

## Security Considerations

### API Key Management

```typescript
// Environment variables (never commit to repo)
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_INOREADER_CLIENT_ID=...
INOREADER_CLIENT_SECRET=...

// Server-side only access for sensitive keys
const getClaudeApiKey = () => {
  if (typeof window !== 'undefined') {
    throw new Error('API key accessed on client side')
  }
  return process.env.ANTHROPIC_API_KEY
}
```

### Request Validation

```typescript
// Validate and sanitize all inputs
const sanitizeContent = (content: string): string => {
  // Remove potential XSS content
  return DOMPurify.sanitize(content);
};

// Rate limiting on our API routes
const rateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
});
```

### Error Information Security

```typescript
// Don't expose internal API details to frontend
const sanitizeError = (error: any): PublicError => {
  const publicErrors = {
    API_LIMIT_REACHED: "Daily API limit reached",
    AUTH_EXPIRED: "Please reconnect your account",
    NETWORK_ERROR: "Connection failed",
  };

  return publicErrors[error.code] || "Something went wrong";
};
```

## RR-149 Incremental Sync Enhancement

### Overview

The incremental sync implementation significantly improves efficiency by:

1. **Timestamp-Based Filtering**: Uses Inoreader's `ot` parameter to fetch only articles newer than the last sync
2. **Read Article Exclusion**: Uses `xt=read` parameter to exclude already-read articles
3. **Weekly Full Sync Fallback**: Performs complete sync every 7 days for data integrity
4. **Article Retention Management**: Automatically enforces article limits during sync

### Implementation Details

```typescript
// Incremental sync query construction
const buildSyncQuery = async (userId: string): Promise<string> => {
  const baseUrl = `/reader/api/0/stream/contents/user/${userId}/state/com.google/reading-list`;
  const params = new URLSearchParams({
    n: process.env.SYNC_MAX_ARTICLES || '500',
    r: 'n', // Newest first
    xt: 'read' // Exclude read articles
  });
  
  // Check if we need a full sync (weekly)
  const lastFullSync = await getSyncMetadata('last_full_sync_time');
  const daysSinceFullSync = lastFullSync ? 
    (Date.now() - lastFullSync.getTime()) / (1000 * 60 * 60 * 24) : 7;
    
  if (daysSinceFullSync < 7) {
    // Incremental sync - add timestamp filter
    const lastIncSync = await getSyncMetadata('last_incremental_sync_timestamp');
    if (lastIncSync) {
      params.set('ot', Math.floor(lastIncSync.getTime() / 1000).toString());
    }
  }
  
  return `${baseUrl}?${params.toString()}`;
};

// Article retention enforcement
const enforceArticleRetention = async (): Promise<void> => {
  const retentionLimit = parseInt(process.env.ARTICLES_RETENTION_LIMIT || '1000');
  await ArticleCleanupService.enforceRetentionLimit(retentionLimit);
};
```

### Sync Metadata Management

New metadata keys for tracking incremental sync state:

- `last_incremental_sync_timestamp`: Timestamp used for `ot` parameter in next sync
- `last_full_sync_time`: Tracks when last complete sync was performed

### Performance Benefits

- **Reduced Data Transfer**: Only fetches new, unread articles
- **Faster Sync Times**: Most incremental syncs process 0-50 articles vs 100-200
- **Lower API Usage**: Maintains same call count with much less data
- **Better User Experience**: Quicker syncs mean fresher content

### Fallback Strategy

Weekly full syncs ensure data integrity by:
- Catching any articles missed due to timestamp issues
- Synchronizing read states that may have drifted
- Providing a complete data refresh

This comprehensive API integration plan ensures efficient use of both Inoreader and Claude APIs while maintaining good user experience and staying within rate limits.
