/**
 * RR-251: Ghost Button Violet Theme Integration - Unit Tests (Class Application)
 * 
 * SCOPE: Tests ONLY that the correct CSS classes are applied to components.
 * Does NOT test CSS variable resolution (that requires browser environment).
 * 
 * These tests verify our implementation without environment dependencies.
 */

import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import React from "react";
import { GlassButton } from "@/components/ui/glass-button";

describe("RR-251: Ghost Button Class Application (Unit Tests)", () => {
  describe("CSS Class Application", () => {
    it("should apply correct CSS variable classes to ghost variant", () => {
      const { container } = render(
        <GlassButton variant="ghost">Test Button</GlassButton>
      );
      
      const button = container.querySelector("button");
      expect(button).toBeDefined();
      
      // Verify the ghost variant applies our CSS variable classes
      expect(button!.className).toContain("text-[color:var(--ghost-text-light)]");
      expect(button!.className).toContain("dark:text-[color:var(--ghost-text-dark)]");
    });

    it("should maintain other ghost variant classes alongside text color", () => {
      const { container } = render(
        <GlassButton variant="ghost">Test Button</GlassButton>
      );
      
      const button = container.querySelector("button");
      
      // Verify other ghost variant classes remain intact
      expect(button!.className).toContain("bg-transparent");
      expect(button!.className).toContain("border-transparent");
      expect(button!.className).toContain("backdrop-blur-[16px]");
      expect(button!.className).toContain("backdrop-saturate-[180%]");
      expect(button!.className).toContain("hover:bg-white/35");
      expect(button!.className).toContain("dark:hover:bg-white/35");
    });

    it("should not apply ghost text classes to other variants", () => {
      const variants = ["default", "primary", "secondary", "danger"] as const;
      
      variants.forEach(variant => {
        const { container } = render(
          <GlassButton variant={variant}>Test Button</GlassButton>
        );
        
        const button = container.querySelector("button");
        
        // These variants should NOT have ghost text color classes
        expect(button!.className).not.toContain("text-[color:var(--ghost-text-light)]");
        expect(button!.className).not.toContain("dark:text-[color:var(--ghost-text-dark)]");
      });
    });

    it("should apply CSS variable classes regardless of other props", () => {
      const { container } = render(
        <GlassButton 
          variant="ghost" 
          size="lg"
          className="custom-class"
          disabled
        >
          Test Button
        </GlassButton>
      );
      
      const button = container.querySelector("button");
      
      // CSS variable classes should be present even with other props
      expect(button!.className).toContain("text-[color:var(--ghost-text-light)]");
      expect(button!.className).toContain("dark:text-[color:var(--ghost-text-dark)]");
      
      // Other props should also work
      expect(button!.className).toContain("custom-class");
      expect(button!.className).toContain("px-6 py-3"); // lg size
      expect(button).toBeDisabled();
    });
  });

  describe("Backward Compatibility", () => {
    it("should not break existing ghost button functionality", () => {
      const mockClick = vi.fn();
      const { container } = render(
        <GlassButton variant="ghost" onClick={mockClick}>
          Click Me
        </GlassButton>
      );
      
      const button = container.querySelector("button");
      expect(button).toBeDefined();
      expect(button!.textContent).toBe("Click Me");
      
      // Click functionality should still work
      button!.click();
      expect(mockClick).toHaveBeenCalledOnce();
    });

    it("should maintain proper button attributes", () => {
      const { container } = render(
        <GlassButton 
          variant="ghost" 
          type="submit"
          aria-label="Submit form"
        >
          Submit
        </GlassButton>
      );
      
      const button = container.querySelector("button");
      expect(button!.type).toBe("submit");
      expect(button!.getAttribute("aria-label")).toBe("Submit form");
    });
  });

  describe("asChild Prop", () => {
    it("should apply ghost variant classes to asChild elements", () => {
      const { container } = render(
        <GlassButton variant="ghost" asChild>
          <a href="/test">Link Button</a>
        </GlassButton>
      );
      
      const link = container.querySelector("a");
      expect(link).toBeDefined();
      
      // CSS variable classes should be applied to the link element
      expect(link!.className).toContain("text-[color:var(--ghost-text-light)]");
      expect(link!.className).toContain("dark:text-[color:var(--ghost-text-dark)]");
    });
  });
});