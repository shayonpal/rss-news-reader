import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { captureRateLimitHeaders } from "@/lib/api/capture-rate-limit-headers";

const INOREADER_API_BASE = "https://www.inoreader.com/reader/api/0";

/**
 * Development-only proxy endpoint for testing Inoreader API calls
 * GET /api/inoreader/dev?endpoint=user-info&method=GET
 * 
 * This endpoint:
 * 1. Makes raw API calls to Inoreader
 * 2. Captures and stores rate limit headers
 * 3. Returns both response data and headers for debugging
 * 
 * For RR-5: Sync Status Display
 */
export async function GET(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token");

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get parameters from query
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");
    const method = searchParams.get("method") || "GET";

    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint parameter is required" },
        { status: 400 }
      );
    }

    // Build the full URL
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${INOREADER_API_BASE}/${endpoint}`;

    console.log('[Dev Proxy] Calling:', method, url);

    // Make the request
    const response = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
        AppId: process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID!,
        AppKey: process.env.INOREADER_CLIENT_SECRET!,
        "User-Agent": "Shayons-News-Dev/1.0",
      },
    });

    // Capture rate limit headers
    await captureRateLimitHeaders(response.headers);

    // Extract headers for debugging
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().includes('x-reader') || 
          key.toLowerCase().includes('rate') ||
          key.toLowerCase().includes('limit')) {
        headers[key] = value;
      }
    });

    const data = await response.json();

    // Return both data and headers
    return NextResponse.json({
      data,
      headers,
      debug: {
        url,
        method,
        status: response.status,
        statusText: response.statusText,
        zone1: {
          usage: headers['x-reader-zone1-usage'] || headers['X-Reader-Zone1-Usage'],
          limit: headers['x-reader-zone1-limit'] || headers['X-Reader-Zone1-Limit'],
        },
        zone2: {
          usage: headers['x-reader-zone2-usage'] || headers['X-Reader-Zone2-Usage'],
          limit: headers['x-reader-zone2-limit'] || headers['X-Reader-Zone2-Limit'],
        },
        resetAfter: headers['x-reader-limits-reset-after'] || headers['X-Reader-Limits-Reset-After'],
      },
    });
  } catch (error) {
    console.error('[Dev Proxy] Error:', error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

/**
 * POST endpoint for testing write operations
 */
export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json(
      { error: 'This endpoint is only available in development' },
      { status: 403 }
    );
  }

  try {
    const cookieStore = await cookies();
    const accessToken = cookieStore.get("access_token");

    if (!accessToken) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    // Get parameters from query
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");
    
    if (!endpoint) {
      return NextResponse.json(
        { error: "Endpoint parameter is required" },
        { status: 400 }
      );
    }

    // Get body if provided
    const body = await request.text();

    // Build the full URL
    const url = endpoint.startsWith('http') 
      ? endpoint 
      : `${INOREADER_API_BASE}/${endpoint}`;

    console.log('[Dev Proxy] POST to:', url);

    // Make the request
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken.value}`,
        AppId: process.env.NEXT_PUBLIC_INOREADER_CLIENT_ID!,
        AppKey: process.env.INOREADER_CLIENT_SECRET!,
        "User-Agent": "Shayons-News-Dev/1.0",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });

    // Capture rate limit headers
    await captureRateLimitHeaders(response.headers);

    // Extract headers for debugging
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      if (key.toLowerCase().includes('x-reader') || 
          key.toLowerCase().includes('rate') ||
          key.toLowerCase().includes('limit')) {
        headers[key] = value;
      }
    });

    const data = await response.text();

    // Return both data and headers
    return NextResponse.json({
      data,
      headers,
      debug: {
        url,
        method: 'POST',
        status: response.status,
        statusText: response.statusText,
        zone1: {
          usage: headers['x-reader-zone1-usage'] || headers['X-Reader-Zone1-Usage'],
          limit: headers['x-reader-zone1-limit'] || headers['X-Reader-Zone1-Limit'],
        },
        zone2: {
          usage: headers['x-reader-zone2-usage'] || headers['X-Reader-Zone2-Usage'],
          limit: headers['x-reader-zone2-limit'] || headers['X-Reader-Zone2-Limit'],
        },
        resetAfter: headers['x-reader-limits-reset-after'] || headers['X-Reader-Limits-Reset-After'],
      },
    });
  } catch (error) {
    console.error('[Dev Proxy] Error:', error);
    return NextResponse.json(
      { 
        error: "Internal server error",
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}