import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Get current feed stats
    const { data: beforeStats, error: beforeError } = await supabase
      .from('feed_stats')
      .select('*')
      .order('feed_id');

    if (beforeError) {
      return NextResponse.json({
        error: 'Failed to get feed stats before refresh',
        details: beforeError.message
      }, { status: 500 });
    }

    // Refresh the materialized view
    const { error: refreshError } = await supabase.rpc('refresh_feed_stats');
    
    if (refreshError) {
      return NextResponse.json({
        error: 'Failed to refresh feed stats',
        details: refreshError.message
      }, { status: 500 });
    }

    // Get updated feed stats
    const { data: afterStats, error: afterError } = await supabase
      .from('feed_stats')
      .select('*')
      .order('feed_id');

    if (afterError) {
      return NextResponse.json({
        error: 'Failed to get feed stats after refresh',
        details: afterError.message
      }, { status: 500 });
    }

    // Compare before and after
    const changes: Array<{feed_id: string, before: number, after: number}> = [];
    const beforeMap = new Map(beforeStats?.map(s => [s.feed_id, s]) || []);
    
    afterStats?.forEach(stat => {
      const before = beforeMap.get(stat.feed_id);
      if (!before || before.unread_count !== stat.unread_count) {
        changes.push({
          feed_id: stat.feed_id,
          before: before?.unread_count || 0,
          after: stat.unread_count
        });
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Feed stats refreshed successfully',
      stats: {
        before: beforeStats?.length || 0,
        after: afterStats?.length || 0,
        changes: changes.length
      },
      changes
    });

  } catch (error) {
    console.error('Test refresh stats error:', error);
    return NextResponse.json({
      error: 'Failed to test refresh stats',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}