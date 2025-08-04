/**
 * Unit Tests for RR-115: Error Response Validation for 503 Status Scenarios
 * 
 * These tests verify that health endpoints properly handle:
 * 1. HTTP 503 Service Unavailable status codes for critical failures
 * 2. HTTP 200 OK with degraded status for non-critical issues
 * 3. Proper error message formatting and debugging information
 * 4. Consistent error responses across different failure types
 * 5. Error recovery and state transitions
 * 
 * RED PHASE: These tests will FAIL initially and guide implementation fixes.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET as healthAppGET } from "@/app/api/health/route";
import { GET as healthDbGET } from "@/app/api/health/db/route";

// Mock dependencies
vi.mock("@/lib/health/app-health-check", () => ({
  appHealthCheck: {
    checkHealth: vi.fn()
  },
  AppHealthCheck: {
    logError: vi.fn()
  }
}));

vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn()
  }
}));

vi.mock("@/lib/utils/environment", () => ({
  isTestEnvironment: vi.fn(),
  getEnvironmentInfo: vi.fn()
}));

vi.mock("@/lib/utils/version", () => ({
  getAppVersion: vi.fn()
}));

import { appHealthCheck, AppHealthCheck } from "@/lib/health/app-health-check";
import { supabase } from "@/lib/db/supabase";
import { isTestEnvironment, getEnvironmentInfo } from "@/lib/utils/environment";
import { getAppVersion } from "@/lib/utils/version";

describe("RR-115: Error Response Validation for 503 Status Scenarios", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mocks
    (getAppVersion as any).mockResolvedValue("1.0.0");
    (getEnvironmentInfo as any).mockReturnValue({
      environment: "test",
      nodeEnv: "test"
    });
    (isTestEnvironment as any).mockReturnValue(false); // Test real scenarios
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("App Health Endpoint Error Responses", () => {
    it("should return 503 Service Unavailable when app health check reports unhealthy status", async () => {
      // Mock unhealthy app state
      (appHealthCheck.checkHealth as any).mockResolvedValue({
        status: "unhealthy",
        service: "rss-reader-app",
        uptime: 3600,
        lastActivity: new Date().toISOString(),
        errorCount: 5,
        dependencies: {
          database: "error",
          oauth: "error"
        },
        performance: {
          avgSyncTime: 0,
          avgDbQueryTime: 0,
          avgApiCallTime: 0
        }
      });

      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await healthAppGET(request);
      const data = await response.json();

      // RR-115: Should return 503 for unhealthy status
      expect(response.status).toBe(503);
      expect(data).toHaveProperty("status", "unhealthy");
      expect(data).toHaveProperty("service", "rss-reader-app");
      expect(data).toHaveProperty("dependencies");
      expect(data).toHaveProperty("version", "1.0.0");
      expect(data).toHaveProperty("timestamp");
      
      // Should include error details
      expect(data.dependencies.database).toBe("error");
      expect(data.dependencies.oauth).toBe("error");
      
      console.log(`✓ App health correctly returned 503 for unhealthy status`);
    });

    it("should return 200 OK when app health check reports degraded status", async () => {
      // Mock degraded app state
      (appHealthCheck.checkHealth as any).mockResolvedValue({
        status: "degraded",
        service: "rss-reader-app",
        uptime: 3600,
        lastActivity: new Date().toISOString(),
        errorCount: 2,
        dependencies: {
          database: "slow",
          oauth: "connected"
        },
        performance: {
          avgSyncTime: 8000, // Slow but functional
          avgDbQueryTime: 2000,
          avgApiCallTime: 1500
        }
      });

      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await healthAppGET(request);
      const data = await response.json();

      // RR-115: Should return 200 for degraded status (still functional)
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status", "degraded");
      expect(data).toHaveProperty("service", "rss-reader-app");
      expect(data).toHaveProperty("version", "1.0.0");
      
      // Should show performance issues
      expect(data.performance.avgSyncTime).toBe(8000);
      expect(data.dependencies.database).toBe("slow");
      
      console.log(`✓ App health correctly returned 200 for degraded status`);
    });

    it("should return 503 Service Unavailable when health check throws an error", async () => {
      // Mock health check failure
      const criticalError = new Error("Critical service failure");
      (appHealthCheck.checkHealth as any).mockRejectedValue(criticalError);

      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await healthAppGET(request);
      const data = await response.json();

      // RR-115: Should return 503 when health check fails
      expect(response.status).toBe(503);
      expect(data).toHaveProperty("status", "unhealthy");
      expect(data).toHaveProperty("service", "rss-reader-app");
      expect(data).toHaveProperty("error", "Critical service failure");
      expect(data).toHaveProperty("version", "1.0.0");
      expect(data).toHaveProperty("timestamp");
      
      // Should have default error state values
      expect(data.uptime).toBe(0);
      expect(data.errorCount).toBe(1);
      expect(data.dependencies.database).toBe("unknown");
      expect(data.dependencies.oauth).toBe("unknown");
      
      // Should log the error
      expect(AppHealthCheck.logError).toHaveBeenCalledWith(
        expect.stringContaining("Critical service failure")
      );
      
      console.log(`✓ App health correctly returned 503 for health check error`);
    });

    it("should handle version retrieval errors gracefully in error responses", async () => {
      // Mock version retrieval failure
      (getAppVersion as any).mockRejectedValue(new Error("Version file not found"));
      
      // Mock app health failure
      (appHealthCheck.checkHealth as any).mockRejectedValue(new Error("Service down"));

      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await healthAppGET(request);
      const data = await response.json();

      // RR-115: Should still return 503 with fallback version
      expect(response.status).toBe(503);
      expect(data).toHaveProperty("status", "unhealthy");
      expect(data).toHaveProperty("version", "0.0.0-error"); // Fallback version
      expect(data).toHaveProperty("error", "Service down");
      
      console.log(`✓ App health handled version error gracefully`);
    });

    it("should return proper error response for ping requests during failures", async () => {
      // Mock critical failure that affects even ping
      (getAppVersion as any).mockRejectedValue(new Error("File system error"));

      const request = new NextRequest("http://localhost:3000/api/health/app?ping=true");
      const response = await healthAppGET(request);
      const data = await response.json();

      // RR-115: Ping should still work despite errors (minimal format)
      expect(response.status).toBe(200); // Ping should always return 200 if possible
      expect(data).toHaveProperty("status", "ok");
      expect(data).toHaveProperty("ping", true);
      // Ping response should be minimal - no version field
      
      console.log(`✓ Ping endpoint worked despite version error`);
    });
  });

  describe("Database Health Endpoint Error Responses", () => {
    it("should return 503 Service Unavailable when database connection fails", async () => {
      // Mock database connection failure
      const dbError = new Error("Connection pool exhausted");
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: dbError
          })
        })
      });

      const response = await healthDbGET();
      const data = await response.json();

      // RR-115: Should return 503 for database connection failure
      expect(response.status).toBe(503);
      expect(data).toHaveProperty("status", "unhealthy");
      expect(data).toHaveProperty("database", "error");
      expect(data).toHaveProperty("connection", "error"); // RR-114 alias
      expect(data).toHaveProperty("message", "Database query failed");
      expect(data).toHaveProperty("error", "Connection pool exhausted");
      expect(data).toHaveProperty("timestamp");
      
      // Should have query time information
      expect(data).toHaveProperty("queryTime");
      expect(typeof data.queryTime).toBe("number");
      expect(data.queryTime).toBeGreaterThanOrEqual(0);
      
      console.log(`✓ DB health correctly returned 503 for connection failure`);
    });

    it("should return 200 OK with degraded status when database is slow", async () => {
      // Mock slow database response
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockImplementation(() => 
            new Promise(resolve => 
              setTimeout(() => resolve({ data: [{ id: 1 }], error: null }), 6000)
            )
          )
        })
      });

      const startTime = Date.now();
      const response = await healthDbGET();
      const responseTime = Date.now() - startTime;
      const data = await response.json();

      // RR-115: Should return 200 with degraded status for slow response
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status", "degraded");
      expect(data).toHaveProperty("database", "slow");
      expect(data).toHaveProperty("connection", "slow"); // RR-114 alias
      expect(data).toHaveProperty("message", "Database responding slowly");
      
      // Should reflect the slow query time
      expect(data.queryTime).toBeGreaterThan(5000); // Greater than 5 seconds
      expect(responseTime).toBeGreaterThan(5000);
      
      console.log(`✓ DB health correctly returned 200 degraded for slow response (${data.queryTime}ms)`);
    }, 10000); // Increase timeout for slow test

    it("should return 503 Service Unavailable when database query throws exception", async () => {
      // Mock database query exception
      const dbException = new Error("Database server unavailable");
      (supabase.from as any).mockImplementation(() => {
        throw dbException;
      });

      const response = await healthDbGET();
      const data = await response.json();

      // RR-115: Should return 503 for database exceptions
      expect(response.status).toBe(503);
      expect(data).toHaveProperty("status", "unhealthy");
      expect(data).toHaveProperty("database", "error");
      expect(data).toHaveProperty("connection", "error"); // RR-114 alias
      expect(data).toHaveProperty("message", "Failed to check database health");
      expect(data).toHaveProperty("error", "Database server unavailable");
      
      // Should have timing information even for failed requests
      expect(data).toHaveProperty("queryTime");
      expect(typeof data.queryTime).toBe("number");
      
      console.log(`✓ DB health correctly returned 503 for database exception`);
    });

    it("should return 200 OK for test environment with unavailable database", async () => {
      // Mock test environment
      (isTestEnvironment as any).mockReturnValue(true);

      const response = await healthDbGET();
      const data = await response.json();

      // RR-115: Test environment should return 200 OK with unavailable status
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status", "healthy");
      expect(data).toHaveProperty("database", "unavailable");
      expect(data).toHaveProperty("connection", "unavailable"); // RR-114 alias
      expect(data).toHaveProperty("message", "Database health check skipped in test environment");
      
      // Should have environment information
      expect(data).toHaveProperty("environment");
      expect(data).toHaveProperty("timestamp");
      
      console.log(`✓ DB health correctly handled test environment`);
    });

    it("should validate error response consistency across multiple failures", async () => {
      const errorScenarios = [
        {
          name: "connection-timeout",
          mockError: new Error("Connection timeout"),
          expectedStatus: 503,
          expectedDatabase: "error"
        },
        {
          name: "authentication-failure",
          mockError: new Error("Authentication failed"),
          expectedStatus: 503,
          expectedDatabase: "error"
        },
        {
          name: "permission-denied",
          mockError: new Error("Permission denied"),
          expectedStatus: 503,
          expectedDatabase: "error"
        }
      ];

      for (const scenario of errorScenarios) {
        vi.clearAllMocks();
        (getEnvironmentInfo as any).mockReturnValue({ environment: "test" });
        (isTestEnvironment as any).mockReturnValue(false);
        
        // Mock the specific error
        (supabase.from as any).mockReturnValue({
          select: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: null,
              error: scenario.mockError
            })
          })
        });

        const response = await healthDbGET();
        const data = await response.json();

        // Validate consistent error response format
        expect(response.status).toBe(scenario.expectedStatus);
        expect(data).toHaveProperty("status", "unhealthy");
        expect(data).toHaveProperty("database", scenario.expectedDatabase);
        expect(data).toHaveProperty("connection", scenario.expectedDatabase);
        expect(data).toHaveProperty("error", scenario.mockError.message);
        expect(data).toHaveProperty("timestamp");
        expect(data).toHaveProperty("queryTime");
        
        console.log(`✓ Scenario ${scenario.name}: HTTP ${response.status}, database=${data.database}`);
      }
    });
  });

  describe("Error Response Format Validation", () => {
    it("should provide consistent error response structure across endpoints", async () => {
      // Mock failures for both endpoints
      (appHealthCheck.checkHealth as any).mockRejectedValue(new Error("App service failed"));
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("DB service failed")
          })
        })
      });
      (isTestEnvironment as any).mockReturnValue(false);

      // Test both endpoints
      const appRequest = new NextRequest("http://localhost:3000/api/health/app");
      const [appResponse, dbResponse] = await Promise.all([
        healthAppGET(appRequest),
        healthDbGET()
      ]);
      
      const [appData, dbData] = await Promise.all([
        appResponse.json(),
        dbResponse.json()
      ]);

      // Both should return 503
      expect(appResponse.status).toBe(503);
      expect(dbResponse.status).toBe(503);
      
      // Both should have consistent error structure
      const commonFields = ["status", "timestamp", "error"];
      
      commonFields.forEach(field => {
        expect(appData).toHaveProperty(field);
        expect(dbData).toHaveProperty(field);
      });
      
      // Both should have unhealthy status
      expect(appData.status).toBe("unhealthy");
      expect(dbData.status).toBe("unhealthy");
      
      // App-specific fields
      expect(appData).toHaveProperty("service");
      expect(appData).toHaveProperty("version");
      expect(appData).toHaveProperty("dependencies");
      
      // DB-specific fields
      expect(dbData).toHaveProperty("database", "error");
      expect(dbData).toHaveProperty("connection", "error");
      expect(dbData).toHaveProperty("queryTime");
      
      console.log(`✓ Consistent error response structure validated`);
    });

    it("should include proper HTTP headers for error responses", async () => {
      // Mock unhealthy app state
      (appHealthCheck.checkHealth as any).mockResolvedValue({
        status: "unhealthy",
        service: "rss-reader-app",
        uptime: 0,
        lastActivity: new Date().toISOString(),
        errorCount: 1,
        dependencies: { database: "error", oauth: "error" },
        performance: { avgSyncTime: 0, avgDbQueryTime: 0, avgApiCallTime: 0 }
      });
      
      // Mock database error
      (supabase.from as any).mockReturnValue({
        select: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({
            data: null,
            error: new Error("Database error")
          })
        })
      });
      (isTestEnvironment as any).mockReturnValue(false);

      const appRequest = new NextRequest("http://localhost:3000/api/health/app");
      const [appResponse, dbResponse] = await Promise.all([
        healthAppGET(appRequest),
        healthDbGET()
      ]);

      // Check response headers
      const appHeaders = Object.fromEntries(appResponse.headers.entries());
      const dbHeaders = Object.fromEntries(dbResponse.headers.entries());
      
      // Should have proper content type
      expect(appHeaders['content-type']).toContain('application/json');
      expect(dbHeaders['content-type']).toContain('application/json');
      
      // DB endpoint should have cache control headers
      expect(dbHeaders['cache-control']).toBe('no-store, max-age=0');
      
      console.log(`✓ Proper HTTP headers included in error responses`);
    });

    it("should provide debugging information in error responses", async () => {
      // Mock detailed error scenario
      const detailedError = new Error("Detailed error message");
      detailedError.stack = "Error: Detailed error message\n    at test:1:1";
      
      (appHealthCheck.checkHealth as any).mockRejectedValue(detailedError);

      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await healthAppGET(request);
      const data = await response.json();

      // Should include debugging information
      expect(response.status).toBe(503);
      expect(data).toHaveProperty("error", "Detailed error message");
      expect(data).toHaveProperty("service", "rss-reader-app");
      expect(data).toHaveProperty("timestamp");
      
      // Should have proper error metadata
      expect(data.errorCount).toBe(1);
      expect(data.uptime).toBe(0);
      
      // Should log error for debugging
      expect(AppHealthCheck.logError).toHaveBeenCalledWith(
        expect.stringContaining("Detailed error message")
      );
      
      console.log(`✓ Debugging information included in error response`);
    });
  });

  describe("Error Recovery and State Transitions", () => {
    it("should transition from error state to healthy state correctly", async () => {
      // First request - simulate error
      (appHealthCheck.checkHealth as any).mockRejectedValue(new Error("Temporary failure"));
      
      const request1 = new NextRequest("http://localhost:3000/api/health/app");
      const response1 = await healthAppGET(request1);
      const data1 = await response1.json();
      
      expect(response1.status).toBe(503);
      expect(data1.status).toBe("unhealthy");
      
      // Second request - simulate recovery
      vi.clearAllMocks();
      (getAppVersion as any).mockResolvedValue("1.0.0");
      (appHealthCheck.checkHealth as any).mockResolvedValue({
        status: "healthy",
        service: "rss-reader-app",
        uptime: 3600,
        lastActivity: new Date().toISOString(),
        errorCount: 0,
        dependencies: {
          database: "connected",
          oauth: "connected"
        },
        performance: {
          avgSyncTime: 2000,
          avgDbQueryTime: 150,
          avgApiCallTime: 300
        }
      });
      
      const request2 = new NextRequest("http://localhost:3000/api/health/app");
      const response2 = await healthAppGET(request2);
      const data2 = await response2.json();
      
      // Should transition to healthy
      expect(response2.status).toBe(200);
      expect(data2.status).toBe("healthy");
      expect(data2.dependencies.database).toBe("connected");
      expect(data2.dependencies.oauth).toBe("connected");
      
      console.log(`✓ Successfully transitioned from error to healthy state`);
    });

    it("should handle partial recovery scenarios correctly", async () => {
      // Mock partial recovery - database recovered but oauth still failing
      (appHealthCheck.checkHealth as any).mockResolvedValue({
        status: "degraded",
        service: "rss-reader-app",
        uptime: 1800,
        lastActivity: new Date().toISOString(),
        errorCount: 1,
        dependencies: {
          database: "connected",
          oauth: "error"
        },
        performance: {
          avgSyncTime: 4000, // Slower due to oauth issues
          avgDbQueryTime: 200,
          avgApiCallTime: 0 // Not working
        }
      });
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await healthAppGET(request);
      const data = await response.json();
      
      // Should return 200 OK but with degraded status
      expect(response.status).toBe(200);
      expect(data.status).toBe("degraded");
      expect(data.dependencies.database).toBe("connected");
      expect(data.dependencies.oauth).toBe("error");
      expect(data.errorCount).toBe(1);
      
      console.log(`✓ Correctly handled partial recovery scenario`);
    });
  });
});
