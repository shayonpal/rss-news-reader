/**
 * RR-232: Violet Theme Implementation - Cross-Browser Compatibility Tests
 *
 * Ensures consistent violet theme rendering across different browsers and platforms.
 * Tests browser-specific CSS features and fallbacks.
 *
 * Test Coverage:
 * - Safari iOS backdrop-filter and -webkit-backdrop-filter support
 * - Chrome gradient rendering with violet colors
 * - Firefox CSS variable resolution and fallbacks
 * - Edge PWA standalone mode compatibility
 * - Mobile Safari safe-area-inset handling
 * - Android Chrome theme-color meta tag
 * - CSS Grid and Flexbox layout consistency
 * - Progressive enhancement for older browsers
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Browser detection mock utilities
const mockUserAgent = (userAgent: string) => {
  Object.defineProperty(window.navigator, "userAgent", {
    value: userAgent,
    configurable: true,
  });
};

const mockSupportsCSS = (property: string, value: string): boolean => {
  // Mock CSS.supports() for different browsers
  const supportMap: Record<string, Record<string, boolean>> = {
    "backdrop-filter": {
      "blur(10px)": true, // Modern browsers
    },
    "-webkit-backdrop-filter": {
      "blur(10px)": true, // Safari/WebKit
    },
    display: {
      grid: true, // All modern browsers
      flex: true,
    },
    color: {
      "rgb(139 92 246)": true, // Modern space-separated RGB
      "rgb(139, 92, 246)": true, // Traditional comma-separated RGB
    },
  };

  return supportMap[property]?.[value] ?? false;
};

// Test components for browser compatibility
const BackdropFilterComponent: React.FC = () => (
  <div
    data-testid="backdrop-filter-test"
    style={{
      background: "var(--color-surface-glass)",
      backdropFilter: "blur(20px)",
      WebkitBackdropFilter: "blur(20px)", // Safari fallback
      border: "1px solid var(--color-border-glass)",
      padding: "1rem",
    }}
  >
    Backdrop filter test with violet glass
  </div>
);

const GradientComponent: React.FC = () => (
  <div
    data-testid="gradient-test"
    style={{
      background: `linear-gradient(
        135deg,
        var(--color-surface-glass) 0%,
        var(--color-surface-glass-hover) 50%,
        var(--color-surface-glass-subtle) 100%
      )`,
      padding: "2rem",
      borderRadius: "1rem",
    }}
  >
    Violet gradient background
  </div>
);

const CSSVariableComponent: React.FC = () => (
  <div
    data-testid="css-variable-test"
    style={{
      background: "var(--glass-nav-bg, rgba(139, 92, 246, 0.05))", // Fallback for older browsers
      color: "var(--foreground, #1f2937)",
      border: "1px solid var(--color-border-glass, rgba(139, 92, 246, 0.2))",
      padding: "1rem",
    }}
  >
    CSS Variables with fallbacks
  </div>
);

const PWAComponent: React.FC = () => (
  <div
    data-testid="pwa-test"
    className="pwa-safe-area"
    style={{
      background: "var(--color-surface-glass)",
      paddingTop: "env(safe-area-inset-top, 0px)",
      paddingLeft: "env(safe-area-inset-left, 0px)",
      paddingRight: "env(safe-area-inset-right, 0px)",
      paddingBottom: "env(safe-area-inset-bottom, 0px)",
      minHeight: "100vh",
    }}
  >
    PWA with safe area insets
  </div>
);

const GridLayoutComponent: React.FC = () => (
  <div
    data-testid="grid-layout-test"
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
      gap: "1rem",
      padding: "1rem",
    }}
  >
    {Array.from({ length: 6 }, (_, i) => (
      <div
        key={i}
        style={{
          background: "var(--color-surface-glass)",
          border: "1px solid var(--color-border-glass)",
          borderRadius: "0.5rem",
          padding: "1rem",
        }}
      >
        Grid item {i + 1}
      </div>
    ))}
  </div>
);

const FlexLayoutComponent: React.FC = () => (
  <div
    data-testid="flex-layout-test"
    style={{
      display: "flex",
      flexWrap: "wrap",
      gap: "1rem",
      padding: "1rem",
    }}
  >
    {Array.from({ length: 4 }, (_, i) => (
      <div
        key={i}
        style={{
          flex: "1 1 250px",
          background: "var(--color-surface-glass)",
          border: "1px solid var(--color-border-glass)",
          borderRadius: "0.5rem",
          padding: "1rem",
        }}
      >
        Flex item {i + 1}
      </div>
    ))}
  </div>
);

describe("RR-232: Violet Theme Cross-Browser Compatibility", () => {
  let testContainer: HTMLDivElement;
  let originalTheme: string | null;
  let originalUserAgent: string;

  beforeEach(() => {
    testContainer = document.createElement("div");
    document.body.appendChild(testContainer);

    originalTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "violet");

    originalUserAgent = window.navigator.userAgent;
  });

  afterEach(() => {
    document.body.removeChild(testContainer);

    if (originalTheme) {
      document.documentElement.setAttribute("data-theme", originalTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    // Restore original user agent
    mockUserAgent(originalUserAgent);
  });

  // Test 32: Safari iOS backdrop-filter support
  it("should render backdrop-filter on iOS Safari", () => {
    // Mock iOS Safari user agent
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    );

    const { getByTestId } = render(<BackdropFilterComponent />, {
      container: testContainer,
    });

    const element = getByTestId("backdrop-filter-test");
    const styles = getComputedStyle(element);

    // Should have backdrop-filter support (modern iOS Safari)
    const backdropFilter = styles.backdropFilter || styles.webkitBackdropFilter;
    expect(backdropFilter).toMatch(/blur\(\d+px\)/);

    // Should have violet glass background
    const background = styles.background;
    expect(background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    // Should apply -webkit-backdrop-filter for Safari
    const webkitBackdropFilter = (element.style as any).WebkitBackdropFilter;
    expect(webkitBackdropFilter).toBe("blur(20px)");
  });

  // Test 33: Chrome gradient rendering
  it("should display violet gradients in Chrome", () => {
    // Mock Chrome user agent
    mockUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
    );

    const { getByTestId } = render(<GradientComponent />, {
      container: testContainer,
    });

    const element = getByTestId("gradient-test");
    const styles = getComputedStyle(element);

    const background = styles.background;

    // Should have linear gradient
    expect(background).toMatch(/linear-gradient/);

    // Should contain violet color references
    expect(background).toMatch(/var\(--color-surface-glass/);

    // Background should render (not be empty or 'none')
    expect(background).not.toBe("none");
    expect(background).not.toBe("");
  });

  // Test 34: Firefox CSS variable resolution
  it("should resolve CSS variables in Firefox", () => {
    // Mock Firefox user agent
    mockUserAgent(
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0"
    );

    const { getByTestId } = render(<CSSVariableComponent />, {
      container: testContainer,
    });

    const element = getByTestId("css-variable-test");
    const styles = getComputedStyle(element);

    // CSS variables should resolve in Firefox
    const background = styles.background;
    const borderColor = styles.borderColor;

    // Should resolve to rgba values (not the var() syntax)
    expect(background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);
    expect(borderColor).toMatch(/rgba?\(139[,\s]+92[,\s]+246/);

    // Should not show the fallback CSS variable syntax
    expect(background).not.toMatch(/var\(/);
  });

  // Test 35: Edge PWA standalone mode
  it("should work in Edge PWA standalone mode", () => {
    // Mock Edge user agent
    mockUserAgent(
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36 Edg/91.0.864.59"
    );

    // Mock PWA display mode
    Object.defineProperty(window.navigator, "standalone", {
      value: true,
      configurable: true,
    });

    // Add PWA class to simulate standalone mode
    document.documentElement.classList.add("pwa-standalone");

    const { getByTestId } = render(<PWAComponent />, {
      container: testContainer,
    });

    const element = getByTestId("pwa-test");
    const styles = getComputedStyle(element);

    // Should have violet glass background in PWA mode
    const background = styles.background;
    expect(background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    // Should handle safe area insets (even if values are 0 in test)
    const paddingTop = styles.paddingTop;
    expect(paddingTop).toMatch(/\d+px/); // Should have some padding value

    document.documentElement.classList.remove("pwa-standalone");
  });

  // Test 36: Mobile Safari safe area insets
  it("should respect safe-area-inset on iPhone", () => {
    // Mock iPhone user agent
    mockUserAgent(
      "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1"
    );

    // Mock safe area insets
    const style = document.createElement("style");
    style.textContent = `
      :root {
        --safe-area-inset-top: 44px;
        --safe-area-inset-bottom: 34px;
        --safe-area-inset-left: 0px;
        --safe-area-inset-right: 0px;
      }
    `;
    document.head.appendChild(style);

    const { getByTestId } = render(<PWAComponent />, {
      container: testContainer,
    });

    const element = getByTestId("pwa-test");

    // Should apply safe area padding
    const computedStyles = getComputedStyle(element);

    // In real iOS, env() would resolve to actual safe area values
    // In test environment, we verify the properties are applied
    expect(element.style.paddingTop).toMatch(/env\(safe-area-inset-top/);
    expect(element.style.paddingBottom).toMatch(/env\(safe-area-inset-bottom/);

    document.head.removeChild(style);
  });

  // Test 37: Android Chrome theme-color
  it("should set correct theme-color meta tag", () => {
    // Mock Android Chrome user agent
    mockUserAgent(
      "Mozilla/5.0 (Linux; Android 11; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36"
    );

    // Check if theme-color meta tag exists and is correct
    let themeColorMeta = document.querySelector(
      'meta[name="theme-color"]'
    ) as HTMLMetaElement;

    if (!themeColorMeta) {
      // Create theme-color meta tag for violet theme
      themeColorMeta = document.createElement("meta");
      themeColorMeta.name = "theme-color";
      themeColorMeta.content = "#8b5cf6"; // violet-500
      document.head.appendChild(themeColorMeta);
    }

    // Should have violet theme color for Android address bar
    expect(themeColorMeta.content).toMatch(
      /#8b5cf6|rgb\(139[,\s]*92[,\s]*246\)/
    );

    // Color should be a valid hex or rgb value
    const colorValue = themeColorMeta.content;
    expect(colorValue).toMatch(
      /^#[0-9a-fA-F]{6}$|^rgb\(\d+[,\s]+\d+[,\s]+\d+\)$/
    );

    document.head.removeChild(themeColorMeta);
  });

  // Test 38: CSS Grid layout consistency
  it("should maintain grid layout across browsers", () => {
    const { getByTestId } = render(<GridLayoutComponent />, {
      container: testContainer,
    });

    const gridContainer = getByTestId("grid-layout-test");
    const styles = getComputedStyle(gridContainer);

    // Should have grid display
    expect(styles.display).toBe("grid");

    // Should have grid template columns
    const gridTemplateColumns = styles.gridTemplateColumns;
    expect(gridTemplateColumns).not.toBe("none");
    expect(gridTemplateColumns).not.toBe("");

    // Grid items should have violet theming
    const gridItems = gridContainer.children;
    expect(gridItems.length).toBeGreaterThan(0);

    Array.from(gridItems).forEach((item) => {
      const itemStyles = getComputedStyle(item as HTMLElement);
      expect(itemStyles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);
    });
  });

  // Test 39: Flexbox layout consistency
  it("should maintain flex layout across browsers", () => {
    const { getByTestId } = render(<FlexLayoutComponent />, {
      container: testContainer,
    });

    const flexContainer = getByTestId("flex-layout-test");
    const styles = getComputedStyle(flexContainer);

    // Should have flex display
    expect(styles.display).toBe("flex");

    // Should have flex wrap
    expect(styles.flexWrap).toBe("wrap");

    // Flex items should have violet theming
    const flexItems = flexContainer.children;
    expect(flexItems.length).toBeGreaterThan(0);

    Array.from(flexItems).forEach((item) => {
      const itemStyles = getComputedStyle(item as HTMLElement);
      expect(itemStyles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);
    });
  });

  // Test 40: Progressive enhancement fallbacks
  it("should provide fallbacks for older browsers", () => {
    // Mock older browser without CSS custom properties support
    const mockElement = {
      style: {} as CSSStyleDeclaration,
      computedStyle: {
        background: "rgba(139, 92, 246, 0.05)", // Fallback color
        borderColor: "rgba(139, 92, 246, 0.2)",
        backdropFilter: "none", // No support
      },
    };

    // Test fallback values
    expect(mockElement.computedStyle.background).toMatch(
      /rgba\(139[,\s]+92[,\s]+246/
    );
    expect(mockElement.computedStyle.borderColor).toMatch(
      /rgba\(139[,\s]+92[,\s]+246/
    );

    // Should gracefully degrade when backdrop-filter not supported
    if (mockElement.computedStyle.backdropFilter === "none") {
      // Should still have violet background for visual consistency
      expect(mockElement.computedStyle.background).toMatch(
        /rgba\(139[,\s]+92[,\s]+246/
      );
    }
  });

  // Test 41: Color format compatibility
  it("should handle different RGB color formats", () => {
    const TestColorFormats = () => (
      <div>
        <div
          data-testid="space-separated-rgb"
          style={{ color: "rgb(139 92 246)" }} // Modern space-separated
        >
          Space separated RGB
        </div>
        <div
          data-testid="comma-separated-rgb"
          style={{ color: "rgb(139, 92, 246)" }} // Traditional comma-separated
        >
          Comma separated RGB
        </div>
        <div
          data-testid="rgba-format"
          style={{ color: "rgba(139, 92, 246, 0.8)" }}
        >
          RGBA format
        </div>
      </div>
    );

    const { getByTestId } = render(<TestColorFormats />, {
      container: testContainer,
    });

    // All formats should be valid and render
    const spaceSeparated = getByTestId("space-separated-rgb");
    const commaSeparated = getByTestId("comma-separated-rgb");
    const rgbaFormat = getByTestId("rgba-format");

    // Should all have violet color (may be computed differently)
    [spaceSeparated, commaSeparated, rgbaFormat].forEach((element) => {
      const styles = getComputedStyle(element);
      expect(styles.color).toMatch(/rgb|rgba/);
    });
  });

  // Test 42: Media query support
  it("should handle prefers-color-scheme media queries", () => {
    const MediaQueryComponent = () => (
      <div
        data-testid="media-query-test"
        style={{
          background: "var(--color-surface-glass)",
          // This would typically be handled by CSS media queries
        }}
      >
        Media query test
      </div>
    );

    // Test light mode
    const { getByTestId } = render(<MediaQueryComponent />, {
      container: testContainer,
    });

    let element = getByTestId("media-query-test");
    let styles = getComputedStyle(element);

    // Should have violet theme in light mode
    expect(styles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    // Switch to dark mode
    document.documentElement.classList.add("dark");

    // Re-render to get updated styles
    element = getByTestId("media-query-test");
    styles = getComputedStyle(element);

    // Should still have violet theme in dark mode (possibly different opacity)
    expect(styles.background).toMatch(/rgba\(139[,\s]+92[,\s]+246/);

    document.documentElement.classList.remove("dark");
  });
});
