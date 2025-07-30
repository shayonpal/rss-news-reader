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
    { status: 501 } // Not Implemented
  );
}
