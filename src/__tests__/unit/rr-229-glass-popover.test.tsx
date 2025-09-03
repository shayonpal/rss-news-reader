/**
 * RR-229: GlassPopover Component Test Specification
 *
 * Test contracts based on staging documentation:
 * - Radix Popover primitive integration with glass styling wrapper
 * - Backdrop filter: blur(16px) saturate(180%)
 * - Focus trap and keyboard navigation
 * - ESC key closes, outside click closes
 * - Screen reader compatibility
 * - Performance requirements (<3KB bundle, 60fps)
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { GlassPopover } from "@/components/ui/glass-popover";

// Mock Radix components for testing
vi.mock("@radix-ui/react-popover", () => ({
  Root: ({ children, ...props }: any) => (
    <div data-testid="popover-root" {...props}>
      {children}
    </div>
  ),
  Trigger: ({ children, ...props }: any) => (
    <button data-testid="popover-trigger" {...props}>
      {children}
    </button>
  ),
  Content: ({ children, ...props }: any) => (
    <div data-testid="popover-content" role="dialog" {...props}>
      {children}
    </div>
  ),
  Portal: ({ children }: any) => (
    <div data-testid="popover-portal">{children}</div>
  ),
  Arrow: ({ ...props }: any) => <div data-testid="popover-arrow" {...props} />,
}));

describe("GlassPopover", () => {
  const defaultProps = {
    trigger: <button>Open Menu</button>,
    children: <div>Popover Content</div>,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Basic Rendering and Structure", () => {
    test("renders Radix Popover root with glass wrapper", () => {
      render(<GlassPopover {...defaultProps} />);

      expect(screen.getByTestId("popover-root")).toBeInTheDocument();
      expect(screen.getByTestId("popover-trigger")).toBeInTheDocument();
    });

    test("renders trigger element correctly", () => {
      render(<GlassPopover {...defaultProps} />);

      const trigger = screen.getByTestId("popover-trigger");
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent("Open Menu");
    });

    test("applies glass popover classes to content", () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveClass("glass-popover");
    });

    test("renders portal for content", () => {
      render(<GlassPopover {...defaultProps} open />);

      expect(screen.getByTestId("popover-portal")).toBeInTheDocument();
    });
  });

  describe("Glass Styling", () => {
    test("applies backdrop filter properties", () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      const styles = window.getComputedStyle(content);

      expect(styles.backdropFilter).toBe("blur(16px) saturate(180%)");
      expect(styles.WebkitBackdropFilter).toBe("blur(16px) saturate(180%)");
    });

    test("applies glass background and border", () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveClass("glass-popover");

      const styles = window.getComputedStyle(content);
      expect(styles.background).toContain("rgba");
      expect(styles.border).toBeTruthy();
      expect(styles.borderRadius).toBe("22px");
    });

    test("includes proper box shadow", () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      const styles = window.getComputedStyle(content);

      expect(styles.boxShadow).toContain("0 24px 60px rgba(0, 0, 0, 0.25)");
      expect(styles.boxShadow).toContain("0 4px 12px rgba(0, 0, 0, 0.12)");
    });
  });

  describe("Interactive Behavior", () => {
    test("opens when trigger is clicked", async () => {
      const user = userEvent.setup();

      render(<GlassPopover {...defaultProps} />);

      const trigger = screen.getByTestId("popover-trigger");
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId("popover-content")).toBeInTheDocument();
      });
    });

    test("calls onOpenChange when state changes", async () => {
      const mockOnOpenChange = vi.fn();
      const user = userEvent.setup();

      render(
        <GlassPopover {...defaultProps} onOpenChange={mockOnOpenChange} />
      );

      const trigger = screen.getByTestId("popover-trigger");
      await user.click(trigger);

      expect(mockOnOpenChange).toHaveBeenCalledWith(true);
    });

    test("closes when ESC key is pressed", async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = vi.fn();

      render(
        <GlassPopover {...defaultProps} open onOpenChange={mockOnOpenChange} />
      );

      await user.keyboard("[Escape]");

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });

    test("closes when clicking outside", async () => {
      const user = userEvent.setup();
      const mockOnOpenChange = vi.fn();

      render(
        <>
          <GlassPopover
            {...defaultProps}
            open
            onOpenChange={mockOnOpenChange}
          />
          <div data-testid="outside-element">Outside</div>
        </>
      );

      const outsideElement = screen.getByTestId("outside-element");
      await user.click(outsideElement);

      expect(mockOnOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("Positioning and Side", () => {
    test("supports different side positioning", () => {
      render(<GlassPopover {...defaultProps} open side="top" />);

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("data-side", "top");
    });

    test("defaults to bottom positioning", () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("data-side", "bottom");
    });

    test("supports align property", () => {
      render(<GlassPopover {...defaultProps} open align="start" />);

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("data-align", "start");
    });
  });

  describe("Focus Management", () => {
    test("traps focus within popover when open", async () => {
      const user = userEvent.setup();

      render(
        <GlassPopover {...defaultProps} open>
          <div>
            <button data-testid="first-button">First</button>
            <button data-testid="second-button">Second</button>
          </div>
        </GlassPopover>
      );

      const firstButton = screen.getByTestId("first-button");
      const secondButton = screen.getByTestId("second-button");

      firstButton.focus();
      expect(document.activeElement).toBe(firstButton);

      await user.tab();
      expect(document.activeElement).toBe(secondButton);

      await user.tab();
      // Should wrap back to first button in focus trap
      expect(document.activeElement).toBe(firstButton);
    });

    test("restores focus to trigger when closed", async () => {
      const user = userEvent.setup();

      render(<GlassPopover {...defaultProps} />);

      const trigger = screen.getByTestId("popover-trigger");
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByTestId("popover-content")).toBeInTheDocument();
      });

      await user.keyboard("[Escape]");

      expect(document.activeElement).toBe(trigger);
    });
  });

  describe("Accessibility", () => {
    test("content has proper dialog role", () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("role", "dialog");
    });

    test("provides aria-describedby relationship", () => {
      render(<GlassPopover {...defaultProps} open />);

      const trigger = screen.getByTestId("popover-trigger");
      const content = screen.getByTestId("popover-content");

      const contentId = content.getAttribute("id");
      expect(trigger).toHaveAttribute("aria-describedby", contentId);
    });

    test("supports aria-label for content", () => {
      render(
        <GlassPopover {...defaultProps} open ariaLabel="Navigation menu" />
      );

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("aria-label", "Navigation menu");
    });

    test("indicates expanded state on trigger", () => {
      const { rerender } = render(<GlassPopover {...defaultProps} />);

      const trigger = screen.getByTestId("popover-trigger");
      expect(trigger).toHaveAttribute("aria-expanded", "false");

      rerender(<GlassPopover {...defaultProps} open />);
      expect(trigger).toHaveAttribute("aria-expanded", "true");
    });
  });

  describe("Theme Support", () => {
    test("accepts theme prop for future violet theme", () => {
      render(<GlassPopover {...defaultProps} open theme="violet-ready" />);

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveAttribute("data-theme", "violet-ready");
    });

    test("maintains CSS variable structure for theming", () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      const styles = window.getComputedStyle(content);

      // Should use CSS variables that can be overridden by theme
      expect(styles.getPropertyValue("--glass-blur")).toBeDefined();
      expect(styles.getPropertyValue("--glass-saturation")).toBeDefined();
    });
  });

  describe("Reduced Transparency Support", () => {
    test("disables backdrop filter when reduced transparency is enabled", () => {
      // Mock CSS.supports to return false for backdrop-filter
      Object.defineProperty(CSS, "supports", {
        value: vi.fn((property: string, value: string) => {
          if (property === "backdrop-filter" && value === "blur(1px)") {
            return false;
          }
          return true;
        }),
        writable: true,
      });

      render(<GlassPopover {...defaultProps} open reducedTransparency />);

      const content = screen.getByTestId("popover-content");
      expect(content).toHaveClass("reduce-transparency");

      const styles = window.getComputedStyle(content);
      expect(styles.backdropFilter).toBe("none");
    });
  });

  describe("Performance Requirements", () => {
    test("applies will-change optimization for animations", () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      const styles = window.getComputedStyle(content);

      expect(styles.willChange).toBe("transform, opacity");
    });

    test("uses transform for position animations", () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      const styles = window.getComputedStyle(content);

      expect(styles.transform).toBeDefined();
      expect(styles.transition).toContain("transform");
    });
  });

  describe("Integration with DropdownMenu", () => {
    test("maintains DropdownMenu API compatibility", () => {
      const dropdownContent = (
        <div>
          <button data-testid="menu-item-1">Item 1</button>
          <button data-testid="menu-item-2">Item 2</button>
          <div className="menu-separator" />
          <button data-testid="menu-item-3">Item 3</button>
        </div>
      );

      render(
        <GlassPopover trigger={<button>Menu</button>} open>
          {dropdownContent}
        </GlassPopover>
      );

      expect(screen.getByTestId("menu-item-1")).toBeInTheDocument();
      expect(screen.getByTestId("menu-item-2")).toBeInTheDocument();
      expect(screen.getByTestId("menu-item-3")).toBeInTheDocument();
      expect(screen.getByRole("separator")).toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    test("handles missing trigger gracefully", () => {
      render(
        <GlassPopover>
          <div>Content</div>
        </GlassPopover>
      );

      expect(screen.getByTestId("popover-root")).toBeInTheDocument();
    });

    test("handles empty children gracefully", () => {
      render(<GlassPopover trigger={<button>Trigger</button>} open />);

      const content = screen.getByTestId("popover-content");
      expect(content).toBeInTheDocument();
      expect(content).toBeEmptyDOMElement();
    });

    test("maintains functionality with portal disabled", () => {
      render(<GlassPopover {...defaultProps} open disablePortal />);

      expect(screen.getByTestId("popover-content")).toBeInTheDocument();
    });
  });

  describe("Animation and Transitions", () => {
    test("applies enter animation classes", async () => {
      render(<GlassPopover {...defaultProps} />);

      const trigger = screen.getByTestId("popover-trigger");
      fireEvent.click(trigger);

      await waitFor(() => {
        const content = screen.getByTestId("popover-content");
        expect(content).toHaveClass("animate-in");
        expect(content).toHaveClass("fade-in-0");
        expect(content).toHaveClass("zoom-in-95");
      });
    });

    test("applies exit animation classes", async () => {
      render(<GlassPopover {...defaultProps} open />);

      const content = screen.getByTestId("popover-content");
      fireEvent.keyDown(content, { key: "Escape" });

      await waitFor(() => {
        expect(content).toHaveClass("animate-out");
        expect(content).toHaveClass("fade-out-0");
        expect(content).toHaveClass("zoom-out-95");
      });
    });
  });
});
