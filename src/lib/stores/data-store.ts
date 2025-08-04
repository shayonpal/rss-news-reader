import { create } from "zustand";
import { persist } from "zustand/middleware";
import { db } from "@/lib/db/database";
import { storageManager, type StorageStats } from "@/lib/db/storage-manager";
import { DatabaseMigrations } from "@/lib/db/migrations";
import { userPreferencesRepository } from "@/lib/db/repositories/user-preferences-repository";
import { apiUsageRepository } from "@/lib/db/repositories/api-usage-repository";
import { isTestEnvironment } from "@/lib/utils/environment";
import type { UserPreferences, ApiUsage } from "@/types";

interface DatabaseStatus {
  isInitialized: boolean;
  isHealthy: boolean;
  version: number;
  lastError?: string;
  storageStats?: StorageStats;
}

interface DataState {
  // Database status
  dbStatus: DatabaseStatus;

  // User preferences
  preferences: UserPreferences | null;
  preferencesLoading: boolean;

  // API usage tracking
  apiUsage: ApiUsage | null;
  usageLoading: boolean;

  // Actions
  initializeDatabase: () => Promise<boolean>;
  loadPreferences: (userId?: string) => Promise<void>;
  updatePreferences: (
    preferences: Partial<UserPreferences>,
    userId?: string
  ) => Promise<boolean>;
  resetPreferences: (userId?: string) => Promise<void>;

  // API usage actions
  loadApiUsage: () => Promise<void>;
  recordInoreaderCall: (cost?: number) => Promise<void>;
  recordClaudeCall: (cost?: number) => Promise<void>;

  // Storage management
  checkStorageHealth: () => Promise<void>;
  performMaintenance: () => Promise<void>;
  clearAllData: () => Promise<void>;

  // Database utilities
  validateDatabase: () => Promise<boolean>;
  exportData: () => Promise<Blob | null>;

  // Error handling
  setError: (error: string) => void;
  clearError: () => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => ({
      // Initial state
      dbStatus: {
        isInitialized: false,
        isHealthy: true,
        version: 1,
      },
      preferences: null,
      preferencesLoading: false,
      apiUsage: null,
      usageLoading: false,

      // Initialize database
      initializeDatabase: async () => {
        try {
          console.log("Initializing database...");

          // Open database connection
          await db.open();

          // Initialize default preferences if needed
          await DatabaseMigrations.initializeDefaultPreferences();

          // Validate database integrity
          const validation =
            await DatabaseMigrations.validateDatabaseIntegrity();

          const version = await db.getVersion();
          const storageStats = await storageManager.getStorageStats();

          set({
            dbStatus: {
              isInitialized: true,
              isHealthy: validation.isValid,
              version,
              storageStats: storageStats || undefined,
              lastError: validation.isValid
                ? undefined
                : validation.issues.join("; "),
            },
          });

          // Load initial data
          await get().loadPreferences();
          await get().loadApiUsage();

          console.log("Database initialized successfully");
          return true;
        } catch (error) {
          console.error("Failed to initialize database:", error);

          // Try to recover from corruption
          const recovered = await DatabaseMigrations.handleCorruptedDatabase();

          set({
            dbStatus: {
              isInitialized: recovered,
              isHealthy: false,
              version: 1,
              lastError: `Database initialization failed: ${error}`,
            },
          });

          return recovered;
        }
      },

      // Load user preferences
      loadPreferences: async (userId?: string) => {
        set({ preferencesLoading: true });

        try {
          const preferences =
            await userPreferencesRepository.getPreferences(userId);

          set({
            preferences,
            preferencesLoading: false,
          });
        } catch (error) {
          console.error("Failed to load preferences:", error);
          set({
            preferencesLoading: false,
            dbStatus: {
              ...get().dbStatus,
              lastError: `Failed to load preferences: ${error}`,
            },
          });
        }
      },

      // Update user preferences
      updatePreferences: async (
        newPreferences: Partial<UserPreferences>,
        userId?: string
      ) => {
        try {
          const success =
            await userPreferencesRepository.updatePreferencesWithValidation(
              newPreferences,
              userId
            );

          if (success.success) {
            // Reload preferences to get updated values
            await get().loadPreferences(userId);
            return true;
          } else {
            set({
              dbStatus: {
                ...get().dbStatus,
                lastError: success.error || "Failed to update preferences",
              },
            });
            return false;
          }
        } catch (error) {
          console.error("Failed to update preferences:", error);
          set({
            dbStatus: {
              ...get().dbStatus,
              lastError: `Failed to update preferences: ${error}`,
            },
          });
          return false;
        }
      },

      // Reset preferences to defaults
      resetPreferences: async (userId?: string) => {
        try {
          await userPreferencesRepository.resetToDefaults(userId);
          await get().loadPreferences(userId);
        } catch (error) {
          console.error("Failed to reset preferences:", error);
          set({
            dbStatus: {
              ...get().dbStatus,
              lastError: `Failed to reset preferences: ${error}`,
            },
          });
        }
      },

      // Load API usage
      loadApiUsage: async () => {
        set({ usageLoading: true });

        try {
          const usage = await apiUsageRepository.getTodaysUsage();

          set({
            apiUsage: usage,
            usageLoading: false,
          });
        } catch (error) {
          console.error("Failed to load API usage:", error);
          set({
            usageLoading: false,
            dbStatus: {
              ...get().dbStatus,
              lastError: `Failed to load API usage: ${error}`,
            },
          });
        }
      },

      // Record API calls
      recordInoreaderCall: async (cost = 0) => {
        try {
          await apiUsageRepository.recordInoreaderCall(cost);
          await get().loadApiUsage(); // Refresh usage stats
        } catch (error) {
          console.error("Failed to record Inoreader call:", error);
        }
      },

      recordClaudeCall: async (cost = 0) => {
        try {
          await apiUsageRepository.recordClaudeCall(cost);
          await get().loadApiUsage(); // Refresh usage stats
        } catch (error) {
          console.error("Failed to record Claude call:", error);
        }
      },

      // Storage management
      checkStorageHealth: async () => {
        try {
          const health = await storageManager.checkStorageHealth();
          const stats = await storageManager.getStorageStats();

          set({
            dbStatus: {
              ...get().dbStatus,
              isHealthy: health.isHealthy,
              storageStats: stats || undefined,
              lastError: health.warning,
            },
          });
        } catch (error) {
          console.error("Failed to check storage health:", error);
          set({
            dbStatus: {
              ...get().dbStatus,
              lastError: `Storage health check failed: ${error}`,
            },
          });
        }
      },

      performMaintenance: async () => {
        try {
          console.log("Starting database maintenance...");

          const result = await storageManager.performMaintenanceCleanup();

          if (result.articlesDeleted > 0 || result.apiRecordsDeleted > 0) {
            console.log(
              `Maintenance completed: ${result.articlesDeleted} articles, ${result.apiRecordsDeleted} API records cleaned`
            );
          }

          // Update storage stats
          set({
            dbStatus: {
              ...get().dbStatus,
              storageStats: result.stats || undefined,
            },
          });
        } catch (error) {
          console.error("Database maintenance failed:", error);
          set({
            dbStatus: {
              ...get().dbStatus,
              lastError: `Maintenance failed: ${error}`,
            },
          });
        }
      },

      // Clear all data
      clearAllData: async () => {
        try {
          await db.clearAllData();

          // Reset state
          set({
            preferences: null,
            apiUsage: null,
            dbStatus: {
              isInitialized: true,
              isHealthy: true,
              version: 1,
            },
          });

          // Reinitialize with defaults
          await DatabaseMigrations.initializeDefaultPreferences();
          await get().loadPreferences();
          await get().loadApiUsage();

          console.log("All data cleared successfully");
        } catch (error) {
          console.error("Failed to clear data:", error);
          set({
            dbStatus: {
              ...get().dbStatus,
              lastError: `Failed to clear data: ${error}`,
            },
          });
        }
      },

      // Validate database
      validateDatabase: async () => {
        try {
          const validation =
            await DatabaseMigrations.validateDatabaseIntegrity();

          set({
            dbStatus: {
              ...get().dbStatus,
              isHealthy: validation.isValid,
              lastError: validation.isValid
                ? undefined
                : validation.issues.join("; "),
            },
          });

          return validation.isValid;
        } catch (error) {
          console.error("Database validation failed:", error);
          set({
            dbStatus: {
              ...get().dbStatus,
              lastError: `Validation failed: ${error}`,
            },
          });
          return false;
        }
      },

      // Export data
      exportData: async () => {
        try {
          const data = {
            preferences: await userPreferencesRepository.getPreferences(),
            apiUsage: await apiUsageRepository.getUsageHistory(30),
            dbInfo: await db.getStorageInfo(),
            exportedAt: new Date().toISOString(),
          };

          return new Blob([JSON.stringify(data, null, 2)], {
            type: "application/json",
          });
        } catch (error) {
          console.error("Failed to export data:", error);
          return null;
        }
      },

      // Error handling
      setError: (error: string) => {
        set({
          dbStatus: {
            ...get().dbStatus,
            lastError: error,
          },
        });
      },

      clearError: () => {
        set({
          dbStatus: {
            ...get().dbStatus,
            lastError: undefined,
          },
        });
      },
    }),
    {
      name: "data-storage",
      partialize: (state) => ({
        // Only persist minimal state, not database objects
        dbStatus: {
          isInitialized: state.dbStatus.isInitialized,
          version: state.dbStatus.version,
        },
      }),
    }
  )
);

// Auto-initialize database on store creation (except in test environments)
if (typeof window !== "undefined" && !isTestEnvironment()) {
  useDataStore.getState().initializeDatabase().catch(console.error);
}
