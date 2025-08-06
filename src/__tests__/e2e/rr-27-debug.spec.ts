/**
 * RR-27: Debug Test for State Preservation
 */

import { test, expect, type Page } from '@playwright/test';

const RSS_READER_URL = 'http://100.96.166.53:3000/reader';

test.describe('RR-27: Debug Tests', () => {
  test('should load the RSS reader and basic functionality', async ({ page }) => {
    console.log('Navigating to RSS reader...');
    await page.goto(RSS_READER_URL);
    
    // Wait for the page to load
    await page.waitForTimeout(5000);
    
    // Take a screenshot to see what's on screen
    await page.screenshot({ path: 'debug-initial-load.png', fullPage: true });
    
    // Check if articles are loading
    const articles = page.locator('[data-article-id]');
    console.log('Waiting for articles to load...');
    
    try {
      await articles.first().waitFor({ timeout: 30000 });
      const count = await articles.count();
      console.log(`Found ${count} articles`);
      
      if (count > 0) {
        // Try to get the first article's text content
        const firstArticle = articles.first();
        const text = await firstArticle.textContent();
        console.log('First article preview:', text?.substring(0, 100));
        
        // Check if "Unread" filter button exists
        const unreadButton = page.locator('button:has-text("Unread")');
        const hasUnreadButton = await unreadButton.isVisible();
        console.log('Unread button visible:', hasUnreadButton);
        
        if (hasUnreadButton) {
          console.log('Clicking Unread filter...');
          await unreadButton.click();
          await page.waitForTimeout(1000);
          
          const countAfterFilter = await articles.count();
          console.log(`Articles after filtering: ${countAfterFilter}`);
        }
        
        // Take another screenshot
        await page.screenshot({ path: 'debug-after-filter.png', fullPage: true });
        
        // Try to click first article
        console.log('Attempting to click first article...');
        
        // Check for any overlays that might be blocking clicks
        const overlays = page.locator('.loading, .spinner, .overlay, [data-loading="true"]');
        const overlayCount = await overlays.count();
        console.log('Found overlays:', overlayCount);
        
        if (overlayCount > 0) {
          console.log('Waiting for overlays to disappear...');
          await overlays.first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {
            console.log('Overlays did not disappear');
          });
        }
        
        // Force click to bypass any intercepting elements
        await firstArticle.click({ force: true });
        console.log('Clicked article with force');
        
        // Wait for navigation or timeout
        await page.waitForTimeout(2000);
        
        const currentUrl = page.url();
        console.log('Current URL after click:', currentUrl);
        
        // Take final screenshot
        await page.screenshot({ path: 'debug-after-click.png', fullPage: true });
        
      } else {
        console.log('No articles found');
        await page.screenshot({ path: 'debug-no-articles.png', fullPage: true });
      }
    } catch (error) {
      console.log('Error during test:', error);
      await page.screenshot({ path: 'debug-error.png', fullPage: true });
      throw error;
    }
  });

  test('should check app state and loading conditions', async ({ page }) => {
    await page.goto(RSS_READER_URL);
    
    // Wait for initial load and check app state
    await page.waitForTimeout(3000);
    
    // Check what's actually loaded
    const bodyContent = await page.locator('body').innerHTML();
    console.log('Body has content:', bodyContent.length > 100);
    
    // Check for React hydration
    const reactElements = page.locator('[data-reactroot], #__next');
    const hasReact = await reactElements.count() > 0;
    console.log('React app detected:', hasReact);
    
    // Check for any error messages
    const errorMessages = page.locator('[role="alert"], .error, .error-message');
    const errorCount = await errorMessages.count();
    console.log('Error messages found:', errorCount);
    
    if (errorCount > 0) {
      const errorText = await errorMessages.first().textContent();
      console.log('Error text:', errorText);
    }
    
    // Check for loading states
    const loadingElements = page.locator('.loading, .spinner, [aria-label*="loading"]');
    const loadingCount = await loadingElements.count();
    console.log('Loading elements found:', loadingCount);
    
    // Check for article list container
    const articleContainer = page.locator('.article-list-container, [data-testid="article-list"]');
    const hasContainer = await articleContainer.isVisible();
    console.log('Article container visible:', hasContainer);
    
    // Check network requests
    page.on('response', response => {
      if (response.url().includes('api')) {
        console.log(`API Response: ${response.url()} - ${response.status()}`);
      }
    });
    
    await page.waitForTimeout(5000);
    
    await page.screenshot({ path: 'debug-app-state.png', fullPage: true });
  });
});