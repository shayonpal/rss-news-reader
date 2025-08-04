import { NextRequest, NextResponse } from "next/server";
import { appHealthCheck } from "@/lib/health/app-health-check";
import { getAppVersion } from "@/lib/utils/version";

// Force dynamic rendering for this API route
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    // Check if this is a simple ping
    const url = new URL(request.url);
    const isPing = url.searchParams.get("ping") === "true";

    if (isPing) {
      // Ping response should be minimal - no version or timestamp
      return NextResponse.json({ status: "ok", ping: true });
    }

    // Perform comprehensive health check
    const health = await appHealthCheck.checkHealth();

    // Get app version
    const version = await getAppVersion();

    // Add timestamp and version at root level
    const healthWithTimestamp = {
      ...health,
      version,
      timestamp: new Date().toISOString()
    };

    // Determine HTTP status code based on health
    // RR-115: Improve status code determination based on service states
    let statusCode = 200;
    
    // Check if critical dependencies are unhealthy
    const isCriticallyUnhealthy = health.dependencies && (
      health.dependencies.database === "unhealthy" ||
      health.dependencies.database === "failed" ||
      health.dependencies.database === "error"
    );
    
    if (health.status === "unhealthy" || isCriticallyUnhealthy) {
      statusCode = 503; // Service Unavailable
    } else if (health.status === "degraded") {
      // Check if degraded due to initialization
      const isInitializing = health.dependencies && (
        health.dependencies.database === "initializing" ||
        health.dependencies.oauth === "initializing"
      );
      
      // Return 200 for degraded states (including initialization)
      statusCode = 200;
    }

    return NextResponse.json(healthWithTimestamp, { status: statusCode });
  } catch (error) {
    console.error("Health check endpoint error:", error);

    // Log the error
    const { AppHealthCheck } = await import("@/lib/health/app-health-check");
    AppHealthCheck.logError(
      `Health check endpoint error: ${error instanceof Error ? error.message : "Unknown error"}`
    );

    // Get version even in error state
    const version = await getAppVersion().catch(() => "0.0.0-error");

    return NextResponse.json(
      {
        status: "unhealthy",
        service: "rss-reader-app",
        uptime: 0,
        lastActivity: new Date().toISOString(),
        errorCount: 1,
        version,
        timestamp: new Date().toISOString(),
        dependencies: {
          database: "unknown",
          oauth: "unknown",
        },
        performance: {
          avgSyncTime: 0,
          avgDbQueryTime: 0,
          avgApiCallTime: 0,
        },
        error: error instanceof Error ? error.message : "Health check failed",
      },
      { status: 503 }
    );
  }
}
