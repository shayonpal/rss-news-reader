# ADR-004: Client-Side API Rate Limiting Strategy

## Status

Accepted

## Context

The RSS Reader integrates with two external APIs with different rate limiting constraints:

1. **Inoreader API**: 100 calls per day (Zone 1 operations) for free tier
2. **Anthropic Claude API**: No hard rate limit but usage-based pricing

We need a rate limiting strategy that:

- Prevents hitting API limits that would break functionality
- Provides clear feedback to users about API usage
- Optimizes API calls to stay within limits
- Handles rate limit errors gracefully
- Tracks usage for both monitoring and cost control

The strategy must work entirely client-side since we're building a PWA that can work offline.

## Decision

Implement client-side rate limiting with:

- Local usage tracking in IndexedDB
- Proactive limit enforcement (stop at 95% usage)
- Visual usage indicators in the UI
- Batch operations to minimize API calls
- Smart caching to reduce redundant calls

## Consequences

### Positive

- **User awareness**: Clear visibility of API usage prevents surprises
- **Reliability**: Proactive limits prevent hitting hard stops
- **Cost control**: Usage tracking helps manage Claude API costs
- **Offline friendly**: Works without server-side infrastructure
- **Educational**: Users learn about API constraints

### Negative

- **Client-side only**: Can be bypassed (acceptable for personal use)
- **No global view**: Can't track usage across devices
- **Reset complexity**: Need to handle timezone differences for daily resets
- **Storage overhead**: Additional IndexedDB usage for tracking

### Neutral

- **User responsibility**: Users must manage their own usage
- **Manual monitoring**: No automatic alerts for high usage

## Alternatives Considered

### Alternative 1: Server-Side Rate Limiting

- **Description**: Traditional server-side API proxy with rate limiting
- **Pros**: Centralized control, can't be bypassed, global view of usage
- **Cons**: Requires server infrastructure, defeats PWA offline benefits
- **Reason for rejection**: Goes against offline-first architecture

### Alternative 2: No Rate Limiting

- **Description**: Make API calls freely and handle errors
- **Pros**: Simpler implementation, no tracking overhead
- **Cons**: Poor user experience when limits hit, potential for bill shock
- **Reason for rejection**: Unacceptable user experience

### Alternative 3: Hard-Coded Time Delays

- **Description**: Fixed delays between API calls
- **Pros**: Very simple to implement
- **Cons**: Inefficient, doesn't account for actual usage patterns
- **Reason for rejection**: Too restrictive and inefficient

### Alternative 4: Token Bucket Algorithm

- **Description**: Classic rate limiting with token regeneration
- **Pros**: Smooth rate limiting, allows bursts
- **Cons**: Complex for daily limits, overkill for our needs
- **Reason for rejection**: Unnecessary complexity for daily quotas

## Implementation Notes

### Usage Tracking

```typescript
interface ApiUsageTracker {
  // Inoreader tracking
  inoreader: {
    daily: Map<string, number>; // date -> count
    endpoints: Map<string, number>; // endpoint -> count
    lastReset: Date;
  };

  // Claude tracking
  claude: {
    daily: Map<string, UsageMetrics>;
    monthly: Map<string, UsageMetrics>;
  };
}

interface UsageMetrics {
  requests: number;
  tokens: number;
  estimatedCost: number;
}
```

### Rate Limiter Implementation

```typescript
class InoreaderRateLimiter {
  private readonly DAILY_LIMIT = 100;
  private readonly SOFT_LIMIT = 95; // Stop at 95%

  async canMakeRequest(): Promise<boolean> {
    const usage = await this.getTodayUsage();
    return usage < this.SOFT_LIMIT;
  }

  async recordRequest(endpoint: string): Promise<void> {
    const today = this.getDateKey();
    const current = (await this.storage.get(`inoreader.${today}`)) || 0;
    await this.storage.set(`inoreader.${today}`, current + 1);

    // Update UI
    this.notifyUsageChange(current + 1, this.DAILY_LIMIT);
  }

  private getDateKey(): string {
    // Use UTC date for consistent resets
    return new Date().toISOString().split("T")[0];
  }
}
```

### Batch Operations

```typescript
// Instead of individual API calls per feed
async function inefficientSync() {
  for (const feed of feeds) {
    await fetchFeed(feed.id); // 50+ API calls
  }
}

// Batch using stream endpoint
async function efficientSync() {
  // 1 call for all subscriptions
  const subscriptions = await fetchSubscriptions();

  // 1 call for all articles
  const articles = await fetchStreamContents("reading-list", { n: 100 });

  // 1 call for unread counts
  const unreadCounts = await fetchUnreadCounts();

  // Total: 3-4 API calls per sync
}
```

### UI Integration

```typescript
// API Usage Dashboard Component
function ApiUsageIndicator() {
  const { used, limit, percentage } = useApiUsage('inoreader')

  return (
    <div className="api-usage">
      <ProgressBar value={percentage} />
      <span>{used}/{limit} API calls today</span>
      {percentage > 80 && (
        <Warning>Approaching daily limit</Warning>
      )}
    </div>
  )
}
```

### Error Handling

```typescript
async function apiCall<T>(request: () => Promise<T>): Promise<T> {
  const rateLimiter = getRateLimiter();

  if (!(await rateLimiter.canMakeRequest())) {
    throw new ApiLimitError("Daily API limit reached. Try again tomorrow.");
  }

  try {
    const result = await request();
    await rateLimiter.recordRequest();
    return result;
  } catch (error) {
    if (error.status === 429) {
      await rateLimiter.handleRateLimitError();
      throw new ApiLimitError("Rate limit exceeded");
    }
    throw error;
  }
}
```

### Cost Tracking for Claude

```typescript
class ClaudeUsageTracker {
  private readonly COSTS = {
    INPUT_PER_1K: 0.003, // $3 per 1M tokens
    OUTPUT_PER_1K: 0.015, // $15 per 1M tokens
  };

  async recordUsage(input: number, output: number): Promise<void> {
    const cost = this.calculateCost(input, output);
    const today = this.getDateKey();

    const current = (await this.storage.get(`claude.${today}`)) || {
      requests: 0,
      tokens: 0,
      cost: 0,
    };

    await this.storage.set(`claude.${today}`, {
      requests: current.requests + 1,
      tokens: current.tokens + input + output,
      cost: current.cost + cost,
    });
  }
}
```

## Monitoring and Alerts

### Usage Patterns

- Track usage by hour to optimize sync timing
- Identify which operations consume most API calls
- Monitor Claude token usage by article length

### User Notifications

- Toast notification at 80% usage
- Disable sync button at 95% usage
- Daily summary of API usage (optional)
- Cost tracking for Claude API

## References

- [Inoreader API Documentation](https://www.inoreader.com/developers/)
- [Rate Limiting Best Practices](https://cloud.google.com/architecture/rate-limiting-strategies-techniques)
- [Client-Side Storage](https://web.dev/storage-for-the-web/)
- [API Usage Monitoring Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/throttling)
