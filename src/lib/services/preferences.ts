import { createClient } from "@/lib/supabase/server";
import type { UserPreferencesDB } from "@/types/preferences";

export interface UserPreferences {
  sync?: {
    maxArticles: number;
    retentionCount: number;
  };
  ai?: {
    enabled: boolean;
    provider?: string;
    summaryMinLength?: number;
    summaryMaxLength?: number;
  };
}

export async function getUserPreferences(): Promise<UserPreferences | null> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return null;
    }

    // Get user preferences from database
    const { data, error } = await supabase
      .from("user_preferences")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        // No preferences found, return defaults
        return {
          sync: {
            maxArticles: 100,
            retentionCount: 2000,
          },
          ai: {
            enabled: false,
          },
        };
      }
      console.error("Failed to get user preferences:", error);
      return null;
    }

    // Parse and return preferences
    return {
      sync: {
        maxArticles: data?.sync_max_articles || 100,
        retentionCount: data?.sync_retention_count || 2000,
      },
      ai: {
        enabled: data?.ai_enabled || false,
        provider: data?.ai_provider,
        summaryMinLength: data?.ai_summary_min_length,
        summaryMaxLength: data?.ai_summary_max_length,
      },
    };
  } catch (error) {
    console.error("Error getting user preferences:", error);
    return null;
  }
}

export async function updateUserPreferences(
  preferences: Partial<UserPreferences>
): Promise<boolean> {
  try {
    const supabase = await createClient();

    // Get current user
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error("Failed to get user:", userError);
      return false;
    }

    // Prepare data for database
    const dbData: Partial<UserPreferencesDB> = {
      user_id: user.id,
      updated_at: new Date().toISOString(),
    };

    if (preferences.sync) {
      dbData.sync_max_articles = preferences.sync.maxArticles;
      dbData.sync_retention_count = preferences.sync.retentionCount;
    }

    if (preferences.ai) {
      dbData.ai_enabled = preferences.ai.enabled;
      dbData.ai_provider = preferences.ai.provider;
      dbData.ai_summary_min_length = preferences.ai.summaryMinLength;
      dbData.ai_summary_max_length = preferences.ai.summaryMaxLength;
    }

    // Upsert preferences
    const { error } = await supabase.from("user_preferences").upsert(dbData, {
      onConflict: "user_id",
    });

    if (error) {
      console.error("Failed to update user preferences:", error);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Error updating user preferences:", error);
    return false;
  }
}
