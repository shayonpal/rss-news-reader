/**
 * RR-232: Violet Theme Implementation - Accessibility Tests
 *
 * Validates WCAG AA compliance with violet palette implementation.
 * Ensures the violet theme maintains accessibility standards.
 *
 * Test Coverage:
 * - Text contrast ratios (4.5:1 for normal, 3:1 for large text)
 * - Interactive element contrast requirements
 * - Visible focus indicators with violet theme
 * - Color-blind user accessibility (deuteranopia/protanopia)
 * - High contrast mode support
 * - Reduced motion preference handling
 * - Keyboard navigation with violet focus states
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

// Color contrast calculation utilities
const hexToRgb = (hex: string): [number, number, number] => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : [0, 0, 0];
};

const rgbaToRgb = (rgba: string): [number, number, number] => {
  const match = rgba.match(/rgba?\(([^)]+)\)/);
  if (!match) return [0, 0, 0];

  const values = match[1].split(",").map((v) => parseFloat(v.trim()));
  return [values[0], values[1], values[2]];
};

const getLuminance = (r: number, g: number, b: number): number => {
  const [rs, gs, bs] = [r, g, b].map((c) => {
    c = c / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
};

const getContrastRatio = (color1: string, color2: string): number => {
  const rgb1 = color1.startsWith("#") ? hexToRgb(color1) : rgbaToRgb(color1);
  const rgb2 = color2.startsWith("#") ? hexToRgb(color2) : rgbaToRgb(color2);

  const lum1 = getLuminance(rgb1[0], rgb1[1], rgb1[2]);
  const lum2 = getLuminance(rgb2[0], rgb2[1], rgb2[2]);

  const brightest = Math.max(lum1, lum2);
  const darkest = Math.min(lum1, lum2);

  return (brightest + 0.05) / (darkest + 0.05);
};

// Mock components for accessibility testing
const AccessibleTextComponent: React.FC<{
  size?: "normal" | "large";
  color?: string;
  background?: string;
  className?: string;
}> = ({
  size = "normal",
  color = "var(--foreground)",
  background = "var(--color-surface-glass)",
  className = "",
}) => (
  <div
    className={`text-component ${className}`}
    data-testid={`text-${size}`}
    style={{
      background,
      color,
      padding: "1rem",
      fontSize: size === "large" ? "1.5rem" : "1rem",
      fontWeight: size === "large" ? "400" : "400",
    }}
  >
    {size === "large"
      ? "Large Text Sample"
      : "Normal text sample with violet glass background"}
  </div>
);

const InteractiveComponent: React.FC<{
  variant?: "button" | "link" | "input";
  disabled?: boolean;
}> = ({ variant = "button", disabled = false }) => {
  const commonStyles = {
    background: "var(--color-surface-glass)",
    border: "2px solid var(--color-border-glass)",
    color: "var(--foreground)",
    padding: "0.75rem 1.5rem",
    borderRadius: "0.5rem",
    transition: "all 0.2s ease",
  };

  const focusStyles = {
    outline: "3px solid var(--primary)",
    outlineOffset: "2px",
  };

  switch (variant) {
    case "button":
      return (
        <button
          data-testid="interactive-button"
          disabled={disabled}
          style={{
            ...commonStyles,
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.6 : 1,
          }}
          onFocus={(e) => Object.assign(e.target.style, focusStyles)}
          onBlur={(e) => {
            e.target.style.outline = "";
            e.target.style.outlineOffset = "";
          }}
        >
          Interactive Button
        </button>
      );

    case "link":
      return (
        <a
          href="#"
          data-testid="interactive-link"
          style={{
            ...commonStyles,
            textDecoration: "underline",
            display: "inline-block",
          }}
          onFocus={(e) => Object.assign(e.target.style, focusStyles)}
          onBlur={(e) => {
            e.target.style.outline = "";
            e.target.style.outlineOffset = "";
          }}
        >
          Interactive Link
        </a>
      );

    case "input":
      return (
        <input
          type="text"
          data-testid="interactive-input"
          placeholder="Enter text..."
          disabled={disabled}
          style={{
            ...commonStyles,
            cursor: disabled ? "not-allowed" : "text",
            opacity: disabled ? 0.6 : 1,
          }}
          onFocus={(e) => Object.assign(e.target.style, focusStyles)}
          onBlur={(e) => {
            e.target.style.outline = "";
            e.target.style.outlineOffset = "";
          }}
        />
      );

    default:
      return null;
  }
};

const GlassCardComponent: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div
    className="glass-card"
    data-testid="glass-card"
    style={{
      background: "var(--color-surface-glass)",
      border: "1px solid var(--color-border-glass)",
      backdropFilter: "var(--glass-blur)",
      borderRadius: "0.75rem",
      padding: "1.5rem",
      color: "var(--foreground)",
    }}
  >
    {children}
  </div>
);

// Color blind simulation utilities
const simulateColorBlindness = (
  rgb: [number, number, number],
  type: "protanopia" | "deuteranopia"
): [number, number, number] => {
  const [r, g, b] = rgb.map((c) => c / 255);

  if (type === "protanopia") {
    // Protanopia (red-blind) transformation matrix
    return [
      Math.round((0.567 * r + 0.433 * g + 0 * b) * 255),
      Math.round((0.558 * r + 0.442 * g + 0 * b) * 255),
      Math.round((0 * r + 0.242 * g + 0.758 * b) * 255),
    ];
  } else {
    // Deuteranopia (green-blind) transformation matrix
    return [
      Math.round((0.625 * r + 0.375 * g + 0 * b) * 255),
      Math.round((0.7 * r + 0.3 * g + 0 * b) * 255),
      Math.round((0 * r + 0.3 * g + 0.7 * b) * 255),
    ];
  }
};

describe("RR-232: Violet Theme Accessibility Compliance", () => {
  let testContainer: HTMLDivElement;
  let originalTheme: string | null;
  let originalReducedMotion: string | null;

  beforeEach(() => {
    testContainer = document.createElement("div");
    document.body.appendChild(testContainer);

    // Set violet theme
    originalTheme = document.documentElement.getAttribute("data-theme");
    document.documentElement.setAttribute("data-theme", "violet");

    // Store original reduced motion preference
    originalReducedMotion = getComputedStyle(
      document.documentElement
    ).getPropertyValue("--reduce-motion");
  });

  afterEach(() => {
    document.body.removeChild(testContainer);

    // Restore original theme
    if (originalTheme) {
      document.documentElement.setAttribute("data-theme", originalTheme);
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    // Reset motion preferences
    document.documentElement.classList.remove("reduce-motion");
  });

  // Test 25: Text contrast on violet glass - normal text (4.5:1 ratio)
  it("should maintain 4.5:1 contrast ratio for body text", () => {
    const { getByTestId } = render(<AccessibleTextComponent size="normal" />, {
      container: testContainer,
    });

    const textElement = getByTestId("text-normal");
    const computedStyles = getComputedStyle(textElement);

    const textColor = computedStyles.color;
    const backgroundColor = computedStyles.backgroundColor;

    const contrastRatio = getContrastRatio(textColor, backgroundColor);

    expect(contrastRatio).toBeGreaterThanOrEqual(4.5);

    // Log actual values for debugging
    console.log(
      `Normal text contrast: ${contrastRatio.toFixed(2)}:1 (${textColor} on ${backgroundColor})`
    );
  });

  // Test 26: Large text contrast (3:1 ratio)
  it("should maintain 3:1 contrast for large text", () => {
    const { getByTestId } = render(<AccessibleTextComponent size="large" />, {
      container: testContainer,
    });

    const textElement = getByTestId("text-large");
    const computedStyles = getComputedStyle(textElement);

    const textColor = computedStyles.color;
    const backgroundColor = computedStyles.backgroundColor;

    const contrastRatio = getContrastRatio(textColor, backgroundColor);

    expect(contrastRatio).toBeGreaterThanOrEqual(3.0);

    console.log(
      `Large text contrast: ${contrastRatio.toFixed(2)}:1 (${textColor} on ${backgroundColor})`
    );
  });

  // Test 27: Interactive element contrast requirements
  it("should ensure buttons meet contrast requirements", () => {
    const { getByTestId } = render(
      <div>
        <InteractiveComponent variant="button" />
        <InteractiveComponent variant="link" />
        <InteractiveComponent variant="input" />
      </div>,
      { container: testContainer }
    );

    // Test button contrast
    const button = getByTestId("interactive-button");
    const buttonStyles = getComputedStyle(button);
    const buttonContrast = getContrastRatio(
      buttonStyles.color,
      buttonStyles.backgroundColor
    );
    expect(buttonContrast).toBeGreaterThanOrEqual(3.0); // Interactive elements need 3:1 minimum

    // Test link contrast
    const link = getByTestId("interactive-link");
    const linkStyles = getComputedStyle(link);
    const linkContrast = getContrastRatio(
      linkStyles.color,
      linkStyles.backgroundColor
    );
    expect(linkContrast).toBeGreaterThanOrEqual(3.0);

    // Test input contrast
    const input = getByTestId("interactive-input");
    const inputStyles = getComputedStyle(input);
    const inputContrast = getContrastRatio(
      inputStyles.color,
      inputStyles.backgroundColor
    );
    expect(inputContrast).toBeGreaterThanOrEqual(3.0);
  });

  // Test 28: Focus indicators visibility
  it("should provide visible focus indicators", async () => {
    const { getByTestId } = render(<InteractiveComponent variant="button" />, {
      container: testContainer,
    });

    const button = getByTestId("interactive-button");

    // Focus the button
    fireEvent.focus(button);

    await waitFor(() => {
      const focusedStyles = getComputedStyle(button);

      // Should have outline (focus indicator)
      const outline = focusedStyles.outline;
      const outlineWidth = focusedStyles.outlineWidth;

      // Focus indicator should be visible (minimum 1px, preferably 2px+)
      const outlineWidthValue = parseFloat(outlineWidth);
      expect(outlineWidthValue).toBeGreaterThanOrEqual(2);

      // Should not be transparent
      expect(outline).not.toMatch(/transparent|rgba\(0[,\s]+0[,\s]+0[,\s]+0\)/);
    });
  });

  // Test 29: Color-blind accessibility (Protanopia)
  it("should remain usable for protanopia (red-blind) users", () => {
    const { getByTestId } = render(
      <GlassCardComponent>
        <AccessibleTextComponent size="normal" />
        <InteractiveComponent variant="button" />
      </GlassCardComponent>,
      { container: testContainer }
    );

    const card = getByTestId("glass-card");
    const cardStyles = getComputedStyle(card);

    // Get violet background color
    const bgColor = rgbaToRgb(cardStyles.backgroundColor);
    const textColor = rgbaToRgb(cardStyles.color);

    // Simulate protanopia
    const protanopicBg = simulateColorBlindness(bgColor, "protanopia");
    const protanopicText = simulateColorBlindness(textColor, "protanopia");

    // Calculate contrast ratio for protanopic vision
    const protanopicContrast = getContrastRatio(
      `rgb(${protanopicText.join(",")})`,
      `rgb(${protanopicBg.join(",")})`
    );

    expect(protanopicContrast).toBeGreaterThanOrEqual(3.0);

    console.log(`Protanopia contrast: ${protanopicContrast.toFixed(2)}:1`);
  });

  // Test 30: Color-blind accessibility (Deuteranopia)
  it("should remain usable for deuteranopia (green-blind) users", () => {
    const { getByTestId } = render(
      <GlassCardComponent>
        <AccessibleTextComponent size="normal" />
      </GlassCardComponent>,
      { container: testContainer }
    );

    const card = getByTestId("glass-card");
    const cardStyles = getComputedStyle(card);

    const bgColor = rgbaToRgb(cardStyles.backgroundColor);
    const textColor = rgbaToRgb(cardStyles.color);

    // Simulate deuteranopia
    const deuteranopicBg = simulateColorBlindness(bgColor, "deuteranopia");
    const deuteranopicText = simulateColorBlindness(textColor, "deuteranopia");

    const deuteranopicContrast = getContrastRatio(
      `rgb(${deuteranopicText.join(",")})`,
      `rgb(${deuteranopicBg.join(",")})`
    );

    expect(deuteranopicContrast).toBeGreaterThanOrEqual(3.0);

    console.log(`Deuteranopia contrast: ${deuteranopicContrast.toFixed(2)}:1`);
  });

  // Test 31: High contrast mode support
  it("should support high contrast mode", () => {
    // Simulate high contrast mode
    const style = document.createElement("style");
    style.textContent = `
      @media (prefers-contrast: high) {
        :root {
          --color-surface-glass: rgba(0, 0, 0, 0.9) !important;
          --color-border-glass: rgb(255, 255, 255) !important;
          --foreground: rgb(255, 255, 255) !important;
        }
      }
    `;
    document.head.appendChild(style);

    const { getByTestId } = render(<AccessibleTextComponent size="normal" />, {
      container: testContainer,
    });

    const textElement = getByTestId("text-normal");
    const computedStyles = getComputedStyle(textElement);

    // In high contrast mode, should have very high contrast
    const contrastRatio = getContrastRatio(
      computedStyles.color,
      computedStyles.backgroundColor
    );

    // High contrast mode should provide much higher than minimum ratios
    expect(contrastRatio).toBeGreaterThan(7); // AAA level contrast

    document.head.removeChild(style);
  });

  // Test 32: Reduced motion preference
  it("should respect prefers-reduced-motion", () => {
    // Add reduced motion preference
    document.documentElement.classList.add("reduce-motion");

    const AnimatedComponent = () => (
      <div
        data-testid="animated-element"
        style={{
          background: "var(--color-surface-glass)",
          transition: "all 0.3s ease",
          animation: "none", // Should be disabled in reduced motion
        }}
        className="reduce-motion:animate-none"
      >
        Animated content
      </div>
    );

    const { getByTestId } = render(<AnimatedComponent />, {
      container: testContainer,
    });

    const element = getByTestId("animated-element");
    const styles = getComputedStyle(element);

    // Animations should be disabled or minimal
    expect(styles.animationDuration).toMatch(/0s|none/);

    // Transitions should be fast or disabled
    const transitionDuration = parseFloat(styles.transitionDuration || "0");
    expect(transitionDuration).toBeLessThanOrEqual(0.1); // 100ms or less
  });

  // Test 33: Keyboard navigation accessibility
  it("should support keyboard navigation with violet focus states", async () => {
    const { getByTestId } = render(
      <div>
        <InteractiveComponent variant="button" />
        <InteractiveComponent variant="input" />
        <InteractiveComponent variant="link" />
      </div>,
      { container: testContainer }
    );

    const button = getByTestId("interactive-button");
    const input = getByTestId("interactive-input");
    const link = getByTestId("interactive-link");

    // Tab through elements
    fireEvent.focus(button);
    expect(button).toHaveFocus();

    // Move to next focusable element
    fireEvent.keyDown(button, { key: "Tab" });
    fireEvent.focus(input);
    expect(input).toHaveFocus();

    // Each focused element should have visible focus indicator
    const focusedElements = [button, input, link];

    for (const element of focusedElements) {
      fireEvent.focus(element);

      await waitFor(() => {
        const styles = getComputedStyle(element);
        const outlineWidth = parseFloat(styles.outlineWidth || "0");
        expect(outlineWidth).toBeGreaterThanOrEqual(2); // Minimum 2px focus indicator
      });
    }
  });

  // Test 34: Screen reader compatibility
  it("should provide appropriate ARIA labels and roles", () => {
    const AccessibleCard = () => (
      <div
        role="article"
        aria-label="Glass card with violet theme"
        data-testid="accessible-card"
        style={{
          background: "var(--color-surface-glass)",
        }}
      >
        <h2>Card Title</h2>
        <p>Card content with violet glass background</p>
        <button aria-label="Action button with violet theme">Action</button>
      </div>
    );

    const { getByTestId, getByRole } = render(<AccessibleCard />, {
      container: testContainer,
    });

    // Should have proper semantic structure
    const article = getByRole("article");
    expect(article).toBeInTheDocument();

    const button = getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute("aria-label");

    // Card should have accessible name
    const card = getByTestId("accessible-card");
    expect(card).toHaveAttribute("aria-label");
  });

  // Test 35: Color information accessibility
  it("should not rely solely on color for information", () => {
    const StatusIndicator = ({
      status,
    }: {
      status: "success" | "warning" | "error";
    }) => {
      const getStatusInfo = () => {
        switch (status) {
          case "success":
            return {
              icon: "✓",
              text: "Success",
              color: "var(--color-success)",
            };
          case "warning":
            return {
              icon: "⚠",
              text: "Warning",
              color: "var(--color-warning)",
            };
          case "error":
            return { icon: "✗", text: "Error", color: "var(--color-error)" };
        }
      };

      const info = getStatusInfo();

      return (
        <div
          data-testid={`status-${status}`}
          style={{
            background: "var(--color-surface-glass)",
            color: info.color,
            border: `2px solid ${info.color}`,
            padding: "0.5rem",
          }}
        >
          <span aria-hidden="true">{info.icon}</span>
          <span>{info.text}</span>
        </div>
      );
    };

    const { getByTestId } = render(
      <div>
        <StatusIndicator status="success" />
        <StatusIndicator status="warning" />
        <StatusIndicator status="error" />
      </div>,
      { container: testContainer }
    );

    // Each status should have text label, not just color
    expect(getByTestId("status-success")).toHaveTextContent("Success");
    expect(getByTestId("status-warning")).toHaveTextContent("Warning");
    expect(getByTestId("status-error")).toHaveTextContent("Error");

    // Should also have icons as additional indicators
    expect(getByTestId("status-success")).toHaveTextContent("✓");
    expect(getByTestId("status-warning")).toHaveTextContent("⚠");
    expect(getByTestId("status-error")).toHaveTextContent("✗");
  });
});
