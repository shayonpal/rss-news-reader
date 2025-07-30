import { db, type StoredUserPreferences } from "../database";
import type { UserPreferences } from "@/types";

export class UserPreferencesRepository {
  async getPreferences(userId?: string): Promise<UserPreferences | null> {
    try {
      let preferences: StoredUserPreferences | undefined;

      if (userId) {
        preferences = await db.userPreferences
          .where("userId")
          .equals(userId)
          .first();
      } else {
        // Get the most recent preferences if no userId specified
        preferences = await db.userPreferences.orderBy("id").reverse().first();
      }

      if (!preferences) {
        return null;
      }

      // Convert stored format to UserPreferences format
      const {
        id,
        userId: storedUserId,
        version,
        updatedAt,
        ...userPrefs
      } = preferences;
      return userPrefs;
    } catch (error) {
      console.error("Failed to get user preferences:", error);
      return null;
    }
  }

  async updatePreferences(
    preferences: Partial<UserPreferences>,
    userId?: string
  ): Promise<boolean> {
    try {
      const existing = await (userId
        ? db.userPreferences.where("userId").equals(userId).first()
        : db.userPreferences.orderBy("id").reverse().first());

      if (existing) {
        // Update existing preferences
        await db.userPreferences.update(existing.id!, {
          ...preferences,
          updatedAt: new Date(),
          version: existing.version + 1,
        });
      } else {
        // Create new preferences
        const newPreferences = {
          theme: "system" as const,
          syncFrequency: 6,
          maxArticles: 500,
          autoFetchFullContent: false,
          enableNotifications: false,
          fontSize: "medium" as const,
          readingWidth: "medium" as const,
          ...preferences,
          userId,
          version: 1,
          updatedAt: new Date(),
        };

        await db.userPreferences.add(newPreferences);
      }

      return true;
    } catch (error) {
      console.error("Failed to update user preferences:", error);
      return false;
    }
  }

  async resetToDefaults(userId?: string): Promise<UserPreferences> {
    try {
      const defaultPreferences: UserPreferences = {
        theme: "system",
        syncFrequency: 6,
        maxArticles: 500,
        autoFetchFullContent: false,
        enableNotifications: false,
        fontSize: "medium",
        readingWidth: "medium",
      };

      await this.updatePreferences(defaultPreferences, userId);
      return defaultPreferences;
    } catch (error) {
      console.error("Failed to reset preferences to defaults:", error);
      throw error;
    }
  }

  async deletePreferences(userId?: string): Promise<boolean> {
    try {
      if (userId) {
        const deleted = await db.userPreferences
          .where("userId")
          .equals(userId)
          .delete();
        return deleted > 0;
      } else {
        // Delete all preferences if no userId specified
        await db.userPreferences.clear();
        return true;
      }
    } catch (error) {
      console.error("Failed to delete preferences:", error);
      return false;
    }
  }

  async getPreferencesHistory(
    userId?: string,
    limit: number = 10
  ): Promise<
    Array<{
      preferences: UserPreferences;
      version: number;
      updatedAt: Date;
    }>
  > {
    try {
      let query = db.userPreferences.orderBy("updatedAt").reverse();

      if (userId) {
        query = query.and((pref) => pref.userId === userId);
      }

      const history = await query.limit(limit).toArray();

      return history.map((stored) => {
        const {
          id,
          userId: storedUserId,
          version,
          updatedAt,
          ...preferences
        } = stored;
        return {
          preferences,
          version,
          updatedAt,
        };
      });
    } catch (error) {
      console.error("Failed to get preferences history:", error);
      return [];
    }
  }

  // Validate preferences against schema
  private validatePreferences(preferences: Partial<UserPreferences>): boolean {
    const validThemes = ["light", "dark", "system"];
    const validFontSizes = ["small", "medium", "large"];
    const validWidths = ["narrow", "medium", "wide"];

    if (preferences.theme && !validThemes.includes(preferences.theme)) {
      return false;
    }

    if (
      preferences.fontSize &&
      !validFontSizes.includes(preferences.fontSize)
    ) {
      return false;
    }

    if (
      preferences.readingWidth &&
      !validWidths.includes(preferences.readingWidth)
    ) {
      return false;
    }

    if (
      preferences.syncFrequency !== undefined &&
      (preferences.syncFrequency < 1 || preferences.syncFrequency > 24)
    ) {
      return false;
    }

    if (
      preferences.maxArticles !== undefined &&
      (preferences.maxArticles < 100 || preferences.maxArticles > 2000)
    ) {
      return false;
    }

    return true;
  }

  async updatePreferencesWithValidation(
    preferences: Partial<UserPreferences>,
    userId?: string
  ): Promise<{ success: boolean; error?: string }> {
    if (!this.validatePreferences(preferences)) {
      return { success: false, error: "Invalid preferences values" };
    }

    const success = await this.updatePreferences(preferences, userId);
    return { success };
  }
}

// Global repository instance
export const userPreferencesRepository = new UserPreferencesRepository();
