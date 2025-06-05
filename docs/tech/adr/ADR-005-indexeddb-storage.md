# ADR-005: IndexedDB for Offline Storage

## Status
Accepted

## Context
The RSS Reader needs persistent client-side storage for:
- 500+ articles with full content
- Article metadata and reading states  
- AI-generated summaries
- Extracted full content from websites
- Feed structure and hierarchy
- User preferences and settings
- API usage tracking
- Offline action queue

Requirements:
- Store megabytes of article content
- Support complex queries (by date, feed, read status)
- Work offline
- Good performance with large datasets
- Structured data with relationships
- Binary data support (future: images)

Storage size estimates:
- Average article: 10KB (content + metadata)
- 500 articles: ~5MB
- Summaries: 1KB each = 500KB
- Feed data: ~100KB
- Total: ~10-20MB active storage

## Decision
Use IndexedDB with Dexie.js as the abstraction layer for all persistent storage needs.

## Consequences

### Positive
- **Large storage quota**: Gigabytes available (vs 5-10MB for localStorage)
- **Structured data**: Proper database with indexes and queries
- **Async API**: Non-blocking operations
- **Binary support**: Can store images/blobs in future
- **Transaction support**: Atomic operations for data integrity
- **Good performance**: Indexed queries are fast
- **Dexie benefits**: Simple API, TypeScript support, migrations

### Negative
- **Complexity**: More complex than localStorage
- **Browser differences**: Some API inconsistencies across browsers
- **No SQL**: Limited query capabilities compared to SQL
- **Debugging**: Harder to inspect than localStorage

### Neutral
- **Browser-only**: Can't access from service workers directly
- **Eventual consistency**: Need to handle async nature
- **Storage pressure**: Browser may clear under extreme pressure

## Alternatives Considered

### Alternative 1: localStorage
- **Description**: Simple key-value storage
- **Pros**: Simple API, synchronous, easy debugging
- **Cons**: 5-10MB limit, string-only, poor performance with large data
- **Reason for rejection**: Size limitations make it unsuitable

### Alternative 2: WebSQL
- **Description**: Deprecated SQL database
- **Pros**: Full SQL support, relational queries
- **Cons**: Deprecated, not supported in Firefox, no future
- **Reason for rejection**: Deprecated technology

### Alternative 3: Cache API
- **Description**: Storage for network requests
- **Pros**: Good for caching responses, works in service workers
- **Cons**: Not meant for application data, limited query ability
- **Reason for rejection**: Wrong tool for structured data

### Alternative 4: Firebase/Firestore
- **Description**: Cloud database with offline support
- **Pros**: Real-time sync, cross-device, powerful queries
- **Cons**: External dependency, costs, privacy concerns
- **Reason for rejection**: Want local-first, no external dependencies

### Alternative 5: SQLite WASM
- **Description**: SQLite compiled to WebAssembly
- **Pros**: Full SQL support, familiar API
- **Cons**: Large bundle size, experimental, complexity
- **Reason for rejection**: Too experimental, adds significant complexity

## Implementation Notes

### Database Schema
```typescript
// db/schema.ts
import Dexie, { Table } from 'dexie'

export interface Article {
  id: string
  feedId: string
  title: string
  url: string
  content: string
  extractedContent?: string
  summary?: string
  author?: string
  publishedAt: Date
  readAt?: Date
  isRead: boolean
  isFavorite: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Feed {
  id: string
  title: string
  url: string
  folderId?: string
  unreadCount: number
  lastSyncAt: Date
}

export class AppDatabase extends Dexie {
  articles!: Table<Article>
  feeds!: Table<Feed>
  summaries!: Table<Summary>
  syncQueue!: Table<SyncAction>
  
  constructor() {
    super('ShayonNewsDB')
    
    this.version(1).stores({
      articles: 'id, feedId, publishedAt, isRead, [feedId+isRead]',
      feeds: 'id, folderId',
      summaries: 'articleId',
      syncQueue: '++id, createdAt'
    })
  }
}

export const db = new AppDatabase()
```

### Indexed Queries
```typescript
// Efficient queries using indexes
class ArticleRepository {
  // Get unread articles from specific feed
  async getUnreadByFeed(feedId: string): Promise<Article[]> {
    return db.articles
      .where('[feedId+isRead]')
      .equals([feedId, false])
      .reverse()
      .sortBy('publishedAt')
  }
  
  // Get recent articles
  async getRecent(limit: number): Promise<Article[]> {
    return db.articles
      .orderBy('publishedAt')
      .reverse()
      .limit(limit)
      .toArray()
  }
  
  // Full-text search (basic)
  async search(query: string): Promise<Article[]> {
    const q = query.toLowerCase()
    return db.articles
      .filter(article => 
        article.title.toLowerCase().includes(q) ||
        article.content.toLowerCase().includes(q)
      )
      .toArray()
  }
}
```

### Storage Management
```typescript
class StorageManager {
  private readonly MAX_ARTICLES = 500
  
  async pruneOldArticles(): Promise<void> {
    const count = await db.articles.count()
    
    if (count > this.MAX_ARTICLES) {
      // Keep favorites and recent reads
      const toKeep = await db.articles
        .orderBy('publishedAt')
        .reverse()
        .limit(this.MAX_ARTICLES)
        .primaryKeys()
      
      await db.articles
        .where('id')
        .noneOf(toKeep)
        .and(article => !article.isFavorite)
        .delete()
    }
  }
  
  async getStorageEstimate(): Promise<StorageEstimate> {
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      return navigator.storage.estimate()
    }
    return { usage: 0, quota: 0 }
  }
}
```

### Migration System
```typescript
// Handle schema updates
db.version(2).stores({
  articles: 'id, feedId, publishedAt, isRead, [feedId+isRead], createdAt'
}).upgrade(trans => {
  // Add createdAt to existing articles
  return trans.table('articles').toCollection().modify(article => {
    article.createdAt = article.createdAt || new Date()
  })
})
```

### Service Worker Integration
```typescript
// Since IndexedDB isn't directly accessible in service workers
// Use message passing for offline queue

// In service worker
self.addEventListener('fetch', event => {
  if (!navigator.onLine && event.request.method === 'POST') {
    // Send to main thread for queuing
    self.clients.matchAll().then(clients => {
      clients.forEach(client => {
        client.postMessage({
          type: 'QUEUE_ACTION',
          action: extractAction(event.request)
        })
      })
    })
  }
})

// In main thread
navigator.serviceWorker.addEventListener('message', async event => {
  if (event.data.type === 'QUEUE_ACTION') {
    await db.syncQueue.add(event.data.action)
  }
})
```

### Performance Optimizations
1. **Bulk operations**: Use `bulkAdd` for multiple inserts
2. **Selective loading**: Only load needed fields
3. **Pagination**: Limit query results
4. **Indexes**: Add indexes for common queries
5. **Transactions**: Group related operations

### Backup/Export
```typescript
async function exportData(): Promise<Blob> {
  const data = {
    articles: await db.articles.toArray(),
    feeds: await db.feeds.toArray(),
    summaries: await db.summaries.toArray()
  }
  
  return new Blob(
    [JSON.stringify(data)], 
    { type: 'application/json' }
  )
}
```

## Storage Quotas and Limits
- **Persistent storage**: Request permission for persistent storage
- **Storage pressure**: Handle QuotaExceededError gracefully
- **Best effort**: Browser may still clear data in extreme cases

## References
- [IndexedDB API](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API)
- [Dexie.js Documentation](https://dexie.org/)
- [Storage for the Web](https://web.dev/storage-for-the-web/)
- [IndexedDB Best Practices](https://web.dev/indexeddb-best-practices/)