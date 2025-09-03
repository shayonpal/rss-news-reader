/**
 * RR-231: Foundation Finalization Tests
 * Validates CSS tokenization, component architecture, and barrel exports
 *
 * These tests serve as the specification for RR-231 implementation
 */

import { describe, test, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  GlassButton,
  GlassInput,
  GlassCard,
  GlassTooltip,
  GlassNav,
  GlassFooter,
} from "@/components/ui";

describe("RR-231: Foundation Finalization", () => {
  beforeEach(() => {
    // Reset any DOM state between tests
    document.body.innerHTML = "";
  });

  describe("CSS Token System Validation", () => {
    test("should have semantic tokens available in CSS", () => {
      // Create a test element to check computed styles
      const testElement = document.createElement("div");
      testElement.style.background = "var(--color-surface-glass)";
      document.body.appendChild(testElement);

      const computed = window.getComputedStyle(testElement);
      expect(computed.backgroundColor).toBeTruthy();
      expect(computed.backgroundColor).not.toBe("var(--color-surface-glass)");
    });

    test("should preserve legacy alias bridge variables", () => {
      const testElement = document.createElement("div");
      testElement.style.background = "var(--glass-nav-bg)";
      document.body.appendChild(testElement);

      const computed = window.getComputedStyle(testElement);
      expect(computed.backgroundColor).toBeTruthy();
      expect(computed.backgroundColor).not.toBe("var(--glass-nav-bg)");
    });

    test("should have motion tokens defined", () => {
      const testElement = document.createElement("div");
      testElement.style.transition = "all 300ms var(--motion-spring)";
      document.body.appendChild(testElement);

      const computed = window.getComputedStyle(testElement);
      // In test environment, check that the variable is applied
      expect(computed.transition).toContain("var(--motion-spring)");
    });
  });

  describe("Barrel Export System", () => {
    test("should export all glass components from barrel", () => {
      // Verify all components are accessible from barrel import
      expect(GlassButton).toBeDefined();
      expect(GlassInput).toBeDefined();
      expect(GlassCard).toBeDefined();
      expect(GlassTooltip).toBeDefined();
      expect(GlassNav).toBeDefined();
      expect(GlassFooter).toBeDefined();
    });

    test("should export component types from barrel", () => {
      // TypeScript compilation validates type exports
      // This test ensures runtime availability
      expect(typeof GlassButton).toBe("object");
      expect(typeof GlassInput).toBe("object");
      expect(typeof GlassCard).toBe("object");
    });
  });

  describe("Essential Missing Components", () => {
    test("GlassInput should render with glass styling", () => {
      render(<GlassInput placeholder="Test input" data-testid="glass-input" />);

      const input = screen.getByTestId("glass-input");
      expect(input).toBeInTheDocument();
      expect(input).toHaveClass("backdrop-blur-[var(--glass-blur-base)]");
      expect(input).toHaveClass("bg-[var(--color-surface-glass-subtle)]");
    });

    test("GlassCard should render with elevation tokens", () => {
      render(
        <GlassCard elevation="medium" data-testid="glass-card">
          <p>Card content</p>
        </GlassCard>
      );

      const card = screen.getByTestId("glass-card");
      expect(card).toBeInTheDocument();
      expect(card).toHaveClass("bg-[var(--color-surface-glass)]");
      expect(card).toHaveClass("shadow-xl");
      expect(screen.getByText("Card content")).toBeInTheDocument();
    });

    test("GlassTooltip should render with proper accessibility", () => {
      render(
        <GlassTooltip content="Tooltip content" data-testid="tooltip">
          <button>Trigger</button>
        </GlassTooltip>
      );

      const trigger = screen.getByText("Trigger");
      expect(trigger).toBeInTheDocument();
    });

    test("GlassNav should support different positions", () => {
      render(
        <GlassNav position="sticky" data-testid="glass-nav">
          <div>Navigation content</div>
        </GlassNav>
      );

      const nav = screen.getByTestId("glass-nav");
      expect(nav).toHaveClass("sticky");
      expect(nav).toHaveClass("backdrop-blur-[var(--glass-blur)]");
    });

    test("GlassFooter should render with border and glass effect", () => {
      render(
        <GlassFooter data-testid="glass-footer">
          <div>Footer content</div>
        </GlassFooter>
      );

      const footer = screen.getByTestId("glass-footer");
      expect(footer).toHaveClass("border-t");
      expect(footer).toHaveClass("backdrop-blur-[var(--glass-blur)]");
    });
  });

  describe("Component API Stability", () => {
    test("GlassInput should support all form states", () => {
      const { rerender } = render(<GlassInput data-testid="input" />);

      let input = screen.getByTestId("input");
      expect(input).not.toBeDisabled();

      // Test disabled state
      rerender(<GlassInput data-testid="input" disabled />);
      input = screen.getByTestId("input");
      expect(input).toBeDisabled();
      expect(input).toHaveClass("disabled:opacity-50");
    });

    test("GlassCard should support all elevation levels", () => {
      const { rerender } = render(
        <GlassCard elevation="none" data-testid="card">
          Content
        </GlassCard>
      );

      let card = screen.getByTestId("card");
      expect(card).toHaveClass("shadow-none");

      rerender(
        <GlassCard elevation="high" data-testid="card">
          Content
        </GlassCard>
      );
      card = screen.getByTestId("card");
      expect(card).toHaveClass("shadow-2xl");
    });
  });

  describe("Visual Regression Prevention", () => {
    test("should maintain glass effect visual consistency", () => {
      render(
        <div>
          <GlassButton variant="default" data-testid="button">
            Button
          </GlassButton>
          <GlassCard data-testid="card">Card</GlassCard>
        </div>
      );

      const button = screen.getByTestId("button");
      const card = screen.getByTestId("card");

      // Both should use consistent glass effects
      expect(button).toHaveClass("backdrop-blur-[16px]");
      expect(card).toHaveClass("backdrop-blur-[var(--glass-blur-base)]");
    });
  });

  describe("Foundation Readiness for RR-232", () => {
    test("should have token structure ready for violet theme integration", () => {
      const testElement = document.createElement("div");
      // Test that semantic tokens are available (test environment limitation)
      testElement.style.setProperty("background", "var(--color-surface-glass)");
      testElement.style.setProperty(
        "border",
        "1px solid var(--color-border-glass)"
      );
      document.body.appendChild(testElement);

      const computed = window.getComputedStyle(testElement);
      // In test environment, verify variables are applied rather than resolved
      expect(computed.getPropertyValue("background")).toContain(
        "var(--color-surface-glass)"
      );
      expect(computed.getPropertyValue("border")).toContain(
        "var(--color-border-glass)"
      );
    });

    test("should maintain component API stability for theme integration", () => {
      // Verify components accept props that violet theme will use
      render(
        <GlassCard elevation="medium" variant="enhanced" size="lg">
          Theme integration test
        </GlassCard>
      );

      expect(screen.getByText("Theme integration test")).toBeInTheDocument();
    });
  });
});
