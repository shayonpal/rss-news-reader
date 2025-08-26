/**
 * RR-229: GlassSegmentedControl Component Test Specification
 *
 * Test contracts based on staging documentation:
 * - CVA implementation with size/segments/theme variants
 * - 44px minimum touch targets (WCAG 2.1 AA)
 * - Animated indicator with spring timing
 * - Keyboard navigation support
 * - Accessibility compliance (role="radiogroup")
 * - Performance requirements (<3KB bundle, 60fps)
 */

import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  render,
  screen,
  fireEvent,
  within,
  cleanup,
} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlassSegmentedControl } from "@/components/ui/glass-segmented-control";

// Test data based on ReadStatusFilter requirements
const mockOptions = [
  { value: "all", label: "All", icon: "List" },
  { value: "unread", label: "Unread", icon: "MailOpen" },
  { value: "read", label: "Read", icon: "CheckCheck" },
];

describe("GlassSegmentedControl", () => {
  const defaultProps = {
    options: mockOptions,
    value: "all" as const,
    onValueChange: vi.fn(),
  };

  beforeEach(() => {
    // Force cleanup before each test
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Force cleanup after each test
    cleanup();
  });

  describe("Basic Rendering and Structure", () => {
    test("renders with proper radiogroup role", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const radiogroup = screen.getByRole("radiogroup");
      expect(radiogroup).toBeInTheDocument();
      expect(radiogroup).toHaveClass("glass-segment");
    });

    test("renders all option buttons with proper radio roles", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const radioButtons = screen.getAllByRole("radio");
      expect(radioButtons).toHaveLength(3);

      expect(screen.getByRole("radio", { name: /all/i })).toBeInTheDocument();
      expect(
        screen.getByRole("radio", { name: /unread/i })
      ).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /read/i })).toBeInTheDocument();
    });

    test("sets correct data-value attribute", () => {
      render(<GlassSegmentedControl {...defaultProps} value="unread" />);

      const container = screen.getByRole("radiogroup");
      expect(container).toHaveAttribute("data-value", "unread");
    });

    test("renders animated indicator element", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const indicator = screen.getByTestId("segment-indicator");
      expect(indicator).toBeInTheDocument();
      expect(indicator).toHaveClass("glass-segment-indicator");
    });
  });

  describe("Size Variants", () => {
    test("applies compact size variant classes", () => {
      render(<GlassSegmentedControl {...defaultProps} size="sm" />);

      const container = screen.getByRole("radiogroup");
      expect(container).toHaveClass("glass-segment-sm");
    });

    test("uses regular size by default", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const container = screen.getByRole("radiogroup");
      expect(container).toHaveClass("glass-segment");
      expect(container).not.toHaveClass("glass-segment-sm");
    });

    test("maintains minimum 44px touch targets", () => {
      render(<GlassSegmentedControl {...defaultProps} size="sm" />);

      const buttons = screen.getAllByRole("radio");
      buttons.forEach((button) => {
        const styles = window.getComputedStyle(button);
        const height = parseInt(styles.height);
        expect(height).toBeGreaterThanOrEqual(44);
      });
    });
  });

  describe("Segments Variant (3-option layout)", () => {
    test("applies 3-segment grid layout", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const container = screen.getByRole("radiogroup");
      expect(container).toHaveClass("glass-segment-3");

      // Should use CSS Grid with 3 columns
      const styles = window.getComputedStyle(container);
      expect(styles.display).toBe("inline-grid");
      expect(styles.gridTemplateColumns).toBe("repeat(3, 1fr)");
    });

    test("indicator width adjusts for 3-segment layout", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const indicator = screen.getByTestId("segment-indicator");
      const styles = window.getComputedStyle(indicator);

      // Width should be calc((100% - (var(--segment-pad) * 2)) / 3)
      expect(styles.width).toMatch(/calc\(/);
    });
  });

  describe("Interactive Behavior", () => {
    test("calls onValueChange when option is clicked", async () => {
      const user = userEvent.setup();
      const mockChange = vi.fn();

      render(
        <GlassSegmentedControl {...defaultProps} onValueChange={mockChange} />
      );

      const unreadButton = screen.getByRole("radio", { name: /unread/i });
      await user.click(unreadButton);

      expect(mockChange).toHaveBeenCalledWith("unread");
    });

    test("updates selected state correctly", () => {
      const { rerender } = render(
        <GlassSegmentedControl {...defaultProps} value="all" />
      );

      expect(screen.getByRole("radio", { name: /all/i })).toHaveAttribute(
        "aria-checked",
        "true"
      );
      expect(screen.getByRole("radio", { name: /unread/i })).toHaveAttribute(
        "aria-checked",
        "false"
      );

      rerender(<GlassSegmentedControl {...defaultProps} value="unread" />);

      expect(screen.getByRole("radio", { name: /all/i })).toHaveAttribute(
        "aria-checked",
        "false"
      );
      expect(screen.getByRole("radio", { name: /unread/i })).toHaveAttribute(
        "aria-checked",
        "true"
      );
    });

    test("indicator moves to correct position", () => {
      const { rerender } = render(
        <GlassSegmentedControl {...defaultProps} value="all" />
      );

      const indicator = screen.getByTestId("segment-indicator");
      expect(indicator).toHaveStyle({ transform: "translateX(0%)" });

      rerender(<GlassSegmentedControl {...defaultProps} value="unread" />);
      expect(indicator).toHaveStyle({ transform: "translateX(100%)" });

      rerender(<GlassSegmentedControl {...defaultProps} value="read" />);
      expect(indicator).toHaveStyle({ transform: "translateX(200%)" });
    });
  });

  describe("Keyboard Navigation", () => {
    test("supports arrow key navigation", async () => {
      const user = userEvent.setup();
      const mockChange = vi.fn();

      render(
        <GlassSegmentedControl {...defaultProps} onValueChange={mockChange} />
      );

      const firstButton = screen.getByRole("radio", { name: /all/i });
      firstButton.focus();

      await user.keyboard("[ArrowRight]");
      expect(screen.getByRole("radio", { name: /unread/i })).toHaveFocus();

      await user.keyboard("[ArrowRight]");
      expect(screen.getByRole("radio", { name: /read/i })).toHaveFocus();

      // Should wrap to beginning
      await user.keyboard("[ArrowRight]");
      expect(screen.getByRole("radio", { name: /all/i })).toHaveFocus();
    });

    test("supports Enter/Space key selection", async () => {
      const user = userEvent.setup();
      const mockChange = vi.fn();

      render(
        <GlassSegmentedControl {...defaultProps} onValueChange={mockChange} />
      );

      const unreadButton = screen.getByRole("radio", { name: /unread/i });
      unreadButton.focus();

      await user.keyboard("[Enter]");
      expect(mockChange).toHaveBeenCalledWith("unread");

      mockChange.mockClear();
      await user.keyboard(" ");
      expect(mockChange).toHaveBeenCalledWith("unread");
    });
  });

  describe("Accessibility", () => {
    test("provides proper aria-labels", () => {
      render(
        <GlassSegmentedControl
          {...defaultProps}
          ariaLabel="Read status filter"
        />
      );

      const radiogroup = screen.getByRole("radiogroup");
      expect(radiogroup).toHaveAttribute("aria-label", "Read status filter");
    });

    test("supports reduced transparency preference", () => {
      // Mock CSS.supports for reduced transparency check
      Object.defineProperty(CSS, "supports", {
        value: vi.fn((property: string, value: string) => {
          if (property === "backdrop-filter" && value === "blur(1px)") {
            return false;
          }
          return true;
        }),
        writable: true,
      });

      render(<GlassSegmentedControl {...defaultProps} reducedTransparency />);

      const container = screen.getByRole("radiogroup");
      expect(container).toHaveClass("reduce-transparency");
    });

    test("maintains focus visibility", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const firstButton = screen.getByRole("radio", { name: /all/i });
      firstButton.focus();

      expect(firstButton).toHaveAttribute("tabindex", "0");
      expect(document.activeElement).toBe(firstButton);
    });
  });

  describe("Performance Requirements", () => {
    test("uses CSS transforms for smooth animations", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const indicator = screen.getByTestId("segment-indicator");
      const styles = window.getComputedStyle(indicator);

      // Should use transform for 60fps performance
      expect(styles.transform).toBeDefined();
      expect(styles.transition).toContain("transform");
      expect(styles.transition).toContain("200ms");
      expect(styles.transition).toContain("cubic-bezier(0.4, 0, 0.2, 1)");
    });

    test("applies will-change optimization", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const indicator = screen.getByTestId("segment-indicator");
      const styles = window.getComputedStyle(indicator);

      expect(styles.willChange).toBe("transform");
    });
  });

  describe("Theme Preparation", () => {
    test("accepts theme variant for future violet theme", () => {
      render(<GlassSegmentedControl {...defaultProps} theme="violet-ready" />);

      const container = screen.getByRole("radiogroup");
      expect(container).toHaveAttribute("data-theme", "violet-ready");
    });

    test("maintains CSS variable structure for theming", () => {
      render(<GlassSegmentedControl {...defaultProps} />);

      const container = screen.getByRole("radiogroup");
      const styles = window.getComputedStyle(container);

      // Should use CSS variables that can be overridden by theme
      expect(styles.getPropertyValue("--glass-blur")).toBeDefined();
      expect(styles.getPropertyValue("--glass-saturation")).toBeDefined();
    });
  });

  describe("Integration with ReadStatusFilter", () => {
    test("matches ReadStatusFilter prop interface", () => {
      const readStatusOptions = [
        { value: "all", label: "All", icon: "List" },
        { value: "unread", label: "Unread", icon: "MailOpen" },
        { value: "read", label: "Read", icon: "CheckCheck" },
      ];

      render(
        <GlassSegmentedControl
          options={readStatusOptions}
          value="unread"
          onValueChange={vi.fn()}
          size="sm"
          ariaLabel="Read status"
        />
      );

      expect(screen.getByRole("radiogroup")).toBeInTheDocument();
      expect(screen.getByRole("radio", { name: /unread/i })).toHaveAttribute(
        "aria-checked",
        "true"
      );
    });
  });

  describe("Error Handling", () => {
    test("handles empty options array gracefully", () => {
      render(<GlassSegmentedControl {...defaultProps} options={[]} />);

      const container = screen.getByRole("radiogroup");
      expect(container).toBeInTheDocument();
      expect(screen.queryAllByRole("radio")).toHaveLength(0);
    });

    test("handles invalid value gracefully", () => {
      render(
        <GlassSegmentedControl {...defaultProps} value="invalid" as any />
      );

      const container = screen.getByRole("radiogroup");
      expect(container).toBeInTheDocument();

      // Should not crash and should render all options
      expect(screen.getAllByRole("radio")).toHaveLength(3);
    });
  });
});
