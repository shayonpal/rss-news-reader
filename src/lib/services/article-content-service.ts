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

import DOMPurify from "dompurify";
import { JSDOM } from "jsdom";

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
      console.log(
        `🔒 Article ${articleId} already being processed, waiting for result...`
      );
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
    let article: any = null; // Cache article data to avoid re-fetching
    let semaphoreAcquired = false; // Track if we've acquired the semaphore

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

      console.log("🔍 Article data structure:", {
        articleId: article.id,
        hasFeeds: !!article.feeds,
        feedsType: typeof article.feeds,
        articleKeys: Object.keys(article).filter(
          (k) => k.includes("partial") || k.includes("feed") || k === "feeds"
        ),
        sampleFeedData: article.feeds,
      });

      const feed = article.feeds;

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

      // Acquire semaphore BEFORE starting the fetch operation
      // This ensures we properly limit concurrent parse operations
      await this.acquireSemaphore();
      semaphoreAcquired = true; // Mark that we've acquired it

      const parseKey = `${articleId}-${Date.now()}`;

      try {
        // Fetch full content with timeout
        const fetchPromise = this.fetchFullContent(articleId, article.url);
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
        // Only release if we acquired it
        if (semaphoreAcquired) {
          this.releaseSemaphore();
        }
      }
    } catch (error) {
      // Only release semaphore if we acquired it
      if (semaphoreAcquired) {
        this.releaseSemaphore();
      }

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
    console.log("🔍 shouldFetchContent debug:", {
      articleId: article.id,
      feedIsPartial: feed.is_partial_content,
      hasFullContent: article.has_full_content,
      fullContentExists: !!article.full_content,
      fetchFullContentFlag: feed.fetch_full_content,
    });

    // Check acceptance criteria from RR-256
    // 1. Feed must be marked as partial
    if (!feed.is_partial_content) {
      console.log(
        "❌ Auto-fetch skipped: feed is not marked as partial content"
      );
      return false;
    }

    // 2. Article must not already have full content
    if (article.has_full_content && article.full_content) {
      console.log("❌ Auto-fetch skipped: article already has full content");
      return false;
    }

    // Additional check: User preference (if feed has fetch_full_content flag)
    // This allows users to opt-out even for partial feeds
    if (feed.fetch_full_content === false) {
      console.log(
        "❌ Auto-fetch skipped: fetch_full_content disabled for this feed"
      );
      return false;
    }

    console.log("✅ Auto-fetch should proceed - all conditions met");
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
      // Validate URL to prevent SSRF attacks
      if (!this.isValidArticleUrl(url)) {
        console.warn(`Invalid or unsafe URL rejected: ${url}`);
        return null;
      }

      // Build absolute URL for server-side fetch
      // Use NEXT_PUBLIC_APP_URL which already includes the port
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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

      // Store the resolve function so we can remove it on timeout
      let resolveFunc: (() => void) | null = null;

      await Promise.race([
        new Promise<void>((resolve) => {
          resolveFunc = resolve;
          this.pendingQueue.push(resolve);
        }),
        new Promise<void>((_, reject) => {
          setTimeout(() => {
            // Remove from queue if still pending
            if (resolveFunc) {
              const index = this.pendingQueue.indexOf(resolveFunc);
              if (index > -1) {
                this.pendingQueue.splice(index, 1);
              }
            }
            reject(
              new Error(`Semaphore queue timeout after ${QUEUE_TIMEOUT}ms`)
            );
          }, QUEUE_TIMEOUT);
        }),
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
        console.error("Error releasing semaphore to queued request:", error);
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
    const window = new JSDOM("").window;
    // @ts-ignore - DOMPurify types don't perfectly match JSDOM window
    const purify = DOMPurify(window);

    // Configure DOMPurify with secure defaults - strengthened for better XSS protection
    const config = {
      ALLOWED_TAGS: [
        // Text content
        "p",
        "br",
        "strong",
        "b",
        "em",
        "i",
        "u",
        "mark",
        "small",
        "del",
        "ins",
        "sub",
        "sup",
        // Headings
        "h1",
        "h2",
        "h3",
        "h4",
        "h5",
        "h6",
        // Lists
        "ul",
        "ol",
        "li",
        // Quotes and code
        "blockquote",
        "code",
        "pre",
        // Links and images (with restrictions)
        "a",
        "img",
        // Tables
        "table",
        "thead",
        "tbody",
        "tr",
        "td",
        "th",
        "caption",
        // Semantic HTML5
        "article",
        "section",
        "aside",
        "figure",
        "figcaption",
      ],
      ALLOWED_ATTR: [
        // Link attributes - restricted
        "href",
        "title",
        // Image attributes - restricted
        "src",
        "alt",
        "width",
        "height",
        // Accessibility
        "loading",
        "decoding",
      ],
      ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?:)?\/\/)|(?:\/|#)/i, // Only allow http(s), relative URLs, and anchors
      ALLOW_DATA_ATTR: false, // Block all data-* attributes
      ALLOW_UNKNOWN_PROTOCOLS: false, // Block unknown protocols
      FORBID_TAGS: [
        "script",
        "iframe",
        "object",
        "embed",
        "form",
        "input",
        "button",
        "select",
        "textarea",
        "style",
        "link",
        "meta",
        "base",
      ],
      FORBID_ATTR: [
        "style",
        "class",
        "id",
        "onerror",
        "onload",
        "onclick",
        "onmouseover",
        "onfocus",
        "onblur",
        "onchange",
        "onsubmit",
      ],
      KEEP_CONTENT: true, // Keep text content when removing tags
      SAFE_FOR_TEMPLATES: true,
      SANITIZE_DOM: true,
      WHOLE_DOCUMENT: false,
      RETURN_DOM: false,
      RETURN_DOM_FRAGMENT: false,
      FORCE_BODY: false,
      IN_PLACE: false,
      // Additional security hooks
      ADD_TAGS: [], // Don't allow adding any tags
      ADD_ATTR: [], // Don't allow adding any attributes
      // Force target="_blank" and rel="noopener noreferrer" on all links
      SANITIZE_NAMED_PROPS: true,
      ADD_URI_SAFE_ATTR: [],
    };

    // Additional processing for links to add security attributes
    const preprocess = (node: any) => {
      if (node.tagName === "A") {
        node.setAttribute("target", "_blank");
        node.setAttribute("rel", "noopener noreferrer");
      }
      return node;
    };

    // Add hook to process links
    purify.addHook("afterSanitizeElements", preprocess);

    // Sanitize the content
    const sanitized = purify.sanitize(content, config);

    // Remove the hook after use to prevent memory leaks
    purify.removeHook("afterSanitizeElements");

    // Trim whitespace
    return sanitized.trim();
  }

  /**
   * Validates article URL to prevent SSRF attacks
   * Blocks internal IPs, local networks, and non-HTTP(S) protocols
   */
  private isValidArticleUrl(url: string): boolean {
    try {
      const parsed = new URL(url);

      // Only allow HTTP and HTTPS protocols
      if (!["http:", "https:"].includes(parsed.protocol)) {
        return false;
      }

      // Block localhost and loopback addresses (including IPv6)
      const hostname = parsed.hostname.toLowerCase();
      if (
        hostname === "localhost" ||
        hostname === "127.0.0.1" ||
        hostname === "0.0.0.0" ||
        hostname === "::1" ||
        hostname === "[::1]" || // IPv6 in brackets
        hostname.startsWith("[::") // Any IPv6 loopback
      ) {
        return false;
      }

      // Block private IP ranges (RFC 1918)
      const ipPattern = /^(\d{1,3}\.){3}\d{1,3}$/;
      if (ipPattern.test(hostname)) {
        const parts = hostname.split(".").map(Number);
        // 10.0.0.0/8
        if (parts[0] === 10) return false;
        // 172.16.0.0/12
        if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
        // 192.168.0.0/16
        if (parts[0] === 192 && parts[1] === 168) return false;
        // 169.254.0.0/16 (link-local)
        if (parts[0] === 169 && parts[1] === 254) return false;
      }

      // Block internal domains
      const internalDomains = [
        ".local",
        ".internal",
        ".corp",
        ".home",
        ".lan",
        ".localdomain",
      ];

      if (internalDomains.some((domain) => hostname.endsWith(domain))) {
        return false;
      }

      // Block metadata service endpoints (cloud providers)
      const metadataEndpoints = [
        "169.254.169.254", // AWS/GCP/Azure
        "metadata.google.internal",
        "metadata.amazonaws.com",
      ];

      if (metadataEndpoints.includes(hostname)) {
        return false;
      }

      // Additional validation: ensure URL is well-formed
      if (!parsed.hostname || parsed.hostname.length === 0) {
        return false;
      }

      return true;
    } catch (error) {
      // Invalid URL format
      return false;
    }
  }
}
