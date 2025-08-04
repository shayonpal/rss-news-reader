/**
 * Environment detection utilities for handling test environments gracefully
 */

export interface EnvironmentInfo {
  environment: string;
  isTest: boolean;
  hasDatabase: boolean;
  runtime: 'node' | 'vitest' | 'jest';
  timestamp: string;
  serviceConfig?: ServiceConfiguration;
}

export interface ServiceConfiguration {
  healthCheckTimeout: number;
  minStartupTime: number;
  cacheResultsMs: number;
  gracefulDegradation: boolean;
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

  const serviceConfig = getServiceConfiguration(isTest);
  
  return {
    environment: process.env.NODE_ENV || 'development',
    isTest,
    hasDatabase,
    runtime,
    timestamp: new Date().toISOString(),
    serviceConfig,
  };
}

/**
 * Gets environment-specific service configuration
 * @param isTest Whether running in test environment
 * @returns Service configuration appropriate for the environment
 */
function getServiceConfiguration(isTest: boolean): ServiceConfiguration {
  if (isTest) {
    // Test environment configuration - faster timeouts, no startup delays
    return {
      healthCheckTimeout: 5000,    // 5 seconds
      minStartupTime: 0,          // No startup delay in tests
      cacheResultsMs: 1000,       // 1 second cache
      gracefulDegradation: true,  // Always degrade gracefully in tests
    };
  }
  
  // Production/development configuration
  return {
    healthCheckTimeout: 30000,    // 30 seconds
    minStartupTime: 2000,        // 2 seconds startup time
    cacheResultsMs: 5000,        // 5 seconds cache
    gracefulDegradation: false,  // Fail fast in production
  };
}