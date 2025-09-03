/**
 * RR-237: Unit tests for RPC helper function
 * Tests the helper function that provides backward compatibility
 * while transitioning from direct table updates to RPC functions
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/types";

// Mock Supabase client
vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    rpc: vi.fn(),
    from: vi.fn(),
  })),
}));

// Import the actual implementation
import {
  ApiUsageTracker,
  TrackApiUsageParams,
} from "@/lib/api/api-usage-tracker";

describe("ApiUsageTracker/trackUsage", () => {
  let supabase: any;
  let tracker: ApiUsageTracker;

  beforeEach(() => {
    vi.clearAllMocks();
    supabase = {
      rpc: vi.fn(),
      from: vi.fn(() => ({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn(),
            })),
          })),
        })),
        insert: vi.fn(),
        update: vi.fn(() => ({
          eq: vi.fn(),
        })),
      })),
    };
    tracker = new ApiUsageTracker(supabase);
  });

  describe("Basic functionality", () => {
    it("should call RPC function with correct parameters", async () => {
      const params: TrackApiUsageParams = {
        service: "inoreader",
        date: "2025-09-02",
        increment: 1,
      };

      supabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await tracker.trackUsage(params);

      expect(supabase.rpc).toHaveBeenCalledWith("increment_api_usage", {
        p_service: "inoreader",
        p_date: "2025-09-02",
        p_increment: 1,
      });
      expect(result.success).toBe(true);
    });

    it("should handle zone tracking parameters", async () => {
      const params: TrackApiUsageParams = {
        service: "inoreader",
        zone1_usage: 10,
        zone2_usage: 5,
        zone1_limit: 1000,
        zone2_limit: 100,
      };

      supabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await tracker.trackUsage(params);

      expect(supabase.rpc).toHaveBeenCalledWith("update_api_usage_zones", {
        p_service: "inoreader",
        p_date: expect.any(String),
        p_zone1_usage: 10,
        p_zone2_usage: 5,
        p_zone1_limit: 1000,
        p_zone2_limit: 100,
      });
      expect(result.success).toBe(true);
    });

    it("should use current date if not provided", async () => {
      const params: TrackApiUsageParams = {
        service: "inoreader",
        increment: 1,
      };

      const today = new Date().toISOString().split("T")[0];
      supabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await tracker.trackUsage(params);

      expect(supabase.rpc).toHaveBeenCalledWith("increment_api_usage", {
        p_service: "inoreader",
        p_date: today,
        p_increment: 1,
      });
    });

    it("should default increment to 1 if not provided", async () => {
      const params: TrackApiUsageParams = {
        service: "inoreader",
      };

      supabase.rpc.mockResolvedValue({
        data: { success: true },
        error: null,
      });

      const result = await tracker.trackUsage(params);

      expect(supabase.rpc).toHaveBeenCalledWith(
        "increment_api_usage",
        expect.objectContaining({
          p_increment: 1,
        })
      );
    });
  });

  describe("Error handling", () => {
    it("should handle RPC function errors gracefully", async () => {
      const params: TrackApiUsageParams = {
        service: "inoreader",
      };

      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "RPC function not found" },
      });

      const result = await tracker.trackUsage(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain("RPC function not found");
    });

    it("should handle database connection errors", async () => {
      const params: TrackApiUsageParams = {
        service: "inoreader",
      };

      supabase.rpc.mockRejectedValue(new Error("Connection timeout"));

      const result = await tracker.trackUsage(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Connection timeout");
    });

    it("should validate required parameters", async () => {
      const params: TrackApiUsageParams = {
        service: "", // Invalid empty service
      };

      const result = await tracker.trackUsage(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Service name is required");
      expect(supabase.rpc).not.toHaveBeenCalled();
    });
  });

  describe("Fallback mechanism", () => {
    it("should fallback to direct table update if RPC fails", async () => {
      const params: TrackApiUsageParams = {
        service: "inoreader",
        increment: 1,
      };

      // RPC call fails
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "RPC function not found" },
      });

      // Direct table update succeeds
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 1, count: 10 },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
        insert: vi.fn().mockResolvedValue({
          data: { id: 1 },
          error: null,
        }),
      };

      supabase.from.mockReturnValue(mockFrom);

      const result = await tracker.trackUsageWithFallback(params);

      expect(supabase.rpc).toHaveBeenCalled();
      expect(supabase.from).toHaveBeenCalledWith("api_usage");
      expect(result.success).toBe(true);
    });

    it("should handle complete failure of both RPC and direct update", async () => {
      const params: TrackApiUsageParams = {
        service: "inoreader",
      };

      // RPC fails
      supabase.rpc.mockRejectedValue(new Error("RPC error"));

      // Direct update also fails
      supabase.from.mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockRejectedValue(new Error("Database error")),
      });

      const result = await tracker.trackUsageWithFallback(params);

      expect(result.success).toBe(false);
      expect(result.error).toContain("Failed to track API usage");
    });
  });

  describe("Backward compatibility", () => {
    it("should maintain compatibility with existing direct update pattern", async () => {
      // Test that the helper can replace existing direct update code
      const today = new Date().toISOString().split("T")[0];

      // Simulate existing pattern
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: "PGRST116" }, // No rows found
        }),
        insert: vi.fn().mockResolvedValue({
          data: { id: 1 },
          error: null,
        }),
      };

      supabase.from.mockReturnValue(mockFrom);
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Function not implemented yet" },
      });

      const result = await tracker.trackUsageWithFallback({
        service: "inoreader",
        date: today,
        increment: 1,
      });

      expect(result.success).toBe(true);
      expect(mockFrom.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          service: "inoreader",
          date: today,
          count: 1,
        })
      );
    });

    it("should handle zone updates in backward compatibility mode", async () => {
      const params: TrackApiUsageParams = {
        service: "inoreader",
        zone1_usage: 15,
        zone2_usage: 3,
      };

      // RPC not available
      supabase.rpc.mockResolvedValue({
        data: null,
        error: { message: "Function not found" },
      });

      // Mock existing record
      const mockFrom = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: {
            id: 1,
            count: 10,
            zone1_usage: 10,
            zone2_usage: 2,
          },
          error: null,
        }),
        update: vi.fn().mockReturnThis(),
      };

      mockFrom.update.mockResolvedValue({
        data: { id: 1 },
        error: null,
      });

      supabase.from.mockReturnValue(mockFrom);

      const result = await tracker.trackUsageWithFallback(params);

      expect(result.success).toBe(true);
      expect(mockFrom.update).toHaveBeenCalledWith(
        expect.objectContaining({
          zone1_usage: 15,
          zone2_usage: 3,
        })
      );
    });
  });
});

describe("ApiUsageTracker/performance", () => {
  let supabase: any;
  let tracker: ApiUsageTracker;

  beforeEach(() => {
    supabase = {
      rpc: vi.fn().mockResolvedValue({ data: { success: true }, error: null }),
      from: vi.fn(),
    };
    tracker = new ApiUsageTracker(supabase);
  });

  it("should complete RPC call within 100ms", async () => {
    const start = performance.now();

    await tracker.trackUsage({
      service: "inoreader",
      increment: 1,
    });

    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
  });

  it("should handle batch updates efficiently", async () => {
    const updates = Array.from({ length: 10 }, (_, i) => ({
      service: "inoreader",
      increment: 1,
      zone1_usage: i * 10,
    }));

    const start = performance.now();

    const results = await Promise.all(
      updates.map((params) => tracker.trackUsage(params))
    );

    const duration = performance.now() - start;

    expect(results).toHaveLength(10);
    expect(results.every((r) => r.success)).toBe(true);
    expect(duration).toBeLessThan(500); // Should complete within 500ms
  });
});
