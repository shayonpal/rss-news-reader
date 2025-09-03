import { NextResponse } from "next/server";

// This endpoint is kept for backward compatibility
// Bi-directional sync is implemented as a separate service that runs automatically

export async function POST() {
  return NextResponse.json(
    {
      error: "Direct API endpoint not available",
      message:
        "Bi-directional sync runs automatically as a background service.",
    },
    {
      status: 501,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
      },
    }
  );
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
