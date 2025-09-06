import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logInoreaderApiCall } from "@/lib/api/log-api-call";
import { captureRateLimitHeaders } from "@/lib/api/capture-rate-limit-headers";

const INOREADER_API_BASE = "https://www.inoreader.com/reader/api/0";

export async function POST(request: NextRequest) {
  // Get trigger from query params
  const trigger = request.nextUrl.searchParams.get("trigger") || "unknown";

  try {
    // @ts-ignore
    const TokenManager = (await import("../../../../../server/lib/token-manager.js")).default;
    const tokenManager = new TokenManager();

    // Get the body from the request
    const body = await request.text();

    // Log the API call
    logInoreaderApiCall("/reader/api/0/edit-tag", trigger, "POST");

    const response = await tokenManager.makeAuthenticatedRequest(
      `${INOREADER_API_BASE}/edit-tag`,
      {
        method: "POST",
        headers: {
          AppId: process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID!,
          AppKey: process.env.INOREADER_CLIENT_SECRET!,
          "User-Agent": "Shayons-News/1.0",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: body,
      }
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to edit tags: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Capture rate limit headers for RR-5
    await captureRateLimitHeaders(response.headers);

    // Inoreader returns "OK" as plain text for successful operations
    const result = await response.text();
    return NextResponse.json({ success: result === "OK" });
  } catch (error) {
    console.error("Edit tag API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
