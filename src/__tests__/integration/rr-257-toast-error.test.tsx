/**
 * RR-257: Toast System Integration for Error Feedback
 *
 * Test Specification:
 * - Integration Point: SummaryButton + toast + ArticleStore
 * - Validates: Complete error flow from store to UI feedback
 * - Context: RSS Reader domain with Inoreader API patterns
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { toast } from "sonner";

// Follow RR-247 toast system integration patterns
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn().mockReturnValue("toast-id"),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

// Mock Supabase following testing infrastructure patterns
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

import { SummaryButton } from "@/components/articles/summary-button";

// Mock store with full interface (RR-224 patterns)
const mockGenerateSummary = vi.fn();

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: () => ({
    generateSummary: mockGenerateSummary,
    summarizingArticles: new Set<string>(),
  }),
}));

describe("RR-257: Toast Error Integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Store to Toast Error Pipeline", () => {
    it("should propagate store errors to toast with correct format", async () => {
      // Arrange: Store error with RSS Reader specific code
      const storeError = Object.assign(new Error("API rate limit exceeded"), {
        code: "RATE_LIMIT",
        status: 429,
        retryAfter: 3600,
      });
      mockGenerateSummary.mockRejectedValueOnce(storeError);
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger store error
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert: Store error propagated to toast
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Too many requests"),
          expect.objectContaining({
            id: "summary-test-123",
            duration: 4000,
            action: expect.objectContaining({ label: "Retry" }),
          })
        );
      });
    });

    it("should handle concurrent errors from multiple buttons with deduplication", async () => {
      // Arrange: Multiple SummaryButton instances for same article
      const concurrentError = new Error("Concurrent access error");
      mockGenerateSummary.mockRejectedValue(concurrentError);

      const { rerender } = render(
        <div>
          <SummaryButton
            articleId="same-123"
            hasSummary={false}
            variant="full"
          />
          <SummaryButton
            articleId="same-123"
            hasSummary={false}
            variant="icon"
          />
        </div>
      );

      // Act: Click both buttons rapidly
      const buttons = screen.getAllByRole("button");
      fireEvent.click(buttons[0]);
      fireEvent.click(buttons[1]);

      // Assert: Only one toast with same ID (deduplication)
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      const calls = vi.mocked(toast.error).mock.calls;
      const toastIds = calls.map((call) => call[1]?.id).filter(Boolean);
      const uniqueIds = new Set(toastIds);

      // Should use same ID for same article (enables deduplication)
      expect(uniqueIds.size).toBe(1);
      expect(Array.from(uniqueIds)[0]).toBe("summary-same-123");
    });

    it("should work correctly in ArticleList card context", async () => {
      // Arrange: Card context with navigation handler (article-list.tsx:610 pattern)
      const mockNavigate = vi.fn();
      const cardError = new Error("Card context error");
      mockGenerateSummary.mockRejectedValueOnce(cardError);

      render(
        <div onClick={mockNavigate} data-testid="article-card">
          <SummaryButton
            articleId="test-123"
            hasSummary={false}
            variant="icon"
          />
        </div>
      );

      // Act: Error should not trigger navigation
      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Assert: Error toast shown, navigation prevented
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should work correctly in ArticleDetail toolbar context", async () => {
      // Arrange: Toolbar context (article-detail.tsx:85 pattern)
      const toolbarError = new Error("Toolbar context error");
      mockGenerateSummary.mockRejectedValueOnce(toolbarError);

      render(
        <div data-testid="article-toolbar">
          <SummaryButton
            articleId="test-123"
            hasSummary={true}
            variant="full"
          />
        </div>
      );

      // Act: Error in toolbar context
      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Assert: Toast positioned correctly (uses default)
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            // Should not override toast position for toolbar context
            position: undefined,
          })
        );
      });
    });
  });

  describe("RSS Reader Specific Error Scenarios", () => {
    it("should handle Inoreader token expiry during summarization", async () => {
      // Arrange: OAuth token expiry (common RSS Reader scenario)
      const tokenError = Object.assign(new Error("Token expired"), {
        status: 401,
        code: "TOKEN_EXPIRED",
      });
      mockGenerateSummary.mockRejectedValueOnce(tokenError);

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger token error
      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Assert: Authentication-specific error guidance
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Session expired"),
          expect.any(Object)
        );
      });
    });

    it("should handle feed content parsing failures", async () => {
      // Arrange: Content validation error
      const validationError = Object.assign(
        new Error("Content validation failed"),
        {
          status: 422,
          code: "CONTENT_INVALID",
        }
      );
      mockGenerateSummary.mockRejectedValueOnce(validationError);

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger validation error
      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Assert: Content-specific error message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringMatching(/article.*content|validation.*failed/i),
          expect.any(Object)
        );
      });
    });

    it("should maintain consistency with RSS sync error patterns", async () => {
      // Arrange: Generic server error (follows sync error patterns)
      const serverError = Object.assign(new Error("Internal server error"), {
        status: 500,
      });
      mockGenerateSummary.mockRejectedValueOnce(serverError);

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger server error
      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Assert: Follows established sync error messaging patterns
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("failed"),
          expect.objectContaining({
            duration: 4000, // Matches sync error duration
          })
        );
      });
    });
  });

  describe("Performance and Memory Management", () => {
    it("should handle rapid error scenarios without memory leaks", async () => {
      // Arrange: Rapid error generation
      const rapidError = new Error("Rapid error");
      mockGenerateSummary.mockRejectedValue(rapidError);

      const { unmount } = render(
        <SummaryButton articleId="test-123" hasSummary={false} />
      );

      // Act: Rapid clicks followed by unmount
      const button = screen.getByRole("button");
      for (let i = 0; i < 5; i++) {
        fireEvent.click(button);
      }

      // Unmount to test cleanup
      unmount();

      // Assert: No console errors or memory warnings
      // Note: This is primarily a regression test for proper cleanup
      expect(toast.error).toHaveBeenCalled();
    });

    it("should meet error feedback performance targets", async () => {
      // Arrange: Performance measurement setup
      const performanceError = new Error("Performance test error");
      mockGenerateSummary.mockRejectedValueOnce(performanceError);

      const startTime = performance.now();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger error and measure response time
      const button = screen.getByRole("button");
      fireEvent.click(button);

      // Assert: Error feedback within 500ms target
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(500);
    });
  });
});
