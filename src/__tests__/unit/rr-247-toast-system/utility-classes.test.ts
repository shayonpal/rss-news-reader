/**
 * RR-247: Toast System Utility Classes Tests
 *
 * Tests that validate the utility classes are properly defined in globals.css.
 * These tests MUST pass after implementation - they define the specification.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("Toast System Utility Classes Validation", () => {
  const globalsCSS = readFileSync(
    join(process.cwd(), "src/app/globals.css"),
    "utf8"
  );

  describe("Utility Class Definitions", () => {
    const utilityClasses = [
      {
        class: ".toast-success",
        bgVar: "--toast-success-bg",
        textVar: "--toast-success-text",
      },
      {
        class: ".toast-warning",
        bgVar: "--toast-warning-bg",
        textVar: "--toast-warning-text",
      },
      {
        class: ".toast-error",
        bgVar: "--toast-error-bg",
        textVar: "--toast-error-text",
      },
      {
        class: ".toast-info",
        bgVar: "--toast-info-bg",
        textVar: "--toast-info-text",
      },
    ];

    it.each(utilityClasses)(
      "should define $class utility class with CSS variables",
      ({ class: className, bgVar, textVar }) => {
        // Class should be defined
        expect(globalsCSS).toContain(className);

        // Should reference correct CSS variables
        expect(globalsCSS).toMatch(
          new RegExp(`\\${className}[\\s\\S]*var\\(${bgVar}\\)`)
        );
        expect(globalsCSS).toMatch(
          new RegExp(`\\${className}[\\s\\S]*var\\(${textVar}\\)`)
        );

        // Should use !important for specificity
        expect(globalsCSS).toMatch(
          new RegExp(`\\${className}[\\s\\S]*!important`)
        );
      }
    );

    it("should define all utility classes in proper CSS structure", () => {
      // Should have proper CSS structure with background and color properties
      expect(globalsCSS).toMatch(
        /\.toast-success\s*\{[\s\S]*background:[\s\S]*color:[\s\S]*\}/
      );
      expect(globalsCSS).toMatch(
        /\.toast-warning\s*\{[\s\S]*background:[\s\S]*color:[\s\S]*\}/
      );
      expect(globalsCSS).toMatch(
        /\.toast-error\s*\{[\s\S]*background:[\s\S]*color:[\s\S]*\}/
      );
      expect(globalsCSS).toMatch(
        /\.toast-info\s*\{[\s\S]*background:[\s\S]*color:[\s\S]*\}/
      );
    });

    it("should use consistent !important specificity pattern", () => {
      const importantPattern =
        /\.toast-(success|warning|error|info)[\s\S]*?!important/g;
      const importantMatches = globalsCSS.match(importantPattern);

      // Should have at least 4 !important declarations (one per toast class)
      expect(importantMatches).toBeTruthy();
      expect(importantMatches!.length).toBeGreaterThanOrEqual(4);
    });
  });

  describe("CSS Organization", () => {
    it("should place utility classes after token definitions", () => {
      const tokenIndex = globalsCSS.indexOf("--toast-success-bg:");
      const utilityIndex = globalsCSS.indexOf(".toast-success {");

      expect(tokenIndex).toBeGreaterThan(0);
      expect(utilityIndex).toBeGreaterThan(0);
      expect(utilityIndex).toBeGreaterThan(tokenIndex);
    });

    it("should include comment documentation", () => {
      expect(globalsCSS).toContain(
        "Toast utility classes with !important for Sonner override"
      );
    });
  });

  describe("Integration with Existing CSS", () => {
    it("should not conflict with existing CSS classes", () => {
      // Should not override existing glass or button classes
      expect(globalsCSS).not.toMatch(/\.toast-\w+[\s\S]*backdrop-filter/);
      expect(globalsCSS).not.toMatch(/\.toast-\w+[\s\S]*border-radius/);
    });

    it("should maintain CSS file structure", () => {
      // Should still have existing glass components
      expect(globalsCSS).toContain("liquid-glass");
      expect(globalsCSS).toContain("glass-segment");

      // Toast section should be at the end
      const toastIndex = globalsCSS.indexOf("RR-247: Toast System");
      const fileLength = globalsCSS.length;

      // Toast section should be in last 25% of file
      expect(toastIndex / fileLength).toBeGreaterThan(0.75);
    });
  });
});
