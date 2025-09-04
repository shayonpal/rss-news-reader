import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import crypto from "crypto";
import type { Database } from "@/lib/db/types";

// Configuration
const DEFAULT_INOREADER_ID = process.env.DEFAULT_INOREADER_ID || "shayon"; // Single-user system

// Encryption utilities for sensitive data
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY || "";
const ENCRYPTION_ALGORITHM = "aes-256-gcm";

// Validate encryption key at module load time
function validateEncryptionKey(): void {
  if (!ENCRYPTION_KEY) {
    console.warn("[Preferences] TOKEN_ENCRYPTION_KEY not set - API keys will not be encrypted");
    return;
  }
  
  // Check if it's a valid 64-character hex string (256 bits)
  if (!/^[0-9a-fA-F]{64}$/.test(ENCRYPTION_KEY)) {
    console.error("[Preferences] TOKEN_ENCRYPTION_KEY must be a 64-character hex string");
  }
}

// Run validation on module load
validateEncryptionKey();

function encrypt(text: string): { encrypted: string; iv: string; authTag: string } {
  if (!ENCRYPTION_KEY) {
    throw new Error("Encryption key not configured");
  }
  
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, Buffer.from(ENCRYPTION_KEY, "hex"), iv);
  
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag();
  
  return {
    encrypted,
    iv: iv.toString("hex"),
    authTag: authTag.toString("hex"),
  };
}

function decrypt(encrypted: string, iv: string, authTag: string): string {
  if (!ENCRYPTION_KEY) {
    throw new Error("Encryption key not configured");
  }
  
  const decipher = crypto.createDecipheriv(
    ENCRYPTION_ALGORITHM, 
    Buffer.from(ENCRYPTION_KEY, "hex"), 
    Buffer.from(iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  
  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");
  
  return decrypted;
}

// Nested preferences schema matching Linear specification
// Base schema for shared preferences structure
const BasePreferencesSchema = z.object({
  ai: z.object({
    model: z.string().optional(),
    summaryWordCount: z.string().regex(/^\d+-\d+$/).optional().refine(
      (val) => {
        if (!val) return true;
        const [min, max] = val.split('-').map(Number);
        // Validate range relationship and reasonable bounds
        if (min > max) return false;
        if (min < 10 || min > 500) return false; // Reasonable minimum bounds
        if (max < 20 || max > 1000) return false; // Reasonable maximum bounds
        return true;
      },
      { message: "Word count must be between 10-500 for minimum and 20-1000 for maximum, with min ≤ max" }
    ),
    summaryStyle: z.enum(["objective", "analytical", "retrospective"]).optional(),
  }).optional(),
  sync: z.object({
    maxArticles: z.number().min(10).max(1000).optional(),
    retentionCount: z.number().min(1).max(365).optional(),
    batchSize: z.number().min(1).max(100).optional(),
  }).optional(),
});

// Schema for stored preferences (includes encrypted data)
const PreferencesSchema = BasePreferencesSchema.extend({
  encryptedData: z.object({
    apiKeys: z.record(z.string(), z.object({
      encrypted: z.string(),
      iv: z.string(),
      authTag: z.string(),
    })).optional(),
  }).optional(),
});

type UserPreferences = z.infer<typeof PreferencesSchema>;

// Response schema (excludes encrypted data internals)
const PreferencesResponseSchema = z.object({
  ai: z.object({
    model: z.string().optional(),
    summaryWordCount: z.string().optional(),
    summaryStyle: z.enum(["objective", "analytical", "retrospective"]).optional(),
  }).optional(),
  sync: z.object({
    maxArticles: z.number().optional(),
    retentionCount: z.number().optional(),
    batchSize: z.number().optional(),
  }).optional(),
  // Don't expose encrypted data structure to clients
  apiKeys: z.record(z.string(), z.string()).optional(),
});

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
    
    this.cache.set(key, {
      data,
      expires: Date.now() + this.ttl,
      lastAccessed: Date.now()
    });
  }
  
  delete(key: string): void {
    this.cache.delete(key);
  }
  
  // Clean up expired entries periodically
  cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < now) {
        this.cache.delete(key);
      }
    }
  }
}

const preferencesCache = new BoundedCache();

// Run cleanup every 5 minutes (aligned with cache TTL)
let cleanupInterval: NodeJS.Timeout | undefined;
if (typeof setInterval !== 'undefined') {
  cleanupInterval = setInterval(() => preferencesCache.cleanup(), 5 * 60 * 1000);
}

// Clean up on process exit (for testing)
if (typeof process !== 'undefined' && cleanupInterval) {
  process.on('exit', () => clearInterval(cleanupInterval));
}

// Default preferences from environment variables
function getDefaultPreferences(): PreferencesResponse {
  return {
    ai: {
      model: "claude-3-haiku-20240307",
      summaryWordCount: process.env.SUMMARY_WORD_COUNT || "70-80",
      summaryStyle: (process.env.SUMMARY_STYLE as "objective" | "analytical" | "retrospective") || "objective",
    },
    sync: {
      maxArticles: parseInt(process.env.SYNC_MAX_ARTICLES || "100", 10),
      retentionCount: parseInt(process.env.ARTICLES_RETENTION_DAYS || "30", 10),
      batchSize: parseInt(process.env.SYNC_BATCH_SIZE || "20", 10),
    },
  };
}

// Transform stored preferences to response format (decrypt sensitive data)
function transformToResponse(stored: UserPreferences): PreferencesResponse {
  const response: PreferencesResponse = {
    ai: stored.ai,
    sync: stored.sync,
  };
  
  // Decrypt API keys if present
  if (stored.encryptedData?.apiKeys) {
    response.apiKeys = {};
    for (const [key, encData] of Object.entries(stored.encryptedData.apiKeys)) {
      try {
        response.apiKeys[key] = decrypt(encData.encrypted, encData.iv, encData.authTag);
      } catch (error) {
        // Log decryption failure for security monitoring
        console.error(`[Preferences] Failed to decrypt API key '${key}':`, {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: new Date().toISOString(),
          inoreader_id: DEFAULT_INOREADER_ID
        });
        // Omit the key from response to maintain security
      }
    }
  }
  
  return response;
}

// Input schema for PUT requests (what clients send)
// Schema for input preferences (plaintext API keys)
const PreferencesInputSchema = BasePreferencesSchema.extend({
  apiKeys: z.record(z.string(), z.string()).optional(),
});

type PreferencesInput = z.infer<typeof PreferencesInputSchema>;

// Transform request to storage format (encrypt sensitive data)
function transformToStorage(request: PreferencesInput): UserPreferences {
  const stored: UserPreferences = {
    ai: request.ai,
    sync: request.sync,
  };
  
  // Encrypt API keys if provided
  if (request.apiKeys && typeof request.apiKeys === 'object') {
    stored.encryptedData = { apiKeys: {} };
    for (const [key, value] of Object.entries(request.apiKeys)) {
      if (typeof value === 'string') {
        stored.encryptedData.apiKeys[key] = encrypt(value);
      }
    }
  }
  
  return stored;
}

export async function GET(req: NextRequest) {
  try {
    // Initialize Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First get the actual user ID from inoreader_id
    const { data: userData, error: userLookupError } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", DEFAULT_INOREADER_ID)
      .single();

    if (userLookupError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userData.id;
    const cacheKey = `preferences:${userId}`;
    
    // Check cache with the actual user ID
    const cached = preferencesCache.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Fetch user preferences from database
    const { data: user, error } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    if (error) {
      // If user not found, return 404
      if (error.code === "PGRST116") {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
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

    // Transform to response format and merge with defaults
    const defaults = getDefaultPreferences();
    const transformed = transformToResponse(storedPreferences);
    const mergedPreferences: PreferencesResponse = {
      ai: {
        ...defaults.ai,
        ...transformed.ai,
      },
      sync: {
        ...defaults.sync,
        ...transformed.sync,
      },
      ...(transformed.apiKeys && { apiKeys: transformed.apiKeys }),
    };

    // Update cache
    preferencesCache.set(cacheKey, mergedPreferences);

    return NextResponse.json(mergedPreferences);
  } catch (error) {
    // Unexpected error in GET /api/users/preferences
    console.error('[Preferences] GET error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    return NextResponse.json(
      { 
        error: "Failed to retrieve preferences",
        details: error instanceof Error ? error.message : "An unexpected error occurred"
      },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  try {
    // Validate request size (limit to 10KB for preferences)
    const contentLength = req.headers?.get?.('content-length');
    if (contentLength) {
      const size = parseInt(contentLength, 10);
      if (!isNaN(size) && size > 10240) {
        return NextResponse.json(
          { 
            error: "Request too large",
            details: "Preferences data must be less than 10KB"
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
          details: "Request body must be valid JSON"
        },
        { status: 400 }
      );
    }

    // Validate input schema first
    const inputValidation = PreferencesInputSchema.safeParse(body);
    if (!inputValidation.success) {
      return NextResponse.json(
        { 
          error: "Invalid preferences data",
          details: inputValidation.error.issues 
        },
        { status: 400 }
      );
    }
    
    // Transform and validate for storage
    const storageData = transformToStorage(inputValidation.data);
    const validationResult = PreferencesSchema.safeParse(storageData);
    if (!validationResult.success) {
      return NextResponse.json(
        { error: "Invalid preferences data", details: validationResult.error.issues },
        { status: 400 }
      );
    }

    const preferences = validationResult.data;

    // Initialize Supabase client
    const supabase = createClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // First get the actual user ID from inoreader_id
    const { data: userData, error: userLookupError } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", DEFAULT_INOREADER_ID)
      .single();

    if (userLookupError || !userData) {
      return NextResponse.json(
        { error: "User not found" },
        { status: 404 }
      );
    }

    const userId = userData.id;
    const cacheKey = `preferences:${userId}`;

    // If AI model is provided, validate it against ai_models table
    if (preferences.ai?.model) {
      const { data: modelExists, error: modelError } = await supabase
        .from("ai_models")
        .select("model_id")
        .eq("model_id", preferences.ai.model)
        .single();

      if (modelError || !modelExists) {
        return NextResponse.json(
          { error: "Invalid AI model specified" },
          { status: 400 }
        );
      }
    }

    // Get current preferences for merging
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    if (userError) {
      if (userError.code === "PGRST116") {
        return NextResponse.json(
          { error: "User not found" },
          { status: 404 }
        );
      }
      throw userError;
    }

    // Parse existing preferences
    let currentPrefs: UserPreferences = {};
    if (user?.preferences) {
      const parseResult = PreferencesSchema.safeParse(user.preferences);
      if (parseResult.success) {
        currentPrefs = parseResult.data;
      }
    }

    // Deep merge preferences (nested structure)
    const updatedPrefs: UserPreferences = {
      ai: {
        ...currentPrefs.ai,
        ...preferences.ai,
      },
      sync: {
        ...currentPrefs.sync,
        ...preferences.sync,
      },
      encryptedData: {
        apiKeys: {
          ...currentPrefs.encryptedData?.apiKeys,
          ...preferences.encryptedData?.apiKeys,
        },
      },
    };

    // Update the preferences
    const { error: updateError } = await supabase
      .from("users")
      .update({ 
        preferences: updatedPrefs,
        updated_at: new Date().toISOString()
      })
      .eq("id", userId);

    if (updateError) {
      // Error updating user preferences
      return NextResponse.json(
        { error: "Failed to update preferences" },
        { status: 500 }
      );
    }

    // Invalidate cache
    preferencesCache.delete(cacheKey);

    // Transform and return the updated preferences directly
    // No need to fetch from database again - we just updated it
    const defaults = getDefaultPreferences();
    const transformed = transformToResponse(updatedPrefs);
    const mergedPreferences: PreferencesResponse = {
      ai: {
        ...defaults.ai,
        ...transformed.ai,
      },
      sync: {
        ...defaults.sync,
        ...transformed.sync,
      },
      ...(transformed.apiKeys && { apiKeys: transformed.apiKeys }),
    };

    return NextResponse.json(mergedPreferences);
  } catch (error) {
    // Unexpected error in PUT /api/users/preferences
    console.error('[Preferences] PUT error:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      timestamp: new Date().toISOString()
    });
    
    // Provide specific error context based on the error type
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { 
          error: "Invalid request format",
          details: "Request body must be valid JSON"
        },
        { status: 400 }
      );
    }
    
    return NextResponse.json(
      { 
        error: "Failed to update preferences",
        details: error instanceof Error ? error.message : "An unexpected error occurred"
      },
      { status: 500 }
    );
  }
}