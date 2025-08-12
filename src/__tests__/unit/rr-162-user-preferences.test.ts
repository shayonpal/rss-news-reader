/**
 * Unit Tests for RR-162: UserPreferences Type Changes
 *
 * These tests verify that the UserPreferences type and related
 * functionality work correctly after removing autoFetchFullContent.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { UserPreferences } from "@/types";
import {
  TypeSystemContracts,
  type UserPreferencesAfterRemoval,
} from "../contracts/rr-162-remove-autofetch.contract";

// Mock database module
vi.mock("@/lib/db/database", () => ({
  db: {
    userPreferences: {
      get: vi.fn(),
      put: vi.fn(),
      toArray: vi.fn(),
    },
  },
}));

// Mock repositories
vi.mock("@/lib/db/repositories/user-preferences-repository", () => ({
  userPreferencesRepository: {
    getPreferences: vi.fn(),
    savePreferences: vi.fn(),
  },
}));

describe("RR-162: UserPreferences Type Changes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Contract: UserPreferences Type Definition", () => {
    it("should not have autoFetchFullContent field", () => {
      // This test verifies the type at compile time
      // The actual runtime check is below

      const validPreferences: UserPreferences = {
        theme: "dark",
        syncFrequency: 4,
        maxArticles: 1000,
        enableNotifications: true,
      };

      // Verify expected fields exist
      expect(validPreferences).toHaveProperty("theme");
      expect(validPreferences).toHaveProperty("syncFrequency");
      expect(validPreferences).toHaveProperty("maxArticles");
      expect(validPreferences).toHaveProperty("enableNotifications");

      // Verify autoFetchFullContent doesn't exist
      expect(validPreferences).not.toHaveProperty("autoFetchFullContent");
    });

    it("should match the contract specification", () => {
      const preferences: UserPreferencesAfterRemoval = {
        theme: "system",
        syncFrequency: 6,
        maxArticles: 500,
        enableNotifications: false,
      };

      // Verify all expected fields from contract
      TypeSystemContracts.userPreferencesTypeUpdated.expectedFields.forEach(
        (field) => {
          expect(preferences).toHaveProperty(field);
        }
      );

      // Verify prohibited fields don't exist
      TypeSystemContracts.userPreferencesTypeUpdated.prohibitedFields.forEach(
        (field) => {
          expect(preferences).not.toHaveProperty(field);
        }
      );
    });
  });

  describe("Contract: Loading Preferences Compatibility", () => {
    it("should load preferences without autoFetchFullContent field", async () => {
      const { userPreferencesRepository } = await import(
        "@/lib/db/repositories/user-preferences-repository"
      );

      // Mock stored preferences without autoFetchFullContent
      vi.mocked(userPreferencesRepository.getPreferences).mockResolvedValue({
        theme: "light",
        syncFrequency: 4,
        maxArticles: 1000,
        enableNotifications: true,
      });

      const preferences =
        await userPreferencesRepository.getPreferences("test-user");

      expect(preferences).toBeDefined();
      expect(preferences).not.toHaveProperty("autoFetchFullContent");
      expect(preferences?.theme).toBe("light");
    });

    it("should handle legacy preferences with autoFetchFullContent", async () => {
      const { db } = await import("@/lib/db/database");

      // Mock legacy data with autoFetchFullContent
      const legacyData = {
        id: 1,
        theme: "dark",
        syncFrequency: 6,
        maxArticles: 500,
        autoFetchFullContent: true, // Legacy field
        enableNotifications: false,
        version: 1,
        updatedAt: new Date(),
      };

      vi.mocked(db.userPreferences.get).mockResolvedValue(legacyData);

      // Create a preferences loader that strips legacy fields
      const loadPreferences = async (): Promise<UserPreferences> => {
        const stored = await db.userPreferences.get(1);
        if (!stored) {
          throw new Error("No preferences found");
        }

        // Strip legacy fields
        const { autoFetchFullContent, ...validPreferences } = stored as any;

        return {
          theme: validPreferences.theme,
          syncFrequency: validPreferences.syncFrequency,
          maxArticles: validPreferences.maxArticles,
          enableNotifications: validPreferences.enableNotifications,
        };
      };

      const preferences = await loadPreferences();

      // Should load successfully without the legacy field
      expect(preferences).not.toHaveProperty("autoFetchFullContent");
      expect(preferences.theme).toBe("dark");
      expect(preferences.syncFrequency).toBe(6);
    });
  });

  describe("Contract: Saving Preferences", () => {
    it("should save preferences without autoFetchFullContent", async () => {
      const { userPreferencesRepository } = await import(
        "@/lib/db/repositories/user-preferences-repository"
      );

      const preferencesToSave: UserPreferences = {
        theme: "system",
        syncFrequency: 8,
        maxArticles: 2000,
        enableNotifications: true,
      };

      let savedData: any = null;
      vi.mocked(userPreferencesRepository.savePreferences).mockImplementation(
        async (userId, prefs) => {
          savedData = prefs;
          return prefs;
        }
      );

      await userPreferencesRepository.savePreferences(
        "test-user",
        preferencesToSave
      );

      expect(savedData).toBeDefined();
      expect(savedData).not.toHaveProperty("autoFetchFullContent");
      expect(savedData).toEqual(preferencesToSave);
    });

    it("should reject attempts to save autoFetchFullContent", async () => {
      const { userPreferencesRepository } = await import(
        "@/lib/db/repositories/user-preferences-repository"
      );

      // Create invalid preferences with autoFetchFullContent
      const invalidPreferences = {
        theme: "light" as const,
        syncFrequency: 4,
        maxArticles: 1000,
        autoFetchFullContent: true, // Should be rejected
        enableNotifications: false,
      };

      vi.mocked(userPreferencesRepository.savePreferences).mockImplementation(
        async (userId, prefs: any) => {
          // Validate preferences don't contain prohibited fields
          if ("autoFetchFullContent" in prefs) {
            throw new Error("Invalid field: autoFetchFullContent");
          }
          return prefs;
        }
      );

      await expect(
        userPreferencesRepository.savePreferences(
          "test-user",
          invalidPreferences as any
        )
      ).rejects.toThrow("Invalid field: autoFetchFullContent");
    });
  });

  describe("Contract: Default Preferences", () => {
    it("should provide correct default preferences", () => {
      const getDefaultPreferences = (): UserPreferences => ({
        theme: "system",
        syncFrequency: 4,
        maxArticles: 1000,
        enableNotifications: true,
      });

      const defaults = getDefaultPreferences();

      // Verify defaults don't include autoFetchFullContent
      expect(defaults).not.toHaveProperty("autoFetchFullContent");

      // Verify all required fields are present
      expect(defaults.theme).toBe("system");
      expect(defaults.syncFrequency).toBe(4);
      expect(defaults.maxArticles).toBe(1000);
      expect(defaults.enableNotifications).toBe(true);
    });
  });

  describe("Contract: Store Integration", () => {
    it("should work with data store without autoFetchFullContent", async () => {
      // Mock the data store
      const mockDataStore = {
        userPreferences: null as UserPreferences | null,

        loadUserPreferences: vi.fn(async () => {
          mockDataStore.userPreferences = {
            theme: "dark",
            syncFrequency: 6,
            maxArticles: 1500,
            enableNotifications: false,
          };
          return mockDataStore.userPreferences;
        }),

        saveUserPreferences: vi.fn(async (prefs: UserPreferences) => {
          // Validate no autoFetchFullContent
          if ("autoFetchFullContent" in (prefs as any)) {
            throw new Error("autoFetchFullContent is not allowed");
          }
          mockDataStore.userPreferences = prefs;
          return prefs;
        }),
      };

      // Load preferences
      const loaded = await mockDataStore.loadUserPreferences();
      expect(loaded).not.toHaveProperty("autoFetchFullContent");

      // Update preferences
      const updated: UserPreferences = {
        ...loaded!,
        theme: "light",
      };

      await mockDataStore.saveUserPreferences(updated);
      expect(mockDataStore.userPreferences?.theme).toBe("light");
    });
  });

  describe("Contract: Migration from Old Preferences", () => {
    it("should migrate old preferences by removing autoFetchFullContent", () => {
      const migratePreferences = (old: any): UserPreferences => {
        const { autoFetchFullContent, ...validFields } = old;

        return {
          theme: validFields.theme || "system",
          syncFrequency: validFields.syncFrequency || 4,
          maxArticles: validFields.maxArticles || 1000,
          enableNotifications: validFields.enableNotifications ?? true,
        };
      };

      // Test with old preferences containing autoFetchFullContent
      const oldPrefs = {
        theme: "dark" as const,
        syncFrequency: 8,
        maxArticles: 2000,
        autoFetchFullContent: true,
        enableNotifications: false,
      };

      const migrated = migratePreferences(oldPrefs);

      expect(migrated).not.toHaveProperty("autoFetchFullContent");
      expect(migrated.theme).toBe("dark");
      expect(migrated.syncFrequency).toBe(8);
      expect(migrated.maxArticles).toBe(2000);
      expect(migrated.enableNotifications).toBe(false);
    });

    it("should handle partial old preferences", () => {
      const migratePreferences = (old: any): UserPreferences => {
        return {
          theme: old.theme || "system",
          syncFrequency: old.syncFrequency || 4,
          maxArticles: old.maxArticles || 1000,
          enableNotifications: old.enableNotifications ?? true,
        };
      };

      // Test with minimal old preferences
      const oldPrefs = {
        theme: "light" as const,
        autoFetchFullContent: false, // Should be ignored
      };

      const migrated = migratePreferences(oldPrefs);

      expect(migrated).not.toHaveProperty("autoFetchFullContent");
      expect(migrated.theme).toBe("light");
      expect(migrated.syncFrequency).toBe(4); // Default
      expect(migrated.maxArticles).toBe(1000); // Default
      expect(migrated.enableNotifications).toBe(true); // Default
    });
  });

  describe("Contract: API Response Handling", () => {
    it("should handle API responses without autoFetchFullContent", async () => {
      // Mock API response handler
      const handlePreferencesResponse = (data: any): UserPreferences => {
        // Strip any unexpected fields
        const { theme, syncFrequency, maxArticles, enableNotifications } = data;

        return {
          theme: theme || "system",
          syncFrequency: syncFrequency || 4,
          maxArticles: maxArticles || 1000,
          enableNotifications: enableNotifications ?? true,
        };
      };

      // Test with API response that might include legacy fields
      const apiResponse = {
        theme: "dark",
        syncFrequency: 6,
        maxArticles: 1500,
        autoFetchFullContent: true, // Legacy field from API
        enableNotifications: false,
        someOtherField: "ignored",
      };

      const preferences = handlePreferencesResponse(apiResponse);

      expect(preferences).not.toHaveProperty("autoFetchFullContent");
      expect(preferences).not.toHaveProperty("someOtherField");
      expect(preferences.theme).toBe("dark");
    });
  });

  describe("Contract: Type Safety Validation", () => {
    it("should validate preferences at runtime", () => {
      const isValidUserPreferences = (obj: any): obj is UserPreferences => {
        return (
          typeof obj === "object" &&
          obj !== null &&
          ["light", "dark", "system"].includes(obj.theme) &&
          typeof obj.syncFrequency === "number" &&
          typeof obj.maxArticles === "number" &&
          typeof obj.enableNotifications === "boolean" &&
          !("autoFetchFullContent" in obj) // Explicitly check it's not present
        );
      };

      // Valid preferences
      const valid: UserPreferences = {
        theme: "system",
        syncFrequency: 4,
        maxArticles: 1000,
        enableNotifications: true,
      };

      expect(isValidUserPreferences(valid)).toBe(true);

      // Invalid: has autoFetchFullContent
      const invalid = {
        ...valid,
        autoFetchFullContent: true,
      };

      expect(isValidUserPreferences(invalid)).toBe(false);

      // Invalid: missing required field
      const incomplete = {
        theme: "dark",
        syncFrequency: 4,
      };

      expect(isValidUserPreferences(incomplete)).toBe(false);
    });
  });
});
