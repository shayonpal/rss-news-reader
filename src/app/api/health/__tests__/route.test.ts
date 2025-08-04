/**
 * Unit Tests for Health API Route Handler (RR-120)
 * Tests the /api/health/app route to ensure proper response format
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { GET } from "../route";
import { appHealthCheck } from "@/lib/health/app-health-check";

// Mock the health check service
vi.mock("@/lib/health/app-health-check", () => ({
  appHealthCheck: {
    checkHealth: vi.fn()
  },
  AppHealthCheck: {
    logError: vi.fn()
  }
}));

// Get mocked instance
const mockHealthCheck = appHealthCheck as any;

describe("Health API Route Handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock response
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

  describe("Ping Parameter Response Format", () => {
    it("should return correct ping response format", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=true");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toEqual({
        status: "ok",
        ping: true
      });
    });

    it("should not call health check service for ping requests", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=true");
      
      await GET(request);
      
      expect(mockHealthCheck.checkHealth).not.toHaveBeenCalled();
    });

    it("should handle ping parameter case variations", async () => {
      const variations = ["true", "TRUE", "True"];
      
      for (const variation of variations) {
        const request = new NextRequest(`http://localhost:3000/api/health/app?ping=${variation}`);
        const response = await GET(request);
        const data = await response.json();
        
        if (variation === "true") {
          expect(data).toEqual({ status: "ok", ping: true });
        } else {
          // Only exact "true" should trigger ping mode
          expect(data).toHaveProperty("timestamp");
        }
      }
    });

    it("should ignore other query parameters in ping mode", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=true&other=value");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).toEqual({
        status: "ok", 
        ping: true
      });
    });
  });

  describe("Full Health Check Response Format", () => {
    it("should include timestamp in health response", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("status", "healthy");
      expect(data).toHaveProperty("service", "rss-reader-app");
    });

    it("should return complete health structure", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).toMatchObject({
        status: "healthy",
        service: "rss-reader-app", 
        uptime: expect.any(Number),
        lastActivity: expect.any(String),
        errorCount: expect.any(Number),
        timestamp: expect.any(String),
        dependencies: {
          database: "healthy",
          oauth: "healthy"
        },
        performance: {
          avgDbQueryTime: expect.any(Number),
          avgApiCallTime: expect.any(Number),
          avgSyncTime: expect.any(Number)
        }
      });
    });

    it("should call health check service for non-ping requests", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      await GET(request);
      
      expect(mockHealthCheck.checkHealth).toHaveBeenCalledOnce();
    });
  });

  describe("HTTP Status Code Handling", () => {
    it("should return 200 for healthy status", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "healthy",
        timestamp: "2025-01-02T20:00:00.000Z"
      });
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      
      expect(response.status).toBe(200);
    });

    it("should return 200 for degraded status", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "degraded",
        timestamp: "2025-01-02T20:00:00.000Z"
      });
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      
      expect(response.status).toBe(200);
    });

    it("should return 503 for unhealthy status", async () => {
      mockHealthCheck.checkHealth.mockResolvedValue({
        status: "unhealthy",
        timestamp: "2025-01-02T20:00:00.000Z"
      });
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      
      expect(response.status).toBe(503);
    });
  });

  describe("Error Handling", () => {
    it("should return 503 on health check failure", async () => {
      mockHealthCheck.checkHealth.mockRejectedValue(new Error("Health check failed"));
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      
      expect(response.status).toBe(503);
    });

    it("should return proper error response format", async () => {
      mockHealthCheck.checkHealth.mockRejectedValue(new Error("Database connection failed"));
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      const data = await response.json();
      
      expect(data).toMatchObject({
        status: "unhealthy",
        service: "rss-reader-app",
        uptime: 0,
        lastActivity: expect.any(String),
        errorCount: 1,
        dependencies: {
          database: "unknown",
          oauth: "unknown"
        },
        performance: {
          avgSyncTime: 0,
          avgDbQueryTime: 0,
          avgApiCallTime: 0
        },
        error: "Database connection failed"
      });
    });

    it("should handle unknown errors gracefully", async () => {
      mockHealthCheck.checkHealth.mockRejectedValue("Unknown error");
      
      const request = new NextRequest("http://localhost:3000/api/health/app");
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.error).toBe("Health check failed");
    });
  });

  describe("Response Consistency", () => {
    it("should return consistent timestamp format", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response = await GET(request);
      const data = await response.json();
      
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it("should maintain response structure across multiple calls", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app");
      
      const response1 = await GET(request);
      const response2 = await GET(request);
      
      const data1 = await response1.json();
      const data2 = await response2.json();
      
      expect(Object.keys(data1).sort()).toEqual(Object.keys(data2).sort());
    });
  });

  describe("Query Parameter Parsing", () => {
    it("should handle malformed URLs gracefully", async () => {
      // Test with various edge cases
      const testCases = [
        "http://localhost:3000/api/health/app?ping=",
        "http://localhost:3000/api/health/app?ping=false",
        "http://localhost:3000/api/health/app?ping=1",
        "http://localhost:3000/api/health/app?ping=yes"
      ];
      
      for (const url of testCases) {
        const request = new NextRequest(url);
        const response = await GET(request);
        
        expect(response.status).toBe(200);
        
        const data = await response.json();
        // Should NOT be ping response format
        expect(data).not.toEqual({ status: "ok", ping: true });
        expect(data).toHaveProperty("timestamp");
      }
    });

    it("should ignore multiple ping parameters", async () => {
      const request = new NextRequest("http://localhost:3000/api/health/app?ping=true&ping=false");
      
      const response = await GET(request);
      const data = await response.json();
      
      // Should respect first parameter
      expect(data).toEqual({
        status: "ok",
        ping: true
      });
    });
  });
});