import { NextResponse } from "next/server";
import { captureRateLimitHeaders } from "@/lib/api/capture-rate-limit-headers";
// @ts-ignore
import TokenManager from "../../../../../server/lib/token-manager.js";

export async function POST() {
  try {
    const tokenManager = new TokenManager();

    // Make an API call to get current headers
    const response = await tokenManager.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/user-info"
    );

    if (!response.ok) {
      throw new Error(`API call failed: ${response.status}`);
    }

    // Log what we're capturing
    const zone1Usage = response.headers.get("X-Reader-Zone1-Usage");
    const zone2Usage = response.headers.get("X-Reader-Zone2-Usage");

    console.log("[ForceUpdate] Before capture:", { zone1Usage, zone2Usage });

    // Force capture the headers
    await captureRateLimitHeaders(response.headers);

    // Check what got stored
    const { getCurrentApiUsage } = await import(
      "@/lib/api/capture-rate-limit-headers"
    );
    const currentUsage = await getCurrentApiUsage();

    return NextResponse.json({
      success: true,
      message: "Forced header capture",
      beforeCapture: {
        zone1: zone1Usage,
        zone2: zone2Usage,
      },
      afterCapture: currentUsage,
      expectedVsActual: {
        zone1: {
          expected: parseInt(zone1Usage || "0"),
          actual: currentUsage.zone1.used,
          match: parseInt(zone1Usage || "0") === currentUsage.zone1.used,
        },
        zone2: {
          expected: parseInt(zone2Usage || "0"),
          actual: currentUsage.zone2.used,
          match: parseInt(zone2Usage || "0") === currentUsage.zone2.used,
        },
      },
    });
  } catch (error) {
    console.error("[ForceUpdate] Error:", error);
    return NextResponse.json(
      {
        error: "update_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
