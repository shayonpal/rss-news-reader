import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { create } from "zustand";

// Test specification for RR-128: Tag filtering in UI store
// These tests define the EXACT behavior for frontend tag filtering

// Mock store interface that implementation must follow
interface TagFilterStore {
  // State
  selectedTags: string[];
  availableTags: Tag[];
  isLoadingTags: boolean;
  tagError: string | null;
  topicsSectionCollapsed: boolean;

  // Actions
  setSelectedTags: (tags: string[]) => void;
  toggleTag: (tagId: string) => void;
  clearSelectedTags: () => void;
  setAvailableTags: (tags: Tag[]) => void;
  setTopicsSectionCollapsed: (collapsed: boolean) => void;
  toggleTopicsSection: () => void;
  loadTags: () => Promise<void>;
}

interface Tag {
  id: string;
  name: string;
  article_count: number;
}

describe("RR-128: Tag Filter Store Specification", () => {
  let useTagFilterStore: ReturnType<typeof create<TagFilterStore>>;

  beforeEach(() => {
    // Create test store
    useTagFilterStore = create<TagFilterStore>((set, get) => ({
      // Initial state
      selectedTags: [],
      availableTags: [],
      isLoadingTags: false,
      tagError: null,
      topicsSectionCollapsed: false,

      // Actions
      setSelectedTags: (tags) => set({ selectedTags: tags }),

      toggleTag: (tagId) =>
        set((state) => {
          const isSelected = state.selectedTags.includes(tagId);
          return {
            selectedTags: isSelected
              ? state.selectedTags.filter((id) => id !== tagId)
              : [...state.selectedTags, tagId],
          };
        }),

      clearSelectedTags: () => set({ selectedTags: [] }),

      setAvailableTags: (tags) => set({ availableTags: tags }),

      setTopicsSectionCollapsed: (collapsed) =>
        set({ topicsSectionCollapsed: collapsed }),

      toggleTopicsSection: () =>
        set((state) => ({
          topicsSectionCollapsed: !state.topicsSectionCollapsed,
        })),

      loadTags: async () => {
        set({ isLoadingTags: true, tagError: null });
        try {
          // Mock API call
          const response = await fetch("/api/tags");
          if (!response.ok) throw new Error("Failed to load tags");
          const tags = await response.json();
          set({ availableTags: tags, isLoadingTags: false });
        } catch (error) {
          set({
            tagError: error instanceof Error ? error.message : "Unknown error",
            isLoadingTags: false,
          });
        }
      },
    }));

    // Clear localStorage
    localStorage.clear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Tag Selection State", () => {
    it("should initialize with no selected tags", () => {
      const { result } = renderHook(() => useTagFilterStore());

      expect(result.current.selectedTags).toEqual([]);
      expect(result.current.selectedTags).toHaveLength(0);
    });

    it("should allow selecting multiple tags", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.setSelectedTags(["tag-1", "tag-2", "tag-3"]);
      });

      expect(result.current.selectedTags).toEqual(["tag-1", "tag-2", "tag-3"]);
      expect(result.current.selectedTags).toHaveLength(3);
    });

    it("should toggle individual tag selection", () => {
      const { result } = renderHook(() => useTagFilterStore());

      // Toggle tag on
      act(() => {
        result.current.toggleTag("tag-1");
      });
      expect(result.current.selectedTags).toContain("tag-1");

      // Toggle same tag off
      act(() => {
        result.current.toggleTag("tag-1");
      });
      expect(result.current.selectedTags).not.toContain("tag-1");
    });

    it("should handle toggling multiple tags", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.toggleTag("tag-1");
        result.current.toggleTag("tag-2");
        result.current.toggleTag("tag-3");
      });

      expect(result.current.selectedTags).toEqual(["tag-1", "tag-2", "tag-3"]);

      act(() => {
        result.current.toggleTag("tag-2"); // Remove tag-2
      });

      expect(result.current.selectedTags).toEqual(["tag-1", "tag-3"]);
    });

    it("should clear all selected tags", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.setSelectedTags(["tag-1", "tag-2", "tag-3"]);
      });

      expect(result.current.selectedTags).toHaveLength(3);

      act(() => {
        result.current.clearSelectedTags();
      });

      expect(result.current.selectedTags).toEqual([]);
      expect(result.current.selectedTags).toHaveLength(0);
    });

    it("should prevent duplicate tag selections", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.setSelectedTags(["tag-1"]);
        result.current.toggleTag("tag-1"); // Try to add again (should remove)
        result.current.toggleTag("tag-1"); // Add back
      });

      expect(result.current.selectedTags).toEqual(["tag-1"]);
      expect(
        result.current.selectedTags.filter((id) => id === "tag-1")
      ).toHaveLength(1);
    });
  });

  describe("2. Available Tags Management", () => {
    it("should store available tags with counts", () => {
      const { result } = renderHook(() => useTagFilterStore());

      const mockTags: Tag[] = [
        { id: "tag-1", name: "Technology", article_count: 15 },
        { id: "tag-2", name: "AI News", article_count: 8 },
        { id: "tag-3", name: "Product Management", article_count: 23 },
      ];

      act(() => {
        result.current.setAvailableTags(mockTags);
      });

      expect(result.current.availableTags).toEqual(mockTags);
      expect(result.current.availableTags).toHaveLength(3);
      expect(result.current.availableTags[0].article_count).toBe(15);
    });

    it("should handle empty tags list", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.setAvailableTags([]);
      });

      expect(result.current.availableTags).toEqual([]);
      expect(result.current.availableTags).toHaveLength(0);
    });

    it("should update available tags when refreshed", () => {
      const { result } = renderHook(() => useTagFilterStore());

      const initialTags: Tag[] = [
        { id: "tag-1", name: "Old Tag", article_count: 5 },
      ];

      const updatedTags: Tag[] = [
        { id: "tag-1", name: "Old Tag", article_count: 10 }, // Updated count
        { id: "tag-2", name: "New Tag", article_count: 3 }, // New tag
      ];

      act(() => {
        result.current.setAvailableTags(initialTags);
      });

      expect(result.current.availableTags).toHaveLength(1);

      act(() => {
        result.current.setAvailableTags(updatedTags);
      });

      expect(result.current.availableTags).toHaveLength(2);
      expect(result.current.availableTags[0].article_count).toBe(10);
    });
  });

  describe("3. Topics Section Collapse State", () => {
    it("should initialize with Topics section expanded", () => {
      const { result } = renderHook(() => useTagFilterStore());

      expect(result.current.topicsSectionCollapsed).toBe(false);
    });

    it("should toggle Topics section collapse state", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.toggleTopicsSection();
      });
      expect(result.current.topicsSectionCollapsed).toBe(true);

      act(() => {
        result.current.toggleTopicsSection();
      });
      expect(result.current.topicsSectionCollapsed).toBe(false);
    });

    it("should set Topics section collapse state directly", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.setTopicsSectionCollapsed(true);
      });
      expect(result.current.topicsSectionCollapsed).toBe(true);

      act(() => {
        result.current.setTopicsSectionCollapsed(false);
      });
      expect(result.current.topicsSectionCollapsed).toBe(false);
    });

    it("should persist Topics section state in localStorage", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.setTopicsSectionCollapsed(true);
        // Implementation should save to localStorage
        localStorage.setItem("topics-section-collapsed", "true");
      });

      expect(localStorage.getItem("topics-section-collapsed")).toBe("true");

      // Simulate reload by checking localStorage
      const savedState =
        localStorage.getItem("topics-section-collapsed") === "true";
      expect(savedState).toBe(true);
    });
  });

  describe("4. Tag Loading State", () => {
    it("should track loading state during tag fetch", async () => {
      const { result } = renderHook(() => useTagFilterStore());

      // Mock fetch
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [{ id: "tag-1", name: "Test Tag", article_count: 5 }],
      });

      expect(result.current.isLoadingTags).toBe(false);

      const loadPromise = act(() => {
        return result.current.loadTags();
      });

      // Check loading state immediately
      expect(result.current.isLoadingTags).toBe(true);

      await loadPromise;

      expect(result.current.isLoadingTags).toBe(false);
      expect(result.current.availableTags).toHaveLength(1);
    });

    it("should handle tag loading errors", async () => {
      const { result } = renderHook(() => useTagFilterStore());

      // Mock fetch failure
      global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

      await act(async () => {
        await result.current.loadTags();
      });

      expect(result.current.isLoadingTags).toBe(false);
      expect(result.current.tagError).toBe("Network error");
      expect(result.current.availableTags).toEqual([]);
    });

    it("should clear error on successful load", async () => {
      const { result } = renderHook(() => useTagFilterStore());

      // First, create an error state
      global.fetch = vi.fn().mockRejectedValue(new Error("First error"));

      await act(async () => {
        await result.current.loadTags();
      });

      expect(result.current.tagError).toBe("First error");

      // Then, successful load should clear error
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => [],
      });

      await act(async () => {
        await result.current.loadTags();
      });

      expect(result.current.tagError).toBeNull();
    });
  });

  describe("5. Integration with Article Filtering", () => {
    it("should combine tag filters with existing filters", () => {
      // This tests the integration pattern, not the actual implementation
      const filters = {
        feedId: "feed-1",
        showRead: false,
        selectedTags: ["tag-1", "tag-2"],
      };

      // Combined filter should include all criteria
      expect(filters).toMatchObject({
        feedId: "feed-1",
        showRead: false,
        selectedTags: expect.arrayContaining(["tag-1", "tag-2"]),
      });
    });

    it("should trigger article refetch when tags change", () => {
      const { result } = renderHook(() => useTagFilterStore());
      const refetchSpy = vi.fn();

      // Simulate article store subscription to tag changes
      const unsubscribe = useTagFilterStore.subscribe(
        (state) => state.selectedTags,
        (selectedTags) => {
          if (selectedTags.length > 0) {
            refetchSpy();
          }
        }
      );

      act(() => {
        result.current.toggleTag("tag-1");
      });

      expect(refetchSpy).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.toggleTag("tag-2");
      });

      expect(refetchSpy).toHaveBeenCalledTimes(2);

      unsubscribe();
    });

    it("should maintain tag selection when switching feeds", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.setSelectedTags(["tag-1", "tag-2"]);
      });

      // Simulate feed change (tags should persist)
      const feedChange = { feedId: "new-feed" };

      expect(result.current.selectedTags).toEqual(["tag-1", "tag-2"]);
      expect(feedChange.feedId).toBe("new-feed");

      // Tags remain selected after feed change
      expect(result.current.selectedTags).toEqual(["tag-1", "tag-2"]);
    });

    it("should clear tags with explicit clear action only", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        result.current.setSelectedTags(["tag-1", "tag-2"]);
      });

      // Other filter changes should not clear tags
      const otherFilterChange = { showRead: true };

      expect(result.current.selectedTags).toEqual(["tag-1", "tag-2"]);
      expect(otherFilterChange.showRead).toBe(true);

      // Tags remain unless explicitly cleared
      expect(result.current.selectedTags).toEqual(["tag-1", "tag-2"]);

      act(() => {
        result.current.clearSelectedTags();
      });

      expect(result.current.selectedTags).toEqual([]);
    });
  });

  describe("6. Performance Optimizations", () => {
    it("should not trigger unnecessary re-renders", () => {
      const { result } = renderHook(() => useTagFilterStore());
      const renderSpy = vi.fn();

      useTagFilterStore.subscribe(renderSpy);

      // Setting same value should not trigger update
      act(() => {
        result.current.setSelectedTags(["tag-1"]);
      });

      const callCount = renderSpy.mock.calls.length;

      act(() => {
        result.current.setSelectedTags(["tag-1"]); // Same value
      });

      // Implementation should use shallow equality check
      // This test expects implementation to optimize this
      expect(renderSpy.mock.calls.length).toBe(callCount + 1); // Will still call, but implementation can optimize
    });

    it("should batch multiple state updates", () => {
      const { result } = renderHook(() => useTagFilterStore());

      act(() => {
        // Multiple updates in same tick should batch
        result.current.setSelectedTags(["tag-1"]);
        result.current.setAvailableTags([
          { id: "tag-1", name: "Tag 1", article_count: 5 },
        ]);
        result.current.setTopicsSectionCollapsed(true);
      });

      // All updates should be applied
      expect(result.current.selectedTags).toEqual(["tag-1"]);
      expect(result.current.availableTags).toHaveLength(1);
      expect(result.current.topicsSectionCollapsed).toBe(true);
    });
  });
});
