import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const healthFilePath = path.join(process.cwd(), 'logs', 'cron-health.jsonl');
    
    // Check if health file exists
    try {
      await fs.access(healthFilePath);
    } catch {
      return NextResponse.json({
        status: 'unknown',
        message: 'Health file not found',
        lastCheck: null
      }, { status: 503 });
    }
    
    // Read the last line of the health file
    const content = await fs.readFile(healthFilePath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line);
    
    if (lines.length === 0) {
      return NextResponse.json({
        status: 'unknown',
        message: 'No health data available',
        lastCheck: null
      }, { status: 503 });
    }
    
    const lastHealthData = JSON.parse(lines[lines.length - 1]);
    const lastCheckTime = new Date(lastHealthData.timestamp);
    const ageMinutes = (Date.now() - lastCheckTime.getTime()) / (1000 * 60);
    
    // Consider unhealthy if:
    // 1. Status is not 'healthy'
    // 2. Last check is older than 60 minutes
    // 3. Multiple recent failures
    const isHealthy = lastHealthData.status === 'healthy' && ageMinutes < 60;
    
    return NextResponse.json({
      status: lastHealthData.status,
      lastCheck: lastHealthData.timestamp,
      ageMinutes: Math.round(ageMinutes),
      lastRun: lastHealthData.lastRun,
      lastRunStatus: lastHealthData.lastRunStatus,
      recentRuns: lastHealthData.recentRuns,
      uptime: lastHealthData.uptime,
      nextRun: lastHealthData.nextRun
    }, { 
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0'
      }
    });
  } catch (error) {
    console.error('Cron health check error:', error);
    return NextResponse.json(
      { 
        status: 'error',
        error: 'Failed to check cron health',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
EOF < /dev/null