/**
 * Session State Corruption Debug Test
 *
 * Reproduces the specific issue where:
 * 1. Navigate to feed's "Unread Only" list
 * 2. Read first article (should preserve only 1)
 * 3. Go back and verify only 1 preserved
 * 4. Read second article (should preserve only 2)
 * 5. Go back - BUG: shows ALL read articles instead of only 2
 *
 * This test captures detailed session state and console logs to debug
 * exactly what's happening to the session state after the second article read.
 */

import { test, expect, type Page } from "@playwright/test";

const RSS_READER_URL = "http://100.96.166.53:3000/reader";

interface SessionState {
  articleIds: string[];
  readStates: Record<string, boolean>;
  autoReadArticles: string[];
  manualReadArticles: string[];
  scrollPosition: number;
  lastArticleId?: string;
  timestamp: number;
  filterMode: "all" | "unread" | "read";
  feedId?: string;
  folderId?: string;
  visibleRange?: { start: number; end: number };
}

interface DebugSnapshot {
  timestamp: number;
  url: string;
  sessionState: SessionState | null;
  visibleArticles: Array<{
    id: string;
    isRead: boolean;
    visible: boolean;
    className: string;
    isSessionPreserved: boolean;
  }>;
  consoleLogs: string[];
  stateManagerDebug: {
    sessionPreservedCount: number;
    autoReadCount: number;
    manualReadCount: number;
    feedContext: string | null;
  };
}

async function captureDebugSnapshot(
  page: Page,
  label: string
): Promise<DebugSnapshot> {
  console.log(`\n📸 Capturing debug snapshot: ${label}`);

  const debugInfo = await page.evaluate((snapshotLabel) => {
    // Capture session state
    let sessionState: SessionState | null = null;
    try {
      const stateJson = sessionStorage.getItem("articleListState");
      if (stateJson) {
        sessionState = JSON.parse(stateJson);
      }
    } catch (e) {
      console.error("Failed to parse session state:", e);
    }

    // Capture visible articles
    const articleElements = document.querySelectorAll("[data-article-id]");
    const visibleArticles: Array<{
      id: string;
      isRead: boolean;
      visible: boolean;
      className: string;
      isSessionPreserved: boolean;
    }> = [];

    articleElements.forEach((element) => {
      const id = element.getAttribute("data-article-id") || "";
      const isRead = element.getAttribute("data-is-read") === "true";
      const computedStyle = window.getComputedStyle(element);
      const visible =
        computedStyle.display !== "none" &&
        computedStyle.visibility !== "hidden";
      const className = element.className;
      const isSessionPreserved = className.includes("session-preserved-read");

      visibleArticles.push({
        id,
        isRead,
        visible,
        className,
        isSessionPreserved,
      });
    });

    // Debug state manager
    const stateManagerDebug = {
      sessionPreservedCount: 0,
      autoReadCount: sessionState?.autoReadArticles?.length || 0,
      manualReadCount: sessionState?.manualReadArticles?.length || 0,
      feedContext: sessionState?.feedId || null,
    };

    if (sessionState) {
      const allPreserved = [
        ...(sessionState.autoReadArticles || []),
        ...(sessionState.manualReadArticles || []),
      ];
      stateManagerDebug.sessionPreservedCount = new Set(allPreserved).size;
    }

    return {
      timestamp: Date.now(),
      url: window.location.href,
      sessionState,
      visibleArticles: visibleArticles.slice(0, 10), // Limit for readability
      consoleLogs: [], // Will be populated separately if needed
      stateManagerDebug,
    };
  }, label);

  // Log the debug info
  console.log(`\n🔍 ${label} Debug Info:`);
  console.log(`URL: ${debugInfo.url}`);
  console.log(`Session State Valid: ${!!debugInfo.sessionState}`);
  console.log(`Visible Articles: ${debugInfo.visibleArticles.length}`);
  console.log(
    `Session Preserved Count: ${debugInfo.stateManagerDebug.sessionPreservedCount}`
  );
  console.log(`Auto Read: ${debugInfo.stateManagerDebug.autoReadCount}`);
  console.log(`Manual Read: ${debugInfo.stateManagerDebug.manualReadCount}`);
  console.log(`Feed Context: ${debugInfo.stateManagerDebug.feedContext}`);

  if (debugInfo.sessionState) {
    console.log(`Session State Summary:`);
    console.log(`- Filter Mode: ${debugInfo.sessionState.filterMode}`);
    console.log(`- Feed ID: ${debugInfo.sessionState.feedId}`);
    console.log(`- Article IDs: ${debugInfo.sessionState.articleIds.length}`);
    console.log(
      `- Read States: ${Object.keys(debugInfo.sessionState.readStates).length}`
    );
    console.log(
      `- Timestamp: ${new Date(debugInfo.sessionState.timestamp).toISOString()}`
    );
  }

  // Log visible articles with read status
  console.log(`\nVisible Articles (first 5):`);
  debugInfo.visibleArticles.slice(0, 5).forEach((article, idx) => {
    console.log(
      `${idx + 1}. ${article.id} - Read: ${article.isRead}, Preserved: ${article.isSessionPreserved}, Visible: ${article.visible}`
    );
  });

  return debugInfo;
}

async function selectSpecificFeed(page: Page): Promise<string | null> {
  console.log("🔍 Looking for a feed with multiple articles...");

  // Wait for feeds to load
  await page.waitForTimeout(3000);

  // Try different selectors for feed items
  let feedItems = page.locator('[data-testid="feed-item"]');
  let feedCount = await feedItems.count();

  if (feedCount === 0) {
    feedItems = page.locator(".feed-item");
    feedCount = await feedItems.count();
  }

  if (feedCount === 0) {
    feedItems = page.locator('button:has-text("("), a:has-text("(")');
    feedCount = await feedItems.count();
  }

  console.log(`Found ${feedCount} potential feed items`);

  if (feedCount === 0) {
    console.log(
      "🔄 No specific feeds found, continuing with all articles view"
    );
    return "All Articles";
  }

  // Try to find a feed with a decent article count (look for numbers in parentheses)
  for (let i = 0; i < Math.min(feedCount, 5); i++) {
    try {
      const feedItem = feedItems.nth(i);
      const feedText = await feedItem.textContent({ timeout: 1000 });

      if (feedText && feedText.includes("(") && feedText.includes(")")) {
        // Extract number in parentheses
        const match = feedText.match(/\((\d+)\)/);
        if (match && parseInt(match[1]) >= 3) {
          console.log(`🎯 Selected feed: ${feedText.substring(0, 50)}...`);
          await feedItem.click({ timeout: 5000 });
          await page.waitForTimeout(2000);
          return feedText;
        }
      }
    } catch (e) {
      console.log(`Failed to check feed ${i}: ${e}`);
      continue;
    }
  }

  // Fallback: try to click the first feed if it exists
  if (feedCount > 0) {
    try {
      console.log("📌 Falling back to first available feed");
      await feedItems.first().click({ timeout: 5000 });
      await page.waitForTimeout(2000);
      const feedText = await feedItems.first().textContent({ timeout: 1000 });
      return feedText || "Unknown Feed";
    } catch (e) {
      console.log(`Failed to click first feed: ${e}`);
    }
  }

  console.log("🔄 No feeds clickable, continuing with current view");
  return "Default View";
}

test.describe("Session State Corruption Debug", () => {
  test("should reproduce and debug session state corruption after second article read", async ({
    page,
  }) => {
    console.log("🚀 Starting session state corruption debug test...");

    // Enable console logging
    page.on("console", (msg) => {
      if (msg.type() === "log" && msg.text().includes("🔧")) {
        console.log(`[BROWSER] ${msg.text()}`);
      }
    });

    // Step 1: Navigate to RSS reader
    console.log("\n📍 Step 1: Navigate to RSS reader");
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(5000);

    await captureDebugSnapshot(page, "Initial Load");

    // Step 2: Select a specific feed with multiple articles
    console.log("\n📍 Step 2: Select a feed with multiple articles");
    const selectedFeed = await selectSpecificFeed(page);
    if (!selectedFeed) {
      console.log("❌ No feeds found, skipping test");
      return;
    }

    await captureDebugSnapshot(page, "After Feed Selection");

    // Step 3: Switch to "Unread Only" filter
    console.log("\n📍 Step 3: Switch to Unread Only filter");
    const unreadButton = page.locator('button:has-text("Unread")');
    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(2000);
    }

    const snapshot1 = await captureDebugSnapshot(page, "After Unread Filter");

    // Verify we have articles to work with
    const articles = page.locator("[data-article-id]");
    const articleCount = await articles.count();
    console.log(`📊 Found ${articleCount} articles in unread filter`);

    if (articleCount < 2) {
      console.log("❌ Not enough articles for test, skipping");
      return;
    }

    // Step 4: Read the first article
    console.log("\n📍 Step 4: Read the first article");
    const firstArticleId = await articles
      .first()
      .getAttribute("data-article-id");
    console.log(`🎯 First article ID: ${firstArticleId}`);

    // Try clicking with different methods
    try {
      await articles.first().click({ timeout: 10000 });
    } catch (e) {
      console.log("Normal click failed, trying force click");
      await articles.first().click({ force: true });
    }
    await page.waitForTimeout(3000); // Wait for article to load and be marked as read
    console.log("✅ First article clicked and loaded");

    const snapshot2 = await captureDebugSnapshot(
      page,
      "After First Article Read (on detail page)"
    );

    // Step 5: Navigate back to article list
    console.log("\n📍 Step 5: Navigate back to article list");
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    const snapshot3 = await captureDebugSnapshot(
      page,
      "Back to List After First Article"
    );

    // Verify only 1 article is preserved
    console.log("\n🔍 Verification after first article:");
    const preservedAfterFirst = snapshot3.visibleArticles.filter(
      (a) => a.isRead && a.visible
    ).length;
    console.log(
      `📊 Read articles still visible: ${preservedAfterFirst} (should be 1)`
    );

    // Step 6: Read the second article
    console.log("\n📍 Step 6: Read the second article");

    // Find the first unread article (since the first one should now be read and preserved)
    const unreadArticles = page.locator(
      '[data-article-id][data-is-read="false"]'
    );
    const unreadCount = await unreadArticles.count();
    console.log(`📊 Unread articles available: ${unreadCount}`);

    if (unreadCount === 0) {
      console.log("❌ No unread articles available for second read");
      return;
    }

    const secondArticleId = await unreadArticles
      .first()
      .getAttribute("data-article-id");
    console.log(`🎯 Second article ID: ${secondArticleId}`);

    // Try clicking with different methods
    try {
      await unreadArticles.first().click({ timeout: 10000 });
    } catch (e) {
      console.log("Normal click failed, trying force click");
      await unreadArticles.first().click({ force: true });
    }
    await page.waitForTimeout(3000);
    console.log("✅ Second article clicked and loaded");

    const snapshot4 = await captureDebugSnapshot(
      page,
      "After Second Article Read (on detail page)"
    );

    // Step 7: Navigate back again
    console.log("\n📍 Step 7: Navigate back after second article");
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    const snapshot5 = await captureDebugSnapshot(
      page,
      "Back to List After Second Article"
    );

    // Step 8: Analyze the bug
    console.log("\n🐛 BUG ANALYSIS:");
    const preservedAfterSecond = snapshot5.visibleArticles.filter(
      (a) => a.isRead && a.visible
    ).length;
    console.log(
      `📊 Read articles still visible: ${preservedAfterSecond} (should be 2)`
    );

    // Compare session states
    console.log("\n📋 SESSION STATE COMPARISON:");
    console.log(
      `Before first article: ${snapshot1.stateManagerDebug.sessionPreservedCount} preserved`
    );
    console.log(
      `After first article: ${snapshot3.stateManagerDebug.sessionPreservedCount} preserved`
    );
    console.log(
      `After second article: ${snapshot5.stateManagerDebug.sessionPreservedCount} preserved`
    );

    // Detailed session state analysis
    if (snapshot5.sessionState) {
      const state = snapshot5.sessionState;
      console.log("\n🔍 FINAL SESSION STATE DETAILS:");
      console.log(`Auto-read articles: ${state.autoReadArticles?.length || 0}`);
      console.log(
        `Manual-read articles: ${state.manualReadArticles?.length || 0}`
      );
      console.log(`Total read states: ${Object.keys(state.readStates).length}`);
      console.log(
        `Read articles (true): ${Object.values(state.readStates).filter((r) => r).length}`
      );

      // Check if our target articles are properly tracked
      const firstInAuto =
        state.autoReadArticles?.includes(firstArticleId || "") || false;
      const firstInManual =
        state.manualReadArticles?.includes(firstArticleId || "") || false;
      const secondInAuto =
        state.autoReadArticles?.includes(secondArticleId || "") || false;
      const secondInManual =
        state.manualReadArticles?.includes(secondArticleId || "") || false;

      console.log("\n📍 TARGET ARTICLES TRACKING:");
      console.log(`First article (${firstArticleId}):`);
      console.log(`  - In auto-read: ${firstInAuto}`);
      console.log(`  - In manual-read: ${firstInManual}`);
      console.log(`  - Read state: ${state.readStates[firstArticleId || ""]}`);

      console.log(`Second article (${secondArticleId}):`);
      console.log(`  - In auto-read: ${secondInAuto}`);
      console.log(`  - In manual-read: ${secondInManual}`);
      console.log(`  - Read state: ${state.readStates[secondArticleId || ""]}`);
    }

    // Take final screenshot
    await page.screenshot({
      path: "session-state-corruption-final.png",
      fullPage: true,
    });

    // Test assertion - this should fail if the bug is present
    console.log("\n🧪 ASSERTION CHECK:");
    if (preservedAfterSecond > 2) {
      console.log(
        `❌ BUG CONFIRMED: ${preservedAfterSecond} articles preserved instead of 2`
      );
      console.log(
        "🔍 This indicates session state corruption after second article read"
      );

      // Don't fail the test - this is a debug test to capture the issue
      // expect(preservedAfterSecond).toBeLessThanOrEqual(2);
    } else {
      console.log(
        `✅ Behavior correct: ${preservedAfterSecond} articles preserved`
      );
    }

    console.log("\n🏁 Session state corruption debug test completed");
    console.log(
      "📄 Check the generated screenshot and console logs for detailed analysis"
    );
  });

  test("should verify session storage state transitions in detail", async ({
    page,
  }) => {
    console.log(
      "🔬 Starting detailed session storage state transition test..."
    );

    // Navigate to RSS reader
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(3000);

    // Clear any existing session state
    await page.evaluate(() => {
      sessionStorage.removeItem("articleListState");
      console.log("🧹 Cleared existing session state");
    });

    // Switch to unread filter
    const unreadButton = page.locator('button:has-text("Unread")');
    if (await unreadButton.isVisible()) {
      await unreadButton.click();
      await page.waitForTimeout(1000);
    }

    // Get initial state
    const initialState = await page.evaluate(() => {
      const state = sessionStorage.getItem("articleListState");
      return {
        exists: !!state,
        parsed: state ? JSON.parse(state) : null,
        timestamp: Date.now(),
      };
    });

    console.log("Initial session state:", initialState);

    // Monitor session storage changes during article navigation
    await page.addInitScript(() => {
      const originalSetItem = sessionStorage.setItem;
      const originalRemoveItem = sessionStorage.removeItem;

      (window as any).sessionStorageLog = [];

      sessionStorage.setItem = function (key: string, value: string) {
        if (key === "articleListState") {
          (window as any).sessionStorageLog.push({
            action: "setItem",
            timestamp: Date.now(),
            key,
            value: value.substring(0, 200) + "...", // Truncate for readability
            fullValue: value,
          });
        }
        return originalSetItem.call(this, key, value);
      };

      sessionStorage.removeItem = function (key: string) {
        if (key === "articleListState") {
          (window as any).sessionStorageLog.push({
            action: "removeItem",
            timestamp: Date.now(),
            key,
          });
        }
        return originalRemoveItem.call(this, key);
      };
    });

    // Navigate to first article
    const articles = page.locator("[data-article-id]");
    await articles.first().waitFor();
    const firstArticleId = await articles
      .first()
      .getAttribute("data-article-id");

    console.log(`🎯 Navigating to first article: ${firstArticleId}`);
    try {
      await articles.first().click({ timeout: 10000 });
    } catch (e) {
      console.log("Normal click failed, trying force click");
      await articles.first().click({ force: true });
    }
    await page.waitForTimeout(2000);

    // Get session storage log after first article
    const logAfterFirst = await page.evaluate(
      () => (window as any).sessionStorageLog || []
    );
    console.log("Session storage changes after first article:", logAfterFirst);

    // Navigate back
    await page.goto(RSS_READER_URL);
    await page.waitForTimeout(2000);

    // Navigate to second article
    const secondArticles = page.locator(
      '[data-article-id][data-is-read="false"]'
    );
    if ((await secondArticles.count()) > 0) {
      const secondArticleId = await secondArticles
        .first()
        .getAttribute("data-article-id");
      console.log(`🎯 Navigating to second article: ${secondArticleId}`);

      try {
        await secondArticles.first().click({ timeout: 10000 });
      } catch (e) {
        console.log("Normal click failed, trying force click");
        await secondArticles.first().click({ force: true });
      }
      await page.waitForTimeout(2000);

      // Get complete session storage log
      const completeLog = await page.evaluate(
        () => (window as any).sessionStorageLog || []
      );
      console.log("Complete session storage transaction log:");
      completeLog.forEach((entry: any, idx: number) => {
        console.log(
          `${idx + 1}. ${entry.action} at ${new Date(entry.timestamp).toISOString()}`
        );
        if (entry.fullValue) {
          try {
            const parsed = JSON.parse(entry.fullValue);
            console.log(
              `   - Auto-read: ${parsed.autoReadArticles?.length || 0}`
            );
            console.log(
              `   - Manual-read: ${parsed.manualReadArticles?.length || 0}`
            );
            console.log(`   - Feed ID: ${parsed.feedId}`);
          } catch (e) {
            console.log(`   - Parse error: ${e}`);
          }
        }
      });
    }

    console.log("🏁 Detailed session storage test completed");
  });
});
