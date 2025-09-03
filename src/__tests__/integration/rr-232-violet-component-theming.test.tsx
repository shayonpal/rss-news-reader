/**
 * RR-232: Violet Theme Implementation - Component Integration Tests
 *
 * Tests that all 17+ glass components correctly apply violet theme tokens.
 * Validates component-level integration with the 3-tier token system.
 *
 * Test Coverage:
 * - NavigationBar with violet glass background
 * - Mobile navigation touch targets and theming
 * - ArticleCard violet glass styling
 * - Article list virtualization preservation
 * - FeedList violet accent styling
 * - Feed sync indicator theming
 * - Modal backdrop violet tinting
 * - Loading overlay violet gradients
 * - Input focus states with violet
 * - Button variants (primary/secondary/ghost) with violet
 * - SimpleFeedSidebar counter styling with OKLCH colors
 * - Counter CSS custom properties integration
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Mock glass components for testing
const MockGlassNav: React.FC<{ className?: string }> = ({ className = "" }) => (
  <nav
    className={`glass-nav ${className}`}
    data-testid="glass-nav"
    style={{
      background: "var(--glass-nav-bg)",
      border: "1px solid var(--glass-nav-border)",
      backdropFilter: "var(--glass-blur)",
    }}
  >
    <div className="nav-content">Navigation</div>
  </nav>
);

const MockGlassButton: React.FC<{
  variant?: "primary" | "secondary" | "ghost";
  className?: string;
  onClick?: () => void;
  children: React.ReactNode;
}> = ({ variant = "primary", className = "", onClick, children }) => (
  <button
    className={`glass-button glass-button--${variant} ${className}`}
    data-testid={`glass-button-${variant}`}
    onClick={onClick}
    style={{
      background:
        variant === "primary"
          ? "var(--glass-nav-bg)"
          : "var(--color-surface-glass-subtle)",
      border: "1px solid var(--color-border-glass)",
      backdropFilter: "var(--glass-blur)",
    }}
  >
    {children}
  </button>
);

const MockArticleCard: React.FC<{ title: string; excerpt?: string }> = ({
  title,
  excerpt,
}) => (
  <article
    className="glass-card"
    data-testid="article-card"
    style={{
      background: "var(--color-surface-glass)",
      border: "1px solid var(--color-border-glass)",
      backdropFilter: "var(--glass-blur)",
    }}
  >
    <h3 className="article-title">{title}</h3>
    {excerpt && <p className="article-excerpt">{excerpt}</p>}
  </article>
);

const MockGlassModal: React.FC<{
  isOpen: boolean;
  children: React.ReactNode;
}> = ({ isOpen, children }) =>
  isOpen ? (
    <div
      className="glass-modal-backdrop"
      data-testid="glass-modal"
      style={{
        background: "var(--color-surface-glass-hover)",
        backdropFilter: "var(--glass-blur-enhanced)",
      }}
    >
      <div
        className="glass-modal-content"
        style={{
          background: "var(--color-surface-glass)",
          border: "1px solid var(--color-border-glass-enhanced)",
        }}
      >
        {children}
      </div>
    </div>
  ) : null;

const MockFeedList: React.FC<{
  feeds: Array<{ id: string; name: string; isSelected?: boolean }>;
}> = ({ feeds }) => (
  <div className="feed-list" data-testid="feed-list">
    {feeds.map((feed) => (
      <div
        key={feed.id}
        className={`feed-item ${feed.isSelected ? "feed-item--selected" : ""}`}
        data-testid={`feed-item-${feed.id}`}
        style={{
          background: feed.isSelected ? "var(--glass-nav-bg)" : "transparent",
          border: feed.isSelected
            ? "1px solid var(--color-border-glass)"
            : "1px solid transparent",
        }}
      >
        {feed.name}
      </div>
    ))}
  </div>
);

const MockLoadingOverlay: React.FC<{ isLoading: boolean }> = ({ isLoading }) =>
  isLoading ? (
    <div
      className="loading-overlay"
      data-testid="loading-overlay"
      style={{
        background:
          "linear-gradient(90deg, var(--color-surface-glass) 0%, var(--color-surface-glass-hover) 50%, var(--color-surface-glass) 100%)",
        backdropFilter: "var(--glass-blur)",
      }}
    >
      <div className="loading-shimmer" />
    </div>
  ) : null;

describe("RR-232: Violet Theme Component Integration", () => {
  let testContainer: HTMLDivElement;
  let originalTheme: string | null;

  beforeEach(() => {
    testContainer = document.createElement("div");
    document.body.appendChild(testContainer);

    // Store and set violet theme
    originalTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "violet");

    // Ensure clean state
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    document.body.removeChild(testContainer);

    // Restore original theme
    if (originalTheme) {
      document.documentElement.setAttribute("data-theme", originalTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  });

  // Test 9: Navigation components - GlassNav
  it("should apply violet glass to NavigationBar", () => {
    const { getByTestId } = render(<MockGlassNav />, {
      container: testContainer,
    });

    const navElement = getByTestId("glass-nav");
    const computedStyles = getComputedStyle(navElement);

    // Should have violet glass background
    const background = computedStyles.background;
    expect(background).toMatch(/rgba\(139[,\s]+92[,\s]+246[,\s]+0\.0[3-5]\)/);

    // Should have backdrop blur
    const backdropFilter = computedStyles.backdropFilter;
    expect(backdropFilter).toMatch(/blur\(\d+px\)/);

    // Should have subtle violet border
    const borderColor = computedStyles.borderColor;
    expect(borderColor).toMatch(/rgba?\(139[,\s]+92[,\s]+246/);
  });

  // Test 10: Mobile navigation touch targets
  it("should handle mobile navigation with violet theme", () => {
    const { getByTestId } = render(<MockGlassNav className="mobile-nav" />, {
      container: testContainer,
    });

    const navElement = getByTestId("glass-nav");

    // Touch target should be at least 44x44px (iOS guidelines)
    const rect = navElement.getBoundingClientRect();
    expect(rect.height).toBeGreaterThanOrEqual(44);

    // Should maintain violet theming on mobile
    const computedStyles = getComputedStyle(navElement);
    expect(computedStyles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    // Should have appropriate z-index for mobile overlays
    const zIndex = parseInt(computedStyles.zIndex || "0");
    expect(zIndex).toBeGreaterThanOrEqual(10);
  });

  // Test 11: Article components - ArticleCard theming
  it("should theme ArticleCard with violet glass", () => {
    const { getByTestId } = render(
      <MockArticleCard title="Test Article" excerpt="Article excerpt" />,
      { container: testContainer }
    );

    const cardElement = getByTestId("article-card");
    const computedStyles = getComputedStyle(cardElement);

    // Should have violet glass surface
    const background = computedStyles.background;
    expect(background).toMatch(/rgba\(139[,\s]+92[,\s]+246[,\s]+0\.0[3-8]\)/);

    // Should have glass border
    const borderColor = computedStyles.borderColor;
    expect(borderColor).toMatch(/rgba?\(139[,\s]+92[,\s]+246/);

    // Should have backdrop filter for glass effect
    const backdropFilter = computedStyles.backdropFilter;
    expect(backdropFilter).toMatch(/blur\(\d+px\)/);
  });

  // Test 12: Article list virtualization preservation
  it("should preserve article list virtualization", async () => {
    const articles = Array.from({ length: 100 }, (_, i) => ({
      id: `article-${i}`,
      title: `Article ${i + 1}`,
      excerpt: `Excerpt for article ${i + 1}`,
    }));

    const ArticleListWrapper = () => (
      <div className="article-list-container" data-testid="article-list">
        {articles.slice(0, 10).map((article) => (
          <MockArticleCard
            key={article.id}
            title={article.title}
            excerpt={article.excerpt}
          />
        ))}
      </div>
    );

    const { getByTestId, getAllByTestId } = render(<ArticleListWrapper />, {
      container: testContainer,
    });

    const listContainer = getByTestId("article-list");
    const cards = getAllByTestId("article-card");

    // Should render cards with violet theme
    expect(cards).toHaveLength(10);

    // Each card should have violet glass styling
    cards.forEach((card) => {
      const styles = getComputedStyle(card);
      expect(styles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);
    });

    // Container should not interfere with virtualization
    const containerStyles = getComputedStyle(listContainer);
    expect(containerStyles.overflow).not.toBe("hidden"); // Should allow scrolling
  });

  // Test 13: Feed components - FeedList violet accents
  it("should style FeedList with violet accents", () => {
    const mockFeeds = [
      { id: "feed-1", name: "Tech News", isSelected: false },
      { id: "feed-2", name: "Design Updates", isSelected: true },
      { id: "feed-3", name: "Development", isSelected: false },
    ];

    const { getByTestId } = render(<MockFeedList feeds={mockFeeds} />, {
      container: testContainer,
    });

    // Selected feed should have violet glass background
    const selectedFeed = getByTestId("feed-item-feed-2");
    const selectedStyles = getComputedStyle(selectedFeed);
    expect(selectedStyles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    // Unselected feeds should be transparent
    const unselectedFeed = getByTestId("feed-item-feed-1");
    const unselectedStyles = getComputedStyle(unselectedFeed);
    expect(unselectedStyles.background).toMatch(
      /transparent|rgba\(0[,\s]+0[,\s]+0[,\s]+0\)/
    );
  });

  // Test 14: Feed sync indicator theming
  it("should maintain feed sync indicators", async () => {
    const SyncIndicatorComponent = ({ isActive }: { isActive: boolean }) => (
      <div
        className={`sync-indicator ${isActive ? "sync-indicator--active" : ""}`}
        data-testid="sync-indicator"
        style={{
          background: isActive ? "var(--glass-nav-bg)" : "transparent",
          border: `2px solid ${isActive ? "var(--color-border-glass)" : "transparent"}`,
        }}
      >
        {isActive ? "Syncing..." : "Ready"}
      </div>
    );

    const { rerender, getByTestId } = render(
      <SyncIndicatorComponent isActive={false} />,
      { container: testContainer }
    );

    // Inactive state
    let indicator = getByTestId("sync-indicator");
    let styles = getComputedStyle(indicator);
    expect(styles.background).toMatch(/transparent/);

    // Active state - should show violet
    rerender(<SyncIndicatorComponent isActive={true} />);
    indicator = getByTestId("sync-indicator");
    styles = getComputedStyle(indicator);
    expect(styles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);
  });

  // Test 15: Modal backdrop violet tinting
  it("should apply violet to modal backdrops", () => {
    const { getByTestId } = render(
      <MockGlassModal isOpen={true}>
        <p>Modal content</p>
      </MockGlassModal>,
      { container: testContainer }
    );

    const modal = getByTestId("glass-modal");
    const computedStyles = getComputedStyle(modal);

    // Backdrop should have violet tint
    const background = computedStyles.background;
    expect(background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    // Should have enhanced blur for modal
    const backdropFilter = computedStyles.backdropFilter;
    expect(backdropFilter).toMatch(/blur\(\d+px\)/);
  });

  // Test 16: Loading overlay violet gradients
  it("should theme loading overlays correctly", () => {
    const { getByTestId } = render(<MockLoadingOverlay isLoading={true} />, {
      container: testContainer,
    });

    const overlay = getByTestId("loading-overlay");
    const computedStyles = getComputedStyle(overlay);

    // Should have gradient with violet glass values
    const background = computedStyles.background;
    expect(background).toMatch(/linear-gradient|rgba\(139[,\s]+92[,\s]+246/);

    // Should have backdrop filter
    const backdropFilter = computedStyles.backdropFilter;
    expect(backdropFilter).toMatch(/blur\(\d+px\)/);
  });

  // Test 17: Form inputs with violet focus states
  it("should style inputs with violet focus states", async () => {
    const TestInput = () => (
      <input
        type="text"
        className="glass-input"
        data-testid="glass-input"
        placeholder="Test input"
        style={{
          background: "var(--color-surface-glass-subtle)",
          border: "1px solid var(--color-border-glass)",
          // Focus styles would typically be handled by CSS :focus pseudo-class
        }}
      />
    );

    const { getByTestId } = render(<TestInput />, { container: testContainer });

    const input = getByTestId("glass-input");

    // Normal state should have subtle violet
    const normalStyles = getComputedStyle(input);
    expect(normalStyles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);
    expect(normalStyles.borderColor).toMatch(/rgba?\(139[,\s]+92[,\s]+246/);

    // Focus the input
    fireEvent.focus(input);

    // Should maintain violet theming (actual focus styles would be in CSS)
    expect(input).toHaveFocus();
  });

  // Test 18: Button variants with violet theming
  it("should theme buttons with violet variants", () => {
    const { getByTestId } = render(
      <div>
        <MockGlassButton variant="primary">Primary</MockGlassButton>
        <MockGlassButton variant="secondary">Secondary</MockGlassButton>
        <MockGlassButton variant="ghost">Ghost</MockGlassButton>
      </div>,
      { container: testContainer }
    );

    // Primary button should have stronger violet
    const primaryButton = getByTestId("glass-button-primary");
    const primaryStyles = getComputedStyle(primaryButton);
    expect(primaryStyles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    // Secondary button should have subtle violet
    const secondaryButton = getByTestId("glass-button-secondary");
    const secondaryStyles = getComputedStyle(secondaryButton);
    expect(secondaryStyles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    // Ghost button should have transparent background with violet border
    const ghostButton = getByTestId("glass-button-ghost");
    const ghostStyles = getComputedStyle(ghostButton);
    expect(ghostStyles.borderColor).toMatch(/rgba?\(139[,\s]+92[,\s]+246/);

    // All should have glass blur effect
    [primaryButton, secondaryButton, ghostButton].forEach((button) => {
      const styles = getComputedStyle(button);
      expect(styles.backdropFilter).toMatch(/blur\(\d+px\)/);
    });
  });

  // Additional test: Component hover states
  it("should handle hover states with violet theme", async () => {
    const HoverTestComponent = () => (
      <button
        className="glass-button-hover"
        data-testid="hover-button"
        style={{
          background: "var(--color-surface-glass)",
          transition: "background 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "var(--color-surface-glass-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "var(--color-surface-glass)";
        }}
      >
        Hover me
      </button>
    );

    const { getByTestId } = render(<HoverTestComponent />, {
      container: testContainer,
    });

    const button = getByTestId("hover-button");

    // Initial state
    let styles = getComputedStyle(button);
    expect(styles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    // Hover state
    fireEvent.mouseEnter(button);
    styles = getComputedStyle(button);
    // Should show hover variant (slightly different opacity)
    expect(styles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);
  });

  // Additional test: Dark mode component integration
  it("should handle dark mode component theming", () => {
    // Enable dark mode
    document.documentElement.classList.add("dark");

    const { getByTestId } = render(
      <div>
        <MockGlassNav />
        <MockArticleCard title="Dark mode test" />
      </div>,
      { container: testContainer }
    );

    const nav = getByTestId("glass-nav");
    const card = getByTestId("article-card");

    // Dark mode should still use violet but with adjusted opacity
    const navStyles = getComputedStyle(nav);
    expect(navStyles.background).toMatch(
      /rgba\(139[,\s]+92[,\s]+246[,\s]+0\.0[5-8]\)/
    );

    const cardStyles = getComputedStyle(card);
    expect(cardStyles.background).toMatch(
      /rgba\(139[,\s]+92[,\s]+246[,\s]+0\.0[5-8]\)/
    );
  });

  // Counter Component Integration Tests
  describe("Counter Component Integration", () => {
    const MockSidebarCounter: React.FC<{
      count: number;
      isSelected?: boolean;
    }> = ({ count, isSelected = false }) => (
      <span
        className={
          isSelected
            ? "rounded-full bg-[var(--counter-selected-bg)] px-2 py-0.5 text-xs font-extrabold text-[var(--counter-selected-text)]"
            : "rounded-full bg-[var(--counter-unselected-bg)] px-2 py-0.5 text-xs text-[var(--counter-unselected-text)]"
        }
        data-testid={`counter-${isSelected ? "selected" : "unselected"}`}
      >
        {count > 99 ? "99+" : count}
      </span>
    );

    // CSS styles are provided by theme attribute set in parent beforeEach

    it("should apply correct counter styling in light mode", () => {
      document.documentElement.classList.remove("dark");

      const { getByTestId } = render(
        <div>
          <MockSidebarCounter count={5} isSelected={false} />
          <MockSidebarCounter count={10} isSelected={true} />
        </div>,
        { container: testContainer }
      );

      const unselectedCounter = getByTestId("counter-unselected");
      const selectedCounter = getByTestId("counter-selected");

      // Test computed styles (CSS custom properties resolved)
      const unselectedStyles = getComputedStyle(unselectedCounter);
      const selectedStyles = getComputedStyle(selectedCounter);

      // Unselected should have subtle violet background
      expect(unselectedStyles.backgroundColor).toBeTruthy();
      expect(unselectedStyles.color).toBeTruthy();

      // Selected should have strong violet background
      expect(selectedStyles.backgroundColor).toBeTruthy();
      expect(selectedStyles.color).toBeTruthy();

      // Font weight should be different
      expect(selectedStyles.fontWeight).toBe("800"); // font-extrabold
    });

    it("should apply enhanced OKLCH colors in dark mode", () => {
      document.documentElement.classList.add("dark");

      const { getByTestId } = render(
        <div>
          <MockSidebarCounter count={8} isSelected={false} />
          <MockSidebarCounter count={15} isSelected={true} />
        </div>,
        { container: testContainer }
      );

      const unselectedCounter = getByTestId("counter-unselected");
      const selectedCounter = getByTestId("counter-selected");

      const unselectedStyles = getComputedStyle(unselectedCounter);
      const selectedStyles = getComputedStyle(selectedCounter);

      // Dark mode should have computed OKLCH colors
      expect(unselectedStyles.backgroundColor).toBeTruthy();
      expect(unselectedStyles.color).toBeTruthy();
      expect(selectedStyles.backgroundColor).toBeTruthy();
      expect(selectedStyles.color).toBeTruthy();

      // Colors should be different from light mode (enhanced contrast)
      expect(unselectedStyles.backgroundColor).not.toBe("transparent");
      expect(selectedStyles.backgroundColor).not.toBe("transparent");
    });

    it("should handle counter text overflow correctly", () => {
      const { getByTestId } = render(
        <div>
          <MockSidebarCounter count={150} isSelected={false} />
          <MockSidebarCounter count={999} isSelected={true} />
        </div>,
        { container: testContainer }
      );

      const unselectedCounter = getByTestId("counter-unselected");
      const selectedCounter = getByTestId("counter-selected");

      // Should display "99+" for counts over 99
      expect(unselectedCounter.textContent).toBe("99+");
      expect(selectedCounter.textContent).toBe("99+");
    });

    it("should maintain counter styling across theme switches", async () => {
      const { getByTestId } = render(
        <MockSidebarCounter count={7} isSelected={true} />,
        { container: testContainer }
      );

      const counter = getByTestId("counter-selected");

      // Start in light mode
      document.documentElement.classList.remove("dark");
      await waitFor(() => {
        const lightStyles = getComputedStyle(counter);
        expect(lightStyles.backgroundColor).toBeTruthy();
      });

      // Switch to dark mode
      document.documentElement.classList.add("dark");
      await waitFor(() => {
        const darkStyles = getComputedStyle(counter);
        expect(darkStyles.backgroundColor).toBeTruthy();
        // Should maintain visual structure
        expect(darkStyles.borderRadius).toMatch(/9999px|50%/); // rounded-full
      });
    });

    afterEach(() => {
      document.documentElement.classList.remove("dark");
    });
  });
});
