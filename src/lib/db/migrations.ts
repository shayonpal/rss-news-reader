import { db } from "./database";
import type { UserPreferences } from "@/types";

export interface MigrationResult {
  success: boolean;
  fromVersion: number;
  toVersion: number;
  migratedRecords?: number;
  error?: string;
}

export class DatabaseMigrations {
  // Setup migrations for future versions
  static setupMigrations(): void {
    // Version 2: Example migration (add new fields)
    db.version(2)
      .stores({
        articles:
          "id, feedId, publishedAt, isRead, [feedId+isRead], [feedId+publishedAt], createdAt, updatedAt, extractedAt",
        feeds:
          "id, folderId, title, isActive, lastFetchedAt, createdAt, updatedAt, errorCount",
        folders: "id, parentId, title, sortOrder, createdAt, updatedAt",
        summaries: "id, articleId, generatedAt, model, version",
        pendingActions: "id, type, articleId, timestamp, syncAttempts",
        apiUsage: "++id, date, inoreaderCalls, claudeCalls, totalCost",
        userPreferences: "++id, userId, version, updatedAt",
        dbInfo: "++id, version, createdAt, lastMigrationAt",
      })
      .upgrade(async (trans) => {
        console.log("Migrating database to version 2...");

        let migratedCount = 0;

        // Add extractedAt field to existing articles
        await trans
          .table("articles")
          .toCollection()
          .modify((article) => {
            if (!article.extractedAt && article.createdAt) {
              article.extractedAt = article.createdAt;
              migratedCount++;
            }
          });

        // Add errorCount to feeds
        await trans
          .table("feeds")
          .toCollection()
          .modify((feed) => {
            if (feed.errorCount === undefined) {
              feed.errorCount = 0;
              migratedCount++;
            }
          });

        // Add version to summaries
        await trans
          .table("summaries")
          .toCollection()
          .modify((summary) => {
            if (!summary.version) {
              summary.version = 1;
              migratedCount++;
            }
          });

        // Add totalCost to API usage
        await trans
          .table("apiUsage")
          .toCollection()
          .modify((usage) => {
            if (usage.totalCost === undefined) {
              usage.totalCost = 0;
              migratedCount++;
            }
          });

        // Update database info
        await trans
          .table("dbInfo")
          .toCollection()
          .modify((info) => {
            info.lastMigrationAt = new Date();
          });

        console.log(
          `Migration to v2 completed. Updated ${migratedCount} records.`
        );
      });

    // Version 3: Example for future use
    db.version(3)
      .stores({
        // Add new table or modify existing ones
        articles:
          "id, feedId, publishedAt, isRead, [feedId+isRead], [feedId+publishedAt], createdAt, updatedAt, extractedAt, readingTime",
        // Add new tables
        tags: "id, name, color, createdAt",
        articleTags: "[articleId+tagId], articleId, tagId",
      })
      .upgrade(async (trans) => {
        console.log("Migrating database to version 3...");

        // Calculate reading time for existing articles
        await trans
          .table("articles")
          .toCollection()
          .modify((article) => {
            if (!article.readingTime && article.content) {
              // Rough calculation: 200 words per minute
              const wordCount = article.content.split(/\s+/).length;
              article.readingTime = Math.max(1, Math.round(wordCount / 200));
            }
          });

        console.log("Migration to v3 completed.");
      });
  }

  // Handle migration errors and corrupted data
  static async handleCorruptedDatabase(): Promise<boolean> {
    try {
      console.warn("Attempting to recover from database corruption...");

      // Record the corruption incident
      await db.recordCorruption();

      // Try to export what we can
      const recoveredData = await this.exportRecoverableData();

      // Close and delete the corrupted database
      await db.close();
      await db.delete();

      // Reopen with fresh schema
      await db.open();

      // Restore what we could recover
      if (recoveredData) {
        await this.importRecoveredData(recoveredData);
        console.log("Successfully recovered from database corruption");
        return true;
      }

      console.log("Database recreated but no data could be recovered");
      return true;
    } catch (error) {
      console.error("Failed to recover from database corruption:", error);
      return false;
    }
  }

  private static async exportRecoverableData(): Promise<any> {
    try {
      // Try to export tables that are still accessible
      const recovered: any = {};

      try {
        recovered.userPreferences = await db.userPreferences.toArray();
      } catch (e) {
        console.warn("Could not recover user preferences");
      }

      try {
        recovered.feeds = await db.feeds.toArray();
      } catch (e) {
        console.warn("Could not recover feeds");
      }

      try {
        // Only try to recover recent articles
        const recentCutoff = new Date();
        recentCutoff.setDate(recentCutoff.getDate() - 7);
        recovered.articles = await db.articles
          .where("publishedAt")
          .above(recentCutoff)
          .toArray();
      } catch (e) {
        console.warn("Could not recover articles");
      }

      return Object.keys(recovered).length > 0 ? recovered : null;
    } catch (error) {
      console.error("Failed to export recoverable data:", error);
      return null;
    }
  }

  private static async importRecoveredData(data: any): Promise<void> {
    try {
      // Import user preferences
      if (data.userPreferences?.length > 0) {
        await db.userPreferences.bulkAdd(data.userPreferences);
      }

      // Import feeds
      if (data.feeds?.length > 0) {
        await db.feeds.bulkAdd(data.feeds);
      }

      // Import articles
      if (data.articles?.length > 0) {
        await db.articles.bulkAdd(data.articles);
      }

      console.log("Recovered data imported successfully");
    } catch (error) {
      console.error("Failed to import recovered data:", error);
    }
  }

  // Validate database integrity
  static async validateDatabaseIntegrity(): Promise<{
    isValid: boolean;
    issues: string[];
    fixedIssues: string[];
  }> {
    const issues: string[] = [];
    const fixedIssues: string[] = [];

    try {
      // Check for orphaned summaries
      const articles = await db.articles.toArray();
      const articleIds = new Set(articles.map((a) => a.id));
      const orphanedSummaries = await db.summaries
        .where("articleId")
        .noneOf(Array.from(articleIds))
        .count();

      if (orphanedSummaries > 0) {
        issues.push(`Found ${orphanedSummaries} orphaned summaries`);
        await db.summaries
          .where("articleId")
          .noneOf(Array.from(articleIds))
          .delete();
        fixedIssues.push(`Cleaned up ${orphanedSummaries} orphaned summaries`);
      }

      // Check for articles without valid feeds
      const feeds = await db.feeds.toArray();
      const feedIds = new Set(feeds.map((f) => f.id));
      const orphanedArticles = await db.articles
        .where("feedId")
        .noneOf(Array.from(feedIds))
        .count();

      if (orphanedArticles > 0) {
        issues.push(`Found ${orphanedArticles} articles with invalid feeds`);
        await db.articles.where("feedId").noneOf(Array.from(feedIds)).delete();
        fixedIssues.push(
          `Cleaned up ${orphanedArticles} articles with invalid feeds`
        );
      }

      // Check for invalid dates
      const invalidDateArticles = await db.articles
        .filter(
          (article) =>
            !(article.publishedAt instanceof Date) ||
            isNaN(article.publishedAt.getTime())
        )
        .count();

      if (invalidDateArticles > 0) {
        issues.push(`Found ${invalidDateArticles} articles with invalid dates`);
        await db.articles
          .filter(
            (article) =>
              !(article.publishedAt instanceof Date) ||
              isNaN(article.publishedAt.getTime())
          )
          .modify((article) => {
            article.publishedAt = article.createdAt || new Date();
          });
        fixedIssues.push(
          `Fixed ${invalidDateArticles} articles with invalid dates`
        );
      }

      return {
        isValid: issues.length === 0,
        issues,
        fixedIssues,
      };
    } catch (error) {
      console.error("Database validation failed:", error);
      return {
        isValid: false,
        issues: [`Validation failed: ${error}`],
        fixedIssues,
      };
    }
  }

  // Initialize default user preferences
  static async initializeDefaultPreferences(): Promise<void> {
    try {
      const existingPrefs = await db.userPreferences.count();

      if (existingPrefs === 0) {
        const defaultPreferences = {
          theme: "system" as const,
          syncFrequency: 6,
          maxArticles: 500,
          autoFetchFullContent: false,
          enableNotifications: false,
          fontSize: "medium" as const,
          readingWidth: "medium" as const,
          version: 1,
          updatedAt: new Date(),
        };

        await db.userPreferences.add(defaultPreferences);
        console.log("Initialized default user preferences");
      }
    } catch (error) {
      console.error("Failed to initialize default preferences:", error);
    }
  }
}

// Setup migrations when module loads (except in test environment)
if (typeof process !== "undefined" && process.env.NODE_ENV !== "test") {
  DatabaseMigrations.setupMigrations();
}
