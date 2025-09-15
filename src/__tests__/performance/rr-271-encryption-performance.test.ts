/**
 * RR-271: Encryption Performance Benchmarks
 *
 * Performance Requirements:
 * - Decrypt: < 5ms
 * - Cached decrypt: < 1ms
 * - JSONB query with GIN index: < 10ms
 * - Batch operations: Efficient scaling
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { performance } from "perf_hooks";
import crypto from "crypto";
import { createSupabaseTestClient } from "@/test-utils/supabase-test-client";

describe("RR-271: Encryption Performance Benchmarks", () => {
  const VALID_HEX_KEY =
    "367649d22465a95203ddcffee4882e37718bef016c98f18227efe011035e3498";
  const TEST_API_KEY = "sk-ant-api03-perf-test-key-1234567890";

  let supabase: ReturnType<typeof createSupabaseTestClient>;
  let encryptionCache: Map<string, { value: string; timestamp: number }>;
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  beforeEach(() => {
    supabase = createSupabaseTestClient();
    encryptionCache = new Map();
  });

  afterEach(() => {
    vi.clearAllMocks();
    encryptionCache.clear();
  });

  describe("Single Operation Performance", () => {
    it("should encrypt within 5ms", () => {
      const measurements: number[] = [];

      // Run multiple iterations for accurate measurement
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
          "aes-256-gcm",
          Buffer.from(VALID_HEX_KEY, "hex"),
          iv
        );

        let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
        encrypted += cipher.final("hex");
        cipher.getAuthTag();

        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);

      expect(avgTime).toBeLessThan(5); // Average < 5ms
      expect(maxTime).toBeLessThan(10); // Max < 10ms (allowing for outliers)
    });

    it("should decrypt within 5ms", () => {
      // Prepare encrypted data
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );

      let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      const measurements: number[] = [];

      // Run multiple iterations
      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();

        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          Buffer.from(VALID_HEX_KEY, "hex"),
          iv
        );
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");

        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const p95Time = measurements.sort((a, b) => a - b)[
        Math.floor(measurements.length * 0.95)
      ];

      expect(avgTime).toBeLessThan(5); // Average < 5ms
      expect(p95Time).toBeLessThan(7); // 95th percentile < 7ms
    });
  });

  describe("Cache Performance", () => {
    it("should retrieve cached decryption within 1ms", () => {
      const cacheKey = "user-123-api-key";

      // Simulate initial decryption and caching
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );

      let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      // Decrypt and cache
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, "hex", "utf8");
      decrypted += decipher.final("utf8");

      // Store in cache
      encryptionCache.set(cacheKey, {
        value: decrypted,
        timestamp: Date.now(),
      });

      // Measure cache retrieval
      const measurements: number[] = [];

      for (let i = 0; i < 1000; i++) {
        const startTime = performance.now();

        const cached = encryptionCache.get(cacheKey);
        const isValid = cached && Date.now() - cached.timestamp < CACHE_TTL;
        const value = isValid ? cached.value : null;

        const endTime = performance.now();
        measurements.push(endTime - startTime);

        expect(value).toBe(TEST_API_KEY);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const maxTime = Math.max(...measurements);

      expect(avgTime).toBeLessThan(0.1); // Average < 0.1ms
      expect(maxTime).toBeLessThan(1); // Max < 1ms
    });

    it("should efficiently handle cache expiration checks", () => {
      // Populate cache with multiple entries
      const entries = 100;
      const now = Date.now();

      for (let i = 0; i < entries; i++) {
        encryptionCache.set(`key-${i}`, {
          value: `value-${i}`,
          timestamp: now - i * 1000, // Stagger timestamps
        });
      }

      const startTime = performance.now();

      // Check all entries for expiration
      let validCount = 0;
      let expiredCount = 0;

      for (const [key, entry] of encryptionCache.entries()) {
        if (Date.now() - entry.timestamp < CACHE_TTL) {
          validCount++;
        } else {
          expiredCount++;
          encryptionCache.delete(key);
        }
      }

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(5); // Should process 100 entries in < 5ms
      expect(validCount + expiredCount).toBe(entries);
    });
  });

  describe("Database Query Performance", () => {
    it("should query encrypted preferences with GIN index within 10ms", async () => {
      const userId = "perf-test-user";

      // Insert test data
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(
        "aes-256-gcm",
        Buffer.from(VALID_HEX_KEY, "hex"),
        iv
      );

      let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
      encrypted += cipher.final("hex");
      const authTag = cipher.getAuthTag();

      await supabase.from("user_preferences").insert({
        user_id: userId,
        preferences: {
          ai: {
            summaryModel: "claude-3-5-haiku-20241022",
            apiKey: {
              encrypted,
              iv: iv.toString("hex"),
              authTag: authTag.toString("hex"),
            },
          },
        },
      });

      const measurements: number[] = [];

      // Run multiple queries
      for (let i = 0; i < 50; i++) {
        const startTime = performance.now();

        const { data, error } = await supabase
          .from("user_preferences")
          .select("preferences")
          .eq("user_id", userId)
          .single();

        const endTime = performance.now();
        measurements.push(endTime - startTime);

        expect(error).toBeNull();
        expect(data).toBeDefined();
      }

      const avgTime =
        measurements.reduce((a, b) => a + b, 0) / measurements.length;
      const p99Time = measurements.sort((a, b) => a - b)[
        Math.floor(measurements.length * 0.99)
      ];

      expect(avgTime).toBeLessThan(10); // Average < 10ms
      expect(p99Time).toBeLessThan(20); // 99th percentile < 20ms

      // Cleanup
      await supabase.from("user_preferences").delete().eq("user_id", userId);
    });

    it("should efficiently query preferences for multiple users", async () => {
      const userCount = 10;
      const userIds = Array.from(
        { length: userCount },
        (_, i) => `batch-user-${i}`
      );

      // Insert test data for all users
      const insertPromises = userIds.map(async (userId) => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
          "aes-256-gcm",
          Buffer.from(VALID_HEX_KEY, "hex"),
          iv
        );

        let encrypted = cipher.update(
          `${TEST_API_KEY}-${userId}`,
          "utf8",
          "hex"
        );
        encrypted += cipher.final("hex");
        const authTag = cipher.getAuthTag();

        return supabase.from("user_preferences").insert({
          user_id: userId,
          preferences: {
            ai: {
              apiKey: {
                encrypted,
                iv: iv.toString("hex"),
                authTag: authTag.toString("hex"),
              },
            },
          },
        });
      });

      await Promise.all(insertPromises);

      // Measure batch query performance
      const startTime = performance.now();

      const { data, error } = await supabase
        .from("user_preferences")
        .select("user_id, preferences")
        .in("user_id", userIds);

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(error).toBeNull();
      expect(data?.length).toBe(userCount);
      expect(duration).toBeLessThan(50); // Batch query < 50ms

      // Cleanup
      await supabase.from("user_preferences").delete().in("user_id", userIds);
    });
  });

  describe("Concurrent Operations", () => {
    it("should handle concurrent encryption operations efficiently", async () => {
      const concurrentOps = 50;
      const apiKeys = Array.from(
        { length: concurrentOps },
        (_, i) => `sk-ant-api03-concurrent-${i}`
      );

      const startTime = performance.now();

      const encryptionPromises = apiKeys.map(async (apiKey) => {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
          "aes-256-gcm",
          Buffer.from(VALID_HEX_KEY, "hex"),
          iv
        );

        let encrypted = cipher.update(apiKey, "utf8", "hex");
        encrypted += cipher.final("hex");
        const authTag = cipher.getAuthTag();

        return {
          encrypted,
          iv: iv.toString("hex"),
          authTag: authTag.toString("hex"),
        };
      });

      const results = await Promise.all(encryptionPromises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentOps;

      expect(results.length).toBe(concurrentOps);
      expect(avgTime).toBeLessThan(2); // Average < 2ms per operation
      expect(totalTime).toBeLessThan(100); // Total < 100ms for 50 operations
    });

    it("should handle concurrent decryption operations efficiently", async () => {
      // Prepare encrypted data
      const concurrentOps = 50;
      const encryptedData = Array.from({ length: concurrentOps }, (_, i) => {
        const apiKey = `sk-ant-api03-decrypt-${i}`;
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
          "aes-256-gcm",
          Buffer.from(VALID_HEX_KEY, "hex"),
          iv
        );

        let encrypted = cipher.update(apiKey, "utf8", "hex");
        encrypted += cipher.final("hex");
        const authTag = cipher.getAuthTag();

        return {
          apiKey,
          encrypted,
          iv,
          authTag,
        };
      });

      const startTime = performance.now();

      const decryptionPromises = encryptedData.map(
        async ({ apiKey, encrypted, iv, authTag }) => {
          const decipher = crypto.createDecipheriv(
            "aes-256-gcm",
            Buffer.from(VALID_HEX_KEY, "hex"),
            iv
          );
          decipher.setAuthTag(authTag);

          let decrypted = decipher.update(encrypted, "hex", "utf8");
          decrypted += decipher.final("utf8");

          return decrypted === apiKey;
        }
      );

      const results = await Promise.all(decryptionPromises);

      const endTime = performance.now();
      const totalTime = endTime - startTime;
      const avgTime = totalTime / concurrentOps;

      expect(results.every((r) => r === true)).toBe(true);
      expect(avgTime).toBeLessThan(2); // Average < 2ms per operation
      expect(totalTime).toBeLessThan(100); // Total < 100ms for 50 operations
    });
  });

  describe("Memory Efficiency", () => {
    it("should not leak memory during repeated encryption/decryption", () => {
      const iterations = 1000;
      const initialMemory = process.memoryUsage().heapUsed;

      for (let i = 0; i < iterations; i++) {
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
          "aes-256-gcm",
          Buffer.from(VALID_HEX_KEY, "hex"),
          iv
        );

        let encrypted = cipher.update(TEST_API_KEY, "utf8", "hex");
        encrypted += cipher.final("hex");
        const authTag = cipher.getAuthTag();

        const decipher = crypto.createDecipheriv(
          "aes-256-gcm",
          Buffer.from(VALID_HEX_KEY, "hex"),
          iv
        );
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, "hex", "utf8");
        decrypted += decipher.final("utf8");
      }

      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      const memoryPerOperation = memoryIncrease / iterations;

      // Memory increase should be minimal
      expect(memoryPerOperation).toBeLessThan(1024); // Less than 1KB per operation
    });
  });

  describe("Edge Case Performance", () => {
    it("should handle empty strings efficiently", () => {
      const emptyKey = "";
      const measurements: number[] = [];

      for (let i = 0; i < 100; i++) {
        const startTime = performance.now();

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
          "aes-256-gcm",
          Buffer.from(VALID_HEX_KEY, "hex"),
          iv
        );

        let encrypted = cipher.update(emptyKey, "utf8", "hex");
        encrypted += cipher.final("hex");
        cipher.getAuthTag();

        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgTime).toBeLessThan(5); // Still < 5ms for empty strings
    });

    it("should handle very long API keys efficiently", () => {
      const longKey = "sk-ant-api03-" + "x".repeat(10000); // 10KB key
      const measurements: number[] = [];

      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();

        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv(
          "aes-256-gcm",
          Buffer.from(VALID_HEX_KEY, "hex"),
          iv
        );

        let encrypted = cipher.update(longKey, "utf8", "hex");
        encrypted += cipher.final("hex");
        cipher.getAuthTag();

        const endTime = performance.now();
        measurements.push(endTime - startTime);
      }

      const avgTime =
        measurements.reduce((a, b) => a + b, 0) / measurements.length;
      expect(avgTime).toBeLessThan(20); // < 20ms even for large keys
    });
  });
});
