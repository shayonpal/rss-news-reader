import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import crypto from "crypto";
import { z } from "zod";
import type { Database } from "@/lib/db/types";
import {
  encryptApiKey,
  isEncryptionKeyValid,
  sanitizeErrorMessage,
  type EncryptedData,
} from "@/lib/utils/encryption";

// Configuration
// User ID is now provided via route params

// Preferences schemas aligned with src/types/preferences.ts
const AiSchema = z
  .object({
    provider: z.enum(["anthropic", "openai"]).optional(), // Provider field
    model: z.string().min(1).optional(),
    summaryLengthMin: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .transform((val) =>
        val !== undefined ? Math.max(1, Math.min(10, val)) : val
      ), // Clamp to 1-10 range
    summaryLengthMax: z
      .number()
      .int()
      .min(1)
      .max(10)
      .optional()
      .transform((val) =>
        val !== undefined ? Math.max(1, Math.min(10, val)) : val
      ), // Clamp to 1-10 range
    summaryStyle: z
      .enum(["objective", "analytical", "concise", "detailed", "retrospective"]) // Added retrospective
      .optional(),
    contentFocus: z
      .enum([
        "general",
        "technical",
        "business",
        "educational",
        "key-points",
        "main-arguments",
        "comprehensive",
      ]) // Added more options
      .nullable()
      .optional(),
    // Client may send apiKey change instructions in PUT
    apiKeyChange: z.enum(["replace", "clear"]).optional(),
    apiKey: z
      .union([
        z.object({
          encrypted: z.string(),
          iv: z.string(),
          authTag: z.string(),
        }),
        z.string(),
        z.null(),
      ])
      .optional(),
  })
  .strict();

const SyncSchema = z
  .object({
    maxArticles: z.number().int().min(1).max(5000).optional(),
    retentionCount: z.number().int().min(1).optional(),
  })
  .strict();

const BasePreferencesSchema = z
  .object({
    ai: AiSchema.optional(),
    sync: SyncSchema.optional(),
  })
  .strict();
// API Key Action schema with discriminated union for better type safety
const ApiKeyActionSchema = z.discriminatedUnion("action", [
  z.object({
    provider: z.enum(["anthropic", "openai"]),
    action: z.literal("update"),
    apiKey: z.string().min(1), // Required for update
  }),
  z.object({
    provider: z.enum(["anthropic", "openai"]),
    action: z.literal("keep"),
  }),
  z.object({
    provider: z.enum(["anthropic", "openai"]),
    action: z.literal("clear"),
  }),
]);

// Schema for stored preferences (includes encrypted data bucket)
const PreferencesSchema = BasePreferencesSchema.extend({
  ai: AiSchema.extend({
    // Server-managed boolean; never populated from client writes
    hasApiKey: z.boolean().optional(),
  }).optional(),
  encryptedData: z
    .object({
      apiKeys: z
        .object({
          anthropic: z
            .object({
              encrypted: z.string(),
              iv: z.string(),
              authTag: z.string(),
            })
            .optional(),
        })
        .strict()
        .optional(),
      keyVersion: z.number().int().optional(),
    })
    .optional(),
}).strict();

type UserPreferences = z.infer<typeof PreferencesSchema>;

// Response schema (client-facing); never returns secrets
const PreferencesResponseSchema = z
  .object({
    ai: z
      .object({
        provider: z.enum(["anthropic", "openai"]), // Add provider field
        hasApiKey: z.boolean(),
        model: z.string(),
        summaryLengthMin: z.number(),
        summaryLengthMax: z.number(),
        summaryStyle: z.enum([
          "objective",
          "analytical",
          "concise",
          "detailed",
          "retrospective",
        ]),
        contentFocus: z
          .enum([
            "general",
            "technical",
            "business",
            "educational",
            "key-points",
            "main-arguments",
            "comprehensive",
          ])
          .nullable(),
      })
      .optional(),
    sync: z
      .object({
        maxArticles: z.number(),
        retentionCount: z.number(),
      })
      .optional(),
  })
  .strict();

type PreferencesResponse = z.infer<typeof PreferencesResponseSchema>;

// Cache for preferences with TTL and size limit
interface CachedPreferences {
  data: PreferencesResponse;
  expires: number;
  lastAccessed: number;
}

class BoundedCache {
  private cache = new Map<string, CachedPreferences>();
  private readonly maxSize = 100; // Maximum cache entries
  private readonly ttl = 5 * 60 * 1000; // 5 minutes
  private readonly memoryThreshold = 0.8; // 80% memory usage threshold
  private lastCleanup = Date.now();
  private cleanupCount = 0;

  get(key: string): PreferencesResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    // Check if expired
    if (entry.expires < Date.now()) {
      this.cache.delete(key);
      return null;
    }

    // Update last accessed time
    entry.lastAccessed = Date.now();
    return entry.data;
  }

  set(key: string, data: PreferencesResponse): void {
    // If cache is at max size, remove least recently accessed entry
    if (this.cache.size >= this.maxSize && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl,
      lastAccessed: Date.now(),
    });

    // Check if adaptive cleanup is needed
    this.adaptiveCleanup();
  }

  delete(key: string): void {
    this.cache.delete(key);
  }

  private evictLRU(): void {
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [k, v] of this.cache.entries()) {
      if (v.lastAccessed < lruTime) {
        lruKey = k;
        lruTime = v.lastAccessed;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
    }
  }

  private adaptiveCleanup(): void {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.lastCleanup;

    // Adaptive cleanup interval based on cache size and activity
    const cleanupInterval =
      this.cache.size > this.maxSize * 0.7
        ? 60 * 1000 // 1 minute if cache is getting full
        : 5 * 60 * 1000; // 5 minutes otherwise

    if (timeSinceLastCleanup > cleanupInterval) {
      this.cleanup();
      this.lastCleanup = now;
    }
  }

  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
        removed++;
      }
    }

    this.cleanupCount++;

    // Log cleanup stats in development
    if (process.env.NODE_ENV === "development" && removed > 0) {
      console.log(
        `[Cache] Cleanup #${this.cleanupCount}: removed ${removed} expired entries, ${this.cache.size} remaining`
      );
    }
  }

  // Get cache statistics
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      cleanupCount: this.cleanupCount,
      lastCleanup: this.lastCleanup,
    };
  }
}

const preferencesCache = new BoundedCache();

// Run cleanup every 5 minutes (aligned with cache TTL)
let cleanupInterval: NodeJS.Timeout | undefined;
if (typeof setInterval !== "undefined") {
  cleanupInterval = setInterval(
    () => preferencesCache.cleanup(),
    5 * 60 * 1000
  );
}

// Clean up on process exit (for testing)
if (typeof process !== "undefined" && cleanupInterval) {
  process.on("exit", () => clearInterval(cleanupInterval));
}

// Default preferences from environment variables
function getDefaultPreferences(): PreferencesResponse {
  return {
    ai: {
      provider: "anthropic" as const,
      hasApiKey: false,
      model: process.env.DEFAULT_SUMMARY_MODEL || "claude-3-haiku-20240307",
      summaryLengthMin: Number(process.env.SUMMARY_LENGTH_MIN || 100),
      summaryLengthMax: Number(process.env.SUMMARY_LENGTH_MAX || 300),
      summaryStyle:
        (process.env.SUMMARY_STYLE as
          | "objective"
          | "analytical"
          | "concise"
          | "detailed") || "objective",
      contentFocus:
        (process.env.SUMMARY_CONTENT_FOCUS as
          | "general"
          | "technical"
          | "business"
          | "educational") || "general",
    },
    sync: {
      maxArticles: parseInt(process.env.SYNC_MAX_ARTICLES || "100", 10), // RR-274: Default to 100
      retentionCount: parseInt(process.env.ARTICLES_RETENTION_COUNT || "2000", 10), // RR-274: Default to 2000 articles
    },
  };
}

// Transform stored preferences to response format (mask sensitive data)
function transformToResponse(stored: UserPreferences): PreferencesResponse {
  const defaults = getDefaultPreferences();

  // Determine provider (default to anthropic for backward compatibility)
  const provider = stored.ai?.provider || "anthropic";

  // Check for encrypted API key for the current provider
  const hasApiKey = Boolean(
    stored.encryptedData?.apiKeys?.[provider]?.encrypted
  );

  return {
    ai: {
      provider, // Include provider in response
      hasApiKey,
      model: stored.ai?.model ?? defaults.ai!.model,
      summaryLengthMin:
        stored.ai?.summaryLengthMin ?? defaults.ai!.summaryLengthMin,
      summaryLengthMax:
        stored.ai?.summaryLengthMax ?? defaults.ai!.summaryLengthMax,
      summaryStyle: stored.ai?.summaryStyle ?? defaults.ai!.summaryStyle,
      contentFocus:
        stored.ai?.contentFocus === undefined
          ? defaults.ai!.contentFocus
          : (stored.ai?.contentFocus ?? null),
    },
    sync: {
      maxArticles: stored.sync?.maxArticles ?? defaults.sync!.maxArticles,
      retentionCount:
        stored.sync?.retentionCount ?? defaults.sync!.retentionCount,
    },
  };
}

// Input schema for PUT requests (what clients send)
// Schema for input preferences (plaintext API keys)
const PreferencesInputSchema = BasePreferencesSchema.extend({
  apiKeyAction: ApiKeyActionSchema.optional(), // New apiKeyAction protocol
});

type PreferencesInput = z.infer<typeof PreferencesInputSchema>;

// Transform request to storage format (encrypt sensitive data)
function transformToStorage(
  request: PreferencesInput,
  current: UserPreferences
): UserPreferences {
  // Initialize with proper types using spread operators
  const next: UserPreferences = {
    ai: current.ai ? { ...current.ai } : undefined,
    sync: current.sync ? { ...current.sync } : undefined,
    encryptedData: current.encryptedData
      ? { ...current.encryptedData }
      : undefined,
  };

  // Merge AI preferences
  if (request.ai) {
    if (!next.ai) {
      next.ai = {};
    }

    // Update AI fields with proper typing
    if (request.ai.provider !== undefined) {
      next.ai.provider = request.ai.provider;
    }
    if (request.ai.model !== undefined) {
      next.ai.model = request.ai.model;
    }
    if (request.ai.summaryLengthMin !== undefined) {
      next.ai.summaryLengthMin = request.ai.summaryLengthMin;
    }
    if (request.ai.summaryLengthMax !== undefined) {
      next.ai.summaryLengthMax = request.ai.summaryLengthMax;
    }
    if (request.ai.summaryStyle !== undefined) {
      next.ai.summaryStyle = request.ai.summaryStyle;
    }
    if (request.ai.contentFocus !== undefined) {
      next.ai.contentFocus = request.ai.contentFocus;
    }
  }

  // Merge Sync preferences
  if (request.sync) {
    if (!next.sync) {
      next.sync = {};
    }

    // Update sync fields with proper typing
    if (request.sync.maxArticles !== undefined) {
      next.sync.maxArticles = request.sync.maxArticles;
    }
    if (request.sync.retentionCount !== undefined) {
      next.sync.retentionCount = request.sync.retentionCount;
    }
  }

  // Handle new apiKeyAction protocol
  if (request.apiKeyAction) {
    const { provider, action } = request.apiKeyAction;

    // Ensure encryptedData structure exists
    if (!next.encryptedData) {
      next.encryptedData = {};
    }
    if (!next.encryptedData.apiKeys) {
      next.encryptedData.apiKeys = {};
    }

    switch (action) {
      case "clear":
        // Clear the API key for the specified provider
        if (next.encryptedData.apiKeys) {
          next.encryptedData.apiKeys[provider] = undefined;
        }
        // Update hasApiKey flag
        if (!next.ai) {
          next.ai = {};
        }
        next.ai.hasApiKey = false;
        break;

      case "update":
        if (action === "update" && !request.apiKeyAction.apiKey) {
          throw new Error("API key required for update action");
        }

        // Encrypt and store the new API key
        const encrypted = encryptApiKey(request.apiKeyAction.apiKey!);
        if (!next.encryptedData.apiKeys) {
          next.encryptedData.apiKeys = {};
        }
        next.encryptedData.apiKeys[provider] = encrypted;

        // Update hasApiKey flag
        if (!next.ai) {
          next.ai = {};
        }
        next.ai.hasApiKey = true;
        break;

      case "keep":
        // No changes to API key - keep existing
        break;
    }
  }
  // Handle legacy apiKeyChange if present (backward compatibility)
  else if (request.ai?.apiKeyChange) {
    // Ensure encryptedData structure exists
    if (!next.encryptedData) {
      next.encryptedData = {};
    }
    if (!next.encryptedData.apiKeys) {
      next.encryptedData.apiKeys = {};
    }

    if (request.ai.apiKeyChange === "clear") {
      // Clear the API key (default to anthropic for legacy)
      const provider = request.ai.provider || "anthropic";
      if (next.encryptedData.apiKeys) {
        next.encryptedData.apiKeys[provider] = undefined;
      }
      // Update hasApiKey flag
      if (!next.ai) {
        next.ai = {};
      }
      next.ai.hasApiKey = false;
    } else if (request.ai.apiKeyChange === "replace") {
      const val = request.ai.apiKey;
      let enc: EncryptedData | null = null;

      if (val && typeof val === "object" && "encrypted" in val) {
        enc = val as EncryptedData;
      } else if (typeof val === "string") {
        enc = encryptApiKey(val);
      }

      if (!enc) {
        throw new Error("Invalid or missing API key for replacement");
      }

      // Store encrypted API key (default to anthropic for legacy)
      const provider = request.ai.provider || "anthropic";
      if (!next.encryptedData.apiKeys) {
        next.encryptedData.apiKeys = {};
      }
      next.encryptedData.apiKeys[provider] = enc;

      // Update hasApiKey flag
      if (!next.ai) {
        next.ai = {};
      }
      next.ai.hasApiKey = true;
    }
  }

  return next;
}

// Helper to compute an ETag for a response body
function computeEtag(payload: unknown): string {
  const json = JSON.stringify(payload);
  const hash = crypto.createHash("sha256").update(json).digest("hex");
  return `"${hash}"`;
}

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user ID from route params
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    const cacheKey = `preferences:${userId}`;

    // Check cache with the actual user ID and If-None-Match
    const cached = preferencesCache.get(cacheKey);
    const ifNoneMatch = req.headers.get("if-none-match");
    if (cached) {
      const etag = computeEtag(cached);
      if (ifNoneMatch && ifNoneMatch === etag) {
        return new NextResponse(null, { status: 304, headers: { ETag: etag } });
      }
      return NextResponse.json(cached, { headers: { ETag: etag } });
    }

    // Initialize Supabase client
    const supabase = createClient();

    // Fetch user preferences from database (single query)
    const { data: user, error } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    if (error) {
      // If user not found, return 404
      if (error.code === "PGRST116") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }

      // Error fetching user preferences
      return NextResponse.json(
        { error: "Failed to fetch preferences" },
        { status: 500 }
      );
    }

    // Parse and validate stored preferences
    let storedPreferences: UserPreferences = {};
    if (user?.preferences) {
      const parseResult = PreferencesSchema.safeParse(user.preferences);
      if (parseResult.success) {
        storedPreferences = parseResult.data;
      }
    }

    // Transform to response format and cache
    const mergedPreferences = transformToResponse(storedPreferences);
    preferencesCache.set(cacheKey, mergedPreferences);

    const etag = computeEtag(mergedPreferences);
    return NextResponse.json(mergedPreferences, { headers: { ETag: etag } });
  } catch (error) {
    // Unexpected error in GET /api/users/preferences
    console.error("[Preferences] GET error:", {
      error:
        error instanceof Error
          ? sanitizeErrorMessage(error.message)
          : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    return NextResponse.json(
      {
        error: "Failed to retrieve preferences",
        details:
          error instanceof Error
            ? sanitizeErrorMessage(error.message)
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get user ID from route params
    const userId = params.id;

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }
    // Validate request size (limit to 10KB for preferences)
    const contentLength = req.headers?.get?.("content-length");
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!isNaN(size) && size > 10240) {
        return NextResponse.json(
          {
            error: "Request too large",
            details: "Preferences data must be less than 10KB",
          },
          { status: 413 }
        );
      }
    }

    // Parse request body with error handling
    let body: unknown;
    try {
      body = await req.json();
    } catch (parseError) {
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: "Request body must be valid JSON",
        },
        { status: 400 }
      );
    }

    // Validate input schema first
    const inputValidation = PreferencesInputSchema.safeParse(body);
    if (!inputValidation.success) {
      return NextResponse.json(
        {
          error: "UNPROCESSABLE_ENTITY",
          message: "Invalid preferences data",
          details: inputValidation.error.issues,
        },
        { status: 422 }
      );
    }

    // Initialize Supabase client
    const supabase = createClient();

    // Get current preferences from database
    const { data: currentUser } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();
    const currentPrefsParsed = PreferencesSchema.safeParse(
      currentUser?.preferences || {}
    );
    const currentPrefs: UserPreferences = currentPrefsParsed.success
      ? currentPrefsParsed.data
      : {};

    // Validate AI model against ai_models table if present
    if (inputValidation.data.ai?.model) {
      const { data: modelExists, error: modelError } = await supabase
        .from("ai_models")
        .select("model_id")
        .eq("model_id", inputValidation.data.ai.model)
        .single();

      if (modelError || !modelExists) {
        return NextResponse.json(
          { error: "INVALID_MODEL", message: "Invalid AI model specified" },
          { status: 422 }
        );
      }
    }

    // Prepare merged storage object and validate
    const storageData = transformToStorage(inputValidation.data, currentPrefs);
    const validationResult = PreferencesSchema.safeParse(storageData);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "UNPROCESSABLE_ENTITY",
          message: "Invalid preferences data",
          details: validationResult.error.issues,
        },
        { status: 422 }
      );
    }

    const preferences = validationResult.data;
    const cacheKey = `preferences:${userId}`;

    // Optional optimistic concurrency via If-Match
    const ifMatch = req.headers.get("if-match");
    if (ifMatch) {
      const currentResponse = transformToResponse(currentPrefs);
      const currentEtag = computeEtag(currentResponse);
      if (ifMatch !== currentEtag) {
        return NextResponse.json(
          {
            error: "ETAG_MISMATCH",
            message: "Resource has been modified. Please reload and retry.",
          },
          { status: 409 }
        );
      }
    }

    // merged object already computed: preferences
    const updatedPrefs: UserPreferences = preferences;

    // Update the preferences
    const { error: updateError } = await supabase
      .from("users")
      .update({
        preferences: updatedPrefs,
        updated_at: new Date().toISOString(),
      })
      .eq("id", userId);

    if (updateError) {
      // Error updating user preferences
      return NextResponse.json(
        { error: "INTERNAL_ERROR", message: "Failed to update preferences" },
        { status: 500 }
      );
    }

    // Invalidate cache
    preferencesCache.delete(cacheKey);

    // Transform and return the updated preferences directly
    // No need to fetch from database again - we just updated it
    const mergedPreferences = transformToResponse(updatedPrefs);
    const etag = computeEtag(mergedPreferences);
    return NextResponse.json(mergedPreferences, { headers: { ETag: etag } });
  } catch (error) {
    // Unexpected error in PUT /api/users/preferences
    console.error("[Preferences] PUT error:", {
      error:
        error instanceof Error
          ? sanitizeErrorMessage(error.message)
          : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString(),
    });

    // Provide specific error context based on the error type
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          error: "Invalid request format",
          details: "Request body must be valid JSON",
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: "INTERNAL_ERROR",
        message: "Failed to update preferences",
        details:
          error instanceof Error
            ? sanitizeErrorMessage(error.message)
            : "An unexpected error occurred",
      },
      { status: 500 }
    );
  }
}
