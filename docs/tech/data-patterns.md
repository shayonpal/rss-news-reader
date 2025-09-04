# Data Management Patterns - RSS News Reader

This document outlines the data management patterns, caching strategies, and data transformation utilities implemented in the RSS News Reader application.

## Caching Patterns

### TTL-Based Caching with Invalidation (RR-269)

**Pattern**: Time-to-Live (TTL) based caching with manual invalidation support for user preferences and settings.

**Implementation Architecture**:

```typescript
// Cache entry structure
interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time-to-live in milliseconds
}

// Cache implementation pattern
class TTLCache<T> {
  private cache = new Map<string, CacheEntry<T>>();
  
  set(key: string, data: T, ttl: number = 300000): void { // Default 5min TTL
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
  
  get(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key); // Auto-cleanup expired entries
      return null;
    }
    
    return entry.data;
  }
  
  invalidate(key: string): void {
    this.cache.delete(key);
  }
  
  clear(): void {
    this.cache.clear();
  }
}
```

**Usage Context**:

- **Settings Preferences**: Cache user settings with 5-minute TTL
- **API Configuration**: Cache external API configurations with 1-hour TTL  
- **User State**: Cache UI state preferences with session-based TTL
- **Feed Metadata**: Cache feed information with 15-minute TTL

**Benefits**:

- **Performance**: Reduces database queries for frequently accessed data
- **Automatic Cleanup**: TTL ensures cache doesn't grow unbounded
- **Manual Control**: Invalidation allows immediate cache updates when data changes
- **Memory Efficient**: Expired entries automatically removed on access

**Cache Timing Strategies**:

- **Short-term (5 minutes)**: User preferences, UI state
- **Medium-term (15 minutes)**: Feed metadata, article counts  
- **Long-term (1 hour)**: API configurations, system settings
- **Session-based**: Temporary UI state, form data

### Cache Invalidation Patterns

**Invalidation Triggers**:

1. **User Action**: Settings update, preference change
2. **Data Mutation**: Database writes that affect cached data
3. **Time-based**: TTL expiration for automatic cleanup
4. **System Events**: Application restart, configuration changes

**Implementation**:

```typescript
// Cache invalidation on user settings update
const updateUserSettings = async (settings: UserSettings) => {
  await database.updateSettings(settings);
  cache.invalidate(`user-settings-${userId}`); // Immediate invalidation
  cache.invalidate(`ui-preferences-${userId}`); // Related data invalidation
};

// Batch invalidation for related data
const invalidateUserData = (userId: string) => {
  const patterns = [`user-settings-${userId}`, `ui-prefs-${userId}`, `feed-config-${userId}`];
  patterns.forEach(pattern => cache.invalidate(pattern));
};
```

## Data Transformation Patterns

### Deep Merge for Nested Preferences (RR-269)

**Pattern**: Deep merge utility for combining nested user preference objects while preserving existing values and overriding only specified changes.

**Implementation**:

```typescript
// Deep merge utility for nested objects
const deepMerge = <T extends Record<string, any>>(target: T, source: Partial<T>): T => {
  const result = { ...target };
  
  for (const key in source) {
    if (source.hasOwnProperty(key)) {
      const sourceValue = source[key];
      const targetValue = result[key];
      
      if (isObject(sourceValue) && isObject(targetValue)) {
        // Recursively merge nested objects
        result[key] = deepMerge(targetValue, sourceValue);
      } else if (sourceValue !== undefined) {
        // Override primitive values and arrays
        result[key] = sourceValue;
      }
    }
  }
  
  return result;
};

// Type-safe object check
const isObject = (value: any): value is Record<string, any> => {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
};
```

**Usage Examples**:

```typescript
// Settings merge example
const existingSettings = {
  ui: {
    theme: 'dark',
    layout: { sidebar: true, compact: false },
    notifications: { email: true, push: false }
  },
  api: {
    keys: { anthropic: 'encrypted-key-1' },
    limits: { dailySync: 100 }
  }
};

const settingsUpdate = {
  ui: {
    layout: { compact: true }, // Only update compact, preserve sidebar
    notifications: { push: true } // Only update push, preserve email
  }
};

const mergedSettings = deepMerge(existingSettings, settingsUpdate);
// Result: All existing values preserved, only specified values updated
```

**Benefits**:

- **Granular Updates**: Update only specific nested properties
- **Preservation**: Existing values maintained unless explicitly overridden
- **Type Safety**: Full TypeScript support with proper type inference
- **Immutability**: Returns new object without modifying originals

**Use Cases**:

- **Settings Management**: Partial updates to complex preference structures
- **Configuration Merging**: Combining default and user configurations
- **State Management**: Updating nested application state
- **API Response Handling**: Merging incremental data updates

### Data Validation Patterns

**Pattern**: Zod schema validation for settings and preference data integrity.

**Implementation**:

```typescript
// Settings schema validation
const userSettingsSchema = z.object({
  ui: z.object({
    theme: z.enum(['light', 'dark', 'auto']),
    layout: z.object({
      sidebar: z.boolean(),
      compact: z.boolean()
    }),
    notifications: z.object({
      email: z.boolean(),
      push: z.boolean()
    })
  }),
  api: z.object({
    keys: z.record(z.string()), // Encrypted API keys
    limits: z.object({
      dailySync: z.number().min(1).max(1000)
    })
  })
});

// Validation with error handling
const validateSettings = (data: unknown): UserSettings => {
  try {
    return userSettingsSchema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Settings validation failed: ${error.errors.map(e => e.message).join(', ')}`);
    }
    throw error;
  }
};
```

## Data Persistence Patterns

### Settings Persistence Strategy

**Pattern**: Layered persistence with cache-first reads and write-through updates.

**Implementation Flow**:

1. **Read Path**: Cache → Database → Default values
2. **Write Path**: Validate → Database → Cache update → Response
3. **Error Handling**: Fallback to cache or defaults on database failure

```typescript
// Settings service with cache integration
class SettingsService {
  constructor(
    private database: DatabaseClient,
    private cache: TTLCache<UserSettings>,
    private encryption: EncryptionService
  ) {}
  
  async getSettings(userId: string): Promise<UserSettings> {
    // 1. Try cache first
    const cacheKey = `user-settings-${userId}`;
    const cached = this.cache.get(cacheKey);
    if (cached) return cached;
    
    // 2. Fallback to database
    try {
      const dbSettings = await this.database.getUserSettings(userId);
      if (dbSettings) {
        // Decrypt sensitive values
        const decrypted = this.decryptAPIKeys(dbSettings);
        this.cache.set(cacheKey, decrypted, 300000); // 5min TTL
        return decrypted;
      }
    } catch (error) {
      console.error('Database read failed, using defaults:', error);
    }
    
    // 3. Return defaults
    return this.getDefaultSettings();
  }
  
  async updateSettings(userId: string, updates: Partial<UserSettings>): Promise<UserSettings> {
    // 1. Get current settings
    const current = await this.getSettings(userId);
    
    // 2. Merge updates
    const merged = deepMerge(current, updates);
    
    // 3. Validate merged result
    const validated = validateSettings(merged);
    
    // 4. Encrypt sensitive data
    const encrypted = this.encryptAPIKeys(validated);
    
    // 5. Persist to database
    await this.database.updateUserSettings(userId, encrypted);
    
    // 6. Update cache
    const cacheKey = `user-settings-${userId}`;
    this.cache.set(cacheKey, validated, 300000);
    
    return validated;
  }
}
```

## Performance Optimization Patterns

### Batch Processing for Cache Operations

**Pattern**: Batch multiple cache operations to reduce overhead and improve performance.

```typescript
// Batch cache operations
class BatchCacheOperations {
  private pendingOperations: Array<() => Promise<void>> = [];
  private batchTimer: NodeJS.Timeout | null = null;
  
  queueOperation(operation: () => Promise<void>): void {
    this.pendingOperations.push(operation);
    
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => this.executeBatch(), 100); // 100ms batch window
    }
  }
  
  private async executeBatch(): Promise<void> {
    const operations = [...this.pendingOperations];
    this.pendingOperations = [];
    this.batchTimer = null;
    
    await Promise.all(operations.map(op => op().catch(console.error)));
  }
}
```

### Memory-Efficient Cache Management

**Pattern**: Automatic cleanup and memory bounds for long-running cache instances.

```typescript
// Memory-bounded cache with LRU eviction
class BoundedCache<T> extends TTLCache<T> {
  private maxEntries: number;
  private accessOrder = new Map<string, number>();
  
  constructor(maxEntries: number = 1000) {
    super();
    this.maxEntries = maxEntries;
  }
  
  set(key: string, data: T, ttl: number = 300000): void {
    super.set(key, data, ttl);
    this.accessOrder.set(key, Date.now());
    this.enforceMemoryBounds();
  }
  
  get(key: string): T | null {
    const result = super.get(key);
    if (result !== null) {
      this.accessOrder.set(key, Date.now()); // Update access time
    }
    return result;
  }
  
  private enforceMemoryBounds(): void {
    if (this.cache.size <= this.maxEntries) return;
    
    // Remove least recently used entries
    const sortedEntries = [...this.accessOrder.entries()]
      .sort(([, timeA], [, timeB]) => timeA - timeB);
    
    const toRemove = sortedEntries.slice(0, this.cache.size - this.maxEntries);
    toRemove.forEach(([key]) => {
      this.cache.delete(key);
      this.accessOrder.delete(key);
    });
  }
}
```

## Testing Patterns

### Cache Testing Strategy

**Pattern**: Isolated cache testing with proper cleanup and timing control.

```typescript
// Test utilities for cache testing
class CacheTestHelper {
  static createMockCache<T>(): TTLCache<T> {
    return new TTLCache<T>();
  }
  
  static async waitForTTL(ttl: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ttl + 10)); // Add buffer
  }
  
  static mockTimeAdvance(advanceMs: number): void {
    const originalNow = Date.now;
    const startTime = originalNow();
    Date.now = vi.fn(() => startTime + advanceMs);
  }
  
  static restoreTime(): void {
    Date.now = originalDateNow; // Restore original implementation
  }
}

// Example cache test with proper isolation
describe('TTL Cache', () => {
  let cache: TTLCache<string>;
  
  beforeEach(() => {
    cache = CacheTestHelper.createMockCache();
    CacheTestHelper.restoreTime();
  });
  
  afterEach(() => {
    cache.clear();
    CacheTestHelper.restoreTime();
  });
  
  it('should expire entries after TTL', () => {
    cache.set('key1', 'value1', 1000); // 1 second TTL
    expect(cache.get('key1')).toBe('value1');
    
    CacheTestHelper.mockTimeAdvance(1500); // Advance 1.5 seconds
    expect(cache.get('key1')).toBeNull(); // Should be expired
  });
});
```

## Error Handling Patterns

### Graceful Cache Degradation

**Pattern**: Fallback strategies when cache operations fail.

```typescript
// Resilient cache operations
class ResilientCacheService {
  async getWithFallback<T>(
    key: string,
    fallbackFn: () => Promise<T>,
    ttl: number = 300000
  ): Promise<T> {
    try {
      // Try cache first
      const cached = this.cache.get(key);
      if (cached !== null) return cached;
    } catch (error) {
      console.warn('Cache read failed, using fallback:', error);
    }
    
    // Execute fallback
    const result = await fallbackFn();
    
    // Try to cache result (non-blocking)
    this.setCacheAsync(key, result, ttl).catch(error => 
      console.warn('Cache write failed (non-critical):', error)
    );
    
    return result;
  }
  
  private async setCacheAsync<T>(key: string, data: T, ttl: number): Promise<void> {
    // Non-blocking cache write
    setTimeout(() => {
      try {
        this.cache.set(key, data, ttl);
      } catch (error) {
        // Log but don't throw - cache failure shouldn't break functionality
        console.warn('Async cache write failed:', error);
      }
    }, 0);
  }
}
```

## Related Documentation

- **Security Patterns**: See `docs/tech/security.md` for encryption implementation details
- **Database Schema**: See `docs/tech/database-schema.md` for data structure information
- **Testing Strategy**: See `docs/tech/e2e-testing.md` for comprehensive testing approaches
- **Performance**: See `docs/tech/known-issues.md` for performance optimization patterns

---

_This documentation covers the core data management patterns used throughout the RSS News Reader application, focusing on caching strategies, data transformation utilities, and performance optimization techniques._