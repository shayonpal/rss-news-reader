import { NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

// Force dynamic rendering for this API route
export const dynamic = "force-dynamic";

export async function GET() {
  const startTime = Date.now();

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
        },
        { status: 503 }
      );
    }

    // Additional health checks
    const healthChecks = {
      connectivity: true,
      queryTime,
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
        { status: 200 }
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
      { status: 200 }
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
      },
      { status: 503 }
    );
  }
}
