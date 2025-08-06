/**
 * Navigation Debug Test
 * 
 * Focus specifically on debugging why article clicks don't navigate
 */

import { test, expect, type Page } from '@playwright/test';

const RSS_READER_URL = 'http://100.96.166.53:3000/reader';

test.describe('Navigation Debug', () => {
  test('should debug article click navigation issues', async ({ page }) => {
    console.log('🚀 Starting navigation debug test...');
    
    // Monitor all navigation events
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        console.log(`[NAV] Frame navigated to: ${frame.url()}`);
      }
    });
    
    page.on('response', response => {
      if (response.url().includes('/article/') || response.url().includes('/api/')) {
        console.log(`[HTTP] ${response.status()} ${response.url()}`);
      }
    });
    
    // Monitor console errors
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[ERROR] ${msg.text()}`);
      } else if (msg.type() === 'log' && (msg.text().includes('click') || msg.text().includes('router') || msg.text().includes('nav'))) {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });
    
    // Navigate to RSS reader
    await page.goto(RSS_READER_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    console.log('\n📍 Analyzing page structure...');
    
    // Check if there are any JavaScript errors preventing navigation
    const pageErrors = await page.evaluate(() => {
      return {
        hasErrors: window.onerror !== null,
        consoleErrors: [], // Can't access console history directly
        routerExists: typeof window !== 'undefined' && 'next' in window,
        reactExists: typeof window !== 'undefined' && 'React' in window
      };
    });
    
    console.log('Page state:', pageErrors);
    
    // Get detailed article information
    const articleDetails = await page.evaluate(() => {
      const articles = document.querySelectorAll('[data-article-id]');
      const details = [];
      
      for (let i = 0; i < Math.min(articles.length, 3); i++) {
        const article = articles[i];
        const rect = article.getBoundingClientRect();
        
        details.push({
          id: article.getAttribute('data-article-id'),
          tagName: article.tagName,
          role: article.getAttribute('role'),
          tabIndex: article.getAttribute('tabindex'),
          hasClickListener: article.onclick !== null,
          eventListeners: 'Check manually',
          isVisible: rect.width > 0 && rect.height > 0,
          zIndex: window.getComputedStyle(article).zIndex,
          position: window.getComputedStyle(article).position,
          pointerEvents: window.getComputedStyle(article).pointerEvents
        });
      }
      
      return details;
    });
    
    console.log('\nArticle details:');
    articleDetails.forEach((article, idx) => {
      console.log(`${idx + 1}. ${article.id}:`);
      console.log(`   Tag: ${article.tagName}, Role: ${article.role}`);
      console.log(`   Visible: ${article.isVisible}, Pointer Events: ${article.pointerEvents}`);
      console.log(`   Click Handler: ${article.hasClickListener}`);
    });
    
    if (articleDetails.length === 0) {
      console.log('❌ No articles found');
      return;
    }
    
    // Try different click approaches on the first article
    const firstArticleId = articleDetails[0].id;
    console.log(`\n📍 Testing clicks on article: ${firstArticleId}`);
    
    const articleLocator = page.locator(`[data-article-id="${firstArticleId}"]`).first();
    
    // Test 1: Check if element is clickable
    const isClickable = await articleLocator.isEnabled();
    console.log(`Article is enabled: ${isClickable}`);
    
    // Test 2: Try clicking with JavaScript
    console.log('\n🔬 Test 1: JavaScript click');
    const jsClickResult = await page.evaluate((articleId) => {
      const article = document.querySelector(`[data-article-id="${articleId}"]`);
      if (!article) return 'Article not found';
      
      try {
        // Try to trigger click event
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        
        const result = article.dispatchEvent(clickEvent);
        return `Click event dispatched: ${result}`;
      } catch (e) {
        return `Error: ${e.message}`;
      }
    }, firstArticleId);
    
    console.log(`JS Click result: ${jsClickResult}`);
    await page.waitForTimeout(1000);
    
    let currentUrl = page.url();
    console.log(`URL after JS click: ${currentUrl}`);
    
    // Test 3: Try Playwright click
    if (!currentUrl.includes('/article/')) {
      console.log('\n🔬 Test 2: Playwright click');
      try {
        await articleLocator.click({ timeout: 5000 });
        console.log('Playwright click succeeded');
      } catch (e) {
        console.log(`Playwright click failed: ${e.message}`);
      }
      
      await page.waitForTimeout(1000);
      currentUrl = page.url();
      console.log(`URL after Playwright click: ${currentUrl}`);
    }
    
    // Test 4: Try force click
    if (!currentUrl.includes('/article/')) {
      console.log('\n🔬 Test 3: Force click');
      try {
        await articleLocator.click({ force: true, timeout: 5000 });
        console.log('Force click succeeded');
      } catch (e) {
        console.log(`Force click failed: ${e.message}`);
      }
      
      await page.waitForTimeout(1000);
      currentUrl = page.url();
      console.log(`URL after force click: ${currentUrl}`);
    }
    
    // Test 5: Try direct navigation
    if (!currentUrl.includes('/article/')) {
      console.log('\n🔬 Test 4: Direct navigation');
      const targetUrl = `${RSS_READER_URL}/article/${firstArticleId}`;
      console.log(`Navigating directly to: ${targetUrl}`);
      
      await page.goto(targetUrl);
      await page.waitForTimeout(2000);
      
      currentUrl = page.url();
      console.log(`URL after direct navigation: ${currentUrl}`);
      
      // Check if the article page loads properly
      const articlePageContent = await page.evaluate(() => {
        return {
          title: document.title,
          hasArticleContent: document.querySelector('[data-article-content]') !== null,
          hasError: document.querySelector('[data-error]') !== null || document.body.textContent?.includes('404') || false
        };
      });
      
      console.log('Article page content:', articlePageContent);
      
      if (currentUrl.includes('/article/') && !articlePageContent.hasError) {
        console.log('✅ Direct navigation to article page works');
        console.log('🔍 This suggests the issue is with the click handlers, not the article page itself');
        
        // Go back and see if state is preserved
        await page.goBack();
        await page.waitForTimeout(2000);
        
        const finalUrl = page.url();
        console.log(`URL after going back: ${finalUrl}`);
        
        // Check if session state was created
        const sessionState = await page.evaluate(() => {
          const state = sessionStorage.getItem('articleListState');
          return state ? JSON.parse(state) : null;
        });
        
        console.log('Session state after back navigation:', sessionState);
        
        if (sessionState) {
          console.log('✅ Session state is working when navigation works');
        } else {
          console.log('❌ No session state created even with working navigation');
        }
      } else {
        console.log('❌ Article page itself has issues');
      }
    }
    
    // Test 6: Check for overlapping elements that might intercept clicks
    console.log('\n🔬 Test 5: Check for click interception');
    const clickInterception = await page.evaluate((articleId) => {
      const article = document.querySelector(`[data-article-id="${articleId}"]`);
      if (!article) return 'Article not found';
      
      const rect = article.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      
      const elementAtPoint = document.elementFromPoint(centerX, centerY);
      
      return {
        targetElement: article.tagName + (article.className ? '.' + article.className.split(' ')[0] : ''),
        elementAtPoint: elementAtPoint ? elementAtPoint.tagName + (elementAtPoint.className ? '.' + elementAtPoint.className.split(' ')[0] : '') : 'null',
        isIntercepted: elementAtPoint !== article,
        interceptingElement: elementAtPoint ? {
          tagName: elementAtPoint.tagName,
          className: elementAtPoint.className,
          id: elementAtPoint.id
        } : null
      };
    }, firstArticleId);
    
    console.log('Click interception check:', clickInterception);
    
    console.log('\n🏁 Navigation debug test completed');
    console.log('\n📊 SUMMARY:');
    console.log(`- Articles found: ${articleDetails.length}`);
    console.log(`- Final URL: ${currentUrl}`);
    console.log(`- Navigation successful: ${currentUrl.includes('/article/')}`);
    
    if (clickInterception.isIntercepted) {
      console.log(`- Click intercepted by: ${clickInterception.elementAtPoint}`);
    }
  });
});