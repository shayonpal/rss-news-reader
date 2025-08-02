import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";
import { isTestEnvironment, getEnvironmentInfo } from "@/lib/utils/environment";

// Force dynamic rendering for this API route
export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();
  const envInfo = getEnvironmentInfo();
  
  // Set cache headers
  const headers = {
    "Cache-Control": "no-store, max-age=0",
  };

  // Skip database check in test environment
  if (isTestEnvironment()) {
    return NextResponse.json(
      {
        status: "healthy",
        database: "unavailable",
        message: "Database health check skipped in test environment",
        environment: envInfo.environment,
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers }
    );
  }

  try {
    // Test database connectivity with a simple query
    const { data, error } = await supabase
      .from("articles")
      .select("id")
      .limit(1);

    const queryTime = Date.now() - startTime;

    if (error) {
      console.error("Database health check failed:", error);
      return NextResponse.json(
        {
          status: "unhealthy",
          database: "error",
          message: "Database query failed",
          error: error.message,
          queryTime,
          environment: envInfo.environment,
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers }
      );
    }

    // Additional health checks
    const healthChecks = {
      connectivity: true,
      queryTime,
      environment: envInfo.environment,
      timestamp: new Date().toISOString(),
    };

    // Check if query time is acceptable
    if (queryTime > 5000) {
      return NextResponse.json(
        {
          status: "degraded",
          database: "slow",
          message: "Database responding slowly",
          ...healthChecks,
        },
        { status: 200, headers }
      );
    }

    // All checks passed
    return NextResponse.json(
      {
        status: "healthy",
        database: "connected",
        message: "Database is healthy",
        ...healthChecks,
      },
      { status: 200, headers }
    );
  } catch (error) {
    console.error("Database health check error:", error);
    return NextResponse.json(
      {
        status: "unhealthy",
        database: "error",
        message: "Failed to check database health",
        error: error instanceof Error ? error.message : "Unknown error",
        queryTime: Date.now() - startTime,
        environment: envInfo.environment,
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers }
    );
  }
}
