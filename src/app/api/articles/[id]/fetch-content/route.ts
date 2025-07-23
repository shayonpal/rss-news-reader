import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { logInoreaderApiCall } from '@/lib/api/log-api-call';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log('=== FETCH CONTENT API CALLED ===', { params });
  
  try {
    // In Next.js 13+, params might be a Promise
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const decodedId = decodeURIComponent(id);
    const startTime = Date.now();
    
    console.log('Fetch content request:', { id, decodedId });
    
    // Log the API call (though this isn't Inoreader, we track it similarly)
    logInoreaderApiCall(`/api/articles/${decodedId}/fetch-content`, 'manual-fetch', 'POST');

    // Get article from database - try both id and inoreader_id
    let { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', decodedId)
      .single();

    console.log('First query result:', { 
      found: !!article, 
      error: fetchError?.message,
      code: fetchError?.code 
    });

    // If not found by id, try inoreader_id
    if (fetchError?.code === 'PGRST116' || !article) {
      console.log('Trying inoreader_id query...');
      const result = await supabase
        .from('articles')
        .select('*')
        .eq('inoreader_id', decodedId)
        .single();
      
      article = result.data;
      fetchError = result.error;
      
      console.log('Second query result:', { 
        found: !!article, 
        error: fetchError?.message 
      });
    }

    if (fetchError || !article) {
      console.error('Article not found:', { 
        id: decodedId, 
        error: fetchError?.message,
        code: fetchError?.code 
      });
      return NextResponse.json(
        {
          error: 'article_not_found',
          message: 'Article not found',
          details: fetchError?.message
        },
        { status: 404 }
      );
    }

    // Check if we already have full content
    if (article.has_full_content && article.full_content) {
      return NextResponse.json({
        success: true,
        content: article.full_content,
        cached: true
      });
    }

    // Fetch the article URL
    if (!article.url) {
      return NextResponse.json(
        {
          error: 'no_url',
          message: 'Article has no URL to fetch'
        },
        { status: 400 }
      );
    }

    // Fetch the content
    const response = await fetch(article.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; RSS Reader Bot/1.0)'
      },
      signal: AbortSignal.timeout(10000) // 10 second timeout
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch article: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Extract content using Mozilla Readability
    const dom = new JSDOM(html, {
      url: article.url
    });

    const reader = new Readability(dom.window.document);
    const extracted = reader.parse();

    if (!extracted) {
      // Fall back to RSS content
      return NextResponse.json({
        success: true,
        content: article.content,
        fallback: true
      });
    }

    // Clean up the content
    const cleanContent = (extracted.content || '')
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove styles
      .replace(/style="[^"]*"/gi, '') // Remove inline styles
      .replace(/class="[^"]*"/gi, '') // Remove classes
      .trim();

    // Update the article with full content
    const { error: updateError } = await supabase
      .from('articles')
      .update({
        full_content: cleanContent,
        has_full_content: true,
        updated_at: new Date().toISOString()
      })
      .eq('id', article.id);

    if (updateError) {
      console.error('Failed to update article with full content:', updateError);
      // Don't fail the request, just log the error
    }

    // Log the fetch to fetch_logs table
    const { error: logError } = await supabase
      .from('fetch_logs')
      .insert({
        article_id: article.id,
        feed_id: article.feed_id,
        fetch_type: 'manual',
        success: true,
        response_time_ms: Date.now() - startTime,
        content_length: cleanContent.length,
        extraction_method: 'readability',
        user_id: 'shayon'
      });
    
    if (logError) {
      console.error('Failed to log fetch:', logError);
    }

    return NextResponse.json({
      success: true,
      content: cleanContent,
      title: extracted.title,
      excerpt: extracted.excerpt,
      byline: extracted.byline,
      length: extracted.length,
      siteName: extracted.siteName
    });

  } catch (error) {
    console.error('=== CONTENT EXTRACTION ERROR ===', error);
    
    // Check if it's a timeout
    if (error instanceof Error && error.name === 'AbortError') {
      return NextResponse.json(
        {
          error: 'timeout',
          message: 'Request timed out while fetching article'
        },
        { status: 408 }
      );
    }

    return NextResponse.json(
      {
        error: 'extraction_failed',
        message: error instanceof Error ? error.message : 'Failed to extract article content',
        details: error instanceof Error ? error.stack : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Rate limiting for Inoreader API
const checkRateLimit = async () => {
  const today = new Date().toISOString().split('T')[0];
  
  const { data, error } = await supabase
    .from('api_usage')
    .select('count')
    .eq('service', 'inoreader')
    .eq('date', today)
    .single();

  if (error && error.code !== 'PGRST116') { // Not found error is ok
    console.error('Rate limit check error:', error);
    return { allowed: true, remaining: 100 };
  }

  const used = data?.count || 0;
  const limit = 100;
  const remaining = limit - used;

  return {
    allowed: remaining > 0,
    remaining,
    used,
    limit
  };
};