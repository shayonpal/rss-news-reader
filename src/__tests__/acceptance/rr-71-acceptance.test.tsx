import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";

/**
 * Acceptance tests for RR-71 user experience validation
 * Tests the core acceptance criteria from Linear issue
 */
describe("RR-71: User Experience Acceptance Tests", () => {
  const srcPath = join(process.cwd(), "src");

  describe("AC1: No visible authentication UI elements", () => {
    it("should not have any auth components available", () => {
      const authDir = join(srcPath, "components/auth");
      expect(existsSync(authDir)).toBe(false);
    });

    it("should not import auth components in main pages", () => {
      const homePage = join(srcPath, "app/page.tsx");
      const homeContent = readFileSync(homePage, "utf-8");

      // Should not import any auth components
      expect(homeContent).not.toMatch(/@\/components\/auth/);
      expect(homeContent).not.toMatch(/AuthStatus|LoginButton|UserProfile/);
    });
  });

  describe("AC2: Header shows clean RSS Reader branding", () => {
    it("should have RSS Reader branding in header component", () => {
      const headerPath = join(srcPath, "components/layout/header.tsx");
      const headerContent = readFileSync(headerPath, "utf-8");

      // Should contain RSS Reader branding
      expect(headerContent).toMatch(/RSS Reader/);
    });
  });

  describe("AC3: All core functionality preserved", () => {
    it("should preserve sync functionality", () => {
      const headerPath = join(srcPath, "components/layout/header.tsx");
      const headerContent = readFileSync(headerPath, "utf-8");

      // Should have sync functionality
      expect(headerContent).toMatch(/performFullSync|RefreshCw/);
    });

    it("should preserve article reading functionality", () => {
      const homePage = join(srcPath, "app/page.tsx");
      const homeContent = readFileSync(homePage, "utf-8");

      // Should import ArticleList and ArticleHeader
      expect(homeContent).toMatch(/ArticleList|ArticleHeader/);
    });

    it("should preserve feed selection functionality", () => {
      const homePage = join(srcPath, "app/page.tsx");
      const homeContent = readFileSync(homePage, "utf-8");

      // Should import SimpleFeedSidebar
      expect(homeContent).toMatch(/SimpleFeedSidebar/);
    });
  });

  describe("AC4: SimpleFeedSidebar displays feeds with unread counts", () => {
    it("should use SimpleFeedSidebar component", () => {
      const simpleFeedSidebarPath = join(
        srcPath,
        "components/feeds/simple-feed-sidebar.tsx"
      );
      const feedSidebarPath = join(
        srcPath,
        "components/feeds/feed-sidebar.tsx"
      );

      // SimpleFeedSidebar should exist
      expect(existsSync(simpleFeedSidebarPath)).toBe(true);

      // FeedSidebar should not exist
      expect(existsSync(feedSidebarPath)).toBe(false);
    });

    it("should import SimpleFeedSidebar in main page", () => {
      const homePage = join(srcPath, "app/page.tsx");
      const homeContent = readFileSync(homePage, "utf-8");

      // Should import SimpleFeedSidebar, not FeedSidebar
      expect(homeContent).toMatch(/SimpleFeedSidebar/);
      expect(homeContent).not.toMatch(/from.*\/feed-sidebar/);
    });
  });

  describe("AC5: No console errors in codebase", () => {
    it("should not have broken imports in TypeScript files", () => {
      // Check that header doesn't import deleted components
      const headerPath = join(srcPath, "components/layout/header.tsx");
      const headerContent = readFileSync(headerPath, "utf-8");

      expect(headerContent).not.toMatch(/@\/components\/auth/);
      expect(headerContent).not.toMatch(/auth-store/);
    });

    it("should not have broken imports in API client", () => {
      const clientPath = join(srcPath, "lib/api/client.ts");
      const clientContent = readFileSync(clientPath, "utf-8");

      expect(clientContent).not.toMatch(/auth-store/);
    });
  });

  describe("Core Component Validation", () => {
    it("should have all essential components available", () => {
      const essentialComponents = [
        "components/feeds/simple-feed-sidebar.tsx",
        "components/articles/article-header.tsx",
        "components/articles/article-list.tsx",
        "components/layout/header.tsx",
      ];

      essentialComponents.forEach((component) => {
        const componentPath = join(srcPath, component);
        expect(existsSync(componentPath)).toBe(true);
      });
    });

    it("should have properly updated feeds index export", () => {
      const feedsIndexPath = join(srcPath, "components/feeds/index.ts");
      const feedsIndexContent = readFileSync(feedsIndexPath, "utf-8");

      // Should not export FeedSidebar
      expect(feedsIndexContent).not.toMatch(/FeedSidebar.*feed-sidebar/);
    });
  });
});
