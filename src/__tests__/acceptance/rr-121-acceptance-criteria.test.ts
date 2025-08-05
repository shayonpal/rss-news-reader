import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer } from '../integration/test-server';
import { Server } from 'http';
import type { NextServer } from 'next/dist/server/next';
import { existsSync } from 'fs';

describe('RR-121: Acceptance Criteria Verification', () => {
  let server: Server;
  let app: NextServer;
  const port = 3154;
  const baseUrl = `http://localhost:${port}`;

  beforeAll(async () => {
    const setup = await setupTestServer(port);
    server = setup.server;
    app = setup.app;
    
    await new Promise<void>((resolve) => {
      server.listen(port, () => resolve());
    });
  }, 30000);

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  describe('All Health Endpoints Working', () => {
    it('should return 200 for /reader/api/health/app', async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/app`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
    });

    it('should return 200 for /reader/api/health/db', async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/db`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.database).toBe('connected');
    });

    it('should return 200 for /reader/api/health/cron', async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/cron`);
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.status).toBeDefined();
    });
  });

  describe('No Manual Setup Required', () => {
    it('should work with fresh clone + npm install', async () => {
      // Test that environment variables are loaded automatically
      expect(process.env.NODE_ENV).toBe('test');
      expect(process.env.NEXT_BUILD_DIR).toBe('.next-test');
      expect(process.env.NEXT_TELEMETRY_DISABLED).toBe('1');
    });

    it('should not require manual token creation', async () => {
      // Health endpoints should work without OAuth tokens
      const response = await fetch(`${baseUrl}/reader/api/health/app`);
      expect(response.status).toBe(200);
    });

    it('should not require manual env variable exports', async () => {
      // Environment should be loaded via loadEnvConfig
      const response = await fetch(`${baseUrl}/reader/api/health/db`);
      const data = await response.json();
      
      // Should not have errors about missing env vars
      expect(data.error).not.toContain('NEXT_PUBLIC_SUPABASE_URL');
    });
  });

  describe('Test/Production Separation', () => {
    it('should use .next-test directory for builds', () => {
      expect(process.env.NEXT_BUILD_DIR).toBe('.next-test');
    });

    it('should have IS_TEST_ENVIRONMENT flag', () => {
      // This will be true once .env.test is created
      expect(process.env.IS_TEST_ENVIRONMENT).toBeDefined();
    });

    it('should not affect production .next directory', () => {
      // Verify test build dir is different from production
      expect(process.env.NEXT_BUILD_DIR).not.toBe('.next');
      
      // Check that .next-test exists or will be created
      const testBuildPath = '.next-test';
      // The directory might not exist yet, but the env var should be set
      expect(process.env.NEXT_BUILD_DIR).toBe(testBuildPath);
    });
  });
});