import { NextResponse } from "next/server";
import { getCurrentApiUsage } from "@/lib/api/capture-rate-limit-headers";

/**
 * GET /api/sync/api-usage
 * Returns current Inoreader API usage with zone percentages
 * For RR-5: Sync Status Display
 */
export async function GET() {
  try {
    const usage = await getCurrentApiUsage();

    return NextResponse.json(
      {
        zone1: {
          used: usage.zone1.used,
          limit: usage.zone1.limit,
          percentage: parseFloat(usage.zone1.percentage.toFixed(2)),
        },
        zone2: {
          used: usage.zone2.used,
          limit: usage.zone2.limit,
          percentage: parseFloat(usage.zone2.percentage.toFixed(2)),
        },
        resetAfterSeconds: usage.resetAfterSeconds,
        timestamp: new Date().toISOString(),
      },
      {
        headers: {
          // Cache for 30 seconds for near real-time updates
          "Cache-Control": "public, max-age=30",

          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (error) {
    console.error("[API Usage] Error fetching usage:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch API usage",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
