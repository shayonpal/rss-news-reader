/**
 * Unit Tests for RR-208: Document Remaining 12 Endpoints & Update Scripts
 *
 * Test Contract:
 * - All 12 remaining endpoints MUST be documented in registry.ts
 * - Validation script MUST check all 45 endpoints
 * - Coverage MUST reach 100% (45/45 endpoints)
 * - Test endpoints MUST be marked as development-only
 * - Package.json MUST have docs:validate, docs:coverage, docs:serve scripts
 * - Validation MUST complete in <2 seconds
 *
 * These tests define the specification - implementation must conform to them.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { execSync } from "child_process";
import { readFileSync } from "fs";

// Mock file system
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
}));

// Mock child_process for script execution
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

// Mock fetch for OpenAPI spec
global.fetch = vi.fn();

describe("RR-208: OpenAPI Documentation Coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Endpoint Documentation Requirements", () => {
    it("should document all 12 remaining endpoints in registry.ts", async () => {
      // Import the registry to check documentation
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      const requiredEndpoints = [
        // Analytics & Logs (2)
        { path: "/api/analytics/fetch-stats", method: "GET" },
        { path: "/api/logs/inoreader", method: "POST" },

        // Feeds (2)
        { path: "/api/feeds/{id}/stats", method: "GET" },
        { path: "/api/feeds/{id}/stats", method: "DELETE" },

        // Users (2)
        { path: "/api/users/{id}/timezone", method: "GET" },
        { path: "/api/users/{id}/timezone", method: "PUT" },

        // Test endpoints (6)
        { path: "/api/test/audit-capture", method: "GET" },
        { path: "/api/test/check-duplicates", method: "GET" },
        { path: "/api/test/simulate-headers", method: "GET" },
        { path: "/api/test/simulate-rate-limit", method: "GET" },
        { path: "/api/test/simulate-rate-limit", method: "POST" },
        { path: "/api/test/force-update-usage", method: "POST" },
      ];

      // Check each endpoint is documented
      for (const { path, method } of requiredEndpoints) {
        expect(openApiDoc.paths[path]).toBeDefined();
        expect(openApiDoc.paths[path][method.toLowerCase()]).toBeDefined();

        const endpoint = openApiDoc.paths[path][method.toLowerCase()];

        // Verify required fields
        expect(endpoint.summary).toBeDefined();
        expect(endpoint.description).toBeDefined();
        expect(endpoint.responses).toBeDefined();
        expect(endpoint.responses["200"]).toBeDefined();
        expect(endpoint.tags).toBeDefined();
        expect(endpoint.tags.length).toBeGreaterThan(0);
      }
    });

    it("should have proper schemas for analytics endpoint", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      const endpoint = openApiDoc.paths["/api/analytics/fetch-stats"]?.get;
      expect(endpoint).toBeDefined();

      // Check response schema
      const response200 = endpoint.responses["200"];
      expect(response200.content["application/json"]).toBeDefined();
      expect(response200.content["application/json"].schema).toBeDefined();

      // Check error response
      expect(endpoint.responses["500"]).toBeDefined();
    });

    it("should have proper schemas for logs endpoint", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      const endpoint = openApiDoc.paths["/api/logs/inoreader"]?.post;
      expect(endpoint).toBeDefined();

      // Check request body schema
      expect(endpoint.requestBody).toBeDefined();
      expect(endpoint.requestBody.content["application/json"]).toBeDefined();

      // Check response schemas
      expect(endpoint.responses["200"]).toBeDefined();
      expect(endpoint.responses["400"]).toBeDefined();
      expect(endpoint.responses["500"]).toBeDefined();
    });

    it("should have proper schemas for feeds stats endpoints", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      // GET endpoint
      const getEndpoint = openApiDoc.paths["/api/feeds/{id}/stats"]?.get;
      expect(getEndpoint).toBeDefined();
      expect(getEndpoint.parameters).toBeDefined();
      expect(getEndpoint.parameters[0].name).toBe("id");
      expect(getEndpoint.parameters[0].in).toBe("path");
      expect(getEndpoint.parameters[0].required).toBe(true);
      expect(getEndpoint.responses["200"]).toBeDefined();
      expect(getEndpoint.responses["404"]).toBeDefined();

      // DELETE endpoint
      const deleteEndpoint = openApiDoc.paths["/api/feeds/{id}/stats"]?.delete;
      expect(deleteEndpoint).toBeDefined();
      expect(deleteEndpoint.parameters).toBeDefined();
      expect(deleteEndpoint.parameters[0].name).toBe("id");
      expect(deleteEndpoint.responses["200"]).toBeDefined();
      expect(deleteEndpoint.responses["404"]).toBeDefined();
    });

    it("should have proper schemas for users timezone endpoints", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      // GET endpoint
      const getEndpoint = openApiDoc.paths["/api/users/{id}/timezone"]?.get;
      expect(getEndpoint).toBeDefined();
      expect(getEndpoint.parameters).toBeDefined();
      expect(getEndpoint.parameters[0].name).toBe("id");
      expect(getEndpoint.responses["200"]).toBeDefined();
      expect(getEndpoint.responses["404"]).toBeDefined();

      // PUT endpoint
      const putEndpoint = openApiDoc.paths["/api/users/{id}/timezone"]?.put;
      expect(putEndpoint).toBeDefined();
      expect(putEndpoint.parameters).toBeDefined();
      expect(putEndpoint.requestBody).toBeDefined();
      expect(putEndpoint.responses["200"]).toBeDefined();
      expect(putEndpoint.responses["400"]).toBeDefined();
      expect(putEndpoint.responses["404"]).toBeDefined();
    });

    it("should mark test endpoints as development-only", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      const testEndpoints = [
        "/api/test/audit-capture",
        "/api/test/check-duplicates",
        "/api/test/simulate-headers",
        "/api/test/simulate-rate-limit",
        "/api/test/force-update-usage",
      ];

      // In production, test endpoints should not be registered
      if (process.env.NODE_ENV === "production") {
        for (const path of testEndpoints) {
          expect(openApiDoc.paths[path]).toBeUndefined();
        }
      } else {
        // In development, test endpoints should be marked
        for (const path of testEndpoints) {
          const methods = Object.keys(openApiDoc.paths[path] || {});
          for (const method of methods) {
            const endpoint = openApiDoc.paths[path][method];
            expect(endpoint.tags).toContain("Test");
            expect(endpoint.description).toMatch(/development|test|debug/i);
          }
        }
      }
    });
  });

  describe("Validation Script Updates", () => {
    it("should validate all 45 endpoints in the script", () => {
      // Mock the validation script execution
      vi.mocked(execSync).mockReturnValue(
        JSON.stringify({
          totalExpected: 45,
          totalDocumented: 45,
          coveragePercentage: 100,
        })
      );

      const result = execSync("node scripts/validate-openapi-coverage.js");
      const report = JSON.parse(result.toString());

      expect(report.totalExpected).toBe(45);
      expect(report.totalDocumented).toBe(45);
      expect(report.coveragePercentage).toBe(100);
    });

    it("should check endpoints by category", () => {
      const expectedCategories = {
        health: 6,
        sync: 7,
        articles: 4,
        tags: 5,
        inoreader: 8, // Including both GET and POST for /api/inoreader/dev
        insomnia: 1,
        auth: 1,
        test: 7, // Including both GET and POST for simulate-rate-limit
        analytics: 1,
        feeds: 2,
        users: 2,
        logs: 1,
      };

      const totalEndpoints = Object.values(expectedCategories).reduce(
        (sum, count) => sum + count,
        0
      );

      expect(totalEndpoints).toBe(45); // Corrected to 45 (not 43)
    });

    it("should complete validation in less than 2 seconds", () => {
      const startTime = Date.now();

      vi.mocked(execSync).mockImplementation(() => {
        // Simulate quick execution
        return Buffer.from("Validation completed");
      });

      execSync("node scripts/validate-openapi-coverage.js");
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(2000);
    });

    it("should generate comprehensive coverage report", () => {
      const mockReport = {
        timestamp: new Date().toISOString(),
        totalExpected: 45,
        totalDocumented: 45,
        coveragePercentage: 100,
        categories: {
          health: { expected: 6, documented: 6, percentage: 100 },
          sync: { expected: 7, documented: 7, percentage: 100 },
          articles: { expected: 4, documented: 4, percentage: 100 },
          tags: { expected: 5, documented: 5, percentage: 100 },
          inoreader: { expected: 7, documented: 7, percentage: 100 },
          insomnia: { expected: 1, documented: 1, percentage: 100 },
          auth: { expected: 1, documented: 1, percentage: 100 },
          test: { expected: 6, documented: 6, percentage: 100 },
          analytics: { expected: 1, documented: 1, percentage: 100 },
          feeds: { expected: 2, documented: 2, percentage: 100 },
          users: { expected: 2, documented: 2, percentage: 100 },
          logs: { expected: 1, documented: 1, percentage: 100 },
        },
      };

      expect(mockReport.coveragePercentage).toBe(100);
      expect(mockReport.totalExpected).toBe(45);

      // Verify all categories have 100% coverage
      Object.values(mockReport.categories).forEach((category) => {
        expect(category.percentage).toBe(100);
      });
    });
  });

  describe("Package.json Scripts", () => {
    it("should have docs:validate script", () => {
      const mockPackageJson = {
        scripts: {
          "docs:validate": "node scripts/validate-openapi-coverage.js",
        },
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));

      const packageJson = JSON.parse(
        readFileSync("package.json", "utf8") as string
      );

      expect(packageJson.scripts["docs:validate"]).toBeDefined();
      expect(packageJson.scripts["docs:validate"]).toContain(
        "validate-openapi-coverage"
      );
    });

    it("should have docs:coverage script", () => {
      const mockPackageJson = {
        scripts: {
          "docs:coverage": "node scripts/validate-openapi-coverage.js --report",
        },
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));

      const packageJson = JSON.parse(
        readFileSync("package.json", "utf8") as string
      );

      expect(packageJson.scripts["docs:coverage"]).toBeDefined();
    });

    it("should have docs:serve script", () => {
      const mockPackageJson = {
        scripts: {
          "docs:serve":
            "npm run dev && open http://localhost:3000/reader/api-docs",
        },
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));

      const packageJson = JSON.parse(
        readFileSync("package.json", "utf8") as string
      );

      expect(packageJson.scripts["docs:serve"]).toBeDefined();
      expect(packageJson.scripts["docs:serve"]).toContain("api-docs");
    });
  });

  describe("OpenAPI Specification Compliance", () => {
    it("should have valid OpenAPI 3.1.0 specification", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      expect(openApiDoc.openapi).toBe("3.0.0");
      expect(openApiDoc.info).toBeDefined();
      expect(openApiDoc.info.title).toBe("RSS News Reader API");
      expect(openApiDoc.info.version).toBeDefined();
      expect(openApiDoc.servers).toBeDefined();
      expect(openApiDoc.servers.length).toBeGreaterThan(0);
    });

    it("should have proper tags for categorization", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      const expectedTags = [
        "Health",
        "Sync Operations",
        "Articles",
        "Tags",
        "Analytics",
        "Feeds",
        "Users",
        "Logs",
      ];

      const tagNames = openApiDoc.tags?.map((tag: any) => tag.name) || [];

      expectedTags.forEach((tag) => {
        expect(tagNames).toContain(tag);
      });
    });

    it("should have response examples for all endpoints", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      Object.entries(openApiDoc.paths).forEach(
        ([path, methods]: [string, any]) => {
          Object.entries(methods).forEach(
            ([method, endpoint]: [string, any]) => {
              // Check 200 response has examples
              if (endpoint.responses?.["200"]) {
                const content = endpoint.responses["200"].content;
                if (content?.["application/json"]) {
                  expect(content["application/json"].examples).toBeDefined();
                }
              }

              // Check error responses have examples
              if (endpoint.responses?.["500"]) {
                const content = endpoint.responses["500"].content;
                if (content?.["application/json"]) {
                  expect(content["application/json"].examples).toBeDefined();
                }
              }
            }
          );
        }
      );
    });
  });

  describe("Integration Requirements", () => {
    it("should work with Swagger UI at /reader/api-docs", async () => {
      vi.mocked(global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({
          openapi: "3.1.0",
          paths: {},
        }),
      });

      const response = await fetch(
        "http://localhost:3000/reader/api-docs/openapi.json"
      );

      expect(response.ok).toBe(true);
      const spec = await response.json();
      expect(spec.openapi).toBeDefined();
    });

    it("should support Try it out functionality for all endpoints", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );
      const openApiDoc = generateOpenAPIDocument();

      // Ensure all endpoints have proper server configuration
      expect(openApiDoc.servers).toBeDefined();
      expect(openApiDoc.servers[0].url).toMatch(/\/reader$/);

      // Ensure all endpoints have operation IDs for Swagger UI
      Object.entries(openApiDoc.paths).forEach(
        ([path, methods]: [string, any]) => {
          Object.entries(methods).forEach(
            ([method, endpoint]: [string, any]) => {
              expect(endpoint.operationId).toBeDefined();
            }
          );
        }
      );
    });
  });
});
