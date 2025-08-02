import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { setupTestServer } from '../__tests__/integration/test-server';
import { createServer } from 'http';
import next from 'next';

// Mock modules
vi.mock('http');
vi.mock('next');
vi.mock('@next/env', () => ({
  loadEnvConfig: vi.fn()
}));

describe('Test Server Setup Function', () => {
  const mockCreateServer = vi.mocked(createServer);
  const mockNext = vi.mocked(next);
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('Environment Loading Tests', () => {
    it('should load environment variables from .env.test', async () => {
      const { loadEnvConfig } = await import('@next/env');
      const mockApp = {
        prepare: vi.fn().mockResolvedValue(undefined),
        getRequestHandler: vi.fn().mockReturnValue(vi.fn())
      };
      mockNext.mockReturnValue(mockApp as any);
      mockCreateServer.mockReturnValue({ listen: vi.fn() } as any);

      await setupTestServer(3148);

      expect(loadEnvConfig).toHaveBeenCalledWith(process.cwd());
      expect(process.env.NODE_ENV).toBe('test');
    });

    it('should set NEXT_BUILD_DIR to .next-test', async () => {
      const mockApp = {
        prepare: vi.fn().mockResolvedValue(undefined),
        getRequestHandler: vi.fn().mockReturnValue(vi.fn())
      };
      mockNext.mockReturnValue(mockApp as any);
      mockCreateServer.mockReturnValue({ listen: vi.fn() } as any);

      await setupTestServer(3148);

      expect(process.env.NEXT_BUILD_DIR).toBe('.next-test');
    });

    it('should disable Next.js telemetry', async () => {
      const mockApp = {
        prepare: vi.fn().mockResolvedValue(undefined),
        getRequestHandler: vi.fn().mockReturnValue(vi.fn())
      };
      mockNext.mockReturnValue(mockApp as any);
      mockCreateServer.mockReturnValue({ listen: vi.fn() } as any);

      await setupTestServer(3148);

      expect(process.env.NEXT_TELEMETRY_DISABLED).toBe('1');
    });
  });

  describe('Server Configuration Tests', () => {
    it('should configure Next.js with /reader basePath', async () => {
      const mockApp = {
        prepare: vi.fn().mockResolvedValue(undefined),
        getRequestHandler: vi.fn().mockReturnValue(vi.fn())
      };
      mockNext.mockReturnValue(mockApp as any);
      mockCreateServer.mockReturnValue({ listen: vi.fn() } as any);

      await setupTestServer(3148);

      expect(mockNext).toHaveBeenCalledWith({
        dev: true,
        dir: process.cwd(),
        conf: { basePath: '/reader' }
      });
    });

    it('should create HTTP server on specified port', async () => {
      const mockApp = {
        prepare: vi.fn().mockResolvedValue(undefined),
        getRequestHandler: vi.fn().mockReturnValue(vi.fn())
      };
      mockNext.mockReturnValue(mockApp as any);
      const mockServer = { listen: vi.fn() };
      mockCreateServer.mockReturnValue(mockServer as any);

      const result = await setupTestServer(3148);

      expect(mockCreateServer).toHaveBeenCalled();
      expect(result.server).toBe(mockServer);
    });

    it('should return both server and app instances', async () => {
      const mockApp = {
        prepare: vi.fn().mockResolvedValue(undefined),
        getRequestHandler: vi.fn().mockReturnValue(vi.fn())
      };
      mockNext.mockReturnValue(mockApp as any);
      const mockServer = { listen: vi.fn() };
      mockCreateServer.mockReturnValue(mockServer as any);

      const result = await setupTestServer(3148);

      expect(result).toHaveProperty('server');
      expect(result).toHaveProperty('app');
      expect(result.app).toBe(mockApp);
      expect(result.server).toBe(mockServer);
    });
  });
});