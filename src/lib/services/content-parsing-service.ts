import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";
import { supabase } from "@/lib/db/supabase";
import type { Database } from "@/lib/db/types";

export interface ParseContentOptions {
  forceRefresh?: boolean;
  timeout?: number;
}

export interface ParseContentResult {
  success: boolean;
  content?: string;
  error?: string;
  cached?: boolean;
}

export class ContentParsingService {
  private static instance: ContentParsingService;
  private activeParsing: Map<string, Promise<ParseContentResult>> = new Map();
  private maxConcurrent: number = 5;
  private parseTimeout: number = 30000; // 30 seconds default
  private retryDelay: number = 2000; // 2 seconds

  private constructor() {}

  static getInstance(): ContentParsingService {
    if (!ContentParsingService.instance) {
      ContentParsingService.instance = new ContentParsingService();
    }
    return ContentParsingService.instance;
  }

  async parseArticleContent(
    articleId: string,
    options: ParseContentOptions = {}
  ): Promise<ParseContentResult> {
    // Check if already parsing this article
    const existingParse = this.activeParsing.get(articleId);
    if (existingParse) {
      return existingParse;
    }

    // Check concurrent limit
    if (this.activeParsing.size >= this.maxConcurrent) {
      return {
        success: false,
        error: "Too many concurrent parse requests. Please try again later.",
      };
    }

    // Start parsing
    const parsePromise = this.performParse(articleId, options);
    this.activeParsing.set(articleId, parsePromise);

    try {
      return await parsePromise;
    } finally {
      this.activeParsing.delete(articleId);
    }
  }

  private async performParse(
    articleId: string,
    options: ParseContentOptions
  ): Promise<ParseContentResult> {
    try {
      // Get article from database
      const { data: article, error } = await supabase
        .from("articles")
        .select("*, feeds(is_partial_feed)")
        .eq("id", articleId)
        .single();

      if (error || !article) {
        return {
          success: false,
          error: "Article not found",
        };
      }

      // Check if content already parsed and not forcing refresh
      if (
        article.parsed_at &&
        article.full_content &&
        !article.parse_failed &&
        !options.forceRefresh
      ) {
        // Check if parsed content is recent (within last hour)
        const parsedAt = new Date(article.parsed_at);
        const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
        if (parsedAt > hourAgo) {
          return {
            success: true,
            content: article.full_content,
            cached: true,
          };
        }
      }

      // Check if max attempts reached
      if (article.parse_attempts >= 3 && !options.forceRefresh) {
        return {
          success: false,
          error: "Maximum parse attempts reached",
        };
      }

      // Fetch and parse content
      const fullContent = await this.extractContent(
        article.url,
        options.timeout || this.parseTimeout
      );

      if (fullContent) {
        // Update database with parsed content
        await supabase
          .from("articles")
          .update({
            full_content: fullContent,
            has_full_content: true,
            parsed_at: new Date().toISOString(),
            parse_failed: false,
            parse_attempts: article.parse_attempts + 1,
          })
          .eq("id", articleId);

        return {
          success: true,
          content: fullContent,
          cached: false,
        };
      } else {
        // Update failure status
        await supabase
          .from("articles")
          .update({
            parse_failed: true,
            parse_attempts: article.parse_attempts + 1,
          })
          .eq("id", articleId);

        return {
          success: false,
          error: "Failed to extract content",
        };
      }
    } catch (error) {
      console.error("Error parsing article content:", error);
      return {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  }

  private async extractContent(
    url: string,
    timeout: number
  ): Promise<string | null> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

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
      const dom = new JSDOM(html, { url });
      const reader = new Readability(dom.window.document);
      const article = reader.parse();

      return article?.content || null;
    } catch (error) {
      if ((error as any)?.name === "AbortError") {
        console.error("Content extraction timeout");
      } else {
        console.error("Content extraction error:", error);
      }
      return null;
    }
  }

  async detectPartialFeeds(): Promise<void> {
    try {
      // Get recent articles to analyze
      const { data: articles } = await supabase
        .from("articles")
        .select("feed_id, content")
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order("created_at", { ascending: false });

      if (!articles) return;

      // Group by feed and calculate metrics
      const feedMetrics = new Map<string, { totalLength: number; count: number; truncated: number }>();
      
      for (const article of articles) {
        if (!feedMetrics.has(article.feed_id)) {
          feedMetrics.set(article.feed_id, { totalLength: 0, count: 0, truncated: 0 });
        }
        
        const metrics = feedMetrics.get(article.feed_id)!;
        const contentLength = article.content?.length || 0;
        
        metrics.totalLength += contentLength;
        metrics.count++;
        
        // Check for truncation indicators
        if (
          contentLength < 500 ||
          article.content?.includes("Read more") ||
          article.content?.includes("Continue reading") ||
          article.content?.includes("[...]")
        ) {
          metrics.truncated++;
        }
      }

      // Update feeds based on analysis
      for (const [feedId, metrics] of feedMetrics) {
        const avgLength = metrics.totalLength / metrics.count;
        const truncationRatio = metrics.truncated / metrics.count;
        
        const isPartial = avgLength < 500 || truncationRatio > 0.5;
        
        await supabase
          .from("feeds")
          .update({ is_partial_feed: isPartial })
          .eq("id", feedId);
      }
    } catch (error) {
      console.error("Error detecting partial feeds:", error);
    }
  }

}