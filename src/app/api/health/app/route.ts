import { NextRequest, NextResponse } from 'next/server';
import { GET as healthCheck } from '../route';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

// Alias endpoint for /api/health/app that calls the main health check
export async function GET(request: NextRequest) {
  return healthCheck(request);
}