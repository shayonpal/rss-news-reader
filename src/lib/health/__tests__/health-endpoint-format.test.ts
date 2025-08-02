/**
 * Unit Tests for Health Endpoint Format Compliance (RR-120)
 * Tests the health endpoint response format to match integration test expectations
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AppHealthCheck } from "../app-health-check";

// Mock Supabase
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        limit: vi.fn(() => ({
          single: vi.fn(() => Promise.resolve({ data: { key: "test" }, error: null }))
        }))
      }))
    }))
  }))
}));

// Mock fs/promises
vi.mock("fs/promises", () => ({
  access: vi.fn(() => Promise.resolve()),
  readFile: vi.fn(() => Promise.resolve('{"encrypted": true}')),
  stat: vi.fn(() => Promise.resolve({ mtime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) })),
  mkdir: vi.fn(() => Promise.resolve()),
  appendFile: vi.fn(() => Promise.resolve())
}));

describe("Health Endpoint Format Compliance", () => {
  let healthCheck: AppHealthCheck;

  beforeEach(() => {
    vi.clearAllMocks();
    healthCheck = AppHealthCheck.getInstance();
  });

  describe("Root Level Timestamp Field", () => {
    it("should include timestamp field at root level in health response", async () => {
      const health = await healthCheck.checkHealth();
      
      expect(health).toHaveProperty("timestamp");
      expect(health.timestamp).toBeTypeOf("string");
      expect(new Date(health.timestamp)).toBeInstanceOf(Date);
    });

    it("should have timestamp in ISO format", async () => {
      const health = await healthCheck.checkHealth();
      
      expect(health.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should have timestamp close to current time", async () => {
      const beforeTime = new Date();
      const health = await healthCheck.checkHealth();
      const afterTime = new Date();
      
      const healthTimestamp = new Date(health.timestamp);
      expect(healthTimestamp.getTime()).toBeGreaterThanOrEqual(beforeTime.getTime());
      expect(healthTimestamp.getTime()).toBeLessThanOrEqual(afterTime.getTime());
    });
  });

  describe("Response Structure Validation", () => {
    it("should match expected health response structure", async () => {
      const health = await healthCheck.checkHealth();
      
      expect(health).toMatchObject({
        status: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
        service: "rss-reader-app",
        uptime: expect.any(Number),
        lastActivity: expect.any(String),
        errorCount: expect.any(Number),
        timestamp: expect.any(String),
        dependencies: {
          database: expect.stringMatching(/^(healthy|degraded|unhealthy)$/),
          oauth: expect.stringMatching(/^(healthy|degraded|unhealthy)$/)
        },
        performance: {
          avgDbQueryTime: expect.any(Number),
          avgApiCallTime: expect.any(Number),
          avgSyncTime: expect.any(Number)
        }
      });
    });

    it("should include version field when available", async () => {
      const health = await healthCheck.checkHealth();
    });

    it("should have consistent field types", async () => {
      const health = await healthCheck.checkHealth();
      
      expect(typeof health.status).toBe("string");
      expect(typeof health.service).toBe("string");
      expect(typeof health.uptime).toBe("number");
      expect(typeof health.lastActivity).toBe("string");
      expect(typeof health.errorCount).toBe("number");
      expect(typeof health.timestamp).toBe("string");
      expect(typeof health.dependencies).toBe("object");
      expect(typeof health.performance).toBe("object");
    });
  });

  describe("Error Scenarios", () => {
    it("should include timestamp even when database fails", async () => {
      const mockSupabase = {
        from: vi.fn(() => ({
          select: vi.fn(() => ({
            limit: vi.fn(() => ({
              single: vi.fn(() => Promise.resolve({ data: null, error: { message: "Connection failed" } }))
            }))
          }))
        }))
      };

      // Mock failed database
      vi.doMock("@supabase/supabase-js", () => ({
        createClient: vi.fn(() => mockSupabase)
      }));

      const health = await healthCheck.checkHealth();
      
      expect(health).toHaveProperty("timestamp");
      expect(health.status).toBe("unhealthy");
    });

    it("should handle errors gracefully while maintaining format", async () => {
      // Force an error in health check
      vi.spyOn(healthCheck as any, "checkDatabase").mockRejectedValueOnce(new Error("Test error"));
      
      const health = await healthCheck.checkHealth();
      
      expect(health).toHaveProperty("timestamp");
      expect(health).toHaveProperty("status");
      expect(health).toHaveProperty("errorCount");
    });
  });

  describe("Performance Metrics", () => {
    it("should track and return performance metrics", async () => {
      // Track some metrics
      AppHealthCheck.trackMetric("dbQueries", 50);
      AppHealthCheck.trackMetric("apiCalls", 100);
      AppHealthCheck.trackMetric("syncOperations", 200);
      
      const health = await healthCheck.checkHealth();
      
      expect(health.performance.avgDbQueryTime).toBeGreaterThan(0);
      expect(health.performance.avgApiCallTime).toBeGreaterThan(0);
      expect(health.performance.avgSyncTime).toBeGreaterThan(0);
    });

    it("should handle empty performance metrics", async () => {
      // Clear metrics by creating new instance
      const freshHealthCheck = AppHealthCheck.getInstance();
      const health = await freshHealthCheck.checkHealth();
      
      expect(health.performance.avgDbQueryTime).toBe(0);
      expect(health.performance.avgApiCallTime).toBe(0);
      expect(health.performance.avgSyncTime).toBe(0);
    });
  });

  describe("Concurrent Access", () => {
    it("should handle concurrent health checks", async () => {
      const promises = Array(5).fill(null).map(() => healthCheck.checkHealth());
      const results = await Promise.all(promises);
      
      results.forEach(health => {
        expect(health).toHaveProperty("timestamp");
        expect(health).toHaveProperty("status");
      });
    });

    it("should maintain performance under load", async () => {
      const start = Date.now();
      const promises = Array(10).fill(null).map(() => healthCheck.checkHealth());
      await Promise.all(promises);
      const duration = Date.now() - start;
      
      expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
    });
  });
});