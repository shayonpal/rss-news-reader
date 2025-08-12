import { NextResponse } from "next/server";
import { captureRateLimitHeaders } from "@/lib/api/capture-rate-limit-headers";

export async function GET() {
  try {
    // Create fake headers that match what Inoreader sends
    const fakeHeaders = new Headers({
      "X-Reader-Zone1-Usage": "98",
      "X-Reader-Zone1-Limit": "100",
      "X-Reader-Zone2-Usage": "10",
      "X-Reader-Zone2-Limit": "100",
      "X-Reader-Limits-Reset-After": "14400", // 4 hours in seconds
    });

    // Capture these headers to database
    await captureRateLimitHeaders(fakeHeaders);

    return NextResponse.json({
      success: true,
      message: "Simulated headers captured successfully",
      values: {
        zone1: "98/100 (98%)",
        zone2: "10/100 (10%)",
        resetAfter: "4 hours",
      },
    });
  } catch (error) {
    console.error("Error simulating headers:", error);
    return NextResponse.json(
      { error: "Failed to simulate headers" },
      { status: 500 }
    );
  }
}
