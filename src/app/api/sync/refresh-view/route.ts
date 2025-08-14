import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    console.log("[API] Refreshing materialized view feed_stats...");

    // Refresh the materialized view for accurate feed statistics
    const { error } = await supabase.rpc("refresh_feed_stats");

    if (error) {
      console.error("[API] Error refreshing feed_stats:", error);
      return NextResponse.json(
        {
          status: "error",
          error: error.message,
        },
        { status: 500 }
      );
    }

    console.log("[API] Materialized view refreshed successfully");

    return NextResponse.json({
      status: "success",
      message: "Materialized view refreshed",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[API] Failed to refresh materialized view:", error);
    return NextResponse.json(
      {
        status: "error",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
