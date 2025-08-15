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

// ========== DEVELOPER TOOLS SCHEMAS ==========

// Insomnia export response schema
const InsomniaExportResponseSchema = registry.register(
  "InsomniaExportResponse",
  z
    .object({
      _type: z.literal("export").openapi({
        description: "Export type identifier",
        example: "export",
      }),
      __export_format: z.literal(4).openapi({
        description: "Insomnia export format version",
        example: 4,
      }),
      __export_date: z.string().openapi({
        description: "Export timestamp",
        example: "2025-08-15T12:00:00.000Z",
      }),
      __export_source: z.string().openapi({
        description: "Export source identifier",
        example: "rss-reader-openapi-converter",
      }),
      resources: z.array(z.any()).openapi({
        description:
          "Array of Insomnia resources (workspace, environments, folders, requests)",
      }),
    })
    .openapi({
      description: "Insomnia v4 collection export format",
    })
);

// ========== DEVELOPER TOOLS ENDPOINTS ==========

// Insomnia export endpoint
registry.registerPath({
  method: "get",
  path: "/api/insomnia.json",
  summary: "Export OpenAPI as Insomnia collection",
  description:
    "Exports the entire OpenAPI specification as an Insomnia v4 collection file. " +
    "Automatically detects the base URL from request headers (supports localhost, 127.0.0.1, and Tailscale IPs). " +
    "The collection includes all documented endpoints organized by tags, with environment variables for configuration. " +
    "Responses are cached for 5 minutes and support ETag-based caching. Rate limited to 1 request per minute per IP.",
  tags: ["Developer Tools"],
  responses: {
    200: {
      description: "Insomnia collection export",
      headers: z.object({
        "Content-Type": z.literal("application/json"),
        "Content-Disposition": z.literal(
          'attachment; filename="rss-reader-insomnia.json"'
        ),
        "Cache-Control": z.literal("public, max-age=300"),
        ETag: z.string(),
        "Access-Control-Allow-Origin": z.literal("*"),
      }),
      content: {
        "application/json": {
          schema: InsomniaExportResponseSchema,
          examples: {
            collection: {
              summary: "Example Insomnia collection",
              value: {
                _type: "export",
                __export_format: 4,
                __export_date: "2025-08-15T12:00:00.000Z",
                __export_source: "rss-reader-openapi-converter",
                resources: [
                  {
                    _id: "wrk_abc123",
                    _type: "workspace",
                    name: "RSS Reader API",
                    description: "RSS News Reader API collection",
                    scope: "collection",
                  },
                  {
                    _id: "env_def456",
                    _type: "environment",
                    parentId: "wrk_abc123",
                    name: "RSS Reader Environment",
                    data: {
                      base_url: "http://100.96.166.53:3000/reader",
                      api_key: "{{ _.api_key }}",
                      auth_token: "{{ _.auth_token }}",
                    },
                    color: "#7d69cb",
                  },
                ],
              },
            },
          },
        },
      },
    },
    304: {
      description: "Not Modified (ETag matched)",
      headers: z.object({
        ETag: z.string(),
        "Cache-Control": z.literal("public, max-age=300"),
      }),
    },
    429: {
      description: "Rate limit exceeded",
      headers: z.object({
        "Retry-After": z.literal("60"),
        "X-RateLimit-Limit": z.literal("1"),
        "X-RateLimit-Remaining": z.literal("0"),
        "X-RateLimit-Reset": z.string(),
      }),
      content: {
        "text/plain": {
          schema: z.string(),
        },
      },
    },
    500: {
      description: "Failed to generate Insomnia collection",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// ========== SYNC OPERATIONS SCHEMAS ==========

// Standard sync error response schema
const SyncErrorResponseSchema = registry.register(
  "SyncErrorResponse",
  z
    .object({
      error: z.string().openapi({
        description: "Error code",
        example: "SYNC_IN_PROGRESS",
      }),
      message: z.string().openapi({
        description: "Human readable error message",
        example: "Another sync is already in progress",
      }),
      code: z.string().optional().openapi({
        description: "Optional error code",
        example: "429",
      }),
      details: z.any().optional().openapi({
        description: "Optional additional error context",
      }),
    })
    .openapi({
      description: "Standard error response for sync operations",
    })
);

// Sync status response schema (shared by multiple endpoints)
const SyncStatusSchema = registry.register(
  "SyncStatus",
  z
    .object({
      syncId: z.string().openapi({
        description: "Unique sync operation identifier (UUID)",
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
      status: z.enum(["pending", "running", "completed", "failed"]).openapi({
        description: "Current sync status",
        example: "running",
      }),
      progress: z.number().min(0).max(100).openapi({
        description: "Sync progress percentage",
        example: 45,
      }),
      message: z.string().optional().openapi({
        description: "Status message",
        example: "Processing articles...",
      }),
      error: z.string().optional().openapi({
        description: "Error message if sync failed",
        example: "Connection timeout",
      }),
      startTime: z.number().optional().openapi({
        description: "Unix timestamp when sync started",
        example: 1736867400000,
      }),
      itemsProcessed: z.number().optional().openapi({
        description: "Number of items processed",
        example: 65,
      }),
      totalItems: z.number().optional().openapi({
        description: "Total number of items to process",
        example: 100,
      }),
      metrics: z
        .object({
          newArticles: z.number().openapi({ example: 125 }),
          deletedArticles: z.number().openapi({ example: 42 }),
          newTags: z.number().openapi({ example: 8 }),
          failedFeeds: z.number().openapi({ example: 2 }),
        })
        .optional()
        .openapi({
          description: "Sync operation metrics",
        }),
      sidebar: z
        .object({
          feedCounts: z.array(z.tuple([z.string(), z.number()])).openapi({
            description: "Feed IDs with unread counts",
            example: [
              ["feed123", 5],
              ["feed456", 12],
            ],
          }),
          tags: z
            .array(
              z.object({
                id: z.string(),
                name: z.string(),
                count: z.number(),
              })
            )
            .openapi({
              description: "Tag information with article counts",
            }),
        })
        .optional()
        .openapi({
          description: "Sidebar data for immediate UI update",
        }),
    })
    .openapi({
      description: "Sync operation status and progress information",
    })
);

// Last sync response schema
const LastSyncResponseSchema = registry.register(
  "LastSyncResponse",
  z
    .object({
      lastSyncTime: z.string().nullable().openapi({
        description: "ISO 8601 timestamp of last successful sync",
        example: "2025-08-15T12:00:00Z",
      }),
      source: z
        .enum(["sync_metadata", "sync_status", "sync-log", "none"])
        .openapi({
          description: "Source of the last sync timestamp",
          example: "sync_metadata",
        }),
    })
    .openapi({
      description: "Last sync timestamp information",
    })
);

// Metadata update response
const MetadataUpdateResponseSchema = registry.register(
  "MetadataUpdateResponse",
  z
    .object({
      success: z.boolean().openapi({ example: true }),
      updatedCount: z.number().optional().openapi({
        description: "Number of metadata keys updated",
        example: 3,
      }),
    })
    .openapi({
      description: "Metadata bulk update confirmation",
    })
);

// Refresh view response
const RefreshViewResponseSchema = registry.register(
  "RefreshViewResponse",
  z
    .object({
      success: z.boolean().openapi({ example: true }),
      message: z.string().openapi({
        example: "Materialized view refreshed successfully",
      }),
      duration: z.number().optional().openapi({
        description: "Operation duration in milliseconds",
        example: 254,
      }),
    })
    .openapi({
      description: "Materialized view refresh result",
    })
);

// API usage response
const ApiUsageResponseSchema = registry.register(
  "ApiUsageResponse",
  z
    .object({
      zone1: z
        .object({
          used: z.number().openapi({ example: 2543 }),
          limit: z.number().openapi({ example: 10000 }),
          percentage: z.number().openapi({ example: 25.43 }),
        })
        .openapi({
          description: "Zone 1 API usage (primary endpoints)",
        }),
      zone2: z
        .object({
          used: z.number().openapi({ example: 543 }),
          limit: z.number().openapi({ example: 5000 }),
          percentage: z.number().openapi({ example: 10.86 }),
        })
        .openapi({
          description: "Zone 2 API usage (secondary endpoints)",
        }),
      resetAfterSeconds: z.number().optional().openapi({
        description: "Seconds until rate limit reset",
        example: 3600,
      }),
      timestamp: z.string().openapi({
        description: "ISO 8601 timestamp of the response",
        example: "2025-08-15T12:00:00Z",
      }),
    })
    .openapi({
      description: "API usage statistics per zone with rate limits",
    })
);

// ========== REGISTER SYNC ENDPOINTS ==========

// POST /api/sync - Trigger full sync
registry.registerPath({
  method: "post",
  path: "/api/sync",
  description:
    "⚠️ **MAKES INOREADER API CALLS** - Trigger a full synchronization of RSS feeds and articles. This endpoint makes multiple API calls to Inoreader including: subscription list, tag list, unread counts, and article stream content. Use judiciously to avoid hitting API rate limits.",
  summary: "✨ Trigger full sync (Uses Inoreader API)",
  tags: ["Sync Operations"],
  responses: {
    200: {
      description: "Sync initiated successfully",
      content: {
        "application/json": {
          schema: SyncStatusSchema,
          examples: {
            initiated: {
              summary: "Sync initiated",
              value: {
                syncId: "550e8400-e29b-41d4-a716-446655440000",
                status: "running",
                progress: 0,
                message: "Sync operation started",
                startTime: 1736867400000,
                metrics: {
                  newArticles: 0,
                  deletedArticles: 0,
                  newTags: 0,
                  failedFeeds: 0,
                },
              },
            },
          },
        },
      },
    },
    409: {
      description: "Sync already in progress",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            inProgress: {
              summary: "Sync already running",
              value: {
                error: "SYNC_IN_PROGRESS",
                message: "Another sync is already in progress",
              },
            },
          },
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Sync failed to start",
              value: {
                error: "SYNC_INIT_FAILED",
                message: "Failed to initialize sync operation",
                details: { reason: "Database connection error" },
              },
            },
          },
        },
      },
    },
  },
});

// GET /api/sync/status/{syncId} - Get sync status by ID
registry.registerPath({
  method: "get",
  path: "/api/sync/status/{syncId}",
  description:
    "✅ **NO API CALLS** - Get the current status of a specific sync operation. This endpoint only reads from local file system or database and does not make any external API calls.",
  summary: "Get sync operation status (Local only)",
  tags: ["Sync Operations"],
  request: {
    params: z.object({
      syncId: z.string().uuid().openapi({
        description: "Sync operation UUID",
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
    }),
  },
  responses: {
    200: {
      description: "Sync status retrieved successfully",
      content: {
        "application/json": {
          schema: SyncStatusSchema,
          examples: {
            running: {
              summary: "Sync in progress",
              value: {
                syncId: "550e8400-e29b-41d4-a716-446655440000",
                status: "running",
                progress: 65,
                message: "Processing articles from 12 feeds",
                startTime: 1736867400000,
                metrics: {
                  newArticles: 87,
                  deletedArticles: 23,
                  newTags: 5,
                  failedFeeds: 1,
                },
                sidebar: {
                  feedCounts: [
                    ["feed123", 5],
                    ["feed456", 12],
                  ],
                  tags: [
                    { id: "tag1", name: "Technology", count: 45 },
                    { id: "tag2", name: "Science", count: 32 },
                  ],
                },
              },
            },
            completed: {
              summary: "Sync completed",
              value: {
                syncId: "550e8400-e29b-41d4-a716-446655440000",
                status: "completed",
                progress: 100,
                message: "Sync completed successfully",
                startTime: 1736867400000,
                metrics: {
                  newArticles: 125,
                  deletedArticles: 42,
                  newTags: 8,
                  failedFeeds: 2,
                },
              },
            },
          },
        },
      },
    },
    404: {
      description: "Sync operation not found",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            notFound: {
              summary: "Sync ID not found",
              value: {
                error: "SYNC_NOT_FOUND",
                message: "No sync operation found with the specified ID",
              },
            },
          },
        },
      },
    },
  },
});

// GET /api/sync/last-sync - Get last sync timestamp
registry.registerPath({
  method: "get",
  path: "/api/sync/last-sync",
  description:
    "✅ **NO API CALLS** - Get the timestamp of the last successful sync operation. This endpoint only queries the local database and does not make any external API calls.",
  summary: "Get last sync timestamp (Local only)",
  tags: ["Sync Operations"],
  responses: {
    200: {
      description: "Last sync time retrieved successfully",
      content: {
        "application/json": {
          schema: LastSyncResponseSchema,
          examples: {
            found: {
              summary: "Last sync found",
              value: {
                lastSyncTime: "2025-08-15T11:45:00Z",
                source: "sync_metadata",
              },
            },
            notFound: {
              summary: "No sync history",
              value: {
                lastSyncTime: null,
                source: "none",
              },
            },
          },
        },
      },
    },
    500: {
      description: "Failed to fetch last sync time",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Database error",
              value: {
                error: "DB_ERROR",
                message: "Failed to fetch last sync time",
              },
            },
          },
        },
      },
    },
  },
});

// POST /api/sync/metadata - Update sync metadata
registry.registerPath({
  method: "post",
  path: "/api/sync/metadata",
  description:
    "✅ **NO API CALLS** - Update sync-related metadata key-value pairs. This endpoint only updates the local database and does not make any external API calls.",
  summary: "Update sync metadata (Local only)",
  tags: ["Sync Operations"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z
            .record(
              z.string(),
              z.union([
                z.string(),
                z.number(),
                z.object({
                  increment: z.number().openapi({
                    description: "Increment value for counter operations",
                    example: 1,
                  }),
                }),
              ])
            )
            .openapi({
              description:
                "Object with metadata key-value pairs to update. Values can be strings, numbers, or increment operations.",
              example: {
                sync_interval: "30",
                last_sync_count: 150,
                api_calls_count: { increment: 1 },
              },
            }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Metadata updated successfully",
      content: {
        "application/json": {
          schema: MetadataUpdateResponseSchema,
          examples: {
            updated: {
              summary: "Metadata updated",
              value: {
                success: true,
                updatedCount: 3,
              },
            },
          },
        },
      },
    },
    400: {
      description: "Invalid metadata key or value",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            invalid: {
              summary: "Invalid metadata",
              value: {
                error: "INVALID_METADATA",
                message: "Invalid metadata key or value provided",
              },
            },
          },
        },
      },
    },
  },
});

// POST /api/sync/refresh-view - Refresh materialized view
registry.registerPath({
  method: "post",
  path: "/api/sync/refresh-view",
  description:
    "✅ **NO API CALLS** - Refresh the feed_stats materialized view for updated article counts. This endpoint only refreshes the database view and does not make any external API calls.",
  summary: "Refresh materialized view (Local only)",
  tags: ["Sync Operations"],
  responses: {
    200: {
      description: "View refreshed successfully",
      content: {
        "application/json": {
          schema: RefreshViewResponseSchema,
          examples: {
            success: {
              summary: "View refreshed",
              value: {
                success: true,
                message: "Materialized view refreshed successfully",
                duration: 254,
              },
            },
          },
        },
      },
    },
    500: {
      description: "Failed to refresh view",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Refresh failed",
              value: {
                error: "VIEW_REFRESH_FAILED",
                message: "Failed to refresh materialized view",
                details: { reason: "Database error" },
              },
            },
          },
        },
      },
    },
  },
});

// POST /api/sync/bidirectional - Bidirectional sync (not implemented)
registry.registerPath({
  method: "post",
  path: "/api/sync/bidirectional",
  description:
    "✅ **NO API CALLS** - Bidirectional sync endpoint (currently returns 501 - handled by background service). The actual sync runs as a separate background service on port 3001.",
  summary: "Bidirectional sync (501 - Not Implemented)",
  tags: ["Sync Operations"],
  responses: {
    501: {
      description: "Not implemented - handled by background sync service",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            notImplemented: {
              summary: "Feature not implemented",
              value: {
                error: "NOT_IMPLEMENTED",
                message:
                  "Bidirectional sync is handled by the background sync service on port 3001",
                code: "501",
              },
            },
          },
        },
      },
    },
  },
});

// GET /api/sync/api-usage - Get API usage statistics
registry.registerPath({
  method: "get",
  path: "/api/sync/api-usage",
  description:
    "✅ **NO API CALLS** - Get current API usage statistics and remaining quota. This endpoint reads cached rate limit data from the database (captured from previous API responses) and does not make any external API calls.",
  summary: "Get API usage statistics (Local only)",
  tags: ["Sync Operations"],
  responses: {
    200: {
      description: "API usage retrieved successfully",
      content: {
        "application/json": {
          schema: ApiUsageResponseSchema,
          examples: {
            usage: {
              summary: "Current API usage",
              value: {
                apiLimits: {
                  totalRequests: 10000,
                  usedRequests: 2543,
                  remainingRequests: 7457,
                  resetDate: "2025-09-01T00:00:00Z",
                },
                quotaPercentage: 25.43,
              },
            },
          },
        },
      },
    },
    500: {
      description: "Failed to fetch API usage",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "API error",
              value: {
                error: "API_USAGE_ERROR",
                message: "Failed to fetch API usage statistics",
              },
            },
          },
        },
      },
    },
  },
});

// Generate OpenAPI document
// ========== ARTICLES SCHEMAS ==========

// Article schema
const ArticleSchema = registry.register(
  "Article",
  z
    .object({
      id: z.string().uuid().openapi({
        description: "Article unique identifier",
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
      feed_id: z.string().uuid().openapi({
        description: "Associated feed ID",
        example: "660e8400-e29b-41d4-a716-446655440001",
      }),
      inoreader_id: z.string().openapi({
        description: "Inoreader article ID",
        example: "tag:google.com,2005:reader/item/000000001234abcd",
      }),
      title: z.string().openapi({
        description: "Article title",
        example: "Breaking News: Tech Innovation",
      }),
      content: z.string().optional().openapi({
        description: "RSS content (may be truncated)",
        example: "<p>Article preview content...</p>",
      }),
      full_content: z.string().nullable().openapi({
        description: "Full extracted article content",
        example: "<p>Complete article content...</p>",
      }),
      has_full_content: z.boolean().openapi({
        description: "Whether full content has been extracted",
        example: true,
      }),
      ai_summary: z.string().nullable().openapi({
        description: "AI-generated summary",
        example: "This article discusses recent technological innovations...",
      }),
      author: z.string().nullable().openapi({
        description: "Article author",
        example: "John Doe",
      }),
      url: z.string().url().nullable().openapi({
        description: "Article URL",
        example: "https://example.com/article/123",
      }),
      published_at: z.string().openapi({
        description: "Publication timestamp",
        example: "2025-08-15T10:30:00Z",
      }),
      is_read: z.boolean().openapi({
        description: "Read status",
        example: false,
      }),
      is_starred: z.boolean().openapi({
        description: "Starred status",
        example: true,
      }),
      parsed_at: z.string().nullable().openapi({
        description: "Content extraction timestamp",
        example: "2025-08-15T10:35:00Z",
      }),
      parse_failed: z.boolean().optional().openapi({
        description: "Whether content extraction failed",
        example: false,
      }),
      parse_attempts: z.number().optional().openapi({
        description: "Number of extraction attempts",
        example: 1,
      }),
      created_at: z.string().openapi({
        description: "Database creation timestamp",
        example: "2025-08-15T10:31:00Z",
      }),
      updated_at: z.string().openapi({
        description: "Last update timestamp",
        example: "2025-08-15T10:35:00Z",
      }),
    })
    .openapi({
      description: "Article entity with full metadata",
    })
);

// Paginated articles response
const PaginatedArticlesResponseSchema = registry.register(
  "PaginatedArticlesResponse",
  z
    .object({
      articles: z.array(ArticleSchema).openapi({
        description: "Array of articles",
      }),
      nextCursor: z.string().nullable().openapi({
        description: "Cursor for next page (base64 encoded)",
        example: "eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9",
      }),
      prevCursor: z.string().nullable().openapi({
        description: "Cursor for previous page",
        example: null,
      }),
      hasNext: z.boolean().openapi({
        description: "Whether more pages exist",
        example: true,
      }),
      hasPrev: z.boolean().openapi({
        description: "Whether previous pages exist",
        example: false,
      }),
    })
    .openapi({
      description: "Cursor-based paginated articles response",
    })
);

// Fetch content response
const FetchContentResponseSchema = registry.register(
  "FetchContentResponse",
  z
    .object({
      success: z.boolean().openapi({ example: true }),
      article: z
        .object({
          id: z.string().uuid(),
          has_full_content: z.boolean(),
          full_content: z.string(),
        })
        .optional()
        .openapi({
          description: "Updated article with extracted content",
        }),
      cached: z.boolean().optional().openapi({
        description: "Whether content was already available",
        example: false,
      }),
    })
    .openapi({
      description: "Content extraction result",
    })
);

// Summarize response
const SummarizeResponseSchema = registry.register(
  "SummarizeResponse",
  z
    .object({
      success: z.boolean().openapi({ example: true }),
      summary: z.string().openapi({
        description: "AI-generated summary",
        example:
          "This article explores recent advances in quantum computing, highlighting breakthrough achievements in error correction and practical applications in drug discovery and cryptography.",
      }),
      model: z.string().optional().openapi({
        description: "Claude model used",
        example: "claude-sonnet-4-20250514",
      }),
      cached: z.boolean().optional().openapi({
        description: "Whether summary was cached",
        example: false,
      }),
      regenerated: z.boolean().optional().openapi({
        description: "Whether summary was regenerated",
        example: false,
      }),
      input_tokens: z.number().optional().openapi({
        description: "Input token count",
        example: 2500,
      }),
      output_tokens: z.number().optional().openapi({
        description: "Output token count",
        example: 150,
      }),
      config: z
        .object({
          style: z.string(),
          focus: z.array(z.string()),
          maxLength: z.number(),
        })
        .optional()
        .openapi({
          description: "Summary configuration used",
        }),
    })
    .openapi({
      description: "Article summarization result",
    })
);

// Article tags response
const ArticleTagsResponseSchema = registry.register(
  "ArticleTagsResponse",
  z
    .object({
      tags: z
        .array(
          z.object({
            id: z
              .string()
              .uuid()
              .openapi({ example: "770e8400-e29b-41d4-a716-446655440003" }),
            name: z.string().openapi({ example: "Technology" }),
            slug: z.string().openapi({ example: "technology" }),
            color: z.string().nullable().openapi({ example: "#3B82F6" }),
            description: z.string().nullable().openapi({
              example: "Articles about technology and innovation",
            }),
          })
        )
        .openapi({
          description: "Tags associated with the article",
        }),
    })
    .openapi({
      description: "Tags for a specific article",
    })
);

// ========== TAGS SCHEMAS ==========

// Tag schema
const TagSchema = registry.register(
  "Tag",
  z
    .object({
      id: z.string().uuid().openapi({
        description: "Tag unique identifier",
        example: "770e8400-e29b-41d4-a716-446655440003",
      }),
      name: z.string().openapi({
        description: "Tag display name",
        example: "Technology",
      }),
      slug: z.string().openapi({
        description: "URL-friendly slug",
        example: "technology",
      }),
      color: z.string().nullable().openapi({
        description: "Tag color (hex)",
        example: "#3B82F6",
      }),
      description: z.string().nullable().openapi({
        description: "Tag description",
        example: "Articles about technology and innovation",
      }),
      user_id: z.string().uuid().openapi({
        description: "Owner user ID",
        example: "880e8400-e29b-41d4-a716-446655440004",
      }),
      article_count: z.number().openapi({
        description: "Number of tagged articles",
        example: 42,
      }),
      unread_count: z.number().optional().openapi({
        description: "Number of unread articles",
        example: 12,
      }),
      created_at: z.string().openapi({
        description: "Creation timestamp",
        example: "2025-08-01T09:00:00Z",
      }),
      updated_at: z.string().openapi({
        description: "Last update timestamp",
        example: "2025-08-15T10:00:00Z",
      }),
    })
    .openapi({
      description: "Tag entity with metadata",
    })
);

// Tags list response
const TagsListResponseSchema = registry.register(
  "TagsListResponse",
  z
    .object({
      tags: z.array(TagSchema).openapi({
        description: "Array of tags",
      }),
      pagination: z
        .object({
          limit: z.number().openapi({ example: 50 }),
          offset: z.number().openapi({ example: 0 }),
          total: z.number().openapi({ example: 25 }),
          hasMore: z.boolean().openapi({ example: false }),
        })
        .openapi({
          description: "Pagination metadata",
        }),
    })
    .openapi({
      description: "List of tags with pagination",
    })
);

// Tag with articles response
const TagWithArticlesResponseSchema = registry.register(
  "TagWithArticlesResponse",
  TagSchema.extend({
    articles: z
      .array(
        z.object({
          id: z.string().uuid(),
          title: z.string(),
          url: z.string().url(),
          published_at: z.string(),
          is_read: z.boolean(),
          is_starred: z.boolean(),
          feeds: z
            .object({
              id: z.string().uuid(),
              title: z.string(),
            })
            .optional(),
        })
      )
      .optional()
      .openapi({
        description: "Associated articles (when includeArticles=true)",
      }),
  }).openapi({
    description: "Tag with optional associated articles",
  })
);

// Create tag request
const CreateTagRequestSchema = z
  .object({
    name: z.string().min(1).openapi({
      description: "Tag name (required)",
      example: "AI Research",
    }),
    color: z.string().optional().openapi({
      description: "Tag color (hex)",
      example: "#8B5CF6",
    }),
    description: z.string().optional().openapi({
      description: "Tag description",
      example: "Articles about artificial intelligence research",
    }),
  })
  .openapi({
    description: "Create tag request body",
  });

// Update tag request
const UpdateTagRequestSchema = z
  .object({
    name: z.string().min(1).optional().openapi({
      description: "New tag name",
      example: "Machine Learning",
    }),
    color: z.string().nullable().optional().openapi({
      description: "New tag color (hex)",
      example: "#10B981",
    }),
    description: z.string().nullable().optional().openapi({
      description: "New tag description",
      example: "Updated description for the tag",
    }),
  })
  .openapi({
    description: "Update tag request body",
  });

// Delete tag response
const DeleteTagResponseSchema = registry.register(
  "DeleteTagResponse",
  z
    .object({
      message: z.string().openapi({
        example: "Tag deleted successfully",
      }),
    })
    .openapi({
      description: "Tag deletion confirmation",
    })
);

// Summarize request body
const SummarizeRequestSchema = z
  .object({
    regenerate: z.boolean().optional().openapi({
      description: "Force regenerate summary even if cached",
      example: false,
    }),
  })
  .openapi({
    description: "Summarize request options",
  });

// ========== REGISTER ARTICLES ENDPOINTS ==========

// GET /api/articles/paginated
registry.registerPath({
  method: "get",
  path: "/api/articles/paginated",
  description:
    "Retrieve articles with cursor-based pagination. Supports filtering by feed, user, and read status. Articles are sorted by publication date (newest first).",
  summary: "Get paginated articles",
  tags: ["Articles"],
  request: {
    query: z.object({
      cursor: z.string().optional().openapi({
        description: "Pagination cursor from previous response",
        example: "eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9",
      }),
      direction: z.enum(["next", "prev"]).optional().openapi({
        description: "Pagination direction",
        example: "next",
      }),
      pageSize: z.string().optional().openapi({
        description: "Number of articles per page (max 100)",
        example: "50",
      }),
      feedId: z.string().uuid().optional().openapi({
        description: "Filter by feed ID",
        example: "660e8400-e29b-41d4-a716-446655440001",
      }),
      userId: z.string().uuid().optional().openapi({
        description: "Filter by user ID",
        example: "user-456",
      }),
      isRead: z.string().optional().openapi({
        description: "Filter by read status (true/false)",
        example: "false",
      }),
    }),
  },
  responses: {
    200: {
      description: "Articles retrieved successfully",
      content: {
        "application/json": {
          schema: PaginatedArticlesResponseSchema,
          examples: {
            success: {
              summary: "Paginated articles",
              value: {
                articles: [
                  {
                    id: "550e8400-e29b-41d4-a716-446655440000",
                    feed_id: "660e8400-e29b-41d4-a716-446655440001",
                    title: "Breaking News: Tech Innovation",
                    url: "https://example.com/article/123",
                    published_at: "2025-08-15T10:30:00Z",
                    is_read: false,
                    is_starred: true,
                    has_full_content: true,
                    created_at: "2025-08-15T10:31:00Z",
                    updated_at: "2025-08-15T10:35:00Z",
                  },
                ],
                nextCursor:
                  "eyJpZCI6IjU1MGU4NDAwLWUyOWItNDFkNC1hNzE2LTQ0NjY1NTQ0MDAwMCJ9",
                prevCursor: null,
                hasNext: true,
                hasPrev: false,
              },
            },
          },
        },
      },
    },
    400: {
      description: "Invalid cursor format",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            invalidCursor: {
              summary: "Invalid cursor",
              value: {
                error: "Invalid cursor format",
                message: "The provided cursor is not valid",
              },
            },
          },
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Database error",
              value: {
                error: "Failed to fetch articles",
                message: "Database query failed",
              },
            },
          },
        },
      },
    },
  },
});

// POST /api/articles/{id}/fetch-content
registry.registerPath({
  method: "post",
  path: "/api/articles/{id}/fetch-content",
  description:
    "⚠️ **MAKES EXTERNAL HTTP CALLS** - Extract full content from article URL. This endpoint fetches the article webpage and extracts the main content. Rate limited to prevent abuse.",
  summary: "✨ Extract article content (External fetch)",
  tags: ["Articles"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: "Article ID (URL encoded)",
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
    }),
  },
  responses: {
    200: {
      description: "Content extracted successfully",
      content: {
        "application/json": {
          schema: FetchContentResponseSchema,
          examples: {
            extracted: {
              summary: "Content extracted",
              value: {
                success: true,
                article: {
                  id: "550e8400-e29b-41d4-a716-446655440000",
                  has_full_content: true,
                  full_content: "<p>Full article content here...</p>",
                },
                cached: false,
              },
            },
          },
        },
      },
    },
    404: {
      description: "Article not found",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            notFound: {
              summary: "Article not found",
              value: {
                error: "article_not_found",
                message: "Article not found in database",
              },
            },
          },
        },
      },
    },
    429: {
      description: "Rate limit exceeded",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            rateLimit: {
              summary: "Too many requests",
              value: {
                error: "rate_limit",
                message:
                  "Too many concurrent parse requests. Please try again later.",
              },
            },
          },
        },
      },
    },
    500: {
      description: "Extraction failed",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Extraction error",
              value: {
                error: "unexpected_error",
                message: "Failed to extract article content",
              },
            },
          },
        },
      },
    },
  },
});

// POST /api/articles/{id}/summarize
registry.registerPath({
  method: "post",
  path: "/api/articles/{id}/summarize",
  description:
    "⚠️ **USES CLAUDE API** - Generate AI summary for article using Claude. Requires ANTHROPIC_API_KEY. Caches summaries to avoid repeated API calls.",
  summary: "✨ Generate AI summary (Claude API)",
  tags: ["Articles"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: "Article ID",
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: SummarizeRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Summary generated successfully",
      content: {
        "application/json": {
          schema: SummarizeResponseSchema,
          examples: {
            generated: {
              summary: "Summary generated",
              value: {
                success: true,
                summary:
                  "This article explores recent advances in quantum computing, highlighting breakthrough achievements in error correction and practical applications in drug discovery and cryptography.",
                model: "claude-sonnet-4-20250514",
                cached: false,
                regenerated: false,
                input_tokens: 2500,
                output_tokens: 150,
                config: {
                  style: "concise",
                  focus: ["key_points", "innovations"],
                  maxLength: 300,
                },
              },
            },
            cached: {
              summary: "Cached summary returned",
              value: {
                success: true,
                summary:
                  "Previously generated summary about the article's main points...",
                cached: true,
              },
            },
          },
        },
      },
    },
    400: {
      description: "No content to summarize",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            noContent: {
              summary: "No content available",
              value: {
                error: "no_content",
                message: "Article has no content to summarize",
              },
            },
          },
        },
      },
    },
    401: {
      description: "Invalid API key",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            invalidKey: {
              summary: "API key invalid",
              value: {
                error: "invalid_api_key",
                message: "Invalid Claude API key",
              },
            },
          },
        },
      },
    },
    404: {
      description: "Article not found",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            notFound: {
              summary: "Article not found",
              value: {
                error: "article_not_found",
                message: "Article not found",
                details: "No article with specified ID",
              },
            },
          },
        },
      },
    },
    429: {
      description: "Claude API rate limit",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            rateLimit: {
              summary: "API rate limit",
              value: {
                error: "rate_limit",
                message:
                  "Claude API rate limit exceeded. Please try again later.",
              },
            },
          },
        },
      },
    },
    503: {
      description: "Claude API not configured",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            notConfigured: {
              summary: "API not configured",
              value: {
                error: "api_not_configured",
                message: "Claude API key not configured on server",
              },
            },
          },
        },
      },
    },
  },
});

// GET /api/articles/{id}/tags
registry.registerPath({
  method: "get",
  path: "/api/articles/{id}/tags",
  description:
    "Get all tags associated with a specific article. Returns empty array if article has no tags.",
  summary: "Get article tags",
  tags: ["Articles"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: "Article ID",
        example: "550e8400-e29b-41d4-a716-446655440000",
      }),
    }),
  },
  responses: {
    200: {
      description: "Tags retrieved successfully",
      content: {
        "application/json": {
          schema: ArticleTagsResponseSchema,
          examples: {
            withTags: {
              summary: "Article with tags",
              value: {
                tags: [
                  {
                    id: "tag-123",
                    name: "Technology",
                    slug: "technology",
                    color: "#3B82F6",
                    description: "Articles about technology and innovation",
                  },
                  {
                    id: "tag-456",
                    name: "AI",
                    slug: "ai",
                    color: "#8B5CF6",
                    description: null,
                  },
                ],
              },
            },
            noTags: {
              summary: "Article without tags",
              value: {
                tags: [],
              },
            },
          },
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Database error",
              value: {
                error: "Failed to fetch tags",
                message: "Database query failed",
                details: "Connection error",
              },
            },
          },
        },
      },
    },
  },
});

// ========== REGISTER TAGS ENDPOINTS ==========

// GET /api/tags
registry.registerPath({
  method: "get",
  path: "/api/tags",
  description:
    "List all tags for the authenticated user with filtering, sorting, and pagination. Results are automatically scoped to the user's tags only. Includes article counts and unread counts for each tag.",
  summary: "List tags",
  tags: ["Tags"],
  request: {
    query: z.object({
      search: z.string().optional().openapi({
        description: "Search tags by name",
        example: "tech",
      }),
      sortBy: z.enum(["name", "count", "recent"]).optional().openapi({
        description: "Sort field",
        example: "name",
      }),
      order: z.enum(["asc", "desc"]).optional().openapi({
        description: "Sort order",
        example: "asc",
      }),
      limit: z.string().optional().openapi({
        description: "Results per page",
        example: "50",
      }),
      offset: z.string().optional().openapi({
        description: "Pagination offset",
        example: "0",
      }),
      includeEmpty: z.string().optional().openapi({
        description: "Include tags with no articles (true/false)",
        example: "false",
      }),
    }),
  },
  responses: {
    200: {
      description: "Tags retrieved successfully",
      content: {
        "application/json": {
          schema: TagsListResponseSchema,
          examples: {
            success: {
              summary: "Tags list",
              value: {
                tags: [
                  {
                    id: "770e8400-e29b-41d4-a716-446655440003",
                    name: "Technology",
                    slug: "technology",
                    color: "#3B82F6",
                    description: "Tech articles",
                    user_id: "880e8400-e29b-41d4-a716-446655440004",
                    article_count: 42,
                    unread_count: 12,
                    created_at: "2025-08-01T09:00:00Z",
                    updated_at: "2025-08-15T10:00:00Z",
                  },
                ],
                pagination: {
                  limit: 50,
                  offset: 0,
                  total: 25,
                  hasMore: false,
                },
              },
            },
          },
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            userNotFound: {
              summary: "User not found",
              value: {
                error: "User not found",
                message: "No user with specified ID",
              },
            },
          },
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Database error",
              value: {
                error: "Failed to fetch tags",
                message: "Database query failed",
                details: "Connection error",
              },
            },
          },
        },
      },
    },
  },
});

// POST /api/tags
registry.registerPath({
  method: "post",
  path: "/api/tags",
  description:
    "Create a new tag. Automatically generates a URL-friendly slug from the name. Tags must have unique slugs per user. The user_id is automatically set from the authenticated session context.",
  summary: "Create tag",
  tags: ["Tags"],
  request: {
    body: {
      content: {
        "application/json": {
          schema: CreateTagRequestSchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: "Tag created successfully",
      content: {
        "application/json": {
          schema: TagSchema,
          examples: {
            created: {
              summary: "Tag created",
              value: {
                id: "990e8400-e29b-41d4-a716-446655440005",
                name: "AI Research",
                slug: "ai-research",
                color: "#8B5CF6",
                description: "Articles about artificial intelligence research",
                user_id: "880e8400-e29b-41d4-a716-446655440004",
                article_count: 0,
                created_at: "2025-08-15T12:00:00Z",
                updated_at: "2025-08-15T12:00:00Z",
              },
            },
          },
        },
      },
    },
    400: {
      description: "Invalid tag name",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            invalidName: {
              summary: "Name required",
              value: {
                error: "Tag name is required",
                message: "Tag name cannot be empty",
              },
            },
          },
        },
      },
    },
    404: {
      description: "User not found",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            userNotFound: {
              summary: "User not found",
              value: {
                error: "User not found",
                message: "No user with specified ID",
              },
            },
          },
        },
      },
    },
    409: {
      description: "Tag already exists",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            duplicate: {
              summary: "Duplicate tag",
              value: {
                error: "Tag already exists",
                message: "A tag with this slug already exists",
              },
            },
          },
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Database error",
              value: {
                error: "Failed to create tag",
                message: "Database insertion failed",
                details: "Constraint violation",
              },
            },
          },
        },
      },
    },
  },
});

// GET /api/tags/{id}
registry.registerPath({
  method: "get",
  path: "/api/tags/{id}",
  description:
    "Get details for a specific tag owned by the authenticated user. Access is automatically restricted to user's own tags. Optionally include associated articles.",
  summary: "Get tag details",
  tags: ["Tags"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: "Tag ID",
        example: "770e8400-e29b-41d4-a716-446655440003",
      }),
    }),
    query: z.object({
      includeArticles: z.string().optional().openapi({
        description: "Include associated articles (true/false)",
        example: "true",
      }),
      limit: z.string().optional().openapi({
        description: "Max articles to include",
        example: "10",
      }),
    }),
  },
  responses: {
    200: {
      description: "Tag retrieved successfully",
      content: {
        "application/json": {
          schema: TagWithArticlesResponseSchema,
          examples: {
            withoutArticles: {
              summary: "Tag without articles",
              value: {
                id: "tag-123",
                name: "Technology",
                slug: "technology",
                color: "#3B82F6",
                description: "Tech articles",
                user_id: "user-456",
                article_count: 42,
                created_at: "2025-08-01T09:00:00Z",
                updated_at: "2025-08-15T10:00:00Z",
              },
            },
            withArticles: {
              summary: "Tag with articles",
              value: {
                id: "tag-123",
                name: "Technology",
                slug: "technology",
                color: "#3B82F6",
                description: "Tech articles",
                user_id: "user-456",
                article_count: 42,
                created_at: "2025-08-01T09:00:00Z",
                updated_at: "2025-08-15T10:00:00Z",
                articles: [
                  {
                    id: "550e8400-e29b-41d4-a716-446655440000",
                    title: "Tech Innovation News",
                    url: "https://example.com/tech-news",
                    published_at: "2025-08-15T10:00:00Z",
                    is_read: false,
                    is_starred: true,
                    feeds: {
                      id: "feed-123",
                      title: "Tech Blog",
                    },
                  },
                ],
              },
            },
          },
        },
      },
    },
    404: {
      description: "Tag or user not found",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            tagNotFound: {
              summary: "Tag not found",
              value: {
                error: "Tag not found",
                message: "No tag with specified ID",
              },
            },
          },
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Database error",
              value: {
                error: "Internal server error",
                message: "Failed to fetch tag",
                details: "Database query failed",
              },
            },
          },
        },
      },
    },
  },
});

// PATCH /api/tags/{id}
registry.registerPath({
  method: "patch",
  path: "/api/tags/{id}",
  description:
    "Update an existing tag owned by the authenticated user. All fields are optional. Updating the name will regenerate the slug. Access is automatically restricted to user's own tags.",
  summary: "Update tag",
  tags: ["Tags"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: "Tag ID",
        example: "770e8400-e29b-41d4-a716-446655440003",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: UpdateTagRequestSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: "Tag updated successfully",
      content: {
        "application/json": {
          schema: TagSchema,
          examples: {
            updated: {
              summary: "Tag updated",
              value: {
                id: "770e8400-e29b-41d4-a716-446655440003",
                name: "Machine Learning",
                slug: "machine-learning",
                color: "#10B981",
                description: "Updated ML articles",
                user_id: "880e8400-e29b-41d4-a716-446655440004",
                article_count: 42,
                created_at: "2025-08-01T09:00:00Z",
                updated_at: "2025-08-15T12:30:00Z",
              },
            },
          },
        },
      },
    },
    404: {
      description: "Tag or user not found",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            tagNotFound: {
              summary: "Tag not found",
              value: {
                error: "Tag not found",
                message: "No tag with specified ID",
              },
            },
          },
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Database error",
              value: {
                error: "Failed to update tag",
                message: "Database update failed",
                details: "Constraint violation",
              },
            },
          },
        },
      },
    },
  },
});

// DELETE /api/tags/{id}
registry.registerPath({
  method: "delete",
  path: "/api/tags/{id}",
  description:
    "Delete a tag owned by the authenticated user. This will remove the tag and all article associations (CASCADE delete on article_tags). Access is automatically restricted to user's own tags.",
  summary: "Delete tag",
  tags: ["Tags"],
  request: {
    params: z.object({
      id: z.string().uuid().openapi({
        description: "Tag ID",
        example: "770e8400-e29b-41d4-a716-446655440003",
      }),
    }),
  },
  responses: {
    200: {
      description: "Tag deleted successfully",
      content: {
        "application/json": {
          schema: DeleteTagResponseSchema,
          examples: {
            deleted: {
              summary: "Tag deleted",
              value: {
                message: "Tag deleted successfully",
              },
            },
          },
        },
      },
    },
    404: {
      description: "Tag or user not found",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            tagNotFound: {
              summary: "Tag not found",
              value: {
                error: "Tag not found",
                message: "No tag with specified ID",
              },
            },
          },
        },
      },
    },
    500: {
      description: "Server error",
      content: {
        "application/json": {
          schema: SyncErrorResponseSchema,
          examples: {
            error: {
              summary: "Database error",
              value: {
                error: "Failed to delete tag",
                message: "Database deletion failed",
                details: "Foreign key constraint",
              },
            },
          },
        },
      },
    },
  },
});

export function generateOpenAPIDocument(requestServerUrl?: string) {
  const generator = new OpenApiGeneratorV3(registry.definitions);

  // Use the request URL if provided, otherwise fall back to environment variables
  const serverUrl =
    requestServerUrl ||
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
      description:
        "Complete API documentation for the RSS News Reader application including health monitoring, sync operations, articles management, and tags CRUD operations",
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
      {
        name: "Sync Operations",
        description:
          "RSS feed synchronization endpoints for managing sync operations, status tracking, and API usage",
      },
      {
        name: "Articles",
        description:
          "Article management endpoints for pagination, content extraction, AI summarization, and tag associations",
      },
      {
        name: "Tags",
        description:
          "Tag management endpoints for full CRUD operations on article categorization tags",
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

// ========== AUTH SCHEMAS ==========

// Auth Status Response Schema
const AuthStatusResponseSchema = registry.register(
  "AuthStatusResponse",
  z
    .object({
      authenticated: z.boolean().openapi({
        description: "Whether the user has valid OAuth tokens",
        example: true,
      }),
      status: z
        .enum([
          "valid",
          "expiring_soon",
          "expired",
          "no_tokens",
          "invalid_format",
          "unencrypted",
          "empty_tokens",
          "config_error",
          "error",
        ])
        .openapi({
          description: "Current authentication status",
          example: "valid",
        }),
      message: z.string().openapi({
        description: "Human-readable status message",
        example: "OAuth tokens are valid (350 days remaining)",
      }),
      timestamp: z.string().openapi({
        description: "ISO 8601 timestamp of the check",
        example: "2025-08-15T12:00:00Z",
      }),
      tokenAge: z.number().nullable().openapi({
        description: "Age of the token file in days",
        example: 15,
      }),
      daysRemaining: z.number().nullable().openapi({
        description: "Days until token expiration (365 day lifetime)",
        example: 350,
      }),
    })
    .openapi({
      description: "OAuth authentication status information",
    })
);

// ========== TEST SCHEMAS ==========

// Rate Limit Headers Schema
const RateLimitHeadersSchema = z
  .object({
    "X-Reader-Zone1-Usage": z.string().nullable().openapi({
      description: "Zone 1 API usage count",
      example: "150",
    }),
    "X-Reader-Zone1-Limit": z.string().nullable().openapi({
      description: "Zone 1 API limit",
      example: "10000",
    }),
    "X-Reader-Zone2-Usage": z.string().nullable().openapi({
      description: "Zone 2 API usage count",
      example: "50",
    }),
    "X-Reader-Zone2-Limit": z.string().nullable().openapi({
      description: "Zone 2 API limit",
      example: "1000",
    }),
    "X-Reader-Limits-Reset-After": z.string().nullable().openapi({
      description: "Time until rate limit reset",
      example: "3600",
    }),
    "X-Reader-Ratelimits": z.string().nullable().openapi({
      description: "Additional rate limit information",
      example: "zone1=150/10000;zone2=50/1000",
    }),
  })
  .openapi({
    description: "Inoreader API rate limit headers",
  });

// Check Headers Response Schema
const CheckHeadersResponseSchema = registry.register(
  "CheckHeadersResponse",
  z
    .object({
      success: z.boolean().openapi({
        description: "Whether the API call succeeded",
        example: true,
      }),
      status: z.number().openapi({
        description: "HTTP status code from Inoreader API",
        example: 200,
      }),
      rateLimitHeaders: RateLimitHeadersSchema.openapi({
        description: "Rate limit headers with standard casing",
      }),
      caseVariations: RateLimitHeadersSchema.openapi({
        description: "Rate limit headers with lowercase casing",
      }),
      allHeaders: z.record(z.string(), z.string()).openapi({
        description: "All response headers from the API",
        example: {
          "content-type": "application/json",
          "x-reader-zone1-usage": "150",
        },
      }),
      data: z
        .any()
        .nullable()
        .openapi({
          description: "User info data if request succeeded",
          example: {
            userId: "1005921515",
            userName: "user@example.com",
            userProfileId: "1005921515",
          },
        }),
      message: z.string().openapi({
        description: "Informational message",
        example: "Check which headers are actually present in the response",
      }),
    })
    .openapi({
      description: "API header validation response",
    })
);

// Check Headers Error Response Schema
const CheckHeadersErrorSchema = registry.register(
  "CheckHeadersError",
  z
    .object({
      error: z.string().openapi({
        description: "Error code",
        example: "check_failed",
      }),
      message: z.string().openapi({
        description: "Error message",
        example: "Failed to make authenticated request",
      }),
    })
    .openapi({
      description: "Error response for header check",
    })
);

// Register /api/auth/inoreader/status endpoint
registry.registerPath({
  method: "get",
  path: "/api/auth/inoreader/status",
  summary: "Check OAuth authentication status",
  description:
    "Validates the local OAuth token file status without making API calls. Checks token existence, encryption, age, and expiration (365-day lifetime).",
  tags: ["Authentication"],
  responses: {
    200: {
      description: "Authentication status retrieved successfully",
      content: {
        "application/json": {
          schema: AuthStatusResponseSchema,
        },
      },
    },
  },
});

// Register /api/test/check-headers endpoint
registry.registerPath({
  method: "get",
  path: "/api/test/check-headers",
  summary: "Test API connectivity and rate limits",
  description:
    "Makes a single API call to Inoreader to validate token functionality and retrieve rate limit headers. Uses only 1 API call to check sync readiness.",
  tags: ["Testing"],
  responses: {
    200: {
      description: "Headers retrieved successfully",
      content: {
        "application/json": {
          schema: CheckHeadersResponseSchema,
        },
      },
    },
    500: {
      description: "Failed to check headers",
      content: {
        "application/json": {
          schema: CheckHeadersErrorSchema,
        },
      },
    },
  },
});

// Export with test-expected names for backwards compatibility
// ============================================================================
// INOREADER API SCHEMAS
// ============================================================================

const InoreaderUserInfoSchema = z
  .object({
    userId: z.string().openapi({
      description: "User's unique identifier",
      example: "1005921515",
    }),
    userName: z.string().openapi({
      description: "User's display name",
      example: "john.doe",
    }),
    userProfileId: z.string().openapi({
      description: "User's profile identifier",
      example: "1005921515",
    }),
    userEmail: z.string().email().openapi({
      description: "User's email address",
      example: "john.doe@example.com",
    }),
    isBloggerUser: z.boolean().openapi({
      description: "Whether user has blogger features",
      example: false,
    }),
    signupTimeSec: z.number().openapi({
      description: "Signup timestamp in seconds",
      example: 1234567890,
    }),
    isMultiLoginEnabled: z.boolean().openapi({
      description: "Whether multi-login is enabled",
      example: false,
    }),
  })
  .openapi("InoreaderUserInfo");

const InoreaderSubscriptionSchema = z
  .object({
    id: z.string().openapi({
      description: "Feed identifier",
      example: "feed/http://example.com/rss",
    }),
    title: z.string().openapi({
      description: "Feed title",
      example: "Example Blog",
    }),
    categories: z
      .array(
        z.object({
          id: z.string(),
          label: z.string(),
        })
      )
      .openapi({
        description: "Feed categories/folders",
      }),
    url: z.string().url().optional().openapi({
      description: "Feed URL",
      example: "http://example.com/rss",
    }),
    htmlUrl: z.string().url().optional().openapi({
      description: "Website URL",
      example: "http://example.com",
    }),
    iconUrl: z.string().url().optional().openapi({
      description: "Feed icon URL",
    }),
  })
  .openapi("InoreaderSubscription");

const InoreaderStreamItemSchema = z
  .object({
    id: z.string().openapi({
      description: "Article identifier",
      example: "tag:google.com,2005:reader/item/0000000001",
    }),
    title: z.string().openapi({
      description: "Article title",
    }),
    published: z.number().openapi({
      description: "Published timestamp in seconds",
    }),
    updated: z.number().optional().openapi({
      description: "Updated timestamp in seconds",
    }),
    author: z.string().optional().openapi({
      description: "Article author",
    }),
    summary: z
      .object({
        content: z.string(),
      })
      .optional()
      .openapi({
        description: "Article summary/content",
      }),
    alternate: z
      .array(
        z.object({
          href: z.string().url(),
          type: z.string(),
        })
      )
      .optional()
      .openapi({
        description: "Article URLs",
      }),
    categories: z.array(z.string()).optional().openapi({
      description: "Article tags/categories",
    }),
  })
  .openapi("InoreaderStreamItem");

const InoreaderStreamContentsSchema = z
  .object({
    id: z.string().openapi({
      description: "Stream identifier",
    }),
    title: z.string().optional().openapi({
      description: "Stream title",
    }),
    continuation: z.string().optional().openapi({
      description: "Continuation token for pagination",
    }),
    items: z.array(InoreaderStreamItemSchema).openapi({
      description: "Array of stream items/articles",
    }),
  })
  .openapi("InoreaderStreamContents");

const InoreaderUnreadCountSchema = z
  .object({
    id: z.string().openapi({
      description: "Feed/category identifier",
      example: "feed/http://example.com/rss",
    }),
    count: z.number().openapi({
      description: "Number of unread items",
      example: 42,
    }),
    newestItemTimestampUsec: z.string().optional().openapi({
      description: "Timestamp of newest item in microseconds",
      example: "1234567890000000",
    }),
  })
  .openapi("InoreaderUnreadCount");

const InoreaderEditTagResponseSchema = z
  .object({
    success: z.boolean().openapi({
      description: "Whether the operation was successful",
      example: true,
    }),
  })
  .openapi("InoreaderEditTagResponse");

const InoreaderDebugResponseSchema = z
  .object({
    hasAccessToken: z.boolean().openapi({
      description: "Whether access token exists",
    }),
    hasRefreshToken: z.boolean().openapi({
      description: "Whether refresh token exists",
    }),
    expiresAt: z.string().nullable().openapi({
      description: "Token expiration timestamp",
    }),
    expiresIn: z.number().nullable().openapi({
      description: "Time until expiration in milliseconds",
    }),
    isExpired: z.boolean().nullable().openapi({
      description: "Whether token is expired",
    }),
    cookies: z.record(z.string(), z.any()).openapi({
      description: "Cookie information",
    }),
  })
  .openapi("InoreaderDebugResponse");

const InoreaderDevResponseSchema = z
  .object({
    data: z.any().openapi({
      description: "API response data",
    }),
    headers: z.record(z.string(), z.string()).openapi({
      description: "Response headers",
    }),
    debug: z
      .object({
        url: z.string(),
        method: z.string(),
        status: z.number(),
        statusText: z.string(),
        zone1: z.object({
          usage: z.string().nullable(),
          limit: z.string().nullable(),
        }),
        zone2: z.object({
          usage: z.string().nullable(),
          limit: z.string().nullable(),
        }),
        resetAfter: z.string().nullable(),
      })
      .openapi({
        description: "Debug information",
      }),
  })
  .openapi("InoreaderDevResponse");

// ============================================================================
// INOREADER API ENDPOINT REGISTRATIONS
// ============================================================================

// 1. GET /api/inoreader/user-info
registry.registerPath({
  method: "get",
  path: "/api/inoreader/user-info",
  summary: "Get Inoreader user information",
  description:
    "Retrieves authenticated user's profile information from Inoreader. Requires valid OAuth token stored in encrypted file (~/.rss-reader/tokens.json). Tokens are encrypted using AES-256-GCM algorithm with HMAC authentication for secure storage.",
  tags: ["Inoreader"],
  request: {
    query: z.object({
      trigger: z.string().optional().openapi({
        description: "Source that triggered this request (for tracking)",
        example: "manual",
      }),
    }),
  },
  responses: {
    200: {
      description: "User information retrieved successfully",
      headers: RateLimitHeadersSchema,
      content: {
        "application/json": {
          schema: InoreaderUserInfoSchema,
          examples: {
            success: {
              summary: "Successful user info response",
              value: {
                userId: "1005921515",
                userName: "john.doe",
                userProfileId: "1005921515",
                userEmail: "john.doe@example.com",
                isBloggerUser: false,
                signupTimeSec: 1609459200,
                isMultiLoginEnabled: false,
              },
            },
          },
        },
      },
    },
    401: {
      description: "Not authenticated or token expired",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    429: {
      description: "Rate limit exceeded",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// 2. GET /api/inoreader/subscriptions
registry.registerPath({
  method: "get",
  path: "/api/inoreader/subscriptions",
  summary: "Get user's feed subscriptions",
  description:
    "Retrieves the list of RSS feeds the authenticated user is subscribed to. Uses encrypted OAuth tokens (AES-256-GCM) and automatically refreshes expired tokens when possible.",
  tags: ["Inoreader"],
  request: {
    query: z.object({
      trigger: z.string().optional().openapi({
        description: "Source that triggered this request",
        example: "sync",
      }),
    }),
  },
  responses: {
    200: {
      description: "Subscriptions retrieved successfully",
      headers: RateLimitHeadersSchema,
      content: {
        "application/json": {
          schema: z.object({
            subscriptions: z.array(InoreaderSubscriptionSchema),
          }),
          examples: {
            success: {
              summary: "List of subscribed feeds",
              value: {
                subscriptions: [
                  {
                    id: "feed/http://techcrunch.com/feed/",
                    title: "TechCrunch",
                    categories: [
                      { id: "user/1005921515/label/Tech", label: "Tech" },
                    ],
                    url: "http://techcrunch.com/feed/",
                    htmlUrl: "https://techcrunch.com",
                    iconUrl: "https://techcrunch.com/favicon.ico",
                  },
                  {
                    id: "feed/http://feeds.arstechnica.com/arstechnica/index",
                    title: "Ars Technica",
                    categories: [
                      { id: "user/1005921515/label/Tech", label: "Tech" },
                      { id: "user/1005921515/label/Science", label: "Science" },
                    ],
                    url: "http://feeds.arstechnica.com/arstechnica/index",
                    htmlUrl: "https://arstechnica.com",
                  },
                ],
              },
            },
          },
        },
      },
    },
    401: {
      description: "Not authenticated",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// 3. GET /api/inoreader/stream-contents
registry.registerPath({
  method: "get",
  path: "/api/inoreader/stream-contents",
  summary: "Get paginated article stream",
  description:
    "Retrieves articles from a specific stream (feed, folder, or tag). Supports pagination via continuation tokens. Authentication via encrypted OAuth tokens (AES-256-GCM with 16-byte IV and HMAC auth tag).",
  tags: ["Inoreader"],
  request: {
    query: z.object({
      streamId: z.string().openapi({
        description: "Stream identifier (required)",
        example: "user/-/state/com.google/reading-list",
      }),
      n: z.string().optional().openapi({
        description: "Number of items to return (default 20)",
        example: "50",
      }),
      r: z.string().optional().openapi({
        description: "Sort order (n=newest first, o=oldest first)",
        example: "n",
      }),
      c: z.string().optional().openapi({
        description: "Continuation token for pagination",
      }),
      xt: z.string().optional().openapi({
        description: "Exclude target state (e.g., read items)",
        example: "user/-/state/com.google/read",
      }),
      ot: z.string().optional().openapi({
        description: "Only return items older than this timestamp",
      }),
      trigger: z.string().optional().openapi({
        description: "Source that triggered this request",
      }),
    }),
  },
  responses: {
    200: {
      description: "Stream contents retrieved successfully",
      headers: RateLimitHeadersSchema,
      content: {
        "application/json": {
          schema: InoreaderStreamContentsSchema,
          examples: {
            success: {
              summary: "Paginated article stream",
              value: {
                id: "user/-/state/com.google/reading-list",
                title: "Reading List",
                continuation: "CpIBChJjb250aW51YXRpb25fdG9rZW4",
                items: [
                  {
                    id: "tag:google.com,2005:reader/item/0000000001",
                    title: "Breaking: Major Tech Announcement",
                    summary: {
                      content:
                        "<p>Apple announced today a revolutionary new product...</p>",
                    },
                    author: "Jane Smith",
                    published: 1704067200,
                    updated: 1704067200,
                    origin: {
                      streamId: "feed/http://techcrunch.com/feed/",
                      title: "TechCrunch",
                      htmlUrl: "https://techcrunch.com",
                    },
                    canonical: [
                      {
                        href: "https://techcrunch.com/2024/01/01/breaking-news",
                      },
                    ],
                    categories: [
                      "user/1005921515/state/com.google/fresh",
                      "user/1005921515/label/Tech",
                    ],
                  },
                ],
              },
            },
          },
        },
      },
    },
    400: {
      description: "Missing required streamId parameter",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Not authenticated",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// 4. GET /api/inoreader/unread-counts
registry.registerPath({
  method: "get",
  path: "/api/inoreader/unread-counts",
  summary: "Get unread counts per feed",
  description:
    "Retrieves the number of unread articles for each subscription and category.",
  tags: ["Inoreader"],
  request: {
    query: z.object({
      trigger: z.string().optional().openapi({
        description: "Source that triggered this request",
        example: "refresh",
      }),
    }),
  },
  responses: {
    200: {
      description: "Unread counts retrieved successfully",
      headers: RateLimitHeadersSchema,
      content: {
        "application/json": {
          schema: z.object({
            unreadcounts: z.array(InoreaderUnreadCountSchema),
          }),
          examples: {
            success: {
              summary: "Unread counts per feed and category",
              value: {
                unreadcounts: [
                  {
                    id: "feed/http://techcrunch.com/feed/",
                    count: 42,
                    newestItemTimestampUsec: "1704067200000000",
                  },
                  {
                    id: "feed/http://feeds.arstechnica.com/arstechnica/index",
                    count: 15,
                    newestItemTimestampUsec: "1704063600000000",
                  },
                  {
                    id: "user/1005921515/label/Tech",
                    count: 57,
                    newestItemTimestampUsec: "1704067200000000",
                  },
                  {
                    id: "user/-/state/com.google/reading-list",
                    count: 248,
                    newestItemTimestampUsec: "1704067200000000",
                  },
                ],
              },
            },
          },
        },
      },
    },
    401: {
      description: "Not authenticated",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// 5. POST /api/inoreader/edit-tag
registry.registerPath({
  method: "post",
  path: "/api/inoreader/edit-tag",
  summary: "Edit article tags/states",
  description:
    "Modifies tags or states (read/starred/etc) for articles. Accepts form-encoded data with article IDs and actions. Uses encrypted OAuth tokens stored with AES-256-GCM encryption.",
  tags: ["Inoreader"],
  request: {
    query: z.object({
      trigger: z.string().optional().openapi({
        description: "Source that triggered this request",
      }),
    }),
    body: {
      content: {
        "application/x-www-form-urlencoded": {
          schema: z.object({
            i: z.union([z.string(), z.array(z.string())]).openapi({
              description: "Article ID(s) to modify",
              example: "tag:google.com,2005:reader/item/0000000001",
            }),
            a: z.string().optional().openapi({
              description: "Tag to add (e.g., user/-/state/com.google/starred)",
            }),
            r: z.string().optional().openapi({
              description: "Tag to remove",
            }),
            T: z.string().optional().openapi({
              description: "Edit token (if required)",
            }),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Tags edited successfully",
      headers: RateLimitHeadersSchema,
      content: {
        "application/json": {
          schema: InoreaderEditTagResponseSchema,
          examples: {
            markAsRead: {
              summary: "Mark article as read",
              value: "OK",
            },
            addStar: {
              summary: "Star an article",
              value: "OK",
            },
          },
        },
      },
    },
    400: {
      description: "Invalid request parameters",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: "Not authenticated",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
    500: {
      description: "Internal server error",
      content: {
        "application/json": {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// 6. GET /api/inoreader/debug (Development only)
if (process.env.NODE_ENV !== "production") {
  registry.registerPath({
    method: "get",
    path: "/api/inoreader/debug",
    summary: "Debug token status",
    description:
      "[DEV ONLY] Displays current OAuth token status for debugging authentication issues. Tokens are stored in ~/.rss-reader/tokens.json using AES-256-GCM encryption:\n\n**Encryption Details:**\n- Algorithm: AES-256-GCM (Galois/Counter Mode)\n- Key: 256-bit key derived from TOKEN_ENCRYPTION_KEY env variable (base64 encoded)\n- IV: 16-byte random initialization vector\n- Auth Tag: 16-byte HMAC authentication tag for integrity\n- Storage Format: JSON with 'encrypted', 'iv', and 'authTag' fields\n\nThis endpoint reads the encrypted token file, decrypts it, and reports token age and validity.",
    tags: ["Inoreader", "Development"],
    responses: {
      200: {
        description: "Debug information retrieved",
        content: {
          "application/json": {
            schema: InoreaderDebugResponseSchema,
            examples: {
              validTokens: {
                summary: "Valid tokens present",
                value: {
                  fileTokens: {
                    hasAccessToken: true,
                    hasRefreshToken: true,
                    tokenAge: 5,
                    daysOld: 5,
                    expiresIn: 31104000000,
                    isExpired: false,
                    status: "Tokens present",
                    apiUsage: {
                      zone1: { usage: 150, limit: 25000 },
                      zone2: { usage: 50, limit: 10000 },
                    },
                  },
                  environment: {
                    hasEncryptionKey: true,
                    hasClientId: true,
                    hasClientSecret: true,
                    tokenPath: "/Users/user/.rss-reader/tokens.json",
                  },
                  debug: {
                    tokenFileExists: true,
                    isEncrypted: true,
                    lastModified: "5 days ago",
                  },
                },
              },
              missingTokens: {
                summary: "No tokens found",
                value: {
                  fileTokens: {
                    hasAccessToken: false,
                    hasRefreshToken: false,
                    tokenAge: null,
                    daysOld: null,
                    expiresIn: null,
                    isExpired: null,
                    status: "Token file not found",
                    apiUsage: null,
                  },
                  environment: {
                    hasEncryptionKey: true,
                    hasClientId: true,
                    hasClientSecret: true,
                    tokenPath: "/Users/user/.rss-reader/tokens.json",
                  },
                  debug: {
                    tokenFileExists: false,
                    isEncrypted: false,
                    lastModified: null,
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

// 7. GET /api/inoreader/dev (Development only)
if (process.env.NODE_ENV !== "production") {
  registry.registerPath({
    method: "get",
    path: "/api/inoreader/dev",
    summary: "Development API proxy",
    description:
      "[DEV ONLY] Proxies arbitrary Inoreader API endpoints for testing and development. Returns response data with rate limit headers.",
    tags: ["Inoreader", "Development"],
    request: {
      query: z.object({
        endpoint: z.string().openapi({
          description: "Inoreader API endpoint to call",
          example: "stream/contents/user/-/state/com.google/starred",
        }),
        method: z.string().optional().openapi({
          description: "HTTP method (default GET)",
          example: "GET",
        }),
      }),
    },
    responses: {
      200: {
        description: "API response with debug information",
        content: {
          "application/json": {
            schema: InoreaderDevResponseSchema,
            examples: {
              userInfo: {
                summary: "User info endpoint response",
                value: {
                  endpoint: "user-info",
                  data: {
                    userId: "1005921515",
                    userName: "john.doe",
                    userEmail: "john.doe@example.com",
                  },
                  rateLimits: {
                    "X-Reader-Zone1-Usage": "150",
                    "X-Reader-Zone1-Limit": "25000",
                    "X-Reader-Zone2-Usage": "50",
                    "X-Reader-Zone2-Limit": "10000",
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Missing endpoint parameter",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      401: {
        description: "Not authenticated",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      403: {
        description: "Endpoint not available in production",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });

  // Also register POST variant for /api/inoreader/dev
  registry.registerPath({
    method: "post",
    path: "/api/inoreader/dev",
    summary: "Development API proxy (POST)",
    description:
      "[DEV ONLY] Proxies POST requests to Inoreader API endpoints for testing write operations. Uses encrypted OAuth tokens stored with AES-256-GCM encryption for authentication.",
    tags: ["Inoreader", "Development"],
    request: {
      query: z.object({
        endpoint: z.string().openapi({
          description: "Inoreader API endpoint to call",
        }),
      }),
      body: {
        content: {
          "application/json": {
            schema: z.any().openapi({
              description: "Request body to send to Inoreader",
            }),
          },
        },
      },
    },
    responses: {
      200: {
        description: "API response with debug information",
        content: {
          "application/json": {
            schema: InoreaderDevResponseSchema,
            examples: {
              userInfo: {
                summary: "User info endpoint response",
                value: {
                  endpoint: "user-info",
                  data: {
                    userId: "1005921515",
                    userName: "john.doe",
                    userEmail: "john.doe@example.com",
                  },
                  rateLimits: {
                    "X-Reader-Zone1-Usage": "150",
                    "X-Reader-Zone1-Limit": "25000",
                    "X-Reader-Zone2-Usage": "50",
                    "X-Reader-Zone2-Limit": "10000",
                  },
                },
              },
            },
          },
        },
      },
      400: {
        description: "Missing endpoint parameter",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      401: {
        description: "Not authenticated",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      403: {
        description: "Endpoint not available in production",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
      500: {
        description: "Internal server error",
        content: {
          "application/json": {
            schema: ErrorResponseSchema,
          },
        },
      },
    },
  });
}

export {
  MainHealthResponseSchema as healthMainSchema,
  AppHealthResponseSchema as healthAppSchema,
  DbHealthResponseSchema as healthDbSchema,
  CronHealthResponseSchema as healthCronSchema,
  ParsingHealthResponseSchema as healthParsingSchema,
  ClaudeHealthResponseSchema as healthClaudeSchema,
};
