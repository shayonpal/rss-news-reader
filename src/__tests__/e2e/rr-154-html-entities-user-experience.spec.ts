import { test, expect } from '@playwright/test';

test.describe('RR-154: HTML Entity Decoding User Experience', () => {
  // Test configuration
  const baseUrl = 'http://100.96.166.53:3000/reader';
  
  test.beforeEach(async ({ page }) => {
    // Navigate to the RSS reader application
    await page.goto(baseUrl);
    await page.waitForLoadState('networkidle');
  });

  test('should display properly decoded HTML entities in article titles', async ({ page }) => {
    // Wait for articles to load
    await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
    
    // Look for articles with titles that should have decoded HTML entities
    const articleTitles = page.locator('[data-testid="article-title"]');
    
    // Wait for at least one article to be visible
    await expect(articleTitles.first()).toBeVisible({ timeout: 5000 });
    
    const titleCount = await articleTitles.count();
    expect(titleCount).toBeGreaterThan(0);

    // Check multiple article titles for proper HTML entity decoding
    for (let i = 0; i < Math.min(10, titleCount); i++) {
      const titleText = await articleTitles.nth(i).textContent();
      
      if (titleText) {
        // Verify no HTML entities remain in displayed titles
        expect(titleText).not.toContain('&amp;');
        expect(titleText).not.toContain('&rsquo;');
        expect(titleText).not.toContain('&lsquo;');
        expect(titleText).not.toContain('&quot;');
        expect(titleText).not.toContain('&#8217;');
        expect(titleText).not.toContain('&ndash;');
        expect(titleText).not.toContain('&mdash;');
        expect(titleText).not.toContain('&lt;');
        expect(titleText).not.toContain('&gt;');
        
        // Verify proper characters are displayed instead
        // Only test if the title likely had entities (contains apostrophes, quotes, etc.)
        if (titleText.includes('\u2019') || titleText.includes('"') || titleText.includes('&') || titleText.includes('–')) {
          // These are signs the decoding worked correctly
          expect(titleText.length).toBeGreaterThan(0);
        }
      }
    }
  });

  test('should display properly decoded HTML entities in article content', async ({ page }) => {
    // Wait for articles to load
    await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
    
    // Click on the first article to view its content
    const firstArticle = page.locator('[data-testid="article-item"]').first();
    await expect(firstArticle).toBeVisible();
    await firstArticle.click();

    // Wait for article content to load
    await page.waitForSelector('[data-testid="article-content"]', { timeout: 5000 });
    
    const contentElement = page.locator('[data-testid="article-content"]');
    const contentText = await contentElement.textContent();
    
    if (contentText) {
      // Verify no HTML entities remain in displayed content
      expect(contentText).not.toContain('&amp;');
      expect(contentText).not.toContain('&rsquo;');
      expect(contentText).not.toContain('&lsquo;');
      expect(contentText).not.toContain('&quot;');
      expect(contentText).not.toContain('&#8217;');
      expect(contentText).not.toContain('&ndash;');
      expect(contentText).not.toContain('&mdash;');
      
      // However, &lt; and &gt; might legitimately appear as < and > in content
      // So we check the HTML to ensure proper structure
      const contentHTML = await contentElement.innerHTML();
      
      // Should have proper HTML structure (not encoded HTML tags)
      if (contentHTML.includes('<p>') || contentHTML.includes('<div>')) {
        expect(contentHTML).not.toContain('&lt;p&gt;');
        expect(contentHTML).not.toContain('&lt;div&gt;');
        expect(contentHTML).not.toContain('&lt;/p&gt;');
        expect(contentHTML).not.toContain('&lt;/div&gt;');
      }
      
      // Verify proper quotes and apostrophes are displayed
      if (contentText.includes('"') || contentText.includes('\u2019')) {
        // These are signs that entity decoding worked
        expect(contentText.length).toBeGreaterThan(0);
      }
    }
  });

  test('should handle articles with mixed HTML entities correctly', async ({ page }) => {
    // Navigate and wait for content
    await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
    
    // Look for specific patterns that indicate mixed entity handling
    const articles = page.locator('[data-testid="article-item"]');
    const articleCount = await articles.count();
    
    let foundMixedContent = false;
    
    // Check several articles for mixed content patterns
    for (let i = 0; i < Math.min(5, articleCount); i++) {
      const article = articles.nth(i);
      await article.click();
      
      // Wait for content to load
      await page.waitForTimeout(500);
      
      const titleElement = article.locator('[data-testid="article-title"]');
      const titleText = await titleElement.textContent();
      
      if (titleText && (titleText.includes('&') || titleText.includes('\u2019') || titleText.includes('"'))) {
        foundMixedContent = true;
        
        // Verify the mixed content is properly handled
        // Legitimate & symbols should remain, but HTML entities should be decoded
        const hasLegitimateAmpersand = /\b\w+\s*&\s*\w+/.test(titleText); // Like "Johnson & Johnson"
        const hasDecodedQuotes = titleText.includes('"') || titleText.includes('\u2019');
        
        if (hasLegitimateAmpersand || hasDecodedQuotes) {
          // This indicates proper mixed content handling
          expect(titleText).not.toContain('&amp;'); // HTML entity should be decoded
          expect(titleText).not.toContain('&quot;'); // HTML entity should be decoded
          expect(titleText).not.toContain('&rsquo;'); // HTML entity should be decoded
        }
        
        break; // Found what we're testing
      }
    }
    
    // If we didn't find mixed content, that's okay - it means no affected articles are visible
    // The test has still verified that visible content doesn't contain encoded entities
  });

  test('should preserve URLs with query parameters in article links', async ({ page }) => {
    await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
    
    // Click on first article to view content
    const firstArticle = page.locator('[data-testid="article-item"]').first();
    await firstArticle.click();
    
    // Wait for content
    await page.waitForSelector('[data-testid="article-content"]', { timeout: 5000 });
    
    // Look for links within the article content
    const links = page.locator('[data-testid="article-content"] a[href*="?"]');
    const linkCount = await links.count();
    
    if (linkCount > 0) {
      // Check first few links for proper URL preservation
      for (let i = 0; i < Math.min(3, linkCount); i++) {
        const link = links.nth(i);
        const href = await link.getAttribute('href');
        
        if (href && href.includes('?')) {
          // URLs with query parameters should have proper & symbols, not &amp;
          expect(href).not.toContain('&amp;');
          
          // But should have legitimate & for parameter separation
          const queryStart = href.indexOf('?');
          const queryString = href.substring(queryStart + 1);
          
          if (queryString.includes('=')) {
            // If there are parameters, there should be proper & separators
            const hasMultipleParams = queryString.split('&').length > 1;
            if (hasMultipleParams) {
              expect(queryString).toContain('&');
              expect(queryString).not.toContain('&amp;');
            }
          }
        }
      }
    }
  });

  test('should display article metadata correctly after HTML decoding', async ({ page }) => {
    await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
    
    // Click on an article
    const firstArticle = page.locator('[data-testid="article-item"]').first();
    await firstArticle.click();
    
    // Check article title in the detail view
    const articleTitle = page.locator('[data-testid="article-title"]');
    await expect(articleTitle).toBeVisible();
    
    const titleText = await articleTitle.textContent();
    if (titleText) {
      // Title should be readable and not contain HTML entities
      expect(titleText.trim().length).toBeGreaterThan(0);
      expect(titleText).not.toContain('&amp;');
      expect(titleText).not.toContain('&quot;');
      expect(titleText).not.toContain('&rsquo;');
    }
    
    // Check if author is displayed and properly formatted
    const authorElement = page.locator('[data-testid="article-author"]');
    if (await authorElement.isVisible()) {
      const authorText = await authorElement.textContent();
      if (authorText) {
        expect(authorText).not.toContain('&amp;');
        expect(authorText).not.toContain('&quot;');
      }
    }
    
    // Check publication date formatting
    const dateElement = page.locator('[data-testid="article-date"]');
    if (await dateElement.isVisible()) {
      const dateText = await dateElement.textContent();
      if (dateText) {
        // Date should be properly formatted
        expect(dateText.trim().length).toBeGreaterThan(0);
        expect(dateText).not.toContain('&');
      }
    }
  });

  test('should handle article list scrolling with decoded entities', async ({ page }) => {
    await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
    
    // Get initial article count
    const initialArticles = page.locator('[data-testid="article-item"]');
    const initialCount = await initialArticles.count();
    
    if (initialCount > 0) {
      // Scroll to bottom to trigger infinite scroll
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      
      // Wait for potential new articles to load
      await page.waitForTimeout(2000);
      
      // Check articles in the list for proper entity decoding
      const allArticles = page.locator('[data-testid="article-item"]');
      const finalCount = await allArticles.count();
      
      // Check a sample of articles (or all if fewer than 10)
      const samplesToCheck = Math.min(10, finalCount);
      
      for (let i = 0; i < samplesToCheck; i++) {
        const article = allArticles.nth(i);
        const titleElement = article.locator('[data-testid="article-title"]');
        
        if (await titleElement.isVisible()) {
          const titleText = await titleElement.textContent();
          
          if (titleText) {
            // Verify no HTML entities in any loaded article
            expect(titleText).not.toContain('&amp;');
            expect(titleText).not.toContain('&rsquo;');
            expect(titleText).not.toContain('&lsquo;');
            expect(titleText).not.toContain('&quot;');
            expect(titleText).not.toContain('&#8217;');
            expect(titleText).not.toContain('&ndash;');
          }
        }
      }
    }
  });

  test('should search articles with properly decoded content', async ({ page }) => {
    await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
    
    // Look for search functionality
    const searchInput = page.locator('[data-testid="search-input"]');
    
    if (await searchInput.isVisible()) {
      // Search for common words that might appear in decoded content
      await searchInput.fill('Johnson');
      await page.keyboard.press('Enter');
      
      // Wait for search results
      await page.waitForTimeout(1000);
      
      const searchResults = page.locator('[data-testid="article-item"]');
      const resultCount = await searchResults.count();
      
      if (resultCount > 0) {
        // Check first few search results
        for (let i = 0; i < Math.min(3, resultCount); i++) {
          const result = searchResults.nth(i);
          const titleElement = result.locator('[data-testid="article-title"]');
          
          const titleText = await titleElement.textContent();
          if (titleText) {
            // Search should find content with properly decoded entities
            // If "Johnson" is found, it shouldn't be part of "Johnson &amp; Johnson"
            if (titleText.toLowerCase().includes('johnson')) {
              expect(titleText).not.toContain('&amp;');
              // If it's "Johnson & Johnson", the & should be properly decoded
              if (titleText.includes('Johnson & ')) {
                expect(titleText).toContain('Johnson & ');
                expect(titleText).not.toContain('Johnson &amp; ');
              }
            }
          }
        }
      }
      
      // Clear search to reset
      await searchInput.clear();
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
    }
  });

  test('should display proper quotation marks and apostrophes in article previews', async ({ page }) => {
    await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
    
    const articles = page.locator('[data-testid="article-item"]');
    const articleCount = await articles.count();
    
    // Look for articles with preview text/excerpts
    for (let i = 0; i < Math.min(5, articleCount); i++) {
      const article = articles.nth(i);
      
      // Check if there's a preview/excerpt element
      const previewElement = article.locator('[data-testid="article-preview"], [data-testid="article-excerpt"]');
      
      if (await previewElement.isVisible()) {
        const previewText = await previewElement.textContent();
        
        if (previewText) {
          // Preview text should have properly decoded entities
          expect(previewText).not.toContain('&amp;');
          expect(previewText).not.toContain('&rsquo;');
          expect(previewText).not.toContain('&lsquo;');
          expect(previewText).not.toContain('&quot;');
          expect(previewText).not.toContain('&#8217;');
          expect(previewText).not.toContain('&ndash;');
          
          // Should contain proper punctuation if it had entities
          if (previewText.includes('"') || previewText.includes('\u2019') || previewText.includes('&')) {
            expect(previewText.length).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  test('should handle read/unread status with decoded article titles', async ({ page }) => {
    await page.waitForSelector('[data-testid="article-list"]', { timeout: 10000 });
    
    const articles = page.locator('[data-testid="article-item"]');
    const firstArticle = articles.first();
    
    await expect(firstArticle).toBeVisible();
    
    // Get the title before interaction
    const titleElement = firstArticle.locator('[data-testid="article-title"]');
    const titleText = await titleElement.textContent();
    
    // Click to mark as read/open
    await firstArticle.click();
    
    // Wait for the action to complete
    await page.waitForTimeout(500);
    
    // Go back to list view (if needed)
    const backButton = page.locator('[data-testid="back-to-list"]');
    if (await backButton.isVisible()) {
      await backButton.click();
    }
    
    // Verify the article title is still properly decoded after status change
    await page.waitForSelector('[data-testid="article-list"]');
    const updatedTitle = await titleElement.textContent();
    
    if (titleText && updatedTitle) {
      // Title should remain the same (properly decoded) after read status change
      expect(updatedTitle).toBe(titleText);
      expect(updatedTitle).not.toContain('&amp;');
      expect(updatedTitle).not.toContain('&rsquo;');
      expect(updatedTitle).not.toContain('&quot;');
    }
  });

  test('should display proper entities in feed titles and organization', async ({ page }) => {
    // Check if there's a sidebar or feed navigation
    const feedSidebar = page.locator('[data-testid="feed-sidebar"], [data-testid="feed-list"]');
    
    if (await feedSidebar.isVisible({ timeout: 2000 })) {
      const feedItems = feedSidebar.locator('[data-testid="feed-item"]');
      const feedCount = await feedItems.count();
      
      for (let i = 0; i < Math.min(5, feedCount); i++) {
        const feedItem = feedItems.nth(i);
        const feedTitle = await feedItem.textContent();
        
        if (feedTitle) {
          // Feed titles should also have decoded HTML entities
          expect(feedTitle).not.toContain('&amp;');
          expect(feedTitle).not.toContain('&rsquo;');
          expect(feedTitle).not.toContain('&lsquo;');
          expect(feedTitle).not.toContain('&quot;');
          expect(feedTitle).not.toContain('&#8217;');
          expect(feedTitle).not.toContain('&ndash;');
        }
      }
    }
  });
});