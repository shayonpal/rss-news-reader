import { promises as fs } from "fs";
import * as path from "path";

/**
 * RR-30: Sync Conflict Detection Module
 *
 * Detects and logs conflicts when local changes differ from remote state.
 * Due to Inoreader API limitations (no timestamps for read/starred changes),
 * we can only detect IF states differ, not WHEN they changed.
 */

export interface ConflictLogEntry {
  timestamp: string;
  syncSessionId: string;
  articleId: string;
  feedId?: string;
  inoreader_id: string;
  conflictType: "read_status" | "starred_status" | "both";
  localValue: {
    read: boolean;
    starred: boolean;
  };
  remoteValue: {
    read: boolean;
    starred: boolean;
  };
  resolution: "local" | "remote";
  lastLocalUpdate: string | null;
  lastSyncUpdate: string | null;
  note: string;
}

export interface ConflictSummary {
  totalConflicts: number;
  readConflicts: number;
  starredConflicts: number;
  bothConflicts: number;
  resolutions: {
    local: number;
    remote: number;
  };
}

export class SyncConflictDetector {
  private syncSessionId: string;
  private conflicts: ConflictLogEntry[] = [];
  private summary: ConflictSummary = {
    totalConflicts: 0,
    readConflicts: 0,
    starredConflicts: 0,
    bothConflicts: 0,
    resolutions: {
      local: 0,
      remote: 0,
    },
  };
  private logPath: string;

  constructor(syncSessionId?: string) {
    this.syncSessionId = syncSessionId || `sync_${new Date().toISOString()}`;
    this.logPath = path.join(process.cwd(), "logs", "sync-conflicts.jsonl");
  }

  /**
   * Check if local changes exist (modified after last sync)
   */
  private hasLocalChanges(article: any): boolean {
    if (!article.last_local_update || !article.last_sync_update) {
      return false;
    }
    return (
      new Date(article.last_local_update) > new Date(article.last_sync_update)
    );
  }

  /**
   * Check if states differ between local and remote
   */
  private statesDiffer(local: any, remote: any): boolean {
    return (
      local.is_read !== remote.is_read || local.is_starred !== remote.is_starred
    );
  }

  /**
   * Determine the type of conflict
   */
  private getConflictType(
    local: any,
    remote: any
  ): "read_status" | "starred_status" | "both" {
    const readDiffers = local.is_read !== remote.is_read;
    const starredDiffers = local.is_starred !== remote.is_starred;

    if (readDiffers && starredDiffers) return "both";
    if (readDiffers) return "read_status";
    return "starred_status";
  }

  /**
   * Detect conflict for a single article
   */
  public detectConflict(
    localArticle: any,
    remoteArticle: any,
    resolution: "local" | "remote" = "remote"
  ): ConflictLogEntry | null {
    // Check if states differ
    if (!this.statesDiffer(localArticle, remoteArticle)) {
      return null;
    }

    // For conflicts, we need either:
    // 1. Local changes exist (local wins scenario)
    // 2. Local changes exist but are old (remote wins scenario)
    if (!localArticle.last_local_update) {
      return null;
    }

    const conflictType = this.getConflictType(localArticle, remoteArticle);

    const conflict: ConflictLogEntry = {
      timestamp: new Date().toISOString(),
      syncSessionId: this.syncSessionId,
      articleId: localArticle.id || localArticle.inoreader_id,
      feedId: localArticle.feed_id,
      inoreader_id: localArticle.inoreader_id,
      conflictType,
      localValue: {
        read: localArticle.is_read || false,
        starred: localArticle.is_starred || false,
      },
      remoteValue: {
        read: remoteArticle.is_read || false,
        starred: remoteArticle.is_starred || false,
      },
      resolution,
      lastLocalUpdate: localArticle.last_local_update || null,
      lastSyncUpdate: localArticle.last_sync_update || null,
      note:
        resolution === "remote"
          ? "Remote wins: local changes overwritten (API limitation: no remote timestamps)"
          : "Local wins: local changes preserved",
    };

    // Update summary statistics
    this.summary.totalConflicts++;
    switch (conflictType) {
      case "read_status":
        this.summary.readConflicts++;
        break;
      case "starred_status":
        this.summary.starredConflicts++;
        break;
      case "both":
        this.summary.bothConflicts++;
        break;
    }
    this.summary.resolutions[resolution]++;

    this.conflicts.push(conflict);
    return conflict;
  }

  /**
   * Process a batch of articles for conflicts
   */
  public processBatch(
    localArticles: Map<string, any>,
    remoteArticles: any[]
  ): ConflictLogEntry[] {
    const batchConflicts: ConflictLogEntry[] = [];

    for (const remoteArticle of remoteArticles) {
      const localArticle = localArticles.get(remoteArticle.inoreader_id);

      if (localArticle) {
        const conflict = this.detectConflict(localArticle, remoteArticle);
        if (conflict) {
          batchConflicts.push(conflict);
        }
      }
    }

    return batchConflicts;
  }

  /**
   * Write conflicts to JSONL log file
   */
  public async writeConflicts(): Promise<void> {
    if (this.conflicts.length === 0) {
      return;
    }

    try {
      // Ensure logs directory exists
      const logsDir = path.dirname(this.logPath);
      await fs.mkdir(logsDir, { recursive: true });

      // Append conflicts to JSONL file
      const logLines =
        this.conflicts.map((conflict) => JSON.stringify(conflict)).join("\n") +
        "\n";

      await fs.appendFile(this.logPath, logLines, "utf-8");

      console.log(`[Sync] Wrote ${this.conflicts.length} conflicts to log`);
    } catch (error) {
      console.error("[Sync] Failed to write conflict log:", error);
      // Don't throw - conflict logging is non-critical
    }
  }

  /**
   * Get conflict summary
   */
  public getSummary(): ConflictSummary {
    return { ...this.summary };
  }

  /**
   * Get all detected conflicts
   */
  public getConflicts(): ConflictLogEntry[] {
    return [...this.conflicts];
  }

  /**
   * Clear conflicts (useful for testing)
   */
  public clear(): void {
    this.conflicts = [];
    this.summary = {
      totalConflicts: 0,
      readConflicts: 0,
      starredConflicts: 0,
      bothConflicts: 0,
      resolutions: {
        local: 0,
        remote: 0,
      },
    };
  }

  /**
   * Generate a detailed sync report
   */
  public generateReport(): string {
    const report = [
      `=== Sync Conflict Report ===`,
      `Session ID: ${this.syncSessionId}`,
      `Timestamp: ${new Date().toISOString()}`,
      ``,
      `Total Conflicts: ${this.summary.totalConflicts}`,
      `  - Read Status: ${this.summary.readConflicts}`,
      `  - Starred Status: ${this.summary.starredConflicts}`,
      `  - Both: ${this.summary.bothConflicts}`,
      ``,
      `Resolutions:`,
      `  - Local Wins: ${this.summary.resolutions.local}`,
      `  - Remote Wins: ${this.summary.resolutions.remote}`,
      ``,
      `Note: Due to Inoreader API limitations, remote change timestamps`,
      `are not available. Conflicts are detected based on state comparison.`,
      `Remote always wins to maintain consistency with Inoreader.`,
    ];

    if (this.summary.totalConflicts > 10) {
      report.push("");
      report.push(
        "⚠️ High conflict rate detected. Consider more frequent syncs."
      );
    }

    return report.join("\n");
  }
}
