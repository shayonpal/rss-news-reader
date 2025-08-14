import { describe, it, expect, vi, beforeEach } from "vitest";
import { useTagStore } from "../tag-store";
import type { Tag } from "@/types";

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("Tag Store", () => {
  beforeEach(() => {
    // Reset the store state
    useTagStore.setState({
      tags: new Map(),
      selectedTagIds: new Set(),
      isLoading: false,
      error: null,
    });

    // Reset mocks
    mockFetch.mockReset();
  });

  it("should initialize with empty state", () => {
    const state = useTagStore.getState();

    expect(state.tags.size).toBe(0);
    expect(state.selectedTagIds.size).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(null);
  });

  it("should select a single tag", () => {
    const { selectTag } = useTagStore.getState();
    const tagId = "test-tag-id";

    selectTag(tagId);

    const state = useTagStore.getState();
    expect(state.selectedTagIds.has(tagId)).toBe(true);
    expect(state.selectedTagIds.size).toBe(1);
  });

  it("should clear selection when selecting null", () => {
    const { selectTag } = useTagStore.getState();

    // First select a tag
    selectTag("test-tag-id");
    expect(useTagStore.getState().selectedTagIds.size).toBe(1);

    // Then clear selection
    selectTag(null);
    expect(useTagStore.getState().selectedTagIds.size).toBe(0);
  });

  it("should toggle tag selection", () => {
    const { toggleTag } = useTagStore.getState();
    const tagId = "test-tag-id";

    // Add tag
    toggleTag(tagId);
    expect(useTagStore.getState().selectedTagIds.has(tagId)).toBe(true);

    // Remove tag
    toggleTag(tagId);
    expect(useTagStore.getState().selectedTagIds.has(tagId)).toBe(false);
  });

  it("should clear all selected tags", () => {
    const { toggleTag, clearSelectedTags } = useTagStore.getState();

    // Add multiple tags
    toggleTag("tag1");
    toggleTag("tag2");
    expect(useTagStore.getState().selectedTagIds.size).toBe(2);

    // Clear all
    clearSelectedTags();
    expect(useTagStore.getState().selectedTagIds.size).toBe(0);
  });

  it("should load tags from API", async () => {
    const mockTags = [
      {
        id: "tag1",
        name: "Gaming",
        slug: "gaming",
        color: null,
        description: null,
        article_count: 1,
        user_id: "user1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tags: mockTags }),
    });

    const { loadTags } = useTagStore.getState();
    await loadTags();

    const state = useTagStore.getState();
    expect(state.tags.size).toBe(1);
    expect(state.tags.get("tag1")?.name).toBe("Gaming");
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe(null);
  });

  it("should handle API error when loading tags", async () => {
    mockFetch.mockRejectedValueOnce(new Error("API Error"));

    const { loadTags } = useTagStore.getState();
    await loadTags();

    const state = useTagStore.getState();
    expect(state.tags.size).toBe(0);
    expect(state.isLoading).toBe(false);
    expect(state.error).toBe("API Error");
  });

  it("should get selected tags", () => {
    const { selectTag, getSelectedTags } = useTagStore.getState();

    // Setup some tags
    const tag1: Tag = {
      id: "tag1",
      name: "Gaming",
      slug: "gaming",
      color: undefined,
      description: undefined,
      articleCount: 1,
      userId: "user1",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    useTagStore.setState({
      tags: new Map([["tag1", tag1]]),
    });

    selectTag("tag1");

    const selectedTags = getSelectedTags();
    expect(selectedTags).toHaveLength(1);
    expect(selectedTags[0].name).toBe("Gaming");
  });

  it("should handle includeEmpty parameter in loadTags", async () => {
    const mockTags = [
      {
        id: "tag1",
        name: "Gaming",
        slug: "gaming",
        color: null,
        description: null,
        article_count: 1,
        user_id: "user1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: "tag2",
        name: "Empty Tag",
        slug: "empty-tag",
        color: null,
        description: null,
        article_count: 0,
        user_id: "user1",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ tags: mockTags }),
    });

    const { loadTags } = useTagStore.getState();
    await loadTags(true); // includeEmpty = true

    expect(mockFetch).toHaveBeenCalledWith(
      "/reader/api/tags?includeEmpty=true"
    );

    const state = useTagStore.getState();
    expect(state.tags.size).toBe(2);
  });
});
