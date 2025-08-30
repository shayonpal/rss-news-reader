import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Mock swagger-ui-react package
vi.mock("swagger-ui-react", () => ({
  default: vi.fn().mockReturnValue("SwaggerUI Component"),
  __esModule: true,
}));

// Mock the OpenAPI registry
vi.mock("@/lib/openapi/registry", () => ({
  generateOpenAPIDocument: vi.fn().mockReturnValue({
    openapi: "3.0.0",
    info: {
      title: "RSS Reader API",
      version: "1.0.0",
      description: "Health endpoints for RSS News Reader PWA",
    },
    servers: [
      {
        url: "http://100.96.166.53:3000/reader",
        description: "Development server",
      },
    ],
    paths: {
      "/api/health": {
        get: {
          summary: "Main health check",
          description: "Returns overall system health status",
          tags: ["Health"],
          operationId: "getHealthMain",
          responses: {
            "200": {
              description: "Health check successful",
              content: {
                "application/json": {
                  examples: {
                    healthy: {
                      value: {
                        status: "healthy",
                        timestamp: "2025-08-15T21:39:00.000Z",
                        services: {
                          app: "healthy",
                          database: "healthy",
                          sync: "healthy",
                        },
                      },
                    },
                  },
                },
              },
            },
            "500": {
              description: "Health check failed",
              content: {
                "application/json": {
                  examples: {
                    unhealthy: {
                      value: {
                        status: "unhealthy",
                        error: "Service unavailable",
                        timestamp: "2025-08-15T21:39:00.000Z",
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      "/api/health/app": { get: {} },
      "/api/health/db": { get: {} },
      "/api/health/cron": { get: {} },
      "/api/health/parsing": { get: {} },
      "/api/health/claude": { get: {} },
    },
  }),
}));

describe("/reader/api-docs Route (RR-200)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /reader/api-docs", () => {
    it("should return Swagger UI HTML page", async () => {
      // Test will fail until route is implemented
      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain("text/html");

      const html = await response.text();
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("Swagger UI");
      expect(html).toContain("RSS Reader API");
    });

    it("should include OpenAPI specification in the page", async () => {
      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);
      const html = await response.text();

      // Should embed the OpenAPI spec
      expect(html).toContain("openapi");
      expect(html).toContain("3.0.0");
      expect(html).toContain("/api/health");
      expect(html).toContain("Health endpoints");
    });

    it("should configure Swagger UI with correct base URL", async () => {
      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);
      const html = await response.text();

      // Should configure base URL for API calls
      expect(html).toContain("http://100.96.166.53:3000/reader");
    });

    it("should enable 'Try it out' functionality", async () => {
      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);
      const html = await response.text();

      // Should include configuration for interactive functionality
      expect(html).toContain("tryItOutEnabled");
      expect(html).toContain("true");
    });

    it("should include all 6 health endpoints in documentation", async () => {
      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);
      const html = await response.text();

      // All health endpoints must be documented
      expect(html).toContain("/api/health");
      expect(html).toContain("/api/health/app");
      expect(html).toContain("/api/health/db");
      expect(html).toContain("/api/health/cron");
      expect(html).toContain("/api/health/parsing");
      expect(html).toContain("/api/health/claude");
    });

    it("should set proper cache headers", async () => {
      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);

      // Should cache documentation appropriately
      expect(response.headers.get("cache-control")).toBeOneOf([
        "public, max-age=3600",
        "no-cache",
        "public, s-maxage=3600",
      ]);
    });
  });

  describe("OpenAPI JSON Endpoint", () => {
    it("should provide JSON endpoint for OpenAPI spec", async () => {
      // Test will fail until JSON endpoint is implemented
      const { GET } = await import("@/app/reader/api-docs/openapi.json/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs/openapi.json"
      );
      const response = await GET(request);

      expect(response.status).toBe(200);
      expect(response.headers.get("content-type")).toContain(
        "application/json"
      );

      const spec = await response.json();
      expect(spec).toMatchObject({
        openapi: "3.0.0",
        info: {
          title: "RSS Reader API",
          version: "1.0.0",
        },
        paths: expect.objectContaining({
          "/api/health": expect.any(Object),
          "/api/health/app": expect.any(Object),
          "/api/health/db": expect.any(Object),
          "/api/health/cron": expect.any(Object),
          "/api/health/parsing": expect.any(Object),
          "/api/health/claude": expect.any(Object),
        }),
      });
    });

    it("should include CORS headers for JSON endpoint", async () => {
      const { GET } = await import("@/app/reader/api-docs/openapi.json/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs/openapi.json"
      );
      const response = await GET(request);

      expect(response.headers.get("access-control-allow-origin")).toBe("*");
      expect(response.headers.get("access-control-allow-methods")).toContain(
        "GET"
      );
    });
  });

  describe("Swagger UI Components", () => {
    it("should render with proper layout configuration", async () => {
      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);
      const html = await response.text();

      // Should configure Swagger UI layout
      expect(html).toContain("layout");
      expect(html).toContain("BaseLayout");
    });

    it("should include custom CSS for RSS Reader branding", async () => {
      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);
      const html = await response.text();

      // Should include custom styling
      expect(html).toContain("<style>");
      expect(html).toContain("RSS Reader API");
    });

    it("should disable features not needed for health endpoints", async () => {
      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);
      const html = await response.text();

      // Should disable unnecessary features for MVP
      expect(html).toContain("supportedSubmitMethods");
      expect(html).toContain("docExpansion");
    });
  });

  describe("Error Handling", () => {
    it("should handle OpenAPI generation errors gracefully", async () => {
      // Mock registry to throw error
      vi.doMock("@/lib/openapi/registry", () => ({
        generateOpenAPIDocument: vi.fn().mockImplementation(() => {
          throw new Error("Registry error");
        }),
      }));

      const { GET } = await import("@/app/reader/api-docs/route");

      const request = new NextRequest(
        "http://100.96.166.53:3000/reader/api-docs"
      );
      const response = await GET(request);

      expect(response.status).toBeOneOf([500, 503]);
    });

    it("should return proper error page for invalid requests", async () => {
      const { GET } = await import("@/app/reader/api-docs/route");

      // Test with malformed request
      const request = new NextRequest("http://invalid-url");
      const response = await GET(request);

      expect(response.status).toBeOneOf([400, 404, 500]);
    });
  });
});
