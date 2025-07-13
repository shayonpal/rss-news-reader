import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    // Check if Claude API key is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json(
        { status: 'not_configured', message: 'Claude API key not set' },
        { status: 501 } // Not Implemented
      );
    }
    
    // Perform a simple health check against Claude API
    // We'll use the models endpoint which is lightweight
    const response = await fetch('https://api.anthropic.com/v1/models', {
      method: 'GET',
      headers: {
        'anthropic-version': '2023-06-01',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
      },
      signal: AbortSignal.timeout(5000), // 5 second timeout
    });
    
    if (!response.ok) {
      return NextResponse.json(
        {
          status: 'unhealthy',
          message: 'Claude API responded with error',
          statusCode: response.status,
        },
        { status: 503 }
      );
    }
    
    return NextResponse.json({
      status: 'healthy',
      message: 'Claude API is accessible',
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Claude health check error:', error);
    return NextResponse.json(
      {
        status: 'unhealthy',
        message: error instanceof Error ? error.message : 'Claude API check failed',
        timestamp: new Date(),
      },
      { status: 503 }
    );
  }
}