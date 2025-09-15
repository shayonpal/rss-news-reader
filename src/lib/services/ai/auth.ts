import { NextRequest, NextResponse } from "next/server";
import { getCurrentUserId } from "@/lib/utils/get-current-user";
import { ApiErrors } from "@/lib/utils/api-errors";

/**
 * Simple authentication middleware for AI endpoints
 *
 * For MVP: Validates that request is from our application context
 * In production: Would integrate with proper session management
 */
export async function validateRequest(request: NextRequest): Promise<{
  valid: boolean;
  userId?: string;
  error?: string;
}> {
  try {
    // Check origin header for CORS validation
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");

    // Allowed origins (localhost and Tailscale IP)
    const allowedOrigins = [
      "http://localhost:3000",
      "http://100.96.166.53:3000",
      "http://127.0.0.1:3000",
    ];

    // For same-origin requests (no origin header), check host
    if (!origin) {
      const isValidHost =
        host &&
        (host.includes("localhost:") ||
          host.includes("100.96.166.53:") ||
          host.includes("127.0.0.1:"));

      if (!isValidHost) {
        return { valid: false, error: "Invalid request origin" };
      }
    } else {
      // For cross-origin requests, validate against allowed origins
      if (!allowedOrigins.some((allowed) => origin.startsWith(allowed))) {
        return { valid: false, error: "Cross-origin request not allowed" };
      }
    }

    // Get the current user ID (MVP single-user system)
    const userId = await getCurrentUserId();

    if (!userId) {
      return { valid: false, error: "User not found" };
    }

    return { valid: true, userId };
  } catch (error) {
    console.error("Request validation error:", error);
    return { valid: false, error: "Authentication failed" };
  }
}

/**
 * Standard unauthorized response
 */
export function unauthorizedResponse(message = "Unauthorized"): NextResponse {
  return ApiErrors.unauthorized(message);
}
