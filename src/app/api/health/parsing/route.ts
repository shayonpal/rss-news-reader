import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export async function GET() {
  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

    // Get parsing statistics
    const [totalStats, recentStats, failureStats, partialFeeds] = await Promise.all([
      // Total parsing statistics
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .not("parsed_at", "is", null),
      
      // Recent parsing activity (last hour)
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .gte("parsed_at", oneHourAgo.toISOString()),
      
      // Failed parses
      supabase
        .from("articles")
        .select("*", { count: "exact", head: true })
        .eq("parse_failed", true),
      
      // Partial feeds count
      supabase
        .from("feeds")
        .select("*", { count: "exact", head: true })
        .eq("is_partial_feed", true),
    ]);

    // Get fetch logs statistics for the last 24 hours
    const { data: fetchLogs } = await supabase
      .from("fetch_logs")
      .select("status, fetch_type")
      .gte("created_at", oneDayAgo.toISOString());

    // Calculate fetch statistics (exclude auto-fetch for API health metrics)
    const manualFetchLogs = fetchLogs?.filter(log => log.fetch_type !== "auto") || [];
    const autoFetchLogs = fetchLogs?.filter(log => log.fetch_type === "auto") || [];
    
    const fetchStats = {
      total: manualFetchLogs.length,
      success: manualFetchLogs.filter(log => log.status === "success").length,
      failure: manualFetchLogs.filter(log => log.status === "failure").length,
      manual: fetchLogs?.filter(log => log.fetch_type === "manual").length || 0,
      auto: {
        total: autoFetchLogs.length,
        success: autoFetchLogs.filter(log => log.status === "success").length,
        failure: autoFetchLogs.filter(log => log.status === "failure").length,
      },
    };

    // Get average parse duration from recent logs
    const { data: recentLogs } = await supabase
      .from("fetch_logs")
      .select("duration_ms")
      .eq("status", "success")
      .gte("created_at", oneDayAgo.toISOString())
      .not("duration_ms", "is", null)
      .limit(100);

    const avgDuration = recentLogs?.length
      ? recentLogs.reduce((sum, log) => sum + (log.duration_ms || 0), 0) / recentLogs.length
      : 0;

    // Get system config for parsing
    const { data: configs } = await supabase
      .from("system_config")
      .select("key, value")
      .in("key", [
        "parse_timeout_seconds",
        "max_concurrent_parses",
        "max_parse_attempts",
      ]);

    const configMap = configs?.reduce((acc, cfg) => {
      acc[cfg.key] = cfg.value;
      return acc;
    }, {} as Record<string, string>) || {};

    // Calculate health status
    const successRate = fetchStats.total > 0 
      ? (fetchStats.success / fetchStats.total) * 100 
      : 100;
    
    const status = successRate >= 90 ? "healthy" : successRate >= 70 ? "degraded" : "unhealthy";

    return NextResponse.json({
      status,
      timestamp: now.toISOString(),
      metrics: {
        parsing: {
          totalParsed: totalStats.count || 0,
          recentlyParsed: recentStats.count || 0,
          failedParses: failureStats.count || 0,
          partialFeeds: partialFeeds.count || 0,
        },
        fetch: {
          last24Hours: {
            api: {
              total: fetchStats.total,
              success: fetchStats.success,
              failure: fetchStats.failure,
              manual: fetchStats.manual,
            },
            auto: fetchStats.auto,
          },
          successRate: `${successRate.toFixed(1)}%`,
          avgDurationMs: Math.round(avgDuration),
          note: "Success rate excludes auto-fetch operations (content parsing)",
        },
        configuration: {
          timeoutSeconds: parseInt(configMap.parse_timeout_seconds || "30"),
          maxConcurrent: parseInt(configMap.max_concurrent_parses || "5"),
          maxAttempts: parseInt(configMap.max_parse_attempts || "3"),
        },
      },
      recommendations: getRecommendations(successRate, avgDuration, failureStats.count || 0),
    });
  } catch (error) {
    console.error("Parsing health check error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to fetch parsing metrics",
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

function getRecommendations(successRate: number, avgDuration: number, failedCount: number): string[] {
  const recommendations: string[] = [];

  if (successRate < 90) {
    recommendations.push("API success rate below 90% - investigate manual fetch failure reasons");
  }

  if (avgDuration > 10000) {
    recommendations.push("Average parse time exceeds 10 seconds - consider timeout adjustments");
  }

  if (failedCount > 100) {
    recommendations.push(`${failedCount} failed parses - consider manual review or cleanup`);
  }

  if (avgDuration > 0 && avgDuration < 1000) {
    recommendations.push("Very fast parse times detected - verify content extraction quality");
  }

  return recommendations.length > 0 
    ? recommendations 
    : ["All parsing metrics within normal ranges"];
}