import { describe, it, expect, beforeEach, vi } from "vitest";
import DOMPurify from "isomorphic-dompurify";

// Mock Supabase before importing ArticleCountManager
vi.mock("@/lib/db/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn(),
        })),
      })),
    })),
  },
}));

import { getDynamicPageTitle } from "@/lib/article-count-manager";

describe("RR-213: Dynamic Page Title with Tag Support", () => {
  describe("getDynamicPageTitle with tag parameter", () => {
    describe("Priority Order Tests", () => {
      it("should prioritize tag over folder and feed", () => {
        const result = getDynamicPageTitle(
          "all",
          { title: "TechCrunch" },
          { title: "Tech Folder" },
          { name: "JavaScript" }
        );
        expect(result).toBe("JavaScript");
      });

      it("should prioritize folder over feed when no tag", () => {
        const result = getDynamicPageTitle(
          "unread",
          { title: "TechCrunch" },
          { title: "Tech Folder" },
          null
        );
        expect(result).toBe("Tech Folder");
      });

      it("should use feed when no tag or folder", () => {
        const result = getDynamicPageTitle(
          "read",
          { title: "TechCrunch" },
          null,
          null
        );
        expect(result).toBe("TechCrunch");
      });

      it("should default to 'Articles' when no filters selected", () => {
        const result = getDynamicPageTitle("all", null, null, null);
        expect(result).toBe("Articles");
      });
    });

    describe("XSS Protection Tests", () => {
      it("should sanitize tag names containing script tags", () => {
        const maliciousTag = {
          name: "<script>alert('xss')</script>Technology",
        };

        // Simulate what ArticleHeader will do - sanitize before passing
        const sanitizedTag = {
          name: DOMPurify.sanitize(maliciousTag.name, { ALLOWED_TAGS: [] }),
        };

        const result = getDynamicPageTitle("all", null, null, sanitizedTag);
        expect(result).toBe("Technology");
        expect(result).not.toContain("<script>");
      });

      it("should handle HTML entities in tag names", () => {
        const tagWithEntities = {
          name: DOMPurify.sanitize("C++ & <b>Advanced</b>", {
            ALLOWED_TAGS: [],
          }),
        };

        const result = getDynamicPageTitle("all", null, null, tagWithEntities);
        // DOMPurify encodes & as &amp; which is correct for security
        expect(result).toBe("C++ &amp; Advanced");
      });
    });

    describe("Edge Cases", () => {
      it("should handle undefined tag parameter", () => {
        const result = getDynamicPageTitle(
          "all",
          { title: "Feed" },
          { title: "Folder" },
          undefined
        );
        expect(result).toBe("Folder");
      });

      it("should handle empty tag name", () => {
        const result = getDynamicPageTitle("all", { title: "Feed" }, null, {
          name: "",
        });
        // With null-safe check, empty string returns "Feed" since selectedTag?.name is falsy
        expect(result).toBe("Feed");
      });

      it("should handle special characters in tag names", () => {
        const specialCharsTag = {
          name: "C#/.NET Framework",
        };

        const result = getDynamicPageTitle("all", null, null, specialCharsTag);
        expect(result).toBe("C#/.NET Framework");
      });

      it("should handle emoji in tag names", () => {
        const emojiTag = {
          name: "🚀 Startups",
        };

        const result = getDynamicPageTitle("all", null, null, emojiTag);
        expect(result).toBe("🚀 Startups");
      });

      it("should handle very long tag names", () => {
        const longTag = {
          name: "This is an extremely long tag name that might need to be truncated on mobile devices but should work correctly",
        };

        const result = getDynamicPageTitle("all", null, null, longTag);
        expect(result).toBe(longTag.name);
      });

      it("should handle Unicode/international characters", () => {
        const unicodeTag = {
          name: "日本語 Technology",
        };

        const result = getDynamicPageTitle("all", null, null, unicodeTag);
        expect(result).toBe("日本語 Technology");
      });
    });

    describe("Read Status Filter Compatibility", () => {
      it("should work with all read status filter", () => {
        const result = getDynamicPageTitle("all", null, null, {
          name: "React",
        });
        expect(result).toBe("React");
      });

      it("should work with unread status filter", () => {
        const result = getDynamicPageTitle("unread", null, null, {
          name: "Vue",
        });
        expect(result).toBe("Vue");
      });

      it("should work with read status filter", () => {
        const result = getDynamicPageTitle("read", null, null, {
          name: "Angular",
        });
        expect(result).toBe("Angular");
      });
    });
  });
});
