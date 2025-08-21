/**
 * RR-230: Glass Component Migration Test Specification
 *
 * Test contracts for Wave 1 migration implementation:
 * - toolbarChild variant renders transparent within glass containers
 * - nav variant provides standalone glass using CSS variables
 * - Legacy class bridging preserves CSS behaviors
 * - MorphingDropdown container provides unified glass styling
 * - 44px toolbar buttons, 48px standalone icons (WCAG compliance)
 * - UA appearance normalization prevents iOS button chrome
 */

import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import "@testing-library/jest-dom";
import {
  GlassButton,
  GlassIconButton,
  GlassToolbarButton,
} from "@/components/ui/glass-button";
import { MorphingDropdown } from "@/components/ui/morphing-dropdown";

// Mock matchMedia for reduced motion testing
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

describe("RR-230: Glass Component Migration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GlassToolbarButton - toolbarChild Variant", () => {
    test("defaults to toolbarChild variant", () => {
      render(
        <GlassToolbarButton>
          <span>Test Button</span>
        </GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      // Should have transparent styling, not glass effects
      expect(button).toHaveClass("bg-transparent");
      expect(button).toHaveClass("border-transparent");
      expect(button).toHaveClass("shadow-none");
    });

    test("applies legacy class bridging", () => {
      render(
        <GlassToolbarButton>
          <span>Test Button</span>
        </GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("glass-toolbar-btn");
    });

    test("uses 44px height for toolbar sizing", () => {
      render(
        <GlassToolbarButton>
          <span>Test Button</span>
        </GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-[44px]");
      expect(button).toHaveClass("min-w-[44px]");
    });

    test("normalizes UA appearance", () => {
      render(
        <GlassToolbarButton>
          <span>Test Button</span>
        </GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("appearance-none");
      expect(button).toHaveClass("-webkit-appearance-none");
    });

    test("preserves custom className", () => {
      render(
        <GlassToolbarButton className="custom-class">
          <span>Test Button</span>
        </GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("custom-class");
      expect(button).toHaveClass("glass-toolbar-btn"); // Legacy bridging preserved
    });
  });

  describe("GlassIconButton - nav Variant", () => {
    test("defaults to nav variant", () => {
      render(
        <GlassIconButton>
          <span>Icon</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");
      // Should use CSS variables for glass styling
      expect(button).toHaveClass("bg-[var(--glass-nav-bg)]");
      expect(button).toHaveClass("border-[var(--glass-nav-border)]");
    });

    test("applies legacy class bridging", () => {
      render(
        <GlassIconButton>
          <span>Icon</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("glass-icon-btn");
    });

    test("uses 48px dimensions for icon sizing", () => {
      render(
        <GlassIconButton>
          <span>Icon</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("w-[48px]");
      expect(button).toHaveClass("h-[48px]");
    });

    test("normalizes UA appearance", () => {
      render(
        <GlassIconButton>
          <span>Icon</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("appearance-none");
      expect(button).toHaveClass("-webkit-appearance-none");
    });
  });

  describe("MorphingDropdown - Glass Container", () => {
    const mockToolbarElements = [
      <button key="1">Button 1</button>,
      <button key="2">Button 2</button>,
    ];

    const mockDropdownItems = [
      { id: "item1", label: "Item 1", onClick: vi.fn() },
      { id: "item2", label: "Item 2", onClick: vi.fn() },
    ];

    test("applies glass-toolbar class to container", () => {
      render(
        <MorphingDropdown
          toolbarElements={mockToolbarElements}
          items={mockDropdownItems}
        />
      );

      const container = screen.getByTestId("morphing-dropdown");
      expect(container).toHaveClass("glass-toolbar");
    });

    test("uses 4px closed-state padding for capsule geometry", () => {
      render(
        <MorphingDropdown
          toolbarElements={mockToolbarElements}
          items={mockDropdownItems}
        />
      );

      const container = screen.getByTestId("morphing-dropdown");
      expect(container).toHaveAttribute("data-state", "closed");

      // Check computed style for 4px padding
      const computedStyle = window.getComputedStyle(container);
      expect(computedStyle.padding).toBe("4px");
    });

    test("container provides glass styling properties", () => {
      render(
        <MorphingDropdown
          toolbarElements={mockToolbarElements}
          items={mockDropdownItems}
        />
      );

      const container = screen.getByTestId("morphing-dropdown");
      const computedStyle = window.getComputedStyle(container);

      expect(computedStyle.backdropFilter).toBe("blur(16px) saturate(180%)");
      expect(computedStyle.borderRadius).toBe("22px");
      expect(computedStyle.minHeight).toBe("48px");
    });

    test("expands to 8px padding when open", async () => {
      render(
        <MorphingDropdown
          toolbarElements={mockToolbarElements}
          items={mockDropdownItems}
          open={true}
        />
      );

      const container = screen.getByTestId("morphing-dropdown");
      expect(container).toHaveAttribute("data-state", "open");

      const computedStyle = window.getComputedStyle(container);
      expect(computedStyle.padding).toBe("8px");
    });
  });

  describe("Variant System Integration", () => {
    test("toolbarChild variant removes all glass effects", () => {
      render(
        <GlassButton variant="toolbarChild">
          <span>Transparent Button</span>
        </GlassButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-transparent");
      expect(button).toHaveClass("border-transparent");
      expect(button).toHaveClass("backdrop-blur-none");
      expect(button).toHaveClass("shadow-none");
    });

    test("nav variant uses CSS variables", () => {
      render(
        <GlassButton variant="nav">
          <span>Nav Button</span>
        </GlassButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("bg-[var(--glass-nav-bg)]");
      expect(button).toHaveClass("border-[var(--glass-nav-border)]");
      expect(button).toHaveClass("backdrop-blur-[var(--glass-blur)]");
    });
  });

  describe("Legacy Class Bridging", () => {
    test("GlassToolbarButton automatically adds glass-toolbar-btn class", () => {
      render(
        <GlassToolbarButton className="custom-class">
          <span>Toolbar Button</span>
        </GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("glass-toolbar-btn");
      expect(button).toHaveClass("custom-class");
    });

    test("GlassIconButton automatically adds glass-icon-btn class", () => {
      render(
        <GlassIconButton className="custom-class">
          <span>Icon Button</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("glass-icon-btn");
      expect(button).toHaveClass("custom-class");
    });

    test("legacy classes preserved with component variants", () => {
      render(
        <div>
          <GlassToolbarButton>Toolbar</GlassToolbarButton>
          <GlassIconButton>Icon</GlassIconButton>
        </div>
      );

      const toolbarButton = screen.getByText("Toolbar");
      const iconButton = screen.getByText("Icon");

      // Both should have legacy classes AND new variants
      expect(toolbarButton).toHaveClass("glass-toolbar-btn");
      expect(toolbarButton).toHaveClass("bg-transparent"); // toolbarChild variant

      expect(iconButton).toHaveClass("glass-icon-btn");
      expect(iconButton).toHaveClass("bg-[var(--glass-nav-bg)]"); // nav variant
    });
  });

  describe("Touch Target Compliance", () => {
    test("toolbar buttons meet 44px minimum", () => {
      render(
        <GlassToolbarButton>
          <span>Button</span>
        </GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("h-[44px]");
      expect(button).toHaveClass("min-w-[44px]");
    });

    test("icon buttons meet 48px minimum", () => {
      render(
        <GlassIconButton>
          <span>Icon</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("w-[48px]");
      expect(button).toHaveClass("h-[48px]");
    });
  });

  describe("Integration: Unified Glass Architecture", () => {
    test("toolbar container with transparent children creates unified effect", () => {
      const toolbarElements = [
        <GlassToolbarButton key="1">Button 1</GlassToolbarButton>,
        <GlassToolbarButton key="2">Button 2</GlassToolbarButton>,
      ];

      const dropdownItems = [
        { id: "item1", label: "Item 1", onClick: vi.fn() },
      ];

      render(
        <MorphingDropdown
          toolbarElements={toolbarElements}
          items={dropdownItems}
        />
      );

      const container = screen.getByTestId("morphing-dropdown");
      const buttons = screen.getAllByRole("button");
      const toolbarButtons = buttons.slice(0, 2); // First 2 are toolbar buttons

      // Container should have glass styling
      expect(container).toHaveClass("glass-toolbar");
      expect(container).toHaveAttribute("data-state", "closed");

      // Children should be transparent
      toolbarButtons.forEach((button) => {
        expect(button).toHaveClass("bg-transparent");
        expect(button).toHaveClass("border-transparent");
        expect(button).toHaveClass("glass-toolbar-btn"); // Legacy class preserved
      });
    });

    test("maintains visual parity with CSS variable integration", () => {
      render(
        <GlassIconButton>
          <span>Nav Icon</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");

      // Should use same CSS variables as original glass-icon-btn class
      expect(button).toHaveClass("bg-[var(--glass-nav-bg)]");
      expect(button).toHaveClass("border-[var(--glass-nav-border)]");
      expect(button).toHaveClass("backdrop-blur-[var(--glass-blur)]");
      expect(button).toHaveClass("backdrop-saturate-[var(--glass-saturation)]");
    });
  });

  describe("Regression Prevention", () => {
    test("unified button cluster does not create individual glass circles", () => {
      const toolbarElements = [
        <GlassToolbarButton key="star">Star</GlassToolbarButton>,
        <GlassToolbarButton key="summary">Summary</GlassToolbarButton>,
        <GlassToolbarButton key="fetch">Fetch</GlassToolbarButton>,
      ];

      const dropdownItems = [{ id: "share", label: "Share", onClick: vi.fn() }];

      render(
        <MorphingDropdown
          toolbarElements={toolbarElements}
          items={dropdownItems}
        />
      );

      const container = screen.getByTestId("morphing-dropdown");
      const toolbarButtons = screen.getAllByText(/Star|Summary|Fetch/);

      // Container should be the only element with glass effects
      expect(container).toHaveClass("glass-toolbar");

      // All toolbar children should be transparent (no individual glass)
      toolbarButtons.forEach((button) => {
        expect(button).toHaveClass("bg-transparent");
        expect(button).not.toHaveClass("backdrop-blur-[16px]");
        expect(button).not.toHaveClass("shadow-lg");
      });
    });

    test("standalone buttons retain individual glass effects", () => {
      render(
        <GlassIconButton>
          <span>Standalone</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");

      // Standalone button should have glass effects via nav variant
      expect(button).toHaveClass("bg-[var(--glass-nav-bg)]");
      expect(button).toHaveClass("backdrop-blur-[var(--glass-blur)]");
      expect(button).toHaveClass("shadow-lg");
    });
  });

  describe("Performance and Accessibility", () => {
    test("maintains focus-visible styling", () => {
      render(
        <GlassIconButton>
          <span>Focus Test</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("focus-visible:outline-none");
      expect(button).toHaveClass("focus-visible:ring-2");
    });

    test("preserves active scale animation", () => {
      render(
        <GlassToolbarButton>
          <span>Scale Test</span>
        </GlassToolbarButton>
      );

      const button = screen.getByRole("button");
      expect(button).toHaveClass("active:scale-[0.96]");
    });

    test("respects disabled state", () => {
      render(
        <GlassIconButton disabled>
          <span>Disabled</span>
        </GlassIconButton>
      );

      const button = screen.getByRole("button");
      expect(button).toBeDisabled();
      expect(button).toHaveClass("disabled:pointer-events-none");
      expect(button).toHaveClass("disabled:opacity-50");
    });
  });

  describe("Container Glass Behavior", () => {
    test("MorphingDropdown provides unified glass styling", () => {
      const toolbarElements = [<button key="1">Test</button>];
      const dropdownItems = [{ id: "item", label: "Item", onClick: vi.fn() }];

      render(
        <MorphingDropdown
          toolbarElements={toolbarElements}
          items={dropdownItems}
        />
      );

      const container = screen.getByTestId("morphing-dropdown");
      const computedStyle = window.getComputedStyle(container);

      expect(computedStyle.backdropFilter).toBe("blur(16px) saturate(180%)");
      expect(computedStyle.borderRadius).toBe("22px");
      expect(computedStyle.minHeight).toBe("48px");
    });

    test("container adapts padding for open/closed states", () => {
      const toolbarElements = [<button key="1">Test</button>];
      const dropdownItems = [{ id: "item", label: "Item", onClick: vi.fn() }];

      const { rerender } = render(
        <MorphingDropdown
          toolbarElements={toolbarElements}
          items={dropdownItems}
          open={false}
        />
      );

      let container = screen.getByTestId("morphing-dropdown");
      expect(window.getComputedStyle(container).padding).toBe("4px");

      rerender(
        <MorphingDropdown
          toolbarElements={toolbarElements}
          items={dropdownItems}
          open={true}
        />
      );

      container = screen.getByTestId("morphing-dropdown");
      expect(window.getComputedStyle(container).padding).toBe("8px");
    });
  });

  describe("Wave 1 Migration Success Criteria", () => {
    test("component migration maintains CSS class compatibility", () => {
      // Test that migrated components still work with existing CSS
      render(
        <div>
          <GlassIconButton className="test-nav">Nav</GlassIconButton>
          <GlassToolbarButton className="test-toolbar">
            Toolbar
          </GlassToolbarButton>
        </div>
      );

      const navButton = screen.getByText("Nav");
      const toolbarButton = screen.getByText("Toolbar");

      // Should have both component classes and legacy bridges
      expect(navButton).toHaveClass("glass-icon-btn");
      expect(navButton).toHaveClass("test-nav");

      expect(toolbarButton).toHaveClass("glass-toolbar-btn");
      expect(toolbarButton).toHaveClass("test-toolbar");
    });

    test("establishes foundation for RR-231 Wave 2", () => {
      // Verify that component system is ready for scaling
      const variants = ["default", "toolbarChild", "nav", "ghost"];

      variants.forEach((variant) => {
        const { unmount } = render(
          <GlassButton variant={variant as any}>
            <span>Test {variant}</span>
          </GlassButton>
        );

        const button = screen.getByRole("button");
        expect(button).toBeInTheDocument();

        unmount();
      });
    });
  });
});
