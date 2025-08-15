import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock zod for schema validation
vi.mock("zod", () => {
  const createMockSchema = (name: string) => ({
    parse: vi.fn().mockImplementation((data) => {
      // Mock validation logic for different schemas
      if (name === "healthMain") {
        if (!data.status || !data.timestamp)
          throw new Error("Invalid healthMain");
        return data;
      }
      if (name === "healthApp") {
        if (!data.status || !data.service || !data.version)
          throw new Error("Invalid healthApp");
        return data;
      }
      if (name === "healthDb") {
        if (!data.status || !data.database) throw new Error("Invalid healthDb");
        return data;
      }
      // Similar for other schemas
      return data;
    }),
    safeParse: vi.fn().mockImplementation((data) => {
      try {
        return { success: true, data: this.parse(data) };
      } catch (error) {
        return { success: false, error };
      }
    }),
    openapi: vi.fn().mockReturnValue({
      type: "object",
      properties: {},
      required: [],
    }),
  });

  return {
    z: {
      object: vi.fn().mockImplementation((shape) => {
        const schemaName = Object.keys(shape)[0] || "generic";
        return createMockSchema(schemaName);
      }),
      string: vi.fn().mockReturnValue(createMockSchema("string")),
      number: vi.fn().mockReturnValue(createMockSchema("number")),
      boolean: vi.fn().mockReturnValue(createMockSchema("boolean")),
      enum: vi.fn().mockReturnValue(createMockSchema("enum")),
      optional: vi.fn().mockReturnValue(createMockSchema("optional")),
      nullable: vi.fn().mockReturnValue(createMockSchema("nullable")),
    },
  };
});

describe("Health Endpoint Schemas (RR-200)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Main Health Schema (/api/health)", () => {
    it("should validate successful health response", async () => {
      const { healthMainSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        timestamp: "2025-08-15T21:39:00.000Z",
        services: {
          app: "healthy",
          database: "healthy",
          sync: "healthy",
        },
        uptime: 3600,
        environment: "production",
      };

      expect(() => healthMainSchema.parse(validResponse)).not.toThrow();
    });

    it("should validate unhealthy response with error details", async () => {
      const { healthMainSchema } = await import("@/lib/openapi/registry");

      const unhealthyResponse = {
        status: "unhealthy",
        timestamp: "2025-08-15T21:39:00.000Z",
        services: {
          app: "healthy",
          database: "unhealthy",
          sync: "degraded",
        },
        error: "Database connection failed",
        uptime: 3600,
        environment: "production",
      };

      expect(() => healthMainSchema.parse(unhealthyResponse)).not.toThrow();
    });

    it("should require status and timestamp fields", async () => {
      const { healthMainSchema } = await import("@/lib/openapi/registry");

      const invalidResponse = {
        services: { app: "healthy" },
        // Missing status and timestamp
      };

      expect(() => healthMainSchema.parse(invalidResponse)).toThrow();
    });

    it("should validate status enum values", async () => {
      const { healthMainSchema } = await import("@/lib/openapi/registry");

      const validStatuses = ["healthy", "unhealthy", "degraded"];

      validStatuses.forEach((status) => {
        const response = {
          status,
          timestamp: "2025-08-15T21:39:00.000Z",
        };
        expect(() => healthMainSchema.parse(response)).not.toThrow();
      });

      const invalidResponse = {
        status: "invalid-status",
        timestamp: "2025-08-15T21:39:00.000Z",
      };
      expect(() => healthMainSchema.parse(invalidResponse)).toThrow();
    });
  });

  describe("App Health Schema (/api/health/app)", () => {
    it("should validate complete app health response", async () => {
      const { healthAppSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        service: "rss-reader-app",
        version: "1.0.0",
        uptime: 3600,
        lastActivity: "2025-08-15T21:30:00.000Z",
        errorCount: 0,
        environment: "production",
        dependencies: {
          database: "healthy",
          oauth: "healthy",
        },
        performance: {
          avgSyncTime: 1500,
          avgDbQueryTime: 50,
          avgApiCallTime: 200,
        },
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthAppSchema.parse(validResponse)).not.toThrow();
    });

    it("should require version property (RR-114)", async () => {
      const { healthAppSchema } = await import("@/lib/openapi/registry");

      const responseWithoutVersion = {
        status: "healthy",
        service: "rss-reader-app",
        uptime: 3600,
        timestamp: "2025-08-15T21:39:00.000Z",
        // Missing version
      };

      expect(() => healthAppSchema.parse(responseWithoutVersion)).toThrow();
    });

    it("should validate version format as semantic version", async () => {
      const { healthAppSchema } = await import("@/lib/openapi/registry");

      const validVersions = ["1.0.0", "2.1.3", "10.0.0-beta.1"];
      const invalidVersions = ["1.0", "v1.0.0", "1.0.0.0", "invalid"];

      validVersions.forEach((version) => {
        const response = {
          status: "healthy",
          service: "rss-reader-app",
          version,
          uptime: 3600,
          timestamp: "2025-08-15T21:39:00.000Z",
        };
        expect(() => healthAppSchema.parse(response)).not.toThrow();
      });

      invalidVersions.forEach((version) => {
        const response = {
          status: "healthy",
          service: "rss-reader-app",
          version,
          uptime: 3600,
          timestamp: "2025-08-15T21:39:00.000Z",
        };
        expect(() => healthAppSchema.parse(response)).toThrow();
      });
    });

    it("should validate dependencies object structure", async () => {
      const { healthAppSchema } = await import("@/lib/openapi/registry");

      const responseWithDependencies = {
        status: "healthy",
        service: "rss-reader-app",
        version: "1.0.0",
        uptime: 3600,
        dependencies: {
          database: "healthy",
          oauth: "unhealthy",
          sync: "degraded",
        },
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() =>
        healthAppSchema.parse(responseWithDependencies)
      ).not.toThrow();
    });
  });

  describe("Database Health Schema (/api/health/db)", () => {
    it("should validate database health response with connection alias", async () => {
      const { healthDbSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        database: "connected",
        connection: "connected", // RR-114: alias property
        environment: "production",
        queryTime: 45,
        tablesAccessible: true,
        rlsPoliciesActive: true,
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthDbSchema.parse(validResponse)).not.toThrow();
    });

    it("should require connection property as alias for database (RR-114)", async () => {
      const { healthDbSchema } = await import("@/lib/openapi/registry");

      const responseWithoutConnection = {
        status: "healthy",
        database: "connected",
        environment: "production",
        timestamp: "2025-08-15T21:39:00.000Z",
        // Missing connection alias
      };

      expect(() => healthDbSchema.parse(responseWithoutConnection)).toThrow();
    });

    it("should validate database status values", async () => {
      const { healthDbSchema } = await import("@/lib/openapi/registry");

      const validStatuses = [
        "connected",
        "disconnected",
        "slow",
        "error",
        "unavailable",
      ];

      validStatuses.forEach((dbStatus) => {
        const response = {
          status: "healthy",
          database: dbStatus,
          connection: dbStatus, // Must match database value
          environment: "production",
          timestamp: "2025-08-15T21:39:00.000Z",
        };
        expect(() => healthDbSchema.parse(response)).not.toThrow();
      });
    });

    it("should validate queryTime as positive number", async () => {
      const { healthDbSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        database: "connected",
        connection: "connected",
        environment: "production",
        queryTime: 100,
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthDbSchema.parse(validResponse)).not.toThrow();

      const invalidResponse = {
        ...validResponse,
        queryTime: -50, // Negative query time
      };

      expect(() => healthDbSchema.parse(invalidResponse)).toThrow();
    });
  });

  describe("Cron Health Schema (/api/health/cron)", () => {
    it("should validate cron service health response", async () => {
      const { healthCronSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        service: "sync-cron",
        lastRun: "2025-08-15T14:00:00.000Z",
        nextRun: "2025-08-16T02:00:00.000Z",
        schedule: "0 2,14 * * *",
        isRunning: false,
        environment: "production",
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthCronSchema.parse(validResponse)).not.toThrow();
    });

    it("should validate cron schedule format", async () => {
      const { healthCronSchema } = await import("@/lib/openapi/registry");

      const validSchedules = ["0 2,14 * * *", "*/5 * * * *", "0 0 * * 0"];

      validSchedules.forEach((schedule) => {
        const response = {
          status: "healthy",
          service: "sync-cron",
          schedule,
          timestamp: "2025-08-15T21:39:00.000Z",
        };
        expect(() => healthCronSchema.parse(response)).not.toThrow();
      });
    });

    it("should validate ISO date format for lastRun and nextRun", async () => {
      const { healthCronSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        service: "sync-cron",
        lastRun: "2025-08-15T14:00:00.000Z",
        nextRun: "2025-08-16T02:00:00.000Z",
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthCronSchema.parse(validResponse)).not.toThrow();

      const invalidResponse = {
        ...validResponse,
        lastRun: "2025-08-15 14:00:00", // Invalid ISO format
      };

      expect(() => healthCronSchema.parse(invalidResponse)).toThrow();
    });
  });

  describe("Parsing Health Schema (/api/health/parsing)", () => {
    it("should validate content parsing health response", async () => {
      const { healthParsingSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        service: "content-parsing",
        readabilityAvailable: true,
        domPurifyAvailable: true,
        lastParseTime: 234,
        parsedArticlesCount: 1500,
        failedParsesCount: 5,
        environment: "production",
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthParsingSchema.parse(validResponse)).not.toThrow();
    });

    it("should require boolean flags for library availability", async () => {
      const { healthParsingSchema } = await import("@/lib/openapi/registry");

      const responseWithoutFlags = {
        status: "healthy",
        service: "content-parsing",
        timestamp: "2025-08-15T21:39:00.000Z",
        // Missing readabilityAvailable and domPurifyAvailable
      };

      expect(() => healthParsingSchema.parse(responseWithoutFlags)).toThrow();
    });

    it("should validate parse time as positive number", async () => {
      const { healthParsingSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        service: "content-parsing",
        readabilityAvailable: true,
        domPurifyAvailable: true,
        lastParseTime: 150,
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthParsingSchema.parse(validResponse)).not.toThrow();

      const invalidResponse = {
        ...validResponse,
        lastParseTime: -100, // Negative parse time
      };

      expect(() => healthParsingSchema.parse(invalidResponse)).toThrow();
    });
  });

  describe("Claude API Health Schema (/api/health/claude)", () => {
    it("should validate Claude API health response", async () => {
      const { healthClaudeSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        service: "claude-api",
        apiKeyConfigured: true,
        lastRequestTime: 456,
        requestsToday: 15,
        rateLimitRemaining: 985,
        environment: "production",
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthClaudeSchema.parse(validResponse)).not.toThrow();
    });

    it("should require apiKeyConfigured boolean field", async () => {
      const { healthClaudeSchema } = await import("@/lib/openapi/registry");

      const responseWithoutApiKey = {
        status: "healthy",
        service: "claude-api",
        timestamp: "2025-08-15T21:39:00.000Z",
        // Missing apiKeyConfigured
      };

      expect(() => healthClaudeSchema.parse(responseWithoutApiKey)).toThrow();
    });

    it("should validate rate limit fields as non-negative numbers", async () => {
      const { healthClaudeSchema } = await import("@/lib/openapi/registry");

      const validResponse = {
        status: "healthy",
        service: "claude-api",
        apiKeyConfigured: true,
        requestsToday: 0,
        rateLimitRemaining: 1000,
        timestamp: "2025-08-15T21:39:00.000Z",
      };

      expect(() => healthClaudeSchema.parse(validResponse)).not.toThrow();

      const invalidResponse = {
        ...validResponse,
        rateLimitRemaining: -10, // Negative rate limit
      };

      expect(() => healthClaudeSchema.parse(invalidResponse)).toThrow();
    });
  });

  describe("Schema Composition", () => {
    it("should share common fields across all health schemas", async () => {
      const schemas = await import("@/lib/openapi/registry");

      const commonFields = ["status", "timestamp", "environment"];
      const allSchemas = [
        schemas.healthMainSchema,
        schemas.healthAppSchema,
        schemas.healthDbSchema,
        schemas.healthCronSchema,
        schemas.healthParsingSchema,
        schemas.healthClaudeSchema,
      ];

      allSchemas.forEach((schema) => {
        expect(schema).toBeDefined();

        const baseResponse = {
          status: "healthy",
          timestamp: "2025-08-15T21:39:00.000Z",
          environment: "test",
        };

        // All schemas should accept common fields
        expect(() => schema.parse(baseResponse)).not.toThrow();
      });
    });

    it("should export schemas with OpenAPI metadata", async () => {
      const schemas = await import("@/lib/openapi/registry");

      const allSchemas = [
        schemas.healthMainSchema,
        schemas.healthAppSchema,
        schemas.healthDbSchema,
        schemas.healthCronSchema,
        schemas.healthParsingSchema,
        schemas.healthClaudeSchema,
      ];

      allSchemas.forEach((schema) => {
        expect(schema.openapi).toBeDefined();
        expect(typeof schema.openapi).toBe("function");

        const openApiSpec = schema.openapi();
        expect(openApiSpec).toHaveProperty("type", "object");
        expect(openApiSpec).toHaveProperty("properties");
        expect(openApiSpec).toHaveProperty("required");
      });
    });
  });
});
