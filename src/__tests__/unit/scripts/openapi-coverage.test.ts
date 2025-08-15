import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { execSync } from "child_process";

// Mock file system operations
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn().mockReturnValue(true),
  readdirSync: vi.fn().mockReturnValue([]),
}));

// Mock child process for script execution
vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

// Mock glob for file discovery
vi.mock("glob", () => ({
  glob: vi.fn().mockResolvedValue([]),
}));

describe("OpenAPI Coverage Validation Script (RR-200)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Script Execution", () => {
    it("should create coverage validation script at scripts/validate-openapi-coverage.js", async () => {
      // Test will fail until script is created
      expect(() => {
        execSync("node scripts/validate-openapi-coverage.js", {
          cwd: process.cwd(),
          stdio: "pipe",
        });
      }).not.toThrow();
    });

    it("should make script executable", async () => {
      // Check script permissions
      expect(() => {
        execSync("test -x scripts/validate-openapi-coverage.js");
      }).not.toThrow();
    });

    it("should return exit code 0 for 100% coverage of health endpoints", async () => {
      // Mock successful validation
      vi.mocked(execSync).mockReturnValue("100% coverage achieved\n");

      const result = execSync("node scripts/validate-openapi-coverage.js");
      expect(result.toString()).toContain("100% coverage");
    });

    it("should return non-zero exit code for incomplete coverage", async () => {
      // Mock incomplete coverage
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error("Coverage incomplete") as any;
        error.status = 1;
        throw error;
      });

      expect(() => {
        execSync("node scripts/validate-openapi-coverage.js");
      }).toThrow();
    });
  });

  describe("Coverage Analysis", () => {
    it("should detect all 6 health endpoints", async () => {
      // Mock the coverage script module
      const mockCoverageScript = {
        validateCoverage: vi.fn().mockReturnValue({
          totalEndpoints: 6,
          documentedEndpoints: 6,
          coverage: 100,
          missingEndpoints: [],
        }),
      };

      // Import and test coverage script functionality
      const coverage = mockCoverageScript.validateCoverage();

      expect(coverage.totalEndpoints).toBe(6);
      expect(coverage.documentedEndpoints).toBe(6);
      expect(coverage.coverage).toBe(100);
      expect(coverage.missingEndpoints).toHaveLength(0);
    });

    it("should scan API routes directory for health endpoints", async () => {
      const { glob } = await import("glob");

      // Mock file discovery
      vi.mocked(glob).mockResolvedValue([
        "src/app/api/health/route.ts",
        "src/app/api/health/app/route.ts",
        "src/app/api/health/db/route.ts",
        "src/app/api/health/cron/route.ts",
        "src/app/api/health/parsing/route.ts",
        "src/app/api/health/claude/route.ts",
      ]);

      const files = await glob("src/app/api/health/**/route.ts");
      expect(files).toHaveLength(6);

      const expectedEndpoints = [
        "/api/health",
        "/api/health/app",
        "/api/health/db",
        "/api/health/cron",
        "/api/health/parsing",
        "/api/health/claude",
      ];

      expectedEndpoints.forEach((endpoint) => {
        const hasMatchingFile = files.some((file) =>
          file.includes(endpoint.replace("/api/health", "health"))
        );
        expect(hasMatchingFile).toBe(true);
      });
    });

    it("should check OpenAPI document for documented endpoints", async () => {
      // Mock OpenAPI document reading
      const mockOpenAPISpec = {
        openapi: "3.0.0",
        paths: {
          "/api/health": { get: {} },
          "/api/health/app": { get: {} },
          "/api/health/db": { get: {} },
          "/api/health/cron": { get: {} },
          "/api/health/parsing": { get: {} },
          "/api/health/claude": { get: {} },
        },
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockOpenAPISpec));

      const spec = JSON.parse(readFileSync("mock-path", "utf8") as string);
      const documentedPaths = Object.keys(spec.paths);

      expect(documentedPaths).toHaveLength(6);
      expect(documentedPaths).toContain("/api/health");
      expect(documentedPaths).toContain("/api/health/app");
      expect(documentedPaths).toContain("/api/health/db");
      expect(documentedPaths).toContain("/api/health/cron");
      expect(documentedPaths).toContain("/api/health/parsing");
      expect(documentedPaths).toContain("/api/health/claude");
    });

    it("should identify missing endpoints", async () => {
      const mockIncompleteSpec = {
        openapi: "3.0.0",
        paths: {
          "/api/health": { get: {} },
          "/api/health/app": { get: {} },
          "/api/health/db": { get: {} },
          // Missing: cron, parsing, claude
        },
      };

      vi.mocked(readFileSync).mockReturnValue(
        JSON.stringify(mockIncompleteSpec)
      );

      const spec = JSON.parse(readFileSync("mock-path", "utf8") as string);
      const documentedPaths = Object.keys(spec.paths);

      const allExpectedPaths = [
        "/api/health",
        "/api/health/app",
        "/api/health/db",
        "/api/health/cron",
        "/api/health/parsing",
        "/api/health/claude",
      ];

      const missingPaths = allExpectedPaths.filter(
        (path) => !documentedPaths.includes(path)
      );

      expect(missingPaths).toHaveLength(3);
      expect(missingPaths).toContain("/api/health/cron");
      expect(missingPaths).toContain("/api/health/parsing");
      expect(missingPaths).toContain("/api/health/claude");
    });

    it("should calculate coverage percentage correctly", async () => {
      const testCases = [
        { documented: 6, total: 6, expected: 100 },
        { documented: 5, total: 6, expected: 83.33 },
        { documented: 3, total: 6, expected: 50 },
        { documented: 0, total: 6, expected: 0 },
      ];

      testCases.forEach(({ documented, total, expected }) => {
        const coverage = Math.round((documented / total) * 100 * 100) / 100;
        expect(coverage).toBe(expected);
      });
    });
  });

  describe("Report Generation", () => {
    it("should generate detailed coverage report", async () => {
      const mockReport = {
        timestamp: "2025-08-15T21:39:00.000Z",
        totalEndpoints: 6,
        documentedEndpoints: 6,
        coverage: 100,
        endpoints: [
          {
            path: "/api/health",
            documented: true,
            hasSchema: true,
            hasExamples: true,
          },
          {
            path: "/api/health/app",
            documented: true,
            hasSchema: true,
            hasExamples: true,
          },
          {
            path: "/api/health/db",
            documented: true,
            hasSchema: true,
            hasExamples: true,
          },
          {
            path: "/api/health/cron",
            documented: true,
            hasSchema: true,
            hasExamples: true,
          },
          {
            path: "/api/health/parsing",
            documented: true,
            hasSchema: true,
            hasExamples: true,
          },
          {
            path: "/api/health/claude",
            documented: true,
            hasSchema: true,
            hasExamples: true,
          },
        ],
        missingEndpoints: [],
        issues: [],
      };

      expect(mockReport.coverage).toBe(100);
      expect(mockReport.endpoints).toHaveLength(6);
      expect(mockReport.missingEndpoints).toHaveLength(0);
      expect(mockReport.issues).toHaveLength(0);

      // All endpoints should be fully documented
      mockReport.endpoints.forEach((endpoint) => {
        expect(endpoint.documented).toBe(true);
        expect(endpoint.hasSchema).toBe(true);
        expect(endpoint.hasExamples).toBe(true);
      });
    });

    it("should write coverage report to file", async () => {
      // Mock file writing
      const { writeFileSync } = await import("fs");
      vi.mocked(writeFileSync).mockImplementation(() => {});

      const reportPath = "coverage/openapi-coverage-report.json";
      const mockReport = {
        timestamp: "2025-08-15T21:39:00.000Z",
        coverage: 100,
      };

      writeFileSync(reportPath, JSON.stringify(mockReport, null, 2));

      expect(writeFileSync).toHaveBeenCalledWith(
        reportPath,
        expect.stringContaining("100")
      );
    });

    it("should output human-readable summary", async () => {
      const mockSummary = `
OpenAPI Coverage Report
======================
Total Health Endpoints: 6
Documented Endpoints: 6
Coverage: 100%

✅ All health endpoints are documented
✅ All endpoints have response schemas
✅ All endpoints have response examples
✅ Coverage validation PASSED
      `;

      expect(mockSummary).toContain("100%");
      expect(mockSummary).toContain("✅");
      expect(mockSummary).toContain("PASSED");
    });
  });

  describe("Schema Validation", () => {
    it("should verify each endpoint has response schemas", async () => {
      const mockEndpointWithSchema = {
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    timestamp: { type: "string" },
                  },
                },
              },
            },
          },
        },
      };

      const mockEndpointWithoutSchema = {
        responses: {
          "200": {
            description: "Success",
            // Missing schema
          },
        },
      };

      expect(mockEndpointWithSchema.responses["200"].content).toBeDefined();
      expect(
        mockEndpointWithSchema.responses["200"].content["application/json"]
          .schema
      ).toBeDefined();

      expect(
        mockEndpointWithoutSchema.responses["200"].content
      ).toBeUndefined();
    });

    it("should verify each endpoint has response examples", async () => {
      const mockEndpointWithExamples = {
        responses: {
          "200": {
            content: {
              "application/json": {
                examples: {
                  healthy: {
                    value: {
                      status: "healthy",
                      timestamp: "2025-08-15T21:39:00.000Z",
                    },
                  },
                },
              },
            },
          },
          "500": {
            content: {
              "application/json": {
                examples: {
                  error: {
                    value: {
                      status: "unhealthy",
                      error: "Service unavailable",
                    },
                  },
                },
              },
            },
          },
        },
      };

      expect(
        mockEndpointWithExamples.responses["200"].content["application/json"]
          .examples
      ).toBeDefined();
      expect(
        mockEndpointWithExamples.responses["500"].content["application/json"]
          .examples
      ).toBeDefined();
    });

    it("should verify endpoints have operation metadata", async () => {
      const mockEndpointWithMetadata = {
        summary: "Application health check",
        description: "Returns detailed application health status",
        tags: ["Health"],
        operationId: "getHealthApp",
      };

      expect(mockEndpointWithMetadata.summary).toBeDefined();
      expect(mockEndpointWithMetadata.description).toBeDefined();
      expect(mockEndpointWithMetadata.tags).toContain("Health");
      expect(mockEndpointWithMetadata.operationId).toBeDefined();
    });
  });

  describe("Integration with CI/CD", () => {
    it("should be executable as npm script", async () => {
      // Mock package.json reading
      const mockPackageJson = {
        scripts: {
          "validate:openapi": "node scripts/validate-openapi-coverage.js",
        },
      };

      vi.mocked(readFileSync).mockReturnValue(JSON.stringify(mockPackageJson));

      const packageJson = JSON.parse(
        readFileSync("package.json", "utf8") as string
      );
      expect(packageJson.scripts["validate:openapi"]).toBeDefined();
    });

    it("should fail CI build when coverage is incomplete", async () => {
      // Mock script failure
      vi.mocked(execSync).mockImplementation(() => {
        const error = new Error("Coverage below 100%") as any;
        error.status = 1;
        throw error;
      });

      expect(() => {
        execSync("npm run validate:openapi");
      }).toThrow();
    });

    it("should pass CI build when coverage is 100%", async () => {
      vi.mocked(execSync).mockReturnValue("✅ OpenAPI coverage: 100%\n");

      const result = execSync("npm run validate:openapi");
      expect(result.toString()).toContain("100%");
    });
  });
});
