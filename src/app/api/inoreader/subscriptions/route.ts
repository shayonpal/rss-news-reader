import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { logInoreaderApiCall } from "@/lib/api/log-api-call";
import { captureRateLimitHeaders } from "@/lib/api/capture-rate-limit-headers";

const INOREADER_API_BASE = "https://www.inoreader.com/reader/api/0";

export async function GET(request: NextRequest) {
  // Get trigger from query params
  const trigger = request.nextUrl.searchParams.get("trigger") || "unknown";

  try {
    const cookieStore = await cookies();
    let accessToken = cookieStore.get("access_token");
    const refreshToken = cookieStore.get("refresh_token");
    const expiresAt = cookieStore.get("token_expires_at");

    // Check if token is expired
    if (accessToken && expiresAt) {
      const expiresAtTime = parseInt(expiresAt.value);
      if (expiresAtTime < Date.now()) {
        console.log("Access token expired, attempting refresh...");

        // Try to refresh the token
        if (refreshToken) {
          const refreshResponse = await fetch(
            `${request.nextUrl.origin}/api/auth/inoreader/refresh`,
            {
              method: "POST",
              headers: {
                Cookie: `refresh_token=${refreshToken.value}`,
              },
            }
          );

          if (refreshResponse.ok) {
            // Get the new access token from the response cookies
            const setCookieHeader = refreshResponse.headers.get("set-cookie");
            if (setCookieHeader) {
              const match = setCookieHeader.match(/access_token=([^;]+)/);
              if (match) {
                accessToken = { name: "access_token", value: match[1] };
                console.log("Token refreshed successfully");
              }
            }
          }
        }
      }
    }

    if (!accessToken) {
      console.error("No access token found in cookies");
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Check for required environment variables
    if (
      !process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID ||
      !process.env.INOREADER_CLIENT_SECRET
    ) {
      console.error("Missing required Inoreader environment variables");
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      );
    }

    console.log("Fetching subscriptions from Inoreader API...");

    // Log the API call
    logInoreaderApiCall("/reader/api/0/subscription/list", trigger, "GET");

    const response = await fetch(`${INOREADER_API_BASE}/subscription/list`, {
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
        AppId: process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID,
        AppKey: process.env.INOREADER_CLIENT_SECRET,
        "User-Agent": "Shayons-News/1.0",
      },
    });

    console.log("Inoreader API response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Inoreader API error:", errorText);
      return NextResponse.json(
        { error: `Failed to fetch subscriptions: ${response.statusText}` },
        { status: response.status }
      );
    }

    // Capture rate limit headers for RR-5
    await captureRateLimitHeaders(response.headers);

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Subscriptions API error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
