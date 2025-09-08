import { NextRequest } from "next/server";

/**
 * Create a properly authenticated test request for API endpoints
 */
export function createAuthenticatedRequest(
  url: string,
  options?: RequestInit & {
    headers?: Record<string, string>;
    body?: any;
  }
): NextRequest {
  // Parse URL to get host
  const urlObj = new URL(url);
  const host = urlObj.host || "localhost:3000";

  // Build headers with proper host for authentication
  const headers: Record<string, string> = {
    host,
    ...options?.headers,
  };

  // Add origin for cross-origin requests if needed
  if (!headers.origin && urlObj.protocol && urlObj.host) {
    headers.origin = `${urlObj.protocol}//${urlObj.host}`;
  }

  // Handle body for POST/PUT requests
  let body: BodyInit | undefined;
  if (options?.body) {
    if (typeof options.body === "object") {
      body = JSON.stringify(options.body);
      headers["content-type"] = headers["content-type"] || "application/json";
    } else {
      body = options.body;
    }
  }

  return new NextRequest(url, {
    ...options,
    headers,
    body,
  });
}

/**
 * Create an unauthenticated test request (for testing auth failures)
 */
export function createUnauthenticatedRequest(
  url: string,
  options?: RequestInit
): NextRequest {
  // Create request without proper host/origin headers
  return new NextRequest(url, {
    ...options,
    headers: {
      ...options?.headers,
      // Intentionally omit host/origin
    },
  });
}
