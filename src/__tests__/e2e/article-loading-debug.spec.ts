/**
 * Article Loading Debug Test
 * 
 * Debug why articles aren't loading properly after navigation
 */

import { test, expect, type Page } from '@playwright/test';

const RSS_READER_URL = 'http://100.96.166.53:3000/reader';

test.describe('Article Loading Debug', () => {
  test('should debug article loading after navigation', async ({ page }) => {
    console.log('🚀 Starting article loading debug test...');
    
    // Monitor network requests
    page.on('response', response => {
      if (response.url().includes('/api/') || response.url().includes('articles') || response.status() >= 400) {
        console.log(`[HTTP] ${response.status()} ${response.url()}`);
      }
    });
    
    // Monitor console for errors and article loading
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log(`[ERROR] ${msg.text()}`);
      } else if (msg.type() === 'log' && (
        msg.text().includes('article') || 
        msg.text().includes('Database') || 
        msg.text().includes('Hook') ||
        msg.text().includes('🔧')
      )) {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });
    
    // Step 1: Initial load
    console.log('\n📍 Step 1: Initial load');
    await page.goto(RSS_READER_URL);
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    
    const initialState = await page.evaluate(() => {
      return {
        url: window.location.href,
        articlesInDOM: document.querySelectorAll('[data-article-id]').length,
        loadingIndicators: document.querySelectorAll('[data-loading], .loading, .spinner').length,
        errorMessages: document.querySelectorAll('[data-error], .error').length,
        bodyText: document.body.textContent?.substring(0, 200) || ''
      };
    });
    
    console.log('Initial state:', initialState);
    
    if (initialState.articlesInDOM === 0) {
      console.log('❌ No articles loaded on initial page load');
      console.log('Page content preview:', initialState.bodyText);
      
      // Check if there are any API errors
      const apiErrors = await page.evaluate(() => {
        // Look for any error text or empty states
        const bodyText = document.body.textContent || '';
        return {
          hasNoArticlesMessage: bodyText.includes('No articles') || bodyText.includes('no articles'),
          hasErrorMessage: bodyText.includes('Error') || bodyText.includes('error'),
          hasLoadingMessage: bodyText.includes('Loading') || bodyText.includes('loading'),
          fullText: bodyText.length < 500 ? bodyText : bodyText.substring(0, 500) + '...'
        };
      });
      
      console.log('API/Loading analysis:', apiErrors);
      return;
    }
    
    console.log(`✅ ${initialState.articlesInDOM} articles loaded initially`);
    
    // Step 2: Click an article and track what happens
    console.log('\n📍 Step 2: Click first article');
    
    const firstArticleId = await page.evaluate(() => {
      const articles = document.querySelectorAll('[data-article-id]');
      return articles.length > 0 ? articles[0].getAttribute('data-article-id') : null;
    });
    
    if (!firstArticleId) {
      console.log('❌ No articles available to click');
      return;
    }
    
    console.log(`🎯 Clicking article: ${firstArticleId}`);
    
    // Use JavaScript click
    await page.evaluate((articleId) => {
      const article = document.querySelector(`[data-article-id="${articleId}"]`);
      if (article) {
        const clickEvent = new MouseEvent('click', {
          view: window,
          bubbles: true,
          cancelable: true
        });
        article.dispatchEvent(clickEvent);
      }
    }, firstArticleId);
    
    // Wait for navigation
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    const articlePageState = await page.evaluate(() => {
      return {
        url: window.location.href,
        title: document.title,
        hasArticleContent: document.querySelector('[data-article-content]') !== null,
        hasBackButton: document.querySelector('[data-back]') !== null || Array.from(document.querySelectorAll('button')).some(btn => btn.textContent?.includes('Back')),
        sessionState: sessionStorage.getItem('articleListState'),
        bodyPreview: document.body.textContent?.substring(0, 300) || ''
      };
    });
    
    console.log('Article page state:');
    console.log(`  URL: ${articlePageState.url}`);
    console.log(`  Has article content: ${articlePageState.hasArticleContent}`);
    console.log(`  Session state exists: ${!!articlePageState.sessionState}`);
    
    // Step 3: Navigate back and monitor the loading process
    console.log('\n📍 Step 3: Navigate back to list');
    
    // Track loading states during navigation
    const loadingStates: any[] = [];
    
    const trackLoading = async () => {
      const state = await page.evaluate(() => {
        return {
          timestamp: Date.now(),
          url: window.location.href,
          readyState: document.readyState,
          articlesInDOM: document.querySelectorAll('[data-article-id]').length,
          readArticles: document.querySelectorAll('[data-article-id][data-is-read="true"]').length,
          unreadArticles: document.querySelectorAll('[data-article-id][data-is-read="false"]').length,
          loadingElements: document.querySelectorAll('[data-loading], .loading, .spinner').length,
          hasSessionState: !!sessionStorage.getItem('articleListState')
        };
      });
      loadingStates.push(state);
      return state;
    };
    
    // Start tracking
    await trackLoading();
    
    // Navigate back
    await page.goto(RSS_READER_URL);
    
    // Track states during loading
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(500);
      await trackLoading();
    }
    
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    // Final state
    const finalState = await trackLoading();
    
    console.log('\n📊 Loading progression:');
    loadingStates.forEach((state, idx) => {
      const elapsed = idx === 0 ? 0 : state.timestamp - loadingStates[0].timestamp;
      console.log(`  ${elapsed}ms: Articles=${state.articlesInDOM} (R:${state.readArticles}, U:${state.unreadArticles}), Loading=${state.loadingElements}, Session=${state.hasSessionState}`);
    });
    
    console.log('\n🔍 Final Analysis:');
    console.log(`  Expected: At least 1 read article visible (session preserved)`);
    console.log(`  Actual read articles: ${finalState.readArticles}`);
    console.log(`  Actual unread articles: ${finalState.unreadArticles}`);
    console.log(`  Total articles: ${finalState.articlesInDOM}`);
    
    if (finalState.articlesInDOM === 0) {
      console.log('\n❌ CRITICAL ISSUE: No articles loaded after navigation back');
      console.log('This suggests a data loading problem, not just a session state issue');
      
      // Check if we can manually trigger a reload
      console.log('\n🔄 Attempting manual refresh...');
      await page.reload();
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(3000);
      
      const afterReloadState = await page.evaluate(() => {
        return {
          articlesInDOM: document.querySelectorAll('[data-article-id]').length,
          readArticles: document.querySelectorAll('[data-article-id][data-is-read="true"]').length,
          unreadArticles: document.querySelectorAll('[data-article-id][data-is-read="false"]').length,
          hasSessionState: !!sessionStorage.getItem('articleListState'),
          errorElements: document.querySelectorAll('[data-error], .error').length
        };
      });
      
      console.log('After reload:', afterReloadState);
      
      if (afterReloadState.articlesInDOM > 0) {
        console.log('✅ Articles load after page refresh');
        console.log('🔍 This indicates a SPA navigation issue, not a data issue');
      } else {
        console.log('❌ Articles still not loading even after refresh');
        console.log('🔍 This indicates a deeper data/API issue');
      }
    } else if (finalState.readArticles === 0) {
      console.log('\n⚠️ Articles are loading, but read article is not visible');
      console.log('🔍 This suggests the session state preservation is not working');
      
      // Check session state details
      const sessionDetails = await page.evaluate(() => {
        const state = sessionStorage.getItem('articleListState');
        if (!state) return null;
        
        try {
          const parsed = JSON.parse(state);
          return {
            manualReadCount: parsed.manualReadArticles?.length || 0,
            autoReadCount: parsed.autoReadArticles?.length || 0,
            filterMode: parsed.filterMode,
            feedId: parsed.feedId,
            timestamp: parsed.timestamp,
            age: Date.now() - parsed.timestamp
          };
        } catch (e) {
          return { error: e.message };
        }
      });
      
      console.log('Session state details:', sessionDetails);
    } else {
      console.log('\n✅ Articles are loading and read article is visible');
      console.log('🔍 Session state preservation appears to be working');
    }
    
    // Take screenshot for debugging
    await page.screenshot({ 
      path: 'article-loading-debug.png', 
      fullPage: true 
    });
    
    console.log('\n🏁 Article loading debug completed');
  });
});