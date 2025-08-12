import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { logInoreaderApiCall } from "@/lib/api/log-api-call";
import { ContentParsingService } from "@/lib/services/content-parsing-service";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// Track concurrent parsing operations (in production, use Redis)
const activeParsing = new Map<string, Promise<any>>();
const MAX_CONCURRENT_PARSES = 5;

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  console.log("=== FETCH CONTENT API CALLED ===", { params });
  const startTime = Date.now();

  try {
    // In Next.js 13+, params might be a Promise
    const resolvedParams = await Promise.resolve(params);
    const { id } = resolvedParams;
    const decodedId = decodeURIComponent(id);

    console.log("Fetch content request:", { id, decodedId });

    // Check if already parsing this article
    if (activeParsing.has(decodedId)) {
      console.log("Already parsing article:", decodedId);
      return activeParsing.get(decodedId);
    }

    // Check concurrent limit
    if (activeParsing.size >= MAX_CONCURRENT_PARSES) {
      return NextResponse.json(
        {
          error: "rate_limit",
          message:
            "Too many concurrent parse requests. Please try again later.",
        },
        { status: 429 }
      );
    }

    // Create parsing promise
    const parsePromise = performParsing(request, decodedId, startTime);
    activeParsing.set(decodedId, parsePromise);

    try {
      return await parsePromise;
    } finally {
      activeParsing.delete(decodedId);
    }
  } catch (error) {
    console.error("=== UNEXPECTED ERROR ===", error);
    return NextResponse.json(
      {
        error: "unexpected_error",
        message:
          error instanceof Error ? error.message : "Unexpected error occurred",
      },
      { status: 500 }
    );
  }
}

async function performParsing(
  request: NextRequest,
  decodedId: string,
  startTime: number
): Promise<NextResponse> {
  try {
    // Log the API call (though this isn't Inoreader, we track it similarly)
    logInoreaderApiCall(
      `/api/articles/${decodedId}/fetch-content`,
      "manual-fetch",
      "POST"
    );

    // Get article from database - try both id and inoreader_id
    let { data: article, error: fetchError } = await supabase
      .from("articles")
      .select("*")
      .eq("id", decodedId)
      .single();

    console.log("First query result:", {
      found: !!article,
      error: fetchError?.message,
      code: fetchError?.code,
    });

    // If not found by id, try inoreader_id
    if (fetchError?.code === "PGRST116" || !article) {
      console.log("Trying inoreader_id query...");
      const result = await supabase
        .from("articles")
        .select("*")
        .eq("inoreader_id", decodedId)
        .single();

      article = result.data;
      fetchError = result.error;

      console.log("Second query result:", {
        found: !!article,
        error: fetchError?.message,
      });
    }

    if (fetchError || !article) {
      console.error("Article not found:", {
        id: decodedId,
        error: fetchError?.message,
        code: fetchError?.code,
      });
      return NextResponse.json(
        {
          error: "article_not_found",
          message: "Article not found",
          details: fetchError?.message,
        },
        { status: 404 }
      );
    }

    // Check if we already have full content and it's fresh
    if (article.has_full_content && article.full_content && article.parsed_at) {
      // Check if parsed content is recent (within last hour)
      const parsedAt = new Date(article.parsed_at);
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (parsedAt > hourAgo && !article.parse_failed) {
        return NextResponse.json({
          success: true,
          content: article.full_content,
          cached: true,
          parsedAt: article.parsed_at,
        });
      }
    }

    // Check if max parse attempts reached
    if (article.parse_failed && article.parse_attempts >= 3) {
      // Check if force refresh is requested
      const body = await request.json().catch(() => ({}));
      if (!body.forceRefresh) {
        return NextResponse.json({
          success: false,
          content: article.content, // Fallback to RSS content
          fallback: true,
          error: "Maximum parse attempts reached",
          parseFailed: true,
        });
      }
    }

    // Fetch the article URL
    if (!article.url) {
      // Log failure
      await supabase.from("fetch_logs").insert({
        article_id: article.id,
        feed_id: article.feed_id,
        fetch_type: "manual",
        status: "failure",
        error_reason: "no_url",
        duration_ms: Date.now() - startTime,
      });

      return NextResponse.json(
        {
          error: "no_url",
          message: "Article has no URL to fetch",
        },
        { status: 400 }
      );
    }

    // Log attempt
    await supabase.from("fetch_logs").insert({
      article_id: article.id,
      feed_id: article.feed_id,
      fetch_type: "manual",
      status: "attempt",
    });

    // Fetch the content with 30 second timeout (as per RR-148 spec)
    const response = await fetch(article.url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; RSS Reader Bot/1.0)",
      },
      signal: AbortSignal.timeout(30000), // 30 second timeout per RR-148
    });

    if (!response.ok) {
      throw new Error(
        `Failed to fetch article: ${response.status} ${response.statusText}`
      );
    }

    const html = await response.text();

    // Extract content using Mozilla Readability
    const dom = new JSDOM(html, {
      url: article.url,
    });

    const reader = new Readability(dom.window.document);
    const extracted = reader.parse();

    if (!extracted) {
      // Log failure
      await supabase.from("fetch_logs").insert({
        article_id: article.id,
        feed_id: article.feed_id,
        fetch_type: "manual",
        status: "failure",
        error_reason: "extraction_failed",
        error_details: { message: "Readability could not extract content" },
        duration_ms: Date.now() - startTime,
      });

      // Mark as failed and fall back to RSS content
      await supabase
        .from("articles")
        .update({
          parse_failed: true,
          parse_attempts: (article.parse_attempts || 0) + 1,
        })
        .eq("id", article.id);

      return NextResponse.json({
        success: false,
        content: article.content,
        fallback: true,
        error: "Content extraction failed",
        canRetry: (article.parse_attempts || 0) < 3,
      });
    }

    // Clean up the content
    const cleanContent = (extracted.content || "")
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "") // Remove scripts
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "") // Remove styles
      .replace(/style="[^"]*"/gi, "") // Remove inline styles
      .replace(/class="[^"]*"/gi, "") // Remove classes
      .trim();

    // Update the article with full content and parsing metadata
    const { error: updateError } = await supabase
      .from("articles")
      .update({
        full_content: cleanContent,
        has_full_content: true,
        parsed_at: new Date().toISOString(),
        parse_failed: false,
        parse_attempts: (article.parse_attempts || 0) + 1,
        content_length: cleanContent.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", article.id);

    if (updateError) {
      console.error("Failed to update article with full content:", updateError);
      // Don't fail the request, just log the error
    }

    // Log success
    const duration = Date.now() - startTime;
    await supabase.from("fetch_logs").insert({
      article_id: article.id,
      feed_id: article.feed_id,
      fetch_type: "manual",
      status: "success",
      duration_ms: duration,
    });

    return NextResponse.json({
      success: true,
      content: cleanContent,
      title: extracted.title,
      excerpt: extracted.excerpt,
      byline: extracted.byline,
      length: extracted.length,
      siteName: extracted.siteName,
      parsedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("=== CONTENT EXTRACTION ERROR ===", error);
    const duration = Date.now() - startTime;

    // Try to get article ID for logging (might have failed before fetching article)
    let articleId: string | undefined;
    let feedId: string | undefined;

    try {
      // Try to get article info for logging
      const { data: article } = await supabase
        .from("articles")
        .select("id, feed_id")
        .or(`id.eq.${decodedId},inoreader_id.eq.${decodedId}`)
        .single();

      articleId = article?.id;
      feedId = article?.feed_id;
    } catch (err) {
      // Ignore errors in error handler
    }

    // Log error if we have article info
    if (articleId) {
      const errorReason =
        error instanceof Error && error.name === "AbortError"
          ? "timeout"
          : "exception";

      await supabase.from("fetch_logs").insert({
        article_id: articleId,
        feed_id: feedId,
        fetch_type: "manual",
        status: "failure",
        error_reason: errorReason,
        error_details: {
          message: error instanceof Error ? error.message : "Unknown error",
          stack: error instanceof Error ? error.stack : undefined,
        },
        duration_ms: duration,
      });

      // Also update parse_failed flag
      // First get current parse_attempts
      const { data: article } = await supabase
        .from("articles")
        .select("parse_attempts")
        .eq("id", articleId)
        .single();

      await supabase
        .from("articles")
        .update({
          parse_failed: true,
          parse_attempts: (article?.parse_attempts || 0) + 1,
        })
        .eq("id", articleId);
    }

    // Check if it's a timeout
    if (error instanceof Error && error.name === "AbortError") {
      return NextResponse.json(
        {
          error: "timeout",
          message: "Request timed out while fetching article",
        },
        { status: 408 }
      );
    }

    return NextResponse.json(
      {
        error: "extraction_failed",
        message:
          error instanceof Error
            ? error.message
            : "Failed to extract article content",
        details: error instanceof Error ? error.stack : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Rate limiting for Inoreader API
const checkRateLimit = async () => {
  const today = new Date().toISOString().split("T")[0];

  const { data, error } = await supabase
    .from("api_usage")
    .select("count")
    .eq("service", "inoreader")
    .eq("date", today)
    .single();

  if (error && error.code !== "PGRST116") {
    // Not found error is ok
    console.error("Rate limit check error:", error);
    return { allowed: true, remaining: 100 };
  }

  const used = data?.count || 0;
  const limit = 100;
  const remaining = limit - used;

  return {
    allowed: remaining > 0,
    remaining,
    used,
    limit,
  };
};
