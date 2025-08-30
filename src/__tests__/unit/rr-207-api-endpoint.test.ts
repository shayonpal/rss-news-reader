/**
 * RR-207: Unit Tests for API Endpoint Response
 *
 * These tests verify the API response structure without needing a full server.
 * They test the logic directly by importing and calling the GET function.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { GET, OPTIONS } from "@/app/api/sync/api-usage/route";
import { getAdminClient } from "@/lib/db/supabase-admin";

// Mock Supabase admin client
vi.mock("@/lib/db/supabase-admin", () => ({
  getAdminClient: vi.fn(),
}));

describe("RR-207: API Usage Endpoint Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("GET /api/sync/api-usage", () => {
    it("should return complete response with dataReliability field when headers are available", async () => {
      const testTimestamp = "2025-08-15T09:30:00.000Z";
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
                    updated_at: testTimestamp,
                    count: 39,
                  },
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify complete response structure
      expect(data).toMatchObject({
        zone1: {
          used: 4,
          limit: 10000,
          percentage: 0.04,
        },
        zone2: {
          used: 0,
          limit: 2000,
          percentage: 0,
        },
        resetAfterSeconds: 82797,
        timestamp: expect.any(String),
        dataReliability: "headers",
        lastHeaderUpdate: testTimestamp,
      });
    });

    it("should indicate fallback reliability when headers are missing", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    zone1_usage: null,
                    zone1_limit: 10000,
                    zone2_usage: null,
                    zone2_limit: 2000,
                    reset_after: 86400,
                    updated_at: null,
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

      const response = await GET();
      const data = await response.json();

      expect(data.dataReliability).toBe("fallback");
      expect(data.lastHeaderUpdate).toBeNull();
      expect(data.zone1.used).toBe(0); // Fallback value, not count
    });

    it("should include proper headers in response", async () => {
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
                    reset_after: 3600,
                    updated_at: new Date().toISOString(),
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

      const response = await GET();

      // Check headers
      expect(response.headers.get("Cache-Control")).toBe("public, max-age=30");
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, OPTIONS"
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type, Authorization"
      );
    });

    it("should return defaults when database throws error", async () => {
      // Mock getAdminClient to throw an error
      // getCurrentApiUsage catches errors and returns defaults
      vi.mocked(getAdminClient).mockImplementation(() => {
        throw new Error("Database connection timeout");
      });

      const response = await GET();
      const data = await response.json();

      // Should return 200 with default values due to error handling
      expect(response.status).toBe(200);
      expect(data).toMatchObject({
        zone1: {
          used: 0,
          limit: 10000,
          percentage: 0,
        },
        zone2: {
          used: 0,
          limit: 2000,
          percentage: 0,
        },
        dataReliability: "fallback",
        lastHeaderUpdate: null,
      });
    });

    it("should handle missing database data gracefully", async () => {
      const mockSupabase = {
        from: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              }),
            }),
          }),
        }),
      };

      vi.mocked(getAdminClient).mockReturnValue(mockSupabase as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);

      // Should return defaults with fallback reliability
      expect(data.zone1.used).toBe(0);
      expect(data.zone1.limit).toBe(10000);
      expect(data.zone2.used).toBe(0);
      expect(data.zone2.limit).toBe(2000);
      expect(data.dataReliability).toBe("fallback");
      expect(data.lastHeaderUpdate).toBeNull();
    });

    it("should correctly handle production data discrepancy (zone1_usage=4, count=39)", async () => {
      const testTimestamp = "2025-08-14T23:45:00.000Z";
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
                    updated_at: testTimestamp,
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

      const response = await GET();
      const data = await response.json();

      // Critical assertion: Must show 4, not 39
      expect(data.zone1.used).toBe(4);
      expect(data.zone1.percentage).toBe(0.04);

      // Should indicate data is from headers
      expect(data.dataReliability).toBe("headers");
      expect(data.lastHeaderUpdate).toBe(testTimestamp);

      // Zone 2 should remain at 0
      expect(data.zone2.used).toBe(0);
      expect(data.zone2.percentage).toBe(0);
    });
  });

  describe("OPTIONS /api/sync/api-usage", () => {
    it("should handle OPTIONS preflight requests", async () => {
      const response = await OPTIONS();

      expect(response.status).toBe(200);
      expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(response.headers.get("Access-Control-Allow-Methods")).toBe(
        "GET, POST, OPTIONS"
      );
      expect(response.headers.get("Access-Control-Allow-Headers")).toBe(
        "Content-Type, Authorization"
      );
    });
  });
});
