/**
 * NavigationHistory - Tracks article navigation history with circular buffer
 * Part of RR-27: Fix Article List State Preservation on Back Navigation
 */

export interface NavigationEntry {
  articleId: string;
  timestamp: string;
  fromListPosition?: number;
}

export class NavigationHistory {
  private static instance: NavigationHistory;
  private readonly HISTORY_KEY = "rss_reader_nav_history";
  private readonly MAX_ENTRIES = 20;
  private readonly EXPIRY_MINUTES = 30;
  private entries: NavigationEntry[] = [];

  private constructor() {
    this.loadFromStorage();
  }

  static getInstance(): NavigationHistory {
    if (!NavigationHistory.instance) {
      NavigationHistory.instance = new NavigationHistory();
    }
    return NavigationHistory.instance;
  }

  addEntry(articleId: string, fromListPosition?: number): void {
    const entry: NavigationEntry = {
      articleId,
      timestamp: new Date().toISOString(),
      fromListPosition,
    };

    // Remove any existing entry for the same article
    this.entries = this.entries.filter((e) => e.articleId !== articleId);

    // Add new entry at the beginning
    this.entries.unshift(entry);

    // Maintain circular buffer size
    if (this.entries.length > this.MAX_ENTRIES) {
      this.entries = this.entries.slice(0, this.MAX_ENTRIES);
    }

    this.saveToStorage();
  }

  getLastEntry(): NavigationEntry | null {
    this.cleanExpiredEntries();
    return this.entries[0] || null;
  }

  getPreviousArticleId(currentArticleId: string): string | null {
    const currentIndex = this.entries.findIndex(
      (e) => e.articleId === currentArticleId
    );
    if (currentIndex === -1 || currentIndex === this.entries.length - 1) {
      return null;
    }
    return this.entries[currentIndex + 1]?.articleId || null;
  }

  getNextArticleId(currentArticleId: string): string | null {
    const currentIndex = this.entries.findIndex(
      (e) => e.articleId === currentArticleId
    );
    if (currentIndex <= 0) {
      return null;
    }
    return this.entries[currentIndex - 1]?.articleId || null;
  }

  getNavigationPath(): string[] {
    this.cleanExpiredEntries();
    return this.entries.map((e) => e.articleId);
  }

  clear(): void {
    this.entries = [];
    this.saveToStorage();
  }

  private cleanExpiredEntries(): void {
    const expiryTime = new Date(Date.now() - this.EXPIRY_MINUTES * 60 * 1000);
    this.entries = this.entries.filter(
      (entry) => new Date(entry.timestamp) > expiryTime
    );
  }

  private loadFromStorage(): void {
    try {
      // Check if we're in a browser environment
      if (
        typeof window !== "undefined" &&
        typeof sessionStorage !== "undefined"
      ) {
        const saved = sessionStorage.getItem(this.HISTORY_KEY);
        if (saved) {
          this.entries = JSON.parse(saved);
          this.cleanExpiredEntries();
        }
      }
    } catch (error) {
      console.error("Failed to load navigation history:", error);
      this.entries = [];
    }
  }

  private saveToStorage(): void {
    try {
      // Check if we're in a browser environment
      if (
        typeof window !== "undefined" &&
        typeof sessionStorage !== "undefined"
      ) {
        sessionStorage.setItem(this.HISTORY_KEY, JSON.stringify(this.entries));
      }
    } catch (error) {
      console.error("Failed to save navigation history:", error);
    }
  }

  getEntryCount(): number {
    this.cleanExpiredEntries();
    return this.entries.length;
  }

  hasEntry(articleId: string): boolean {
    return this.entries.some((e) => e.articleId === articleId);
  }
}

// Export singleton instance
export const navigationHistory = NavigationHistory.getInstance();
