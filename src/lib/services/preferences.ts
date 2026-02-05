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

    // Get user preferences from users.preferences JSONB column
    const { data, error } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", user.id)
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

    // Parse preferences from JSONB column
    const prefs = data?.preferences as any;
    if (!prefs) {
      // Return defaults if preferences JSONB is null/empty
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

    // Parse and return preferences from JSONB structure
    return {
      sync: {
        maxArticles: prefs?.sync?.maxArticles || 100,
        retentionCount: prefs?.sync?.retentionCount || 2000,
      },
      ai: {
        enabled: prefs?.ai?.hasApiKey || false,
        provider: prefs?.ai?.model,
        summaryMinLength: prefs?.ai?.summaryLengthMin,
        summaryMaxLength: prefs?.ai?.summaryLengthMax,
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

    // Get current preferences JSONB
    const { data: currentData, error: fetchError } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", user.id)
      .single();

    if (fetchError) {
      console.error("Failed to fetch current preferences:", fetchError);
      return false;
    }

    // Merge new preferences with existing ones
    const currentPrefs = (currentData?.preferences as any) || {};
    const updatedPrefs = { ...currentPrefs };

    if (preferences.sync) {
      updatedPrefs.sync = {
        ...updatedPrefs.sync,
        maxArticles: preferences.sync.maxArticles,
        retentionCount: preferences.sync.retentionCount,
      };
    }

    if (preferences.ai) {
      updatedPrefs.ai = {
        ...updatedPrefs.ai,
        hasApiKey: preferences.ai.enabled,
        model: preferences.ai.provider,
        summaryLengthMin: preferences.ai.summaryMinLength,
        summaryLengthMax: preferences.ai.summaryMaxLength,
      };
    }

    // Update preferences JSONB column
    const { error } = await supabase
      .from("users")
      .update({ preferences: updatedPrefs })
      .eq("id", user.id);

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
