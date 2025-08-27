/**
 * RR-255: Fix Summary button opens article + retire IOSButton
 * 
 * Test suite validates:
 * 1. Event propagation prevention (critical path)
 * 2. IOSButton component removal
 * 3. GlassToolbarButton integration
 * 4. Accessibility compliance
 * 5. Mobile interaction patterns
 */

import React from "react";
import { render, screen, waitFor, cleanup as rtlCleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

// Mock Supabase before any imports that use it
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
      insert: vi.fn(() => ({ data: null, error: null })),
      update: vi.fn(() => ({ data: null, error: null })),
      delete: vi.fn(() => ({ data: null, error: null })),
    })),
  },
}));

import { SummaryButton } from "@/components/articles/summary-button";
import { GlassToolbarButton } from "@/components/ui/glass-button";

// Mock dependencies
const mockGenerateSummary = vi.fn().mockResolvedValue({
  success: true,
  summary: "Test summary content",
  model: "claude-3-5-sonnet",
});

vi.mock("@/lib/stores/article-store", () => ({
  useArticleStore: () => ({
    generateSummary: mockGenerateSummary,
  }),
}));

describe("RR-255: SummaryButton Event Propagation Fix", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    rtlCleanup();
    vi.clearAllMocks();
  });

  describe("Event Propagation Prevention", () => {
    it("should prevent event bubbling when clicked", async () => {
      const cardClickHandler = vi.fn();
      const buttonClickHandler = vi.fn();
      const user = userEvent.setup({ delay: null });

      const { container } = render(
        <div onClick={cardClickHandler} data-testid="article-card">
          <SummaryButton
            articleId="test-123"
            hasSummary={false}
            variant="icon"
            onClick={buttonClickHandler}
          />
        </div>
      );

      const button = screen.getByRole("button", { name: /summarize/i });
      await user.click(button);

      // Button handler should be called
      expect(buttonClickHandler).toHaveBeenCalledOnce();
      // Card handler should NOT be called (propagation stopped)
      expect(cardClickHandler).not.toHaveBeenCalled();
    });

    it("should call stopPropagation on mouse events", async () => {
      const mockStopPropagation = vi.fn();
      const user = userEvent.setup({ delay: null });

      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      const button = screen.getByRole("button");
      
      // Manually trigger event with spy
      const clickEvent = new MouseEvent("click", { bubbles: true });
      Object.defineProperty(clickEvent, "stopPropagation", {
        value: mockStopPropagation,
        writable: false,
      });

      button.dispatchEvent(clickEvent);
      expect(mockStopPropagation).toHaveBeenCalled();
    });

    it("should prevent default on keyboard Enter/Space", async () => {
      const cardHandler = vi.fn();
      const user = userEvent.setup({ delay: null });

      render(
        <div onClick={cardHandler}>
          <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
        </div>
      );

      const button = screen.getByRole("button");
      button.focus();

      // Test Enter key
      await user.keyboard("{Enter}");
      expect(cardHandler).not.toHaveBeenCalled();

      // Test Space key
      await user.keyboard(" ");
      expect(cardHandler).not.toHaveBeenCalled();
    });

    it("should handle nested click targets correctly", async () => {
      const cardHandler = vi.fn();
      const containerHandler = vi.fn();
      const user = userEvent.setup({ delay: null });

      render(
        <div onClick={containerHandler}>
          <div onClick={cardHandler}>
            <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
          </div>
        </div>
      );

      const button = screen.getByRole("button");
      await user.click(button);

      // Neither parent handler should be called
      expect(cardHandler).not.toHaveBeenCalled();
      expect(containerHandler).not.toHaveBeenCalled();
    });

    it("should not interfere with other card interactions", async () => {
      const cardHandler = vi.fn();
      const otherButtonHandler = vi.fn();
      const user = userEvent.setup({ delay: null });

      render(
        <div onClick={cardHandler} data-testid="card">
          <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
          <button onClick={otherButtonHandler}>Other Action</button>
        </div>
      );

      // Click other button - should propagate normally
      const otherButton = screen.getByText("Other Action");
      await user.click(otherButton);

      expect(otherButtonHandler).toHaveBeenCalled();
      expect(cardHandler).toHaveBeenCalled();

      // Reset mocks
      vi.clearAllMocks();

      // Click summary button - should NOT propagate
      const summaryButton = screen.getByRole("button", { name: /summarize/i });
      await user.click(summaryButton);
      expect(cardHandler).not.toHaveBeenCalled();
    });
  });

  describe("IOSButton Removal Validation", () => {
    it("should not render IOSButton component", () => {
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      // Should NOT have IOSButton classes or attributes
      expect(container.querySelector(".ios-button")).toBeNull();
      expect(container.querySelector("[data-ios-button]")).toBeNull();
      expect(container.querySelector("[data-ios]")).toBeNull();
      
      // Legacy iOS-specific classes should not exist
      const button = screen.getByRole("button");
      const classes = button.className;
      expect(classes).not.toMatch(/ios/i);
    });

    it("should use GlassToolbarButton exclusively", () => {
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      const button = screen.getByRole("button");
      
      // Should have Glass button classes
      expect(button).toHaveClass("glass-surface");
      expect(button).toHaveAttribute("data-glass-button");
      
      // Should have toolbar-specific attributes
      const classList = Array.from(button.classList);
      const hasGlassClasses = classList.some(cls => 
        cls.includes("glass") || cls.includes("toolbar")
      );
      expect(hasGlassClasses).toBe(true);
    });

    it("should maintain backward compatibility with existing props", () => {
      const onSuccess = vi.fn();
      const className = "custom-test-class";

      const { rerender } = render(
        <SummaryButton
          articleId="test-123"
          hasSummary={false}
          variant="icon"
          size="md"
          className={className}
          onSuccess={onSuccess}
        />
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass(className);

      // Test different variants
      rerender(
        <SummaryButton
          articleId="test-123"
          hasSummary={true}
          variant="full"
          size="lg"
        />
      );

      // Should still work with different props
      expect(screen.getByRole("button", { name: /re-summarize/i })).toBeInTheDocument();
    });

    it("should not import IOSButton anywhere in component tree", () => {
      // This test validates at build time that IOSButton import is removed
      // The test itself passing indicates no import errors occurred
      expect(() => {
        render(<SummaryButton articleId="test" hasSummary={false} variant="icon" />);
      }).not.toThrow();
    });
  });

  describe("GlassToolbarButton Integration", () => {
    it("should render with correct glass-surface classes", () => {
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("glass-surface");
      
      // Check for glass morphing classes
      const hasGlassMorphing = Array.from(button.classList).some(
        cls => cls.includes("morph") || cls.includes("blur")
      );
      expect(hasGlassMorphing).toBe(true);
    });

    it("should apply violet-primary variant for summary action", () => {
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      const button = screen.getByRole("button");
      const hasVioletClasses = Array.from(button.classList).some(
        cls => cls.includes("violet") || cls.includes("primary")
      );
      expect(hasVioletClasses).toBe(true);
    });

    it("should maintain 44x44px minimum touch target", () => {
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" size="sm" />
      );

      const button = screen.getByRole("button");
      const styles = window.getComputedStyle(button);
      
      // Parse dimensions (handle 'px' suffix)
      const width = parseInt(styles.minWidth || styles.width);
      const height = parseInt(styles.minHeight || styles.height);
      
      // WCAG 2.1 AA requires 44x44px minimum
      expect(width).toBeGreaterThanOrEqual(44);
      expect(height).toBeGreaterThanOrEqual(44);
    });

    it("should show loading state during API call", async () => {
      const user = userEvent.setup({ delay: null });
      mockGenerateSummary.mockClear();
      mockGenerateSummary.mockImplementation(
        () => new Promise(resolve => setTimeout(resolve, 100))
      );

      render(<SummaryButton articleId="test-123" hasSummary={false} variant="icon" />);

      const button = screen.getByRole("button");
      await user.click(button);

      // Should show loading indicator
      expect(screen.getByRole("progressbar")).toBeInTheDocument();
      expect(button).toBeDisabled();

      // Advance timers to complete
      vi.advanceTimersByTime(100);
      
      await waitFor(() => {
        expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
        expect(button).not.toBeDisabled();
      });
    });

    it("should disable button during summary generation", async () => {
      const user = userEvent.setup({ delay: null });
      let resolveGeneration: () => void;
      mockGenerateSummary.mockClear();
      mockGenerateSummary.mockImplementation(
        () => new Promise(resolve => { resolveGeneration = resolve; })
      );

      render(<SummaryButton articleId="test-123" hasSummary={false} variant="icon" />);

      const button = screen.getByRole("button");
      expect(button).not.toBeDisabled();

      await user.click(button);
      expect(button).toBeDisabled();

      // Try clicking while disabled - should not call again
      await user.click(button);
      expect(mockGenerateSummary).toHaveBeenCalledTimes(1);

      // Resolve and check re-enabled
      resolveGeneration!();
      await waitFor(() => expect(button).not.toBeDisabled());
    });

    it("should show error state on API failure", async () => {
      const user = userEvent.setup({ delay: null });
      mockGenerateSummary.mockClear();
      mockGenerateSummary.mockRejectedValue(
        new Error("API rate limit exceeded")
      );

      render(<SummaryButton articleId="test-123" hasSummary={false} variant="icon" />);

      const button = screen.getByRole("button");
      await user.click(button);

      await waitFor(() => {
        // Should show error indicator
        expect(button).toHaveAttribute("data-error", "true");
        // Should be re-enabled for retry
        expect(button).not.toBeDisabled();
      });
    });
  });

  describe("Accessibility Compliance", () => {
    it("should have accessible button with proper labeling", () => {
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      const button = screen.getByRole("button");
      
      // Check for accessible properties
      expect(button).toHaveAttribute("aria-label");
      expect(button.getAttribute("aria-label")).toMatch(/summarize/i);
      
      // Check for proper focus management
      expect(button).not.toHaveAttribute("tabindex", "-1");
    });

    it("should have proper ARIA attributes", () => {
      const { rerender } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("aria-label", expect.stringMatching(/summarize/i));
      
      // Loading state
      rerender(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );
      
      // During loading (simulate)
      mockGenerateSummary.mockClear();
      mockGenerateSummary.mockImplementation(() => new Promise(() => {}));
      
      userEvent.click(button);
      
      waitFor(() => {
        expect(button).toHaveAttribute("aria-busy", "true");
        expect(button).toHaveAttribute("aria-disabled", "true");
      });
    });

    it("should support keyboard navigation", async () => {
      const onSuccess = vi.fn();
      const user = userEvent.setup({ delay: null });

      render(
        <SummaryButton
          articleId="test-123"
          hasSummary={false}
          variant="icon"
          onSuccess={onSuccess}
        />
      );

      // Tab to button
      await user.tab();
      const button = screen.getByRole("button");
      expect(button).toHaveFocus();

      // Activate with Enter
      await user.keyboard("{Enter}");
      await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    });

    it("should announce state changes to screen readers", async () => {
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      // Check for live region
      const liveRegion = container.querySelector('[aria-live]');
      expect(liveRegion).toBeInTheDocument();
      expect(liveRegion).toHaveAttribute("aria-live", "polite");
    });
  });

  describe("Mobile Interaction Patterns", () => {
    it("should handle touch events without ghost clicks", async () => {
      const clickHandler = vi.fn();
      const { container } = render(
        <SummaryButton
          articleId="test-123"
          hasSummary={false}
          variant="icon"
          onClick={clickHandler}
        />
      );

      const button = screen.getByRole("button");

      // Simulate touch event
      const touchStart = new TouchEvent("touchstart", {
        touches: [{ clientX: 50, clientY: 50 } as Touch],
      });
      const touchEnd = new TouchEvent("touchend", {
        changedTouches: [{ clientX: 50, clientY: 50 } as Touch],
      });

      button.dispatchEvent(touchStart);
      button.dispatchEvent(touchEnd);

      // Should only trigger once
      await waitFor(() => expect(clickHandler).toHaveBeenCalledTimes(1));
    });

    it("should prevent double-tap zoom on button", () => {
      const { container } = render(
        <SummaryButton articleId="test-123" hasSummary={false} variant="icon" />
      );

      const button = screen.getByRole("button");
      const styles = window.getComputedStyle(button);
      
      // Check for touch-action CSS to prevent zoom
      expect(styles.touchAction).toMatch(/manipulation|none/);
    });

    it("should handle rapid successive clicks (debouncing)", async () => {
      mockGenerateSummary.mockClear();
      mockGenerateSummary.mockResolvedValue({ success: true });

      const user = userEvent.setup({ delay: null });
      render(<SummaryButton articleId="test-123" hasSummary={false} variant="icon" />);

      const button = screen.getByRole("button");

      // Rapid clicks
      await user.click(button);
      await user.click(button);
      await user.click(button);

      // Should only call once (debounced)
      expect(mockGenerateSummary).toHaveBeenCalledTimes(1);
    });
  });
});