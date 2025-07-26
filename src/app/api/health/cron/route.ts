import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Path to the cron health log file
    const healthLogPath = path.join(process.cwd(), 'logs', 'cron-health.jsonl');
    
    // Check if the file exists
    const fileExists = await fs.access(healthLogPath).then(() => true).catch(() => false);
    
    if (!fileExists) {
      // Return unknown status if no health file exists
      return NextResponse.json({
        status: 'unknown',
        service: 'rss-sync-cron',
        uptime: 0,
        lastActivity: new Date().toISOString(),
        errorCount: 0,
        dependencies: {},
        performance: {
          avgSyncTime: 0,
          avgDbQueryTime: 0,
          avgApiCallTime: 0,
        },
        details: {
          message: 'No health status file found. Cron service may not have started yet.',
        },
      });
    }
    
    // Read the file
    const fileContent = await fs.readFile(healthLogPath, 'utf-8');
    const lines = fileContent.trim().split('\n').filter(line => line.length > 0);
    
    if (lines.length === 0) {
      return NextResponse.json({
        status: 'unknown',
        service: 'rss-sync-cron',
        uptime: 0,
        lastActivity: new Date().toISOString(),
        errorCount: 0,
        dependencies: {},
        performance: {
          avgSyncTime: 0,
          avgDbQueryTime: 0,
          avgApiCallTime: 0,
        },
        details: {
          message: 'Health status file is empty.',
        },
      });
    }
    
    // Get the latest health status (last line)
    const latestHealthData = JSON.parse(lines[lines.length - 1]);
    
    // Transform to standardized format
    const standardizedHealth = {
      status: latestHealthData.status || 'unknown',
      service: 'rss-sync-cron',
      uptime: latestHealthData.uptime || 0,
      lastActivity: latestHealthData.lastRun || latestHealthData.timestamp,
      errorCount: latestHealthData.recentRuns?.failed || 0,
      dependencies: {}, // Cron doesn't have external dependencies like DB
      performance: {
        avgSyncTime: latestHealthData.performance?.avgSyncTime || 0,
        avgDbQueryTime: 0, // Not tracked by cron
        avgApiCallTime: 0, // Not tracked by cron
      },
      details: {
        enabled: latestHealthData.enabled,
        schedule: latestHealthData.schedule,
        nextRun: latestHealthData.nextRun,
        lastRunStatus: latestHealthData.lastRunStatus,
        recentRuns: latestHealthData.recentRuns,
        lastCheck: latestHealthData.timestamp,
      },
    };
    
    // Determine HTTP status code
    const statusCode = standardizedHealth.status === 'unhealthy' ? 503 : 200;
    
    return NextResponse.json(standardizedHealth, { status: statusCode });
    
  } catch (error) {
    console.error('Cron health check error:', error);
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        service: 'rss-sync-cron',
        uptime: 0,
        lastActivity: new Date().toISOString(),
        errorCount: 1,
        dependencies: {},
        performance: {
          avgSyncTime: 0,
          avgDbQueryTime: 0,
          avgApiCallTime: 0,
        },
        error: error instanceof Error ? error.message : 'Failed to read health status',
      },
      { status: 503 }
    );
  }
}