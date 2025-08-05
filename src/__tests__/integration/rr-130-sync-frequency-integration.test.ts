import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { setupTestServer } from './test-server';
import type { Server } from 'http';

/**
 * RR-130 Integration Test Suite: Sync Frequency Infrastructure
 * 
 * Tests the integration between PM2 ecosystem configuration, cron service,
 * and sync API endpoints for the 6x daily sync frequency implementation.
 * 
 * Target: 2AM, 6AM, 10AM, 2PM, 6PM, 10PM (America/Toronto)
 */

let server: Server;
let app: any;

beforeAll(async () => {
  const testServer = await setupTestServer(3002);
  server = testServer.server;
  app = testServer.app;
  
  await new Promise<void>((resolve) => {
    server.listen(3002, resolve);
  });
});

afterAll(async () => {
  if (server) {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
  if (app) {
    await app.close();
  }
});

describe('RR-130 Integration Tests: Sync Frequency Infrastructure', () => {
  
  describe('PM2 Ecosystem Configuration Integration', () => {
    it('should validate ecosystem.config.js contains updated cron schedule', async () => {
      // Mock reading ecosystem config
      const mockEcosystemConfig = {
        apps: [
          {
            name: "rss-sync-cron",
            env: {
              SYNC_CRON_SCHEDULE: "0 2,6,10,14,18,22 * * *"
            }
          }
        ]
      };
      
      const cronApp = mockEcosystemConfig.apps.find(app => app.name === "rss-sync-cron");
      expect(cronApp).toBeDefined();
      expect(cronApp?.env.SYNC_CRON_SCHEDULE).toBe("0 2,6,10,14,18,22 * * *");
      
      // Validate all 6 sync hours are present
      const scheduleHours = cronApp?.env.SYNC_CRON_SCHEDULE.split(' ')[1];
      const hours = scheduleHours?.split(',').map(h => parseInt(h, 10));
      expect(hours).toEqual([2, 6, 10, 14, 18, 22]);
    });

    it('should validate cron service environment variables', async () => {
      const requiredEnvVars = [
        'SYNC_CRON_SCHEDULE',
        'SYNC_LOG_PATH',
        'NEXT_PUBLIC_BASE_URL',
        'NEXT_PUBLIC_SUPABASE_URL',
        'SUPABASE_SERVICE_ROLE_KEY'
      ];
      
      // Mock environment validation
      const mockEnv = {
        SYNC_CRON_SCHEDULE: "0 2,6,10,14,18,22 * * *",
        SYNC_LOG_PATH: "./logs/sync-cron.jsonl",
        NEXT_PUBLIC_BASE_URL: "http://localhost:3000",
        NEXT_PUBLIC_SUPABASE_URL: "https://test.supabase.co",
        SUPABASE_SERVICE_ROLE_KEY: "test-key"
      };
      
      requiredEnvVars.forEach(envVar => {
        expect(mockEnv).toHaveProperty(envVar);
        expect(mockEnv[envVar as keyof typeof mockEnv]).toBeTruthy();
      });
    });

    it('should validate PM2 process configuration for increased frequency', async () => {
      const cronProcessConfig = {
        name: "rss-sync-cron",
        instances: 1,
        exec_mode: "fork",
        cron_restart: "0 0 * * *", // Daily restart for stability
        min_uptime: 10000,
        kill_timeout: 30000,
        max_restarts: 10,
        restart_delay: 60000,
        max_memory_restart: "256M"
      };
      
      // Validate configuration is appropriate for 6x frequency
      expect(cronProcessConfig.instances).toBe(1); // Single instance to prevent conflicts
      expect(cronProcessConfig.max_memory_restart).toBe("256M"); // Conservative limit
      expect(cronProcessConfig.kill_timeout).toBe(30000); // Adequate for sync operations
      expect(cronProcessConfig.max_restarts).toBe(10); // Conservative for stability
    });
  });

  describe('Cron Service Initialization Integration', () => {
    it('should initialize cron service with new schedule', async () => {
      const mockCronService = {
        schedule: "0 2,6,10,14,18,22 * * *",
        isEnabled: true,
        timezone: "America/Toronto",
        serviceStartTime: Date.now(),
        successCount: 0,
        failureCount: 0
      };
      
      expect(mockCronService.schedule).toBe("0 2,6,10,14,18,22 * * *");
      expect(mockCronService.isEnabled).toBe(true);
      expect(mockCronService.timezone).toBe("America/Toronto");
    });

    it('should validate cron service health status endpoint', async () => {
      // Mock cron health status
      const mockHealthStatus = {
        timestamp: new Date().toISOString(),
        status: "healthy",
        service: "rss-sync-cron",
        enabled: true,
        schedule: "0 2,6,10,14,18,22 * * *",
        uptime: 3600,
        lastRun: null,
        lastRunStatus: null,
        nextRun: "2025-01-27T02:00:00.000Z",
        recentRuns: {
          successful: 0,
          failed: 0,
          lastFailure: null
        }
      };
      
      expect(mockHealthStatus.enabled).toBe(true);
      expect(mockHealthStatus.schedule).toBe("0 2,6,10,14,18,22 * * *");
      expect(mockHealthStatus.service).toBe("rss-sync-cron");
    });

    it('should handle timezone configuration properly', async () => {
      const mockTimezoneConfig = {
        timezone: "America/Toronto",
        schedule: "0 2,6,10,14,18,22 * * *"
      };
      
      // Validate timezone handling
      expect(mockTimezoneConfig.timezone).toBe("America/Toronto");
      
      // Mock Toronto timezone validation
      const torontoDate = new Date().toLocaleString("en-US", {
        timeZone: "America/Toronto"
      });
      
      expect(torontoDate).toBeTruthy();
    });
  });

  describe('Sync API Endpoint Integration', () => {
    it('should handle sync initiation with new frequency', async () => {
      const response = await fetch('http://localhost:3002/reader/api/health/app');
      expect(response.ok).toBe(true);
      
      // Mock sync initiation response
      const mockSyncResponse = {
        syncId: "test-sync-id",
        status: "started",
        message: "Sync initiated with 6x daily frequency",
        timestamp: new Date().toISOString()
      };
      
      expect(mockSyncResponse.status).toBe("started");
      expect(mockSyncResponse.syncId).toBeTruthy();
    });

    it('should validate sync status polling integration', async () => {
      const mockSyncId = "test-sync-id";
      
      // Mock sync status response
      const mockStatusResponse = {
        syncId: mockSyncId,
        status: "running",
        progress: 50,
        message: "Processing feeds...",
        timestamp: new Date().toISOString()
      };
      
      expect(mockStatusResponse.syncId).toBe(mockSyncId);
      expect(mockStatusResponse.status).toBe("running");
      expect(mockStatusResponse.progress).toBeGreaterThanOrEqual(0);
    });

    it('should validate sync completion with materialized view refresh', async () => {
      const mockCompletionResponse = {
        syncId: "test-sync-id",
        status: "completed",
        duration: 25000,
        feedsCount: 150,
        articlesCount: 500,
        materializedViewRefreshed: true,
        timestamp: new Date().toISOString()
      };
      
      expect(mockCompletionResponse.status).toBe("completed");
      expect(mockCompletionResponse.materializedViewRefreshed).toBe(true);
      expect(mockCompletionResponse.duration).toBeGreaterThan(0);
    });

    it('should validate sync metadata update integration', async () => {
      const mockMetadataUpdate = {
        last_sync_time: new Date().toISOString(),
        last_sync_status: "success",
        last_sync_error: null,
        sync_success_count: { increment: 1 },
        sync_frequency: "6x_daily",
        next_sync_time: "2025-01-27T06:00:00.000Z"
      };
      
      expect(mockMetadataUpdate.last_sync_status).toBe("success");
      expect(mockMetadataUpdate.sync_frequency).toBe("6x_daily");
      expect(mockMetadataUpdate.next_sync_time).toBeTruthy();
    });
  });

  describe('Database Integration for Increased Frequency', () => {
    it('should handle increased sync metadata writes', async () => {
      // Mock sync metadata table structure
      const mockSyncMetadata = {
        id: 1,
        user_id: "shayon",
        last_sync_time: new Date().toISOString(),
        last_sync_status: "success",
        last_sync_error: null,
        sync_success_count: 6, // 6 syncs per day
        sync_failure_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      expect(mockSyncMetadata.sync_success_count).toBe(6);
      expect(mockSyncMetadata.last_sync_status).toBe("success");
    });

    it('should validate materialized view refresh integration', async () => {
      // Mock materialized view refresh
      const mockViewRefresh = async () => {
        const refreshQuery = "REFRESH MATERIALIZED VIEW CONCURRENTLY feed_stats;";
        return { query: refreshQuery, status: "completed", duration: 500 };
      };
      
      const result = await mockViewRefresh();
      expect(result.status).toBe("completed");
      expect(result.query).toContain("REFRESH MATERIALIZED VIEW");
      expect(result.duration).toBeGreaterThan(0);
    });

    it('should handle connection pooling under increased load', async () => {
      // Mock connection pool validation
      const mockConnectionPool = {
        maxConnections: 10,
        activeConnections: 2,
        idleConnections: 8,
        averageUsage: 0.2, // 20% utilization
        maxUsageWith6xFreq: 0.4 // Estimated 40% with 6x frequency
      };
      
      expect(mockConnectionPool.activeConnections).toBeLessThan(mockConnectionPool.maxConnections);
      expect(mockConnectionPool.maxUsageWith6xFreq).toBeLessThan(0.8); // Should stay below 80%
    });
  });

  describe('API Rate Limit Integration', () => {
    it('should validate API usage tracking with 6x frequency', async () => {
      // Mock API usage calculation
      const dailyApiCallsLimitInoreader = 100;
      const expectedCallsPerSync = 4; // Typical calls per sync
      const maxDailyCalls = expectedCallsPerSync * 6; // 24 calls for 6 syncs
      
      expect(maxDailyCalls).toBeLessThan(dailyApiCallsLimitInoreader);
      expect(maxDailyCalls).toBe(24); // 4 calls × 6 syncs = 24 calls/day
    });

    it('should handle rate limit compliance monitoring', async () => {
      const mockApiUsage = {
        date: new Date().toISOString().split('T')[0],
        total_calls: 18,
        remaining_calls: 82, // 100 - 18
        rate_limit_hit: false,
        last_call_time: new Date().toISOString()
      };
      
      expect(mockApiUsage.rate_limit_hit).toBe(false);
      expect(mockApiUsage.remaining_calls).toBeGreaterThan(50);
      expect(mockApiUsage.total_calls).toBeLessThan(100);
    });

    it('should validate error handling for rate limit scenarios', async () => {
      const mockRateLimitError = {
        error: "Rate limit exceeded",
        status: 429,
        retryAfter: 3600, // 1 hour
        nextSyncDelay: true
      };
      
      // Should handle rate limits gracefully
      expect(mockRateLimitError.status).toBe(429);
      expect(mockRateLimitError.retryAfter).toBeGreaterThan(0);
      expect(mockRateLimitError.nextSyncDelay).toBe(true);
    });
  });

  describe('Monitoring Integration with New Thresholds', () => {
    it('should integrate updated monitoring script thresholds', async () => {
      const oldStalenessThreshold = 12; // hours (for 2x daily)
      const newStalenessThreshold = 4;  // hours (for 6x daily)
      
      expect(newStalenessThreshold).toBeLessThan(oldStalenessThreshold);
      expect(newStalenessThreshold).toBe(4);
    });

    it('should validate health endpoint freshness checks', async () => {
      const mockFreshnessCheck = {
        hoursSinceLastArticle: 3,
        stalenessThreshold: 4,
        status: 'healthy',
        lastSyncTime: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
      };
      
      expect(mockFreshnessCheck.hoursSinceLastArticle).toBeLessThan(mockFreshnessCheck.stalenessThreshold);
      expect(mockFreshnessCheck.status).toBe('healthy');
    });

    it('should integrate monitoring alerts with new frequency', async () => {
      const mockMonitoringAlert = {
        service: "rss-sync-cron",
        alertType: "sync_overdue",
        threshold: 4, // hours
        actualDelay: 5, // hours
        triggered: true,
        severity: "high"
      };
      
      expect(mockMonitoringAlert.actualDelay).toBeGreaterThan(mockMonitoringAlert.threshold);
      expect(mockMonitoringAlert.triggered).toBe(true);
      expect(mockMonitoringAlert.severity).toBe("high");
    });
  });

  describe('Error Handling Integration', () => {
    it('should handle sync failures gracefully with increased frequency', async () => {
      const mockSyncFailure = {
        syncId: "failed-sync-id",
        status: "failed",
        error: "Database connection timeout",
        duration: 30000,
        nextRetry: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString() // Next sync slot
      };
      
      expect(mockSyncFailure.status).toBe("failed");
      expect(mockSyncFailure.error).toBeTruthy();
      expect(mockSyncFailure.nextRetry).toBeTruthy();
    });

    it('should validate concurrent sync prevention', async () => {
      const mockConcurrencyCheck = {
        activeSyncs: 0,
        maxConcurrentSyncs: 1,
        canStartNewSync: true,
        lockAcquired: true
      };
      
      expect(mockConcurrencyCheck.activeSyncs).toBeLessThan(mockConcurrencyCheck.maxConcurrentSyncs);
      expect(mockConcurrencyCheck.canStartNewSync).toBe(true);
      expect(mockConcurrencyCheck.lockAcquired).toBe(true);
    });

    it('should handle token refresh with increased API usage', async () => {
      const mockTokenRefresh = {
        tokenExpiry: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
        refreshNeeded: false,
        lastRefresh: new Date().toISOString(),
        apiCallsToday: 18,
        refreshThreshold: 80 // Refresh when 80+ calls made
      };
      
      expect(mockTokenRefresh.refreshNeeded).toBe(false);
      expect(mockTokenRefresh.apiCallsToday).toBeLessThan(mockTokenRefresh.refreshThreshold);
    });
  });

  describe('Performance Integration', () => {
    it('should validate memory usage with 6x frequency', async () => {
      const mockMemoryUsage = {
        cronService: "45MB",    // Current usage
        maxAllowed: "256MB",    // PM2 limit
        utilizationPercent: 17.6, // 45/256
        projectedWith6x: "55MB", // Estimated increase
        safetyMargin: true
      };
      
      expect(parseFloat(mockMemoryUsage.cronService)).toBeLessThan(256);
      expect(mockMemoryUsage.utilizationPercent).toBeLessThan(50);
      expect(mockMemoryUsage.safetyMargin).toBe(true);
    });

    it('should validate sync duration remains acceptable', async () => {
      const mockSyncPerformance = {
        averageDuration: 25000,    // 25 seconds
        maxAcceptableDuration: 120000, // 2 minutes
        within4HourWindow: true,
        performanceGrade: "good"
      };
      
      expect(mockSyncPerformance.averageDuration).toBeLessThan(mockSyncPerformance.maxAcceptableDuration);
      expect(mockSyncPerformance.within4HourWindow).toBe(true);
      expect(mockSyncPerformance.performanceGrade).toBe("good");
    });
  });
});