/**
 * Service for ensuring articles have full content before processing
 * Implements RR-256: Auto-fetch full content for partial feeds
 */

import { supabase } from "@/lib/db/supabase";

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

import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

export class ArticleContentService {
  private static instance: ArticleContentService;
  private activeParses: Map<string, Promise<string | null>>;
  private pendingQueue: Array<() => void> = [];
  private articleLocks: Map<string, Promise<FetchResult>> = new Map();
  private readonly MAX_CONCURRENT_PARSES = 3;
  private readonly PARSE_TIMEOUT = 30000; // 30 seconds

  private constructor() {
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
    // Check if already processing this article
    const lockKey = `${articleId}-${feedId}`;
    if (this.articleLocks.has(lockKey)) {
      console.log(`🔒 Article ${articleId} already being processed, waiting for result...`);
      return await this.articleLocks.get(lockKey)!;
    }

    // Create promise for this article processing
    const processPromise = this.processArticleContent(articleId, feedId);
    this.articleLocks.set(lockKey, processPromise);

    try {
      const result = await processPromise;
      return result;
    } finally {
      // Clean up the lock after processing (success or failure)
      this.articleLocks.delete(lockKey);
    }
  }

  /**
   * Processes article content fetching with proper concurrency control
   * This is the actual implementation, wrapped by ensureFullContent for de-duplication
   */
  private async processArticleContent(
    articleId: string,
    feedId: string
  ): Promise<FetchResult> {
    const startTime = Date.now();
    let article: any = null;  // Cache article data to avoid re-fetching

    try {
      // Fetch article and feed data
      const { data: articleData, error: articleError } = await supabase
        .from("articles")
        .select("*, feeds!inner(*)")
        .eq("id", articleId)
        .eq("feed_id", feedId)
        .single();
      
      article = articleData;

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

      // Implement proper semaphore for concurrent parse limit
      await this.acquireSemaphore();

      const parseKey = `${articleId}-${Date.now()}`;
      
      try {
        // Fetch full content with timeout
        const fetchPromise = this.fetchFullContent(articleId, article.link);
        this.activeParses.set(parseKey, fetchPromise);

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
        this.releaseSemaphore();
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

      // Return original content on failure (use cached article data)
      // No need to re-fetch from database as we already have the article
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
  async fetchFullContent(
    articleId: string,
    url: string
  ): Promise<string | null> {
    try {
      // Build absolute URL for server-side fetch
      // Use NEXT_PUBLIC_APP_URL which already includes the port
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
      const absoluteUrl = `${baseUrl}/reader/api/articles/${articleId}/fetch-content`;
      
      // Make API call to the fetch-content endpoint as expected by tests
      const response = await fetch(absoluteUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();

      if (!data.success || !data.content) {
        return null;
      }

      // Sanitize and return content
      return this.sanitizeContent(data.content);
    } catch (error) {
      console.error(`Failed to fetch content from ${url}:`, error);
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
   * Acquires a semaphore slot for concurrent parsing
   * Implements proper queue-based concurrency control
   */
  private async acquireSemaphore(): Promise<void> {
    while (this.activeParses.size >= this.MAX_CONCURRENT_PARSES) {
      // Create a promise that will be resolved when a slot becomes available
      // Add timeout to prevent indefinite waiting
      const QUEUE_TIMEOUT = 60000; // 60 seconds max wait time
      
      await Promise.race([
        new Promise<void>((resolve) => {
          this.pendingQueue.push(resolve);
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            // Remove from queue if still pending
            const index = this.pendingQueue.findIndex(fn => fn === reject);
            if (index > -1) {
              this.pendingQueue.splice(index, 1);
            }
            reject(new Error(`Semaphore queue timeout after ${QUEUE_TIMEOUT}ms`));
          }, QUEUE_TIMEOUT);
        })
      ]);
    }
  }

  /**
   * Releases a semaphore slot and processes pending queue
   */
  private releaseSemaphore(): void {
    // Process the next waiting request if any
    const nextResolve = this.pendingQueue.shift();
    if (nextResolve) {
      try {
        nextResolve();
      } catch (error) {
        console.error('Error releasing semaphore to queued request:', error);
        // Continue to process queue even if one resolution fails
        // This prevents the queue from getting stuck
        this.releaseSemaphore();
      }
    }
  }

  /**
   * Sanitizes extracted HTML content
   */
  private sanitizeContent(content: string): string {
    // Create a new JSDOM instance for server-side DOMPurify
    const window = new JSDOM('').window;
    // @ts-ignore - DOMPurify types don't perfectly match JSDOM window
    const purify = DOMPurify(window);
    
    // Configure DOMPurify with secure defaults
    const config = {
      ALLOWED_TAGS: [
        'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
        'blockquote', 'ul', 'ol', 'li', 'a', 'img', 'code', 'pre', 'div', 'span',
        'table', 'thead', 'tbody', 'tr', 'td', 'th', 'caption', 'article', 'section',
        'aside', 'figure', 'figcaption', 'mark', 'small', 'del', 'ins', 'sub', 'sup'
      ],
      ALLOWED_ATTR: [
        'href', 'src', 'alt', 'title', 'width', 'height', 'class', 'id', 
        'target', 'rel', 'loading', 'decoding', 'style'
      ],
      ALLOW_DATA_ATTR: false,
      FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'form', 'input', 'button'],
      FORBID_ATTR: ['onerror', 'onload', 'onclick', 'onmouseover', 'onfocus', 'onblur'],
      KEEP_CONTENT: true,
      SAFE_FOR_TEMPLATES: true,
      SANITIZE_DOM: true,
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      FORCE_BODY: false,
      IN_PLACE: false
    };
    
    // Sanitize the content
    const sanitized = purify.sanitize(content, config);
    
    // Trim whitespace
    return sanitized.trim();
  }

}
