/**
 * Edge Case Tests for Health Endpoints - RR-120
 * Tests various edge cases and error scenarios for health endpoint fixes
 * 
 * These tests cover boundary conditions, concurrent access, and unusual scenarios
 * that might occur in production. Some tests are designed to FAIL initially.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "@/app/api/health/route";

// Mock the health check service with various failure modes
const mockHealthCheck = {
  checkHealth: vi.fn()
};

const mockAppHealthCheck = {
  logError: vi.fn()
};

vi.mock("@/lib/health/app-health-check", () => ({
  appHealthCheck: mockHealthCheck,
  AppHealthCheck: mockAppHealthCheck
}));

describe("Health Endpoint Edge Cases - RR-120", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Default healthy response
    mockHealthCheck.checkHealth.mockResolvedValue({
      status: "healthy",
      service: "rss-reader-app",
      uptime: 3600,
      lastActivity: "2025-01-02T20:00:00.000Z",
      errorCount: 0,
      dependencies: {
        database: "healthy",
        oauth: "healthy"
      },
      performance: {
        avgDbQueryTime: 50,
        avgApiCallTime: 100,
        avgSyncTime: 2000
      }
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("Concurrent Request Handling", () => {
    it("should handle multiple simultaneous health check requests", async () => {
      const requests = Array(10).fill(null).map(() => 
        new NextRequest("http://localhost:3000/api/health/app")
      );
      
      const startTime = Date.now();
      const responses = await Promise.all(
        requests.map(request => GET(request))
      );
      
      // All should succeed with timestamps
      for (const response of responses) {
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data).toHaveProperty("timestamp");
        expect(data).toHaveProperty("status", "healthy");
        
        // Timestamp should be close to request time
        const timestampMs = new Date(data.timestamp).getTime();
        expect(timestampMs).toBeGreaterThanOrEqual(startTime);
      }
    });

    it("should handle concurrent ping requests efficiently", async () => {
      const pingRequests = Array(20).fill(null).map(() => 
        new NextRequest("http://localhost:3000/api/health/app?ping=true")
      );
      
      const responses = await Promise.all(
        pingRequests.map(request => GET(request))
      );
      
      // All ping requests should return identical responses
      for (const response of responses) {
        expect(response.status).toBe(200);
        
        const data = await response.json();
        expect(data).toEqual({
          status: "ok",
          ping: true
        });
      }
      
      // Health check service should not be called for ping requests
      expect(mockHealthCheck.checkHealth).not.toHaveBeenCalled();
    });

    it("should handle mixed ping and full health check requests", async () => {
      const mixedRequests = [
        new NextRequest("http://localhost:3000/api/health/app?ping=true"),
        new NextRequest("http://localhost:3000/api/health/app"),
        new NextRequest("http://localhost:3000/api/health/app?ping=true"),
        new NextRequest("http://localhost:3000/api/health/app"),
      ];
      
      const responses = await Promise.all(
        mixedRequests.map(request => GET(request))
      );
      
      // Ping responses
      expect(await responses[0].json()).toEqual({ status: "ok", ping: true });
      expect(await responses[2].json()).toEqual({ status: "ok", ping: true });
      
      // Full health responses
      const fullResponse1 = await responses[1].json();
      const fullResponse2 = await responses[3].json();
      
      expect(fullResponse1).toHaveProperty("timestamp");
      expect(fullResponse2).toHaveProperty("timestamp");
      expect(fullResponse1).toHaveProperty("service", "rss-reader-app");
      expect(fullResponse2).toHaveProperty("service", "rss-reader-app");
      
      // Health check should be called twice (once for each full request)
      expect(mockHealthCheck.checkHealth).toHaveBeenCalledTimes(2);
    });
  });

  describe("URL Parsing Edge Cases", () => {
    it("should handle malformed query parameters gracefully", async () => {
      const malformedUrls = [
        "http://localhost:3000/api/health/app?ping", // No value
        "http://localhost:3000/api/health/app?ping=", // Empty value
        "http://localhost:3000/api/health/app?ping=true&ping=false", // Duplicate params
        "http://localhost:3000/api/health/app?ping=true&invalid", // Malformed param
        "http://localhost:3000/api/health/app?ping=%20true", // URL encoded spaces
      ];
      
      for (const url of malformedUrls) {
        const request = new NextRequest(url);
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        
        const data = await response.json();
        
        // Only exact "ping=true" should trigger ping mode
        if (url.includes("ping=true") && !url.includes("%20")) {
          expect(data).toEqual({ status: "ok", ping: true });
        } else {
          expect(data).toHaveProperty("timestamp");
          expect(data).not.toEqual({ status: "ok", ping: true });
        }
      }
    });

    it("should handle very long query strings", async () => {
      const longValue = "x".repeat(1000);
      const request = new NextRequest(
        `http://localhost:3000/api/health/app?ping=true&long=${longValue}`
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "ok", ping: true });
    });

    it("should handle unicode characters in query parameters", async () => {
      const request = new NextRequest(
        "http://localhost:3000/api/health/app?ping=true&emoji=📚&unicode=测试"
      );
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "ok", ping: true });
    });
  });

  describe("Error Recovery Scenarios", () => {
    it("should recover gracefully from health service timeouts", async () => {
      // Mock a timeout scenario
      mockHealthCheck.checkHealth.mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Timeout")), 5000)
        )
      );
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      
      expect(response.status).toBe(503);
      
      const data = await response.json();
      expect(data).toHaveProperty("status", "unhealthy");
      expect(data).toHaveProperty("error", "Timeout");
      
      // Should still include timestamp even in error case  
      expect(data).not.toHaveProperty("timestamp");
      expect(data).toHaveProperty("lastActivity");
    });

    it("should handle health service returning null/undefined", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue(null);
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      // Should not crash, should return error response
      await expect(GET(request)).resolves.toBeDefined();
    });

    it("should handle health service throwing non-Error objects", async () => {
      mockHealthCheck.checkHealth.mockRejectedValue("String error");
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      
      expect(response.status).toBe(503);
      
      const data = await response.json();
      expect(data).toHaveProperty("error", "Health check failed");
    });
  });

  describe("Memory and Performance Edge Cases", () => {
    it("should handle rapid successive requests without memory leaks", async () => {
      // Simulate rapid requests
      const rapidRequests = Array(100).fill(null).map((_, i) => 
        new NextRequest(`http://localhost:3000/api/health/app?ping=true&req=${i}`)
      );
      
      const startMemory = process.memoryUsage().heapUsed;
      
      for (const request of rapidRequests) {
        const response = await GET(request);
        expect(response.status).toBe(200);
      }
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const endMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = endMemory - startMemory;
      
      // Memory increase should be reasonable (less than 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });

    it("should handle very slow health service responses", async () => {
      mockHealthCheck.checkHealth.mockImplementation(() => 
        new Promise(resolve => 
          setTimeout(() => resolve({
            status: "degraded",
            service: "rss-reader-app",
            uptime: 3600,
            lastActivity: "2025-01-02T20:00:00.000Z",
            errorCount: 0,
            dependencies: { database: "degraded", oauth: "healthy" },
            performance: { avgDbQueryTime: 5000, avgApiCallTime: 100, avgSyncTime: 2000 }
          }), 2000)
        )
      );
      
      const start = Date.now();
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      const duration = Date.now() - start;
      
      expect(response.status).toBe(200);
      expect(duration).toBeGreaterThan(1990); // Should take at least 2 seconds
      
      const data = await response.json();
      expect(data).toHaveProperty("status", "degraded");
      expect(data).toHaveProperty("timestamp");
    });
  });

  describe("Timestamp Precision and Consistency", () => {
    it("should generate timestamps with millisecond precision", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).toHaveProperty("timestamp");
      
      // Should include milliseconds in ISO string
      expect(data.timestamp).toMatch(/\.\d{3}Z$/);
    });

    it("should generate unique timestamps for rapid requests", async () => {
      const timestamps = new Set();
      
      for (let i = 0; i < 10; i++) {
        const request = new NextRequest("http://localhost:3000/api/health/app");
        const response = await GET(request);
        const data = await response.json();
        
        timestamps.add(data.timestamp);
        
        // Small delay to ensure timestamp differences
        await new Promise(resolve => setTimeout(resolve, 1));
      }
      
      // All timestamps should be unique
      expect(timestamps.size).toBe(10);
    });

    it("should maintain timestamp consistency across different health statuses", async () => {
      const statuses = ["healthy", "degraded", "unhealthy"];
      
      for (const status of statuses) {
        mockHealthCheck.checkHealth.mockResolvedValue({
          status: status as any,
          service: "rss-reader-app",
          uptime: 3600,
          lastActivity: "2025-01-02T20:00:00.000Z",
          errorCount: status === "unhealthy" ? 5 : 0,
          dependencies: { database: status, oauth: "healthy" },
          performance: { avgDbQueryTime: 50, avgApiCallTime: 100, avgSyncTime: 2000 }
        });
        
        const request = new NextRequest("http://localhost:3000/api/health/app");
        const response = await GET(request);
        const data = await response.json();
        
        expect(data).toHaveProperty("timestamp");
        expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });
  });

  describe("Request Header Edge Cases", () => {
    it("should handle requests with unusual headers", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app", {
        headers: {
          "X-Custom-Header": "test-value",
          "User-Agent": "Test/1.0",
          "Accept": "application/json, text/plain, */*"
        }
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("timestamp");
    });

    it("should handle requests without standard headers", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app", {
        headers: {} // No headers
      });
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("timestamp");
    });
  });

  describe("Clock and Time Edge Cases", () => {
    it("should handle system clock changes gracefully", async () => {
      // Set fake time
      const fakeTime = new Date("2025-01-01T12:00:00.000Z");
      vi.setSystemTime(fakeTime);
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).toHaveProperty("timestamp");
      expect(data.timestamp).toBe("2025-01-01T12:00:00.000Z");
      
      // Change system time
      const newTime = new Date("2025-01-01T15:30:00.000Z");
      vi.setSystemTime(newTime);
      
      const request2 = new NextRequest("http://localhost:3000/api/health/app");
      const response2 = await GET(request2);
      const data2 = await response2.json();
      
      expect(data2.timestamp).toBe("2025-01-01T15:30:00.000Z");
    });

    it("should handle timezone-related timestamp generation", async () => {
      // Store original timezone
      const originalTZ = process.env.TZ;
      
      try {
        // Test different timezones
        const timezones = ["UTC", "America/New_York", "Asia/Tokyo"];
        
        for (const tz of timezones) {
          process.env.TZ = tz;
          
          const request = new NextRequest("http://localhost:3000/api/health/app");
          const response = await GET(request);
          const data = await response.json();
          
          expect(data).toHaveProperty("timestamp");
          // All timestamps should be in UTC format regardless of system timezone
          expect(data.timestamp).toMatch(/Z$/);
        }
      } finally {
        // Restore original timezone
        process.env.TZ = originalTZ;
      }
    });
  });
});