import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

// File-based sync status tracking for serverless compatibility
interface SyncStatus {
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  message?: string;
  error?: string;
  startTime: number;
  syncId: string;
}

// Get sync status file path
function getSyncStatusPath(syncId: string): string {
  return path.join('/tmp', `sync-status-${syncId}.json`);
}

export async function GET(
  request: Request,
  { params }: { params: { syncId: string } }
) {
  const syncId = params.syncId;
  
  try {
    // Read status from file
    const filePath = getSyncStatusPath(syncId);
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const status: SyncStatus = JSON.parse(fileContent);
    
    // Clean up completed/failed syncs after reading
    if (status.status === 'completed' || status.status === 'failed') {
      // Delete file after 5 seconds to allow final reads
      setTimeout(async () => {
        try {
          await fs.unlink(filePath);
        } catch (error) {
          // File might already be deleted
        }
      }, 5000);
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
  } catch (error) {
    // File not found or parse error
    return NextResponse.json(
      {
        error: 'sync_not_found',
        message: 'Sync ID not found or expired'
      },
      { status: 404 }
    );
  }
}