import { NextResponse } from "next/server";
// @ts-ignore
import TokenManager from "../../../../../server/lib/token-manager.js";

export async function GET() {
  try {
    const tokenManager = new TokenManager();

    // Make a simple API call to check headers
    const response = await tokenManager.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/user-info"
    );

    // Log all headers
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key] = value;
    });

    // Extract rate limit headers specifically
    const rateLimitHeaders = {
      "X-Reader-Zone1-Usage": response.headers.get("X-Reader-Zone1-Usage"),
      "X-Reader-Zone1-Limit": response.headers.get("X-Reader-Zone1-Limit"),
      "X-Reader-Zone2-Usage": response.headers.get("X-Reader-Zone2-Usage"),
      "X-Reader-Zone2-Limit": response.headers.get("X-Reader-Zone2-Limit"),
      "X-Reader-Limits-Reset-After": response.headers.get(
        "X-Reader-Limits-Reset-After"
      ),
      "X-Reader-Ratelimits": response.headers.get("X-Reader-Ratelimits"),
    };

    // Also check case variations
    const caseVariations = {
      "x-reader-zone1-usage": response.headers.get("x-reader-zone1-usage"),
      "x-reader-zone1-limit": response.headers.get("x-reader-zone1-limit"),
      "x-reader-zone2-usage": response.headers.get("x-reader-zone2-usage"),
      "x-reader-zone2-limit": response.headers.get("x-reader-zone2-limit"),
      "x-reader-limits-reset-after": response.headers.get(
        "x-reader-limits-reset-after"
      ),
      "x-reader-ratelimits": response.headers.get("x-reader-ratelimits"),
    };

    const data = response.ok ? await response.json() : null;

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      rateLimitHeaders,
      caseVariations,
      allHeaders: headers,
      data,
      message: "Check which headers are actually present in the response",
    });
  } catch (error) {
    console.error("[CheckHeaders] Error:", error);
    return NextResponse.json(
      {
        error: "check_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
