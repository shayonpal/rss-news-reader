// DISABLED: This route is temporarily disabled due to missing environment variables
// To re-enable, uncomment the code below and ensure SUPABASE_SERVICE_ROLE_KEY is set

/*
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Track API usage
async function trackApiUsage(service: string, count: number = 1) {
  const today = new Date().toISOString().split('T')[0];
  
  await supabase.rpc('increment_api_usage', {
    p_service: service,
    p_date: today,
    p_increment: count
  });
}

export async function POST(request: NextRequest) {
  try {
    const { feedId, folderId } = await request.json();
    
    // Get the appropriate stream ID
    let streamId: string;
    let articlesToUpdate: any[] = [];
    
    if (feedId) {
      // Get feed's Inoreader ID
      const { data: feed, error: feedError } = await supabase
        .from('feeds')
        .select('inoreader_id')
        .eq('id', feedId)
        .single();
      
      if (feedError || !feed) {
        throw new Error('Feed not found');
      }
      
      streamId = feed.inoreader_id;
      
      // Get all unread articles for this feed
      const { data: articles } = await supabase
        .from('articles')
        .select('id')
        .eq('feed_id', feedId)
        .eq('is_read', false);
      
      articlesToUpdate = articles || [];
      
    } else if (folderId) {
      // Get folder's Inoreader ID
      const { data: folder, error: folderError } = await supabase
        .from('folders')
        .select('inoreader_id')
        .eq('id', folderId)
        .single();
      
      if (folderError || !folder) {
        throw new Error('Folder not found');
      }
      
      streamId = folder.inoreader_id;
      
      // Get all unread articles for feeds in this folder
      const { data: feeds } = await supabase
        .from('feeds')
        .select('id')
        .eq('folder_id', folderId);
      
      if (feeds && feeds.length > 0) {
        const feedIds = feeds.map(f => f.id);
        const { data: articles } = await supabase
          .from('articles')
          .select('id')
          .in('feed_id', feedIds)
          .eq('is_read', false);
        
        articlesToUpdate = articles || [];
      }
      
    } else {
      // Mark all articles as read
      streamId = 'user/-/state/com.google/reading-list';
      
      const { data: articles } = await supabase
        .from('articles')
        .select('id')
        .eq('is_read', false);
      
      articlesToUpdate = articles || [];
    }

    // Call server endpoint to sync with Inoreader
    const serverUrl = process.env.SYNC_SERVER_URL || 'http://localhost:3002';
    const response = await fetch(`${serverUrl}/server/mark-all-read`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ streamId })
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Server sync failed: ${error}`);
    }

    // Update all articles locally
    if (articlesToUpdate.length > 0) {
      const articleIds = articlesToUpdate.map(a => a.id);
      const timestamp = new Date().toISOString();
      
      const { error: updateError } = await supabase
        .from('articles')
        .update({ 
          is_read: true,
          last_local_update: timestamp,
          last_sync_update: timestamp // Mark as synced since we're doing it immediately
        })
        .in('id', articleIds);

      if (updateError) {
        console.error('Error updating articles:', updateError);
      }

      // Refresh feed stats
      await supabase.rpc('refresh_feed_stats');
    }

    // Track API usage
    await trackApiUsage('inoreader', 1);

    return NextResponse.json({ 
      success: true,
      articlesUpdated: articlesToUpdate.length 
    });
    
  } catch (error) {
    console.error('Mark all as read error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to mark all as read' },
      { status: 500 }
    );
  }
}
*/

// Temporary disabled response
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  return NextResponse.json(
    { error: 'This endpoint is temporarily disabled' },
    { status: 503 }
  );
}