/**
 * Session State Bug Reproduction Test
 * 
 * This test properly reproduces the session state corruption issue by:
 * 1. Using JavaScript clicks (which work) instead of Playwright clicks
 * 2. Following the exact user flow described in the issue
 * 3. Capturing detailed session state at each step
 * 
 * Expected Bug: After reading 2 articles, ALL read articles from the feed 
 * should show instead of only the 2 session-preserved articles
 */

import { test, expect, type Page } from '@playwright/test';

const RSS_READER_URL = 'http://100.96.166.53:3000/reader';

interface SessionStateSnapshot {
  timestamp: number;
  url: string;
  sessionExists: boolean;
  sessionData: any;
  readArticlesInDOM: number;
  visibleReadArticles: number;
  unreadArticlesInDOM: number;
  sessionPreservedCount: number;
  feedContext: string | null;
}

async function captureSessionStateSnapshot(page: Page, label: string): Promise<SessionStateSnapshot> {
  const snapshot = await page.evaluate(() => {
    // Get session state
    const sessionStateRaw = sessionStorage.getItem('articleListState');
    let sessionData = null;
    try {
      sessionData = sessionStateRaw ? JSON.parse(sessionStateRaw) : null;
    } catch (e) {
      sessionData = { error: e.message };
    }
    
    // Count articles in DOM
    const readArticles = document.querySelectorAll('[data-article-id][data-is-read="true"]');
    const unreadArticles = document.querySelectorAll('[data-article-id][data-is-read="false"]');
    
    // Count visible read articles
    const visibleReadArticles = Array.from(readArticles).filter(article => 
      window.getComputedStyle(article).display !== 'none' &&
      window.getComputedStyle(article).visibility !== 'hidden'
    ).length;
    
    // Calculate session preserved count
    let sessionPreservedCount = 0;
    if (sessionData && !sessionData.error) {
      const autoRead = sessionData.autoReadArticles || [];
      const manualRead = sessionData.manualReadArticles || [];
      sessionPreservedCount = new Set([...autoRead, ...manualRead]).size;
    }
    
    return {
      timestamp: Date.now(),
      url: window.location.href,
      sessionExists: !!sessionStateRaw,
      sessionData,
      readArticlesInDOM: readArticles.length,
      visibleReadArticles,
      unreadArticlesInDOM: unreadArticles.length,
      sessionPreservedCount,
      feedContext: sessionData?.feedId || null
    };
  });
  
  console.log(`\n📸 ${label}:`);
  console.log(`   URL: ${snapshot.url}`);
  console.log(`   Session exists: ${snapshot.sessionExists}`);
  console.log(`   Read articles in DOM: ${snapshot.readArticlesInDOM}`);
  console.log(`   Visible read articles: ${snapshot.visibleReadArticles}`);
  console.log(`   Unread articles in DOM: ${snapshot.unreadArticlesInDOM}`);
  console.log(`   Session preserved count: ${snapshot.sessionPreservedCount}`);
  console.log(`   Feed context: ${snapshot.feedContext}`);
  
  if (snapshot.sessionData && !snapshot.sessionData.error) {
    console.log(`   Auto-read: ${snapshot.sessionData.autoReadArticles?.length || 0}`);
    console.log(`   Manual-read: ${snapshot.sessionData.manualReadArticles?.length || 0}`);
    console.log(`   Filter mode: ${snapshot.sessionData.filterMode}`);
  }
  
  return snapshot;
}

async function clickArticleWithJS(page: Page, articleId: string): Promise<boolean> {
  return await page.evaluate((id) => {
    const article = document.querySelector(`[data-article-id="${id}"]`);
    if (!article) {
      console.log(`❌ Article ${id} not found in DOM`);
      return false;
    }
    
    console.log(`🎯 Clicking article ${id} with JavaScript`);
    const clickEvent = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true
    });
    
    const result = article.dispatchEvent(clickEvent);
    console.log(`✅ Click dispatched, result: ${result}`);
    return result;
  }, articleId);
}

async function waitForNavigation(page: Page, expectedPath?: string): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(1500);
  
  if (expectedPath) {
    const currentUrl = page.url();
    if (!currentUrl.includes(expectedPath)) {
      console.log(`⚠️ Expected navigation to ${expectedPath}, but URL is ${currentUrl}`);
    } else {
      console.log(`✅ Successfully navigated to ${expectedPath}`);
    }
  }
}

test.describe('Session State Bug Reproduction', () => {
  test('should reproduce session state corruption after second article read', async ({ page }) => {
    console.log('🚀 Starting session state bug reproduction test...');
    
    // Enable detailed console logging
    page.on('console', msg => {
      if (msg.type() === 'log' && (msg.text().includes('🔧') || msg.text().includes('🎯') || msg.text().includes('✅'))) {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });
    
    // Step 1: Navigate to RSS reader and set up initial state
    console.log('\n📍 Step 1: Navigate to RSS reader');
    await page.goto(RSS_READER_URL);
    await waitForNavigation(page);
    
    // Clear any existing session state to start fresh
    await page.evaluate(() => {
      sessionStorage.removeItem('articleListState');
      console.log('🧹 Cleared existing session state');
    });
    
    const snapshot1 = await captureSessionStateSnapshot(page, 'Initial Load (Clean State)');
    
    // Step 2: Switch to "Unread Only" filter
    console.log('\n📍 Step 2: Switch to "Unread Only" filter');
    const unreadButton = page.locator('button:has-text("Unread")');
    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(1000);
      console.log('✅ Switched to Unread filter');
    } else {
      console.log('ℹ️ Already in Unread filter or button not found');
    }
    
    const snapshot2 = await captureSessionStateSnapshot(page, 'After Unread Filter');
    
    // Verify we have enough articles for the test
    if (snapshot2.unreadArticlesInDOM < 2) {
      console.log(`❌ Not enough unread articles (${snapshot2.unreadArticlesInDOM}), need at least 2`);
      return;
    }
    
    // Step 3: Get the first article and read it
    console.log('\n📍 Step 3: Read the first article');
    
    const firstArticleId = await page.evaluate(() => {
      const unreadArticles = document.querySelectorAll('[data-article-id][data-is-read="false"]');
      return unreadArticles.length > 0 ? unreadArticles[0].getAttribute('data-article-id') : null;
    });
    
    if (!firstArticleId) {
      console.log('❌ No unread articles found');
      return;
    }
    
    console.log(`🎯 First article ID: ${firstArticleId}`);
    
    const clickSuccess1 = await clickArticleWithJS(page, firstArticleId);
    if (!clickSuccess1) {
      console.log('❌ Failed to click first article');
      return;
    }
    
    await waitForNavigation(page, '/article/');
    const snapshot3 = await captureSessionStateSnapshot(page, 'On First Article Detail Page');
    
    // Step 4: Navigate back to the list
    console.log('\n📍 Step 4: Navigate back to article list');
    await page.goto(RSS_READER_URL);
    await waitForNavigation(page);
    
    const snapshot4 = await captureSessionStateSnapshot(page, 'Back to List After First Article');
    
    // Verify the first article behavior
    console.log('\n🔍 First Article Verification:');
    console.log(`   Expected: 1 read article visible (session preserved)`);
    console.log(`   Actual: ${snapshot4.visibleReadArticles} read articles visible`);
    
    if (snapshot4.visibleReadArticles === 1) {
      console.log('✅ First article preservation working correctly');
    } else {
      console.log('⚠️ First article preservation not working as expected');
    }
    
    // Step 5: Read the second article
    console.log('\n📍 Step 5: Read the second article');
    
    const secondArticleId = await page.evaluate(() => {
      const unreadArticles = document.querySelectorAll('[data-article-id][data-is-read="false"]');
      return unreadArticles.length > 0 ? unreadArticles[0].getAttribute('data-article-id') : null;
    });
    
    if (!secondArticleId) {
      console.log('❌ No more unread articles found for second read');
      return;
    }
    
    console.log(`🎯 Second article ID: ${secondArticleId}`);
    
    const clickSuccess2 = await clickArticleWithJS(page, secondArticleId);
    if (!clickSuccess2) {
      console.log('❌ Failed to click second article');
      return;
    }
    
    await waitForNavigation(page, '/article/');
    const snapshot5 = await captureSessionStateSnapshot(page, 'On Second Article Detail Page');
    
    // Step 6: Navigate back again - this is where the bug should manifest
    console.log('\n📍 Step 6: Navigate back after second article (BUG CHECK)');
    await page.goto(RSS_READER_URL);
    await waitForNavigation(page);
    
    const snapshot6 = await captureSessionStateSnapshot(page, 'Back to List After Second Article (CRITICAL)');
    
    // Step 7: Analyze the bug
    console.log('\n🐛 BUG ANALYSIS:');
    console.log(`   Expected visible read articles: 2 (both session preserved)`);
    console.log(`   Actual visible read articles: ${snapshot6.visibleReadArticles}`);
    
    // Detailed session state comparison
    console.log('\n📊 SESSION STATE EVOLUTION:');
    console.log(`   After 1st article: ${snapshot4.sessionPreservedCount} preserved, ${snapshot4.visibleReadArticles} visible`);
    console.log(`   After 2nd article: ${snapshot6.sessionPreservedCount} preserved, ${snapshot6.visibleReadArticles} visible`);
    
    // Get detailed article information for debugging
    const detailedArticleInfo = await page.evaluate((firstId, secondId) => {
      const allArticles = document.querySelectorAll('[data-article-id]');
      const readArticles = [];
      const visibleReadArticles = [];
      
      allArticles.forEach(article => {
        const id = article.getAttribute('data-article-id');
        const isRead = article.getAttribute('data-is-read') === 'true';
        const isVisible = window.getComputedStyle(article).display !== 'none' && 
                         window.getComputedStyle(article).visibility !== 'hidden';
        const hasSessionClass = article.className.includes('session-preserved');
        
        if (isRead) {
          readArticles.push({
            id,
            isVisible,
            hasSessionClass,
            isTargetArticle: id === firstId || id === secondId
          });
          
          if (isVisible) {
            visibleReadArticles.push({
              id,
              hasSessionClass,
              isTargetArticle: id === firstId || id === secondId
            });
          }
        }
      });
      
      return {
        totalReadArticles: readArticles.length,
        visibleReadArticles: visibleReadArticles.length,
        readArticleDetails: readArticles.slice(0, 10), // Limit for readability
        visibleReadArticleDetails: visibleReadArticles.slice(0, 10)
      };
    }, firstArticleId, secondArticleId);
    
    console.log('\n📋 DETAILED ARTICLE ANALYSIS:');
    console.log(`   Total read articles in DOM: ${detailedArticleInfo.totalReadArticles}`);
    console.log(`   Visible read articles: ${detailedArticleInfo.visibleReadArticles}`);
    
    console.log('\n   Visible read articles details:');
    detailedArticleInfo.visibleReadArticleDetails.forEach((article, idx) => {
      const status = article.isTargetArticle ? '🎯 TARGET' : '📄 OTHER';
      const sessionStatus = article.hasSessionClass ? '✅ SESSION' : '❌ NOT SESSION';
      console.log(`   ${idx + 1}. ${status} ${article.id} - ${sessionStatus}`);
    });
    
    // Final bug determination
    const expectedVisible = 2;
    const actualVisible = snapshot6.visibleReadArticles;
    const targetArticlesVisible = detailedArticleInfo.visibleReadArticleDetails.filter(a => a.isTargetArticle).length;
    const nonTargetArticlesVisible = detailedArticleInfo.visibleReadArticles - targetArticlesVisible;
    
    console.log('\n🎯 FINAL BUG ASSESSMENT:');
    console.log(`   Expected visible: ${expectedVisible} (only our 2 target articles)`);
    console.log(`   Actual visible: ${actualVisible}`);
    console.log(`   Target articles visible: ${targetArticlesVisible}`);
    console.log(`   Non-target articles visible: ${nonTargetArticlesVisible}`);
    
    if (actualVisible > expectedVisible) {
      console.log(`\n🐛 BUG CONFIRMED!`);
      console.log(`   ${nonTargetArticlesVisible} extra read articles are showing that shouldn't be visible`);
      console.log(`   This indicates session state corruption - the "Unread Only" filter is showing`);
      console.log(`   ALL read articles from the feed instead of only session-preserved ones`);
    } else if (actualVisible === expectedVisible && targetArticlesVisible === expectedVisible) {
      console.log(`\n✅ BEHAVIOR CORRECT`);
      console.log(`   Only the 2 target articles are visible, as expected`);
    } else {
      console.log(`\n⚠️ UNEXPECTED BEHAVIOR`);
      console.log(`   The visible count matches expected, but target articles may be missing`);
    }
    
    // Take final screenshot for visual confirmation
    await page.screenshot({ 
      path: 'session-state-bug-reproduction.png', 
      fullPage: true 
    });
    
    console.log('\n🏁 Session state bug reproduction test completed');
    console.log('📸 Screenshot saved as session-state-bug-reproduction.png');
    
    // Store the bug evidence
    const bugEvidence = {
      testPassed: actualVisible <= expectedVisible && targetArticlesVisible === expectedVisible,
      bugReproduced: actualVisible > expectedVisible,
      evidence: {
        expectedVisible,
        actualVisible,
        targetArticlesVisible,
        nonTargetArticlesVisible,
        sessionState: snapshot6.sessionData,
        articles: detailedArticleInfo.visibleReadArticleDetails
      }
    };
    
    console.log('\n💾 Bug Evidence Summary:');
    console.log(JSON.stringify(bugEvidence, null, 2));
  });
});