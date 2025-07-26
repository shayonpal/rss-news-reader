import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET() {
  try {
    // Test sync endpoint
    const syncResponse = await fetch(`http://localhost:${process.env.PORT || 3000}/api/sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    const syncData = await syncResponse.json();
    
    // Get a sample article for testing
    const { data: article } = await supabase
      .from('articles')
      .select('id, title')
      .limit(1)
      .single();
    
    const endpoints = {
      sync: {
        endpoint: '/api/sync',
        method: 'POST',
        status: syncResponse.status,
        response: syncData
      },
      syncStatus: article ? {
        endpoint: `/api/sync/status/:syncId`,
        method: 'GET',
        example: `/api/sync/status/${syncData.syncId || 'example-id'}`,
        note: 'Poll this endpoint to check sync progress'
      } : null,
      fetchContent: article ? {
        endpoint: `/api/articles/:id/fetch-content`,
        method: 'POST',
        example: `/api/articles/${article.id}/fetch-content`,
        articleTitle: article.title
      } : null,
      summarize: article ? {
        endpoint: `/api/articles/:id/summarize`,
        method: 'POST',
        example: `/api/articles/${article.id}/summarize`,
        articleTitle: article.title,
        note: 'Requires ANTHROPIC_API_KEY in server environment'
      } : null
    };
    
    // Check rate limit status
    const today = new Date().toISOString().split('T')[0];
    const { data: apiUsage } = await supabase
      .from('api_usage')
      .select('*')
      .eq('date', today);
    
    return NextResponse.json({
      success: true,
      message: 'API endpoints test results',
      endpoints,
      rateLimit: {
        date: today,
        usage: apiUsage || [],
        inoreaderLimit: 100
      },
      implementation: {
        completed: [
          'POST /api/sync - Trigger manual sync',
          'GET /api/sync/status/:id - Check sync progress',
          'POST /api/articles/:id/fetch-content - Extract full content',
          'POST /api/articles/:id/summarize - Generate AI summary'
        ],
        features: [
          'Rate limiting (100 calls/day for Inoreader)',
          'Proper error codes (429, 500, etc.)',
          'Consistent response format',
          'API usage tracking'
        ]
      }
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'test_failed',
        message: 'Failed to test API endpoints',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}