import {
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
  vi,
  type MockedFunction,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

// Mock modules
vi.mock("@supabase/supabase-js");
vi.mock("@/lib/services/token-manager");

// Test specification for RR-128: Tag extraction from Inoreader categories
// These tests define the EXACT behavior for extracting and syncing tags

describe("RR-128: Tag Extraction During Sync", () => {
  let mockSupabase: any;
  let mockTokenManager: any;

  beforeEach(() => {
    // Setup mock Supabase client
    mockSupabase = {
      from: vi.fn().mockReturnThis(),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
      insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      delete: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
    };

    (createClient as MockedFunction<typeof createClient>).mockReturnValue(
      mockSupabase as any
    );

    // Setup mock token manager
    mockTokenManager = {
      makeAuthenticatedRequest: vi.fn(),
      ensureValidTokens: vi.fn().mockResolvedValue(true),
    };
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("1. Tag Extraction from Categories", () => {
    it("should extract user tags from categories array", () => {
      // Inoreader categories format from actual API
      const categories = [
        "user/-/state/com.google/reading-list",
        "user/-/state/com.google/fresh",
        "user/-/label/Technology",
        "user/-/label/AI News",
        "user/-/label/Product Management",
      ];

      // Extract tags function specification
      const extractTags = (categories: string[]): string[] => {
        return categories
          .filter((cat) => cat.startsWith("user/-/label/"))
          .map((cat) => cat.replace("user/-/label/", ""));
      };

      const tags = extractTags(categories);

      expect(tags).toEqual(["Technology", "AI News", "Product Management"]);
      expect(tags).not.toContain("reading-list");
      expect(tags).not.toContain("fresh");
    });

    it("should ignore system state categories", () => {
      const categories = [
        "user/-/state/com.google/reading-list",
        "user/-/state/com.google/starred",
        "user/-/state/com.google/fresh",
        "user/-/state/com.google/read",
        "user/-/state/com.google/kept-unread",
        "user/-/label/ValidTag",
      ];

      const extractTags = (categories: string[]): string[] => {
        return categories
          .filter(
            (cat) =>
              cat.startsWith("user/-/label/") && !cat.includes("user/-/state/")
          )
          .map((cat) => cat.replace("user/-/label/", ""));
      };

      const tags = extractTags(categories);

      expect(tags).toEqual(["ValidTag"]);
      expect(tags).toHaveLength(1);
    });

    it("should handle articles with no tags", () => {
      const categories = ["user/-/state/com.google/reading-list"];

      const extractTags = (categories: string[]): string[] => {
        return categories
          .filter((cat) => cat.startsWith("user/-/label/"))
          .map((cat) => cat.replace("user/-/label/", ""));
      };

      const tags = extractTags(categories);

      expect(tags).toEqual([]);
      expect(tags).toHaveLength(0);
    });

    it("should handle malformed category strings gracefully", () => {
      const categories = [
        "user/-/label/Valid Tag",
        "malformed-category",
        "user/label/NoSlash",
        "user/-/label/", // Empty label
        null as any,
        undefined as any,
        "user/-/label/Another Valid",
      ];

      const extractTags = (categories: any[]): string[] => {
        return categories
          .filter(
            (cat) =>
              cat &&
              typeof cat === "string" &&
              cat.startsWith("user/-/label/") &&
              cat.length > "user/-/label/".length
          )
          .map((cat) => cat.replace("user/-/label/", ""));
      };

      const tags = extractTags(categories);

      expect(tags).toEqual(["Valid Tag", "Another Valid"]);
      expect(tags).toHaveLength(2);
    });

    it("should preserve tag casing and special characters", () => {
      const categories = [
        "user/-/label/iOS Development",
        "user/-/label/C++",
        "user/-/label/Node.js",
        "user/-/label/Work-In-Progress",
        "user/-/label/Q&A",
      ];

      const extractTags = (categories: string[]): string[] => {
        return categories
          .filter((cat) => cat.startsWith("user/-/label/"))
          .map((cat) => cat.replace("user/-/label/", ""));
      };

      const tags = extractTags(categories);

      expect(tags).toEqual([
        "iOS Development",
        "C++",
        "Node.js",
        "Work-In-Progress",
        "Q&A",
      ]);
    });
  });

  describe("2. Tag Upsert During Sync", () => {
    it("should upsert tags to database during article sync", async () => {
      const mockArticle = {
        id: "article-123",
        categories: ["user/-/label/Tech", "user/-/label/News"],
      };

      // Simulate tag extraction and upsert
      const tags = mockArticle.categories
        .filter((cat) => cat.startsWith("user/-/label/"))
        .map((cat) => cat.replace("user/-/label/", ""));

      // Tags should be upserted (insert or update)
      const tagUpserts = tags.map((name) => ({
        user_id: "shayon",
        name,
        updated_at: new Date().toISOString(),
      }));

      mockSupabase.from.mockReturnThis();
      mockSupabase.upsert.mockResolvedValue({
        data: tagUpserts.map((t, i) => ({ ...t, id: `tag-${i}` })),
        error: null,
      });

      const { data, error } = await mockSupabase
        .from("tags")
        .upsert(tagUpserts, {
          onConflict: "user_id,name",
          returning: "minimal",
        });

      expect(mockSupabase.from).toHaveBeenCalledWith("tags");
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        tagUpserts,
        expect.objectContaining({ onConflict: "user_id,name" })
      );
      expect(error).toBeNull();
    });

    it("should create article_tags associations", async () => {
      const articleId = "article-456";
      const tagIds = ["tag-1", "tag-2", "tag-3"];

      // Create associations
      const associations = tagIds.map((tagId) => ({
        article_id: articleId,
        tag_id: tagId,
        created_at: new Date().toISOString(),
      }));

      mockSupabase.from.mockReturnThis();
      mockSupabase.insert.mockResolvedValue({
        data: associations,
        error: null,
      });

      const { data, error } = await mockSupabase
        .from("article_tags")
        .insert(associations, { onConflict: "article_id,tag_id" });

      expect(mockSupabase.from).toHaveBeenCalledWith("article_tags");
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        associations,
        expect.objectContaining({ onConflict: "article_id,tag_id" })
      );
      expect(error).toBeNull();
    });

    it("should handle bulk tag operations efficiently", async () => {
      // Simulate processing multiple articles
      const articles = [
        { id: "art1", categories: ["user/-/label/Tag1", "user/-/label/Tag2"] },
        { id: "art2", categories: ["user/-/label/Tag2", "user/-/label/Tag3"] },
        { id: "art3", categories: ["user/-/label/Tag1", "user/-/label/Tag3"] },
      ];

      // Extract unique tags
      const allTags = new Set<string>();
      articles.forEach((article) => {
        article.categories
          .filter((cat) => cat.startsWith("user/-/label/"))
          .map((cat) => cat.replace("user/-/label/", ""))
          .forEach((tag) => allTags.add(tag));
      });

      expect(allTags.size).toBe(3);
      expect(Array.from(allTags)).toEqual(["Tag1", "Tag2", "Tag3"]);

      // Bulk upsert tags
      const tagUpserts = Array.from(allTags).map((name) => ({
        user_id: "shayon",
        name,
      }));

      mockSupabase.from.mockReturnThis();
      mockSupabase.upsert.mockResolvedValue({
        data: tagUpserts.map((t, i) => ({ ...t, id: `tag-${i}` })),
        error: null,
      });

      await mockSupabase.from("tags").upsert(tagUpserts);

      expect(mockSupabase.upsert).toHaveBeenCalledTimes(1);
      expect(mockSupabase.upsert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: "Tag1" }),
          expect.objectContaining({ name: "Tag2" }),
          expect.objectContaining({ name: "Tag3" }),
        ])
      );
    });
  });

  describe("3. Tag Sync Reconciliation", () => {
    it("should remove tags no longer present in Inoreader", async () => {
      // Existing tags in database
      const existingTags = [
        { id: "tag-1", name: "OldTag", user_id: "shayon" },
        { id: "tag-2", name: "CurrentTag", user_id: "shayon" },
      ];

      // Tags from Inoreader sync
      const inoreaderTags = ["CurrentTag", "NewTag"];

      // Identify tags to remove
      const tagsToRemove = existingTags
        .filter((tag) => !inoreaderTags.includes(tag.name))
        .map((tag) => tag.id);

      expect(tagsToRemove).toEqual(["tag-1"]);

      // Remove obsolete tags
      mockSupabase.from.mockReturnThis();
      mockSupabase.delete.mockReturnThis();
      mockSupabase.in.mockResolvedValue({ error: null });

      await mockSupabase.from("tags").delete().in("id", tagsToRemove);

      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.in).toHaveBeenCalledWith("id", ["tag-1"]);
    });

    it("should preserve tag-article associations during sync", async () => {
      // When an article is updated, existing associations should be preserved
      // unless explicitly changed in Inoreader

      const articleId = "existing-article";
      const existingAssociations = [
        { article_id: articleId, tag_id: "tag-1" },
        { article_id: articleId, tag_id: "tag-2" },
      ];

      // New categories from Inoreader (tag-2 removed, tag-3 added)
      const newCategories = [
        "user/-/label/Tag1", // maps to tag-1
        "user/-/label/Tag3", // new tag
      ];

      // Delete old associations
      mockSupabase.from.mockReturnThis();
      mockSupabase.delete.mockReturnThis();
      mockSupabase.eq.mockResolvedValue({ error: null });

      await mockSupabase
        .from("article_tags")
        .delete()
        .eq("article_id", articleId);

      // Insert new associations
      const newAssociations = [
        { article_id: articleId, tag_id: "tag-1" },
        { article_id: articleId, tag_id: "tag-3" },
      ];

      mockSupabase.from.mockReturnThis();
      mockSupabase.insert.mockResolvedValue({
        data: newAssociations,
        error: null,
      });

      await mockSupabase.from("article_tags").insert(newAssociations);

      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ tag_id: "tag-1" }),
          expect.objectContaining({ tag_id: "tag-3" }),
        ])
      );
    });
  });

  describe("4. Orphan Tag Cleanup", () => {
    it("should identify orphaned tags after sync", async () => {
      // Query tags with no article associations
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.is.mockResolvedValue({
        data: [
          { id: "orphan-1", name: "UnusedTag1" },
          { id: "orphan-2", name: "UnusedTag2" },
        ],
        error: null,
      });

      const { data: orphans } = await mockSupabase
        .from("tags")
        .select("*, article_tags!left(article_id)")
        .is("article_tags.article_id", null);

      expect(orphans).toHaveLength(2);
      expect(orphans[0]).toHaveProperty("name", "UnusedTag1");
    });

    it("should clean up orphaned tags periodically", async () => {
      // Get orphaned tag IDs
      const orphanIds = ["orphan-1", "orphan-2"];

      // Delete orphaned tags
      mockSupabase.from.mockReturnThis();
      mockSupabase.delete.mockReturnThis();
      mockSupabase.in.mockResolvedValue({
        data: null,
        error: null,
        count: 2,
      });

      const { error, count } = await mockSupabase
        .from("tags")
        .delete()
        .in("id", orphanIds);

      expect(error).toBeNull();
      expect(mockSupabase.delete).toHaveBeenCalled();
      expect(mockSupabase.in).toHaveBeenCalledWith("id", orphanIds);
    });

    it("should not delete tags that gain associations during cleanup", async () => {
      // Simulate race condition where tag gets associated during cleanup

      // Initial orphan check
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnValueOnce({
        data: [{ id: "maybe-orphan", name: "RaceConditionTag" }],
        error: null,
      });

      // Re-check before deletion
      mockSupabase.from.mockReturnThis();
      mockSupabase.select.mockReturnThis();
      mockSupabase.eq.mockReturnValueOnce({
        data: [{ article_id: "new-article" }], // Now has association
        error: null,
        count: 1,
      });

      // Check for associations before delete
      const { count } = await mockSupabase
        .from("article_tags")
        .select("*", { count: "exact", head: true })
        .eq("tag_id", "maybe-orphan");

      if (count === 0) {
        // Would delete, but count > 0 so we don't
        await mockSupabase.from("tags").delete().eq("id", "maybe-orphan");
      }

      // Verify delete was not called since count > 0
      expect(count).toBe(1);
      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });
  });

  describe("5. Error Handling", () => {
    it("should handle database errors gracefully during tag sync", async () => {
      mockSupabase.from.mockReturnThis();
      mockSupabase.upsert.mockResolvedValue({
        data: null,
        error: {
          message: "Database connection failed",
          code: "CONNECTION_ERROR",
        },
      });

      const { error } = await mockSupabase
        .from("tags")
        .upsert({ user_id: "shayon", name: "FailedTag" });

      expect(error).toBeDefined();
      expect(error.code).toBe("CONNECTION_ERROR");
    });

    it("should continue sync even if tag operations fail", async () => {
      const articles = [
        { id: "art1", title: "Article 1", categories: ["user/-/label/Tag1"] },
        { id: "art2", title: "Article 2", categories: ["user/-/label/Tag2"] },
      ];

      let processedArticles = 0;
      let tagErrors = 0;

      for (const article of articles) {
        try {
          // Simulate tag extraction
          const tags = article.categories
            .filter((cat) => cat.startsWith("user/-/label/"))
            .map((cat) => cat.replace("user/-/label/", ""));

          if (tags.includes("Tag1")) {
            // Simulate error for Tag1
            throw new Error("Tag operation failed");
          }

          processedArticles++;
        } catch (error) {
          tagErrors++;
          // Continue processing
          processedArticles++;
        }
      }

      expect(processedArticles).toBe(2);
      expect(tagErrors).toBe(1);
    });
  });
});
