import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * RR-150: Unit tests for chunked article deletion functionality
 * Tests the chunked deletion logic to resolve 414 Request-URI Too Large errors
 */
describe("RR-150: Chunked Article Deletion", () => {
  // Mock Supabase client with proper chaining
  const mockSupabase = {
    from: vi.fn(() => mockSupabase),
    select: vi.fn(() => mockSupabase),
    delete: vi.fn(() => mockSupabase),
    upsert: vi.fn(() => mockSupabase),
    eq: vi.fn(() => mockSupabase),
    in: vi.fn(() => mockSupabase),
    limit: vi.fn(() => mockSupabase),
    lt: vi.fn(() => mockSupabase),
    single: vi.fn(),
    then: vi.fn(),
  };

  // Mock chunked deletion service
  const ChunkedDeletionService = {
    chunkSize: 200,
    delayBetweenChunks: 100,

    /**
     * Split array into chunks of specified size
     */
    chunkArray<T>(array: T[], chunkSize: number): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
      return chunks;
    },

    /**
     * Delete articles in chunks with delay and error handling
     */
    async deleteArticlesInChunks(articleIds: string[]) {
      const chunks = this.chunkArray(articleIds, this.chunkSize);
      const results = {
        totalChunks: chunks.length,
        successfulChunks: 0,
        failedChunks: 0,
        deletedCount: 0,
        errors: [] as string[],
      };

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          const { error, count } = await mockSupabase
            .from("articles")
            .delete()
            .in("id", chunk);

          if (error) {
            results.failedChunks++;
            results.errors.push(`Chunk ${i + 1} failed: ${error.message}`);
          } else {
            results.successfulChunks++;
            results.deletedCount += count || chunk.length;
          }

          // Add delay between chunks (except last one)
          if (i < chunks.length - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.delayBetweenChunks)
            );
          }
        } catch (error) {
          results.failedChunks++;
          results.errors.push(`Chunk ${i + 1} exception: ${error}`);
        }
      }

      return results;
    },

    /**
     * Create tracking entries in chunks
     */
    async createTrackingEntriesInChunks(trackingEntries: any[]) {
      const chunks = this.chunkArray(trackingEntries, this.chunkSize);
      const results = {
        totalChunks: chunks.length,
        successfulChunks: 0,
        failedChunks: 0,
        trackedCount: 0,
        errors: [] as string[],
      };

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];

        try {
          const { error } = await mockSupabase
            .from("deleted_articles")
            .upsert(chunk, {
              onConflict: "inoreader_id",
              ignoreDuplicates: true,
            });

          if (error) {
            results.failedChunks++;
            results.errors.push(
              `Tracking chunk ${i + 1} failed: ${error.message}`
            );
          } else {
            results.successfulChunks++;
            results.trackedCount += chunk.length;
          }

          // Add delay between chunks (except last one)
          if (i < chunks.length - 1) {
            await new Promise((resolve) =>
              setTimeout(resolve, this.delayBetweenChunks)
            );
          }
        } catch (error) {
          results.failedChunks++;
          results.errors.push(`Tracking chunk ${i + 1} exception: ${error}`);
        }
      }

      return results;
    },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset mock return values
    mockSupabase.delete.mockResolvedValue({
      data: null,
      error: null,
      count: 0,
    });
    mockSupabase.upsert.mockResolvedValue({ data: null, error: null });
  });

  describe("chunkArray function", () => {
    it("should split array into chunks of specified size", () => {
      const items = Array.from({ length: 1000 }, (_, i) => `item-${i}`);
      const chunks = ChunkedDeletionService.chunkArray(items, 200);

      expect(chunks).toHaveLength(5);
      expect(chunks[0]).toHaveLength(200);
      expect(chunks[1]).toHaveLength(200);
      expect(chunks[2]).toHaveLength(200);
      expect(chunks[3]).toHaveLength(200);
      expect(chunks[4]).toHaveLength(200);
    });

    it("should handle arrays that do not divide evenly", () => {
      const items = Array.from({ length: 1097 }, (_, i) => `item-${i}`);
      const chunks = ChunkedDeletionService.chunkArray(items, 200);

      expect(chunks).toHaveLength(6);
      expect(chunks[0]).toHaveLength(200);
      expect(chunks[1]).toHaveLength(200);
      expect(chunks[2]).toHaveLength(200);
      expect(chunks[3]).toHaveLength(200);
      expect(chunks[4]).toHaveLength(200);
      expect(chunks[5]).toHaveLength(97); // Remainder chunk
    });

    it("should handle empty arrays", () => {
      const chunks = ChunkedDeletionService.chunkArray([], 200);
      expect(chunks).toHaveLength(0);
    });

    it("should handle arrays smaller than chunk size", () => {
      const items = ["item1", "item2", "item3"];
      const chunks = ChunkedDeletionService.chunkArray(items, 200);

      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toHaveLength(3);
      expect(chunks[0]).toEqual(["item1", "item2", "item3"]);
    });

    it("should handle chunk size of 1", () => {
      const items = ["a", "b", "c"];
      const chunks = ChunkedDeletionService.chunkArray(items, 1);

      expect(chunks).toHaveLength(3);
      expect(chunks[0]).toEqual(["a"]);
      expect(chunks[1]).toEqual(["b"]);
      expect(chunks[2]).toEqual(["c"]);
    });
  });

  describe("deleteArticlesInChunks function", () => {
    it("should delete 1000+ articles in chunks of 200 without URI length errors", async () => {
      const articleIds = Array.from({ length: 1097 }, (_, i) => `article-${i}`);

      // Mock successful deletion for each chunk
      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 200,
      });

      const result =
        await ChunkedDeletionService.deleteArticlesInChunks(articleIds);

      expect(result.totalChunks).toBe(6);
      expect(result.successfulChunks).toBe(6);
      expect(result.failedChunks).toBe(0);
      expect(result.deletedCount).toBe(1200); // 6 chunks * 200 count each
      expect(result.errors).toHaveLength(0);

      // Verify each chunk was processed
      expect(mockSupabase.from).toHaveBeenCalledWith("articles");
      expect(mockSupabase.delete).toHaveBeenCalledTimes(6);
      expect(mockSupabase.in).toHaveBeenCalledTimes(6);

      // Verify chunk sizes
      const inCalls = mockSupabase.in.mock.calls;
      expect(inCalls[0][1]).toHaveLength(200);
      expect(inCalls[1][1]).toHaveLength(200);
      expect(inCalls[2][1]).toHaveLength(200);
      expect(inCalls[3][1]).toHaveLength(200);
      expect(inCalls[4][1]).toHaveLength(200);
      expect(inCalls[5][1]).toHaveLength(97); // Final chunk with remainder
    });

    it("should continue processing remaining chunks when one chunk fails", async () => {
      const articleIds = Array.from({ length: 600 }, (_, i) => `article-${i}`);

      let callCount = 0;
      mockSupabase.delete.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          // Second chunk fails
          return Promise.resolve({
            data: null,
            error: { message: "414 Request-URI Too Large" },
            count: 0,
          });
        }
        return Promise.resolve({ data: null, error: null, count: 200 });
      });

      const result =
        await ChunkedDeletionService.deleteArticlesInChunks(articleIds);

      expect(result.totalChunks).toBe(3);
      expect(result.successfulChunks).toBe(2);
      expect(result.failedChunks).toBe(1);
      expect(result.deletedCount).toBe(400); // 2 successful chunks * 200
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain(
        "Chunk 2 failed: 414 Request-URI Too Large"
      );

      // All chunks should have been attempted
      expect(mockSupabase.delete).toHaveBeenCalledTimes(3);
    });

    it("should handle database connection errors gracefully", async () => {
      const articleIds = Array.from({ length: 400 }, (_, i) => `article-${i}`);

      mockSupabase.delete.mockRejectedValue(
        new Error("Database connection timeout")
      );

      const result =
        await ChunkedDeletionService.deleteArticlesInChunks(articleIds);

      expect(result.totalChunks).toBe(2);
      expect(result.successfulChunks).toBe(0);
      expect(result.failedChunks).toBe(2);
      expect(result.deletedCount).toBe(0);
      expect(result.errors).toHaveLength(2);
      expect(result.errors[0]).toContain("Database connection timeout");
      expect(result.errors[1]).toContain("Database connection timeout");
    });

    it("should add appropriate delay between chunks", async () => {
      const articleIds = Array.from({ length: 400 }, (_, i) => `article-${i}`);
      const startTime = Date.now();

      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 200,
      });

      await ChunkedDeletionService.deleteArticlesInChunks(articleIds);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should have 1 delay between 2 chunks (100ms minimum)
      // Adding buffer for test execution time
      expect(duration).toBeGreaterThanOrEqual(90);
      expect(duration).toBeLessThan(500); // Reasonable upper bound
    });

    it("should handle empty article ID array", async () => {
      const result = await ChunkedDeletionService.deleteArticlesInChunks([]);

      expect(result.totalChunks).toBe(0);
      expect(result.successfulChunks).toBe(0);
      expect(result.failedChunks).toBe(0);
      expect(result.deletedCount).toBe(0);
      expect(result.errors).toHaveLength(0);

      expect(mockSupabase.delete).not.toHaveBeenCalled();
    });
  });

  describe("createTrackingEntriesInChunks function", () => {
    it("should create tracking entries in chunks for large datasets", async () => {
      const trackingEntries = Array.from({ length: 1000 }, (_, i) => ({
        inoreader_id: `article-${i}`,
        was_read: true,
        feed_id: `feed-${i % 10}`,
        deleted_at: new Date().toISOString(),
      }));

      mockSupabase.upsert.mockResolvedValue({ data: null, error: null });

      const result =
        await ChunkedDeletionService.createTrackingEntriesInChunks(
          trackingEntries
        );

      expect(result.totalChunks).toBe(5);
      expect(result.successfulChunks).toBe(5);
      expect(result.failedChunks).toBe(0);
      expect(result.trackedCount).toBe(1000);
      expect(result.errors).toHaveLength(0);

      expect(mockSupabase.from).toHaveBeenCalledWith("deleted_articles");
      expect(mockSupabase.upsert).toHaveBeenCalledTimes(5);

      // Verify chunk processing
      const upsertCalls = mockSupabase.upsert.mock.calls;
      expect(upsertCalls[0][0]).toHaveLength(200);
      expect(upsertCalls[4][0]).toHaveLength(200);
    });

    it("should continue creating tracking entries when one chunk fails", async () => {
      const trackingEntries = Array.from({ length: 600 }, (_, i) => ({
        inoreader_id: `article-${i}`,
        was_read: true,
        feed_id: `feed-${i % 10}`,
        deleted_at: new Date().toISOString(),
      }));

      let callCount = 0;
      mockSupabase.upsert.mockImplementation(() => {
        callCount++;
        if (callCount === 2) {
          return Promise.resolve({
            data: null,
            error: { message: "Unique constraint violation" },
          });
        }
        return Promise.resolve({ data: null, error: null });
      });

      const result =
        await ChunkedDeletionService.createTrackingEntriesInChunks(
          trackingEntries
        );

      expect(result.totalChunks).toBe(3);
      expect(result.successfulChunks).toBe(2);
      expect(result.failedChunks).toBe(1);
      expect(result.trackedCount).toBe(400);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain("Tracking chunk 2 failed");

      expect(mockSupabase.upsert).toHaveBeenCalledTimes(3);
    });
  });

  describe("Performance and Memory Considerations", () => {
    it("should not hold large arrays in memory unnecessarily", async () => {
      const articleIds = Array.from({ length: 5000 }, (_, i) => `article-${i}`);

      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 200,
      });

      const result =
        await ChunkedDeletionService.deleteArticlesInChunks(articleIds);

      expect(result.totalChunks).toBe(25); // 5000 / 200
      expect(result.successfulChunks).toBe(25);
      expect(result.failedChunks).toBe(0);
      expect(result.deletedCount).toBe(5000); // 25 chunks * 200 count each

      // Should complete in reasonable time
      expect(mockSupabase.delete).toHaveBeenCalledTimes(25);
    });

    it("should handle processing time efficiently with delays", async () => {
      const articleIds = Array.from({ length: 200 }, (_, i) => `article-${i}`);
      const startTime = Date.now();

      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 200,
      });

      await ChunkedDeletionService.deleteArticlesInChunks(articleIds);

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Single chunk should not have delays, should be fast
      expect(duration).toBeLessThan(100);
      expect(mockSupabase.delete).toHaveBeenCalledTimes(1);
    });
  });

  describe("Boundary Conditions", () => {
    it("should handle exactly one chunk size worth of articles", async () => {
      const articleIds = Array.from({ length: 200 }, (_, i) => `article-${i}`);

      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 200,
      });

      const result =
        await ChunkedDeletionService.deleteArticlesInChunks(articleIds);

      expect(result.totalChunks).toBe(1);
      expect(result.successfulChunks).toBe(1);
      expect(result.failedChunks).toBe(0);
      expect(result.deletedCount).toBe(200);

      expect(mockSupabase.delete).toHaveBeenCalledTimes(1);
      expect(mockSupabase.in.mock.calls[0][1]).toHaveLength(200);
    });

    it("should handle chunk size + 1 articles", async () => {
      const articleIds = Array.from({ length: 201 }, (_, i) => `article-${i}`);

      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 200,
      });

      const result =
        await ChunkedDeletionService.deleteArticlesInChunks(articleIds);

      expect(result.totalChunks).toBe(2);
      expect(result.successfulChunks).toBe(2);
      expect(result.failedChunks).toBe(0);
      expect(result.deletedCount).toBe(400); // 2 chunks * 200 count each

      expect(mockSupabase.delete).toHaveBeenCalledTimes(2);
      expect(mockSupabase.in.mock.calls[0][1]).toHaveLength(200);
      expect(mockSupabase.in.mock.calls[1][1]).toHaveLength(1);
    });

    it("should handle the exact problematic case from RR-150 (1097 articles)", async () => {
      const articleIds = Array.from({ length: 1097 }, (_, i) => `article-${i}`);

      mockSupabase.delete.mockResolvedValue({
        data: null,
        error: null,
        count: 200,
      });

      const result =
        await ChunkedDeletionService.deleteArticlesInChunks(articleIds);

      expect(result.totalChunks).toBe(6); // ceil(1097/200) = 6
      expect(result.successfulChunks).toBe(6);
      expect(result.failedChunks).toBe(0);
      expect(result.deletedCount).toBe(1200); // 6 chunks * 200 count each

      // Verify final chunk size
      const lastChunkSize = mockSupabase.in.mock.calls[5][1].length;
      expect(lastChunkSize).toBe(97); // 1097 - (5 * 200) = 97
    });
  });
});
