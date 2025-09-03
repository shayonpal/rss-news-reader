/**
 * RR-27: Test Consolidation - Page Helper Classes
 *
 * Domain-specific page models and helper utilities for RR-27 testing
 */

import { Page, Locator, expect } from "@playwright/test";
import {
  AppState,
  FilterState,
  StateComparisonOptions,
  TEST_CONSTANTS,
} from "./types";

/**
 * Main state preservation helper - core functionality for all RR-27 tests
 */
export class StatePreservationHelper {
  constructor(private page: Page) {}

  /**
   * Capture complete current application state
   */
  async captureCurrentState(): Promise<AppState> {
    return {
      filters: await this.getFilterState(),
      scrollPosition: await this.getScrollPosition(),
      sessionStorage: await this.getSessionStorage(),
      articles: await this.getVisibleArticleStates(),
    };
  }

  /**
   * Assert that state has been preserved between before/after captures
   */
  async assertStatePreserved(
    before: AppState,
    after: AppState,
    options: StateComparisonOptions = {}
  ) {
    // Filter state should be identical
    expect(after.filters).toEqual(before.filters);

    // Session storage should be preserved
    expect(after.sessionStorage).toEqual(before.sessionStorage);

    // Scroll position should be close (within tolerance)
    if (!options.ignoreScroll) {
      const tolerance =
        options.tolerancePixels || TEST_CONSTANTS.SCROLL_TOLERANCE;
      expect(
        Math.abs(after.scrollPosition - before.scrollPosition)
      ).toBeLessThan(tolerance);
    }

    // Article states should be preserved
    expect(after.articles.length).toBeGreaterThanOrEqual(
      before.articles.length
    );
  }

  /**
   * Get current filter state from UI
   */
  private async getFilterState(): Promise<FilterState> {
    const feedSelector = this.page.locator('[data-testid="feed-selector"]');
    const readFilter = this.page.locator('[data-testid="read-filter"]');
    const searchInput = this.page.locator('[data-testid="search-input"]');

    return {
      feedId: await this.getSelectedValue(feedSelector),
      readFilter: (await this.getActiveFilterValue(readFilter)) as
        | "all"
        | "unread"
        | "read",
      searchQuery: await this.getValue(searchInput),
    };
  }

  /**
   * Get current scroll position
   */
  private async getScrollPosition(): Promise<number> {
    return await this.page.evaluate(() => {
      const container =
        (document.querySelector(
          '[data-testid="article-list-container"]'
        ) as HTMLElement) || document.body;
      return container.scrollTop || window.scrollY;
    });
  }

  /**
   * Get all session storage data
   */
  private async getSessionStorage(): Promise<Record<string, string>> {
    return await this.page.evaluate(() => {
      const storage: Record<string, string> = {};
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i);
        if (key) {
          storage[key] = sessionStorage.getItem(key) || "";
        }
      }
      return storage;
    });
  }

  /**
   * Get states of all visible articles
   */
  private async getVisibleArticleStates() {
    const articles = this.page.locator("[data-article-id]");
    const count = await articles.count();
    const states = [];

    for (let i = 0; i < count; i++) {
      const article = articles.nth(i);
      states.push({
        id: (await article.getAttribute("data-article-id")) || "",
        title:
          (await article
            .locator('h2, h3, [class*="title"]')
            .first()
            .textContent()) || "",
        feedId: (await article.getAttribute("data-feed-id")) || "",
        isRead: (await article.getAttribute("data-is-read")) === "true",
        isStarred: (await article.getAttribute("data-is-starred")) === "true",
        isSessionPreserved:
          (await article.locator(".session-preserved-read").count()) > 0,
        publishedAt: (await article.getAttribute("data-published-at")) || "",
      });
    }

    return states;
  }

  /**
   * Helper to get selected value from selector
   */
  private async getSelectedValue(
    locator: Locator
  ): Promise<string | undefined> {
    try {
      return await locator.inputValue();
    } catch (error) {
      console.warn("Failed to get selected value:", error);
      return undefined;
    }
  }

  /**
   * Helper to get active filter value
   */
  private async getActiveFilterValue(locator: Locator): Promise<string> {
    try {
      const activeButton = locator.locator('[aria-pressed="true"], .active');
      return (await activeButton.textContent()) || "all";
    } catch (error) {
      console.warn(
        'Failed to get active filter value, defaulting to "all":',
        error
      );
      return "all";
    }
  }

  /**
   * Helper to get input value
   */
  private async getValue(locator: Locator): Promise<string> {
    try {
      return (await locator.inputValue()) || "";
    } catch {
      return "";
    }
  }

  /**
   * Navigate and measure performance
   */
  async simulateNavigation(
    path: string
  ): Promise<{ duration: number; success: boolean }> {
    const start = performance.now();
    try {
      await this.page.goto(path);
      await this.page.waitForLoadState("networkidle");
      return {
        duration: performance.now() - start,
        success: true,
      };
    } catch (error) {
      return {
        duration: performance.now() - start,
        success: false,
      };
    }
  }

  /**
   * Measure performance of any state operation
   */
  async measureStateOperationPerformance<T>(
    operation: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = performance.now();
    const result = await operation();
    const duration = performance.now() - start;
    return { result, duration };
  }
}

/**
 * Article interaction helper - handles clicking, scrolling, and article state
 */
export class ArticleInteractionHelper {
  constructor(private page: Page) {}

  /**
   * Wait for article list to load and be interactive
   */
  async waitForArticleList(): Promise<void> {
    await this.page.waitForSelector("[data-article-id]", {
      timeout: TEST_CONSTANTS.DEFAULT_TIMEOUT,
    });
    await this.page.waitForTimeout(1000); // Allow for dynamic loading
  }

  /**
   * Get all article elements
   */
  async getArticleElements(): Promise<Locator> {
    return this.page.locator("[data-article-id]");
  }

  /**
   * Get count of visible articles
   */
  async getArticleCount(): Promise<number> {
    const articles = await this.getArticleElements();
    return await articles.count();
  }

  /**
   * Get unread articles only
   */
  async getUnreadArticles(): Promise<Locator[]> {
    const articles = this.page.locator(
      '[data-article-id][data-is-read="false"]'
    );
    const count = await articles.count();
    const elements = [];

    for (let i = 0; i < count; i++) {
      elements.push(articles.nth(i));
    }

    return elements;
  }

  /**
   * Get session-preserved articles (auto-read but still visible)
   */
  async getSessionPreservedArticles(): Promise<Locator[]> {
    const articles = this.page.locator(
      "[data-article-id].session-preserved-read"
    );
    const count = await articles.count();
    const elements = [];

    for (let i = 0; i < count; i++) {
      elements.push(articles.nth(i));
    }

    return elements;
  }

  /**
   * Scroll to mark articles as read via auto-scroll behavior
   */
  async scrollToMarkArticlesAsRead(count: number = 3): Promise<string[]> {
    const articles = await this.getArticleElements();
    const articleCount = Math.min(count, await articles.count());

    if (articleCount === 0) return [];

    const markedArticles: string[] = [];

    // Scroll past articles to trigger auto-read
    for (let i = 0; i < articleCount; i++) {
      const article = articles.nth(i);
      const articleId = await article.getAttribute("data-article-id");

      if (articleId) {
        markedArticles.push(articleId);

        // Scroll past this article to trigger auto-read
        const articleBox = await article.boundingBox();
        if (articleBox) {
          await this.page.mouse.wheel(0, articleBox.height + 50);
          await this.page.waitForTimeout(200); // Wait for scroll to settle
        }
      }
    }

    // Wait for auto-read processing
    await this.page.waitForTimeout(2000);

    return markedArticles;
  }

  /**
   * Click article and wait for navigation
   */
  async clickArticleAndNavigate(articleSelector: string): Promise<string> {
    const article = this.page.locator(articleSelector);
    const articleId = await article.getAttribute("data-article-id");

    await article.click();

    if (articleId) {
      await this.page.waitForURL(new RegExp(`/reader/article/${articleId}`));
    }

    return articleId || "";
  }

  /**
   * Navigate back and wait for article list
   */
  async navigateBackToList(): Promise<void> {
    await this.page.goBack();
    await this.page.waitForURL("/reader");
    await this.waitForArticleList();
  }
}

/**
 * Filter management helper - handles all filter operations
 */
export class FilterHelper {
  constructor(private page: Page) {}

  /**
   * Switch to "Unread Only" mode
   */
  async switchToUnreadOnlyMode(): Promise<void> {
    const filterButton = this.page.locator('button:has-text("Unread")');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await this.page.waitForTimeout(500); // Wait for filter to apply
    }
  }

  /**
   * Switch to "All" mode
   */
  async switchToAllMode(): Promise<void> {
    const filterButton = this.page.locator('button:has-text("All")');
    if (await filterButton.isVisible()) {
      await filterButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Generic filter switch method
   */
  async switchFilter(filterType: "all" | "unread" | "read"): Promise<void> {
    switch (filterType) {
      case "all":
        await this.switchToAllMode();
        break;
      case "unread":
        await this.switchToUnreadOnlyMode();
        break;
      case "read":
        // Implement read filter if needed, for now switch to all
        await this.switchToAllMode();
        break;
      default:
        throw new Error(`Unknown filter type: ${filterType}`);
    }
  }

  /**
   * Select specific feed
   */
  async selectFeed(feedId: string): Promise<void> {
    await this.page.selectOption('[data-testid="feed-selector"]', feedId);
    await this.page.waitForTimeout(500);
  }

  /**
   * Set search query
   */
  async setSearchQuery(query: string): Promise<void> {
    await this.page.fill('[data-testid="search-input"]', query);
    await this.page.waitForTimeout(500);
  }

  /**
   * Clear all filters
   */
  async clearAllFilters(): Promise<void> {
    const clearButton = this.page.locator('[data-testid="clear-filters"]');
    if (await clearButton.isVisible()) {
      await clearButton.click();
      await this.page.waitForTimeout(500);
    }
  }

  /**
   * Get current filter values
   */
  async getCurrentFilters(): Promise<FilterState> {
    const feedSelector = this.page.locator('[data-testid="feed-selector"]');
    const searchInput = this.page.locator('[data-testid="search-input"]');
    const activeReadFilter = this.page.locator(
      '[data-testid="read-filter"] [aria-pressed="true"]'
    );

    return {
      feedId: await this.getInputValue(feedSelector),
      searchQuery: await this.getInputValue(searchInput),
      readFilter:
        ((await activeReadFilter.textContent())?.toLowerCase() as
          | "all"
          | "unread"
          | "read") || "all",
    };
  }

  private async getInputValue(locator: Locator): Promise<string | undefined> {
    try {
      const value = await locator.inputValue();
      return value || undefined;
    } catch {
      return undefined;
    }
  }
}

/**
 * Mobile-specific testing helper
 */
export class MobileTestHelper {
  private static readonly MOBILE_VIEWPORT = TEST_CONSTANTS.MOBILE_VIEWPORT;

  /**
   * Setup mobile test environment
   */
  static async setupMobileEnvironment(page: Page): Promise<void> {
    await page.setViewportSize(this.MOBILE_VIEWPORT);
    await page.addInitScript(() => {
      // Enable touch events
      Object.defineProperty(navigator, "maxTouchPoints", { value: 5 });
      Object.defineProperty(navigator, "userAgent", {
        value:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15",
      });
    });
  }

  /**
   * Simulate swipe gestures
   */
  static async simulateSwipeGesture(
    page: Page,
    direction: "up" | "down" | "left" | "right"
  ): Promise<void> {
    const viewport = page.viewportSize()!;
    const startX = viewport.width / 2;
    const startY = viewport.height / 2;

    const endPoints = {
      up: { x: startX, y: startY - 200 },
      down: { x: startX, y: startY + 200 },
      left: { x: startX - 200, y: startY },
      right: { x: startX + 200, y: startY },
    };

    const end = endPoints[direction];

    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 10 });
    await page.mouse.up();

    await page.waitForTimeout(500); // Allow gesture to complete
  }

  /**
   * Simulate pull-to-refresh gesture
   */
  static async simulatePullToRefresh(page: Page): Promise<void> {
    await page.evaluate(() => {
      window.dispatchEvent(new Event("pulltorefresh"));
    });
    await page.waitForLoadState("networkidle");
  }
}

/**
 * Session storage management helper
 */
export class SessionStorageHelper {
  constructor(private page: Page) {}

  /**
   * Get session storage value
   */
  async getItem(key: string): Promise<string | null> {
    return await this.page.evaluate((storageKey) => {
      return sessionStorage.getItem(storageKey);
    }, key);
  }

  /**
   * Set session storage value
   */
  async setItem(key: string, value: string): Promise<void> {
    await this.page.evaluate(
      ({ storageKey, storageValue }) => {
        sessionStorage.setItem(storageKey, storageValue);
      },
      { storageKey: key, storageValue: value }
    );
  }

  /**
   * Clear session storage
   */
  async clear(): Promise<void> {
    await this.page.evaluate(() => {
      sessionStorage.clear();
    });
  }

  /**
   * Fill session storage to approach quota limit
   */
  async fillToQuotaLimit(): Promise<void> {
    await this.page.evaluate(() => {
      try {
        for (let i = 0; i < 100; i++) {
          const largeData = "x".repeat(10000);
          sessionStorage.setItem(`test-filler-${i}`, largeData);
        }
      } catch (e) {
        // Expected when quota is reached
      }
    });
  }

  /**
   * Set expired state in session storage
   */
  async setExpiredState(minutesAgo: number = 31): Promise<void> {
    const expiredTime = Date.now() - minutesAgo * 60 * 1000;
    const expiredState = {
      articleIds: ["test-1", "test-2"],
      readStates: { "test-1": true, "test-2": true },
      autoReadArticles: ["test-1", "test-2"],
      manualReadArticles: [],
      scrollPosition: 100,
      timestamp: expiredTime,
      filterMode: "unread",
    };

    await this.setItem("articleListState", JSON.stringify(expiredState));
  }
}
