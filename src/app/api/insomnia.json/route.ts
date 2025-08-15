import { NextRequest, NextResponse } from "next/server";
import { generateOpenAPIDocument } from "@/lib/openapi/registry";
import { convertOpenAPIToInsomnia } from "@/lib/openapi/insomnia-converter";
import type { OpenAPIObject } from "openapi3-ts/oas31";
import crypto from "crypto";

// Rate limiting: Track requests per IP (1 request per minute)
// Automatically clean up expired entries to prevent memory leaks
const rateLimitMap = new Map<string, number>();
const RATE_LIMIT_WINDOW = 60000; // 1 minute in milliseconds

// Allowed CORS origins for security
const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  process.env.NEXT_PUBLIC_APP_URL, // Tailscale app URL from env
  "https://insomnia.rest", // Insomnia app
].filter(Boolean); // Remove any undefined values

// Helper function to clean expired entries
function cleanExpiredEntries() {
  const now = Date.now();
  for (const [ip, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > RATE_LIMIT_WINDOW) {
      rateLimitMap.delete(ip);
    }
  }
}

/**
 * GET /api/insomnia.json
 * Export OpenAPI specification as Insomnia v4 collection
 */
export async function GET(request: NextRequest) {
  try {
    // Clean expired entries before checking rate limit
    cleanExpiredEntries();

    // Rate limiting check
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
      request.headers.get("x-real-ip") ||
      "unknown";

    const lastRequest = rateLimitMap.get(ip);
    const now = Date.now();

    if (lastRequest && now - lastRequest < RATE_LIMIT_WINDOW) {
      const remainingTime = Math.ceil(
        (RATE_LIMIT_WINDOW - (now - lastRequest)) / 1000
      );
      return new NextResponse(
        "Rate limit exceeded. Please wait before making another request.",
        {
          status: 429,
          headers: {
            "Retry-After": remainingTime.toString(),
            "X-RateLimit-Limit": "1",
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": new Date(
              lastRequest + RATE_LIMIT_WINDOW
            ).toISOString(),
          },
        }
      );
    }

    rateLimitMap.set(ip, now);

    // Detect base URL from request headers
    const protocol = request.headers.get("x-forwarded-proto") || "http";
    const hostHeader =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "localhost:3000";

    // Build the base URL with /reader prefix
    const baseUrl = `${protocol}://${hostHeader}/reader`;

    // Generate OpenAPI document
    // Type assertion to handle OpenAPI v3.0 vs v3.1 differences
    const openApiSpec = generateOpenAPIDocument() as OpenAPIObject;

    // Validate the OpenAPI spec has required fields
    if (!openApiSpec || !openApiSpec.openapi || !openApiSpec.info) {
      throw new Error("Invalid OpenAPI specification: missing required fields");
    }

    if (!openApiSpec.info.title || !openApiSpec.info.version) {
      throw new Error(
        "Invalid OpenAPI specification: missing info.title or info.version"
      );
    }

    // Validate paths exist and are not empty
    if (!openApiSpec.paths || Object.keys(openApiSpec.paths).length === 0) {
      console.warn("Warning: OpenAPI specification has no paths defined");
    }

    // Generate ETag based on spec content and base URL
    const content = JSON.stringify({ spec: openApiSpec, baseUrl });
    const etag = `"${crypto.createHash("md5").update(content).digest("hex")}"`;

    // Check If-None-Match header for caching
    const ifNoneMatch = request.headers.get("if-none-match");
    if (ifNoneMatch === etag) {
      return new NextResponse(null, {
        status: 304,
        headers: {
          ETag: etag,
          "Cache-Control": "public, max-age=300", // 5 minutes
        },
      });
    }

    // Generate the Insomnia collection
    const insomniaCollection = convertOpenAPIToInsomnia(openApiSpec, baseUrl);

    // Get request origin for CORS
    const origin = request.headers.get("origin");
    const corsOrigin =
      origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    return NextResponse.json(insomniaCollection, {
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition":
          'attachment; filename="rss-reader-insomnia.json"',
        "Access-Control-Allow-Origin": corsOrigin,
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Allow-Credentials": "true",
        "Cache-Control": "public, max-age=300", // 5 minutes
        ETag: etag,
      },
    });
  } catch (error) {
    console.error("Error generating Insomnia export:", error);

    // Get request origin for CORS
    const origin = request.headers.get("origin");
    const corsOrigin =
      origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

    return NextResponse.json(
      {
        error: "Failed to generate Insomnia collection",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": corsOrigin,
          "Access-Control-Allow-Credentials": "true",
        },
      }
    );
  }
}

/**
 * OPTIONS /api/insomnia.json
 * Handle CORS preflight requests
 */
export async function OPTIONS(request: NextRequest) {
  // Get request origin for CORS
  const origin = request.headers.get("origin");
  const corsOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];

  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": corsOrigin,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers":
        "Content-Type, Authorization, If-None-Match",
      "Access-Control-Allow-Credentials": "true",
      "Access-Control-Max-Age": "86400", // 24 hours
    },
  });
}
