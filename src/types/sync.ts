// Sync operation types

export interface SyncResult {
  status: 'completed' | 'partial' | 'failed';
  metrics: SyncMetrics;
  sidebar?: SidebarData;
  retryAfter?: number; // For rate limiting
}

export interface SyncMetrics {
  newArticles: number;
  deletedArticles: number;
  newTags: number;
  failedFeeds: number;
}

export interface SidebarData {
  feedCounts: Array<[string, number]>;
  tags: Array<{ id: string; name: string; count: number }>;
}