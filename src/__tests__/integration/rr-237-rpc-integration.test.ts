/**
 * RR-237: Integration tests for RPC function implementation
 * Tests the actual RPC function calls against Supabase
 * and validates data integrity across the system
 */

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  beforeAll,
  afterAll,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

// Test configuration
const TEST_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const TEST_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Test service names to avoid conflicts
const TEST_SERVICE_PREFIX = "test_rr237_";

describe("RPC Function Integration", () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let testService: string;
  let testDate: string;

  beforeAll(() => {
    supabase = createClient<Database>(
      TEST_SUPABASE_URL,
      TEST_SUPABASE_ANON_KEY
    );
  });

  beforeEach(() => {
    // Generate unique test identifiers
    testService = `${TEST_SERVICE_PREFIX}${Date.now()}`;
    testDate = new Date().toISOString().split("T")[0];
  });

  afterEach(async () => {
    // Clean up test data
    await supabase
      .from("api_usage")
      .delete()
      .like("service", `${TEST_SERVICE_PREFIX}%`);
  });

  describe("increment_api_usage RPC function", () => {
    it("should create new record when none exists", async () => {
      // Call RPC function
      const { data, error } = await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: testDate,
        p_increment: 1,
      });

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify record was created
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(record).toBeDefined();
      expect(record?.count).toBe(1);
      expect(record?.service).toBe(testService);
      expect(record?.date).toBe(testDate);
    });

    it("should increment existing record", async () => {
      // Create initial record
      await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: testDate,
        p_increment: 5,
      });

      // Increment again
      const { error } = await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: testDate,
        p_increment: 3,
      });

      expect(error).toBeNull();

      // Verify count was incremented
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(record?.count).toBe(8); // 5 + 3
    });

    it("should handle concurrent increments correctly", async () => {
      // Simulate concurrent API calls
      const increments = [1, 2, 3, 4, 5];

      const results = await Promise.all(
        increments.map((increment) =>
          supabase.rpc("increment_api_usage", {
            p_service: testService,
            p_date: testDate,
            p_increment: increment,
          })
        )
      );

      // All calls should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Verify final count is correct
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      const expectedTotal = increments.reduce((a, b) => a + b, 0);
      expect(record?.count).toBe(expectedTotal); // Should be 15 (1+2+3+4+5)
    });

    it("should handle negative increments (decrements)", async () => {
      // Create initial record with count of 10
      await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: testDate,
        p_increment: 10,
      });

      // Decrement by 3
      await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: testDate,
        p_increment: -3,
      });

      // Verify count was decremented
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(record?.count).toBe(7); // 10 - 3
    });
  });

  describe("update_api_usage_zones RPC function", () => {
    it("should update zone usage values", async () => {
      // Call RPC function with zone data
      const { error } = await supabase.rpc("update_api_usage_zones", {
        p_service: testService,
        p_date: testDate,
        p_zone1_usage: 100,
        p_zone2_usage: 50,
        p_zone1_limit: 1000,
        p_zone2_limit: 100,
        p_reset_after: 3600,
      });

      expect(error).toBeNull();

      // Verify zone data was stored
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(record?.zone1_usage).toBe(100);
      expect(record?.zone2_usage).toBe(50);
      expect(record?.zone1_limit).toBe(1000);
      expect(record?.zone2_limit).toBe(100);
      expect(record?.reset_after).toBe(3600);
    });

    it("should create record if it doesn't exist", async () => {
      // Call RPC function on non-existent record
      const { error } = await supabase.rpc("update_api_usage_zones", {
        p_service: testService,
        p_date: testDate,
        p_zone1_usage: 25,
        p_zone2_usage: 10,
      });

      expect(error).toBeNull();

      // Verify record was created with zone data
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(record).toBeDefined();
      expect(record?.zone1_usage).toBe(25);
      expect(record?.zone2_usage).toBe(10);
      expect(record?.count).toBe(0); // Count should be 0 for new record
    });

    it("should handle partial zone updates", async () => {
      // Create initial record with some zone data
      await supabase.rpc("update_api_usage_zones", {
        p_service: testService,
        p_date: testDate,
        p_zone1_usage: 50,
        p_zone1_limit: 1000,
      });

      // Update only zone2 data
      await supabase.rpc("update_api_usage_zones", {
        p_service: testService,
        p_date: testDate,
        p_zone2_usage: 25,
        p_zone2_limit: 100,
      });

      // Verify both zones have correct data
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(record?.zone1_usage).toBe(50); // Should remain unchanged
      expect(record?.zone1_limit).toBe(1000); // Should remain unchanged
      expect(record?.zone2_usage).toBe(25); // Should be updated
      expect(record?.zone2_limit).toBe(100); // Should be updated
    });

    it("should handle concurrent zone updates", async () => {
      // Multiple concurrent updates to different zones
      const updates = [
        { p_zone1_usage: 10 },
        { p_zone2_usage: 5 },
        { p_zone1_limit: 1000 },
        { p_zone2_limit: 100 },
        { p_reset_after: 7200 },
      ];

      const results = await Promise.all(
        updates.map((update) =>
          supabase.rpc("update_api_usage_zones", {
            p_service: testService,
            p_date: testDate,
            ...update,
          })
        )
      );

      // All updates should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Verify final state has all updates
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(record?.zone1_usage).toBe(10);
      expect(record?.zone2_usage).toBe(5);
      expect(record?.zone1_limit).toBe(1000);
      expect(record?.zone2_limit).toBe(100);
      expect(record?.reset_after).toBe(7200);
    });
  });

  describe("Combined RPC operations", () => {
    it("should handle mixed increment and zone updates", async () => {
      // First increment count
      await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: testDate,
        p_increment: 5,
      });

      // Then update zones
      await supabase.rpc("update_api_usage_zones", {
        p_service: testService,
        p_date: testDate,
        p_zone1_usage: 5,
      });

      // Then increment again
      await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: testDate,
        p_increment: 3,
      });

      // Verify all data is correct
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(record?.count).toBe(8); // 5 + 3
      expect(record?.zone1_usage).toBe(5);
    });

    it("should maintain data integrity across different dates", async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toISOString().split("T")[0];

      // Create records for different dates
      await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: yesterdayStr,
        p_increment: 100,
      });

      await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: testDate,
        p_increment: 50,
      });

      // Update zones for today only
      await supabase.rpc("update_api_usage_zones", {
        p_service: testService,
        p_date: testDate,
        p_zone1_usage: 25,
      });

      // Verify yesterday's data is unchanged
      const { data: yesterdayRecord } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", yesterdayStr)
        .single();

      expect(yesterdayRecord?.count).toBe(100);
      expect(yesterdayRecord?.zone1_usage).toBeNull();

      // Verify today's data is correct
      const { data: todayRecord } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(todayRecord?.count).toBe(50);
      expect(todayRecord?.zone1_usage).toBe(25);
    });
  });

  describe("Error scenarios", () => {
    it("should handle invalid service names", async () => {
      const { error } = await supabase.rpc("increment_api_usage", {
        p_service: "", // Empty service name
        p_date: testDate,
        p_increment: 1,
      });

      expect(error).toBeDefined();
      expect(error?.message).toContain("service");
    });

    it("should handle invalid date formats", async () => {
      const { error } = await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: "invalid-date",
        p_increment: 1,
      });

      expect(error).toBeDefined();
    });

    it("should handle zone limit violations", async () => {
      // Attempt to set usage higher than limit (if enforced)
      const { data, error } = await supabase.rpc("update_api_usage_zones", {
        p_service: testService,
        p_date: testDate,
        p_zone1_usage: 2000,
        p_zone1_limit: 1000,
      });

      // This might succeed but should log a warning
      // The test verifies the RPC handles this gracefully
      if (error) {
        expect(error.message).toContain("limit");
      } else {
        // If it succeeds, verify the data was stored
        const { data: record } = await supabase
          .from("api_usage")
          .select("*")
          .eq("service", testService)
          .eq("date", testDate)
          .single();

        expect(record?.zone1_usage).toBe(2000);
        expect(record?.zone1_limit).toBe(1000);
      }
    });
  });

  describe("Performance benchmarks", () => {
    it("should handle 100 increments within 5 seconds", async () => {
      const start = performance.now();
      const increments = Array.from({ length: 100 }, (_, i) => i + 1);

      const results = await Promise.all(
        increments.map((i) =>
          supabase.rpc("increment_api_usage", {
            p_service: `${testService}_perf_${i}`,
            p_date: testDate,
            p_increment: 1,
          })
        )
      );

      const duration = performance.now() - start;

      // All should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Should complete within 5 seconds
      expect(duration).toBeLessThan(5000);

      // Clean up performance test data
      await supabase
        .from("api_usage")
        .delete()
        .like("service", `${testService}_perf_%`);
    });

    it("should handle rapid zone updates efficiently", async () => {
      const start = performance.now();
      const updates = Array.from({ length: 50 }, (_, i) => ({
        zone1_usage: i * 2,
        zone2_usage: i,
      }));

      for (const update of updates) {
        await supabase.rpc("update_api_usage_zones", {
          p_service: testService,
          p_date: testDate,
          p_zone1_usage: update.zone1_usage,
          p_zone2_usage: update.zone2_usage,
        });
      }

      const duration = performance.now() - start;

      // Should complete within 3 seconds
      expect(duration).toBeLessThan(3000);

      // Verify final values
      const { data: record } = await supabase
        .from("api_usage")
        .select("*")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(record?.zone1_usage).toBe(98); // (50-1) * 2
      expect(record?.zone2_usage).toBe(49); // 50-1
    });
  });
});
