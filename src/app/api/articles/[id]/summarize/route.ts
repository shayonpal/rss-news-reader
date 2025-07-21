import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Initialize Anthropic client
const anthropic = process.env.ANTHROPIC_API_KEY 
  ? new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    })
  : null;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Check if Claude API is configured
    if (!anthropic) {
      return NextResponse.json(
        {
          error: 'api_not_configured',
          message: 'Claude API key not configured on server'
        },
        { status: 503 }
      );
    }

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

    // Check if we already have a summary and if regeneration is requested
    const body = await request.json().catch(() => ({}));
    const forceRegenerate = body.regenerate === true;

    if (article.ai_summary && !forceRegenerate) {
      return NextResponse.json({
        success: true,
        summary: article.ai_summary,
        cached: true
      });
    }

    // Get content to summarize (prefer full content over RSS content)
    const contentToSummarize = article.full_content || article.content;
    
    if (!contentToSummarize) {
      return NextResponse.json(
        {
          error: 'no_content',
          message: 'Article has no content to summarize'
        },
        { status: 400 }
      );
    }

    // Strip HTML tags for cleaner summarization
    const textContent = contentToSummarize
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    // Generate summary using Claude
    const prompt = `You are a news summarization assistant. Create a concise summary of the following article in 150-175 words. Focus on the key facts, main arguments, and important conclusions. Maintain objectivity and preserve the author's core message.

IMPORTANT: Do NOT include the article title in your summary. Start directly with the content summary.

Article Details:
Title: ${article.title || 'Untitled'}
Author: ${article.author || 'Unknown'}
Published: ${article.published_at ? new Date(article.published_at).toLocaleDateString() : 'Unknown'}

Article Content:
${textContent.substring(0, 10000)} ${textContent.length > 10000 ? '...[truncated]' : ''}

Write a clear, informative summary that captures the essence of this article without repeating the title.`;

    // Get model from environment variable with fallback
    const claudeModel = process.env.CLAUDE_SUMMARIZATION_MODEL || 'claude-sonnet-4-20250514';
    
    const completion = await anthropic.messages.create({
      model: claudeModel,
      max_tokens: 300,
      temperature: 0.3,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ]
    });

    const summary = completion.content[0].type === 'text' 
      ? completion.content[0].text 
      : 'Failed to generate summary';

    // Update the article with AI summary
    const { error: updateError } = await supabase
      .from('articles')
      .update({
        ai_summary: summary,
        updated_at: new Date().toISOString()
      })
      .eq('id', id);

    if (updateError) {
      console.error('Failed to update article with summary:', updateError);
      // Don't fail the request, just log the error
    }

    // Track API usage
    await trackApiUsage('claude', 1);

    return NextResponse.json({
      success: true,
      summary,
      model: claudeModel,
      regenerated: forceRegenerate,
      input_tokens: completion.usage.input_tokens,
      output_tokens: completion.usage.output_tokens
    });

  } catch (error) {
    console.error('Summarization error:', error);
    
    // Check for specific Anthropic errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 429) {
        return NextResponse.json(
          {
            error: 'rate_limit',
            message: 'Claude API rate limit exceeded. Please try again later.'
          },
          { status: 429 }
        );
      }
      
      if (error.status === 401) {
        return NextResponse.json(
          {
            error: 'invalid_api_key',
            message: 'Invalid Claude API key'
          },
          { status: 401 }
        );
      }
    }

    return NextResponse.json(
      {
        error: 'summarization_failed',
        message: 'Failed to generate article summary',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Track API usage for rate limiting
async function trackApiUsage(service: string, count: number = 1) {
  const today = new Date().toISOString().split('T')[0];
  
  try {
    // Try to update existing record
    const { data: existing } = await supabase
      .from('api_usage')
      .select('count')
      .eq('service', service)
      .eq('date', today)
      .single();

    if (existing) {
      await supabase
        .from('api_usage')
        .update({ count: existing.count + count })
        .eq('service', service)
        .eq('date', today);
    } else {
      // Create new record
      await supabase
        .from('api_usage')
        .insert({
          service,
          date: today,
          count
        });
    }
  } catch (error) {
    console.error('Failed to track API usage:', error);
  }
}