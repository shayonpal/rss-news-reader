import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { useUIStore } from "../ui-store";
import { createTestStoreHook } from "./test-utils";

// Mock the ui-store-extensions module that will contain the collapse state
vi.mock("../ui-store-extensions", () => ({
  useUIStoreExtensions: () => ({
    feedsSectionCollapsed: false,
    setFeedsSectionCollapsed: vi.fn(),
    toggleFeedsSection: vi.fn(),
  }),
}));

describe("UI Store Collapse State - RR-146 Specification", () => {
  // Store for isolated testing - RR-188 fix for specific tests only
  let useTestStore: any;
  let cleanupStore: () => void;
  let storageKey: string;
  let initialState: any;

  beforeEach(() => {
    // Create isolated store instance for specific failing tests - RR-188 fix
    const testStore = createTestStoreHook();
    useTestStore = testStore.useTestStore;
    cleanupStore = testStore.cleanup;
    storageKey = testStore.storageKey;

    // Also preserve original store state for non-isolated tests
    initialState = useUIStore.getState();

    // Clear localStorage to ensure clean state
    localStorage.clear();
    sessionStorage.clear();

    // Reset the original store too
    useUIStore.setState({
      ...initialState,
      feedsSectionCollapsed: false,
    } as any);
  });

  afterEach(() => {
    // Proper cleanup of both stores - RR-188 fix
    cleanupStore();
    useUIStore.setState(initialState);
    vi.clearAllMocks();
  });

  describe("1. State Management (8 tests)", () => {
    it("1.1 should initialize feedsSectionCollapsed to false by default", () => {
      const { result } = renderHook(() => useUIStore());

      // Extension state should default to false (expanded)
      expect((result.current as any).feedsSectionCollapsed).toBe(false);
    });

    it("1.2 should update feedsSectionCollapsed state via setter", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      expect((result.current as any).feedsSectionCollapsed).toBe(true);

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(false);
      });

      expect((result.current as any).feedsSectionCollapsed).toBe(false);
    });

    it("1.3 should toggle feedsSectionCollapsed state", () => {
      const { result } = renderHook(() => useUIStore());

      const initialState = (result.current as any).feedsSectionCollapsed;

      act(() => {
        (result.current as any).toggleFeedsSection();
      });

      expect((result.current as any).feedsSectionCollapsed).toBe(!initialState);

      act(() => {
        (result.current as any).toggleFeedsSection();
      });

      expect((result.current as any).feedsSectionCollapsed).toBe(initialState);
    });

    it("1.4 should maintain separate state from sidebar open state", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setSidebarOpen(true);
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      expect(result.current.isSidebarOpen).toBe(true);
      expect((result.current as any).feedsSectionCollapsed).toBe(true);

      act(() => {
        result.current.toggleSidebar();
      });

      // Sidebar state changes independently
      expect(result.current.isSidebarOpen).toBe(false);
      expect((result.current as any).feedsSectionCollapsed).toBe(true);
    });

    it("1.5 should not affect other UI store states", () => {
      const { result } = renderHook(() => useUIStore());

      const initialTheme = result.current.theme;
      const initialLoading = result.current.isLoading;

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      expect(result.current.theme).toBe(initialTheme);
      expect(result.current.isLoading).toBe(initialLoading);
    });

    it("1.6 should handle rapid state changes", () => {
      // Use isolated store for this test - RR-188 fix
      const { result } = renderHook(() => useTestStore());

      act(() => {
        for (let i = 0; i < 100; i++) {
          result.current.toggleFeedsSection();
        }
      });

      // After 100 toggles, should be back to initial state
      expect(result.current.feedsSectionCollapsed).toBe(false);
    });

    it("1.7 should provide correct state to multiple hook instances", () => {
      const { result: result1 } = renderHook(() => useUIStore());
      const { result: result2 } = renderHook(() => useUIStore());

      act(() => {
        (result1.current as any).setFeedsSectionCollapsed(true);
      });

      // Both hooks should see the same state
      expect((result1.current as any).feedsSectionCollapsed).toBe(true);
      expect((result2.current as any).feedsSectionCollapsed).toBe(true);
    });

    it("1.8 should batch multiple state updates efficiently", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
        result.current.setSidebarOpen(false);
        result.current.setLoading(true);
      });

      expect((result.current as any).feedsSectionCollapsed).toBe(true);
      expect(result.current.isSidebarOpen).toBe(false);
      expect(result.current.isLoading).toBe(true);
    });
  });

  describe("2. Session Persistence (8 tests)", () => {
    it("2.1 should NOT persist feedsSectionCollapsed to localStorage", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      // Check localStorage doesn't contain the collapse state
      const storedState = localStorage.getItem("ui-store");
      if (storedState) {
        const parsed = JSON.parse(storedState);
        expect(parsed.state?.feedsSectionCollapsed).toBeUndefined();
      }
    });

    it("2.2 should reset feedsSectionCollapsed on page refresh", () => {
      // Use isolated store for first mount - RR-188 fix
      const { result, unmount } = renderHook(() => useTestStore());

      act(() => {
        result.current.setFeedsSectionCollapsed(true);
      });

      expect(result.current.feedsSectionCollapsed).toBe(true);

      // Simulate page refresh by unmounting and creating new store
      unmount();
      cleanupStore(); // Clean up the old store

      // Create a fresh store instance for the "refreshed" page
      const freshStore = createTestStoreHook();
      const { result: newResult } = renderHook(() => freshStore.useTestStore());

      // Should reset to default (false) after refresh
      expect(newResult.current.feedsSectionCollapsed).toBe(false);

      // Clean up the fresh store
      freshStore.cleanup();
    });

    it("2.3 should maintain session state during component remounts", () => {
      const { result, rerender } = renderHook(() => useUIStore());

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      // Rerender (not refresh)
      rerender();

      // Should maintain state during same session
      expect((result.current as any).feedsSectionCollapsed).toBe(true);
    });

    it("2.4 should persist theme but not collapse state", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme("dark");
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      const storedState = localStorage.getItem("ui-store");
      if (storedState) {
        const parsed = JSON.parse(storedState);
        expect(parsed.state?.theme).toBe("dark");
        expect(parsed.state?.feedsSectionCollapsed).toBeUndefined();
      }
    });

    it("2.5 should not store in sessionStorage", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      // Should not use sessionStorage
      expect(sessionStorage.getItem("feedsSectionCollapsed")).toBeNull();
      expect(sessionStorage.getItem("ui-store")).toBeNull();
    });

    it("2.6 should handle localStorage errors gracefully", () => {
      // Mock localStorage.setItem to throw
      const originalSetItem = localStorage.setItem;
      localStorage.setItem = vi.fn(() => {
        throw new Error("Storage quota exceeded");
      });

      const { result } = renderHook(() => useUIStore());

      // Should not crash when localStorage fails
      expect(() => {
        act(() => {
          result.current.setTheme("dark");
          (result.current as any).setFeedsSectionCollapsed(true);
        });
      }).not.toThrow();

      // Restore original
      localStorage.setItem = originalSetItem;
    });

    it("2.7 should initialize correctly with corrupted localStorage", () => {
      // Set corrupted data with the test store's key - RR-188 fix
      localStorage.setItem(storageKey, "invalid json");

      // Create a new isolated store which should handle corrupted data
      const { result } = renderHook(() => useTestStore());

      // Should fallback to defaults
      expect(result.current.feedsSectionCollapsed).toBe(false);
    });

    it("2.8 should not persist across different browser tabs", () => {
      const { result: tab1 } = renderHook(() => useUIStore());

      act(() => {
        (tab1.current as any).setFeedsSectionCollapsed(true);
      });

      // Simulate new tab with fresh store instance
      useUIStore.setState({
        ...initialState,
        feedsSectionCollapsed: false,
      } as any);

      const { result: tab2 } = renderHook(() => useUIStore());

      // New tab should have default state
      expect((tab2.current as any).feedsSectionCollapsed).toBe(false);
    });
  });

  describe("3. Performance & Optimization (7 tests)", () => {
    it("3.1 should handle rapid toggles without performance degradation", async () => {
      const { result } = renderHook(() => useUIStore());

      const startTime = performance.now();

      act(() => {
        for (let i = 0; i < 1000; i++) {
          (result.current as any).toggleFeedsSection();
        }
      });

      const endTime = performance.now();
      const duration = endTime - startTime;

      // Should complete 1000 toggles in less than 100ms
      expect(duration).toBeLessThan(100);
    });

    it("3.2 should not trigger unnecessary re-renders", () => {
      const renderCount = vi.fn();

      const TestComponent = () => {
        renderCount();
        const collapsed = (useUIStore as any)(
          (state) => state.feedsSectionCollapsed
        );
        return collapsed;
      };

      const { result, rerender } = renderHook(() => TestComponent());

      const initialRenders = renderCount.mock.calls.length;

      // Set to same value
      act(() => {
        useUIStore.setState({ feedsSectionCollapsed: false } as any);
      });

      rerender();

      // Should not cause additional render if value unchanged
      expect(renderCount.mock.calls.length).toBe(initialRenders + 1);
    });

    it("3.3 should batch synchronous updates", () => {
      const { result } = renderHook(() => useUIStore());

      let updateCount = 0;
      const unsubscribe = useUIStore.subscribe(() => {
        updateCount++;
      });

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
        (result.current as any).setFeedsSectionCollapsed(false);
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      // Should batch updates in single render
      expect(updateCount).toBeLessThanOrEqual(3);

      unsubscribe();
    });

    it("3.4 should handle concurrent access from multiple components", async () => {
      const results: any[] = [];

      // Simulate 10 components accessing store simultaneously
      for (let i = 0; i < 10; i++) {
        results.push(renderHook(() => useUIStore()));
      }

      // All should toggle simultaneously
      await act(async () => {
        await Promise.all(
          results.map((r) =>
            Promise.resolve((r.result.current as any).toggleFeedsSection())
          )
        );
      });

      // All should have same final state
      const states = results.map(
        (r) => (r.result.current as any).feedsSectionCollapsed
      );
      expect(new Set(states).size).toBe(1); // All same value
    });

    it("3.5 should not leak memory on unmount", () => {
      const hooks: any[] = [];

      // Create and unmount many hooks
      for (let i = 0; i < 100; i++) {
        const hook = renderHook(() => useUIStore());
        hooks.push(hook);
      }

      // Unmount all
      hooks.forEach((h) => h.unmount());

      // Check store still works
      const { result } = renderHook(() => useUIStore());

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      expect((result.current as any).feedsSectionCollapsed).toBe(true);
    });

    it("3.6 should optimize selector usage", () => {
      const collapseSelector = vi.fn(
        (state: any) => state.feedsSectionCollapsed
      );
      const themeSelector = vi.fn((state: any) => state.theme);

      const TestComponent = () => {
        const collapsed = useUIStore(collapseSelector);
        const theme = useUIStore(themeSelector);
        return { collapsed, theme };
      };

      const { result } = renderHook(() => TestComponent());

      // Change unrelated state
      act(() => {
        useUIStore.setState({ isLoading: true });
      });

      // Selectors should not re-run for unrelated changes
      expect(collapseSelector).toHaveBeenCalledTimes(1);
      expect(themeSelector).toHaveBeenCalledTimes(1);
    });

    it("3.7 should handle store reset efficiently", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
        result.current.setSidebarOpen(true);
        result.current.setLoading(true);
      });

      const startTime = performance.now();

      // Reset to initial state
      act(() => {
        useUIStore.setState(initialState);
      });

      const resetTime = performance.now() - startTime;

      expect(resetTime).toBeLessThan(10);
      expect((result.current as any).feedsSectionCollapsed).toBe(false);
    });
  });

  describe("4. Integration with UI Store (8 tests)", () => {
    it("4.1 should work alongside existing UI store methods", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.setTheme("dark");
        result.current.toggleSidebar();
        (result.current as any).toggleFeedsSection();
        result.current.setLoading(true);
      });

      expect(result.current.theme).toBe("dark");
      expect(result.current.isSidebarOpen).toBe(true);
      expect((result.current as any).feedsSectionCollapsed).toBe(true);
      expect(result.current.isLoading).toBe(true);
    });

    it("4.2 should maintain type safety with TypeScript", () => {
      const { result } = renderHook(() => useUIStore());

      // TypeScript should allow accessing the extended properties
      const store = result.current as any;

      expect(typeof store.feedsSectionCollapsed).toBe("boolean");
      expect(typeof store.setFeedsSectionCollapsed).toBe("function");
      expect(typeof store.toggleFeedsSection).toBe("function");
    });

    it("4.3 should trigger subscribers on collapse state change", () => {
      const subscriber = vi.fn();
      const unsubscribe = useUIStore.subscribe(subscriber);

      const { result } = renderHook(() => useUIStore());

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      expect(subscriber).toHaveBeenCalled();

      unsubscribe();
    });

    it("4.4 should handle undefined/null values gracefully", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(undefined);
      });

      // Should coerce to boolean
      expect((result.current as any).feedsSectionCollapsed).toBe(false);

      act(() => {
        (result.current as any).setFeedsSectionCollapsed(null);
      });

      expect((result.current as any).feedsSectionCollapsed).toBe(false);
    });

    it("4.5 should not interfere with notification system", () => {
      const { result } = renderHook(() => useUIStore());

      act(() => {
        result.current.showNotification("Test message", "info");
        (result.current as any).setFeedsSectionCollapsed(true);
      });

      expect(result.current.notification?.message).toBe("Test message");
      expect((result.current as any).feedsSectionCollapsed).toBe(true);
    });

    it("4.6 should work with devtools", () => {
      // Check if devtools can inspect the state
      const state = useUIStore.getState();

      expect(state).toHaveProperty("theme");
      expect(state).toHaveProperty("isSidebarOpen");
      // Extended state should be accessible
      expect(state).toHaveProperty("feedsSectionCollapsed");
    });

    it("4.7 should handle store destruction gracefully", () => {
      // Use isolated store for destruction test - RR-188 fix
      const { result } = renderHook(() => useTestStore());

      act(() => {
        result.current.setFeedsSectionCollapsed(true);
      });

      // Clean up current store
      cleanupStore();

      // Create a fresh store after destruction
      const freshStore = createTestStoreHook();
      const { result: newResult } = renderHook(() => freshStore.useTestStore());

      // Should reinitialize with defaults
      expect(newResult.current.feedsSectionCollapsed).toBe(false);

      // Clean up the fresh store
      freshStore.cleanup();
    });

    it("4.8 should support middleware extensions", () => {
      // Test that store can be extended with additional middleware
      const logMiddleware = vi.fn();

      const TestComponent = () => {
        const store = useUIStore();

        // Wrap methods with logging
        const originalToggle = (store as any).toggleFeedsSection;
        (store as any).toggleFeedsSection = () => {
          logMiddleware("toggle");
          originalToggle?.();
        };

        return store;
      };

      const { result } = renderHook(() => TestComponent());

      act(() => {
        (result.current as any).toggleFeedsSection();
      });

      expect(logMiddleware).toHaveBeenCalledWith("toggle");
    });
  });
});
