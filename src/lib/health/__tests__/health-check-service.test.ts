import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { HealthCheckService } from '../health-check-service';
import { db } from '@/lib/db';

// Mock the database
vi.mock('@/lib/db', () => ({
  db: {
    articles: {
      count: vi.fn(),
      toArray: vi.fn(),
    },
    feeds: {
      toArray: vi.fn(),
    },
    getStorageInfo: vi.fn(),
  },
}));

// Mock fetch
global.fetch = vi.fn();

describe('HealthCheckService', () => {
  let service: HealthCheckService;

  beforeEach(() => {
    service = HealthCheckService.getInstance();
    vi.clearAllMocks();
    
    // Setup default mocks
    (db.articles.count as any).mockResolvedValue(100);
    (db.articles.toArray as any).mockResolvedValue([]);
    (db.feeds.toArray as any).mockResolvedValue([{ id: 'feed1' }]);
    (db.getStorageInfo as any).mockResolvedValue({
      quota: 100 * 1024 * 1024, // 100MB
      usage: 50 * 1024 * 1024, // 50MB
      counts: {
        articles: 100,
        feeds: 10,
        folders: 5,
        summaries: 50,
        pendingActions: 0,
        apiUsage: 30,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('checkHealth', () => {
    it('should return healthy status when all services are healthy', async () => {
      // Mock successful API responses
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'X-RateLimit-Remaining': '90',
        }),
        json: async () => ({ authenticated: true }),
      });

      const result = await service.checkHealth();

      expect(result.overall).toBe('healthy');
      expect(result.services).toHaveLength(5); // database, api, cache, auth, network
      expect(result.metrics.totalChecks).toBeGreaterThan(0);
    });

    it('should return degraded status when some services are degraded', async () => {
      // Mock storage almost full
      (db.getStorageInfo as any).mockResolvedValue({
        quota: 100 * 1024 * 1024, // 100MB
        usage: 85 * 1024 * 1024, // 85MB (85% used)
        counts: {},
      });

      const result = await service.checkHealth();

      expect(result.overall).toBe('degraded');
      
      const databaseService = result.services.find(s => s.name === 'database');
      expect(databaseService?.status).toBe('degraded');
    });

    it('should return unhealthy status when critical services fail', async () => {
      // Mock database connection failure
      (db.articles.count as any).mockRejectedValue(new Error('Database connection failed'));

      const result = await service.checkHealth();

      expect(result.overall).toBe('unhealthy');
      
      const databaseService = result.services.find(s => s.name === 'database');
      expect(databaseService?.status).toBe('unhealthy');
    });
  });

  describe('Database Health Checks', () => {
    it('should check database connection successfully', async () => {
      const result = await service.checkHealth();
      const databaseService = result.services.find(s => s.name === 'database');
      const connectionCheck = databaseService?.checks.find(c => c.name === 'connection');

      expect(connectionCheck?.status).toBe('healthy');
      expect(connectionCheck?.message).toContain('Database connection is active');
    });

    it('should detect high storage usage', async () => {
      (db.getStorageInfo as any).mockResolvedValue({
        quota: 100 * 1024 * 1024,
        usage: 92 * 1024 * 1024, // 92% used
        counts: {},
      });

      const result = await service.checkHealth();
      const databaseService = result.services.find(s => s.name === 'database');
      const storageCheck = databaseService?.checks.find(c => c.name === 'storage');

      expect(storageCheck?.status).toBe('unhealthy');
      expect(storageCheck?.message).toContain('Critical: Storage almost full');
    });

    it('should detect data integrity issues', async () => {
      // Mock orphaned articles
      (db.articles.toArray as any).mockResolvedValue([
        { id: '1', feedId: 'feed1' },
        { id: '2', feedId: 'non-existent-feed' }, // Orphaned
      ]);

      const result = await service.checkHealth();
      const databaseService = result.services.find(s => s.name === 'database');
      const integrityCheck = databaseService?.checks.find(c => c.name === 'integrity');

      expect(integrityCheck?.status).toBe('degraded');
      expect(integrityCheck?.message).toContain('Found 1 orphaned articles');
    });
  });

  describe('API Health Checks', () => {
    it('should check Inoreader API successfully', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'X-RateLimit-Remaining': '90',
        }),
        json: async () => ({ authenticated: true }),
      });

      const result = await service.checkHealth();
      const apiService = result.services.find(s => s.name === 'api');
      const inoreaderCheck = apiService?.checks.find(c => c.name === 'inoreader');

      expect(inoreaderCheck?.status).toBe('healthy');
      expect(inoreaderCheck?.details?.rateLimitRemaining).toBe(90);
    });

    it('should detect low API quota', async () => {
      (global.fetch as any).mockResolvedValue({
        ok: true,
        status: 200,
        headers: new Headers({
          'X-RateLimit-Remaining': '5',
        }),
        json: async () => ({ authenticated: true }),
      });

      const result = await service.checkHealth();
      const apiService = result.services.find(s => s.name === 'api');
      const inoreaderCheck = apiService?.checks.find(c => c.name === 'inoreader');

      expect(inoreaderCheck?.status).toBe('degraded');
      expect(inoreaderCheck?.message).toContain('Low API quota remaining');
    });

    it('should handle API failures gracefully', async () => {
      (global.fetch as any).mockRejectedValue(new Error('Network error'));

      const result = await service.checkHealth();
      const apiService = result.services.find(s => s.name === 'api');
      const inoreaderCheck = apiService?.checks.find(c => c.name === 'inoreader');

      expect(inoreaderCheck?.status).toBe('unhealthy');
      expect(inoreaderCheck?.error).toContain('Network error');
    });
  });

  describe('Cache Health Checks', () => {
    it('should check service worker cache', async () => {
      // Mock caches API
      global.caches = {
        keys: vi.fn().mockResolvedValue(['cache-v1', 'cache-v2']),
      } as any;

      const result = await service.checkHealth();
      const cacheService = result.services.find(s => s.name === 'cache');
      const swCheck = cacheService?.checks.find(c => c.name === 'service-worker');

      expect(swCheck?.status).toBe('healthy');
      expect(swCheck?.message).toContain('2 caches active');
    });

    it('should check localStorage availability', async () => {
      const result = await service.checkHealth();
      const cacheService = result.services.find(s => s.name === 'cache');
      const lsCheck = cacheService?.checks.find(c => c.name === 'local-storage');

      expect(lsCheck?.status).toBe('healthy');
      expect(lsCheck?.message).toContain('LocalStorage usage');
    });
  });

  describe('Network Health Checks', () => {
    it('should detect online status', async () => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: true,
      });

      const result = await service.checkHealth();
      const networkService = result.services.find(s => s.name === 'network');
      const connectivityCheck = networkService?.checks.find(c => c.name === 'connectivity');

      expect(connectivityCheck?.status).toBe('healthy');
      expect(connectivityCheck?.message).toContain('Network is online');
    });

    it('should detect offline status', async () => {
      Object.defineProperty(navigator, 'onLine', {
        configurable: true,
        value: false,
      });

      const result = await service.checkHealth();
      const networkService = result.services.find(s => s.name === 'network');
      const connectivityCheck = networkService?.checks.find(c => c.name === 'connectivity');

      expect(connectivityCheck?.status).toBe('unhealthy');
      expect(connectivityCheck?.message).toContain('Network is offline');
    });
  });

  describe('Metrics Calculation', () => {
    it('should track response times', async () => {
      // Perform multiple health checks
      await service.checkHealth();
      await service.checkHealth();
      
      const result = await service.checkHealth();

      expect(result.metrics.totalChecks).toBe(3);
      expect(result.metrics.avgResponseTime).toBeGreaterThan(0);
    });

    it('should track failed checks', async () => {
      // First check succeeds
      await service.checkHealth();

      // Make next check fail
      (db.articles.count as any).mockRejectedValue(new Error('Database error'));
      
      try {
        await service.checkHealth();
      } catch (e) {
        // Expected to fail
      }

      // Check metrics
      const result = await service.checkHealth();
      expect(result.metrics.failedChecks).toBeGreaterThan(0);
    });

    it('should calculate uptime correctly', async () => {
      // Wait a bit to ensure uptime > 0
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const result = await service.checkHealth();
      
      expect(result.metrics.uptime).toBeGreaterThan(0);
    });
  });
});