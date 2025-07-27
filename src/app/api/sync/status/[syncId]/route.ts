import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { getAdminClient } from '@/lib/db/supabase-admin';

// Use singleton Supabase admin client for better connection pooling
const supabase = getAdminClient();

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
    // 1. Try to read from file first (fast)
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
  } catch (fileError) {
    // 2. File not found - try database fallback
    console.log(`[Sync Status] File not found for ${syncId}, falling back to database`);
    
    try {
      const { data, error } = await supabase
        .from('sync_status')
        .select('*')
        .eq('sync_id', syncId)
        .single();
      
      if (error || !data) {
        console.error(`[Sync Status] Database lookup failed for ${syncId}:`, error);
        throw new Error('Not found in database');
      }
      
      // Clean up completed/failed syncs from database
      if (data.status === 'completed' || data.status === 'failed') {
        setTimeout(async () => {
          await supabase
            .from('sync_status')
            .delete()
            .eq('sync_id', syncId);
        }, 5000);
      }
      
      return NextResponse.json({
        status: data.status,
        progress: data.progress_percentage,
        message: data.current_step,
        error: data.error_message,
        itemsProcessed: data.progress_percentage > 0 ? Math.floor(data.progress_percentage) : 0,
        totalItems: 100
      });
    } catch (dbError) {
      // Neither file nor database has the sync status
      return NextResponse.json(
        {
          error: 'sync_not_found',
          message: 'Sync ID not found or expired'
        },
        { status: 404 }
      );
    }
  }
}