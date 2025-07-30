// Main exports for database functionality
export {
  db,
  type StoredApiUsage,
  type StoredUserPreferences,
  type StoredPendingAction,
  type DatabaseInfo,
} from "./database";
export { storageManager, type StorageStats } from "./storage-manager";
export { DatabaseMigrations, type MigrationResult } from "./migrations";

// Repository exports
export {
  userPreferencesRepository,
  UserPreferencesRepository,
} from "./repositories/user-preferences-repository";
export {
  apiUsageRepository,
  ApiUsageRepository,
} from "./repositories/api-usage-repository";

// Store exports
export { useDataStore } from "../stores/data-store";

// Utility functions
export const initializeDatabase = async (): Promise<boolean> => {
  const { db } = await import("./database");
  const { DatabaseMigrations } = await import("./migrations");
  try {
    await db.open();
    const isValid = await DatabaseMigrations.validateDatabaseIntegrity();
    return isValid.isValid;
  } catch (error) {
    console.error("Failed to initialize database:", error);
    return false;
  }
};

export const getStorageStatus = async () => {
  const { storageManager } = await import("./storage-manager");
  const { db } = await import("./database");
  const stats = await storageManager.getStorageStats();
  const health = await storageManager.checkStorageHealth();
  const dbInfo = await db.getStorageInfo();

  return {
    storage: stats,
    health,
    database: dbInfo,
  };
};

// Error recovery utilities
export const recoverFromCorruption = async (): Promise<boolean> => {
  const { DatabaseMigrations } = await import("./migrations");
  return await DatabaseMigrations.handleCorruptedDatabase();
};

export const performMaintenance = async () => {
  const { storageManager } = await import("./storage-manager");
  return await storageManager.performMaintenanceCleanup();
};
