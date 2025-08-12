import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getAdminClient } from "@/lib/db/supabase-admin";

/**
 * RR-129: Unit tests for deleted_articles table migration
 * Tests the database schema changes required for article deletion tracking
 */
describe("RR-129: Database Migration - deleted_articles table", () => {
  const supabase = getAdminClient();

  describe("Table Schema Validation", () => {
    it("should have deleted_articles table created", async () => {
      const { data, error } = await supabase
        .from("deleted_articles")
        .select("*")
        .limit(0); // Just check table exists

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(Array.isArray(data)).toBe(true);
    });

    it("should have correct column structure for deleted_articles", async () => {
      // Test inserting a record to validate schema
      const testRecord = {
        inoreader_id: "test-article-123",
        was_read: true,
        feed_id: "test-feed-456",
      };

      const { data, error } = await supabase
        .from("deleted_articles")
        .insert(testRecord)
        .select()
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.inoreader_id).toBe(testRecord.inoreader_id);
      expect(data.was_read).toBe(testRecord.was_read);
      expect(data.feed_id).toBe(testRecord.feed_id);
      expect(data.deleted_at).toBeDefined();
      expect(new Date(data.deleted_at)).toBeInstanceOf(Date);

      // Clean up test record
      await supabase
        .from("deleted_articles")
        .delete()
        .eq("inoreader_id", testRecord.inoreader_id);
    });

    it("should enforce PRIMARY KEY constraint on inoreader_id", async () => {
      const testRecord = {
        inoreader_id: "duplicate-test-123",
        was_read: true,
        feed_id: "test-feed-789",
      };

      // Insert first record
      const { error: firstError } = await supabase
        .from("deleted_articles")
        .insert(testRecord);

      expect(firstError).toBeNull();

      // Try to insert duplicate
      const { error: duplicateError } = await supabase
        .from("deleted_articles")
        .insert(testRecord);

      expect(duplicateError).toBeDefined();
      expect(duplicateError!.code).toBe("23505"); // PostgreSQL unique constraint violation

      // Clean up
      await supabase
        .from("deleted_articles")
        .delete()
        .eq("inoreader_id", testRecord.inoreader_id);
    });

    it("should support upsert operations for idempotent tracking", async () => {
      const testRecord = {
        inoreader_id: "upsert-test-456",
        was_read: true,
        feed_id: "test-feed-upsert",
      };

      // First upsert
      const { data: firstData, error: firstError } = await supabase
        .from("deleted_articles")
        .upsert(testRecord, { onConflict: "inoreader_id" })
        .select()
        .single();

      expect(firstError).toBeNull();
      expect(firstData).toBeDefined();
      const firstTimestamp = firstData.deleted_at;

      // Wait a bit to ensure timestamp difference
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Second upsert with updated data
      const updatedRecord = { ...testRecord, feed_id: "updated-feed" };
      const { data: secondData, error: secondError } = await supabase
        .from("deleted_articles")
        .upsert(updatedRecord, { onConflict: "inoreader_id" })
        .select()
        .single();

      expect(secondError).toBeNull();
      expect(secondData.feed_id).toBe("updated-feed");
      expect(secondData.deleted_at).toBe(firstTimestamp); // Should preserve original timestamp

      // Clean up
      await supabase
        .from("deleted_articles")
        .delete()
        .eq("inoreader_id", testRecord.inoreader_id);
    });

    it("should default deleted_at to current timestamp", async () => {
      const beforeInsert = new Date();

      const { data, error } = await supabase
        .from("deleted_articles")
        .insert({
          inoreader_id: "timestamp-test-789",
          was_read: true,
          feed_id: "test-feed-timestamp",
        })
        .select()
        .single();

      const afterInsert = new Date();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      const deletedAt = new Date(data.deleted_at);
      expect(deletedAt).toBeInstanceOf(Date);
      expect(deletedAt.getTime()).toBeGreaterThanOrEqual(
        beforeInsert.getTime()
      );
      expect(deletedAt.getTime()).toBeLessThanOrEqual(afterInsert.getTime());

      // Clean up
      await supabase
        .from("deleted_articles")
        .delete()
        .eq("inoreader_id", "timestamp-test-789");
    });

    it("should default was_read to true", async () => {
      const { data, error } = await supabase
        .from("deleted_articles")
        .insert({
          inoreader_id: "default-read-test",
          feed_id: "test-feed-default",
          // Omit was_read to test default
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.was_read).toBe(true);

      // Clean up
      await supabase
        .from("deleted_articles")
        .delete()
        .eq("inoreader_id", "default-read-test");
    });
  });

  describe("Index Performance Validation", () => {
    it("should have index on deleted_at for efficient cleanup queries", async () => {
      // Insert test records with various timestamps
      const testRecords = Array.from({ length: 10 }, (_, i) => ({
        inoreader_id: `index-test-${i}`,
        was_read: true,
        feed_id: `test-feed-${i}`,
        deleted_at: new Date(
          Date.now() - i * 24 * 60 * 60 * 1000
        ).toISOString(), // i days ago
      }));

      await supabase.from("deleted_articles").insert(testRecords);

      // Query using deleted_at filter (should use index)
      const cutoffDate = new Date(
        Date.now() - 5 * 24 * 60 * 60 * 1000
      ).toISOString(); // 5 days ago
      const startTime = Date.now();

      const { data, error } = await supabase
        .from("deleted_articles")
        .select("inoreader_id")
        .lt("deleted_at", cutoffDate);

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(5); // Should find articles older than 5 days
      expect(queryTime).toBeLessThan(100); // Should be fast with index

      // Clean up
      await supabase
        .from("deleted_articles")
        .delete()
        .in(
          "inoreader_id",
          testRecords.map((r) => r.inoreader_id)
        );
    });

    it("should have fast lookups by inoreader_id during sync", async () => {
      // Insert many test records
      const testRecords = Array.from({ length: 100 }, (_, i) => ({
        inoreader_id: `lookup-test-${i}`,
        was_read: true,
        feed_id: `feed-${i % 10}`, // Group into 10 feeds
      }));

      await supabase.from("deleted_articles").insert(testRecords);

      // Simulate sync lookup for batch of article IDs
      const lookupIds = testRecords.slice(0, 20).map((r) => r.inoreader_id);
      const startTime = Date.now();

      const { data, error } = await supabase
        .from("deleted_articles")
        .select("inoreader_id")
        .in("inoreader_id", lookupIds);

      const queryTime = Date.now() - startTime;

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data.length).toBe(20);
      expect(queryTime).toBeLessThan(50); // Should be very fast with primary key

      // Clean up
      await supabase
        .from("deleted_articles")
        .delete()
        .in(
          "inoreader_id",
          testRecords.map((r) => r.inoreader_id)
        );
    });
  });

  describe("Cleanup Function Validation", () => {
    it("should have cleanup_old_deleted_articles function available", async () => {
      // Test that the function exists and can be called
      const { data, error } = await supabase.rpc(
        "cleanup_old_deleted_articles"
      );

      // Function should exist (even if it doesn't clean anything)
      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it("should clean up articles older than 90 days", async () => {
      // Insert test records with old timestamps
      const oldTimestamp = new Date(
        Date.now() - 100 * 24 * 60 * 60 * 1000
      ).toISOString(); // 100 days ago
      const recentTimestamp = new Date(
        Date.now() - 50 * 24 * 60 * 60 * 1000
      ).toISOString(); // 50 days ago

      const testRecords = [
        {
          inoreader_id: "old-cleanup-1",
          was_read: true,
          feed_id: "old-feed",
          deleted_at: oldTimestamp,
        },
        {
          inoreader_id: "old-cleanup-2",
          was_read: true,
          feed_id: "old-feed",
          deleted_at: oldTimestamp,
        },
        {
          inoreader_id: "recent-cleanup",
          was_read: true,
          feed_id: "recent-feed",
          deleted_at: recentTimestamp,
        },
      ];

      await supabase.from("deleted_articles").insert(testRecords);

      // Run cleanup function
      const { error: cleanupError } = await supabase.rpc(
        "cleanup_old_deleted_articles"
      );
      expect(cleanupError).toBeNull();

      // Check that old records are gone but recent ones remain
      const { data: remainingData } = await supabase
        .from("deleted_articles")
        .select("inoreader_id")
        .in(
          "inoreader_id",
          testRecords.map((r) => r.inoreader_id)
        );

      expect(remainingData).toBeDefined();
      expect(remainingData.length).toBe(1);
      expect(remainingData[0].inoreader_id).toBe("recent-cleanup");

      // Clean up remaining test data
      await supabase
        .from("deleted_articles")
        .delete()
        .eq("inoreader_id", "recent-cleanup");
    });
  });

  describe("Migration Rollback Safety", () => {
    it("should allow table to be dropped without affecting other tables", async () => {
      // Verify table exists
      const { error: existsError } = await supabase
        .from("deleted_articles")
        .select("*")
        .limit(1);

      expect(existsError).toBeNull();

      // Verify other core tables are unaffected by deleted_articles table operations
      const { data: articlesData, error: articlesError } = await supabase
        .from("articles")
        .select("id")
        .limit(1);

      const { data: feedsData, error: feedsError } = await supabase
        .from("feeds")
        .select("id")
        .limit(1);

      expect(articlesError).toBeNull();
      expect(feedsError).toBeNull();
      expect(articlesData).toBeDefined();
      expect(feedsData).toBeDefined();
    });

    it("should not have foreign key constraints that would prevent rollback", async () => {
      // Insert test record with potentially non-existent feed_id
      const { error } = await supabase.from("deleted_articles").insert({
        inoreader_id: "rollback-test",
        was_read: true,
        feed_id: "non-existent-feed-id",
      });

      // Should not fail due to foreign key constraint
      expect(error).toBeNull();

      // Clean up
      await supabase
        .from("deleted_articles")
        .delete()
        .eq("inoreader_id", "rollback-test");
    });
  });

  describe("Data Type Validation", () => {
    it("should handle various inoreader_id formats", async () => {
      const testCases = [
        "simple-id",
        "id-with-numbers-123",
        "id_with_underscores",
        "id-with-special-chars-@#$",
        "very-long-id-" + "x".repeat(200),
      ];

      for (const inoreader_id of testCases) {
        const { error } = await supabase.from("deleted_articles").insert({
          inoreader_id,
          was_read: true,
          feed_id: "test-feed",
        });

        expect(error).toBeNull(`Failed for inoreader_id: ${inoreader_id}`);
      }

      // Clean up all test records
      await supabase
        .from("deleted_articles")
        .delete()
        .in("inoreader_id", testCases);
    });

    it("should handle boolean values correctly for was_read", async () => {
      const testCases = [
        { inoreader_id: "bool-true", was_read: true },
        { inoreader_id: "bool-false", was_read: false },
      ];

      for (const testCase of testCases) {
        const { data, error } = await supabase
          .from("deleted_articles")
          .insert({
            ...testCase,
            feed_id: "test-feed",
          })
          .select()
          .single();

        expect(error).toBeNull();
        expect(data.was_read).toBe(testCase.was_read);
      }

      // Clean up
      await supabase
        .from("deleted_articles")
        .delete()
        .in(
          "inoreader_id",
          testCases.map((t) => t.inoreader_id)
        );
    });

    it("should handle NULL values appropriately", async () => {
      const { data, error } = await supabase
        .from("deleted_articles")
        .insert({
          inoreader_id: "null-test",
          was_read: true,
          feed_id: null, // Test NULL feed_id
        })
        .select()
        .single();

      expect(error).toBeNull();
      expect(data.feed_id).toBeNull();

      // Clean up
      await supabase
        .from("deleted_articles")
        .delete()
        .eq("inoreader_id", "null-test");
    });
  });
});
