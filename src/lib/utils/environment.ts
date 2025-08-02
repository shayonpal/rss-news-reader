/**
 * Environment detection utilities for handling test environments gracefully
 */

export interface EnvironmentInfo {
  environment: string;
  isTest: boolean;
  hasDatabase: boolean;
  runtime: 'node' | 'vitest' | 'jest';
  timestamp: string;
}

/**
 * Detects if the application is running in a test environment
 * @returns true if running in test environment, false otherwise
 */
export function isTestEnvironment(): boolean {
  // Check NODE_ENV first - most explicit signal
  if (process.env.NODE_ENV === 'test') {
    return true;
  }

  // Check for missing database configuration - indicates test environment
  if (!process.env.SUPABASE_URL && !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return true;
  }

  // Check for test runners
  if (process.env.VITEST === 'true' || process.env.JEST_WORKER_ID) {
    return true;
  }

  return false;
}

/**
 * Gets detailed environment information for debugging and logging
 * @returns Environment metadata including runtime details
 */
export function getEnvironmentInfo(): EnvironmentInfo {
  const isTest = isTestEnvironment();
  const hasDatabase = !!(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL);
  
  let runtime: 'node' | 'vitest' | 'jest' = 'node';
  if (process.env.VITEST === 'true') {
    runtime = 'vitest';
  } else if (process.env.JEST_WORKER_ID) {
    runtime = 'jest';
  }

  return {
    environment: process.env.NODE_ENV || 'development',
    isTest,
    hasDatabase,
    runtime,
    timestamp: new Date().toISOString(),
  };
}