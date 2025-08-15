import {
  OpenAPIRegistry,
  OpenApiGeneratorV3,
  extendZodWithOpenApi,
} from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

// Extend Zod with OpenAPI capabilities
extendZodWithOpenApi(z);

// Initialize OpenAPI registry
export const registry = new OpenAPIRegistry();

// Health status enum
const HealthStatusSchema = z
  .enum([
    "healthy",
    "degraded",
    "unhealthy",
    "error",
    "unknown",
    "not_configured",
  ])
  .openapi({
    description: "Health status of the service",
    example: "healthy",
  });

// Base response schema
const BaseHealthResponseSchema = z.object({
  status: HealthStatusSchema,
  timestamp: z.string().openapi({
    description: "ISO 8601 timestamp",
    example: "2025-08-15T12:00:00Z",
  }),
});

// Main health endpoint response (/api/health)
const MainHealthResponseSchema = registry.register(
  "MainHealthResponse",
  BaseHealthResponseSchema.extend({
    service: z.string().openapi({ example: "rss-reader-app" }),
    uptime: z.number().openapi({ example: 123456 }),
    lastActivity: z.string().optional().openapi({
      description: "Last activity timestamp",
      example: "2025-08-15T12:00:00Z",
    }),
    errorCount: z.number().openapi({ example: 0 }),
    environment: z.string().openapi({ example: "development" }),
    version: z.string().optional().openapi({
      description: "Application version (RR-114 requirement)",
      example: "1.0.0",
    }),
    ping: z.boolean().optional().openapi({
      description: "Present when ping=true parameter used",
      example: true,
    }),
    dependencies: z
      .object({
        database: z.string().openapi({ example: "healthy" }),
        oauth: z.string().openapi({ example: "healthy" }),
      })
      .optional(),
    performance: z
      .object({
        avgDbQueryTime: z.number().openapi({ example: 145 }),
        avgApiCallTime: z.number().openapi({ example: 0 }),
        avgSyncTime: z.number().openapi({ example: 0 }),
      })
      .optional(),
    details: z
      .object({
        services: z.array(
          z.object({
            name: z.string(),
            displayName: z.string(),
            status: z.string(),
            lastCheck: z.string(),
            message: z.string(),
            checks: z
              .array(
                z.object({
                  name: z.string(),
                  status: z.string(),
                  message: z.string(),
                  duration: z.number().optional(),
                })
              )
              .optional(),
          })
        ),
      })
      .optional(),
  }).openapi({
    description:
      "Main application health status with comprehensive service details",
  })
);

// App health endpoint response (/api/health/app)
const AppHealthResponseSchema = registry.register(
  "AppHealthResponse",
  BaseHealthResponseSchema.extend({
    service: z.string().openapi({ example: "rss-reader-app" }),
    uptime: z.number().openapi({ example: 123456 }),
    lastActivity: z.string().optional().openapi({
      description: "Last activity timestamp",
      example: "2025-08-15T12:00:00Z",
    }),
    errorCount: z.number().openapi({ example: 0 }),
    environment: z.string().openapi({ example: "development" }),
    version: z.string().openapi({
      description: "Application version (RR-114 requirement)",
      example: "1.0.0",
    }),
    ping: z.boolean().optional().openapi({ example: true }),
    dependencies: z
      .object({
        database: z.string().openapi({ example: "healthy" }),
        oauth: z.string().openapi({ example: "healthy" }),
      })
      .optional(),
    performance: z
      .object({
        avgDbQueryTime: z.number().openapi({ example: 145 }),
        avgApiCallTime: z.number().openapi({ example: 0 }),
        avgSyncTime: z.number().openapi({ example: 0 }),
      })
      .optional(),
    details: z
      .object({
        services: z.array(
          z.object({
            name: z.string(),
            displayName: z.string(),
            status: z.string(),
            lastCheck: z.string(),
            message: z.string(),
            checks: z
              .array(
                z.object({
                  name: z.string(),
                  status: z.string(),
                  message: z.string(),
                  duration: z.number().optional(),
                })
              )
              .optional(),
          })
        ),
      })
      .optional(),
  }).openapi({
    description:
      "Application-specific health status with version and performance metrics",
  })
);

// Database health endpoint response (/api/health/db)
const DbHealthResponseSchema = registry.register(
  "DbHealthResponse",
  BaseHealthResponseSchema.extend({
    database: z.string().openapi({
      description: "Database connection status",
      example: "connected",
    }),
    connection: z.string().openapi({
      description: "Connection status alias (RR-114 requirement)",
      example: "connected",
    }),
    message: z.string().openapi({ example: "Database is healthy" }),
    connectivity: z.boolean().openapi({
      description: "Database connectivity status",
      example: true,
    }),
    queryTime: z.number().openapi({
      description: "Database query response time in milliseconds",
      example: 154,
    }),
    environment: z.string().openapi({
      description: "Current environment",
      example: "development",
    }),
  }).openapi({
    description: "Database connectivity health status with performance metrics",
  })
);

// Cron health endpoint response (/api/health/cron)
const CronHealthResponseSchema = registry.register(
  "CronHealthResponse",
  BaseHealthResponseSchema.extend({
    message: z.string().openapi({ example: "Sync completed successfully" }),
    lastCheck: z.string().nullable().openapi({
      description: "Timestamp of last cron health check",
      example: "2025-08-15T11:45:00Z",
    }),
    ageMinutes: z.number().optional().openapi({ example: 15 }),
  }).openapi({
    description: "Cron job health and execution status",
  })
);

// Parsing health endpoint response (/api/health/parsing)
const ParsingHealthResponseSchema = registry.register(
  "ParsingHealthResponse",
  BaseHealthResponseSchema.extend({
    metrics: z.object({
      parsing: z.object({
        totalParsed: z.number().openapi({ example: 1250 }),
        recentlyParsed: z.number().openapi({ example: 25 }),
        failedParses: z.number().openapi({ example: 3 }),
        partialFeeds: z.number().openapi({ example: 2 }),
      }),
      fetch: z.object({
        successRate: z.string().openapi({ example: "95.5%" }),
        avgDurationMs: z.number().openapi({ example: 850 }),
      }),
    }),
  }).openapi({
    description: "Content parsing metrics and performance",
  })
);

// Claude health endpoint response (/api/health/claude)
const ClaudeHealthResponseSchema = registry.register(
  "ClaudeHealthResponse",
  BaseHealthResponseSchema.extend({
    message: z.string().openapi({ example: "Claude API is accessible" }),
  }).openapi({
    description: "Claude AI API connectivity status",
  })
);

// Error response schema
const ErrorResponseSchema = registry.register(
  "ErrorResponse",
  z
    .object({
      status: HealthStatusSchema,
      error: z
        .string()
        .optional()
        .openapi({ example: "Database connection failed" }),
      message: z
        .string()
        .optional()
        .openapi({ example: "Unable to connect to database" }),
      timestamp: z.string().openapi({
        description: "ISO 8601 timestamp",
        example: "2025-08-15T12:00:00Z",
      }),
    })
    .openapi({
      description: "Error response for health endpoints",
    })
);

// Register health endpoints
registry.registerPath({
  method: "get",
  path: "/api/health",
  description: "Main application health check",
  summary: "Get overall application health status",
  tags: ["Health"],
  request: {
    query: z.object({
      ping: z.string().optional().openapi({
        description: 'Set to "true" for simple ping response',
        example: "true",
      }),
    }),
  },
  responses: {
    200: {
      description: "Health check successful",
      content: {
        "application/json": {
          schema: MainHealthResponseSchema,
          examples: {
            healthy: {
              summary: "Healthy response",
              value: {
                status: "healthy",
                service: "rss-reader-app",
                uptime: 123456,
                lastActivity: "2025-08-15T12:00:00Z",
                errorCount: 0,
                environment: "development",
                timestamp: "2025-08-15T12:00:00Z",
                dependencies: {
                  database: "healthy",
                  oauth: "healthy",
                },
                performance: {
                  avgDbQueryTime: 145,
                  avgApiCallTime: 0,
                  avgSyncTime: 0,
                },
              },
            },
          },
        },
      },
    },
    503: {
      description: "Service unavailable",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            error: {
              summary: "Service unavailable",
              value: {
                status: "error",
                error: "Database connection failed",
                message: "Unable to connect to database",
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/health/app",
  description: "Application-specific health check",
  summary: "Get application health with version information",
  tags: ["Health"],
  request: {
    query: z.object({
      ping: z.string().optional().openapi({
        description: 'Set to "true" for simple ping response',
        example: "true",
      }),
    }),
  },
  responses: {
    200: {
      description: "Application health check successful",
      content: {
        "application/json": {
          schema: AppHealthResponseSchema,
          examples: {
            healthy: {
              summary: "Healthy application response",
              value: {
                status: "healthy",
                service: "rss-reader-app",
                uptime: 123456,
                lastActivity: "2025-08-15T12:00:00Z",
                errorCount: 0,
                environment: "development",
                version: "1.0.0",
                timestamp: "2025-08-15T12:00:00Z",
                dependencies: {
                  database: "healthy",
                  oauth: "healthy",
                },
                performance: {
                  avgDbQueryTime: 145,
                  avgApiCallTime: 0,
                  avgSyncTime: 0,
                },
              },
            },
          },
        },
      },
    },
    503: {
      description: "Service unavailable",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            error: {
              summary: "Service unavailable",
              value: {
                status: "error",
                error: "Service initialization failed",
                message: "Application failed to start",
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/health/db",
  description: "Database connectivity health check",
  summary: "Get database connection status and performance",
  tags: ["Health"],
  responses: {
    200: {
      description: "Database health check successful",
      content: {
        "application/json": {
          schema: DbHealthResponseSchema,
          examples: {
            healthy: {
              summary: "Database connected successfully",
              value: {
                status: "healthy",
                database: "connected",
                connection: "connected",
                message: "Database is healthy",
                connectivity: true,
                queryTime: 154,
                environment: "development",
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
    503: {
      description: "Database unavailable",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            error: {
              summary: "Database connection failed",
              value: {
                status: "error",
                error: "ECONNREFUSED",
                message: "Unable to connect to database",
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/health/cron",
  description: "Cron job health check",
  summary: "Get cron job status and recent execution history",
  tags: ["Health"],
  responses: {
    200: {
      description: "Cron health check successful",
      content: {
        "application/json": {
          schema: CronHealthResponseSchema,
          examples: {
            healthy: {
              summary: "Cron jobs running normally",
              value: {
                status: "healthy",
                message: "Sync completed successfully",
                lastCheck: "2025-08-15T11:45:00Z",
                ageMinutes: 15,
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
    503: {
      description: "Cron service unavailable",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            error: {
              summary: "Cron service not running",
              value: {
                status: "error",
                error: "Cron service not initialized",
                message: "Cron jobs are not configured",
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/health/parsing",
  description: "Content parsing health check",
  summary: "Get parsing metrics and performance statistics",
  tags: ["Health"],
  responses: {
    200: {
      description: "Parsing health check successful",
      content: {
        "application/json": {
          schema: ParsingHealthResponseSchema,
          examples: {
            healthy: {
              summary: "Parsing metrics normal",
              value: {
                status: "healthy",
                metrics: {
                  parsing: {
                    totalParsed: 1250,
                    recentlyParsed: 25,
                    failedParses: 3,
                    partialFeeds: 2,
                  },
                  fetch: {
                    successRate: "95.5%",
                    avgDurationMs: 850,
                  },
                },
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
    503: {
      description: "Parsing service unavailable",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            error: {
              summary: "Parsing service error",
              value: {
                status: "error",
                error: "Parsing service unavailable",
                message: "Content parsing service is not responding",
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
  },
});

registry.registerPath({
  method: "get",
  path: "/api/health/claude",
  description: "Claude AI API health check",
  summary: "Get Claude API connectivity and status",
  tags: ["Health"],
  responses: {
    200: {
      description: "Claude API health check successful",
      content: {
        "application/json": {
          schema: ClaudeHealthResponseSchema,
          examples: {
            healthy: {
              summary: "Claude API accessible",
              value: {
                status: "healthy",
                message: "Claude API is accessible",
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
    503: {
      description: "Claude API unavailable or not configured",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
          examples: {
            notConfigured: {
              summary: "Claude API not configured",
              value: {
                status: "not_configured",
                message: "Claude API key not configured",
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
            error: {
              summary: "Claude API error",
              value: {
                status: "error",
                error: "API request failed",
                message: "Claude API returned an error",
                timestamp: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
  },
});

// Generate OpenAPI document
export function generateOpenAPIDocument() {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  // Determine the server URL based on environment
  const serverUrl =
    process.env.NEXT_PUBLIC_BASE_URL ||
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");

  const fullServerUrl = `${serverUrl}/reader`;

  return generator.generateDocument({
    openapi: "3.0.0",
    info: {
      title: "RSS News Reader API",
      version: "1.0.0",
      description: "Health endpoints for the RSS News Reader application",
    },
    servers: [
      {
        url: fullServerUrl,
        description:
          process.env.NODE_ENV === "production"
            ? "Production server"
            : "Development server",
      },
    ],
    tags: [
      {
        name: "Health",
        description:
          "Health monitoring endpoints for application status and diagnostics",
      },
    ],
  });
}

// Export schemas for individual use
export {
  MainHealthResponseSchema,
  AppHealthResponseSchema,
  DbHealthResponseSchema,
  CronHealthResponseSchema,
  ParsingHealthResponseSchema,
  ClaudeHealthResponseSchema,
  ErrorResponseSchema,
};

// Export with test-expected names for backwards compatibility
export {
  MainHealthResponseSchema as healthMainSchema,
  AppHealthResponseSchema as healthAppSchema,
  DbHealthResponseSchema as healthDbSchema,
  CronHealthResponseSchema as healthCronSchema,
  ParsingHealthResponseSchema as healthParsingSchema,
  ClaudeHealthResponseSchema as healthClaudeSchema,
};
