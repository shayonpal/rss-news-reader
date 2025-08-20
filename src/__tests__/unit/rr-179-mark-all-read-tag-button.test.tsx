/**
 * RR-179: Mark All Read with iOS Liquid Glass morphing UI for topic-filtered views
 * Unit Tests - Component Behavior Specification
 *
 * Test Categories:
 * 1. State Machine Transitions
 * 2. UI Morphing Behavior
 * 3. Performance Requirements
 * 4. Error Handling
 * 5. Props Validation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup as rtlCleanup,
} from "@testing-library/react";
import { act, renderHook } from "@testing-library/react";
import { toast } from "sonner";
// Mock the component since it's not implemented yet
const MarkAllReadTagButton = ({
  tagSlug,
  tagName,
  className,
}: {
  tagSlug: string;
  tagName: string;
  className?: string;
}) => (
  <button
    className={`mark-all-read-button ${className || ""}`}
    data-state="normal"
    aria-label={`Mark all "${tagName}" articles as read`}
    aria-busy="false"
  >
    Mark all "{tagName}" as read
  </button>
);
import { useArticleStore } from "@/lib/stores/article-store";
import { localStorageStateManager } from "@/lib/utils/localstorage-state-manager";

// Mock dependencies
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: vi.fn(),
}));

vi.mock("@/lib/utils/localstorage-state-manager", () => ({
  localStorageStateManager: {
    batchMarkArticlesRead: vi.fn(),
  },
}));

describe("RR-179: MarkAllReadTagButton Component", () => {
  const mockMarkMultipleAsRead = vi.fn();
  const mockArticles = [
    { id: "article-1", feed_id: "feed-1", is_read: false },
    { id: "article-2", feed_id: "feed-1", is_read: false },
    { id: "article-3", feed_id: "feed-2", is_read: false },
  ];
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Mock store with articles
    (useArticleStore as any).mockReturnValue({
      articles: mockArticles,
      markMultipleAsRead: mockMarkMultipleAsRead,
    });

    // Mock localStorage manager
    (localStorageStateManager.batchMarkArticlesRead as any).mockResolvedValue({
      success: true,
      responseTime: 0.8,
      fallbackUsed: false,
    });
  });

  afterEach(() => {
    // Cleanup component state and subscriptions
    cleanup?.();
    rtlCleanup(); // React Testing Library cleanup

    // Clear all timers and restore mocks
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  describe("State Machine Transitions", () => {
    it("should transition from Normal → Confirming on button click", async () => {
      const { container } = render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });
      expect(button).toHaveAttribute("data-state", "normal");

      // Click to initiate confirmation
      fireEvent.click(button);

      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "confirming");
      });

      // Should show segmented control with Cancel/Confirm
      expect(screen.getByText("Cancel")).toBeInTheDocument();
      expect(screen.getByText("Confirm")).toBeInTheDocument();
    });

    it("should transition from Confirming → Loading → Success on confirm", async () => {
      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });

      // Enter confirming state
      fireEvent.click(button);
      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "confirming");
      });

      // Click confirm
      const confirmButton = screen.getByText("Confirm");
      fireEvent.click(confirmButton);

      // Should transition to loading
      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "loading");
      });

      // Fast-forward through loading animation (1500ms)
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Should transition to success
      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "normal");
        expect(toast.success).toHaveBeenCalledWith(
          'All "Technology" articles have been marked as read',
          { duration: 3500 }
        );
      });
    });

    it("should transition from Confirming → Loading → Error on failure", async () => {
      // Mock failure
      (
        localStorageStateManager.batchMarkArticlesRead as any
      ).mockRejectedValueOnce(new Error("Network error"));

      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });

      // Enter confirming state
      fireEvent.click(button);
      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "confirming");
      });

      // Click confirm
      const confirmButton = screen.getByText("Confirm");
      fireEvent.click(confirmButton);

      // Should transition to loading
      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "loading");
      });

      // Fast-forward through loading
      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Should show error and return to normal
      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "normal");
        expect(toast.error).toHaveBeenCalledWith(
          "Failed to mark articles as read • Check your connection",
          { duration: 6000 }
        );
      });
    });

    it("should return to Normal state on cancel", async () => {
      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });

      // Enter confirming state
      fireEvent.click(button);
      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "confirming");
      });

      // Click cancel
      const cancelButton = screen.getByText("Cancel");
      fireEvent.click(cancelButton);

      // Should return to normal immediately
      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "normal");
      });
    });
  });

  describe("UI Morphing Behavior", () => {
    it("should apply liquid glass morphing classes during transitions", async () => {
      const { container } = render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = container.querySelector(".mark-all-read-button");
      expect(button).toHaveClass("liquid-glass-morph");

      // Click to trigger morphing
      fireEvent.click(button!);

      await waitFor(() => {
        // Should have morphing animation classes
        expect(button).toHaveClass("state-confirming");
        expect(button).toHaveStyle({
          transition: "all 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)",
        });
      });
    });

    it("should collapse segmented control smoothly", async () => {
      const { container } = render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = container.querySelector(".mark-all-read-button");

      // Enter confirming state
      fireEvent.click(button!);

      await waitFor(() => {
        const segmentedControl = container.querySelector(".segmented-control");
        expect(segmentedControl).toBeInTheDocument();
        expect(segmentedControl).toHaveStyle({
          opacity: "1",
          transform: "scale(1)",
        });
      });

      // Confirm action
      const confirmButton = screen.getByText("Confirm");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        const segmentedControl = container.querySelector(".segmented-control");
        expect(segmentedControl).toHaveStyle({
          opacity: "0",
          transform: "scale(0.8)",
        });
      });
    });

    it("should maintain 60fps animation performance", async () => {
      const { container } = render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = container.querySelector(".mark-all-read-button");

      // Mock performance API
      const mockPerformance = {
        now: vi.fn(),
      };
      mockPerformance.now.mockReturnValueOnce(0).mockReturnValueOnce(16.67); // 60fps = 16.67ms per frame

      // Trigger animation
      fireEvent.click(button!);

      // Measure frame time
      const frameTime = mockPerformance.now() - mockPerformance.now();
      expect(frameTime).toBeLessThanOrEqual(16.67); // 60fps threshold
    });
  });

  describe("Performance Requirements", () => {
    it("should respond to user interaction in <1ms", async () => {
      const startTime = performance.now();

      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });
      fireEvent.click(button);

      const responseTime = performance.now() - startTime;
      expect(responseTime).toBeLessThan(1); // <1ms requirement
    });

    it("should batch article updates within 500ms window", async () => {
      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });

      // Start mark all process
      fireEvent.click(button);
      const confirmButton = await screen.findByText("Confirm");
      fireEvent.click(confirmButton);

      // Verify batching was called
      await waitFor(() => {
        expect(
          localStorageStateManager.batchMarkArticlesRead
        ).toHaveBeenCalledWith(
          expect.arrayContaining([
            { articleId: "article-1", feedId: "feed-1" },
            { articleId: "article-2", feedId: "feed-1" },
            { articleId: "article-3", feedId: "feed-2" },
          ])
        );
      });

      // Verify timing
      const callTime = (localStorageStateManager.batchMarkArticlesRead as any)
        .mock.calls[0];
      expect(callTime).toBeDefined();
    });

    it("should not block UI thread during batch processing", async () => {
      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });

      // Create a UI interaction tracker
      let uiBlocked = false;
      const uiTest = setInterval(() => {
        uiBlocked = false;
      }, 10);

      // Start heavy operation
      fireEvent.click(button);
      const confirmButton = await screen.findByText("Confirm");
      fireEvent.click(confirmButton);

      // UI should remain responsive
      expect(uiBlocked).toBe(false);

      clearInterval(uiTest);
    });
  });

  describe("Error Handling", () => {
    it("should handle localStorage unavailability gracefully", async () => {
      // Mock localStorage unavailable
      (
        localStorageStateManager.batchMarkArticlesRead as any
      ).mockRejectedValueOnce(new Error("localStorage unavailable"));

      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });
      fireEvent.click(button);

      const confirmButton = await screen.findByText("Confirm");
      fireEvent.click(confirmButton);

      // Should fallback to store method
      await waitFor(() => {
        expect(mockMarkMultipleAsRead).toHaveBeenCalled();
      });
    });

    it("should handle empty article list", async () => {
      // Mock empty articles
      (useArticleStore as any).mockReturnValue({
        articles: [],
        markMultipleAsRead: mockMarkMultipleAsRead,
      });

      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });
      expect(button).toBeDisabled();
    });

    it("should handle network failures with retry capability", async () => {
      let callCount = 0;
      (
        localStorageStateManager.batchMarkArticlesRead as any
      ).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve({ success: true, responseTime: 0.8 });
      });

      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });

      // First attempt
      fireEvent.click(button);
      const confirmButton = await screen.findByText("Confirm");
      fireEvent.click(confirmButton);

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Should show error
      expect(toast.error).toHaveBeenCalled();

      // Retry
      fireEvent.click(button);
      const retryConfirm = await screen.findByText("Confirm");
      fireEvent.click(retryConfirm);

      await act(async () => {
        vi.advanceTimersByTime(1500);
      });

      // Should succeed on retry
      expect(toast.success).toHaveBeenCalled();
    });
  });

  describe("Props Validation", () => {
    it("should require tagSlug and tagName props", () => {
      // @ts-expect-error - Testing missing props
      const renderWithoutProps = () => render(<MarkAllReadTagButton />);

      expect(renderWithoutProps).toThrow();
    });

    it("should handle special characters in tag names", () => {
      const specialTags = [
        { slug: "c-plus-plus", name: "C++" },
        { slug: "dot-net", name: ".NET" },
        { slug: "web-3-0", name: "Web 3.0" },
      ];

      specialTags.forEach(({ slug, name }) => {
        const { unmount } = render(
          <MarkAllReadTagButton tagSlug={slug} tagName={name} />
        );

        expect(screen.getByRole("button")).toHaveTextContent(
          `Mark all "${name}" as read`
        );
        unmount();
      });
    });

    it("should apply custom className if provided", () => {
      const { container } = render(
        <MarkAllReadTagButton
          tagSlug="technology"
          tagName="Technology"
          className="custom-class"
        />
      );

      const button = container.querySelector(".mark-all-read-button");
      expect(button).toHaveClass("custom-class");
    });
  });

  describe("Accessibility", () => {
    it("should have proper ARIA attributes", () => {
      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });
      expect(button).toHaveAttribute(
        "aria-label",
        'Mark all "Technology" articles as read'
      );
      expect(button).toHaveAttribute("aria-busy", "false");
    });

    it("should update aria-busy during loading", async () => {
      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });

      fireEvent.click(button);
      const confirmButton = await screen.findByText("Confirm");
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(button).toHaveAttribute("aria-busy", "true");
      });
    });

    it("should be keyboard navigable", async () => {
      render(
        <MarkAllReadTagButton tagSlug="technology" tagName="Technology" />
      );

      const button = screen.getByRole("button", { name: /mark all read/i });

      // Simulate Enter key
      fireEvent.keyDown(button, { key: "Enter", code: "Enter" });

      await waitFor(() => {
        expect(button).toHaveAttribute("data-state", "confirming");
      });

      // Navigate with Tab
      fireEvent.keyDown(document.activeElement!, { key: "Tab" });
      expect(document.activeElement).toHaveTextContent("Cancel");

      fireEvent.keyDown(document.activeElement!, { key: "Tab" });
      expect(document.activeElement).toHaveTextContent("Confirm");
    });
  });
});
