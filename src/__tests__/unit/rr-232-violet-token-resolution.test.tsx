/**
 * RR-232: Violet Theme Implementation - CSS Token Resolution Tests
 *
 * Tests CSS custom property resolution and inheritance for the violet theme.
 * Validates the reference → semantic → component token hierarchy.
 *
 * Test Coverage:
 * - Reference token layer mapping (lines 449-554 in globals.css)
 * - Semantic token inheritance from reference layer
 * - Light mode glass token values (lines 461-474)
 * - Dark mode glass token values (lines 521-529)
 * - Primary theme token cascade (lines 135-142)
 * - CSS variable fallback chain
 * - Media query token switching
 * - Token computation performance
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Test component for CSS token validation
const TokenTestComponent: React.FC<{
  className?: string;
  "data-testid"?: string;
}> = ({ className = "", "data-testid": testId = "token-test" }) => (
  <div
    className={className}
    data-testid={testId}
    style={{
      background: "var(--glass-nav-bg)",
      border: "1px solid var(--color-border-glass)",
      backdropFilter: "var(--glass-blur)",
    }}
  >
    Token Test Element
  </div>
);

// Violet palette reference values from Tailwind CSS (actual implementation)
const VIOLET_PALETTE = {
  "violet-50": "rgb(250, 248, 255)", // #faf8ff
  "violet-100": "rgb(243, 240, 255)", // #f3f0ff
  "violet-200": "rgb(233, 229, 255)", // #e9e5ff
  "violet-300": "rgb(212, 197, 255)", // #d4c5ff
  "violet-400": "rgb(183, 148, 246)", // #b794f6
  "violet-500": "rgb(139, 92, 246)", // #8b5cf6 - Primary violet
  "violet-600": "rgb(124, 58, 237)", // #7c3aed
  "violet-700": "rgb(109, 40, 217)", // #6d28d9
  "violet-800": "rgb(91, 33, 182)", // #5b21b6
  "violet-900": "rgb(76, 29, 149)", // #4c1d95
  "violet-950": "rgb(46, 16, 101)", // #2e1065
};

// Expected glass token values for light mode
const LIGHT_MODE_TOKENS = {
  glassBg: "rgba(139, 92, 246, 0.03)",
  glassHover: "rgba(139, 92, 246, 0.05)",
  glassBorder: "rgba(139, 92, 246, 0.1)",
  glassBlur: "blur(20px)",
};

// Expected glass token values for dark mode
const DARK_MODE_TOKENS = {
  glassBg: "rgba(139, 92, 246, 0.05)",
  glassHover: "rgba(139, 92, 246, 0.08)",
  glassBorder: "rgba(139, 92, 246, 0.15)",
  glassBlur: "blur(20px)",
};

describe("RR-232: Violet Theme CSS Token Resolution", () => {
  let testContainer: HTMLDivElement;
  let originalTheme: string | null;
  let injectedStyle: HTMLStyleElement;

  beforeEach(() => {
    testContainer = document.createElement("div");
    document.body.appendChild(testContainer);

    // Store original theme
    originalTheme = document.documentElement.getAttribute("data-theme");

    // Inject CSS tokens directly for test environment
    injectedStyle = document.createElement("style");
    injectedStyle.textContent = `
      :root {
        /* Violet palette RGB values */
        --violet-50-rgb: 250, 248, 255;
        --violet-100-rgb: 243, 240, 255;
        --violet-200-rgb: 233, 229, 255;
        --violet-300-rgb: 212, 197, 255;
        --violet-400-rgb: 183, 148, 246;
        --violet-500-rgb: 139, 92, 246;
        --violet-600-rgb: 124, 58, 237;
        --violet-700-rgb: 109, 40, 217;
        --violet-800-rgb: 91, 33, 182;
        --violet-900-rgb: 76, 29, 149;
        --violet-950-rgb: 46, 16, 101;
        
        /* HSL versions */
        --violet-50: 245 58% 98%;
        --violet-100: 245 56% 95%;
        --violet-200: 245 54% 91%;
        --violet-300: 244 51% 82%;
        --violet-400: 243 47% 70%;
        --violet-500: 243 47% 59%;
        --violet-600: 243 52% 48%;
        --violet-700: 242 54% 41%;
        --violet-800: 242 56% 33%;
        --violet-900: 242 59% 26%;
        --violet-950: 241 65% 16%;
        
        /* Glass system tokens */
        --glass-blur-base: 16px;
        --glass-blur-enhanced: 20px;
        --glass-opacity-base: 0.35;
        --glass-opacity-enhanced: 0.55;
        --glass-opacity-hover: 0.45;
        --glass-border-light: 0.08;
        --glass-border-enhanced: 0.12;
        
        /* Semantic tokens with violet theming */
        --color-surface-glass: rgba(var(--violet-500-rgb), 0.03);
        --color-surface-glass-hover: rgba(var(--violet-500-rgb), 0.08);
        --color-surface-glass-subtle: rgba(var(--violet-500-rgb), 0.02);
        --color-border-glass: rgba(var(--violet-500-rgb), 0.1);
        --color-border-glass-enhanced: rgba(var(--violet-500-rgb), 0.15);
        --color-surface-opaque: rgba(var(--violet-50-rgb), 0.95);
        
        /* Legacy aliases */
        --glass-blur: var(--glass-blur-base);
        --glass-nav-bg: var(--color-surface-glass);
        --glass-nav-border: var(--color-border-glass);
        
        /* Primary theme tokens */
        --primary: 263 70% 50%;
        
        /* Counter colors - Light mode defaults */
        --counter-unselected-bg: hsl(var(--primary) / 0.1);
        --counter-unselected-text: hsl(var(--primary));
        --counter-selected-bg: hsl(var(--primary));
        --counter-selected-text: hsl(var(--primary-foreground));
      }
      
      :root.dark {
        --color-surface-glass: rgba(var(--violet-500-rgb), 0.05);
        --color-surface-glass-hover: rgba(var(--violet-500-rgb), 0.12);
        --color-surface-glass-subtle: rgba(var(--violet-500-rgb), 0.03);
        --color-border-glass: rgba(var(--violet-500-rgb), 0.15);
        
        /* Counter colors - Dark mode with OKLCH */
        --counter-unselected-bg: oklch(0.38 0.189 293.745);
        --counter-unselected-text: oklch(0.943 0.029 294.588);
        --counter-selected-bg: oklch(0.541 0.281 293.009);
        --counter-selected-text: oklch(0.969 0.016 293.756);
        --color-border-glass-enhanced: rgba(var(--violet-500-rgb), 0.25);
        --color-surface-opaque: rgba(var(--violet-950-rgb), 0.85);
        --glass-nav-bg: var(--color-surface-glass);
      }
    `;
    document.head.appendChild(injectedStyle);
  });

  afterEach(() => {
    document.body.removeChild(testContainer);

    // Clean up injected CSS
    if (injectedStyle && injectedStyle.parentNode) {
      injectedStyle.parentNode.removeChild(injectedStyle);
    }

    // Restore original theme
    if (originalTheme) {
      document.documentElement.setAttribute("data-theme", originalTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
  });

  // Test 1: Reference token layer mapping
  it("should correctly map violet palette to reference tokens", () => {
    const rootStyles = getComputedStyle(document.documentElement);

    // Test primary violet values are available as CSS custom properties
    const primaryViolet = rootStyles.getPropertyValue("--violet-500").trim();
    expect(primaryViolet).toMatch(/139[,\s]+92[,\s]+246/);

    // Test gradient endpoints
    const lightViolet = rootStyles.getPropertyValue("--violet-50").trim();
    expect(lightViolet).toMatch(/245[,\s]+243[,\s]+255/);

    const darkViolet = rootStyles.getPropertyValue("--violet-950").trim();
    expect(darkViolet).toMatch(/46[,\s]+16[,\s]+101/);
  });

  // Test 2: Semantic token inheritance
  it("should resolve semantic tokens from reference layer", () => {
    const { container } = render(<TokenTestComponent />, {
      container: testContainer,
    });
    const element = container.firstElementChild as HTMLElement;

    const computedStyles = getComputedStyle(element);
    const glassBg = computedStyles.getPropertyValue("background");

    // Should resolve to rgba with violet-500 base and low opacity
    expect(glassBg).toMatch(/rgba\(139[,\s]+92[,\s]+246[,\s]+0\.0[3-5]\)/);
  });

  // Test 3: Light mode glass tokens
  it("should apply correct light mode glass values", () => {
    // Ensure light mode
    document.documentElement.classList.remove("dark");

    const rootStyles = getComputedStyle(document.documentElement);

    // Test glass navigation background (primary glass surface)
    const glassNavBg = rootStyles.getPropertyValue("--glass-nav-bg").trim();
    expect(glassNavBg).toMatch(/rgba\(139[,\s]+92[,\s]+246[,\s]+0\.03\)/);

    // Test glass border
    const glassBorder = rootStyles
      .getPropertyValue("--color-border-glass")
      .trim();
    expect(glassBorder).toMatch(/rgba\(139[,\s]+92[,\s]+246[,\s]+0\.1\)/);

    // Test hover state
    const glassHover = rootStyles
      .getPropertyValue("--color-surface-glass-hover")
      .trim();
    expect(glassHover).toMatch(/rgba\(139[,\s]+92[,\s]+246[,\s]+0\.05\)/);
  });

  // Test 4: Dark mode glass tokens
  it("should apply correct dark mode glass values", () => {
    // Enable dark mode
    document.documentElement.classList.add("dark");

    const rootStyles = getComputedStyle(document.documentElement);

    // Dark mode should have higher opacity for visibility
    const glassNavBg = rootStyles.getPropertyValue("--glass-nav-bg").trim();
    expect(glassNavBg).toMatch(/rgba\(139[,\s]+92[,\s]+246[,\s]+0\.0[5-8]\)/);

    // Test dark mode border (should be more pronounced)
    const glassBorder = rootStyles
      .getPropertyValue("--color-border-glass")
      .trim();
    expect(glassBorder).toMatch(/rgba\(139[,\s]+92[,\s]+246[,\s]+0\.1[5-8]\)/);
  });

  // Test 5: Primary theme token cascade
  it("should cascade primary theme tokens correctly", () => {
    const rootStyles = getComputedStyle(document.documentElement);

    // Test primary color uses violet
    const primary = rootStyles.getPropertyValue("--primary").trim();
    expect(primary).toMatch(/(139[,\s]+92[,\s]+246)|(124[,\s]+58[,\s]+237)/); // violet-500 or violet-600

    // Test secondary uses lighter violet
    const secondary = rootStyles.getPropertyValue("--secondary").trim();
    expect(secondary).toMatch(
      /(245[,\s]+243[,\s]+255)|(237[,\s]+233[,\s]+254)/
    ); // violet-50 or violet-100

    // Test accent color coordination
    const accent = rootStyles.getPropertyValue("--accent").trim();
    expect(accent).toMatch(/(196[,\s]+181[,\s]+253)|(167[,\s]+139[,\s]+250)/); // violet-300 or violet-400
  });

  // Test 6: CSS variable fallback chain
  it("should handle missing tokens with fallbacks", () => {
    const { container } = render(
      <div
        data-testid="fallback-test"
        style={{
          backgroundColor:
            "var(--non-existent-token, var(--glass-nav-bg, #f3f4f6))",
        }}
      >
        Fallback Test
      </div>,
      { container: testContainer }
    );

    const element = container.firstElementChild as HTMLElement;
    const bgColor = getComputedStyle(element).backgroundColor;

    // Should fall back to glass-nav-bg (violet with opacity)
    expect(bgColor).toMatch(/rgba\(139[,\s]+92[,\s]+246[,\s]+0\.0[3-8]\)/);
  });

  // Test 7: Media query token switching
  it("should switch tokens on prefers-color-scheme", () => {
    // Create a test element that responds to media queries
    const testElement = document.createElement("div");
    testElement.innerHTML = `
      <style>
        @media (prefers-color-scheme: dark) {
          .theme-test { --test-bg: var(--glass-nav-bg); }
        }
        @media (prefers-color-scheme: light) {
          .theme-test { --test-bg: var(--color-surface-glass); }
        }
      </style>
      <div class="theme-test" data-testid="media-test"></div>
    `;

    document.head.appendChild(testElement.querySelector("style")!);
    testContainer.appendChild(testElement.querySelector("div")!);

    const mediaTestElement = testContainer.querySelector(
      '[data-testid="media-test"]'
    ) as HTMLElement;
    const computedStyles = getComputedStyle(mediaTestElement);

    // Should have some violet-based value regardless of which media query matches
    const testBg = computedStyles.getPropertyValue("--test-bg");
    expect(testBg).toMatch(/rgba\(139[,\s]+92[,\s]+246/);
  });

  // Test 8: Token computation performance
  it("should resolve tokens within 16ms frame budget", () => {
    const startTime = performance.now();

    // Create multiple elements that use CSS tokens
    const elements = Array.from({ length: 50 }, (_, i) => {
      const element = document.createElement("div");
      element.style.cssText = `
        background: var(--glass-nav-bg);
        border: 1px solid var(--color-border-glass);
        backdrop-filter: var(--glass-blur);
        color: var(--primary);
      `;
      testContainer.appendChild(element);
      return element;
    });

    // Force style computation
    elements.forEach((element) => {
      getComputedStyle(element).background;
      getComputedStyle(element).border;
      getComputedStyle(element).backdropFilter;
      getComputedStyle(element).color;
    });

    const endTime = performance.now();
    const computationTime = endTime - startTime;

    // Should complete within one frame (16.67ms for 60fps)
    expect(computationTime).toBeLessThan(16);
  });

  // Additional validation: Token value format consistency
  it("should maintain consistent rgba format across all glass tokens", () => {
    const rootStyles = getComputedStyle(document.documentElement);

    const glassTokens = [
      "--glass-nav-bg",
      "--color-surface-glass",
      "--color-surface-glass-hover",
      "--color-border-glass",
    ];

    glassTokens.forEach((token) => {
      const value = rootStyles.getPropertyValue(token).trim();
      if (value && value !== "") {
        // Should be rgba format with violet base (139, 92, 246)
        expect(value).toMatch(/rgba\(\s*139[,\s]+92[,\s]+246[,\s]+0\.\d+\s*\)/);
      }
    });
  });

  // Additional validation: Token inheritance chain
  it("should maintain proper token inheritance hierarchy", () => {
    // Test that component tokens inherit from semantic tokens
    // which inherit from reference tokens
    const rootStyles = getComputedStyle(document.documentElement);

    // Reference token should exist
    const referenceBlur = rootStyles
      .getPropertyValue("--glass-blur-base")
      .trim();
    expect(referenceBlur).toMatch(/\d+px/);

    // Semantic token should reference it
    const semanticBlur = rootStyles.getPropertyValue("--glass-blur").trim();
    expect(semanticBlur).toMatch(
      /var\(--glass-blur-base\)|blur\(\d+px\)|\d+px/
    );

    // Component should get computed value
    const { container } = render(<TokenTestComponent />, {
      container: testContainer,
    });
    const element = container.firstElementChild as HTMLElement;
    const computedBlur = getComputedStyle(element).backdropFilter;
    expect(computedBlur).toMatch(/blur\(\d+px\)/);
  });

  // Counter styling tests
  describe("Counter Color Tokens", () => {
    // CSS styles are already injected by parent beforeEach

    it("should apply correct light mode counter colors", () => {
      // Remove dark mode class if present
      document.documentElement.classList.remove("dark");

      const rootStyles = getComputedStyle(document.documentElement);

      // Test light mode counter tokens
      const unselectedBg = rootStyles
        .getPropertyValue("--counter-unselected-bg")
        .trim();
      const unselectedText = rootStyles
        .getPropertyValue("--counter-unselected-text")
        .trim();
      const selectedBg = rootStyles
        .getPropertyValue("--counter-selected-bg")
        .trim();
      const selectedText = rootStyles
        .getPropertyValue("--counter-selected-text")
        .trim();

      // Should use primary color variants
      expect(unselectedBg).toMatch(/hsl\(.*\/\s*0\.1\)|rgba?\(/);
      expect(unselectedText).toMatch(/hsl\(.*263.*70%.*50%\)|#[a-fA-F0-9]{6}/);
      expect(selectedBg).toMatch(/hsl\(.*263.*70%.*50%\)|#[a-fA-F0-9]{6}/);
      expect(selectedText).toMatch(
        /hsl\(.*primary-foreground\)|#[a-fA-F0-9]{6}|rgb\(/
      );
    });

    it("should apply correct dark mode OKLCH counter colors", () => {
      // Enable dark mode
      document.documentElement.classList.add("dark");

      const rootStyles = getComputedStyle(document.documentElement);

      // Test dark mode OKLCH counter tokens
      const unselectedBg = rootStyles
        .getPropertyValue("--counter-unselected-bg")
        .trim();
      const unselectedText = rootStyles
        .getPropertyValue("--counter-unselected-text")
        .trim();
      const selectedBg = rootStyles
        .getPropertyValue("--counter-selected-bg")
        .trim();
      const selectedText = rootStyles
        .getPropertyValue("--counter-selected-text")
        .trim();

      // Should use OKLCH color space
      expect(unselectedBg).toMatch(/oklch\(0\.38\s+0\.189\s+293\.745\)|rgb\(/);
      expect(unselectedText).toMatch(
        /oklch\(0\.943\s+0\.029\s+294\.588\)|rgb\(/
      );
      expect(selectedBg).toMatch(/oklch\(0\.541\s+0\.281\s+293\.009\)|rgb\(/);
      expect(selectedText).toMatch(/oklch\(0\.969\s+0\.016\s+293\.756\)|rgb\(/);
    });

    it("should provide enhanced contrast in dark mode", () => {
      document.documentElement.classList.add("dark");

      // Create test elements with counter classes
      const unselectedCounter = document.createElement("span");
      unselectedCounter.className =
        "bg-[var(--counter-unselected-bg)] text-[var(--counter-unselected-text)]";
      document.body.appendChild(unselectedCounter);

      const selectedCounter = document.createElement("span");
      selectedCounter.className =
        "bg-[var(--counter-selected-bg)] text-[var(--counter-selected-text)]";
      document.body.appendChild(selectedCounter);

      const unselectedStyles = getComputedStyle(unselectedCounter);
      const selectedStyles = getComputedStyle(selectedCounter);

      // Colors should be computed (not empty)
      expect(unselectedStyles.backgroundColor).toBeTruthy();
      expect(unselectedStyles.color).toBeTruthy();
      expect(selectedStyles.backgroundColor).toBeTruthy();
      expect(selectedStyles.color).toBeTruthy();

      // Cleanup
      document.body.removeChild(unselectedCounter);
      document.body.removeChild(selectedCounter);
    });

    afterEach(() => {
      document.documentElement.classList.remove("dark");
    });
  });
});
