import { supabase } from "./supabase";
import { UserInsert, FeedInsert, ArticleInsert, FolderInsert } from "./types";

// Basic CRUD operations for testing
export class SupabaseOperations {
  // User operations
  static async createUser(user: UserInsert) {
    const { data, error } = await supabase
      .from("users")
      .insert(user)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getUserByInoreaderID(inoreaderID: string) {
    const { data, error } = await supabase
      .from("users")
      .select("*")
      .eq("inoreader_id", inoreaderID)
      .single();

    if (error) throw error;
    return data;
  }

  // Feed operations
  static async createFeed(feed: FeedInsert) {
    const { data, error } = await supabase
      .from("feeds")
      .insert(feed)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getFeedsByUser(userId: string) {
    const { data, error } = await supabase
      .from("feeds")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  // Article operations
  static async createArticle(article: ArticleInsert) {
    const { data, error } = await supabase
      .from("articles")
      .insert(article)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getArticlesByFeed(feedId: string) {
    const { data, error } = await supabase
      .from("articles")
      .select("*")
      .eq("feed_id", feedId)
      .order("published_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  static async updateArticleReadStatus(articleId: string, isRead: boolean) {
    const { data, error } = await supabase
      .from("articles")
      .update({ is_read: isRead, updated_at: new Date().toISOString() })
      .eq("id", articleId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  // Folder operations
  static async createFolder(folder: FolderInsert) {
    const { data, error } = await supabase
      .from("folders")
      .insert(folder)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async getFoldersByUser(userId: string) {
    const { data, error } = await supabase
      .from("folders")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
  }

  // Test connection
  static async testConnection(): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from("users")
        .select("id")
        .limit(1);

      if (error) {
        console.error("Connection test failed:", error);
        return false;
      }

      // Connection successful
      return true;
    } catch (error) {
      console.error("Connection test error:", error);
      return false;
    }
  }
}

// Export individual functions for convenience
export const {
  createUser,
  getUserByInoreaderID,
  createFeed,
  getFeedsByUser,
  createArticle,
  getArticlesByFeed,
  updateArticleReadStatus,
  createFolder,
  getFoldersByUser,
  testConnection,
} = SupabaseOperations;
