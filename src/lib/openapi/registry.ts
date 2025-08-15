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
      {
        name: "Sync Operations",
        description:
          "RSS feed synchronization endpoints for managing sync operations, status tracking, and API usage",
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
