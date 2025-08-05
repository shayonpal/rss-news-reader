import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { isTestEnvironment, getEnvironmentInfo } from "@/lib/utils/environment";

export const dynamic = "force-dynamic";

export async function GET() {
  const envInfo = getEnvironmentInfo();
  const headers = {
    "Cache-Control": "no-store, max-age=0",
  };

  // Skip freshness check in test environment
  if (isTestEnvironment()) {
    return NextResponse.json(
      {
        status: "healthy",
        message: "Freshness check skipped in test environment",
        environment: envInfo.environment,
        data: {
          latestArticleTime: null,
          hoursSinceLatest: null,
          articlesLast5h: 0,
          totalArticles: 0,
          syncFrequency: "6x daily (every 4 hours)",
        },
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers }
    );
  }

  try {
    // Check the age of the most recent article
    const { data: latestArticle, error: latestError } = await supabase
      .from("articles")
      .select("published_at")
      .order("published_at", { ascending: false })
      .limit(1);

    if (latestError) {
      throw latestError;
    }

    // Count articles in last 5 hours (for 6x daily sync)
    const fiveHoursAgo = new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString();
    const { data: recentCount, error: recentError } = await supabase
      .rpc("count_articles_since", { since_time: fiveHoursAgo });

    if (recentError) {
      throw recentError;
    }

    // Get total article count
    const { data: totalCount, error: totalError } = await supabase
      .rpc("count_all_articles");

    if (totalError) {
      throw totalError;
    }

    const now = new Date();
    const latestArticleTime = latestArticle?.[0]?.published_at 
      ? new Date(latestArticle[0].published_at) 
      : null;
    const hoursSinceLatest = latestArticleTime
      ? Math.round((now.getTime() - latestArticleTime.getTime()) / (1000 * 60 * 60))
      : null;

    const articlesLast5h = recentCount?.[0]?.count || 0;
    const totalArticles = totalCount?.[0]?.count || 0;

    // Determine health status (updated for 6x daily sync)
    let status = "healthy";
    let message = "Articles are fresh";

    if (!latestArticleTime || hoursSinceLatest === null) {
      status = "unknown";
      message = "No articles found";
    } else if (hoursSinceLatest > 6) {
      status = "stale";
      message = `No new articles in the last ${hoursSinceLatest} hours (expected within 4-6 hours)`;
    } else if (articlesLast5h === 0) {
      status = "degraded";
      message = "No new articles in the last 5 hours";
    }

    return NextResponse.json(
      {
        status,
        message,
        environment: envInfo.environment,
        data: {
          latestArticleTime: latestArticleTime?.toISOString() || null,
          hoursSinceLatest,
          articlesLast5h,
          totalArticles,
          syncFrequency: "6x daily (every 4 hours)",
        },
        timestamp: new Date().toISOString(),
      },
      {
        status: status === "healthy" ? 200 : 503,
        headers,
      }
    );
  } catch (error) {
    console.error("Freshness check error:", error);
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to check article freshness",
        error: error instanceof Error ? error.message : "Unknown error",
        environment: envInfo.environment,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers }
    );
  }
}
