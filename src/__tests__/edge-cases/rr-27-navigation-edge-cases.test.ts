import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { articleListStateManager } from "@/lib/utils/article-list-state-manager";
import { navigationHistory } from "@/lib/utils/navigation-history";

// Mock environment for edge case testing
const createMockEnvironment = () => {
  const mockSessionStorage = {
    data: {} as Record<string, string>,
    getItem: vi.fn((key: string) => mockSessionStorage.data[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      if (Object.keys(mockSessionStorage.data).length >= 10) {
        throw new Error("QuotaExceededError");
      }
      mockSessionStorage.data[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete mockSessionStorage.data[key];
    }),
    clear: vi.fn(() => {
      mockSessionStorage.data = {};
    }),
  };

  const mockIntersectionObserver = vi.fn();
  const mockNavigator = {
    onLine: true,
    userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)",
  };

  return { mockSessionStorage, mockIntersectionObserver, mockNavigator };
};

// Helper type for testing
interface ArticleState {
  id: string;
  isRead: boolean;
  wasAutoRead: boolean;
  position: number;
  sessionPreserved: boolean;
}

describe("RR-27: Article List State Preservation - Edge Cases", () => {
  let mockEnv: ReturnType<typeof createMockEnvironment>;

  beforeEach(() => {
    mockEnv = createMockEnvironment();
    vi.stubGlobal("sessionStorage", mockEnv.mockSessionStorage);
    vi.stubGlobal("navigator", mockEnv.mockNavigator);
    vi.stubGlobal("IntersectionObserver", mockEnv.mockIntersectionObserver);

    vi.useFakeTimers();
    vi.setSystemTime(new Date("2025-01-01T12:00:00.000Z"));

    // Clear state from actual implementations
    articleListStateManager.clearState();
    navigationHistory.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    articleListStateManager.clearState();
    navigationHistory.clear();
  });

  describe("Storage Quota and Memory Management", () => {
    it("should handle session storage quota exceeded gracefully", () => {
      // Create a state that would exceed storage quota
      const articles = Array.from({ length: 1000 }, (_, i) => ({
        id: `article-${i}`,
        isRead: i % 2 === 0,
        wasAutoRead: i % 3 === 0,
        position: i,
        sessionPreserved: i % 4 === 0,
      }));

      const largeState = {
        articleIds: articles.map((a) => a.id),
        readStates: articles.reduce(
          (acc, a) => ({ ...acc, [a.id]: a.isRead }),
          {}
        ),
        autoReadArticles: articles
          .filter((a) => a.wasAutoRead)
          .map((a) => a.id),
        manualReadArticles: [],
        scrollPosition: 5000,
        filterMode: "unread" as const,
      };

      // Should not throw error, but handle gracefully
      expect(() =>
        articleListStateManager.saveListState(largeState)
      ).not.toThrow();

      // State should still be saveable (fallback to smaller dataset)
      const savedState = articleListStateManager.getListState();
      expect(savedState).toBeTruthy();
      expect(savedState?.articleIds.length).toBeLessThanOrEqual(200); // Our implementation limit
    });

    it("should limit article count to prevent memory bloat", () => {
      const articles = Array.from({ length: 2000 }, (_, i) => ({
        id: `article-${i}`,
        isRead: false,
        wasAutoRead: false,
        position: i,
        sessionPreserved: false,
      }));

      const massiveState = {
        articleIds: articles.map((a) => a.id),
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: "all" as const,
      };

      articleListStateManager.saveListState(massiveState);
      const savedState = articleListStateManager.getListState();

      expect(savedState?.articleIds.length).toBeLessThanOrEqual(200);
    });

    it("should handle navigation history storage failures", () => {
      // Fill up storage to trigger quota errors
      for (let i = 0; i < 15; i++) {
        mockEnv.mockSessionStorage.data[`dummy-${i}`] = "x".repeat(1000);
      }

      // Should not throw when adding navigation entries
      expect(() => {
        navigationHistory.addEntry("/article/1");
        navigationHistory.addEntry("/article/2");
      }).not.toThrow();
    });
  });

  describe("Concurrent Access and Race Conditions", () => {
    it("should handle concurrent state updates safely", async () => {
      const initialState = {
        articleIds: ["1", "2"],
        readStates: { "1": false, "2": false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: "unread" as const,
      };

      articleListStateManager.saveListState(initialState);

      // Simulate concurrent updates
      const promises = [
        articleListStateManager.updateArticleState("1", {
          isRead: true,
          wasAutoRead: true,
        }),
        articleListStateManager.updateArticleState("2", {
          isRead: true,
          wasAutoRead: false,
        }),
        articleListStateManager.batchUpdateArticles([
          { id: "1", changes: { isRead: true } },
        ]),
      ];

      const results = await Promise.all(promises);

      // All updates should succeed
      expect(results.every((result) => result)).toBe(true);

      // Final state should be consistent
      const finalState = articleListStateManager.getListState();
      expect(finalState).toBeTruthy();
    });

    it("should handle rapid navigation history updates", () => {
      // Simulate rapid navigation
      const paths = Array.from({ length: 20 }, (_, i) => `/article/${i}`);

      expect(() => {
        paths.forEach((path) => navigationHistory.addEntry(path));
      }).not.toThrow();

      // History should maintain reasonable size
      // Note: getHistory() is available in our actual implementation
      const history = navigationHistory.getHistory();
      expect(history.length).toBeLessThanOrEqual(20); // Our implementation uses MAX_HISTORY = 20
    });
  });

  describe("Browser Environment Edge Cases", () => {
    it("should handle iOS Safari quirks", () => {
      // Mock iOS Safari user agent
      vi.stubGlobal("navigator", {
        ...mockEnv.mockNavigator,
        userAgent:
          "Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      });

      const state = {
        articleIds: ["1"],
        readStates: { "1": true },
        autoReadArticles: ["1"],
        manualReadArticles: [],
        scrollPosition: 100,
        filterMode: "unread" as const,
      };

      // Should work on iOS Safari
      expect(() => articleListStateManager.saveListState(state)).not.toThrow();
      expect(articleListStateManager.getListState()).toBeTruthy();
    });

    it("should handle private browsing mode restrictions", () => {
      // Mock private browsing (sessionStorage throws on setItem)
      mockEnv.mockSessionStorage.setItem.mockImplementation(() => {
        throw new Error("QuotaExceededError");
      });

      const state = {
        articleIds: [],
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: "all" as const,
      };

      // Should handle gracefully without crashing
      expect(() => articleListStateManager.saveListState(state)).not.toThrow();

      // Navigation should still work
      expect(() => navigationHistory.addEntry("/article/1")).not.toThrow();
    });

    it("should handle disabled JavaScript storage", () => {
      // Mock completely disabled sessionStorage
      vi.stubGlobal("sessionStorage", undefined);

      expect(() => {
        // Clear and test
        articleListStateManager.clearState();
        navigationHistory.clear();
      }).not.toThrow();

      // Should degrade gracefully
      expect(articleListStateManager.getListState()).toBeNull();
    });
  });

  describe("Network and Connectivity Edge Cases", () => {
    it("should handle offline state management", () => {
      mockEnv.mockNavigator.onLine = false;

      const state = {
        articleIds: ["1"],
        readStates: { "1": true },
        autoReadArticles: ["1"],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: "unread" as const,
      };

      // State management should work offline
      articleListStateManager.saveListState(state);
      expect(articleListStateManager.getListState()).toBeTruthy();

      // Navigation should work offline
      navigationHistory.addEntry("/");
      navigationHistory.addEntry("/article/1");
      const backEntry = navigationHistory.goBack();
      expect(backEntry?.path).toBe("/");
    });

    it("should handle connection state changes during navigation", () => {
      // Start online
      mockEnv.mockNavigator.onLine = true;
      navigationHistory.addEntry("/");
      navigationHistory.addEntry("/article/1");

      // Go offline
      mockEnv.mockNavigator.onLine = false;
      navigationHistory.addEntry("/article/2");

      // Come back online
      mockEnv.mockNavigator.onLine = true;
      navigationHistory.addEntry("/article/3");

      // Navigation history should remain intact
      const back1 = navigationHistory.goBack();
      expect(back1?.path).toBe("/article/2");
      const back2 = navigationHistory.goBack();
      expect(back2?.path).toBe("/article/1");
    });
  });

  describe("Data Corruption and Recovery", () => {
    it("should recover from corrupted state data", () => {
      // Inject corrupted data
      mockEnv.mockSessionStorage.data.articleListState = "{invalid-json}";
      mockEnv.mockSessionStorage.data.navigationHistory = "not-json-at-all";

      expect(() => {
        // Clear and test
        articleListStateManager.clearState();
        navigationHistory.clear();
      }).not.toThrow();

      // Should return null for corrupted state
      expect(articleListStateManager.getListState()).toBeNull();

      // Should clear corrupted data
      expect(mockEnv.mockSessionStorage.removeItem).toHaveBeenCalled();
    });

    it("should handle partial data corruption", () => {
      const partiallyCorruptedState = {
        articles: [
          { id: "1", isRead: "invalid", position: null }, // Invalid types
          {
            id: "2",
            isRead: true,
            wasAutoRead: false,
            position: 1,
            sessionPreserved: true,
          }, // Valid
        ],
        scrollPosition: "invalid",
        timestamp: Date.now(),
        filter: "invalid-filter",
      };

      mockEnv.mockSessionStorage.data.articleListState = JSON.stringify(
        partiallyCorruptedState
      );

      // Should handle gracefully
      expect(() => articleListStateManager.getListState()).not.toThrow();
    });

    it("should handle state with missing required fields", () => {
      const incompleteState = {
        articles: [{ id: "1" }], // Missing required fields
        // Missing scrollPosition, timestamp, filter
      };

      mockEnv.mockSessionStorage.data.articleListState =
        JSON.stringify(incompleteState);

      // Our implementation will return null for invalid data
      expect(articleListStateManager.getListState()).toBeNull();
    });
  });

  describe("Performance Edge Cases", () => {
    it("should handle very large scroll positions", () => {
      const state = {
        articleIds: ["1"],
        readStates: { "1": false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: Number.MAX_SAFE_INTEGER,
        filterMode: "all" as const,
      };

      expect(() => articleListStateManager.saveListState(state)).not.toThrow();

      const savedState = articleListStateManager.getListState();
      expect(savedState?.scrollPosition).toBe(Number.MAX_SAFE_INTEGER);
    });

    it("should handle rapid state updates without memory leaks", () => {
      // Simulate rapid state updates like during scrolling
      for (let i = 0; i < 100; i++) {
        const state = {
          articleIds: ["1"],
          readStates: { "1": false },
          autoReadArticles: [],
          manualReadArticles: [],
          scrollPosition: i * 10,
          filterMode: "unread" as const,
        };

        articleListStateManager.saveListState(state);
      }

      // Should not accumulate multiple copies
      expect(
        Object.keys(mockEnv.mockSessionStorage.data).length
      ).toBeLessThanOrEqual(3);
    });

    it("should handle timestamp edge cases", () => {
      // Test with various timestamp edge cases
      const timestamps = [
        0, // Epoch
        Date.now() + 86400000, // Future date
        -1, // Negative timestamp
        NaN, // Invalid timestamp
        Infinity, // Infinite timestamp
      ];

      timestamps.forEach((timestamp) => {
        const state = {
          articleIds: [],
          readStates: {},
          autoReadArticles: [],
          manualReadArticles: [],
          scrollPosition: 0,
          filterMode: "all" as const,
          timestamp, // This won't be used by saveListState
        };

        expect(() =>
          articleListStateManager.saveListState(state as any)
        ).not.toThrow();
      });
    });
  });

  describe("Cross-Tab and Multi-Instance Scenarios", () => {
    it("should handle state conflicts between multiple tabs", () => {
      // Simulate another tab updating the same state
      const tab1State = {
        articleIds: ["1"],
        readStates: { "1": false },
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 100,
        filterMode: "unread" as const,
      };

      const tab2State = {
        articleIds: ["1"],
        readStates: { "1": true },
        autoReadArticles: ["1"],
        manualReadArticles: [],
        scrollPosition: 200,
        timestamp: Date.now() + 1000, // Slightly newer
        filterMode: "all" as const,
      };

      // Tab 1 saves state
      articleListStateManager.saveListState(tab1State);

      // Simulate tab 2 saving newer state
      mockEnv.mockSessionStorage.data.articleListState =
        JSON.stringify(tab2State);

      // Tab 1 reads state - should get tab 2's newer state
      const currentState = articleListStateManager.getListState();
      expect(currentState?.filterMode).toBe("all");
      expect(currentState?.scrollPosition).toBe(200);
    });
  });

  describe("Real-World Stress Testing", () => {
    it("should handle user rapidly switching between articles", () => {
      // Simulate rapid article switching
      const articles = Array.from({ length: 50 }, (_, i) => `/article/${i}`);

      // Initialize state first
      articleListStateManager.saveListState({
        articleIds: Array.from({ length: 50 }, (_, i) => `${i}`),
        readStates: {},
        autoReadArticles: [],
        manualReadArticles: [],
        scrollPosition: 0,
        filterMode: "unread",
      });

      expect(() => {
        articles.forEach((path) => {
          navigationHistory.addEntry(path);

          // Simulate state updates for each article
          articleListStateManager.updateArticleState(`${path.split("/")[2]}`, {
            isRead: true,
            wasAutoRead: Math.random() > 0.5,
          });
        });
      }).not.toThrow();

      // System should remain stable
      expect(navigationHistory.getCurrentPath()).toBeTruthy();
      // State manager may not have state if nothing was saved
      expect(() => articleListStateManager.getListState()).not.toThrow();
    });

    it("should handle app backgrounding and foregrounding", () => {
      const state = {
        articleIds: ["1"],
        readStates: { "1": true },
        autoReadArticles: ["1"],
        manualReadArticles: [],
        scrollPosition: 500,
        filterMode: "unread" as const,
      };

      articleListStateManager.saveListState(state);

      // Simulate app being backgrounded for a long time
      vi.advanceTimersByTime(25 * 60 * 1000); // 25 minutes - still valid

      expect(articleListStateManager.getListState()).toBeTruthy();

      // Simulate app being backgrounded beyond expiry
      vi.advanceTimersByTime(10 * 60 * 1000); // Total 35 minutes - expired

      expect(articleListStateManager.getListState()).toBeNull();
    });

    it("should handle system resource pressure", () => {
      // Simulate system under memory pressure
      let callCount = 0;
      mockEnv.mockSessionStorage.setItem.mockImplementation((key, value) => {
        callCount++;
        if (callCount % 3 === 0) {
          throw new Error("QuotaExceededError");
        }
        mockEnv.mockSessionStorage.data[key] = value;
      });

      // Should degrade gracefully under pressure
      for (let i = 0; i < 10; i++) {
        const state = {
          articleIds: [`${i}`],
          readStates: { [`${i}`]: false },
          autoReadArticles: [],
          manualReadArticles: [],
          scrollPosition: i * 100,
          filterMode: "unread" as const,
        };

        expect(() =>
          articleListStateManager.saveListState(state)
        ).not.toThrow();
      }
    });
  });
});
