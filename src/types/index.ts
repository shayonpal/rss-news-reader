// Core data types for the RSS reader

export interface Article {
  id: string;
  title: string;
  content: string;
  summary?: string;
  author?: string;
  authorName?: string; // Alternative to author for compatibility
  publishedAt: Date;
  feedId: string;
  feedTitle?: string;
  url: string;
  isRead: boolean;
  isPartial?: boolean;
  images?: string[];
  tags?: string[];
  inoreaderItemId?: string; // Inoreader's item ID for sync
  createdAt: Date;
  updatedAt: Date;
  state?: ArticleState;
  fullContentUrl?: string;
  hasFullContent?: boolean;
  fullContent?: string;
  parsedAt?: Date;
  parseFailed?: boolean;
  parseAttempts?: number;
  contentLength?: number;
}

export interface Feed {
  id: string;
  title: string;
  customTitle?: string; // User's custom title
  url: string;
  htmlUrl?: string;
  description?: string;
  iconUrl?: string;
  folderId?: string | null;
  unreadCount: number;
  isActive: boolean;
  isPartialContent?: boolean; // Whether feed typically has partial content
  isPartialFeed?: boolean; // Flag for feeds with incomplete content requiring on-demand parsing
  lastFetchedAt?: Date;
  inoreaderId?: string; // Inoreader's feed ID
  createdAt: Date;
  updatedAt: Date;
}

export interface Folder {
  id: string;
  title: string;
  parentId?: string | null;
  unreadCount: number;
  isExpanded: boolean;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface Summary {
  id: string;
  articleId: string;
  content: string;
  wordCount: number;
  generatedAt: Date;
  model: string;
  isRegenerated: boolean;
}

export interface SyncState {
  lastSyncAt?: Date;
  isOnline: boolean;
  isSyncing: boolean;
  syncProgress?: number;
  pendingActions: PendingAction[];
  syncError?: string;
}

export interface PendingAction {
  id: string;
  type: "mark_read" | "mark_unread" | "star" | "unstar";
  articleId: string;
  timestamp: Date;
}

export interface ApiUsage {
  inoreaderCalls: number;
  claudeCalls: number;
  date: string;
  estimatedCost: number;
}

export interface UserPreferences {
  theme: "light" | "dark" | "system";
  syncFrequency: number; // hours
  maxArticles: number;
  autoFetchFullContent: boolean;
  enableNotifications: boolean;
  fontSize: "small" | "medium" | "large";
  readingWidth: "narrow" | "medium" | "wide";
}

// API response types
export interface InoreaderSubscription {
  id: string;
  title: string;
  categories: InoreaderCategory[];
  sortid: string;
  firstitemmsec: number;
  htmlUrl: string;
  iconUrl?: string;
}

export interface InoreaderCategory {
  id: string;
  label: string;
}

export interface InoreaderStreamContents {
  direction: string;
  id: string;
  title: string;
  description: string;
  self: InoreaderLink[];
  updated: number;
  items: InoreaderItem[];
  continuation?: string;
}

export interface InoreaderItem {
  id: string;
  title: string;
  author?: string;
  published: number;
  updated: number;
  canonical: InoreaderLink[];
  summary: InoreaderContent;
  content?: InoreaderContent;
  origin: InoreaderOrigin;
  categories?: string[];
}

export interface InoreaderLink {
  href: string;
  type?: string;
}

export interface InoreaderContent {
  direction: string;
  content: string;
}

export interface InoreaderOrigin {
  streamId: string;
  title: string;
  htmlUrl?: string;
}

// State management types
export interface AppState {
  articles: ArticleState;
  feeds: FeedState;
  sync: SyncState;
  settings: SettingsState;
  api: ApiState;
}

export interface ArticleState {
  articles: Article[];
  selectedArticle?: Article;
  isLoading: boolean;
  error?: string;
  filter: ArticleFilter;
}

export interface FeedState {
  feeds: Feed[];
  folders: Folder[];
  selectedFeed?: Feed;
  isLoading: boolean;
  error?: string;
}

// Extended feed type with unread count
export interface FeedWithUnreadCount extends Feed {
  unreadCount: number;
}

export interface SettingsState {
  preferences: UserPreferences;
  isAuthenticated: boolean;
  inoreaderAccount?: {
    userId: string;
    userEmail: string;
  };
}

export interface ApiState {
  usage: ApiUsage[];
  isTracking: boolean;
  dailyLimits: {
    inoreader: number;
    claude: number;
  };
}

export interface ArticleFilter {
  feedId?: string;
  folderId?: string;
  showRead: boolean;
  searchTerm?: string;
}
