/**
 * RR-247: Component Implementation Validation
 *
 * Tests that validate ArticleDetail component uses className instead of style props.
 * These tests MUST pass after implementation - they define the specification.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

describe("ArticleDetail Toast Implementation Validation", () => {
  const componentCode = readFileSync(
    join(process.cwd(), "src/components/articles/article-detail.tsx"),
    "utf8"
  );

  describe("Hardcoded Color Removal", () => {
    it("should not contain hardcoded toast colors", () => {
      // SPECIFICATION: No hardcoded hex colors for toasts
      expect(componentCode).not.toContain("#f59e0b"); // old amber
      expect(componentCode).not.toContain("#10b981"); // old green
      expect(componentCode).not.toContain("#ef4444"); // old red

      // Should not have style objects with background colors
      expect(componentCode).not.toMatch(
        /style:\s*\{[\s\S]*background:\s*["']#[a-fA-F0-9]{6}["']/
      );
    });

    it("should not have inline style objects for toasts", () => {
      // Should not have toast style objects
      expect(componentCode).not.toMatch(
        /toast\.(loading|success|error)[\s\S]*style:\s*\{[\s\S]*background:/
      );
    });
  });

  describe("Semantic className Usage", () => {
    it("should use toast-warning className for loading toast", () => {
      expect(componentCode).toMatch(
        /toast\.loading[\s\S]*className:\s*["']toast-warning["']/
      );
    });

    it("should use toast-success className for success toast", () => {
      expect(componentCode).toMatch(
        /toast\.success[\s\S]*className:\s*["']toast-success["']/
      );
    });

    it("should use toast-error className for error toast", () => {
      expect(componentCode).toMatch(
        /toast\.error[\s\S]*className:\s*["']toast-error["']/
      );
    });
  });

  describe("Toast Behavior Preservation", () => {
    it("should preserve toast ID for deduplication", () => {
      expect(componentCode).toContain("id: toastId");
    });

    it("should preserve toast durations", () => {
      expect(componentCode).toContain("duration: 3000"); // success toast
      expect(componentCode).toContain("duration: 0"); // error toast (manual dismiss)
    });

    it("should preserve toast message content", () => {
      expect(componentCode).toMatch(/marked.*as partial feed/);
      expect(componentCode).toMatch(/Failed to update.*Please try again/);
    });
  });

  describe("Method Structure", () => {
    it("should maintain handleToggleFeedPartialContent method", () => {
      expect(componentCode).toContain("handleToggleFeedPartialContent");
      expect(componentCode).toMatch(
        /handleToggleFeedPartialContent[\s\S]*async[\s\S]*=>/
      );
    });

    it("should maintain error handling structure", () => {
      expect(componentCode).toMatch(
        /try[\s\S]*await updateFeedPartialContent[\s\S]*catch/
      );
      expect(componentCode).toContain("finally");
    });
  });
});
