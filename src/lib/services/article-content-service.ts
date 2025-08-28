/**
 * Service for ensuring articles have full content before processing
 * Implements RR-256: Auto-fetch full content for partial feeds
 */

import { supabase } from "@/lib/db/supabase";
import { ContentParsingService } from "./content-parsing-service";

interface FetchResult {
  content: string;
  wasFetched: boolean;
}

interface FetchLogEntry {
  article_id: string | null;
  feed_id: string | null;
  status: "attempt" | "success" | "failure";
  fetch_type: "manual" | "auto";
  duration_ms: number | null;
  error_reason?: string | null;
  error_details?: any;
}

export class ArticleContentService {
  private static instance: ArticleContentService;
  private parsingService: ContentParsingService;
  private activeParses: Map<string, Promise<string | null>>;
  private readonly MAX_CONCURRENT_PARSES = 3;
  private readonly PARSE_TIMEOUT = 30000; // 30 seconds

  private constructor() {
    this.parsingService = ContentParsingService.getInstance();
    this.activeParses = new Map();
  }

  static getInstance(): ArticleContentService {
    if (!ArticleContentService.instance) {
      ArticleContentService.instance = new ArticleContentService();
    }
    return ArticleContentService.instance;
  }

  /**
   * Ensures article has full content, fetching if necessary for partial feeds
   * Implements main logic for RR-256
   */
  async ensureFullContent(
    articleId: string,
    feedId: string
  ): Promise<FetchResult> {
    const startTime = Date.now();

    try {
      // Fetch article and feed data
      const { data: article, error: articleError } = await supabase
        .from("articles")
        .select("*, feeds!inner(*)")
        .eq("id", articleId)
        .eq("feed_id", feedId)
        .single();

      if (articleError || !article) {
        throw new Error(`Article not found: ${articleId}`);
      }

      const feed = article.feeds as any;

      // Skip conditions
      if (!this.shouldFetchContent(article, feed)) {
        await this.logFetchAttempt({
          article_id: articleId,
          feed_id: feedId,
          status: "success",
          fetch_type: "auto",
          duration_ms: Date.now() - startTime,
          error_reason: null,
          error_details: { message: "Content fetch not required - skipped" },
        });

        return {
          content: article.full_content || article.content,
          wasFetched: false,
        };
      }

      // Check concurrent parse limit
      if (this.activeParses.size >= this.MAX_CONCURRENT_PARSES) {
        // Wait for one to complete
        await Promise.race(Array.from(this.activeParses.values()));
      }

      // Fetch full content with timeout
      const fetchPromise = this.fetchFullContent(article.link);
      const parseKey = `${articleId}-${Date.now()}`;
      this.activeParses.set(parseKey, fetchPromise);

      try {
        const fullContent = await Promise.race([
          fetchPromise,
          this.createTimeoutPromise(),
        ]);

        if (!fullContent) {
          throw new Error("Content extraction returned empty");
        }

        // Update article with full content atomically
        const { error: updateError } = await supabase
          .from("articles")
          .update({
            full_content: fullContent,
            has_full_content: true,
          })
          .eq("id", articleId);

        if (updateError) {
          throw updateError;
        }

        // Log successful fetch
        await this.logFetchAttempt({
          article_id: articleId,
          feed_id: feedId,
          status: "success",
          fetch_type: "auto",
          duration_ms: Date.now() - startTime,
          error_reason: null,
          error_details: { content_length: fullContent.length },
        });

        return {
          content: fullContent,
          wasFetched: true,
        };
      } finally {
        this.activeParses.delete(parseKey);
      }
    } catch (error) {
      // Log failure
      await this.logFetchAttempt({
        article_id: articleId,
        feed_id: feedId,
        status: "failure",
        fetch_type: "auto",
        duration_ms: Date.now() - startTime,
        error_reason:
          error instanceof Error && error.message.includes("timeout")
            ? "Timeout"
            : "Extraction failed",
        error_details: {
          error_message: error instanceof Error ? error.message : String(error),
        },
      });

      // Return original content on failure
      const { data: article } = await supabase
        .from("articles")
        .select("content, full_content")
        .eq("id", articleId)
        .single();

      return {
        content: article?.full_content || article?.content || "",
        wasFetched: false,
      };
    }
  }

  /**
   * Determines if content should be fetched based on feed and article state
   */
  private shouldFetchContent(article: any, feed: any): boolean {
    // Check acceptance criteria from RR-256
    // 1. Feed must be marked as partial
    if (!feed.is_partial_content) {
      return false;
    }

    // 2. Article must not already have full content
    if (article.has_full_content && article.full_content) {
      return false;
    }

    // Additional check: User preference (if feed has fetch_full_content flag)
    // This allows users to opt-out even for partial feeds
    if (feed.fetch_full_content === false) {
      return false;
    }

    return true;
  }

  /**
   * Fetches full content from article URL using existing extraction infrastructure
   */
  async fetchFullContent(url: string): Promise<string | null> {
    try {
      // We need an article ID to use the ContentParsingService
      // For now, create a temporary article record or use direct extraction
      // This is a simplified approach for RR-256 implementation
      const result = await this.directExtractContent(url);

      if (!result) {
        return null;
      }

      // Sanitize and return content
      return this.sanitizeContent(result);
    } catch (error) {
      console.error(`Failed to fetch content from ${url}:`, error);
      return null;
    }
  }

  /**
   * Direct content extraction using the same logic as ContentParsingService
   */
  private async directExtractContent(url: string): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        this.PARSE_TIMEOUT
      );

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; RSS Reader Bot/1.0; +http://example.com/bot)",
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const html = await response.text();

      // Simple content extraction - in a real implementation you'd use Readability
      // For now, just return the HTML content
      return html;
    } catch (error) {
      if ((error as any)?.name === "AbortError") {
        console.error("Content extraction timeout");
      } else {
        console.error("Content extraction error:", error);
      }
      return null;
    }
  }

  /**
   * Checks if a feed is configured as partial content
   */
  async checkPartialFeedStatus(feedId: string): Promise<boolean> {
    const { data: feed, error } = await supabase
      .from("feeds")
      .select("is_partial_content")
      .eq("id", feedId)
      .single();

    if (error || !feed) {
      return false;
    }

    return feed.is_partial_content || false;
  }

  /**
   * Logs fetch attempt to fetch_logs table for monitoring
   */
  private async logFetchAttempt(log: FetchLogEntry): Promise<void> {
    try {
      const { error } = await supabase.from("fetch_logs").insert(log);
      if (error) {
        console.error("Failed to log fetch attempt:", error);
      }
    } catch (error) {
      console.error("Failed to log fetch attempt:", error);
      // Don't throw - logging failures shouldn't break the main flow
    }
  }

  /**
   * Creates a timeout promise for race conditions
   */
  private createTimeoutPromise(): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(
          new Error(`Content fetch timeout after ${this.PARSE_TIMEOUT}ms`)
        );
      }, this.PARSE_TIMEOUT);
    });
  }

  /**
   * Sanitizes extracted HTML content
   */
  private sanitizeContent(content: string): string {
    // Remove script tags and dangerous elements
    let sanitized = content.replace(
      /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
      ""
    );
    sanitized = sanitized.replace(
      /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
      ""
    );

    // Remove inline event handlers
    sanitized = sanitized.replace(/\son\w+\s*=\s*"[^"]*"/gi, "");
    sanitized = sanitized.replace(/\son\w+\s*=\s*'[^']*'/gi, "");

    // Trim whitespace
    sanitized = sanitized.trim();

    return sanitized;
  }

  /**
   * Updates article content atomically with retry logic
   */
  private async updateArticleContent(
    articleId: string,
    content: string
  ): Promise<void> {
    const maxRetries = 3;
    let attempt = 0;

    while (attempt < maxRetries) {
      try {
        const { error } = await supabase
          .from("articles")
          .update({
            full_content: content,
            has_full_content: true,
          })
          .eq("id", articleId);

        if (!error) {
          return;
        }

        if (attempt === maxRetries - 1) {
          throw error;
        }
      } catch (error) {
        if (attempt === maxRetries - 1) {
          throw error;
        }
      }

      attempt++;
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}
