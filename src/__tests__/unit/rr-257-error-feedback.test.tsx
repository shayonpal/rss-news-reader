/**
 * RR-257: Error Feedback for Summarization Failures
 *
 * Test Specification:
 * - Symbol Target: SummaryButton (src/components/articles/summary-button.tsx:19-60)
 * - Method Target: handleGenerateSummary catch block (lines 39-44)
 * - Enhancement: Add toast.error() with context-aware messaging and retry actions
 *
 * Test Coverage:
 * - Error detection and user notification
 * - AbortError handling (user cancellations)
 * - Context-aware messaging (new vs re-summarization)
 * - Loading state management during errors
 * - Toast retry functionality
 */

import React from "react";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";
import { toast } from "sonner";

// Mock dependencies following established patterns
vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
    success: vi.fn(),
    loading: vi.fn(),
  },
}));

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: () => ({
    generateSummary: mockGenerateSummary,
  }),
}));

import { SummaryButton } from "@/components/articles/summary-button";

// Mock store method following RR-255 patterns
const mockGenerateSummary = vi.fn();

describe("RR-257: SummaryButton Error Feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock to successful state
    mockGenerateSummary.mockResolvedValue({
      id: "test-summary",
      content: "Test summary content",
      model: "claude-sonnet-4",
    });
  });

  afterEach(() => {
    vi.clearAllTimers();
  });

  describe("Error Detection and Toast Notifications", () => {
    it("should show error toast with retry action for network failures", async () => {
      // Arrange: Network error simulation
      const networkError = new Error("Network request failed");
      mockGenerateSummary.mockRejectedValueOnce(networkError);
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Click summarize button
      const button = screen.getByRole("button", { name: /summarize/i });
      await user.click(button);

      // Assert: Error toast called with correct parameters
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Summary failed"),
          expect.objectContaining({
            id: "summary-test-123",
            duration: 4000,
            action: expect.objectContaining({
              label: "Retry",
              onClick: expect.any(Function),
            }),
          })
        );
      });

      // Verify button returns to enabled state
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it("should NOT show error toast for AbortError (user cancellations)", async () => {
      // Arrange: AbortError simulation
      const abortError = new Error("Request was aborted");
      abortError.name = "AbortError";
      mockGenerateSummary.mockRejectedValueOnce(abortError);
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Click summarize button
      const button = screen.getByRole("button", { name: /summarize/i });
      await user.click(button);

      // Assert: No error toast for user cancellation
      await waitFor(() => {
        expect(mockGenerateSummary).toHaveBeenCalled();
      });

      expect(toast.error).not.toHaveBeenCalled();
    });

    it("should show context-aware message for re-summarization errors", async () => {
      // Arrange: Re-summarization failure
      const apiError = new Error("Server error");
      mockGenerateSummary.mockRejectedValueOnce(apiError);
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={true} />);

      // Act: Click re-summarize button
      const button = screen.getByRole("button", { name: /re-summarize/i });
      await user.click(button);

      // Assert: Context-aware error message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Re-summarize failed"),
          expect.any(Object)
        );
      });
    });

    it("should handle API rate limit errors with specific messaging", async () => {
      // Arrange: Rate limit error (RSS Reader specific)
      const rateLimitError = Object.assign(new Error("Rate limit exceeded"), {
        status: 429,
        code: "RATE_LIMIT",
      });
      mockGenerateSummary.mockRejectedValueOnce(rateLimitError);
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger rate limit
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert: Rate limit specific message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Too many requests"),
          expect.objectContaining({ duration: 4000 })
        );
      });
    });

    it("should handle offline scenarios with appropriate messaging", async () => {
      // Arrange: Offline state simulation
      Object.defineProperty(navigator, "onLine", {
        writable: true,
        value: false,
      });

      const offlineError = new Error("Network error");
      mockGenerateSummary.mockRejectedValueOnce(offlineError);
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Attempt while offline
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert: Offline-specific guidance
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("offline"),
          expect.any(Object)
        );
      });

      // Cleanup
      Object.defineProperty(navigator, "onLine", { value: true });
    });
  });

  describe("Toast Retry Functionality", () => {
    it("should trigger new summarization attempt when retry clicked", async () => {
      // Arrange: Initial failure then success
      const initialError = new Error("Temporary failure");
      mockGenerateSummary
        .mockRejectedValueOnce(initialError)
        .mockResolvedValueOnce({ content: "Success" });

      let capturedRetryCallback: (() => void) | undefined;
      vi.mocked(toast.error).mockImplementation((message, options) => {
        if (options && typeof options === "object" && "action" in options) {
          capturedRetryCallback = options.action?.onClick;
        }
        return "toast-id";
      });

      const user = userEvent.setup();
      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger error then retry
      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
        expect(capturedRetryCallback).toBeDefined();
      });

      // Simulate retry click
      capturedRetryCallback?.();

      // Assert: Retry attempt made
      await waitFor(() => {
        expect(mockGenerateSummary).toHaveBeenCalledTimes(2);
      });
    });

    it("should use unique toast IDs to prevent stacking", async () => {
      // Arrange: Multiple errors for same article
      mockGenerateSummary.mockRejectedValue(new Error("Persistent error"));
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Multiple rapid clicks
      const button = screen.getByRole("button");
      await user.click(button);
      await user.click(button);

      // Assert: Same toast ID used (prevents stacking)
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.any(String),
          expect.objectContaining({
            id: "summary-test-123",
          })
        );
      });

      // Should be called twice but with same ID
      expect(toast.error).toHaveBeenCalledTimes(2);
      const [firstCall, secondCall] = vi.mocked(toast.error).mock.calls;
      expect(firstCall[1]?.id).toBe(secondCall[1]?.id);
    });
  });

  describe("Loading State During Errors", () => {
    it("should reset loading state after error occurs", async () => {
      // Arrange: Error that takes time to resolve
      const slowError = new Error("Delayed error");
      // Create a promise that rejects after a delay to ensure loading state is visible
      mockGenerateSummary.mockImplementationOnce(
        () =>
          new Promise((_, reject) => {
            setTimeout(() => reject(slowError), 50);
          })
      );
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger slow error
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert: Button becomes disabled during loading
      await waitFor(() => {
        expect(button).toBeDisabled();
      });

      // Wait for error handling completion
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });

      // Assert: Button returns to enabled state
      await waitFor(() => {
        expect(button).not.toBeDisabled();
      });
    });

    it("should maintain error state in component after toast", async () => {
      // Arrange: Error scenario
      const testError = new Error("Test error message");
      mockGenerateSummary.mockRejectedValueOnce(testError);
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger error
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert: Component maintains error state for potential inline UI
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
        // Note: Testing that setError() was called is internal implementation
        // but error state should be available for inline error displays
      });
    });
  });

  describe("RSS Reader Domain Specific Errors", () => {
    it("should handle Inoreader authentication failures", async () => {
      // Arrange: Auth error from Inoreader API
      const authError = Object.assign(new Error("Unauthorized"), {
        status: 401,
        response: { message: "Invalid or expired token" },
      });
      mockGenerateSummary.mockRejectedValueOnce(authError);
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger auth error
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert: Auth-specific error message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Session expired"),
          expect.any(Object)
        );
      });
    });

    it("should handle content parsing failures gracefully", async () => {
      // Arrange: Content too large error
      const parseError = Object.assign(new Error("Content too large"), {
        status: 413,
        code: "PAYLOAD_TOO_LARGE",
      });
      mockGenerateSummary.mockRejectedValueOnce(parseError);
      const user = userEvent.setup();

      render(<SummaryButton articleId="test-123" hasSummary={false} />);

      // Act: Trigger parsing error
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert: Content-specific error message
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalledWith(
          expect.stringContaining("Article too long"),
          expect.any(Object)
        );
      });
    });
  });

  describe("Event Propagation (RR-255 Integration)", () => {
    it("should not trigger parent navigation on error", async () => {
      // Arrange: Error in card context (article-list usage)
      const parentClickHandler = vi.fn();
      const testError = new Error("Test error");
      mockGenerateSummary.mockRejectedValueOnce(testError);
      const user = userEvent.setup();

      render(
        <div onClick={parentClickHandler} data-testid="article-card">
          <SummaryButton articleId="test-123" hasSummary={false} />
        </div>
      );

      // Act: Click summary button (should not propagate)
      const button = screen.getByRole("button");
      await user.click(button);

      // Assert: Error toast shown, navigation prevented
      await waitFor(() => {
        expect(toast.error).toHaveBeenCalled();
      });
      expect(parentClickHandler).not.toHaveBeenCalled();
    });
  });
});
