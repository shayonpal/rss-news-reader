import { NextRequest, NextResponse } from 'next/server';
import { serverHealthCheck } from '@/lib/health/server-health-check';

export async function GET(request: NextRequest) {
  try {
    // Check if this is a simple ping
    const url = new URL(request.url);
    const isPing = url.searchParams.get('ping') === 'true';
    
    if (isPing) {
      return NextResponse.json({ status: 'ok', timestamp: new Date() });
    }
    
    // Perform server-side health check
    const health = await serverHealthCheck.checkHealth();
    
    // Determine HTTP status code based on health
    let statusCode = 200;
    if (health.overall === 'unhealthy') {
      statusCode = 503; // Service Unavailable
    } else if (health.overall === 'degraded') {
      statusCode = 200; // Still return 200 for degraded, but include status in body
    }
    
    return NextResponse.json(health, { status: statusCode });
  } catch (error) {
    console.error('Health check endpoint error:', error);
    return NextResponse.json(
      {
        overall: 'unhealthy',
        timestamp: new Date(),
        error: error instanceof Error ? error.message : 'Health check failed',
        services: [],
        metrics: {
          uptime: 0,
          totalChecks: 0,
          failedChecks: 0,
          avgResponseTime: 0,
        },
      },
      { status: 503 }
    );
  }
}