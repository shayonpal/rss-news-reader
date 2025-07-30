// Database Types for Supabase Integration
export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          inoreader_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          email: string;
          inoreader_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string;
          inoreader_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      feeds: {
        Row: {
          id: string;
          user_id: string;
          inoreader_id: string;
          title: string;
          url: string;
          folder_id: string | null;
          unread_count: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          inoreader_id: string;
          title: string;
          url: string;
          folder_id?: string | null;
          unread_count?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          inoreader_id?: string;
          title?: string;
          url?: string;
          folder_id?: string | null;
          unread_count?: number;
          created_at?: string;
          updated_at?: string;
        };
      };
      articles: {
        Row: {
          id: string;
          feed_id: string;
          inoreader_id: string;
          title: string;
          content: string | null;
          full_content: string | null;
          has_full_content: boolean;
          ai_summary: string | null;
          author: string | null;
          url: string | null;
          published_at: string | null;
          is_read: boolean;
          is_starred: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          feed_id: string;
          inoreader_id: string;
          title: string;
          content?: string | null;
          full_content?: string | null;
          has_full_content?: boolean;
          ai_summary?: string | null;
          author?: string | null;
          url?: string | null;
          published_at?: string | null;
          is_read?: boolean;
          is_starred?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          feed_id?: string;
          inoreader_id?: string;
          title?: string;
          content?: string | null;
          full_content?: string | null;
          has_full_content?: boolean;
          ai_summary?: string | null;
          author?: string | null;
          url?: string | null;
          published_at?: string | null;
          is_read?: boolean;
          is_starred?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      folders: {
        Row: {
          id: string;
          user_id: string;
          inoreader_id: string;
          name: string;
          parent_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          inoreader_id: string;
          name: string;
          parent_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          inoreader_id?: string;
          name?: string;
          parent_id?: string | null;
          created_at?: string;
        };
      };
      api_usage: {
        Row: {
          id: string;
          service: string;
          date: string;
          count: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          service: string;
          date: string;
          count?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          service?: string;
          date?: string;
          count?: number;
          created_at?: string;
        };
      };
      sync_metadata: {
        Row: {
          key: string;
          value: string;
          updated_at: string;
        };
        Insert: {
          key: string;
          value: string;
          updated_at?: string;
        };
        Update: {
          key?: string;
          value?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
}

// Type aliases for easier usage
export type User = Database["public"]["Tables"]["users"]["Row"];
export type UserInsert = Database["public"]["Tables"]["users"]["Insert"];
export type UserUpdate = Database["public"]["Tables"]["users"]["Update"];

export type Feed = Database["public"]["Tables"]["feeds"]["Row"];
export type FeedInsert = Database["public"]["Tables"]["feeds"]["Insert"];
export type FeedUpdate = Database["public"]["Tables"]["feeds"]["Update"];

export type Article = Database["public"]["Tables"]["articles"]["Row"];
export type ArticleInsert = Database["public"]["Tables"]["articles"]["Insert"];
export type ArticleUpdate = Database["public"]["Tables"]["articles"]["Update"];

export type Folder = Database["public"]["Tables"]["folders"]["Row"];
export type FolderInsert = Database["public"]["Tables"]["folders"]["Insert"];
export type FolderUpdate = Database["public"]["Tables"]["folders"]["Update"];

// Legacy data types for migration
export interface LegacyUser {
  id: string;
  email: string;
  inoreader_id?: string;
  preferences?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface LegacyFeed {
  id: string;
  user_id: string;
  inoreader_id: string;
  title: string;
  url: string;
  folder_id?: string;
  unread_count: number;
  icon_url?: string;
  created_at: string;
  updated_at: string;
}

export interface LegacyArticle {
  id: string;
  feed_id: string;
  inoreader_id: string;
  title: string;
  content?: string;
  url?: string;
  published_at?: string;
  is_read: boolean;
  is_starred: boolean;
  author?: string;
  summary?: string;
  created_at: string;
  updated_at: string;
}

export interface LegacyFolder {
  id: string;
  user_id: string;
  inoreader_id: string;
  name: string;
  parent_id?: string;
  created_at: string;
}

// Migration data structure
export interface LegacyData {
  users: LegacyUser[];
  feeds: LegacyFeed[];
  articles: LegacyArticle[];
  folders: LegacyFolder[];
}

// Sync-related types
export interface SyncOperation {
  id: string;
  type: "create" | "update" | "delete";
  table: "users" | "feeds" | "articles" | "folders";
  data: any;
  timestamp: string;
  retries: number;
  error?: string;
}

export interface SyncStatus {
  isOnline: boolean;
  lastSync: string | null;
  pendingOperations: number;
  syncInProgress: boolean;
  error?: string;
}

export interface Conflict {
  id: string;
  table: string;
  local: any;
  remote: any;
  timestamp: string;
  resolved: boolean;
}

export interface ReadStateUpdate {
  article_id: string;
  is_read: boolean;
  timestamp: string;
}

export interface FeedConflict extends Conflict {
  table: "feeds";
  local: Feed;
  remote: Feed;
}
