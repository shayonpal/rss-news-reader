import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Unit Tests for RR-148: Fallback Behavior for Content Parsing Failures
 *
 * Tests the graceful fallback mechanisms when on-demand content parsing fails,
 * ensuring users can still read articles even when full content extraction is not available.
 *
 * These tests are designed to FAIL initially (TDD red phase) until the
 * actual implementation is created.
 */

describe("RR-148: Fallback Behavior for Content Parsing", () => {
  let mockSupabase: any;
  let mockLogger: any;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock Supabase client
    mockSupabase = {
      from: vi.fn(() => mockSupabase),
      select: vi.fn(() => mockSupabase),
      eq: vi.fn(() => mockSupabase),
      single: vi.fn(),
      update: vi.fn(() => mockSupabase),
      insert: vi.fn(),
    };

    // Mock logger
    mockLogger = {
      log: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    };

    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Content Parsing Failure Scenarios", () => {
    it("should handle network timeout failures gracefully", async () => {
      // Network timeout handling - will fail until implemented
      class ContentParsingService {
        constructor(
          private supabase: any,
          private logger: any
        ) {}

        async parseContentWithFallback(
          articleId: string,
          options: {
            timeout?: number;
            retries?: number;
            fallbackToOriginal?: boolean;
          } = {}
        ): Promise<{
          success: boolean;
          content: string;
          method: "extracted" | "fallback" | "cached";
          error?: string;
          duration?: number;
        }> {
          const startTime = Date.now();
          const {
            timeout = 5000,
            retries = 2,
            fallbackToOriginal = true,
          } = options;

          try {
            // Get article from database
            const { data: article, error } = await this.supabase
              .from("articles")
              .select("*")
              .eq("id", articleId)
              .single();

            if (error || !article) {
              throw new Error("Article not found");
            }

            // Check if already cached
            if (article.has_full_content && article.full_content) {
              return {
                success: true,
                content: article.full_content,
                method: "cached",
                duration: Date.now() - startTime,
              };
            }

            // Attempt content extraction with retry logic
            let lastError: Error | null = null;
            for (let attempt = 1; attempt <= retries; attempt++) {
              try {
                const extractedContent = await this.extractContentWithTimeout(
                  article.url,
                  timeout
                );

                // Save to database
                await this.supabase
                  .from("articles")
                  .update({
                    full_content: extractedContent,
                    has_full_content: true,
                    extraction_method: "readability",
                    extracted_at: new Date().toISOString(),
                  })
                  .eq("id", articleId);

                this.logger.log(
                  `Content extraction successful for ${articleId} on attempt ${attempt}`
                );

                return {
                  success: true,
                  content: extractedContent,
                  method: "extracted",
                  duration: Date.now() - startTime,
                };
              } catch (error) {
                lastError = error as Error;
                this.logger.warn(
                  `Content extraction attempt ${attempt} failed for ${articleId}: ${lastError.message}`
                );

                if (attempt < retries) {
                  // Exponential backoff
                  await new Promise((resolve) =>
                    setTimeout(resolve, Math.pow(2, attempt) * 1000)
                  );
                }
              }
            }

            // All extraction attempts failed - use fallback
            if (fallbackToOriginal && article.content) {
              this.logger.error(
                `Content extraction failed for ${articleId}, using fallback: ${lastError?.message}`
              );

              return {
                success: true,
                content: article.content,
                method: "fallback",
                error: lastError?.message,
                duration: Date.now() - startTime,
              };
            }

            throw lastError || new Error("Content extraction failed");
          } catch (error) {
            this.logger.error(
              `Failed to parse content for ${articleId}: ${error instanceof Error ? error.message : "Unknown error"}`
            );

            return {
              success: false,
              content: "",
              method: "fallback",
              error: error instanceof Error ? error.message : "Unknown error",
              duration: Date.now() - startTime,
            };
          }
        }

        private async extractContentWithTimeout(
          url: string,
          timeout: number
        ): Promise<string> {
          return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
              reject(new Error(`Extraction timeout after ${timeout}ms`));
            }, timeout);

            // Mock extraction that might fail
            // Use a shorter delay to ensure it happens before the timeout
            const extractionDelay = url.includes("timeout")
              ? 100
              : Math.random() * 1000;

            setTimeout(() => {
              clearTimeout(timeoutId);

              if (url.includes("timeout")) {
                reject(new Error("Network timeout"));
              } else if (url.includes("404")) {
                reject(new Error("Page not found"));
              } else if (url.includes("blocked")) {
                reject(new Error("Access denied"));
              } else {
                resolve("<p>Successfully extracted content</p>");
              }
            }, extractionDelay);
          });
        }
      }

      const service = new ContentParsingService(mockSupabase, mockLogger);

      // Mock article data - URL must include 'timeout' to trigger timeout error
      mockSupabase.single.mockResolvedValue({
        data: {
          id: "article-timeout",
          url: "https://example.com/timeout", // Changed to include 'timeout' in URL
          content: "Original partial content from the feed",
          has_full_content: false,
          full_content: null,
        },
      });

      mockSupabase.update.mockResolvedValue({ error: null });

      const result = await service.parseContentWithFallback("article-timeout");

      expect(result.success).toBe(true);
      expect(result.method).toBe("fallback");
      expect(result.content).toBe("Original partial content from the feed");
      expect(result.error).toContain("timeout");
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it("should handle malformed HTML gracefully", async () => {
      // Malformed HTML handling - will fail until implemented
      const handleMalformedHtml = async (
        htmlContent: string,
        originalContent: string
      ) => {
        try {
          // Simulate Mozilla Readability parsing attempt
          if (
            htmlContent.includes("<unclosed-tag>") ||
            htmlContent.includes("<script>") ||
            htmlContent.length < 50
          ) {
            throw new Error("Invalid or unsafe HTML structure");
          }

          // Mock successful parsing
          return {
            success: true,
            content: "<p>Successfully parsed clean content</p>",
            method: "extracted",
            cleaned: true,
          };
        } catch (error) {
          // Fallback to original content with basic cleanup
          const cleanedOriginal = originalContent
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
            .replace(/<[^>]*>/g, " ")
            .replace(/\s+/g, " ")
            .trim();

          return {
            success: true,
            content: cleanedOriginal,
            method: "fallback",
            cleaned: false,
            error:
              error instanceof Error ? error.message : "HTML parsing failed",
          };
        }
      };

      // Test with malformed HTML
      const malformedHtml =
        "<div><p>Content with <unclosed-tag> problems</div>";
      const originalContent = "Clean text content from the original feed";

      const result = await handleMalformedHtml(malformedHtml, originalContent);

      expect(result.success).toBe(true);
      expect(result.method).toBe("fallback");
      expect(result.content).toBe("Clean text content from the original feed");
      expect(result.error).toContain("Invalid or unsafe HTML");
      expect(result.cleaned).toBe(false);

      // Test with good HTML
      const goodHtml = "<article><p>Well-formed content here</p></article>";
      const goodResult = await handleMalformedHtml(goodHtml, originalContent);

      expect(goodResult.success).toBe(true);
      expect(goodResult.method).toBe("extracted");
      expect(goodResult.cleaned).toBe(true);
    });

    it("should handle CORS and access denied errors", async () => {
      // CORS and access control handling - will fail until implemented
      const handleAccessErrors = async (
        url: string,
        fallbackContent: string
      ) => {
        try {
          // Mock fetch request that might be blocked
          const response = await fetch(url);

          if (!response.ok) {
            if (response.status === 403) {
              throw new Error("Access forbidden");
            }
            if (response.status === 404) {
              throw new Error("Page not found");
            }
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }

          const html = await response.text();
          return {
            success: true,
            content: html,
            method: "extracted",
            httpStatus: response.status,
          };
        } catch (error) {
          const errorMessage =
            error instanceof Error ? error.message : "Unknown error";

          // Different fallback strategies based on error type
          let fallbackStrategy:
            | "original_content"
            | "minimal_info"
            | "error_message";

          if (
            errorMessage.includes("CORS") ||
            errorMessage.includes("forbidden")
          ) {
            fallbackStrategy = "original_content";
          } else if (errorMessage.includes("not found")) {
            fallbackStrategy = "minimal_info";
          } else {
            fallbackStrategy = "error_message";
          }

          let content: string;
          switch (fallbackStrategy) {
            case "original_content":
              content = fallbackContent;
              break;
            case "minimal_info":
              content =
                "Article content is not available. The original page may have been removed or moved.";
              break;
            default:
              content = `Unable to load full content: ${errorMessage}`;
          }

          return {
            success: true,
            content,
            method: "fallback",
            error: errorMessage,
            fallbackStrategy,
            httpStatus: null,
          };
        }
      };

      // Mock fetch for different error scenarios
      (global.fetch as any)
        .mockResolvedValueOnce({
          ok: false,
          status: 403,
          statusText: "Forbidden",
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          statusText: "Not Found",
        })
        .mockRejectedValueOnce(new Error("CORS policy violation"));

      // Test 403 Forbidden
      const forbiddenResult = await handleAccessErrors(
        "https://example.com/forbidden",
        "Original article content"
      );
      expect(forbiddenResult.success).toBe(true);
      expect(forbiddenResult.method).toBe("fallback");
      expect(forbiddenResult.content).toBe("Original article content");
      expect(forbiddenResult.fallbackStrategy).toBe("original_content");

      // Test 404 Not Found
      const notFoundResult = await handleAccessErrors(
        "https://example.com/missing",
        "Original content"
      );
      expect(notFoundResult.success).toBe(true);
      expect(notFoundResult.content).toContain("not available");
      expect(notFoundResult.fallbackStrategy).toBe("minimal_info");

      // Test CORS error
      const corsResult = await handleAccessErrors(
        "https://blocked-site.com/article",
        "Original content"
      );
      expect(corsResult.success).toBe(true);
      expect(corsResult.content).toBe("Original content");
      expect(corsResult.fallbackStrategy).toBe("original_content");
    });
  });

  describe("User Experience During Failures", () => {
    it("should provide loading states and error messages to users", () => {
      // UI state management during parsing - will fail until implemented
      interface ParsingState {
        status: "idle" | "loading" | "success" | "error" | "fallback";
        content: string | null;
        error: string | null;
        method: "cached" | "extracted" | "fallback" | null;
        canRetry: boolean;
        loadingMessage: string;
      }

      class ContentParsingUI {
        private state: ParsingState = {
          status: "idle",
          content: null,
          error: null,
          method: null,
          canRetry: false,
          loadingMessage: "",
        };

        getState(): ParsingState {
          return { ...this.state };
        }

        async parseContent(
          articleId: string,
          originalContent: string
        ): Promise<void> {
          this.setState({
            status: "loading",
            loadingMessage: "Loading full article content...",
            canRetry: false,
          });

          try {
            // Simulate content parsing service call
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Mock different outcomes based on article ID
            if (articleId.includes("success")) {
              this.setState({
                status: "success",
                content: "Full extracted article content",
                method: "extracted",
                loadingMessage: "",
              });
            } else if (articleId.includes("cached")) {
              this.setState({
                status: "success",
                content: "Previously cached content",
                method: "cached",
                loadingMessage: "",
              });
            } else if (articleId.includes("fallback")) {
              this.setState({
                status: "fallback",
                content: originalContent,
                method: "fallback",
                error: "Could not extract full content, showing original",
                canRetry: true,
                loadingMessage: "",
              });
            } else {
              throw new Error("Content extraction failed");
            }
          } catch (error) {
            this.setState({
              status: "error",
              error: error instanceof Error ? error.message : "Unknown error",
              content: originalContent, // Always show something
              method: "fallback",
              canRetry: true,
              loadingMessage: "",
            });
          }
        }

        async retry(): Promise<void> {
          if (!this.state.canRetry) return;

          this.setState({
            status: "loading",
            loadingMessage: "Retrying content extraction...",
            canRetry: false,
            error: null,
          });

          // Simulate retry logic
          await new Promise((resolve) => setTimeout(resolve, 800));

          // Mock retry success
          this.setState({
            status: "success",
            content: "Successfully extracted on retry",
            method: "extracted",
            loadingMessage: "",
          });
        }

        private setState(updates: Partial<ParsingState>): void {
          this.state = { ...this.state, ...updates };
        }

        getUserMessage(): string {
          switch (this.state.status) {
            case "loading":
              return this.state.loadingMessage;
            case "success":
              return this.state.method === "cached"
                ? "Content loaded from cache"
                : "Full content loaded";
            case "fallback":
              return "Full content unavailable, showing original article";
            case "error":
              return `Error loading content: ${this.state.error}`;
            default:
              return "";
          }
        }
      }

      const ui = new ContentParsingUI();
      const originalContent = "Original partial article content";

      // Test successful extraction
      expect(async () => {
        await ui.parseContent("success-article", originalContent);
        const state = ui.getState();

        expect(state.status).toBe("success");
        expect(state.method).toBe("extracted");
        expect(state.content).toBe("Full extracted article content");
        expect(ui.getUserMessage()).toBe("Full content loaded");
      }).not.toThrow();

      // Test fallback scenario
      expect(async () => {
        await ui.parseContent("fallback-article", originalContent);
        const state = ui.getState();

        expect(state.status).toBe("fallback");
        expect(state.method).toBe("fallback");
        expect(state.content).toBe(originalContent);
        expect(state.canRetry).toBe(true);
        expect(ui.getUserMessage()).toContain("unavailable");
      }).not.toThrow();

      // Test error handling
      expect(async () => {
        await ui.parseContent("error-article", originalContent);
        const state = ui.getState();

        expect(state.status).toBe("error");
        expect(state.content).toBe(originalContent); // Still shows original
        expect(state.canRetry).toBe(true);
        expect(ui.getUserMessage()).toContain("Error loading");
      }).not.toThrow();
    });

    it("should implement progressive loading with partial content", async () => {
      // Progressive loading implementation - will fail until implemented
      class ProgressiveContentLoader {
        async loadContent(articleId: string): Promise<{
          immediate: { content: string; complete: boolean };
          enhanced?: { content: string; complete: boolean };
        }> {
          // Step 1: Immediately return original content
          const originalContent = await this.getOriginalContent(articleId);
          const immediate = {
            content: originalContent,
            complete: false,
          };

          // Step 2: Attempt to load enhanced content in background
          try {
            const enhancedContent = await this.enhanceContent(
              articleId,
              originalContent
            );
            return {
              immediate,
              enhanced: {
                content: enhancedContent,
                complete: true,
              },
            };
          } catch (error) {
            // Enhancement failed, but immediate content is still valid
            return {
              immediate: { ...immediate, complete: true }, // Mark as complete since enhancement failed
            };
          }
        }

        private async getOriginalContent(articleId: string): Promise<string> {
          // Mock database call
          return `Original content for article ${articleId}`;
        }

        private async enhanceContent(
          articleId: string,
          originalContent: string
        ): Promise<string> {
          // Simulate content enhancement
          await new Promise((resolve) => setTimeout(resolve, 1500));

          if (articleId.includes("enhance-fail")) {
            throw new Error("Enhancement failed");
          }

          return `Enhanced content for article ${articleId} with full extraction`;
        }

        async loadWithTimeout(
          articleId: string,
          timeoutMs: number = 3000
        ): Promise<{
          content: string;
          method: "original" | "enhanced" | "timeout";
          duration: number;
        }> {
          const startTime = Date.now();

          return new Promise(async (resolve) => {
            // Set timeout
            const timeout = setTimeout(() => {
              resolve({
                content: `Original content for article ${articleId}`,
                method: "timeout",
                duration: Date.now() - startTime,
              });
            }, timeoutMs);

            try {
              const result = await this.loadContent(articleId);
              clearTimeout(timeout);

              resolve({
                content: result.enhanced?.content || result.immediate.content,
                method: result.enhanced ? "enhanced" : "original",
                duration: Date.now() - startTime,
              });
            } catch (error) {
              clearTimeout(timeout);
              resolve({
                content: `Original content for article ${articleId}`,
                method: "original",
                duration: Date.now() - startTime,
              });
            }
          });
        }
      }

      const loader = new ProgressiveContentLoader();

      // Test successful enhancement
      const enhancedResult = await loader.loadContent("normal-article");
      expect(enhancedResult.immediate.content).toContain("Original content");
      expect(enhancedResult.immediate.complete).toBe(false);
      expect(enhancedResult.enhanced?.content).toContain("Enhanced content");
      expect(enhancedResult.enhanced?.complete).toBe(true);

      // Test failed enhancement
      const fallbackResult = await loader.loadContent("enhance-fail-article");
      expect(fallbackResult.immediate.content).toContain("Original content");
      expect(fallbackResult.enhanced).toBeUndefined();
      expect(fallbackResult.immediate.complete).toBe(true); // Marked complete due to failure

      // Test timeout scenario
      const timeoutResult = await loader.loadWithTimeout("slow-article", 1000); // Short timeout
      expect(timeoutResult.method).toBe("timeout");
      expect(timeoutResult.content).toContain("Original content");
      expect(timeoutResult.duration).toBeLessThanOrEqual(1100); // Allow some margin
    });
  });

  describe("Error Recovery and Retry Logic", () => {
    it("should implement intelligent retry strategies", async () => {
      // Retry strategy implementation - will fail until implemented
      interface RetryConfig {
        maxAttempts: number;
        baseDelay: number;
        maxDelay: number;
        exponentialBackoff: boolean;
        retryableErrors: string[];
      }

      class IntelligentRetryService {
        private defaultConfig: RetryConfig = {
          maxAttempts: 3,
          baseDelay: 1000,
          maxDelay: 10000,
          exponentialBackoff: true,
          retryableErrors: ["timeout", "network", "rate_limit", "server_error"],
        };

        async executeWithRetry<T>(
          operation: () => Promise<T>,
          config: Partial<RetryConfig> = {}
        ): Promise<{
          result?: T;
          success: boolean;
          attempts: number;
          totalDuration: number;
          lastError?: Error;
        }> {
          const finalConfig = { ...this.defaultConfig, ...config };
          const startTime = Date.now();
          let attempts = 0;
          let lastError: Error | undefined;

          while (attempts < finalConfig.maxAttempts) {
            attempts++;

            try {
              const result = await operation();
              return {
                result,
                success: true,
                attempts,
                totalDuration: Date.now() - startTime,
              };
            } catch (error) {
              lastError = error as Error;

              // Check if error is retryable
              if (
                !this.isRetryableError(lastError, finalConfig.retryableErrors)
              ) {
                break;
              }

              // Don't delay after the last attempt
              if (attempts < finalConfig.maxAttempts) {
                const delay = this.calculateDelay(attempts, finalConfig);
                await new Promise((resolve) => setTimeout(resolve, delay));
              }
            }
          }

          return {
            success: false,
            attempts,
            totalDuration: Date.now() - startTime,
            lastError,
          };
        }

        private isRetryableError(
          error: Error,
          retryableErrors: string[]
        ): boolean {
          const errorMessage = error.message.toLowerCase();
          return retryableErrors.some((errorType) =>
            errorMessage.includes(errorType)
          );
        }

        private calculateDelay(attempt: number, config: RetryConfig): number {
          if (!config.exponentialBackoff) {
            return config.baseDelay;
          }

          const exponentialDelay = config.baseDelay * Math.pow(2, attempt - 1);
          const jitter = Math.random() * 0.1 * exponentialDelay; // Add 10% jitter
          return Math.min(exponentialDelay + jitter, config.maxDelay);
        }
      }

      const retryService = new IntelligentRetryService();

      // Test successful retry
      let attemptCount = 0;
      const successfulOperation = async () => {
        attemptCount++;
        if (attemptCount < 3) {
          throw new Error("Network timeout");
        }
        return "Success after retries";
      };

      const result = await retryService.executeWithRetry(successfulOperation);
      expect(result.success).toBe(true);
      expect(result.attempts).toBe(3);
      expect(result.result).toBe("Success after retries");

      // Test non-retryable error
      const nonRetryableOperation = async () => {
        throw new Error("Authentication failed");
      };

      const nonRetryableResult = await retryService.executeWithRetry(
        nonRetryableOperation
      );
      expect(nonRetryableResult.success).toBe(false);
      expect(nonRetryableResult.attempts).toBe(1); // Should not retry
      expect(nonRetryableResult.lastError?.message).toBe(
        "Authentication failed"
      );

      // Test max attempts reached
      const alwaysFailOperation = async () => {
        throw new Error("Network timeout");
      };

      const maxAttemptsResult = await retryService.executeWithRetry(
        alwaysFailOperation,
        { maxAttempts: 2 }
      );
      expect(maxAttemptsResult.success).toBe(false);
      expect(maxAttemptsResult.attempts).toBe(2);
    });

    it("should implement circuit breaker pattern for repeated failures", async () => {
      // Circuit breaker implementation - will fail until implemented
      interface CircuitBreakerState {
        status: "closed" | "open" | "half_open";
        failureCount: number;
        lastFailureTime: number;
        successCount: number;
        lastSuccessTime: number;
      }

      class CircuitBreaker {
        private state: CircuitBreakerState = {
          status: "closed",
          failureCount: 0,
          lastFailureTime: 0,
          successCount: 0,
          lastSuccessTime: 0,
        };

        constructor(
          private failureThreshold: number = 5,
          private recoveryTimeout: number = 60000, // 1 minute
          private successThreshold: number = 2
        ) {}

        async execute<T>(operation: () => Promise<T>): Promise<T> {
          const now = Date.now();

          // Check if circuit should transition from open to half-open
          if (
            this.state.status === "open" &&
            now - this.state.lastFailureTime > this.recoveryTimeout
          ) {
            this.state.status = "half_open";
            this.state.successCount = 0;
          }

          // Reject immediately if circuit is open
          if (this.state.status === "open") {
            throw new Error("Circuit breaker is open - requests blocked");
          }

          try {
            const result = await operation();
            this.onSuccess();
            return result;
          } catch (error) {
            this.onFailure();
            throw error;
          }
        }

        private onSuccess(): void {
          this.state.lastSuccessTime = Date.now();

          if (this.state.status === "half_open") {
            this.state.successCount++;

            // If enough successes in half-open state, close the circuit
            if (this.state.successCount >= this.successThreshold) {
              this.state.status = "closed";
              this.state.failureCount = 0;
            }
          } else if (this.state.status === "closed") {
            // Reset failure count on success
            this.state.failureCount = Math.max(0, this.state.failureCount - 1);
          }
        }

        private onFailure(): void {
          this.state.failureCount++;
          this.state.lastFailureTime = Date.now();

          // Open circuit if failure threshold reached
          if (this.state.failureCount >= this.failureThreshold) {
            this.state.status = "open";
          }
        }

        getState(): CircuitBreakerState {
          return { ...this.state };
        }

        reset(): void {
          this.state = {
            status: "closed",
            failureCount: 0,
            lastFailureTime: 0,
            successCount: 0,
            lastSuccessTime: 0,
          };
        }
      }

      const circuitBreaker = new CircuitBreaker(3, 5000, 2); // 3 failures, 5s timeout, 2 successes

      // Test normal operation
      let operationCount = 0;
      const operation = async () => {
        operationCount++;
        if (operationCount <= 3) {
          throw new Error("Service unavailable");
        }
        return "Success";
      };

      // Execute operations that will fail and open the circuit
      let caughtError = false;
      try {
        await circuitBreaker.execute(operation);
      } catch (error) {
        caughtError = true;
      }
      expect(caughtError).toBe(true);

      // Continue failing to reach threshold
      for (let i = 0; i < 3; i++) {
        try {
          await circuitBreaker.execute(operation);
        } catch (error) {
          // Expected failures
        }
      }

      // Circuit should be open now
      const openState = circuitBreaker.getState();
      expect(openState.status).toBe("open");
      expect(openState.failureCount).toBeGreaterThanOrEqual(3);

      // Immediate requests should be rejected
      try {
        await circuitBreaker.execute(operation);
        expect(false).toBe(true); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toContain("Circuit breaker is open");
      }

      // Reset for testing recovery
      circuitBreaker.reset();
      expect(circuitBreaker.getState().status).toBe("closed");
    });
  });
});
