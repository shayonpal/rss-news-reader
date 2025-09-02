/**
 * RR-237: Performance benchmark tests
 * Measures performance improvements from RPC function approach
 * compared to direct table updates
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

const TEST_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const TEST_SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTime: number;
  averageTime: number;
  minTime: number;
  maxTime: number;
  opsPerSecond: number;
}

class PerformanceBenchmark {
  private results: BenchmarkResult[] = [];

  async measure(
    name: string,
    iterations: number,
    operation: () => Promise<any>
  ): Promise<BenchmarkResult> {
    const times: number[] = [];

    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      await operation();
      const duration = performance.now() - start;
      times.push(duration);
    }

    const totalTime = times.reduce((a, b) => a + b, 0);
    const result: BenchmarkResult = {
      operation: name,
      iterations,
      totalTime,
      averageTime: totalTime / iterations,
      minTime: Math.min(...times),
      maxTime: Math.max(...times),
      opsPerSecond: (iterations / totalTime) * 1000,
    };

    this.results.push(result);
    return result;
  }

  getComparison(
    baseline: string,
    comparison: string
  ): {
    speedup: number;
    percentImprovement: number;
  } {
    const baselineResult = this.results.find((r) => r.operation === baseline);
    const comparisonResult = this.results.find(
      (r) => r.operation === comparison
    );

    if (!baselineResult || !comparisonResult) {
      throw new Error("Results not found for comparison");
    }

    const speedup = baselineResult.averageTime / comparisonResult.averageTime;
    const percentImprovement =
      ((baselineResult.averageTime - comparisonResult.averageTime) /
        baselineResult.averageTime) *
      100;

    return { speedup, percentImprovement };
  }

  printResults() {
    console.table(
      this.results.map((r) => ({
        Operation: r.operation,
        "Avg Time (ms)": r.averageTime.toFixed(2),
        "Min Time (ms)": r.minTime.toFixed(2),
        "Max Time (ms)": r.maxTime.toFixed(2),
        "Ops/Sec": r.opsPerSecond.toFixed(2),
      }))
    );
  }
}

describe("RPC Function Performance Benchmarks", () => {
  let supabase: ReturnType<typeof createClient<Database>>;
  let benchmark: PerformanceBenchmark;
  const testPrefix = `bench_rr237_`;
  let testDate: string;

  beforeAll(() => {
    supabase = createClient<Database>(
      TEST_SUPABASE_URL,
      TEST_SUPABASE_ANON_KEY
    );
  });

  beforeEach(() => {
    benchmark = new PerformanceBenchmark();
    testDate = new Date().toISOString().split("T")[0];
  });

  afterAll(async () => {
    // Clean up all benchmark test data
    await supabase.from("api_usage").delete().like("service", `${testPrefix}%`);
  });

  describe("Single operation benchmarks", () => {
    it("should measure RPC increment performance", async () => {
      const service = `${testPrefix}rpc_single_${Date.now()}`;

      const result = await benchmark.measure(
        "RPC Increment (Single)",
        100,
        async () => {
          await supabase.rpc("increment_api_usage", {
            p_service: service,
            p_date: testDate,
            p_increment: 1,
          });
        }
      );

      expect(result.averageTime).toBeLessThan(50); // Should average under 50ms
      expect(result.opsPerSecond).toBeGreaterThan(20); // At least 20 ops/sec
    });

    it("should measure direct table update performance for comparison", async () => {
      const service = `${testPrefix}direct_single_${Date.now()}`;

      const result = await benchmark.measure(
        "Direct Table Update (Single)",
        100,
        async () => {
          // Simulate the old approach
          const { data: existing } = await supabase
            .from("api_usage")
            .select("*")
            .eq("service", service)
            .eq("date", testDate)
            .single();

          if (existing) {
            await supabase
              .from("api_usage")
              .update({ count: existing.count + 1 })
              .eq("id", existing.id);
          } else {
            await supabase.from("api_usage").insert({
              service,
              date: testDate,
              count: 1,
            });
          }
        }
      );

      expect(result.averageTime).toBeLessThan(100); // Should be under 100ms
    });

    it("should show RPC is faster than direct updates", async () => {
      const rpcService = `${testPrefix}rpc_compare_${Date.now()}`;
      const directService = `${testPrefix}direct_compare_${Date.now()}`;

      // Measure RPC approach
      await benchmark.measure("RPC Approach", 50, async () => {
        await supabase.rpc("increment_api_usage", {
          p_service: rpcService,
          p_date: testDate,
          p_increment: 1,
        });
      });

      // Measure direct approach
      await benchmark.measure("Direct Approach", 50, async () => {
        const { data: existing } = await supabase
          .from("api_usage")
          .select("*")
          .eq("service", directService)
          .eq("date", testDate)
          .single();

        if (existing) {
          await supabase
            .from("api_usage")
            .update({ count: existing.count + 1 })
            .eq("id", existing.id);
        } else {
          await supabase.from("api_usage").insert({
            service: directService,
            date: testDate,
            count: 1,
          });
        }
      });

      const comparison = benchmark.getComparison(
        "Direct Approach",
        "RPC Approach"
      );

      // RPC should be at least 20% faster
      expect(comparison.percentImprovement).toBeGreaterThan(20);
      expect(comparison.speedup).toBeGreaterThan(1.2);
    });
  });

  describe("Batch operation benchmarks", () => {
    it("should handle batch increments efficiently", async () => {
      const service = `${testPrefix}batch_${Date.now()}`;
      const batchSize = 50;

      const result = await benchmark.measure(
        "RPC Batch Increments",
        5, // 5 batches
        async () => {
          const operations = Array.from({ length: batchSize }, () =>
            supabase.rpc("increment_api_usage", {
              p_service: service,
              p_date: testDate,
              p_increment: 1,
            })
          );
          await Promise.all(operations);
        }
      );

      // Should handle 50 operations in under 500ms
      expect(result.averageTime).toBeLessThan(500);

      // Calculate operations per second (50 ops per batch)
      const effectiveOpsPerSec = (batchSize / result.averageTime) * 1000;
      expect(effectiveOpsPerSec).toBeGreaterThan(100); // At least 100 ops/sec
    });

    it("should handle zone updates efficiently", async () => {
      const service = `${testPrefix}zones_${Date.now()}`;

      const result = await benchmark.measure(
        "RPC Zone Updates",
        100,
        async () => {
          await supabase.rpc("update_api_usage_zones", {
            p_service: service,
            p_date: testDate,
            p_zone1_usage: Math.floor(Math.random() * 100),
            p_zone2_usage: Math.floor(Math.random() * 50),
            p_zone1_limit: 1000,
            p_zone2_limit: 100,
          });
        }
      );

      expect(result.averageTime).toBeLessThan(60); // Should average under 60ms
      expect(result.opsPerSecond).toBeGreaterThan(15); // At least 15 ops/sec
    });

    it("should scale linearly with load", async () => {
      const results: BenchmarkResult[] = [];

      // Test with increasing batch sizes
      for (const batchSize of [10, 20, 40, 80]) {
        const service = `${testPrefix}scale_${batchSize}_${Date.now()}`;

        const result = await benchmark.measure(
          `RPC Scale Test (${batchSize} ops)`,
          3,
          async () => {
            const operations = Array.from({ length: batchSize }, () =>
              supabase.rpc("increment_api_usage", {
                p_service: service,
                p_date: testDate,
                p_increment: 1,
              })
            );
            await Promise.all(operations);
          }
        );

        results.push(result);
      }

      // Verify roughly linear scaling
      // Time should roughly double when load doubles
      const ratio10to20 = results[1].averageTime / results[0].averageTime;
      const ratio20to40 = results[2].averageTime / results[1].averageTime;
      const ratio40to80 = results[3].averageTime / results[2].averageTime;

      // Allow for some variance but should be roughly 2x
      expect(ratio10to20).toBeGreaterThan(1.5);
      expect(ratio10to20).toBeLessThan(2.5);
      expect(ratio20to40).toBeGreaterThan(1.5);
      expect(ratio20to40).toBeLessThan(2.5);
      expect(ratio40to80).toBeGreaterThan(1.5);
      expect(ratio40to80).toBeLessThan(2.5);
    });
  });

  describe("Memory and resource benchmarks", () => {
    it("should maintain stable memory usage over time", async () => {
      const service = `${testPrefix}memory_${Date.now()}`;
      const iterations = 1000;
      const batchSize = 100;

      // Record initial memory if available
      const initialMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // Perform many operations
      for (let batch = 0; batch < iterations / batchSize; batch++) {
        const operations = Array.from({ length: batchSize }, () =>
          supabase.rpc("increment_api_usage", {
            p_service: service,
            p_date: testDate,
            p_increment: 1,
          })
        );
        await Promise.all(operations);
      }

      // Record final memory if available
      const finalMemory = (performance as any).memory?.usedJSHeapSize || 0;

      // If memory API is available, check for leaks
      if (initialMemory && finalMemory) {
        const memoryIncrease = finalMemory - initialMemory;
        const memoryIncreasePerOp = memoryIncrease / iterations;

        // Should not leak more than 1KB per operation
        expect(memoryIncreasePerOp).toBeLessThan(1024);
      }

      // Verify final count is correct
      const { data: finalRecord } = await supabase
        .from("api_usage")
        .select("count")
        .eq("service", service)
        .eq("date", testDate)
        .single();

      expect(finalRecord?.count).toBe(iterations);
    });

    it("should handle connection pooling efficiently", async () => {
      const services = Array.from(
        { length: 10 },
        (_, i) => `${testPrefix}pool_${i}_${Date.now()}`
      );

      const result = await benchmark.measure(
        "Connection Pool Test",
        10,
        async () => {
          // Simulate multiple clients making requests
          const operations = services.map((service) =>
            supabase.rpc("increment_api_usage", {
              p_service: service,
              p_date: testDate,
              p_increment: 1,
            })
          );
          await Promise.all(operations);
        }
      );

      // Should handle 10 concurrent connections efficiently
      expect(result.averageTime).toBeLessThan(200);
      expect(result.maxTime).toBeLessThan(500); // No major spikes
    });
  });

  describe("Real-world scenario benchmarks", () => {
    it("should handle typical RSS sync workload", async () => {
      const service = `${testPrefix}rss_sync_${Date.now()}`;

      const result = await benchmark.measure(
        "RSS Sync Simulation",
        10,
        async () => {
          // Simulate a typical RSS sync operation
          // 1. Increment API call count
          await supabase.rpc("increment_api_usage", {
            p_service: service,
            p_date: testDate,
            p_increment: 1,
          });

          // 2. Update zone usage based on response headers
          await supabase.rpc("update_api_usage_zones", {
            p_service: service,
            p_date: testDate,
            p_zone1_usage: Math.floor(Math.random() * 500),
            p_zone2_usage: Math.floor(Math.random() * 50),
          });

          // 3. Simulate fetching multiple articles (5-10)
          const articleFetches = Math.floor(Math.random() * 5) + 5;
          const fetchOps = Array.from({ length: articleFetches }, () =>
            supabase.rpc("increment_api_usage", {
              p_service: service,
              p_date: testDate,
              p_increment: 1,
            })
          );
          await Promise.all(fetchOps);
        }
      );

      // Should complete full sync workflow in reasonable time
      expect(result.averageTime).toBeLessThan(1000); // Under 1 second
    });

    it("should handle peak load times efficiently", async () => {
      const services = Array.from(
        { length: 20 },
        (_, i) => `${testPrefix}peak_${i}_${Date.now()}`
      );

      const result = await benchmark.measure(
        "Peak Load Simulation",
        5,
        async () => {
          // Simulate 20 users syncing simultaneously
          const userOperations = services.map(async (service) => {
            // Each user makes 3-5 API calls
            const numCalls = Math.floor(Math.random() * 3) + 3;
            const calls = Array.from({ length: numCalls }, () =>
              supabase.rpc("increment_api_usage", {
                p_service: service,
                p_date: testDate,
                p_increment: 1,
              })
            );

            // Also update zones
            calls.push(
              supabase.rpc("update_api_usage_zones", {
                p_service: service,
                p_date: testDate,
                p_zone1_usage: Math.floor(Math.random() * 100),
                p_zone2_usage: Math.floor(Math.random() * 20),
              })
            );

            return Promise.all(calls);
          });

          await Promise.all(userOperations);
        }
      );

      // Should handle peak load within 2 seconds
      expect(result.averageTime).toBeLessThan(2000);

      // Calculate effective requests per second
      // ~20 users * ~4 calls each = ~80 operations
      const effectiveOpsPerSec = (80 / result.averageTime) * 1000;
      expect(effectiveOpsPerSec).toBeGreaterThan(40); // At least 40 ops/sec under load
    });

    it("should compare overall performance improvement", async () => {
      const rpcService = `${testPrefix}final_rpc_${Date.now()}`;
      const directService = `${testPrefix}final_direct_${Date.now()}`;

      // Complete workflow with RPC
      const rpcResult = await benchmark.measure(
        "Complete Workflow (RPC)",
        20,
        async () => {
          // Increment count
          await supabase.rpc("increment_api_usage", {
            p_service: rpcService,
            p_date: testDate,
            p_increment: 1,
          });

          // Update zones
          await supabase.rpc("update_api_usage_zones", {
            p_service: rpcService,
            p_date: testDate,
            p_zone1_usage: 50,
            p_zone2_usage: 10,
          });
        }
      );

      // Complete workflow with direct updates
      const directResult = await benchmark.measure(
        "Complete Workflow (Direct)",
        20,
        async () => {
          // Check existing
          const { data: existing } = await supabase
            .from("api_usage")
            .select("*")
            .eq("service", directService)
            .eq("date", testDate)
            .single();

          if (existing) {
            // Update existing
            await supabase
              .from("api_usage")
              .update({
                count: existing.count + 1,
                zone1_usage: 50,
                zone2_usage: 10,
              })
              .eq("id", existing.id);
          } else {
            // Insert new
            await supabase.from("api_usage").insert({
              service: directService,
              date: testDate,
              count: 1,
              zone1_usage: 50,
              zone2_usage: 10,
            });
          }
        }
      );

      // Print comparison
      console.log("\n=== Performance Comparison ===");
      console.log(`RPC Approach: ${rpcResult.averageTime.toFixed(2)}ms avg`);
      console.log(
        `Direct Approach: ${directResult.averageTime.toFixed(2)}ms avg`
      );

      const improvement =
        ((directResult.averageTime - rpcResult.averageTime) /
          directResult.averageTime) *
        100;
      console.log(`Improvement: ${improvement.toFixed(1)}%`);
      console.log(
        `Speedup: ${(directResult.averageTime / rpcResult.averageTime).toFixed(2)}x`
      );

      // RPC should show significant improvement
      expect(rpcResult.averageTime).toBeLessThan(directResult.averageTime);
      expect(improvement).toBeGreaterThan(25); // At least 25% improvement
    });
  });
});
