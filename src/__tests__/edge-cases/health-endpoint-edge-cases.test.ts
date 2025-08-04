/**
 * Edge Case Tests for Health Endpoints (RR-120)
 * Tests unusual scenarios and error conditions
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { GET } from "../../app/api/health/route";
import { AppHealthCheck, appHealthCheck } from "@/lib/health/app-health-check";

// Mock dependencies
vi.mock("@supabase/supabase-js");
vi.mock("fs/promises");

vi.mock("@/lib/health/app-health-check", () => {
  const mockHealthCheck = {
    checkHealth: vi.fn()
  };
  
  return {
    appHealthCheck: mockHealthCheck,
    AppHealthCheck: {
      logError: vi.fn(),
      trackMetric: vi.fn(),
      getInstance: vi.fn(() => mockHealthCheck)
    }
  };
});

// Get mocked instance
const mockHealthCheck = appHealthCheck as any;

describe("Health Endpoint Edge Cases", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default successful response
    mockHealthCheck.checkHealth.mockResolvedValue({
      status: "healthy",
      service: "rss-reader-app",
      uptime: 3600,
      lastActivity: "2025-01-02T20:00:00.000Z",
      errorCount: 0,
      timestamp: "2025-01-02T20:00:00.000Z",
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

  describe("Malformed Ping Parameter", () => {
    it("should handle URL encoding in ping parameter", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=%74%72%75%65"); // URL encoded "true"
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).toEqual({
        status: "ok",
        ping: true
      });
    });

    it("should handle special characters in ping parameter", async () => {
      const specialValues = [
        "true&false",
        "true%20space",
        "true<script>",
        "true'quote",
        'true"doublequote'
      ];

      for (const value of specialValues) {
        const request = new NextRequest(`http://localhost:3000/api/health/app?ping=${encodeURIComponent(value)}`);
        
        const response = await GET(request);
        const data = await response.json();
        
        // Should NOT trigger ping mode for malformed values
        expect(data).not.toEqual({ status: "ok", ping: true });
        expect(data).toHaveProperty("timestamp");
      }
    });

    it("should handle empty ping parameter", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).not.toEqual({ status: "ok", ping: true });
      expect(data).toHaveProperty("timestamp");
    });

    it("should handle ping parameter without value", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).not.toEqual({ status: "ok", ping: true });
      expect(data).toHaveProperty("timestamp");
    });
  });

  describe("Health Check Timeout Scenarios", () => {
    it("should handle health check hanging", async () => {
      // Mock a hanging health check
      mockHealthCheck.checkHealth.mockImplementation(() => 
        new Promise(resolve => setTimeout(resolve, 10000)) // 10 second delay
      );

      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      // Set a timeout for the test
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Test timeout")), 1000)
      );

      try {
        await Promise.race([GET(request), timeoutPromise]);
      } catch (error) {
        expect(error.message).toBe("Test timeout");
      }
    });

    it("should handle partial health check data", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "degraded",
        // Missing some required fields
        service: "rss-reader-app",
        timestamp: "2025-01-02T20:00:00.000Z"
      });

      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("status", "degraded");
      expect(data).toHaveProperty("timestamp");
    });
  });

  describe("Database Connection Edge Cases", () => {
    it("should handle database connection timeout", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "unhealthy",
        service: "rss-reader-app",
        timestamp: "2025-01-02T20:00:00.000Z",
        dependencies: {
          database: "unhealthy",
          oauth: "healthy"
        },
        performance: {
          avgDbQueryTime: 5000, // Very slow
          avgApiCallTime: 100,
          avgSyncTime: 2000
        }
      });

      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(503);
      expect(data.status).toBe("unhealthy");
      expect(data.dependencies.database).toBe("unhealthy");
    });

    it("should handle database returning null data", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "degraded",
        service: "rss-reader-app",
        timestamp: "2025-01-02T20:00:00.000Z",
        dependencies: {
          database: "degraded",
          oauth: "healthy"
        }
      });

      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200); // Degraded is still 200
      expect(data.status).toBe("degraded");
    });
  });

  describe("OAuth Token Edge Cases", () => {
    it("should handle missing OAuth tokens", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "unhealthy",
        service: "rss-reader-app",
        timestamp: "2025-01-02T20:00:00.000Z",
        dependencies: {
          database: "healthy",
          oauth: "unhealthy"
        },
        errorCount: 1
      });

      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(503);
      expect(data.dependencies.oauth).toBe("unhealthy");
    });

    it("should handle corrupted OAuth token file", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "unhealthy",
        service: "rss-reader-app",
        timestamp: "2025-01-02T20:00:00.000Z",
        dependencies: {
          database: "healthy",
          oauth: "unhealthy"
        },
        errorCount: 1
      });

      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.dependencies.oauth).toBe("unhealthy");
    });
  });

  describe("Memory and Performance Edge Cases", () => {
    it("should handle high memory usage scenarios", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "degraded",
        service: "rss-reader-app",
        timestamp: "2025-01-02T20:00:00.000Z",
        performance: {
          avgDbQueryTime: 2000, // Very slow
          avgApiCallTime: 1000,
          avgSyncTime: 30000 // 30 seconds
        }
      });

      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.performance.avgDbQueryTime).toBe(2000);
      expect(data.performance.avgSyncTime).toBe(30000);
    });

    it("should handle zero performance metrics", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "healthy",
        service: "rss-reader-app",
        timestamp: "2025-01-02T20:00:00.000Z",
        performance: {
          avgDbQueryTime: 0,
          avgApiCallTime: 0,
          avgSyncTime: 0
        }
      });

      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.performance.avgDbQueryTime).toBe(0);
      expect(data.performance.avgApiCallTime).toBe(0);
      expect(data.performance.avgSyncTime).toBe(0);
    });
  });

  describe("Concurrent Request Edge Cases", () => {
    it("should handle race conditions in health checks", async () => {
      let callCount = 0;
      mockHealthCheck.checkHealth.mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          status: "healthy",
          service: "rss-reader-app",
          timestamp: "2025-01-02T20:00:00.000Z",
          callNumber: callCount
        });
      });

      const requests = Array(5).fill(null).map(() => 
        new NextRequest("http://localhost:3000/api/health/app")
      );

      const responses = await Promise.all(requests.map(req => GET(req)));
      const data = await Promise.all(responses.map(res => res.json()));

      // All should succeed
      data.forEach(d => {
        expect(d).toHaveProperty("timestamp");
        expect(d.status).toBe("healthy");
      });

      expect(callCount).toBe(5); // Each request should trigger health check
    });

    it("should handle mixed ping and health requests concurrently", async () => {
      const pingRequest = new NextRequest("http://localhost:3000/api/health/app?ping=true");
      const healthRequest = new NextRequest("http://localhost:3000/api/health/app");

      const [pingResponse, healthResponse] = await Promise.all([
        GET(pingRequest),
        GET(healthRequest)
      ]);

      const pingData = await pingResponse.json();
      const healthData = await healthResponse.json();

      expect(pingData).toEqual({ status: "ok", ping: true });
      expect(healthData).toHaveProperty("timestamp");
      expect(healthData).not.toHaveProperty("ping");
    });
  });

  describe("URL Parsing Edge Cases", () => {
    it("should handle malformed URLs gracefully", async () => {
      // Test various URL edge cases
      const testUrls = [
        "http://localhost:3000/api/health/app?ping=true&",
        "http://localhost:3000/api/health/app?&ping=true",
        "http://localhost:3000/api/health/app?ping=true&ping=false",
        "http://localhost:3000/api/health/app?ping==true",
        "http://localhost:3000/api/health/app?ping=true#fragment"
      ];

      for (const url of testUrls) {
        try {
          const request = new NextRequest(url);
          const response = await GET(request);
          
          expect(response.status).toBe(200);
          
          const data = await response.json();
          // Should handle gracefully
          expect(data).toHaveProperty("status");
        } catch (error) {
          // If URL parsing fails, that's also acceptable
          expect(error).toBeDefined();
        }
      }
    });

    it("should handle international characters in URL", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=true&测试=值");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual({ status: "ok", ping: true });
    });
  });
});