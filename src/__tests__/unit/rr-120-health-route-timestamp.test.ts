/**
 * Unit Tests for Health Route Handler - RR-120 Timestamp Field
 * Tests that health endpoint includes timestamp field at root level
 * 
 * This test is designed to FAIL initially (red phase) since the fix hasn't been implemented yet.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock health check service
vi.mock("@/lib/health/app-health-check", () => {
  const mockHealthCheck = {
    checkHealth: vi.fn()
  };
  
  const mockAppHealthCheck = {
    logError: vi.fn()
  };
  
  return {
    appHealthCheck: mockHealthCheck,
    AppHealthCheck: mockAppHealthCheck
  };
});

describe("Health Route Handler - RR-120 Timestamp Field", () => {
  let GET: any;
  let mockHealthCheck: any;
  let mockAppHealthCheck: any;

  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Re-import the module to get fresh instances
    const healthModule = await import("@/lib/health/app-health-check");
    mockHealthCheck = healthModule.appHealthCheck;
    mockAppHealthCheck = healthModule.AppHealthCheck;
    
    const routeModule = await import("@/app/api/health/route");
    GET = routeModule.GET;
    
    // Default mock response with timestamp (after fix)
    mockHealthCheck.checkHealth.mockResolvedValue({
      status: "healthy",
      service: "rss-reader-app",
      uptime: 3600,
      lastActivity: "2025-01-02T20:00:00.000Z",
      errorCount: 0,
      timestamp: new Date().toISOString(),
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

  describe("Root Level Timestamp Field - RR-120 Issue 1", () => {
    it("should include timestamp field at root level in health response", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      
      // This test should FAIL initially because timestamp is missing at root level
      expect(data).toHaveProperty("timestamp");
      expect(typeof data.timestamp).toBe("string");
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should have timestamp at same level as status and service fields", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("service");
      expect(data).toHaveProperty("timestamp"); // Should be at same level
      
      // Verify structure - these should all be at root level
      const rootLevelFields = Object.keys(data);
      expect(rootLevelFields).toContain("timestamp");
      expect(rootLevelFields).toContain("status");
      expect(rootLevelFields).toContain("service");
    });

    it("should have timestamp generated server-side, not from health service", async () => {
      const beforeRequest = new Date();
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      const data = await response.json();
      
      const afterRequest = new Date();
      
      expect(data).toHaveProperty("timestamp");
      
      const timestampDate = new Date(data.timestamp);
      expect(timestampDate.getTime()).toBeGreaterThanOrEqual(beforeRequest.getTime());
      expect(timestampDate.getTime()).toBeLessThanOrEqual(afterRequest.getTime());
    });

    it("should maintain timestamp field even when health service returns error", async () => {
      mockHealthCheck.checkHealth.mockRejectedValue(new Error("Database connection failed"));
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(503);
      
      // Timestamp should still be included in error response
      expect(data).toHaveProperty("timestamp");
      expect(typeof data.timestamp).toBe("string");
    });
  });

  describe("Ping Response Format - RR-120 Issue 2", () => {
    it("should return correct ping response format with timestamp", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=true");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      
      // This test should FAIL initially because current implementation returns wrong format
      expect(data).toEqual({
        status: "ok",
        ping: true
      });
      
      // Should NOT include timestamp in ping response
      expect(data).not.toHaveProperty("timestamp");
    });

    it("should not include additional fields in ping response", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=true");
      
      const response = await GET(request);
      const data = await response.json();
      
      const expectedKeys = ["status", "ping"];
      const actualKeys = Object.keys(data);
      
      expect(actualKeys.sort()).toEqual(expectedKeys.sort());
      
      // Verify exact values
      expect(data.status).toBe("ok");
      expect(data.ping).toBe(true);
    });

    it("should differentiate ping response from full health response", async () => {
      // Test full health check
      const fullRequest = new NextRequest("http://localhost:3000/api/health/app");
      const fullResponse = await GET(fullRequest);
      const fullData = await fullResponse.json();
      
      // Test ping
      const pingRequest = new NextRequest("http://localhost:3000/api/health/app?ping=true");
      const pingResponse = await GET(pingRequest);
      const pingData = await pingResponse.json();
      
      // Full response should have timestamp
      expect(fullData).toHaveProperty("timestamp");
      expect(fullData).toHaveProperty("service");
      expect(fullData).toHaveProperty("uptime");
      
      // Ping response should be minimal
      expect(pingData).toEqual({
        status: "ok",
        ping: true
      });
      
      expect(pingData).not.toHaveProperty("timestamp");
      expect(pingData).not.toHaveProperty("service");
      expect(pingData).not.toHaveProperty("uptime");
    });
  });

  describe("Response Consistency", () => {
    it("should generate new timestamp for each request", async () => {
      const request1 = new NextRequest("http://localhost:3000/api/health/app");
      const request2 = new NextRequest("http://localhost:3000/api/health/app");
      
      const response1 = await GET(request1);
      const data1 = await response1.json();
      
      // Small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const response2 = await GET(request2);
      const data2 = await response2.json();
      
      expect(data1).toHaveProperty("timestamp");
      expect(data2).toHaveProperty("timestamp");
      expect(data1.timestamp).not.toBe(data2.timestamp);
    });

    it("should maintain ISO 8601 timestamp format consistently", async () => {
      const requests = Array(5).fill(null).map(() => 
        new NextRequest("http://localhost:3000/api/health/app")
      );
      
      for (const request of requests) {
        const response = await GET(request);
        const data = await response.json();
        
        expect(data).toHaveProperty("timestamp");
        expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle multiple query parameters while maintaining ping format", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=true&extra=value&debug=1");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).toEqual({
        status: "ok",
        ping: true
      });
    });

    it("should handle ping parameter case sensitivity correctly", async () => {
      const testCases = [
        { param: "ping=true", shouldBePing: true },
        { param: "ping=TRUE", shouldBePing: false },
        { param: "ping=True", shouldBePing: false },
        { param: "ping=1", shouldBePing: false },
        { param: "ping=yes", shouldBePing: false }
      ];
      
      for (const testCase of testCases) {
        const request = new NextRequest(`http://localhost:3000/api/health/app?${testCase.param}`);
        const response = await GET(request);
        const data = await response.json();
        
        if (testCase.shouldBePing) {
          expect(data).toEqual({
            status: "ok",
            ping: true
          });
        } else {
          expect(data).toHaveProperty("timestamp");
          expect(data).not.toEqual({
            status: "ok",
            ping: true
          });
        }
      }
    });
  });
});