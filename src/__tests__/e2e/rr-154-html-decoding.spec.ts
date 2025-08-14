import { test, expect } from "@playwright/test";

/**
 * RR-154: E2E tests for HTML entity decoding feature
 * These tests verify the complete user experience after implementation.
 *
 * Test Environment: http://100.96.166.53:3000/reader
 *
 * Requirements:
 * - Articles display with properly decoded text (no visible HTML entities)
 * - URLs in article links work correctly
 * - Performance is not degraded
 */

test.describe("RR-154: HTML Entity Decoding E2E Tests", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the RSS reader
    await page.goto("http://100.96.166.53:3000/reader");
    await page.waitForLoadState("networkidle");
  });

  test.describe("Article Display", () => {
    test("should display article titles without HTML entities", async ({
      page,
    }) => {
      // Wait for articles to load
      await page.waitForSelector('[data-testid="article-list"]', {
        timeout: 10000,
      });

      // Get all article titles
      const titles = await page
        .locator('[data-testid="article-title"]')
        .allTextContents();

      // Verify no HTML entities are visible
      titles.forEach((title) => {
        // Common entities that should NOT appear
        expect(title).not.toContain("&rsquo;");
        expect(title).not.toContain("&lsquo;");
        expect(title).not.toContain("&ldquo;");
        expect(title).not.toContain("&rdquo;");
        expect(title).not.toContain("&amp;");
        expect(title).not.toContain("&quot;");
        expect(title).not.toContain("&ndash;");
        expect(title).not.toContain("&mdash;");
        expect(title).not.toContain("&#8217;");
        expect(title).not.toContain("&lt;");
        expect(title).not.toContain("&gt;");
      });

      // Verify at least some articles are present
      expect(titles.length).toBeGreaterThan(0);
    });

    test("should display article content without HTML entities", async ({
      page,
    }) => {
      // Click on the first article to view content
      const firstArticle = page.locator('[data-testid="article-item"]').first();
      await firstArticle.click();

      // Wait for article content to load
      await page.waitForSelector('[data-testid="article-content"]', {
        timeout: 10000,
      });

      // Get article content
      const content = await page
        .locator('[data-testid="article-content"]')
        .textContent();

      if (content) {
        // Verify no HTML entities in content
        expect(content).not.toContain("&rsquo;");
        expect(content).not.toContain("&lsquo;");
        expect(content).not.toContain("&ldquo;");
        expect(content).not.toContain("&rdquo;");
        expect(content).not.toContain("&amp;");
        expect(content).not.toContain("&ndash;");
        expect(content).not.toContain("&mdash;");
        expect(content).not.toContain("&#8217;");

        // Verify proper characters are displayed
        // These are harder to test without knowing exact content,
        // but we can check that common replacements worked
        if (content.includes("'")) {
          // Apostrophes should be present in natural text
          expect(content).toMatch(/\w'\w/); // Word'word pattern
        }
      }
    });

    test("should display decoded characters in article preview", async ({
      page,
    }) => {
      // Look for article previews/descriptions
      const previews = await page
        .locator('[data-testid="article-preview"]')
        .allTextContents();

      previews.forEach((preview) => {
        // No entities should be visible
        expect(preview).not.toContain("&rsquo;");
        expect(preview).not.toContain("&amp;");
        expect(preview).not.toContain("&quot;");
        expect(preview).not.toContain("&#");
      });
    });
  });

  test.describe("Article Links", () => {
    test("should preserve article URLs correctly", async ({ page }) => {
      // Get all article links
      const links = await page
        .locator('[data-testid="article-link"]')
        .evaluateAll((elements) =>
          elements.map((el) => (el as HTMLAnchorElement).href)
        );

      links.forEach((link) => {
        // URLs should be valid
        expect(() => new URL(link)).not.toThrow();

        // Query parameters with & should work
        if (link.includes("?")) {
          const url = new URL(link);
          expect(url.search).toMatch(/^\?[\w=&]+/);
        }
      });
    });

    test("should open article in new tab with correct URL", async ({
      page,
      context,
    }) => {
      // Find an article with external link
      const articleWithLink = page
        .locator('[data-testid="article-external-link"]')
        .first();

      if ((await articleWithLink.count()) > 0) {
        // Get the href
        const href = await articleWithLink.getAttribute("href");

        if (href) {
          // Verify URL is valid and contains parameters if expected
          const url = new URL(href);
          expect(url.protocol).toMatch(/^https?:$/);

          // Click and verify new tab opens (if target="_blank")
          const target = await articleWithLink.getAttribute("target");
          if (target === "_blank") {
            const [newPage] = await Promise.all([
              context.waitForEvent("page"),
              articleWithLink.click(),
            ]);

            // Verify new page URL
            expect(newPage.url()).toBe(href);
            await newPage.close();
          }
        }
      }
    });
  });

  test.describe("Sync Functionality", () => {
    test("should sync articles with properly decoded entities", async ({
      page,
    }) => {
      // Trigger manual sync
      const syncButton = page.locator('[data-testid="sync-button"]');

      if ((await syncButton.count()) > 0) {
        // Record initial article count
        const initialArticles = await page
          .locator('[data-testid="article-item"]')
          .count();

        // Click sync
        await syncButton.click();

        // Wait for sync to complete
        await page.waitForSelector(
          '[data-testid="sync-status"]:has-text("Complete")',
          {
            timeout: 30000,
          }
        );

        // Check new articles don't have entities
        const newArticles = await page
          .locator('[data-testid="article-item"]')
          .count();

        if (newArticles > initialArticles) {
          // Get the newest articles
          const newTitles = await page
            .locator('[data-testid="article-title"]')
            .first()
            .locator("xpath=following-sibling::*")
            .allTextContents();

          newTitles.forEach((title) => {
            expect(title).not.toContain("&rsquo;");
            expect(title).not.toContain("&amp;");
            expect(title).not.toContain("&#");
          });
        }
      }
    });
  });

  test.describe("Search and Filter", () => {
    test("should search with decoded text", async ({ page }) => {
      // Use search if available
      const searchInput = page.locator('[data-testid="search-input"]');

      if ((await searchInput.count()) > 0) {
        // Search for text that would have entities
        await searchInput.fill("Biden's"); // Would be Biden&rsquo;s
        await searchInput.press("Enter");

        // Wait for search results
        await page.waitForTimeout(1000);

        // Verify results show decoded text
        const results = await page
          .locator('[data-testid="article-title"]')
          .allTextContents();

        results.forEach((title) => {
          if (title.toLowerCase().includes("biden")) {
            // Should show apostrophe, not entity
            expect(title).toContain("'");
            expect(title).not.toContain("&rsquo;");
          }
        });
      }
    });

    test("should filter by feed with decoded names", async ({ page }) => {
      // Check feed filter
      const feedFilter = page.locator('[data-testid="feed-filter"]');

      if ((await feedFilter.count()) > 0) {
        // Get feed names
        const feedNames = await feedFilter.locator("option").allTextContents();

        feedNames.forEach((name) => {
          // Feed names should not have entities
          expect(name).not.toContain("&amp;");
          expect(name).not.toContain("&rsquo;");
          expect(name).not.toContain("&#");
        });
      }
    });
  });

  test.describe("Performance", () => {
    test("should load articles quickly with decoding", async ({ page }) => {
      const startTime = Date.now();

      // Navigate and wait for articles
      await page.goto("http://100.96.166.53:3000/reader");
      await page.waitForSelector('[data-testid="article-list"]', {
        timeout: 10000,
      });

      const loadTime = Date.now() - startTime;

      // Should load within reasonable time (< 3 seconds)
      expect(loadTime).toBeLessThan(3000);

      // Verify articles are displayed
      const articleCount = await page
        .locator('[data-testid="article-item"]')
        .count();
      expect(articleCount).toBeGreaterThan(0);
    });

    test("should handle infinite scroll with decoded content", async ({
      page,
    }) => {
      // Wait for initial articles
      await page.waitForSelector('[data-testid="article-list"]');

      const initialCount = await page
        .locator('[data-testid="article-item"]')
        .count();

      if (initialCount >= 20) {
        // Scroll to bottom to trigger infinite scroll
        await page.evaluate(() =>
          window.scrollTo(0, document.body.scrollHeight)
        );

        // Wait for more articles to load
        await page.waitForTimeout(2000);

        const newCount = await page
          .locator('[data-testid="article-item"]')
          .count();

        if (newCount > initialCount) {
          // Check new articles for entities
          const lastArticles = await page
            .locator('[data-testid="article-title"]')
            .evaluateAll(
              (elements, initial) =>
                elements.slice(initial).map((el) => el.textContent || ""),
              initialCount
            );

          lastArticles.forEach((title) => {
            expect(title).not.toContain("&rsquo;");
            expect(title).not.toContain("&amp;");
            expect(title).not.toContain("&#");
          });
        }
      }
    });
  });

  test.describe("AI Summary", () => {
    test("should display AI summaries with decoded text", async ({ page }) => {
      // Find article with AI summary button
      const aiButton = page
        .locator('[data-testid="ai-summary-button"]')
        .first();

      if ((await aiButton.count()) > 0) {
        // Click to generate/show summary
        await aiButton.click();

        // Wait for summary to load
        await page.waitForSelector('[data-testid="ai-summary-content"]', {
          timeout: 15000,
        });

        // Get summary text
        const summary = await page
          .locator('[data-testid="ai-summary-content"]')
          .textContent();

        if (summary) {
          // Summary should not contain entities
          expect(summary).not.toContain("&rsquo;");
          expect(summary).not.toContain("&amp;");
          expect(summary).not.toContain("&quot;");
          expect(summary).not.toContain("&#");

          // Should contain proper punctuation
          expect(summary).toMatch(/[.!?]$/); // Ends with punctuation
        }
      }
    });
  });

  test.describe("Mobile Responsiveness", () => {
    test("should display decoded content on mobile viewport", async ({
      page,
    }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });

      // Navigate to reader
      await page.goto("http://100.96.166.53:3000/reader");
      await page.waitForSelector('[data-testid="article-list"]');

      // Check mobile article display
      const mobileTitles = await page
        .locator('[data-testid="article-title"]')
        .allTextContents();

      mobileTitles.forEach((title) => {
        // No entities on mobile either
        expect(title).not.toContain("&rsquo;");
        expect(title).not.toContain("&amp;");
        expect(title).not.toContain("&#");
      });

      // Verify at least some articles loaded
      expect(mobileTitles.length).toBeGreaterThan(0);
    });
  });

  test.describe("Accessibility", () => {
    test("should have proper text for screen readers", async ({ page }) => {
      // Check aria-labels don't have entities
      const ariaLabels = await page
        .locator("[aria-label]")
        .evaluateAll((elements) =>
          elements.map((el) => el.getAttribute("aria-label"))
        );

      ariaLabels.forEach((label) => {
        if (label) {
          expect(label).not.toContain("&rsquo;");
          expect(label).not.toContain("&amp;");
          expect(label).not.toContain("&#");
        }
      });

      // Check alt text for images
      const altTexts = await page
        .locator("img[alt]")
        .evaluateAll((elements) =>
          elements.map((el) => el.getAttribute("alt"))
        );

      altTexts.forEach((alt) => {
        if (alt) {
          expect(alt).not.toContain("&rsquo;");
          expect(alt).not.toContain("&amp;");
          expect(alt).not.toContain("&#");
        }
      });
    });
  });
});
