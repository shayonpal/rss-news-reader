/**
 * RR-215: iOS 26 Liquid Glass Scrollable Header Unit Tests
 * Test Contract: Three-state system (expanded/transitioning/collapsed)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { renderHook } from "@testing-library/react";

// Components to test (will be implemented)
import { ScrollableArticleHeader } from "@/components/articles/scrollable-article-header";
import { MorphingNavButton } from "@/components/ui/morphing-nav-button";
import { useIOSHeaderScroll } from "@/hooks/use-ios-header-scroll";
import { ScrollCoordinator } from "@/services/scroll-coordinator";

// Mock existing dependencies
vi.mock("@/components/articles/article-header", () => ({
  ArticleHeader: ({ children, ...props }) => (
    <div data-testid="article-header" {...props}>
      {children}
    </div>
  ),
}));

describe("RR-215: iOS Scrollable Header System", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    
    // Mock window.requestAnimationFrame
    global.requestAnimationFrame = vi.fn((cb) => {
      cb(performance.now());
      return 1;
    });
    
    // Mock window.matchMedia
    global.matchMedia = vi.fn((query: string) => ({
      matches: query.includes("prefers-reduced-motion: reduce") ? false : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    
    // Mock CSS.supports
    global.CSS = {
      supports: vi.fn((property: string, value?: string) => {
        if (property.includes("backdrop-filter")) return true;
        return false;
      }),
    } as any;
    
    // Mock window.scrollY
    Object.defineProperty(window, "scrollY", { value: 0, writable: true });
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe("ScrollCoordinator Service", () => {
    it("should manage unified scroll state", () => {
      const coordinator = new ScrollCoordinator();
      const listener = vi.fn();
      
      coordinator.subscribe("test-component", listener);
      coordinator.updateScrollPosition(100);
      
      expect(listener).toHaveBeenCalledWith({
        scrollY: 100,
        scrollState: "transitioning", // 44px < 100px < 150px
        isScrollingUp: false,
      });
    });

    it("should determine correct scroll states", () => {
      const coordinator = new ScrollCoordinator();
      
      // Expanded state (0-44px)
      coordinator.updateScrollPosition(30);
      expect(coordinator.getScrollState()).toBe("expanded");
      
      // Transitioning state (44-150px)
      coordinator.updateScrollPosition(100);
      expect(coordinator.getScrollState()).toBe("transitioning");
      
      // Collapsed state (>150px)
      coordinator.updateScrollPosition(200);
      expect(coordinator.getScrollState()).toBe("collapsed");
    });

    it("should detect scroll direction", () => {
      const coordinator = new ScrollCoordinator();
      
      // Initial scroll down
      coordinator.updateScrollPosition(50);
      coordinator.updateScrollPosition(100);
      expect(coordinator.isScrollingUp()).toBe(false);
      
      // Scroll back up
      coordinator.updateScrollPosition(75);
      expect(coordinator.isScrollingUp()).toBe(true);
    });
  });

  describe("useIOSHeaderScroll Hook", () => {
    it("should return correct scroll state object", () => {
      const { result } = renderHook(() => useIOSHeaderScroll());
      
      expect(result.current).toEqual({
        scrollState: "expanded",
        scrollY: 0,
        isScrollingUp: false,
        titleScale: expect.any(Number),
        headerHeight: expect.any(Number),
        blurIntensity: expect.any(Number),
        contentVisible: true,
      });
    });

    it("should calculate dynamic values correctly", () => {
      const { result } = renderHook(() => useIOSHeaderScroll());
      
      // Manually trigger scroll update to 100
      act(() => {
        // This will update the hook state through the coordinator
        Object.defineProperty(window, "scrollY", { value: 100, writable: true });
        window.dispatchEvent(new Event("scroll"));
      });
      
      // Title scale: Math.max(0.5, 1 - scrollY / 300)
      expect(result.current.titleScale).toBeCloseTo(1 - 100 / 300, 2);
      
      // Header height: Math.max(54, 120 - scrollY * 0.4)
      expect(result.current.headerHeight).toBe(Math.max(54, 120 - 100 * 0.4));
      
      // Blur intensity: Math.min(16, 8 + scrollY / 20)
      expect(result.current.blurIntensity).toBe(Math.min(16, 8 + 100 / 20));
    });

    it("should use requestAnimationFrame for smooth updates", () => {
      const mockRAF = vi.fn((callback) => {
        callback(performance.now());
        return 1;
      });
      global.requestAnimationFrame = mockRAF;
      
      renderHook(() => useIOSHeaderScroll());
      
      // Trigger scroll event
      act(() => {
        fireEvent.scroll(window);
      });
      
      expect(mockRAF).toHaveBeenCalled();
    });
  });

  describe("MorphingNavButton Component", () => {
    it("should render hamburger icon in expanded state", () => {
      render(
        <MorphingNavButton scrollState="expanded" onClick={() => {}} />
      );
      
      expect(screen.getByTestId("hamburger-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("back-icon")).toHaveStyle({
        opacity: "0",
      });
    });

    it("should render back icon in collapsed state", () => {
      render(<MorphingNavButton scrollState="collapsed" onClick={() => {}} />);
      
      expect(screen.getByTestId("back-icon")).toBeInTheDocument();
      expect(screen.queryByTestId("hamburger-icon")).toHaveStyle({
        opacity: "0",
      });
    });

    it("should meet 44px touch target requirement", () => {
      render(
        <MorphingNavButton scrollState="expanded" onClick={() => {}} />
      );
      
      const button = screen.getByRole("button");
      const styles = getComputedStyle(button);
      
      expect(parseInt(styles.minWidth)).toBeGreaterThanOrEqual(44);
      expect(parseInt(styles.minHeight)).toBeGreaterThanOrEqual(44);
    });

    it("should apply spring animation timing", () => {
      render(
        <MorphingNavButton scrollState="transitioning" onClick={() => {}} />
      );
      
      const iconContainer = screen.getByTestId("icon-container");
      expect(iconContainer).toHaveStyle({
        transition: expect.stringContaining("0.25s"),
      });
    });
  });

  describe("ScrollableArticleHeader Wrapper", () => {
    const mockProps = {
      readStatusFilter: "all" as const,
      markAllAsRead: vi.fn(),
      markAllAsReadForTag: vi.fn(),
      refreshArticles: vi.fn(),
    };

    it("should render ArticleHeader with scroll enhancements", () => {
      render(<ScrollableArticleHeader {...mockProps} />);
      
      expect(screen.getByTestId("scrollable-header-container")).toBeInTheDocument();
      expect(screen.getByTestId("article-header")).toBeInTheDocument();
    });

    it("should apply dynamic header styles based on scroll", () => {
      // Mock scroll position
      Object.defineProperty(window, "scrollY", { value: 100, writable: true });
      
      render(<ScrollableArticleHeader {...mockProps} />);
      
      const container = screen.getByTestId("scrollable-header-container");
      const styles = getComputedStyle(container);
      
      expect(styles.backdropFilter).toContain("blur(");
      expect(styles.transition).toContain("cubic-bezier(0.32, 0.72, 0, 1)");
    });

    it("should pass through all ArticleHeader props", () => {
      const extraProps = { customProp: "test-value" };
      render(<ScrollableArticleHeader {...mockProps} {...extraProps} />);
      
      const articleHeader = screen.getByTestId("article-header");
      expect(articleHeader).toHaveAttribute("customProp", "test-value");
    });

    it("should maintain title visibility with dynamic opacity", () => {
      render(<ScrollableArticleHeader {...mockProps} />);
      
      const title = screen.getByRole("heading");
      const styles = getComputedStyle(title);
      
      // Title should have dynamic opacity (Math.max(0.7, 1 - scrollY / 200))
      expect(parseFloat(styles.opacity)).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("Animation Performance", () => {
    it("should complete morphing animation within 350ms", async () => {
      const startTime = performance.now();
      
      render(<MorphingNavButton scrollState="expanded" onClick={() => {}} />);
      
      // Trigger state change
      render(<MorphingNavButton scrollState="collapsed" onClick={() => {}} />);
      
      // Fast-forward through transition
      await act(async () => {
        vi.advanceTimersByTime(350);
      });
      
      const endTime = performance.now();
      expect(endTime - startTime).toBeLessThanOrEqual(350);
    });

    it("should use GPU acceleration for transforms", () => {
      const mockProps = {
        readStatusFilter: "all" as const,
        markAllAsRead: vi.fn(),
        markAllAsReadForTag: vi.fn(),
        refreshArticles: vi.fn(),
      };
      
      render(<ScrollableArticleHeader {...mockProps} />);
      
      const title = screen.getByRole("heading");
      const styles = getComputedStyle(title);
      
      expect(styles.transform).toBeTruthy();
      expect(styles.willChange).toContain("transform");
    });
  });

  describe("Accessibility Features", () => {
    it("should have proper ARIA labels", () => {
      render(
        <MorphingNavButton 
          scrollState="expanded" 
          onClick={() => {}} 
          ariaLabel="Toggle navigation menu"
        />
      );
      
      expect(screen.getByRole("button")).toHaveAttribute(
        "aria-label",
        "Toggle navigation menu"
      );
    });

    it("should update ARIA state during transitions", () => {
      const { rerender } = render(
        <MorphingNavButton scrollState="expanded" onClick={() => {}} />
      );
      
      const button = screen.getByRole("button");
      expect(button).toHaveAttribute("data-scroll-state", "expanded");
      
      rerender(<MorphingNavButton scrollState="collapsed" onClick={() => {}} />);
      expect(button).toHaveAttribute("data-scroll-state", "collapsed");
    });

    it("should support keyboard navigation", () => {
      const handleClick = vi.fn();
      render(<MorphingNavButton scrollState="expanded" onClick={handleClick} />);
      
      const button = screen.getByRole("button");
      fireEvent.keyDown(button, { key: "Enter" });
      
      expect(handleClick).toHaveBeenCalled();
    });

    it("should meet contrast ratio requirements", () => {
      const mockProps = {
        readStatusFilter: "all" as const,
        markAllAsRead: vi.fn(),
        markAllAsReadForTag: vi.fn(),
        refreshArticles: vi.fn(),
      };
      
      render(<ScrollableArticleHeader {...mockProps} />);
      
      const title = screen.getByRole("heading");
      const styles = getComputedStyle(title);
      
      // Minimum opacity ensures contrast ratio ≥ 4.5:1
      expect(parseFloat(styles.opacity)).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe("Progressive Enhancement", () => {
    it("should fallback gracefully without backdrop-filter support", () => {
      const mockProps = {
        readStatusFilter: "all" as const,
        markAllAsRead: vi.fn(),
        markAllAsReadForTag: vi.fn(),
        refreshArticles: vi.fn(),
      };
      
      // Mock no backdrop-filter support
      global.CSS.supports = vi.fn((property: string) => !property.includes("backdrop-filter"));
      
      render(<ScrollableArticleHeader {...mockProps} />);
      
      const container = screen.getByTestId("scrollable-header-container");
      const styles = getComputedStyle(container);
      
      // Should have solid background fallback
      expect(styles.backgroundColor).toBeTruthy();
    });

    it("should reduce animations for prefers-reduced-motion", () => {
      // Mock reduced motion preference
      global.matchMedia = vi.fn((query: string) => ({
        matches: query.includes("prefers-reduced-motion: reduce") ? true : false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
      
      render(<MorphingNavButton scrollState="expanded" onClick={() => {}} />);
      
      const iconContainer = screen.getByTestId("icon-container");
      const styles = getComputedStyle(iconContainer);
      
      expect(styles.transitionDuration).toMatch(/0\.01s|none/);
    });
  });
});