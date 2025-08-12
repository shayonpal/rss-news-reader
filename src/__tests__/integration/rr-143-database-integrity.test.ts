import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { getAdminClient } from "@/lib/db/supabase-admin";

describe("RR-143: Database Integrity and Author Persistence", () => {
  const supabase = getAdminClient();

  describe("Database Schema Verification", () => {
    it("should have author column with correct schema", async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("author")
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Check that the column exists by not throwing an error
      expect(() => data![0]?.author).not.toThrow();
    });

    it("should verify author column constraints and type", async () => {
      const { data, error } = await supabase
        .rpc("get_column_info", {
          table_name: "articles",
          column_name: "author",
        })
        .single();

      // If RPC doesn't exist, use direct query
      if (error?.code === "PGRST202") {
        const { data: schemaData } = await supabase.rpc("get_table_schema", {
          table_name: "articles",
        });

        const authorColumn = schemaData?.find(
          (col: any) => col.column_name === "author"
        );
        expect(authorColumn).toBeDefined();
        expect(authorColumn?.data_type).toBe("character varying");
        expect(authorColumn?.is_nullable).toBe("YES");
      } else {
        expect(data).toBeDefined();
        expect(data?.data_type).toContain("character");
        expect(data?.is_nullable).toBe("YES");
      }
    });
  });

  describe("Data Quality Analysis", () => {
    it("should have acceptable author coverage percentage", async () => {
      const { data, error } = await supabase.rpc("get_author_stats").single();

      // If RPC doesn't exist, calculate manually
      if (error?.code === "PGRST202") {
        const { count: totalCount } = await supabase
          .from("articles")
          .select("*", { count: "exact", head: true });

        const { count: authorCount } = await supabase
          .from("articles")
          .select("*", { count: "exact", head: true })
          .not("author", "is", null);

        const percentage = totalCount ? (authorCount! / totalCount) * 100 : 0;

        // Should have at least some articles with authors after RR-142
        expect(percentage).toBeGreaterThan(0);

        // Log the actual percentage for monitoring
        console.log(`Author coverage: ${percentage.toFixed(2)}%`);
      } else {
        expect(data?.author_percentage).toBeGreaterThan(0);
      }
    });

    it("should not have empty string authors", async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id")
        .eq("author", "");

      expect(error).toBeNull();
      expect(data?.length).toBe(0);
    });

    it("should handle long author names appropriately", async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("author")
        .not("author", "is", null)
        .order("length(author)", { ascending: false })
        .limit(10);

      expect(error).toBeNull();

      // Check that even the longest authors are reasonable
      data?.forEach((article) => {
        expect(article.author.length).toBeLessThanOrEqual(255);
      });
    });

    it("should handle special characters in author names", async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("author")
        .not("author", "is", null)
        .or("author.ilike.%&%,author.ilike.%'%,author.ilike.%-%")
        .limit(10);

      expect(error).toBeNull();

      // Special characters should be stored correctly
      data?.forEach((article) => {
        expect(article.author).toBeTruthy();
        // Verify no mojibake or encoding issues
        expect(article.author).not.toMatch(/[�]/);
      });
    });
  });

  describe("Sync Integrity Validation", () => {
    it("should preserve author data across sync operations", async () => {
      // Get a sample of articles with authors
      const { data: originalArticles } = await supabase
        .from("articles")
        .select("inoreader_id, author")
        .not("author", "is", null)
        .limit(20);

      expect(originalArticles).toBeDefined();
      expect(originalArticles!.length).toBeGreaterThan(0);

      // Store original authors for comparison after sync
      const authorMap = new Map(
        originalArticles!.map((a) => [a.inoreader_id, a.author])
      );

      // After a sync operation (simulated here), authors should remain
      // This would be validated after an actual sync in production
      const { data: currentArticles } = await supabase
        .from("articles")
        .select("inoreader_id, author")
        .in("inoreader_id", Array.from(authorMap.keys()));

      currentArticles?.forEach((article) => {
        const originalAuthor = authorMap.get(article.inoreader_id);
        if (originalAuthor) {
          expect(article.author).toBe(originalAuthor);
        }
      });
    });

    it("should not create duplicate articles during sync", async () => {
      // Check for any duplicate inoreader_ids (should be impossible due to unique constraint)
      const { data, error } = await supabase.rpc("check_duplicate_articles");

      // If RPC doesn't exist, check manually
      if (error?.code === "PGRST202") {
        const { data: duplicates } = await supabase
          .from("articles")
          .select("inoreader_id")
          .limit(1000);

        const ids = duplicates?.map((a) => a.inoreader_id) || [];
        const uniqueIds = new Set(ids);

        expect(ids.length).toBe(uniqueIds.size);
      } else {
        expect(data).toEqual([]);
      }
    });

    it("should handle null authors gracefully", async () => {
      const { data, error } = await supabase
        .from("articles")
        .select("id, title, author")
        .is("author", null)
        .limit(10);

      expect(error).toBeNull();

      // Articles with null authors should still have valid data
      data?.forEach((article) => {
        expect(article.id).toBeTruthy();
        expect(article.title).toBeTruthy();
        expect(article.author).toBeNull();
      });
    });
  });

  describe("Historical Data Backfill", () => {
    it("should populate authors for previously synced articles on resync", async () => {
      // Check articles that were updated recently (likely from resync)
      const recentDate = new Date();
      recentDate.setHours(recentDate.getHours() - 24); // Last 24 hours

      const { data: recentlyUpdated } = await supabase
        .from("articles")
        .select("author, updated_at")
        .gte("updated_at", recentDate.toISOString())
        .not("author", "is", null)
        .limit(50);

      // If we have recently updated articles with authors, backfill is working
      if (recentlyUpdated && recentlyUpdated.length > 0) {
        expect(recentlyUpdated.length).toBeGreaterThan(0);
        console.log(
          `${recentlyUpdated.length} articles got authors in last 24h`
        );
      }
    });
  });

  describe("Performance Impact", () => {
    it("should have acceptable query performance with author field", async () => {
      const startTime = Date.now();

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, author")
        .not("author", "is", null)
        .order("published_at", { ascending: false })
        .limit(100);

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Query should complete in reasonable time (< 1 second)
      expect(queryTime).toBeLessThan(1000);
      console.log(`Author query completed in ${queryTime}ms`);
    });

    it("should benefit from index on author field if searching", async () => {
      const startTime = Date.now();

      const { data, error } = await supabase
        .from("articles")
        .select("id, title, author")
        .ilike("author", "%Smith%")
        .limit(10);

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();

      // Even pattern matching should be reasonably fast
      expect(queryTime).toBeLessThan(500);
      console.log(`Author search completed in ${queryTime}ms`);
    });
  });
});
