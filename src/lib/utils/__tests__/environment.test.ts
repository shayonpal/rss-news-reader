import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { isTestEnvironment, getEnvironmentInfo } from '../environment';

describe('Environment Detection Utilities', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset modules to ensure clean state
    vi.resetModules();
    // Create a copy of original env
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    // Restore original env
    process.env = originalEnv;
  });

  describe('isTestEnvironment', () => {
    it('returns true when NODE_ENV is test', () => {
      process.env.NODE_ENV = 'test';
      expect(isTestEnvironment()).toBe(true);
    });

    it('returns true when no SUPABASE_URL is configured', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.SUPABASE_URL;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      expect(isTestEnvironment()).toBe(true);
    });

    it('returns true when running under vitest', () => {
      process.env.NODE_ENV = 'development';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.VITEST = 'true';
      expect(isTestEnvironment()).toBe(true);
    });

    it('returns false in production with all services configured', () => {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      delete process.env.VITEST;
      delete process.env.JEST_WORKER_ID;
      expect(isTestEnvironment()).toBe(false);
    });

    it('handles edge cases correctly', () => {
      // Empty NODE_ENV but has SUPABASE_URL
      delete process.env.NODE_ENV;
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      delete process.env.VITEST;
      delete process.env.JEST_WORKER_ID;
      expect(isTestEnvironment()).toBe(false);

      // Mixed signals - test env but has DB config
      process.env.NODE_ENV = 'test';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      expect(isTestEnvironment()).toBe(true); // NODE_ENV takes precedence
    });
  });

  describe('getEnvironmentInfo', () => {
    it('returns correct metadata for test environment', () => {
      process.env.NODE_ENV = 'test';
      delete process.env.SUPABASE_URL;
      process.env.VITEST = 'true';

      const info = getEnvironmentInfo();
      expect(info).toEqual({
        environment: 'test',
        isTest: true,
        hasDatabase: false,
        runtime: 'vitest',
        timestamp: expect.any(String),
      });
    });

    it('returns correct metadata for production environment', () => {
      process.env.NODE_ENV = 'production';
      process.env.SUPABASE_URL = 'https://example.supabase.co';
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
      delete process.env.VITEST;
      delete process.env.JEST_WORKER_ID;

      const info = getEnvironmentInfo();
      expect(info).toEqual({
        environment: 'production',
        isTest: false,
        hasDatabase: true,
        runtime: 'node',
        timestamp: expect.any(String),
      });
    });

    it('detects different test runners correctly', () => {
      process.env.NODE_ENV = 'test';
      
      // Jest environment
      delete process.env.VITEST;
      process.env.JEST_WORKER_ID = '1';
      let info = getEnvironmentInfo();
      expect(info.runtime).toBe('jest');

      // Vitest environment
      delete process.env.JEST_WORKER_ID;
      process.env.VITEST = 'true';
      info = getEnvironmentInfo();
      expect(info.runtime).toBe('vitest');
    });

    it('includes valid ISO timestamp', () => {
      const info = getEnvironmentInfo();
      const timestamp = new Date(info.timestamp);
      expect(timestamp.toISOString()).toBe(info.timestamp);
    });
  });
});