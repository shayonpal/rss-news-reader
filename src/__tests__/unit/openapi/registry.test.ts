import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock OpenAPI packages that will be installed
vi.mock("@asteasolutions/zod-to-openapi", () => ({
  OpenAPIRegistry: vi.fn().mockImplementation(() => ({
    registerPath: vi.fn(),
    registerComponent: vi.fn(),
    register: vi.fn((name, schema) => schema),
    buildDocument: vi.fn().mockReturnValue({
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
      paths: {},
    }),
    definitions: [],
  })),
  OpenApiGeneratorV3: vi.fn().mockImplementation(() => ({
    generateDocument: vi.fn(),
  })),
  extendZodWithOpenApi: vi.fn(),
}));

vi.mock("zod", () => {
  const createSchema = () => ({
    extend: vi.fn(() => createSchema()),
    optional: vi.fn(() => createSchema()),
    nullable: vi.fn(() => createSchema()),
    openapi: vi.fn(() => createSchema()),
  });

  return {
    z: {
      object: vi.fn(() => createSchema()),
      string: vi.fn(() => createSchema()),
      number: vi.fn(() => createSchema()),
      boolean: vi.fn(() => createSchema()),
      enum: vi.fn(() => createSchema()),
      array: vi.fn(() => createSchema()),
    },
  };
});

describe("OpenAPI Registry (RR-200)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Registry Initialization", () => {
    it("should create OpenAPI registry with correct configuration", async () => {
      // Test will fail until src/lib/openapi/registry.ts is implemented
      const { registry } = await import("@/lib/openapi/registry");

      expect(registry).toBeDefined();
      expect(typeof registry.registerPath).toBe("function");
      expect(typeof registry.registerComponent).toBe("function");
      expect(typeof registry.buildDocument).toBe("function");
    });

    it("should export health endpoint schemas", async () => {
      // Test will fail until schemas are defined
      const schemas = await import("@/lib/openapi/registry");

      // Each health endpoint must have a schema
      expect(schemas.healthMainSchema).toBeDefined();
      expect(schemas.healthAppSchema).toBeDefined();
      expect(schemas.healthDbSchema).toBeDefined();
      expect(schemas.healthCronSchema).toBeDefined();
      expect(schemas.healthParsingSchema).toBeDefined();
      expect(schemas.healthClaudeSchema).toBeDefined();
    });

    it("should generate complete OpenAPI document with all 6 health endpoints", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );

      const document = generateOpenAPIDocument();

      expect(document).toMatchObject({
        openapi: "3.0.0",
        info: {
          title: "RSS Reader API",
          version: "1.0.0",
          description: expect.stringContaining("Health endpoints"),
        },
        servers: [
          {
            url: "http://100.96.166.53:3000/reader",
            description: "Development server",
          },
        ],
      });

      // Must include all 6 health endpoints
      expect(document.paths).toHaveProperty("/api/health");
      expect(document.paths).toHaveProperty("/api/health/app");
      expect(document.paths).toHaveProperty("/api/health/db");
      expect(document.paths).toHaveProperty("/api/health/cron");
      expect(document.paths).toHaveProperty("/api/health/parsing");
      expect(document.paths).toHaveProperty("/api/health/claude");
    });
  });

  describe("Health Endpoint Schemas", () => {
    it("should define schema for /api/health endpoint", async () => {
      const { healthMainSchema } = await import("@/lib/openapi/registry");

      // Schema must include all required properties
      expect(healthMainSchema).toBeDefined();

      // Test schema structure matches expected response
      const mockResponse = {
        status: "healthy",
        timestamp: "2025-08-15T21:39:00.000Z",
        services: {
          app: "healthy",
          database: "healthy",
          sync: "healthy",
        },
      };

      // Schema should validate this structure
      expect(() => healthMainSchema.parse(mockResponse)).not.toThrow();
    });

    it("should define schema for /api/health/app endpoint", async () => {
      const { healthAppSchema } = await import("@/lib/openapi/registry");

      expect(healthAppSchema).toBeDefined();

      const mockResponse = {
        status: "healthy",
        service: "rss-reader-app",
        version: "1.0.0",
        uptime: 100,
        environment: "test",
        dependencies: {
          database: "healthy",
          oauth: "healthy",
        },
        performance: {
          avgSyncTime: 100,
          avgDbQueryTime: 50,
          avgApiCallTime: 150,
        },
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthAppSchema.parse(mockResponse)).not.toThrow();
    });

    it("should define schema for /api/health/db endpoint", async () => {
      const { healthDbSchema } = await import("@/lib/openapi/registry");

      expect(healthDbSchema).toBeDefined();

      const mockResponse = {
        status: "healthy",
        database: "connected",
        connection: "connected", // RR-114: alias property
        environment: "test",
        queryTime: 45,
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthDbSchema.parse(mockResponse)).not.toThrow();
    });

    it("should define schema for /api/health/cron endpoint", async () => {
      const { healthCronSchema } = await import("@/lib/openapi/registry");

      expect(healthCronSchema).toBeDefined();

      const mockResponse = {
        status: "healthy",
        service: "sync-cron",
        lastRun: "2025-08-15T14:00:00.000Z",
        nextRun: "2025-08-16T02:00:00.000Z",
        schedule: "0 2,14 * * *",
        environment: "test",
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthCronSchema.parse(mockResponse)).not.toThrow();
    });

    it("should define schema for /api/health/parsing endpoint", async () => {
      const { healthParsingSchema } = await import("@/lib/openapi/registry");

      expect(healthParsingSchema).toBeDefined();

      const mockResponse = {
        status: "healthy",
        service: "content-parsing",
        readabilityAvailable: true,
        domPurifyAvailable: true,
        lastParseTime: 234,
        environment: "test",
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthParsingSchema.parse(mockResponse)).not.toThrow();
    });

    it("should define schema for /api/health/claude endpoint", async () => {
      const { healthClaudeSchema } = await import("@/lib/openapi/registry");

      expect(healthClaudeSchema).toBeDefined();

      const mockResponse = {
        status: "healthy",
        service: "claude-api",
        apiKeyConfigured: true,
        lastRequestTime: 456,
        environment: "test",
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthClaudeSchema.parse(mockResponse)).not.toThrow();
    });
  });

  describe("OpenAPI Document Structure", () => {
    it("should include response examples for 200 status codes", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );

      const document = generateOpenAPIDocument();

      // Each endpoint must have 200 response with examples
      const healthEndpoints = [
        "/api/health",
        "/api/health/app",
        "/api/health/db",
        "/api/health/cron",
        "/api/health/parsing",
        "/api/health/claude",
      ];

      healthEndpoints.forEach((endpoint) => {
        expect(document.paths[endpoint]).toBeDefined();
        expect(document.paths[endpoint].get).toBeDefined();
        expect(document.paths[endpoint].get.responses).toBeDefined();
        expect(document.paths[endpoint].get.responses["200"]).toBeDefined();
        expect(
          document.paths[endpoint].get.responses["200"].content
        ).toBeDefined();
        expect(
          document.paths[endpoint].get.responses["200"].content[
            "application/json"
          ]
        ).toBeDefined();
        expect(
          document.paths[endpoint].get.responses["200"].content[
            "application/json"
          ].examples
        ).toBeDefined();
      });
    });

    it("should include response examples for 500 status codes", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );

      const document = generateOpenAPIDocument();

      // Each endpoint must have 500 response with examples
      const healthEndpoints = [
        "/api/health",
        "/api/health/app",
        "/api/health/db",
        "/api/health/cron",
        "/api/health/parsing",
        "/api/health/claude",
      ];

      healthEndpoints.forEach((endpoint) => {
        expect(document.paths[endpoint].get.responses["500"]).toBeDefined();
        expect(
          document.paths[endpoint].get.responses["500"].content[
            "application/json"
          ].examples
        ).toBeDefined();
      });
    });

    it("should include operation descriptions and tags", async () => {
      const { generateOpenAPIDocument } = await import(
        "@/lib/openapi/registry"
      );

      const document = generateOpenAPIDocument();

      // Each endpoint must have proper metadata
      expect(document.paths["/api/health"].get).toMatchObject({
        summary: expect.any(String),
        description: expect.any(String),
        tags: ["Health"],
        operationId: "getHealthMain",
      });

      expect(document.paths["/api/health/app"].get).toMatchObject({
        summary: expect.any(String),
        description: expect.any(String),
        tags: ["Health"],
        operationId: "getHealthApp",
      });
    });
  });

  describe("Registry Error Handling", () => {
    it("should handle missing dependencies gracefully", async () => {
      // Test registry creation with missing OpenAPI packages
      vi.doMock("@asteasolutions/zod-to-openapi", () => {
        throw new Error("Package not found");
      });

      await expect(async () => {
        await import("@/lib/openapi/registry");
      }).rejects.toThrow();
    });

    it("should validate schema registration", async () => {
      const { registry } = await import("@/lib/openapi/registry");

      // Registry should validate that all health endpoints are registered
      const registeredPaths = vi.mocked(registry.registerPath).mock.calls;
      expect(registeredPaths).toHaveLength(6); // All 6 health endpoints
    });
  });
});
