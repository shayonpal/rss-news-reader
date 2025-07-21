import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get article from database
    const { data: article, error: fetchError } = await supabase
      .from('articles')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !article) {
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
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update article with full content:', updateError);
      // Don't fail the request, just log the error
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
    console.error('Content extraction error:', error);
    
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
        message: 'Failed to extract article content',
        details: error instanceof Error ? error.message : 'Unknown error'
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