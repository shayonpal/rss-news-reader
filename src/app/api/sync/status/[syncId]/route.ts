import { NextResponse } from 'next/server';

// Import the shared sync status map
// In production, this should be stored in Redis or a database
declare global {
  // eslint-disable-next-line no-var
  var syncStatus: Map<string, {
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: number;
    message?: string;
    error?: string;
    startTime: number;
  }>;
}

// Initialize if not exists
if (!global.syncStatus) {
  global.syncStatus = new Map();
}

export async function GET(
  request: Request,
  { params }: { params: { syncId: string } }
) {
  const syncId = params.syncId;
  
  // Get status from global map
  const status = global.syncStatus?.get(syncId);
  
  if (!status) {
    return NextResponse.json(
      {
        error: 'sync_not_found',
        message: 'Sync ID not found'
      },
      { status: 404 }
    );
  }

  return NextResponse.json({
    status: status.status,
    progress: status.progress,
    message: status.message,
    error: status.error,
    // Calculate items processed based on progress
    itemsProcessed: status.progress > 0 ? Math.floor(status.progress) : 0,
    totalItems: 100 // Approximate
  });
}