import { NextResponse } from 'next/server';
import { BiDirectionalSyncService } from '@/server/services/bidirectional-sync-nextjs';

// Initialize service
const syncService = new BiDirectionalSyncService();

// Start periodic sync when module loads
syncService.startPeriodicSync();

export async function POST(request: Request) {
  const { action } = await request.json();

  switch (action) {
    case 'trigger':
      await syncService.triggerManualSync();
      return NextResponse.json({ success: true, message: 'Bi-directional sync triggered' });
    
    case 'stats':
      const stats = await syncService.getSyncQueueStats();
      return NextResponse.json(stats);
    
    case 'clear-failed':
      const cleared = await syncService.clearFailedItems();
      return NextResponse.json({ success: true, cleared });
    
    default:
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  }
}