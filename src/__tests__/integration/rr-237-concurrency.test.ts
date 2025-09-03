/**
 * RR-237: Concurrency and race condition tests
 * Tests atomic operations and ensures data integrity
 * under high concurrency scenarios
 */

import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  afterEach,
} from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

const TEST_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const TEST_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describe("RPC Function Concurrency Tests", () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  const testPrefix = `test_rr237_concurrent_`;
  let testService: string;
  let testDate: string;

  beforeAll(() => {
    supabase = createClient<Database>(
      TEST_SUPABASE_URL,
      TEST_SUPABASE_ANON_KEY
    );
  });

  beforeEach(() => {
    testService = `${testPrefix}${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    testDate = new Date().toISOString().split("T")[0];
  });

  afterEach(async () => {
    // Clean up test data
    await supabase.from("api_usage").delete().like("service", `${testPrefix}%`);
  });

  describe("Atomic increment operations", () => {
    it("should handle 100 concurrent increments atomically", async () => {
      const numOperations = 100;
      const incrementValue = 1;

      // Create 100 concurrent increment operations
      const operations = Array.from({ length: numOperations }, () =>
        supabase.rpc("increment_api_usage", {
          p_service: testService,
          p_date: testDate,
          p_increment: incrementValue,
        })
      );

      // Execute all operations concurrently
      const results = await Promise.all(operations);

      // All operations should succeed
      results.forEach((result, index) => {
        expect(result.error).toBeNull();
      });

      // Verify final count is exactly the sum of all increments
      const { data: finalRecord } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(finalRecord?.count).toBe(numOperations * incrementValue);
    });

    it("should handle mixed increment and decrement operations", async () => {
      // Initialize with a base count
      await supabase.rpc("increment_api_usage", {
        p_service: testService,
        p_date: testDate,
        p_increment: 1000,
      });

      // Create mixed operations
      const increments = Array.from({ length: 50 }, () =>
        supabase.rpc("increment_api_usage", {
          p_service: testService,
          p_date: testDate,
          p_increment: 5,
        })
      );

      const decrements = Array.from({ length: 30 }, () =>
        supabase.rpc("increment_api_usage", {
          p_service: testService,
          p_date: testDate,
          p_increment: -3,
        })
      );

      // Execute all operations concurrently
      const results = await Promise.all([...increments, ...decrements]);

      // All should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Verify final count
      const { data: finalRecord } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      const expectedCount = 1000 + 50 * 5 - 30 * 3; // 1000 + 250 - 90 = 1160
      expect(finalRecord?.count).toBe(expectedCount);
    });

    it("should handle rapid sequential updates correctly", async () => {
      const updates = 50;

      // Rapid sequential updates without waiting
      const promises = [];
      for (let i = 0; i < updates; i++) {
        promises.push(
          supabase.rpc("increment_api_usage", {
            p_service: testService,
            p_date: testDate,
            p_increment: 2,
          })
        );
      }

      await Promise.all(promises);

      // Verify final count
      const { data: finalRecord } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(finalRecord?.count).toBe(updates * 2);
    });
  });

  describe("Zone update race conditions", () => {
    it("should handle concurrent zone updates without data loss", async () => {
      // Multiple clients updating different zones simultaneously
      const zone1Updates = Array.from({ length: 20 }, (_, i) =>
        supabase.rpc("update_api_usage_zones", {
          p_service: testService,
          p_date: testDate,
          p_zone1_usage: (i + 1) * 5,
        })
      );

      const zone2Updates = Array.from({ length: 20 }, (_, i) =>
        supabase.rpc("update_api_usage_zones", {
          p_service: testService,
          p_date: testDate,
          p_zone2_usage: (i + 1) * 3,
        })
      );

      // Execute all zone updates concurrently
      const results = await Promise.all([...zone1Updates, ...zone2Updates]);

      // All should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Verify final zone values (last update wins)
      const { data: finalRecord } = await supabase
        .from("api_usage")
        .select("zone1_usage, zone2_usage")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      // Last updates should be: zone1 = 20*5 = 100, zone2 = 20*3 = 60
      expect(finalRecord?.zone1_usage).toBe(100);
      expect(finalRecord?.zone2_usage).toBe(60);
    });

    it("should handle interleaved zone and count updates", async () => {
      const operations = [];

      // Interleave different types of updates
      for (let i = 0; i < 30; i++) {
        if (i % 3 === 0) {
          // Count increment
          operations.push(
            supabase.rpc("increment_api_usage", {
              p_service: testService,
              p_date: testDate,
              p_increment: 1,
            })
          );
        } else if (i % 3 === 1) {
          // Zone1 update
          operations.push(
            supabase.rpc("update_api_usage_zones", {
              p_service: testService,
              p_date: testDate,
              p_zone1_usage: i * 2,
            })
          );
        } else {
          // Zone2 update
          operations.push(
            supabase.rpc("update_api_usage_zones", {
              p_service: testService,
              p_date: testDate,
              p_zone2_usage: i,
            })
          );
        }
      }

      // Execute all operations concurrently
      const results = await Promise.all(operations);

      // All should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Verify final state
      const { data: finalRecord } = await supabase
        .from("api_usage")
        .select("count, zone1_usage, zone2_usage")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      // Count should be 10 (30/3 count operations)
      expect(finalRecord?.count).toBe(10);
      // Zone values should be from last updates
      expect(finalRecord?.zone1_usage).toBeGreaterThan(0);
      expect(finalRecord?.zone2_usage).toBeGreaterThan(0);
    });

    it("should maintain consistency with zone limits during concurrent updates", async () => {
      const operations = [];

      // Concurrent updates to both usage and limits
      for (let i = 0; i < 20; i++) {
        operations.push(
          supabase.rpc("update_api_usage_zones", {
            p_service: testService,
            p_date: testDate,
            p_zone1_usage: i * 10,
            p_zone1_limit: 1000,
            p_zone2_usage: i * 5,
            p_zone2_limit: 100,
          })
        );
      }

      const results = await Promise.all(operations);

      // All should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Verify final state maintains consistency
      const { data: finalRecord } = await supabase
        .from("api_usage")
        .select("zone1_usage, zone1_limit, zone2_usage, zone2_limit")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      expect(finalRecord?.zone1_limit).toBe(1000);
      expect(finalRecord?.zone2_limit).toBe(100);
      expect(finalRecord?.zone1_usage).toBeLessThanOrEqual(1000);
      expect(finalRecord?.zone2_usage).toBeLessThanOrEqual(100);
    });
  });

  describe("Multi-service concurrency", () => {
    it("should handle updates to multiple services simultaneously", async () => {
      const services = Array.from(
        { length: 10 },
        (_, i) => `${testService}_${i}`
      );
      const operations = [];

      // Create operations for multiple services
      services.forEach((service) => {
        for (let i = 0; i < 5; i++) {
          operations.push(
            supabase.rpc("increment_api_usage", {
              p_service: service,
              p_date: testDate,
              p_increment: 1,
            })
          );
        }
      });

      // Execute all 50 operations concurrently
      const results = await Promise.all(operations);

      // All should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Verify each service has correct count
      for (const service of services) {
        const { data: record } = await supabase
          .from("api_usage")
          .select("count")
          .eq("service", service)
          .eq("date", testDate)
          .single();

        expect(record?.count).toBe(5);
      }
    });

    it("should handle date rollover during concurrent operations", async () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      const todayStr = today.toISOString().split("T")[0];
      const tomorrowStr = tomorrow.toISOString().split("T")[0];

      // Operations spanning two dates
      const operations = [
        ...Array.from({ length: 25 }, () =>
          supabase.rpc("increment_api_usage", {
            p_service: testService,
            p_date: todayStr,
            p_increment: 2,
          })
        ),
        ...Array.from({ length: 25 }, () =>
          supabase.rpc("increment_api_usage", {
            p_service: testService,
            p_date: tomorrowStr,
            p_increment: 3,
          })
        ),
      ];

      const results = await Promise.all(operations);

      // All should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Verify counts for each date
      const { data: todayRecord } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", testService)
        .eq("date", todayStr)
        .single();

      const { data: tomorrowRecord } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", testService)
        .eq("date", tomorrowStr)
        .single();

      expect(todayRecord?.count).toBe(50); // 25 * 2
      expect(tomorrowRecord?.count).toBe(75); // 25 * 3
    });
  });

  describe("Stress testing", () => {
    it("should handle 500 concurrent operations without deadlock", async () => {
      const numOperations = 500;
      const operations = [];

      // Mix of different operation types
      for (let i = 0; i < numOperations; i++) {
        const operationType = i % 4;

        switch (operationType) {
          case 0:
            // Increment
            operations.push(
              supabase.rpc("increment_api_usage", {
                p_service: testService,
                p_date: testDate,
                p_increment: 1,
              })
            );
            break;
          case 1:
            // Zone1 update
            operations.push(
              supabase.rpc("update_api_usage_zones", {
                p_service: testService,
                p_date: testDate,
                p_zone1_usage: i,
              })
            );
            break;
          case 2:
            // Zone2 update
            operations.push(
              supabase.rpc("update_api_usage_zones", {
                p_service: testService,
                p_date: testDate,
                p_zone2_usage: i / 2,
              })
            );
            break;
          case 3:
            // Combined update
            operations.push(
              supabase.rpc("update_api_usage_zones", {
                p_service: testService,
                p_date: testDate,
                p_zone1_usage: i,
                p_zone2_usage: i / 2,
                p_reset_after: 3600,
              })
            );
            break;
        }
      }

      const start = performance.now();

      // Execute all operations with timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Operations timed out")), 30000)
      );

      try {
        const results = (await Promise.race([
          Promise.all(operations),
          timeoutPromise,
        ])) as any[];

        const duration = performance.now() - start;

        // Should complete without timeout
        expect(results).toBeDefined();
        expect(results.length).toBe(numOperations);

        // Should complete within reasonable time (30 seconds)
        expect(duration).toBeLessThan(30000);

        // Verify data integrity
        const { data: finalRecord } = await supabase
          .from("api_usage")
          .select("*")
          .eq("service", testService)
          .eq("date", testDate)
          .single();

        expect(finalRecord).toBeDefined();
        // Count should be 125 (500/4 increment operations)
        expect(finalRecord?.count).toBe(125);
      } catch (error) {
        // If timeout or other error, fail the test
        expect(error).toBeUndefined();
      }
    });

    it("should recover from partial failures in concurrent batch", async () => {
      const operations = [];

      // Mix valid and potentially problematic operations
      for (let i = 0; i < 50; i++) {
        if (i % 10 === 0) {
          // Potentially problematic: very large increment
          operations.push(
            supabase.rpc("increment_api_usage", {
              p_service: testService,
              p_date: testDate,
              p_increment: 999999999,
            })
          );
        } else {
          // Normal operation
          operations.push(
            supabase.rpc("increment_api_usage", {
              p_service: testService,
              p_date: testDate,
              p_increment: 1,
            })
          );
        }
      }

      // Execute all operations, allowing some to fail
      const results = await Promise.allSettled(operations);

      // Count successful operations
      const successCount = results.filter(
        (r) => r.status === "fulfilled" && !r.value.error
      ).length;

      // At least normal operations should succeed
      expect(successCount).toBeGreaterThanOrEqual(45); // 50 - 5 problematic

      // Verify database still has valid data
      const { data: finalRecord } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      // Count should be reasonable (not corrupted)
      expect(finalRecord).toBeDefined();
      expect(finalRecord?.count).toBeGreaterThan(0);
    });
  });

  describe("Isolation and consistency", () => {
    it("should maintain isolation between different services", async () => {
      const service1 = `${testService}_iso1`;
      const service2 = `${testService}_iso2`;

      // Concurrent updates to different services
      const operations = [
        ...Array.from({ length: 50 }, () =>
          supabase.rpc("increment_api_usage", {
            p_service: service1,
            p_date: testDate,
            p_increment: 2,
          })
        ),
        ...Array.from({ length: 50 }, () =>
          supabase.rpc("increment_api_usage", {
            p_service: service2,
            p_date: testDate,
            p_increment: 3,
          })
        ),
      ];

      // Shuffle operations to ensure true concurrency
      const shuffled = operations.sort(() => Math.random() - 0.5);

      const results = await Promise.all(shuffled);

      // All should succeed
      results.forEach((result) => {
        expect(result.error).toBeNull();
      });

      // Verify isolation - each service should have its own count
      const { data: record1 } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", service1)
        .eq("date", testDate)
        .single();

      const { data: record2 } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", service2)
        .eq("date", testDate)
        .single();

      expect(record1?.count).toBe(100); // 50 * 2
      expect(record2?.count).toBe(150); // 50 * 3
    });

    it("should maintain consistency during network interruptions", async () => {
      const operations = [];

      // Simulate operations that might face network issues
      for (let i = 0; i < 30; i++) {
        const promise = supabase.rpc("increment_api_usage", {
          p_service: testService,
          p_date: testDate,
          p_increment: 1,
        });

        // Add artificial delay to some operations
        if (i % 5 === 0) {
          operations.push(
            new Promise((resolve) =>
              setTimeout(() => resolve(promise), Math.random() * 100)
            )
          );
        } else {
          operations.push(promise);
        }
      }

      const results = await Promise.allSettled(operations);

      // Count successful operations
      const successCount = results.filter(
        (r) => r.status === "fulfilled" && r.value && !(r.value as any).error
      ).length;

      // Verify final count matches successful operations
      const { data: finalRecord } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", testService)
        .eq("date", testDate)
        .single();

      // If record exists, count should match successful operations
      if (finalRecord) {
        expect(finalRecord.count).toBeLessThanOrEqual(successCount);
      }
    });
  });
});
