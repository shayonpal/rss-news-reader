import Dexie, { Table } from 'dexie';
import type {
  Article,
  Feed,
  Folder,
  Summary,
  PendingAction,
  ApiUsage,
  UserPreferences,
} from '@/types';

// Database-specific interfaces
export interface StoredApiUsage extends Omit<ApiUsage, 'date'> {
  id?: number;
  date: string; // Store as ISO string in IndexedDB
}

export interface StoredUserPreferences extends UserPreferences {
  id?: number; // Primary key for settings (auto-increment)
  userId?: string; // Optional user association
  version: number; // For migration tracking
  updatedAt: Date;
}

export interface StoredPendingAction extends PendingAction {
  syncAttempts: number;
  lastAttemptAt?: Date;
}

export interface DatabaseInfo {
  id?: number;
  version: number;
  createdAt: Date;
  lastMigrationAt?: Date;
  corruptionCount: number;
}

export class AppDatabase extends Dexie {
  // Tables
  articles!: Table<Article, string>;
  feeds!: Table<Feed, string>;
  folders!: Table<Folder, string>;
  summaries!: Table<Summary, string>;
  pendingActions!: Table<StoredPendingAction, string>;
  apiUsage!: Table<StoredApiUsage, number>;
  userPreferences!: Table<StoredUserPreferences, number>;
  dbInfo!: Table<DatabaseInfo, number>;

  constructor() {
    super('ShayonNewsDB');

    // Version 1: Initial schema
    this.version(1).stores({
      articles: 'id, feedId, publishedAt, isRead, [feedId+isRead], [feedId+publishedAt], createdAt, updatedAt',
      feeds: 'id, folderId, title, isActive, lastFetchedAt, createdAt, updatedAt',
      folders: 'id, parentId, title, sortOrder, createdAt, updatedAt',
      summaries: 'id, articleId, generatedAt, model',
      pendingActions: 'id, type, articleId, timestamp, syncAttempts',
      apiUsage: '++id, date, inoreaderCalls, claudeCalls',
      userPreferences: '++id, userId, version, updatedAt',
      dbInfo: '++id, version, createdAt'
    });

    // Error handling
    this.on('versionchange', () => {
      console.warn('Database version changed by another tab. Reloading...');
      window.location.reload();
    });
  }

  // Initialization method
  async initialize(): Promise<void> {
    try {
      await this.open();
      const count = await this.dbInfo.count();
      if (count === 0) {
        await this.dbInfo.add({
          version: 1,
          createdAt: new Date(),
          corruptionCount: 0
        });
      }
    } catch (error) {
      console.error('Failed to initialize database:', error);
      throw error;
    }
  }

  // Utility methods
  async getVersion(): Promise<number> {
    const info = await this.dbInfo.orderBy('id').last();
    return info?.version ?? 1;
  }

  async recordCorruption(): Promise<void> {
    const info = await this.dbInfo.orderBy('id').last();
    if (info) {
      await this.dbInfo.update(info.id!, {
        corruptionCount: info.corruptionCount + 1
      });
    }
  }

  async getStorageInfo() {
    try {
      const estimate = navigator.storage?.estimate ? await navigator.storage.estimate() : null;
      const counts = await Promise.all([
        this.articles.count(),
        this.feeds.count(),
        this.folders.count(),
        this.summaries.count(),
        this.pendingActions.count(),
        this.apiUsage.count()
      ]);

      return {
        quota: estimate?.quota ?? 0,
        usage: estimate?.usage ?? 0,
        counts: {
          articles: counts[0],
          feeds: counts[1],
          folders: counts[2],
          summaries: counts[3],
          pendingActions: counts[4],
          apiUsage: counts[5]
        }
      };
    } catch (error) {
      console.error('Failed to get storage info:', error);
      return null;
    }
  }

  // Database maintenance
  async vacuum(): Promise<void> {
    // Clean up orphaned data
    const feedIds = new Set((await this.feeds.toArray()).map(f => f.id));
    const articleIds = new Set((await this.articles.toArray()).map(a => a.id));

    // Remove articles for non-existent feeds
    await this.articles.where('feedId').noneOf(Array.from(feedIds)).delete();

    // Remove summaries for non-existent articles
    await this.summaries.where('articleId').noneOf(Array.from(articleIds)).delete();

    // Remove old pending actions (older than 7 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    await this.pendingActions.where('timestamp').below(cutoff).delete();

    // Remove old API usage records (older than 30 days)
    const usageCutoff = new Date();
    usageCutoff.setDate(usageCutoff.getDate() - 30);
    await this.apiUsage.where('date').below(usageCutoff.toISOString().split('T')[0]).delete();
  }

  // Clear all data (for settings reset)
  async clearAllData(): Promise<void> {
    await this.transaction('rw', this.tables, async () => {
      await Promise.all([
        this.articles.clear(),
        this.feeds.clear(),
        this.folders.clear(),
        this.summaries.clear(),
        this.pendingActions.clear(),
        this.apiUsage.clear(),
        this.userPreferences.clear()
      ]);
    });
  }
}

// Global database instance
export const db = new AppDatabase();