import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    // Check the age of the most recent article
    const { data, error } = await supabase
      .from("articles")
      .select("published_at")
      .order("published_at", { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 = no rows
      throw error;
    }

    const now = new Date();
    const lastArticleTime = data ? new Date(data.published_at) : null;
    const hoursSinceLastArticle = lastArticleTime
      ? (now.getTime() - lastArticleTime.getTime()) / (1000 * 60 * 60)
      : 999;

    // Also check sync metadata
    const { data: syncData } = await supabase
      .from("sync_metadata")
      .select("value")
      .eq("key", "last_successful_sync")
      .single();

    const lastSyncTime = syncData?.value ? new Date(syncData.value) : null;
    const hoursSinceLastSync = lastSyncTime
      ? (now.getTime() - lastSyncTime.getTime()) / (1000 * 60 * 60)
      : 999;

    const isHealthy = hoursSinceLastArticle < 24 && hoursSinceLastSync < 15;

    return NextResponse.json(
      {
        status: isHealthy ? "healthy" : "unhealthy",
        lastArticle: lastArticleTime?.toISOString() || null,
        hoursSinceLastArticle: Math.round(hoursSinceLastArticle * 10) / 10,
        lastSync: lastSyncTime?.toISOString() || null,
        hoursSinceLastSync: Math.round(hoursSinceLastSync * 10) / 10,
        thresholds: {
          articleAge: 24,
          syncAge: 15,
        },
      },
      {
        status: isHealthy ? 200 : 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Freshness check error:", error);
    return NextResponse.json(
      { error: "Failed to check article freshness" },
      { status: 500 }
    );
  }
}
