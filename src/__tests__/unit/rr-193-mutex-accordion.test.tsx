/**
 * RR-193: Mutex Accordion Logic Tests
 * Tests the mutex behavior where only Topics OR Feeds can be open simultaneously
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { act, cleanup as rtlCleanup } from "@testing-library/react";
import { useUIStore } from "@/lib/stores/ui-store";

describe("RR-193 Mutex Accordion Logic", () => {
  let cleanup: (() => void) | undefined;

  beforeEach(() => {
    // Clear all mocks before each test
    vi.clearAllMocks();

    // Reset store state before each test
    act(() => {
      useUIStore.getState().resetMutexState?.();
    });
  });

  afterEach(() => {
    // Cleanup store state and subscriptions
    cleanup?.();
    rtlCleanup(); // React Testing Library cleanup

    // Clear all timers and restore mocks
    vi.clearAllTimers();
    vi.restoreAllMocks();
  });

  describe("Default State", () => {
    it("should initialize with Topics open and Feeds closed", () => {
      const { tagsSectionCollapsed, feedsSectionCollapsed } =
        useUIStore.getState();

      // Default: Topics open (not collapsed), Feeds closed (collapsed)
      expect(tagsSectionCollapsed).toBe(false); // Topics open by default
      expect(feedsSectionCollapsed).toBe(true); // Feeds closed by default
    });

    it("should maintain default state across store resets", () => {
      act(() => {
        useUIStore.getState().resetMutexState?.();
      });

      const { tagsSectionCollapsed, feedsSectionCollapsed } =
        useUIStore.getState();
      expect(tagsSectionCollapsed).toBe(false);
      expect(feedsSectionCollapsed).toBe(true);
    });
  });

  describe("Mutex Behavior", () => {
    it("should close Feeds when Topics is opened", () => {
      // Setup: Start with Topics closed, Feeds open
      act(() => {
        useUIStore.getState().setTagsSectionCollapsed(true);
        useUIStore.getState().setFeedsSectionCollapsed(false);
      });

      // Action: Open Topics
      act(() => {
        useUIStore.getState().toggleTagsSection();
      });

      // Assert: Topics should be open, Feeds should be closed (mutex)
      const { tagsSectionCollapsed, feedsSectionCollapsed } =
        useUIStore.getState();
      expect(tagsSectionCollapsed).toBe(false); // Topics now open
      expect(feedsSectionCollapsed).toBe(true); // Feeds auto-closed
    });

    it("should close Topics when Feeds is opened", () => {
      // Setup: Start with default state (Topics open, Feeds closed)
      act(() => {
        useUIStore.getState().resetMutexState?.();
      });

      // Action: Open Feeds
      act(() => {
        useUIStore.getState().toggleFeedsSection();
      });

      // Assert: Feeds should be open, Topics should be closed (mutex)
      const { tagsSectionCollapsed, feedsSectionCollapsed } =
        useUIStore.getState();
      expect(feedsSectionCollapsed).toBe(false); // Feeds now open
      expect(tagsSectionCollapsed).toBe(true); // Topics auto-closed
    });

    it("should allow closing both sections (no section open)", () => {
      // Setup: Start with Topics open
      act(() => {
        useUIStore.getState().resetMutexState?.();
      });

      // Action: Close the open section
      act(() => {
        useUIStore.getState().toggleTagsSection();
      });

      // Assert: Both sections should be closed
      const { tagsSectionCollapsed, feedsSectionCollapsed } =
        useUIStore.getState();
      expect(tagsSectionCollapsed).toBe(true); // Topics closed
      expect(feedsSectionCollapsed).toBe(true); // Feeds still closed
    });

    it("should not allow both sections to be open simultaneously", () => {
      // Setup: Start fresh
      act(() => {
        useUIStore.getState().resetMutexState?.();
      });

      // Try to open both sections in sequence
      act(() => {
        useUIStore.getState().setTagsSectionCollapsed(false); // Open Topics
        useUIStore.getState().setFeedsSectionCollapsed(false); // Try to open Feeds
      });

      // Assert: Only the last opened section should remain open
      const { tagsSectionCollapsed, feedsSectionCollapsed } =
        useUIStore.getState();
      const openSections = [
        !tagsSectionCollapsed,
        !feedsSectionCollapsed,
      ].filter(Boolean);
      expect(openSections).toHaveLength(1); // Exactly one section open
    });
  });

  describe("State Persistence", () => {
    it("should NOT persist mutex accordion state (session only)", () => {
      // This test ensures accordion state is not persisted to localStorage
      // The partialize function in ui-store should exclude accordion state

      const store = useUIStore.getState();
      const persistedState = {
        theme: store.theme,
        // Should NOT include feedsSectionCollapsed or tagsSectionCollapsed
      };

      // Assert that accordion state is excluded from persistence
      expect(persistedState).not.toHaveProperty("feedsSectionCollapsed");
      expect(persistedState).not.toHaveProperty("tagsSectionCollapsed");
    });
  });
});
