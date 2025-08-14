import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { isTestEnvironment, getEnvironmentInfo } from "@/lib/utils/environment";

export const dynamic = "force-dynamic";

export async function GET() {
  const envInfo = getEnvironmentInfo();
  const headers = {
    "Cache-Control": "no-store, max-age=0",
  };

  // Skip cron check in test environment
  if (isTestEnvironment()) {
    return NextResponse.json(
      {
        status: "healthy",
        message: "Cron health check skipped in test environment",
        environment: envInfo.environment,
        lastCheck: null,
        lastRun: null, // Include lastRun for test compatibility
        timestamp: new Date().toISOString(),
      },
      { status: 200, headers }
    );
  }

  try {
    const healthFilePath = path.join(
      process.cwd(),
      "logs",
      "cron-health.jsonl"
    );

    // Check if health file exists
    try {
      await fs.access(healthFilePath);
    } catch {
      return NextResponse.json(
        {
          status: "unknown",
          message: "Health file not found",
          environment: envInfo.environment,
          lastCheck: null,
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers }
      );
    }

    // Read the last line of the health file
    const content = await fs.readFile(healthFilePath, "utf-8");
    const lines = content
      .trim()
      .split("\n")
      .filter((line) => line);

    if (lines.length === 0) {
      return NextResponse.json(
        {
          status: "unknown",
          message: "No health data available",
          environment: envInfo.environment,
          lastCheck: null,
          timestamp: new Date().toISOString(),
        },
        { status: 503, headers }
      );
    }

    const lastHealthData = JSON.parse(lines[lines.length - 1]);
    const lastCheckTime = new Date(lastHealthData.timestamp);
    const ageMinutes = (Date.now() - lastCheckTime.getTime()) / (1000 * 60);
    const ageHours = ageMinutes / 60;

    // Consider unhealthy if last check is older than 5 hours (4-hour interval + 1 hour buffer)
    const isStale = ageHours > 5;
    const status = isStale ? "unhealthy" : lastHealthData.status;
    const message = isStale
      ? `Last check was ${Math.round(ageHours)} hours ago (expected every 4 hours)`
      : lastHealthData.message || "Sync completed successfully";

    return NextResponse.json(
      {
        status,
        message,
        environment: envInfo.environment,
        lastCheck: lastHealthData.timestamp,
        ageMinutes: Math.round(ageMinutes),
        lastRun: lastHealthData.lastRun,
        lastRunStatus: lastHealthData.lastRunStatus,
        recentRuns: lastHealthData.recentRuns,
        uptime: lastHealthData.uptime,
        nextRun: lastHealthData.nextRun,
        timestamp: new Date().toISOString(),
      },
      {
        status: status === "healthy" ? 200 : 503,
        headers,
      }
    );
  } catch (error) {
    console.error("Cron health check error:", error);
    return NextResponse.json(
      {
        status: "error",
        error: "Failed to check cron health",
        message: error instanceof Error ? error.message : "Unknown error",
        environment: envInfo.environment,
        timestamp: new Date().toISOString(),
      },
      { status: 500, headers }
    );
  }
}
