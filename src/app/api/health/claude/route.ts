import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  decrypt,
  sanitizeErrorMessage,
  type EncryptedData,
} from "@/lib/utils/encryption";
import { ApiKeyCache, type DecryptionMetrics } from "@/lib/utils/api-key-cache";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize cache singleton
const apiKeyCache = ApiKeyCache.getInstance();

export async function GET(request: NextRequest) {
  try {
    // Get user ID from auth header if provided
    const authHeader = request.headers.get("authorization");
    let userId: string | null = null;
    let keySource: "user" | "environment" | "none" = "none";
    let apiKey: string | null = null;
    let decryptionMetrics: DecryptionMetrics | null = null;

    if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.substring(7);
      const { data: userData } = await supabase.auth.getUser(token);
      userId = userData?.user?.id || null;
    }

    // Check for user's encrypted API key
    if (userId) {
      // Check cache first
      const cached = apiKeyCache.get(userId);
      if (cached) {
        apiKey = cached.key;
        keySource = cached.source;
      } else {
        // Not in cache, fetch from database
        const startTime = Date.now();
        const { data: preferences } = await supabase
          .from("user_preferences")
          .select("preferences")
          .eq("user_id", userId)
          .single();

        if (preferences?.preferences?.encryptedData?.apiKeys?.anthropic) {
          try {
            const encryptedKey = preferences.preferences.encryptedData.apiKeys
              .anthropic as EncryptedData;

            // Decrypt the user's API key
            if (
              encryptedKey.encrypted &&
              encryptedKey.iv &&
              encryptedKey.authTag
            ) {
              const decryptStart = Date.now();
              apiKey = decrypt(encryptedKey);
              keySource = "user";

              decryptionMetrics = {
                queryTime: decryptStart - startTime,
                decryptTime: Date.now() - decryptStart,
                totalTime: Date.now() - startTime,
              };

              // Cache the decrypted key
              apiKeyCache.set(userId, apiKey, keySource);
            }
          } catch (decryptError) {
            console.error("Failed to decrypt user API key:", decryptError);
            // Set error in metrics but keep metrics null to indicate failure
          }
        }
      }
    }

    // Fall back to environment variable if no user key
    if (!apiKey && process.env.ANTHROPIC_API_KEY) {
      apiKey = process.env.ANTHROPIC_API_KEY;
      keySource = "environment";
    }

    // If no API key is available at all
    if (!apiKey) {
      return NextResponse.json(
        {
          status: "not_configured",
          message: "Claude API key not set",
          keySource: "none",
          userKeyAvailable: false,
          environmentKeyAvailable: false,
        },
        { status: 501 } // Not Implemented
      );
    }

    // Perform a simple health check against Claude API with the selected key
    const response = await fetch("https://api.anthropic.com/v1/models", {
      method: "GET",
      headers: {
        "anthropic-version": "2023-06-01",
        "x-api-key": apiKey,
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "unhealthy",
          message: "Claude API responded with error",
          statusCode: response.status,
          keySource,
          ...(decryptionMetrics && { decryptionMetrics }),
        },
        { status: 503 }
      );
    }

    return NextResponse.json({
      status: "healthy",
      message: "Claude API is accessible",
      keySource,
      userKeyAvailable: keySource === "user",
      environmentKeyAvailable: !!process.env.ANTHROPIC_API_KEY,
      ...(decryptionMetrics && { decryptionMetrics }),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error("Claude health check error:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        message:
          error instanceof Error ? error.message : "Claude API check failed",
        timestamp: new Date(),
      },
      { status: 503 }
    );
  }
}
