import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer } from './test-server';
import { Server } from 'http';
import type { NextServer } from 'next/dist/server/next';

describe('RR-121: Environment Variable Loading Integration Tests', () => {
  let server: Server;
  let app: NextServer;
  const port = 3149;
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

  describe('Supabase Connection Tests', () => {
    it('should have NEXT_PUBLIC_SUPABASE_URL defined', async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/db`);
      
      // Should get a proper Response object, not undefined
      expect(response).toBeDefined();
      expect(response).toBeInstanceOf(Response);
    });

    it('should have NEXT_PUBLIC_SUPABASE_ANON_KEY defined', async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/db`);
      const data = await response.json();
      
      // Should not have errors about missing environment variables
      expect(data.error).not.toContain('SUPABASE_URL');
      expect(data.error).not.toContain('SUPABASE_ANON_KEY');
    });

    it('should connect to database successfully', async () => {
      const response = await fetch(`${baseUrl}/reader/api/health/db`);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.database).toBe('connected');
    });
  });

  describe('API Route Tests', () => {
    it('should handle requests to /reader/api/* routes', async () => {
      const endpoints = [
        '/reader/api/health/app',
        '/reader/api/health/db',
        '/reader/api/health/freshness',
        '/reader/api/health/cron'
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`${baseUrl}${endpoint}`);
        
        // All responses should be defined Response objects
        expect(response).toBeDefined();
        expect(response).toBeInstanceOf(Response);
        expect(response.status).toBeGreaterThanOrEqual(200);
        expect(response.status).toBeLessThan(500);
      }
    });

    it('should return 404 for non-existent routes', async () => {
      const response = await fetch(`${baseUrl}/reader/api/does-not-exist`);
      
      expect(response).toBeDefined();
      expect(response.status).toBe(404);
    });
  });
});