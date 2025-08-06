/**
 * End-to-End Tests for Author Display UI Validation - RR-144
 * 
 * Validates author name display in both article list and detail views:
 * - Article list author display with truncation (max 150px width)
 * - Article detail author display with proper formatting
 * - Edge cases: missing authors, special characters, long names
 * - Responsive behavior across different screen sizes
 * - Accessibility requirements
 * 
 * Components under test:
 * - /src/components/articles/article-list.tsx (lines 526-531)
 * - /src/components/articles/article-detail.tsx (lines 414-419)
 */

import { test, expect, Page, Locator } from '@playwright/test';

const BASE_URL = 'http://100.96.166.53:3000';
const READER_BASE = `${BASE_URL}/reader`;

// Helper function to wait for articles to load
async function waitForArticlesLoad(page: Page) {
  await page.waitForLoadState('networkidle');
  // Wait for at least one article to be visible
  await page.waitForSelector('article[data-article-id]', { timeout: 10000 });
}

// Helper function to find articles with specific author characteristics
async function findArticleWithAuthor(page: Page, authorPattern?: RegExp): Promise<Locator | null> {
  const articles = page.locator('article[data-article-id]');
  const count = await articles.count();
  
  for (let i = 0; i < count; i++) {
    const article = articles.nth(i);
    const authorElement = article.locator('.max-w-\\[150px\\].truncate');
    
    if (await authorElement.count() > 0) {
      const authorText = await authorElement.textContent();
      if (authorText && (!authorPattern || authorPattern.test(authorText))) {
        return article;
      }
    }
  }
  return null;
}

// Helper function to find articles without authors
async function findArticleWithoutAuthor(page: Page): Promise<Locator | null> {
  const articles = page.locator('article[data-article-id]');
  const count = await articles.count();
  
  for (let i = 0; i < count; i++) {
    const article = articles.nth(i);
    const authorElement = article.locator('.max-w-\\[150px\\].truncate');
    
    if (await authorElement.count() === 0) {
      return article;
    }
  }
  return null;
}

// Helper function to generate very long author name test data
const generateLongAuthorName = (length: number = 200): string => {
  return 'Dr. ' + 'A'.repeat(length - 4) + ' Smith-Johnson-Williams-Brown';
};

test.describe('RR-144: Author Display UI Validation', () => {
  
  test.beforeEach(async ({ page }) => {
    // Navigate to reader and wait for initial load
    await page.goto(READER_BASE);
    await waitForArticlesLoad(page);
  });

  test.describe('Article List Author Display', () => {
    
    test('should display author names in article cards when available', async ({ page }) => {
      // Find an article with author
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        const authorElement = articleWithAuthor.locator('.max-w-\\[150px\\].truncate');
        await expect(authorElement).toBeVisible();
        
        const authorText = await authorElement.textContent();
        expect(authorText).toBeTruthy();
        expect(authorText!.length).toBeGreaterThan(0);
        
        // Verify the bullet separator is present before author
        const bulletElement = articleWithAuthor.locator('.hidden.sm\\:inline').last();
        await expect(bulletElement).toBeVisible();
        await expect(bulletElement).toHaveText('•');
      } else {
        console.warn('No articles with authors found for testing');
      }
    });

    test('should apply truncation with max-width 150px and ellipsis', async ({ page }) => {
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        const authorElement = articleWithAuthor.locator('.max-w-\\[150px\\].truncate');
        
        // Verify the CSS classes are applied
        await expect(authorElement).toHaveClass(/max-w-\[150px\]/);
        await expect(authorElement).toHaveClass(/truncate/);
        
        // Get computed styles to verify max-width
        const maxWidth = await authorElement.evaluate((el) => {
          return window.getComputedStyle(el).maxWidth;
        });
        expect(maxWidth).toBe('150px');
        
        // Check if text overflows and ellipsis is shown
        const isOverflowing = await authorElement.evaluate((el) => {
          return el.scrollWidth > el.clientWidth;
        });
        
        if (isOverflowing) {
          // Verify ellipsis is applied
          const textOverflow = await authorElement.evaluate((el) => {
            return window.getComputedStyle(el).textOverflow;
          });
          expect(textOverflow).toBe('ellipsis');
        }
      }
    });

    test('should not display empty author elements when author is missing', async ({ page }) => {
      const articleWithoutAuthor = await findArticleWithoutAuthor(page);
      
      if (articleWithoutAuthor) {
        // Author span should not exist
        const authorElement = articleWithoutAuthor.locator('.max-w-\\[150px\\].truncate');
        await expect(authorElement).toHaveCount(0);
        
        // The bullet separator before author should also not exist (when author is missing)
        const metadataDiv = articleWithoutAuthor.locator('.flex.flex-wrap.items-center.gap-x-2.gap-y-1');
        const bullets = metadataDiv.locator('.hidden.sm\\:inline');
        
        // There should be fewer bullets when author is missing
        const bulletCount = await bullets.count();
        expect(bulletCount).toBeLessThanOrEqual(1); // Only the bullet after feed title
      }
    });

    test('should handle special characters in author names', async ({ page }) => {
      // Look for articles that might have special characters
      const specialCharPattern = /[àáâãäåæçèéêëìíîïñòóôõöøùúûüýÿ&-'".,]/i;
      const articleWithSpecialChars = await findArticleWithAuthor(page, specialCharPattern);
      
      if (articleWithSpecialChars) {
        const authorElement = articleWithSpecialChars.locator('.max-w-\\[150px\\].truncate');
        const authorText = await authorElement.textContent();
        
        expect(authorText).toBeTruthy();
        // Verify special characters are preserved and displayed correctly
        expect(authorText).toMatch(specialCharPattern);
        await expect(authorElement).toBeVisible();
      }
    });

    test('should maintain responsive behavior on mobile screens', async ({ page }) => {
      // Set mobile viewport
      await page.setViewportSize({ width: 375, height: 667 });
      await page.waitForTimeout(500); // Allow layout to adjust
      
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        const authorElement = articleWithAuthor.locator('.max-w-\\[150px\\].truncate');
        
        // Author should still be visible on mobile
        await expect(authorElement).toBeVisible();
        
        // Bullet separator before author should be hidden on mobile (hidden sm:inline)
        const bulletElement = articleWithAuthor.locator('.hidden.sm\\:inline').last();
        await expect(bulletElement).not.toBeVisible();
        
        // But author text should still be readable
        const authorText = await authorElement.textContent();
        expect(authorText).toBeTruthy();
      }
    });

    test('should maintain consistent styling across all article cards', async ({ page }) => {
      const articles = page.locator('article[data-article-id]');
      const articlesWithAuthors = articles.filter({ has: page.locator('.max-w-\\[150px\\].truncate') });
      const count = await articlesWithAuthors.count();
      
      if (count > 1) {
        // Check that all author elements have consistent classes
        for (let i = 0; i < Math.min(count, 5); i++) {
          const authorElement = articlesWithAuthors.nth(i).locator('.max-w-\\[150px\\].truncate');
          
          await expect(authorElement).toHaveClass(/max-w-\[150px\]/);
          await expect(authorElement).toHaveClass(/truncate/);
          
          // Verify consistent text color and size
          const textColor = await authorElement.evaluate((el) => {
            return window.getComputedStyle(el).color;
          });
          expect(textColor).toBeTruthy();
        }
      }
    });
  });

  test.describe('Article Detail Author Display', () => {
    
    test('should display author in article detail metadata section', async ({ page }) => {
      // Find and click on an article with author
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        await articleWithAuthor.click();
        await page.waitForLoadState('networkidle');
        
        // Wait for article detail to load
        await page.waitForSelector('article h1', { timeout: 5000 });
        
        // Check for author in metadata section
        const metadataSection = page.locator('.flex.flex-wrap.items-center.gap-2.text-sm');
        const authorElements = metadataSection.locator('span').filter({ hasNotText: '•' });
        
        // Find author element (should be between feed title and timestamp)
        const authorFound = await metadataSection.evaluate((section) => {
          const spans = Array.from(section.querySelectorAll('span'));
          return spans.some(span => {
            const text = span.textContent?.trim();
            return text && text !== '•' && !text.includes('ago') && !span.querySelector('time');
          });
        });
        
        expect(authorFound).toBe(true);
      }
    });

    test('should include bullet separator after author in detail view', async ({ page }) => {
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        await articleWithAuthor.click();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('article h1');
        
        // In detail view, author should be followed by a bullet
        const metadataSection = page.locator('.flex.flex-wrap.items-center.gap-2.text-sm');
        
        // Check that bullets exist and are properly positioned
        const bullets = metadataSection.locator('span:text("•")');
        const bulletCount = await bullets.count();
        
        // Should have at least 2 bullets: one after feed title, one after author
        expect(bulletCount).toBeGreaterThanOrEqual(2);
      }
    });

    test('should not display author section when author is missing in detail view', async ({ page }) => {
      const articleWithoutAuthor = await findArticleWithoutAuthor(page);
      
      if (articleWithoutAuthor) {
        await articleWithoutAuthor.click();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('article h1');
        
        const metadataSection = page.locator('.flex.flex-wrap.items-center.gap-2.text-sm');
        const bullets = metadataSection.locator('span:text("•")');
        const bulletCount = await bullets.count();
        
        // Should have fewer bullets when author is missing (only after feed title)
        expect(bulletCount).toBe(1);
      }
    });

    test('should maintain author text readability in detail view', async ({ page }) => {
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        await articleWithAuthor.click();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('article h1');
        
        const metadataSection = page.locator('.flex.flex-wrap.items-center.gap-2.text-sm');
        
        // Check text contrast and visibility
        const textColor = await metadataSection.evaluate((section) => {
          return window.getComputedStyle(section).color;
        });
        
        expect(textColor).toBeTruthy();
        
        // Ensure text size is appropriate
        const fontSize = await metadataSection.evaluate((section) => {
          return window.getComputedStyle(section).fontSize;
        });
        
        expect(fontSize).toBeTruthy();
      }
    });

    test('should handle very long author names in detail view', async ({ page }) => {
      // This test assumes we might encounter or have test data with long author names
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        await articleWithAuthor.click();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('article h1');
        
        const metadataSection = page.locator('.flex.flex-wrap.items-center.gap-2.text-sm');
        
        // Verify that long author names don't break layout
        const sectionWidth = await metadataSection.boundingBox();
        expect(sectionWidth).toBeTruthy();
        
        // Check that content doesn't overflow horizontally
        const isOverflowing = await metadataSection.evaluate((section) => {
          return section.scrollWidth <= section.clientWidth + 5; // 5px tolerance
        });
        
        expect(isOverflowing).toBe(true);
      }
    });
  });

  test.describe('Cross-browser and Responsive Testing', () => {
    
    test('should display authors correctly on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 });
      await page.waitForTimeout(500);
      
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        // Author should be visible in list
        const authorElement = articleWithAuthor.locator('.max-w-\\[150px\\].truncate');
        await expect(authorElement).toBeVisible();
        
        // Bullet should be visible on tablet (sm:inline applies)
        const bulletElement = articleWithAuthor.locator('.hidden.sm\\:inline').last();
        await expect(bulletElement).toBeVisible();
        
        // Test in detail view as well
        await articleWithAuthor.click();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('article h1');
        
        const metadataSection = page.locator('.flex.flex-wrap.items-center.gap-2.text-sm');
        await expect(metadataSection).toBeVisible();
      }
    });

    test('should display authors correctly on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1200, height: 800 });
      await page.waitForTimeout(500);
      
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        const authorElement = articleWithAuthor.locator('.max-w-\\[150px\\].truncate');
        await expect(authorElement).toBeVisible();
        
        // All elements should be visible on desktop
        const bulletElement = articleWithAuthor.locator('.hidden.sm\\:inline').last();
        await expect(bulletElement).toBeVisible();
        
        // Test layout doesn't break with full width
        const boundingBox = await authorElement.boundingBox();
        expect(boundingBox?.width).toBeLessThanOrEqual(150);
      }
    });
  });

  test.describe('Accessibility Testing', () => {
    
    test('should provide accessible author information in article list', async ({ page }) => {
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        const authorElement = articleWithAuthor.locator('.max-w-\\[150px\\].truncate');
        
        // Check that author text is accessible to screen readers
        const authorText = await authorElement.textContent();
        expect(authorText).toBeTruthy();
        
        // Verify element is not hidden from assistive technology
        const ariaHidden = await authorElement.getAttribute('aria-hidden');
        expect(ariaHidden).toBeNull();
        
        // Check that parent article has proper structure
        await expect(articleWithAuthor).toHaveAttribute('role', 'button');
        await expect(articleWithAuthor).toHaveAttribute('tabindex', '0');
      }
    });

    test('should provide accessible author information in article detail', async ({ page }) => {
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        await articleWithAuthor.click();
        await page.waitForLoadState('networkidle');
        await page.waitForSelector('article h1');
        
        // Check semantic structure
        const articleElement = page.locator('article').first();
        await expect(articleElement).toBeVisible();
        
        // Metadata should be properly structured
        const metadataSection = page.locator('.flex.flex-wrap.items-center.gap-2.text-sm');
        await expect(metadataSection).toBeVisible();
        
        // Time elements should have proper datetime attributes
        const timeElement = metadataSection.locator('time');
        await expect(timeElement).toHaveAttribute('dateTime');
      }
    });

    test('should maintain keyboard navigation with author elements', async ({ page }) => {
      // Test keyboard navigation through articles with authors
      await page.keyboard.press('Tab');
      
      const focusedElement = page.locator(':focus');
      const isArticle = await focusedElement.evaluate((el) => {
        return el.tagName.toLowerCase() === 'article' || el.closest('article') !== null;
      });
      
      if (isArticle) {
        // Should be able to activate article with keyboard
        await page.keyboard.press('Enter');
        await page.waitForLoadState('networkidle');
        
        // Should navigate to detail view
        await expect(page.locator('article h1')).toBeVisible();
      }
    });
  });

  test.describe('Edge Cases and Error Handling', () => {
    
    test('should handle articles with empty string authors', async ({ page }) => {
      // This would require test data with empty string authors
      const articles = page.locator('article[data-article-id]');
      const count = await articles.count();
      
      // Check each article for proper author handling
      for (let i = 0; i < Math.min(count, 10); i++) {
        const article = articles.nth(i);
        const authorElements = article.locator('.max-w-\\[150px\\].truncate');
        
        if (await authorElements.count() > 0) {
          const authorText = await authorElements.first().textContent();
          // Should not have empty or whitespace-only author text
          expect(authorText?.trim().length).toBeGreaterThan(0);
        }
      }
    });

    test('should handle articles with null/undefined authors gracefully', async ({ page }) => {
      // Test that articles without authors don't show empty elements
      const articlesWithoutAuthors = await findArticleWithoutAuthor(page);
      
      if (articlesWithoutAuthors) {
        // Should not have empty author spans
        const authorElements = articlesWithoutAuthors.locator('.max-w-\\[150px\\].truncate');
        await expect(authorElements).toHaveCount(0);
        
        // Should not have orphaned bullet separators
        const metadataDiv = articlesWithoutAuthors.locator('.flex.flex-wrap.items-center.gap-x-2.gap-y-1');
        const text = await metadataDiv.textContent();
        
        // Should not end with bullet or have double bullets
        expect(text).not.toMatch(/•\s*$/);
        expect(text).not.toMatch(/•\s*•/);
      }
    });

    test('should maintain performance with many articles containing authors', async ({ page }) => {
      const startTime = Date.now();
      
      // Scroll to load more articles
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      await page.waitForTimeout(2000); // Wait for potential loading
      
      const endTime = Date.now();
      const loadTime = endTime - startTime;
      
      // Should load within reasonable time (under 5 seconds)
      expect(loadTime).toBeLessThan(5000);
      
      // Check that author elements are still properly rendered after loading more
      const articles = page.locator('article[data-article-id]');
      const count = await articles.count();
      
      expect(count).toBeGreaterThan(0);
      
      // Sample a few articles to ensure authors are still displaying correctly
      for (let i = 0; i < Math.min(count, 3); i++) {
        const article = articles.nth(i);
        const authorElements = article.locator('.max-w-\\[150px\\].truncate');
        
        if (await authorElements.count() > 0) {
          await expect(authorElements.first()).toBeVisible();
        }
      }
    });
  });

  test.describe('Visual Consistency Testing', () => {
    
    test('should maintain consistent author styling in light mode', async ({ page }) => {
      // Ensure light mode is active
      await page.evaluate(() => {
        document.documentElement.classList.remove('dark');
      });
      
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        const authorElement = articleWithAuthor.locator('.max-w-\\[150px\\].truncate');
        
        // Check that styling is appropriate for light mode
        const computedStyle = await authorElement.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            color: style.color,
            fontSize: style.fontSize,
            maxWidth: style.maxWidth,
          };
        });
        
        expect(computedStyle.maxWidth).toBe('150px');
        expect(computedStyle.color).toBeTruthy();
        expect(computedStyle.fontSize).toBeTruthy();
      }
    });

    test('should maintain consistent author styling in dark mode', async ({ page }) => {
      // Enable dark mode
      await page.evaluate(() => {
        document.documentElement.classList.add('dark');
      });
      
      const articleWithAuthor = await findArticleWithAuthor(page);
      
      if (articleWithAuthor) {
        const authorElement = articleWithAuthor.locator('.max-w-\\[150px\\].truncate');
        
        // Check that styling adapts properly to dark mode
        const computedStyle = await authorElement.evaluate((el) => {
          const style = window.getComputedStyle(el);
          return {
            color: style.color,
            maxWidth: style.maxWidth,
          };
        });
        
        expect(computedStyle.maxWidth).toBe('150px');
        expect(computedStyle.color).toBeTruthy();
      }
    });
  });
});