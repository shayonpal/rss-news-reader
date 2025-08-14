/**
 * Catch-all API Route for RR-102: Helpful Error Messages
 *
 * This route catches API requests that don't have the /reader prefix
 * and returns helpful JSON error messages with the correct path.
 *
 * Only active in development environment for POST/PUT/DELETE requests
 * (GET requests are handled by the middleware redirect).
 */

import { NextRequest, NextResponse } from "next/server";

// Helper to generate the correct path
function getCorrectPath(pathname: string): string {
  // Remove leading slash if present
  const cleanPath = pathname.startsWith("/") ? pathname.substring(1) : pathname;

  // If it starts with 'api/', prepend /reader/
  if (cleanPath.startsWith("api/")) {
    return `/reader/${cleanPath}`;
  }

  // For other paths, just prepend /reader/
  return `/reader${pathname}`;
}

// Check if path contains sensitive keywords that shouldn't be echoed
function containsSensitiveKeywords(path: string): boolean {
  const sensitiveWords = [
    "supabase",
    "config",
    "debug",
    "token",
    "key",
    "secret",
    "password",
  ];
  const lowerPath = path.toLowerCase();
  return sensitiveWords.some((word) => lowerPath.includes(word));
}

// Helper to create error response
function createErrorResponse(
  request: NextRequest,
  pathname: string
): NextResponse {
  const correctPath = getCorrectPath(pathname);
  const method = request.method;

  // Only show detailed help in development (check by host)
  const isDevelopment =
    request.headers.get("host")?.includes("localhost") ||
    request.headers.get("host")?.includes("100.96.166.53") ||
    request.headers.get("host")?.includes("127.0.0.1");

  if (!isDevelopment) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  // If path contains sensitive keywords, return generic error without echoing the path
  if (containsSensitiveKeywords(pathname)) {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const errorBody = {
    error: "Not Found",
    message: `API endpoint not found. The RSS Reader app uses /reader as its base path. Did you mean ${correctPath}?`,
    correctPath,
    method,
    requestedPath: pathname,
    hint: "All API endpoints must be prefixed with /reader in this application.",
    example: {
      url: correctPath,
      method,
      headers:
        method !== "GET" ? { "Content-Type": "application/json" } : undefined,
    },
  };

  // Log for education (unless in test environment)
  // Skip logging if running in test environment (port 3149-3199 range typically used for tests)
  const port = request.headers.get("host")?.split(":")[1];
  const isTestPort = port && parseInt(port) >= 3149 && parseInt(port) <= 3199;
  if (!isTestPort) {
    console.log(
      `[API Catch-all] ${method} ${pathname} → Suggesting ${correctPath}`
    );
  }

  return NextResponse.json(errorBody, { status: 404 });
}

// Handle all HTTP methods
export async function GET(
  request: NextRequest,
  { params }: { params: { catch: string[] } }
) {
  const pathname = `/api/${params.catch.join("/")}`;
  return createErrorResponse(request, pathname);
}

export async function POST(
  request: NextRequest,
  { params }: { params: { catch: string[] } }
) {
  const pathname = `/api/${params.catch.join("/")}`;
  return createErrorResponse(request, pathname);
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { catch: string[] } }
) {
  const pathname = `/api/${params.catch.join("/")}`;
  return createErrorResponse(request, pathname);
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { catch: string[] } }
) {
  const pathname = `/api/${params.catch.join("/")}`;
  return createErrorResponse(request, pathname);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { catch: string[] } }
) {
  const pathname = `/api/${params.catch.join("/")}`;
  return createErrorResponse(request, pathname);
}

export async function HEAD(
  request: NextRequest,
  { params }: { params: { catch: string[] } }
) {
  const pathname = `/api/${params.catch.join("/")}`;
  return createErrorResponse(request, pathname);
}

export async function OPTIONS(
  request: NextRequest,
  { params }: { params: { catch: string[] } }
) {
  // For OPTIONS (CORS preflight), return standard response
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
