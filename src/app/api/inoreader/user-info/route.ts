import { NextRequest, NextResponse } from "next/server";
import { rateLimiter } from "@/lib/api/rate-limiter";
import { logInoreaderApiCall } from "@/lib/api/log-api-call";
import {
  processInoreaderResponse,
  applyThrottleIfNeeded,
} from "@/lib/api/inoreader-headers";

export async function GET(request: NextRequest) {
  // Get trigger from query params
  const trigger = request.nextUrl.searchParams.get("trigger") || "unknown";
  // Check rate limit before making external API call
  if (!rateLimiter.canMakeCall()) {
    console.log("Rate limit exceeded for user-info request");
    const stats = rateLimiter.getUsageStats();
    return NextResponse.json(
      {
        error: "Rate limit exceeded",
        retryAfter: rateLimiter.getFormattedTimeUntilReset(),
        usage: stats,
      },
      { status: 429 }
    );
  }
  try {
    // @ts-ignore
    const TokenManager = (
      await import("../../../../../server/lib/token-manager.js")
    ).default;
    const tokenManager = new TokenManager();

    console.log("Making request to Inoreader user-info API...");

    // Apply throttle if needed before making the request
    await applyThrottleIfNeeded();

    // Log the API call
    logInoreaderApiCall("/reader/api/0/user-info", trigger, "GET");

    // Use TokenManager to make authenticated request
    const inoreaderResponse = await tokenManager.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/user-info",
      {
        headers: {
          AppId: process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID!,
          AppKey: process.env.INOREADER_CLIENT_SECRET!,
          "User-Agent": "Shayons-News/1.0",
        },
      }
    );

    console.log("Inoreader response status:", inoreaderResponse.status);

    // Process rate limit headers from response
    processInoreaderResponse(inoreaderResponse);

    if (!inoreaderResponse.ok) {
      const errorText = await inoreaderResponse.text();
      console.error("Inoreader API error response:", errorText);

      if (inoreaderResponse.status === 401) {
        return NextResponse.json({ error: "Token expired" }, { status: 401 });
      }
      throw new Error(
        `Inoreader API error: ${inoreaderResponse.status} ${errorText}`
      );
    }

    const userInfo = await inoreaderResponse.json();
    console.log("Successfully fetched user info:", userInfo.userName);

    // Record successful API call
    rateLimiter.recordCall();

    return NextResponse.json(userInfo);
  } catch (error) {
    console.error("User info API error:", error);
    return NextResponse.json(
      { error: "Failed to fetch user info" },
      { status: 500 }
    );
  }
}
