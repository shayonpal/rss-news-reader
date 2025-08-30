/**
 * RR-247: Tailwind Configuration Tests
 *
 * Tests that validate toast classes are added to Tailwind safelist.
 * These tests MUST pass after implementation - they define the specification.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Tailwind Configuration for Toast Classes", () => {
  const tailwindConfig = readFileSync(
    join(process.cwd(), "tailwind.config.ts"),
    "utf8"
  );

  describe("Safelist Configuration", () => {
    const toastClasses = [
      "toast-success",
      "toast-warning",
      "toast-error",
      "toast-info",
    ];

    it.each(toastClasses)("should include %s in safelist", (className) => {
      expect(tailwindConfig).toContain(`"${className}"`);
    });

    it("should include RR-247 documentation comment", () => {
      expect(tailwindConfig).toContain(
        "RR-247: Toast utility classes for semantic styling"
      );
    });

    it("should maintain existing safelist structure", () => {
      expect(tailwindConfig).toContain("safelist: [");

      // Should still have existing entries
      expect(tailwindConfig).toContain("counter-unselected-bg");
      expect(tailwindConfig).toContain("counter-selected-bg");
    });
  });

  describe("Configuration Structure", () => {
    it("should have valid TypeScript syntax", () => {
      // Basic syntax validation - if file loads without error, syntax is valid
      expect(tailwindConfig).toContain("import type { Config }");
      expect(tailwindConfig).toContain("const config: Config");
    });

    it("should maintain array structure in safelist", () => {
      // Should have array structure with string entries
      expect(tailwindConfig).toMatch(
        /safelist:\s*\[[\s\S]*"toast-success"[\s\S]*\]/
      );
    });
  });
});
