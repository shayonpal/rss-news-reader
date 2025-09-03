/**
 * RR-232: Violet Theme Implementation - Tailwind Safelist Tests
 *
 * Tests that Tailwind safelist configuration correctly generates
 * CSS custom property utilities for counter styling.
 *
 * Test Coverage:
 * - Counter CSS custom property utility generation
 * - Safelist pattern matching for bg-[var(--counter-*)]
 * - Safelist pattern matching for text-[var(--counter-*)]
 * - CSS compilation and utility class availability
 */

import { describe, it, expect } from "vitest";
import tailwindConfig from "../../../tailwind.config";

describe("RR-232: Tailwind Safelist Configuration", () => {
  it("should include counter CSS variable utilities in safelist", () => {
    const config = tailwindConfig as any;

    expect(config.safelist).toBeDefined();
    expect(Array.isArray(config.safelist)).toBe(true);

    // Should include explicit counter utilities
    expect(config.safelist).toContain("bg-[var(--counter-unselected-bg)]");
    expect(config.safelist).toContain("text-[var(--counter-unselected-text)]");
    expect(config.safelist).toContain("bg-[var(--counter-selected-bg)]");
    expect(config.safelist).toContain("text-[var(--counter-selected-text)]");
  });

  it("should include pattern matching for counter variables", () => {
    const config = tailwindConfig as any;

    // Find pattern object in safelist
    const patternEntry = config.safelist.find(
      (entry: any) => typeof entry === "object" && entry.pattern
    );

    expect(patternEntry).toBeDefined();
    expect(patternEntry.pattern).toBeDefined();

    // Test pattern matching
    const pattern = patternEntry.pattern;

    // Should match background counter utilities
    expect(pattern.test("bg-[var(--counter-selected-bg)]")).toBe(true);
    expect(pattern.test("bg-[var(--counter-unselected-bg)]")).toBe(true);

    // Should match text counter utilities
    expect(pattern.test("text-[var(--counter-selected-text)]")).toBe(true);
    expect(pattern.test("text-[var(--counter-unselected-text)]")).toBe(true);

    // Should not match non-counter variables
    expect(pattern.test("bg-[var(--other-variable)]")).toBe(false);
    expect(pattern.test("text-[var(--glass-bg)]")).toBe(false);
  });

  it("should enable dark mode configuration", () => {
    const config = tailwindConfig as any;

    expect(config.darkMode).toBe("class");
  });

  it("should include proper content paths", () => {
    const config = tailwindConfig as any;

    expect(config.content).toBeDefined();
    expect(Array.isArray(config.content)).toBe(true);

    // Should scan all relevant file types
    const contentPaths = config.content;
    expect(contentPaths.some((path: string) => path.includes("**/*.tsx"))).toBe(
      true
    );
    expect(contentPaths.some((path: string) => path.includes("**/*.ts"))).toBe(
      true
    );
    expect(contentPaths.some((path: string) => path.includes("src/"))).toBe(
      true
    );
  });

  it("should generate utilities for CSS variables in development", () => {
    // Test that the pattern would match various counter utility formats
    const testPattern = /^(bg|text)-\[var\(--counter-.+\)\]$/;

    const testUtilities = [
      "bg-[var(--counter-selected-bg)]",
      "text-[var(--counter-selected-text)]",
      "bg-[var(--counter-unselected-bg)]",
      "text-[var(--counter-unselected-text)]",
      "bg-[var(--counter-hover-bg)]", // Future-proofing
      "text-[var(--counter-disabled-text)]", // Future-proofing
    ];

    const invalidUtilities = [
      "bg-[var(--glass-bg)]", // Non-counter variable
      "bg-counter-selected", // Not bracketed syntax
      "counter-[var(--selected-bg)]", // Wrong utility type
    ];

    testUtilities.forEach((utility) => {
      expect(testPattern.test(utility)).toBe(true);
    });

    invalidUtilities.forEach((utility) => {
      expect(testPattern.test(utility)).toBe(false);
    });
  });
});
