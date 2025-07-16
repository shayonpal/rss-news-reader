import Dexie from 'dexie';
import { createClient } from '@supabase/supabase-js';
import type { 
  LegacyData, 
  LegacyArticle, 
  LegacyFeed, 
  LegacyFolder, 
  LegacyUser,
  Database 
} from './types';

// Interface for legacy database discovery
export interface LegacyDatabaseInfo {
  name: string;
  version: number;
  estimatedSize: number;
  lastModified: Date;
  tables: string[];
  recordCounts: Record<string, number>;
}

// Recovery progress tracking
export interface RecoveryProgress {
  phase: 'discovery' | 'extraction' | 'upload' | 'verification' | 'cleanup';
  currentStep: string;
  progress: number; // 0-100
  totalRecords: number;
  processedRecords: number;
  errors: string[];
}

// Recovery result
export interface RecoveryResult {
  success: boolean;
  migratedData: {
    users: number;
    feeds: number;
    articles: number;
    folders: number;
  };
  errors: string[];
  duration: number; // milliseconds
}

export class LegacyRecoverySystem {
  private supabase: ReturnType<typeof createClient<Database>>;
  private progressCallback?: (progress: RecoveryProgress) => void;

  constructor(
    supabaseUrl: string, 
    supabaseKey: string,
    progressCallback?: (progress: RecoveryProgress) => void
  ) {
    this.supabase = createClient<Database>(supabaseUrl, supabaseKey);
    this.progressCallback = progressCallback;
  }

  /**
   * Discover all IndexedDB databases that might contain RSS reader data
   */
  async discoverLegacyDatabases(): Promise<LegacyDatabaseInfo[]> {
    this.updateProgress('discovery', 'Scanning for legacy databases...', 0);
    
    const databases: LegacyDatabaseInfo[] = [];
    
    try {
      // Get all IndexedDB databases
      const dbList = await indexedDB.databases();
      
      for (const dbInfo of dbList) {
        if (!dbInfo.name) continue;
        
        // Look for RSS reader related databases
        if (this.isRssReaderDatabase(dbInfo.name)) {
          try {
            const legacyInfo = await this.inspectLegacyDatabase(dbInfo.name);
            if (legacyInfo) {
              databases.push(legacyInfo);
            }
          } catch (error) {
            console.warn(`Failed to inspect database ${dbInfo.name}:`, error);
          }
        }
      }
      
      this.updateProgress('discovery', `Found ${databases.length} legacy databases`, 100);
      return databases;
    } catch (error) {
      console.error('Failed to discover legacy databases:', error);
      this.updateProgress('discovery', 'Failed to discover databases', 0, [error instanceof Error ? error.message : 'Unknown error']);
      return [];
    }
  }

  /**
   * Check if a database name indicates it's an RSS reader database
   */
  private isRssReaderDatabase(dbName: string): boolean {
    const rssIndicators = [
      'ShayonNewsDB',
      'RSSReader',
      'NewsReader',
      'FeedReader',
      'InoreaderDB',
      'rss-news-reader'
    ];
    
    return rssIndicators.some(indicator => 
      dbName.toLowerCase().includes(indicator.toLowerCase())
    );
  }

  /**
   * Inspect a legacy database to get its structure and content info
   */
  private async inspectLegacyDatabase(dbName: string): Promise<LegacyDatabaseInfo | null> {
    try {
      const db = new Dexie(dbName);
      
      // Try to open the database
      await db.open();
      
      const tableNames = db.tables.map(table => table.name);
      const recordCounts: Record<string, number> = {};
      
      // Get record counts for each table
      for (const table of db.tables) {
        try {
          recordCounts[table.name] = await table.count();
        } catch (error) {
          console.warn(`Failed to count records in ${table.name}:`, error);
          recordCounts[table.name] = 0;
        }
      }
      
      // Estimate database size
      const estimatedSize = this.estimateDatabaseSize(recordCounts);
      
      db.close();
      
      return {
        name: dbName,
        version: db.verno,
        estimatedSize,
        lastModified: new Date(), // We don't have exact last modified, use current time
        tables: tableNames,
        recordCounts
      };
    } catch (error) {
      console.error(`Failed to inspect database ${dbName}:`, error);
      return null;
    }
  }

  /**
   * Estimate database size based on record counts
   */
  private estimateDatabaseSize(recordCounts: Record<string, number>): number {
    // Rough estimation based on typical record sizes
    const estimatedSizes: Record<string, number> = {
      articles: 2000, // ~2KB per article
      feeds: 500,     // ~500B per feed
      folders: 200,   // ~200B per folder
      users: 1000,    // ~1KB per user
      summaries: 5000, // ~5KB per summary
      pendingActions: 100, // ~100B per action
      apiUsage: 50,   // ~50B per usage record
      userPreferences: 1000 // ~1KB per preference
    };
    
    let totalSize = 0;
    for (const [tableName, count] of Object.entries(recordCounts)) {
      const estimatedRecordSize = estimatedSizes[tableName] || 500; // Default 500B
      totalSize += count * estimatedRecordSize;
    }
    
    return totalSize;
  }

  /**
   * Extract all data from a legacy database
   */
  async extractFromLegacyDatabase(dbName: string): Promise<LegacyData> {
    this.updateProgress('extraction', `Extracting data from ${dbName}...`, 0);
    
    const legacyData: LegacyData = {
      users: [],
      feeds: [],
      articles: [],
      folders: []
    };
    
    try {
      const db = new Dexie(dbName);
      await db.open();
      
      // Extract data from each table
      const tables = db.tables.map(t => t.name);
      let completedTables = 0;
      
      for (const tableName of tables) {
        try {
          const table = db.table(tableName);
          const records = await table.toArray();
          
          // Map records to legacy format based on table name
          switch (tableName) {
            case 'articles':
              legacyData.articles = records.map(this.mapToLegacyArticle);
              break;
            case 'feeds':
              legacyData.feeds = records.map(this.mapToLegacyFeed);
              break;
            case 'folders':
              legacyData.folders = records.map(this.mapToLegacyFolder);
              break;
            // Note: Users table might not exist in legacy DBs, we'll create a default user
          }
          
          completedTables++;
          this.updateProgress('extraction', `Extracted ${tableName}`, (completedTables / tables.length) * 100);
        } catch (error) {
          console.warn(`Failed to extract from table ${tableName}:`, error);
          this.updateProgress('extraction', `Failed to extract ${tableName}`, 0, [error instanceof Error ? error.message : 'Unknown error']);
        }
      }
      
      // If no users found, create a default user
      if (legacyData.users.length === 0) {
        legacyData.users.push({
          id: 'legacy-user',
          email: 'legacy@migration.local',
          inoreader_id: undefined,
          preferences: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      }
      
      db.close();
      
      this.updateProgress('extraction', `Extracted ${legacyData.articles.length} articles, ${legacyData.feeds.length} feeds`, 100);
      return legacyData;
    } catch (error) {
      console.error(`Failed to extract from database ${dbName}:`, error);
      this.updateProgress('extraction', 'Extraction failed', 0, [error instanceof Error ? error.message : 'Unknown error']);
      throw error;
    }
  }

  /**
   * Map legacy article record to LegacyArticle format
   */
  private mapToLegacyArticle(record: any): LegacyArticle {
    return {
      id: record.id || `legacy-article-${Date.now()}-${Math.random()}`,
      feed_id: record.feedId || record.feed_id || 'unknown-feed',
      inoreader_id: record.inoreaderItemId || record.inoreader_id || record.id,
      title: record.title || 'Untitled Article',
      content: record.content || record.summary || '',
      url: record.url || record.link || '',
      published_at: record.publishedAt || record.published_at || new Date().toISOString(),
      is_read: record.isRead ?? record.is_read ?? false,
      is_starred: record.isStarred ?? record.is_starred ?? false,
      author: record.author || '',
      summary: record.summary || '',
      created_at: record.createdAt || record.created_at || new Date().toISOString(),
      updated_at: record.updatedAt || record.updated_at || new Date().toISOString()
    };
  }

  /**
   * Map legacy feed record to LegacyFeed format
   */
  private mapToLegacyFeed(record: any): LegacyFeed {
    return {
      id: record.id || `legacy-feed-${Date.now()}-${Math.random()}`,
      user_id: record.userId || record.user_id || 'legacy-user',
      inoreader_id: record.inoreaderFeedId || record.inoreader_id || record.id,
      title: record.title || 'Untitled Feed',
      url: record.url || record.feedUrl || '',
      folder_id: record.folderId || record.folder_id || null,
      unread_count: record.unreadCount || record.unread_count || 0,
      icon_url: record.iconUrl || record.icon_url || '',
      created_at: record.createdAt || record.created_at || new Date().toISOString(),
      updated_at: record.updatedAt || record.updated_at || new Date().toISOString()
    };
  }

  /**
   * Map legacy folder record to LegacyFolder format
   */
  private mapToLegacyFolder(record: any): LegacyFolder {
    return {
      id: record.id || `legacy-folder-${Date.now()}-${Math.random()}`,
      user_id: record.userId || record.user_id || 'legacy-user',
      inoreader_id: record.inoreaderFolderId || record.inoreader_id || record.id,
      name: record.title || record.name || 'Untitled Folder',
      parent_id: record.parentId || record.parent_id || null,
      created_at: record.createdAt || record.created_at || new Date().toISOString()
    };
  }

  /**
   * Upload legacy data to Supabase
   */
  async uploadToSupabase(data: LegacyData): Promise<void> {
    this.updateProgress('upload', 'Uploading data to Supabase...', 0);
    
    const totalRecords = data.users.length + data.feeds.length + data.articles.length + data.folders.length;
    let processedRecords = 0;
    
    try {
      // Upload users first
      if (data.users.length > 0) {
        await this.batchUpload('users', data.users, 50);
        processedRecords += data.users.length;
        this.updateProgress('upload', 'Uploaded users', (processedRecords / totalRecords) * 100);
      }
      
      // Upload folders
      if (data.folders.length > 0) {
        await this.batchUpload('folders', data.folders, 50);
        processedRecords += data.folders.length;
        this.updateProgress('upload', 'Uploaded folders', (processedRecords / totalRecords) * 100);
      }
      
      // Upload feeds
      if (data.feeds.length > 0) {
        await this.batchUpload('feeds', data.feeds, 50);
        processedRecords += data.feeds.length;
        this.updateProgress('upload', 'Uploaded feeds', (processedRecords / totalRecords) * 100);
      }
      
      // Upload articles
      if (data.articles.length > 0) {
        await this.batchUpload('articles', data.articles, 25); // Smaller batches for articles
        processedRecords += data.articles.length;
        this.updateProgress('upload', 'Uploaded articles', (processedRecords / totalRecords) * 100);
      }
      
      this.updateProgress('upload', 'Upload completed successfully', 100);
    } catch (error) {
      console.error('Failed to upload to Supabase:', error);
      this.updateProgress('upload', 'Upload failed', 0, [error instanceof Error ? error.message : 'Unknown error']);
      throw error;
    }
  }

  /**
   * Upload records in batches to avoid overwhelming the database
   */
  private async batchUpload(tableName: string, records: any[], batchSize: number): Promise<void> {
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      
      try {
        // Use upsert to handle potential duplicates
        const { error } = await this.supabase
          .from(tableName)
          .upsert(batch, { onConflict: 'inoreader_id' });
        
        if (error) {
          console.error(`Failed to upload batch to ${tableName}:`, error);
          throw new Error(`Failed to upload batch to ${tableName}: ${error.message}`);
        }
        
        // Small delay to avoid overwhelming the database
        await new Promise(resolve => setTimeout(resolve, 100));
      } catch (error) {
        console.error(`Batch upload failed for ${tableName}:`, error);
        throw error;
      }
    }
  }

  /**
   * Verify that the migration was successful
   */
  async verifyMigration(originalData: LegacyData): Promise<boolean> {
    this.updateProgress('verification', 'Verifying migration...', 0);
    
    try {
      // Count records in Supabase
      const [usersCount, feedsCount, articlesCount, foldersCount] = await Promise.all([
        this.supabase.from('users').select('*', { count: 'exact', head: true }),
        this.supabase.from('feeds').select('*', { count: 'exact', head: true }),
        this.supabase.from('articles').select('*', { count: 'exact', head: true }),
        this.supabase.from('folders').select('*', { count: 'exact', head: true })
      ]);
      
      const verification = {
        users: (usersCount.count || 0) >= originalData.users.length,
        feeds: (feedsCount.count || 0) >= originalData.feeds.length,
        articles: (articlesCount.count || 0) >= originalData.articles.length,
        folders: (foldersCount.count || 0) >= originalData.folders.length
      };
      
      const success = Object.values(verification).every(v => v);
      
      this.updateProgress('verification', 
        success ? 'Migration verified successfully' : 'Migration verification failed', 
        100, 
        success ? [] : ['Record counts do not match expected values']
      );
      
      return success;
    } catch (error) {
      console.error('Failed to verify migration:', error);
      this.updateProgress('verification', 'Verification failed', 0, [error instanceof Error ? error.message : 'Unknown error']);
      return false;
    }
  }

  /**
   * Clean up legacy databases after successful migration
   */
  async cleanupLegacyDatabases(databaseNames: string[]): Promise<void> {
    this.updateProgress('cleanup', 'Cleaning up legacy databases...', 0);
    
    let cleaned = 0;
    
    for (const dbName of databaseNames) {
      try {
        await new Promise<void>((resolve, reject) => {
          const deleteRequest = indexedDB.deleteDatabase(dbName);
          deleteRequest.onsuccess = () => resolve();
          deleteRequest.onerror = () => reject(deleteRequest.error);
          deleteRequest.onblocked = () => {
            console.warn(`Database ${dbName} is blocked from deletion`);
            resolve(); // Continue with other databases
          };
        });
        
        cleaned++;
        this.updateProgress('cleanup', `Cleaned up ${dbName}`, (cleaned / databaseNames.length) * 100);
      } catch (error) {
        console.warn(`Failed to cleanup database ${dbName}:`, error);
        this.updateProgress('cleanup', `Failed to cleanup ${dbName}`, 0, [error instanceof Error ? error.message : 'Unknown error']);
      }
    }
    
    this.updateProgress('cleanup', `Cleanup completed (${cleaned}/${databaseNames.length} databases)`, 100);
  }

  /**
   * Complete migration process
   */
  async performMigration(databases: LegacyDatabaseInfo[]): Promise<RecoveryResult> {
    const startTime = Date.now();
    const result: RecoveryResult = {
      success: false,
      migratedData: { users: 0, feeds: 0, articles: 0, folders: 0 },
      errors: [],
      duration: 0
    };
    
    try {
      // Extract data from all legacy databases
      const allData: LegacyData = { users: [], feeds: [], articles: [], folders: [] };
      
      for (const dbInfo of databases) {
        try {
          const legacyData = await this.extractFromLegacyDatabase(dbInfo.name);
          
          // Merge data (avoiding duplicates)
          allData.users.push(...legacyData.users);
          allData.feeds.push(...legacyData.feeds);
          allData.articles.push(...legacyData.articles);
          allData.folders.push(...legacyData.folders);
        } catch (error) {
          result.errors.push(`Failed to extract from ${dbInfo.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
      
      // Remove duplicates
      allData.users = this.removeDuplicates(allData.users, 'id');
      allData.feeds = this.removeDuplicates(allData.feeds, 'inoreader_id');
      allData.articles = this.removeDuplicates(allData.articles, 'inoreader_id');
      allData.folders = this.removeDuplicates(allData.folders, 'inoreader_id');
      
      // Upload to Supabase
      await this.uploadToSupabase(allData);
      
      // Verify migration
      const verified = await this.verifyMigration(allData);
      
      if (verified) {
        result.success = true;
        result.migratedData = {
          users: allData.users.length,
          feeds: allData.feeds.length,
          articles: allData.articles.length,
          folders: allData.folders.length
        };
      } else {
        result.errors.push('Migration verification failed');
      }
      
    } catch (error) {
      result.errors.push(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    result.duration = Date.now() - startTime;
    return result;
  }

  /**
   * Remove duplicates from array based on a key
   */
  private removeDuplicates<T>(array: T[], key: keyof T): T[] {
    const seen = new Set();
    return array.filter(item => {
      const value = item[key];
      if (seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    });
  }

  /**
   * Update progress callback
   */
  private updateProgress(
    phase: RecoveryProgress['phase'], 
    step: string, 
    progress: number, 
    errors: string[] = []
  ): void {
    if (this.progressCallback) {
      this.progressCallback({
        phase,
        currentStep: step,
        progress,
        totalRecords: 0, // Will be updated as we discover data
        processedRecords: 0,
        errors
      });
    }
  }
}

/**
 * Utility function to create a recovery system instance
 */
export function createRecoverySystem(progressCallback?: (progress: RecoveryProgress) => void): LegacyRecoverySystem {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  
  return new LegacyRecoverySystem(supabaseUrl, supabaseKey, progressCallback);
}