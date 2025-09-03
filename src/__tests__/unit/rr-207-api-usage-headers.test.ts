/**
 * RR-207: Unit Tests for API Usage Header Priority Fix
 *
 * These tests define the specification for getCurrentApiUsage function.
 * The implementation must conform to these tests - tests should never be modified
 * to match implementation.
 *
 * Key Requirements:
 * 1. Headers are authoritative - no Math.max hybrid calculation
 * 2. Fallback to 0 only when headers are null/undefined
 * 3. Warning logs for discrepancies > 20%
 * 4. Zone 2 remains header-only (no changes)
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { getCurrentApiUsage } from "@/lib/api/capture-rate-limit-headers";
import { getAdminClient } from "@/lib/db/supabase-admin";

// Mock Supabase admin client
vi.mock("@/lib/db/supabase-admin", () => ({
  getAdminClient: vi.fn(),
}));

describe("RR-207: getCurrentApiUsage Header Priority Tests", () => {
  let consoleWarnSpy: any;
  let consoleErrorSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    // Spy on console methods to verify warnings
    consoleWarnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe("Core Specification Tests", () => {
    it("should use header values directly without Math.max hybrid calculation", async () => {
      // This is THE KEY TEST - headers are authoritative
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    zone1_usage: 4,
                    zone1_limit: 10000,
                    zone2_usage: 0,
                    zone2_limit: 2000,
                    reset_after: 82797,
                    updated_at: new Date().toISOString(),
                    count: 39, // Local count is 10x higher - should be ignored
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const result = await getCurrentApiUsage();

      // CRITICAL ASSERTION: Must return 4 (header value), not 39 (count)
      expect(result.zone1.used).toBe(4);
      expect(result.zone1.limit).toBe(10000);
      expect(result.zone1.percentage).toBeCloseTo(0.04, 2);

      // Zone 2 should remain unchanged
      expect(result.zone2.used).toBe(0);
      expect(result.zone2.limit).toBe(2000);
      expect(result.zone2.percentage).toBe(0);
    });

    it("should log warning when header-count discrepancy exceeds 20%", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    zone1_usage: 4,
                    zone1_limit: 10000,
                    zone2_usage: 0,
                    zone2_limit: 2000,
                    reset_after: 82797,
                    updated_at: new Date().toISOString(),
                    count: 45, // >20% difference from zone1_usage
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const result = await getCurrentApiUsage();

      // Should still use header value
      expect(result.zone1.used).toBe(4);

      // Should have logged a warning about the discrepancy
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[GetApiUsage] Warning: Large discrepancy detected"
        ),
        expect.objectContaining({
          headerValue: 4,
          localCount: 45,
          discrepancyPercentage: expect.any(Number),
        })
      );
    });

    it("should fallback to 0 when headers are null (not use count field)", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    zone1_usage: null, // No header value
                    zone1_limit: 10000,
                    zone2_usage: null,
                    zone2_limit: 2000,
                    reset_after: 86400,
                    updated_at: new Date().toISOString(),
                    count: 10, // Should NOT be used as fallback
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const result = await getCurrentApiUsage();

      // Should fallback to 0, NOT use count field
      expect(result.zone1.used).toBe(0);
      expect(result.zone1.percentage).toBe(0);
      expect(result.zone2.used).toBe(0);
    });

    it("should handle undefined headers with 0 fallback", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    // All fields undefined except count
                    count: 25,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const result = await getCurrentApiUsage();

      // Should use default values, not count
      expect(result.zone1.used).toBe(0);
      expect(result.zone1.limit).toBe(10000); // Standardized default limit
      expect(result.zone2.used).toBe(0);
      expect(result.zone2.limit).toBe(2000); // Standardized default limit
    });
  });

  describe("Zone 2 Behavior (No Changes)", () => {
    it("should continue using header-only approach for Zone 2", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    zone1_usage: 100,
                    zone1_limit: 10000,
                    zone2_usage: 50,
                    zone2_limit: 2000,
                    reset_after: 43200,
                    updated_at: new Date().toISOString(),
                    count: 200,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const result = await getCurrentApiUsage();

      // Zone 2 should use header values directly
      expect(result.zone2.used).toBe(50);
      expect(result.zone2.limit).toBe(2000);
      expect(result.zone2.percentage).toBeCloseTo(2.5, 2);
    });
  });

  describe("Edge Cases and Error Handling", () => {
    it("should return defaults when database query fails", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: new Error("Database connection failed"),
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const result = await getCurrentApiUsage();

      // Should return safe defaults
      expect(result.zone1.used).toBe(0);
      expect(result.zone1.limit).toBe(10000);
      expect(result.zone1.percentage).toBe(0);
      expect(result.zone2.used).toBe(0);
      expect(result.zone2.limit).toBe(2000);
      expect(result.zone2.percentage).toBe(0);
      expect(result.resetAfterSeconds).toBe(86400);
      expect(result.lastUpdated).toBeNull();
    });

    it("should handle percentage calculation with zero limit", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    zone1_usage: 10,
                    zone1_limit: 0, // Edge case: zero limit
                    zone2_usage: 5,
                    zone2_limit: 0,
                    reset_after: 3600,
                    updated_at: new Date().toISOString(),
                    count: 10,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const result = await getCurrentApiUsage();

      // Should handle division by zero gracefully
      expect(result.zone1.percentage).toBe(0);
      expect(result.zone2.percentage).toBe(0);
    });

    it("should include lastUpdated timestamp from database", async () => {
      const testTimestamp = "2025-08-15T09:30:00.000Z";
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    zone1_usage: 100,
                    zone1_limit: 10000,
                    zone2_usage: 10,
                    zone2_limit: 2000,
                    reset_after: 3600,
                    updated_at: testTimestamp,
                    count: 100,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const result = await getCurrentApiUsage();

      expect(result.lastUpdated).toBe(testTimestamp);
    });
  });

  describe("Production Scenario Validation", () => {
    it("should correctly handle actual production data (zone1_usage=4, count=39)", async () => {
      // This test validates the fix for the exact production issue
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    zone1_usage: 4,
                    zone1_limit: 10000,
                    zone2_usage: 0,
                    zone2_limit: 2000,
                    reset_after: 82797,
                    updated_at: "2025-08-14T23:45:00.000Z",
                    count: 39, // The problematic production data
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const result = await getCurrentApiUsage();

      // Must return 4, not 39 - this fixes the 10x discrepancy
      expect(result.zone1.used).toBe(4);
      expect(result.zone1.percentage).toBeCloseTo(0.04, 2);

      // Should warn about the large discrepancy
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "[GetApiUsage] Warning: Large discrepancy detected"
        ),
        expect.objectContaining({
          headerValue: 4,
          localCount: 39,
        })
      );
    });
  });
});
