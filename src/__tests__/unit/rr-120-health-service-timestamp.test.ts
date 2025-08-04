/**
 * Unit Tests for Health Service Timestamp Generation - RR-120
 * Tests that the AppHealthCheck service properly handles timestamp generation
 * 
 * This test validates that health service works correctly with route-level timestamp generation.
 * Some tests are designed to FAIL initially since the fixes haven't been implemented yet.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { AppHealthCheck } from "@/lib/health/app-health-check";
import type { SystemHealth } from "@/types/health";
import * as fs from "fs/promises";
import { createClient } from "@supabase/supabase-js";

// Mock fs/promises for log file operations
vi.mock("fs/promises", () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  appendFile: vi.fn().mockResolvedValue(undefined),
  access: vi.fn().mockResolvedValue(undefined),
  readFile: vi.fn().mockResolvedValue('{"encrypted": true}'),
  stat: vi.fn().mockResolvedValue({
    mtime: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
  })
}));

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn().mockReturnThis(),
    select: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: { key: "test" }, error: null })
  }))
}));

// Get mocked instances
const mockFs = fs as any;
const mockSupabaseQuery = (createClient as any)();

describe("Health Service Timestamp Generation - RR-120", () => {
  let healthService: AppHealthCheck;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Reset environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
    process.env.HOME = "/Users/shayon";
    
    // Get fresh instance
    healthService = AppHealthCheck.getInstance();
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("SystemHealth Response Structure", () => {
    it("should return SystemHealth object without timestamp field", async () => {
      // Mock successful database and OAuth checks
      mockSupabaseQuery.single.mockResolvedValue({ 
        data: { key: "test" }, 
        error: null 
      });
      
      const result = await healthService.checkHealth();
      
      // Verify it returns SystemHealth structure
      expect(result).toMatchObject({
        status: expect.any(String),
        service: "rss-reader-app",
        uptime: expect.any(Number),
        lastActivity: expect.any(String),
        errorCount: expect.any(Number),
        dependencies: expect.any(Object),
        performance: expect.any(Object)
      });
      
      // Health service should NOT include timestamp - that's handled by route
      expect(result).not.toHaveProperty("timestamp");
    });

    it("should include lastActivity as ISO string but not timestamp", async () => {
      mockSupabaseQuery.single.mockResolvedValue({ 
        data: { key: "test" }, 
        error: null 
      });
      
      const result = await healthService.checkHealth();
      
      expect(result.lastActivity).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(result).not.toHaveProperty("timestamp");
    });

    it("should calculate uptime correctly", async () => {
      mockSupabaseQuery.single.mockResolvedValue({ 
        data: { key: "test" }, 
        error: null 
      });
      
      const result = await healthService.checkHealth();
      
      expect(result.uptime).toBeGreaterThan(0);
      expect(typeof result.uptime).toBe("number");
    });
  });

  describe("Health Status Calculation", () => {
    it("should return healthy status when all dependencies are healthy", async () => {
      // Mock healthy database
      mockSupabaseQuery.single.mockResolvedValue({ 
        data: { key: "test" }, 
        error: null 
      });
      
      // Mock healthy OAuth tokens
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue('{"encrypted": true}');
      
      const result = await healthService.checkHealth();
      
      expect(result.status).toBe("healthy");
      expect(result.dependencies.database).toBe("healthy");
      expect(result.dependencies.oauth).toBe("healthy");
    });

    it("should return degraded status when OAuth tokens are expiring", async () => {
      // Healthy database
      mockSupabaseQuery.single.mockResolvedValue({ 
        data: { key: "test" }, 
        error: null 
      });
      
      // OAuth tokens expiring soon (20 days old)
      mockFs.stat.mockResolvedValue({
        mtime: new Date(Date.now() - 345 * 24 * 60 * 60 * 1000) // 345 days ago (20 days left)
      });
      
      const result = await healthService.checkHealth();
      
      expect(result.status).toBe("degraded");
      expect(result.dependencies.oauth).toBe("degraded");
    });

    it("should return unhealthy status when database fails", async () => {
      // Database failure
      mockSupabaseQuery.single.mockResolvedValue({ 
        data: null, 
        error: { message: "Connection failed" }
      });
      
      const result = await healthService.checkHealth();
      
      expect(result.status).toBe("unhealthy");
      expect(result.dependencies.database).toBe("unhealthy");
    });
  });

  describe("Error Handling", () => {
    it("should handle database connectivity errors gracefully", async () => {
      mockSupabaseQuery.single.mockRejectedValue(new Error("Network error"));
      
      const result = await healthService.checkHealth();
      
      expect(result.status).toBe("unhealthy");
      expect(result.dependencies.database).toBe("unhealthy");
      expect(result.errorCount).toBeGreaterThan(0);
    });

    it("should handle OAuth file system errors", async () => {
      // Database healthy
      mockSupabaseQuery.single.mockResolvedValue({ 
        data: { key: "test" }, 
        error: null 
      });
      
      // OAuth file missing
      mockFs.access.mockRejectedValue(new Error("File not found"));
      
      const result = await healthService.checkHealth();
      
      expect(result.status).toBe("unhealthy");
      expect(result.dependencies.oauth).toBe("unhealthy");
    });

    it("should track performance metrics correctly", async () => {
      // Simulate slow database response
      mockSupabaseQuery.single.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({ data: { key: "test" }, error: null }), 100)
        )
      );
      
      const result = await healthService.checkHealth();
      
      expect(result.performance.avgDbQueryTime).toBeGreaterThan(0);
      expect(typeof result.performance.avgDbQueryTime).toBe("number");
    });
  });

  describe("Static Methods", () => {
    it("should track performance metrics via static method", () => {
      const initialInstance = AppHealthCheck.getInstance();
      
      AppHealthCheck.trackMetric("dbQueries", 150);
      AppHealthCheck.trackMetric("apiCalls", 200);
      AppHealthCheck.trackMetric("syncOperations", 5000);
      
      // Should not throw and should track metrics internally
      expect(() => AppHealthCheck.trackMetric("dbQueries", 100)).not.toThrow();
    });

    it("should log errors via static method", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      
      AppHealthCheck.logError("Test error message");
      
      // Should not throw
      expect(() => AppHealthCheck.logError("Another error")).not.toThrow();
      
      consoleSpy.mockRestore();
    });
  });

  describe("Service Dependencies", () => {
    it("should properly check database with real Supabase client setup", async () => {
      // Verify environment variables are used
      expect(process.env.NEXT_PUBLIC_SUPABASE_URL).toBeDefined();
      expect(process.env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
      
      const result = await healthService.checkHealth();
      
      expect(result.dependencies).toHaveProperty("database");
      expect(result.dependencies).toHaveProperty("oauth");
    });

    it("should check OAuth tokens from correct file path", async () => {
      await healthService.checkHealth();
      
      // Verify it checks the expected path
      expect(mockFs.access).toHaveBeenCalledWith(
        expect.stringContaining(".rss-reader/tokens.json")
      );
    });

    it("should validate OAuth token encryption", async () => {
      // Mock unencrypted tokens
      mockFs.readFile.mockResolvedValue('{"access_token": "plaintext"}');
      
      const result = await healthService.checkHealth();
      
      expect(result.dependencies.oauth).toBe("unhealthy");
    });
  });

  describe("Logging and Monitoring", () => {
    it("should log health check results to JSONL file", async () => {
      await healthService.checkHealth();
      
      expect(mockFs.mkdir).toHaveBeenCalledWith(
        expect.stringContaining("logs"),
        { recursive: true }
      );
      expect(mockFs.appendFile).toHaveBeenCalledWith(
        expect.stringContaining("health-checks.jsonl"),
        expect.stringMatching(/^{.*}\n$/)
      );
    });

    it("should handle log file write failures gracefully", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFs.appendFile.mockRejectedValue(new Error("Disk full"));
      
      // Should still complete health check even if logging fails
      const result = await healthService.checkHealth();
      
      expect(result).toBeDefined();
      expect(result.status).toBeDefined();
      
      consoleSpy.mockRestore();
    });
  });

  describe("Singleton Pattern", () => {
    it("should return the same instance across multiple calls", () => {
      const instance1 = AppHealthCheck.getInstance();
      const instance2 = AppHealthCheck.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it("should maintain state across instance calls", async () => {
      // Track a metric
      AppHealthCheck.trackMetric("dbQueries", 123);
      
      // Get instance and check health
      const instance = AppHealthCheck.getInstance();
      const result = await instance.checkHealth();
      
      // Performance metrics should reflect tracked data
      expect(result.performance).toBeDefined();
    });
  });
});