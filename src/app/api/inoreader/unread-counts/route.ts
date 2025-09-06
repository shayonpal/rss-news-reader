import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logInoreaderApiCall } from "@/lib/api/log-api-call";
import { captureRateLimitHeaders } from "@/lib/api/capture-rate-limit-headers";

const INOREADER_API_BASE = "https://www.inoreader.com/reader/api/0";

export async function GET(request: NextRequest) {
  // Get trigger from query params
  const trigger = request.nextUrl.searchParams.get("trigger") || "unknown";

  try {
    // @ts-ignore
    const TokenManager = (
      await import("../../../../../server/lib/token-manager.js")
    ).default;
    const tokenManager = new TokenManager();

    // Log the API call
    logInoreaderApiCall("/reader/api/0/unread-count", trigger, "GET");

    const response = await tokenManager.makeAuthenticatedRequest(
      `${INOREADER_API_BASE}/unread-count`,
      {
        headers: {
          AppId: process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID!,
          AppKey: process.env.INOREADER_CLIENT_SECRET!,
          "User-Agent": "Shayons-News/1.0",
        },
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch unread counts: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Capture rate limit headers for RR-5
    await captureRateLimitHeaders(response.headers);

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Unread counts API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
