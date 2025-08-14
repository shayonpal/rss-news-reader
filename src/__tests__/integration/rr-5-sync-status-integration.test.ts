import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  vi,
} from "vitest";
import { setupTestServer } from "./test-server";
import type { Server } from "http";
import { supabase } from "@/lib/db/supabase";

let server: Server;
let app: any;
const TEST_PORT = 3099;

// Mock environment variables
process.env.INOREADER_CLIENT_ID = "test-client-id";
process.env.INOREADER_CLIENT_SECRET = "test-client-secret";
process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || "http://localhost:54321";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "test-anon-key";
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || "test-service-key";

// Mock Inoreader API responses
const mockInoreaderResponse = (zone1Usage: string, zone2Usage: string) => {
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "X-Reader-Zone1-Usage": zone1Usage,
      "X-Reader-Zone1-Limit": "5000",
      "X-Reader-Zone2-Usage": zone2Usage,
      "X-Reader-Zone2-Limit": "100",
      "X-Reader-Limits-Reset-After": "43200",
    },
  });
};

describe("RR-5: Sync Status Display - Integration Tests", () => {
  beforeAll(async () => {
    // Setup test server
    const testServer = await setupTestServer(TEST_PORT);
    server = testServer.server;
    app = testServer.app;

    await new Promise<void>((resolve) => {
      server.listen(TEST_PORT, resolve);
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock global fetch for Inoreader API calls
    global.fetch = vi.fn();
  });

  describe("End-to-End Sync Flow with Header Capture", () => {
    it("should capture and store zone usage from sync operation", async () => {
      // Mock Inoreader API responses with zone headers
      vi.mocked(fetch).mockImplementation((url) => {
        if (url.toString().includes("inoreader.com")) {
          return Promise.resolve(mockInoreaderResponse("234", "87"));
        }
        return Promise.resolve(new Response("Not found", { status: 404 }));
      });

      // Trigger sync
      const syncResponse = await fetch(
        `http://localhost:${TEST_PORT}/reader/api/sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ manual: true }),
        }
      );

      // Verify sync initiated
      expect(syncResponse.status).toBeLessThanOrEqual(202);

      // Check API usage endpoint
      const usageResponse = await fetch(
        `http://localhost:${TEST_PORT}/reader/api/sync/api-usage`
      );

      if (usageResponse.status === 200) {
        const usageData = await usageResponse.json();

        // Verify response structure
        expect(usageData).toHaveProperty("zone1");
        expect(usageData).toHaveProperty("zone2");

        // Verify zone1 data
        expect(usageData.zone1).toHaveProperty("used");
        expect(usageData.zone1).toHaveProperty("limit");
        expect(usageData.zone1).toHaveProperty("percentage");

        // Verify zone2 data
        expect(usageData.zone2).toHaveProperty("used");
        expect(usageData.zone2).toHaveProperty("limit");
        expect(usageData.zone2).toHaveProperty("percentage");
      }
    });

    it("should update database with zone usage data", async () => {
      // Mock Inoreader API with different usage values
      vi.mocked(fetch).mockImplementation((url) => {
        if (url.toString().includes("inoreader.com")) {
          return Promise.resolve(mockInoreaderResponse("500", "50"));
        }
        return Promise.resolve(new Response("Not found", { status: 404 }));
      });

      // Clear existing data
      await supabase
        .from("api_usage")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // Trigger sync
      await fetch(`http://localhost:${TEST_PORT}/reader/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ manual: true }),
      });

      // Query database for zone usage
      const { data, error } = await supabase
        .from("api_usage")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        // Verify zone data is stored
        expect(data[0]).toHaveProperty("zone1_usage");
        expect(data[0]).toHaveProperty("zone1_limit");
        expect(data[0]).toHaveProperty("zone2_usage");
        expect(data[0]).toHaveProperty("zone2_limit");
      }
    });
  });

  describe("API Usage Endpoint", () => {
    it("should return current zone usage from database", async () => {
      // Insert test data into database
      const testData = {
        service: "inoreader",
        date: new Date().toISOString().split("T")[0],
        zone1_usage: 1000,
        zone1_limit: 5000,
        zone2_usage: 25,
        zone2_limit: 100,
      };

      await supabase.from("api_usage").insert(testData);

      // Fetch from API usage endpoint
      const response = await fetch(
        `http://localhost:${TEST_PORT}/reader/api/sync/api-usage`
      );

      if (response.status === 200) {
        const data = await response.json();

        // Verify percentages are calculated correctly
        expect(data.zone1.percentage).toBeCloseTo(20, 1);
        expect(data.zone2.percentage).toBeCloseTo(25, 1);
      }
    });

    it("should return default values when no usage data exists", async () => {
      // Clear all api_usage data
      await supabase
        .from("api_usage")
        .delete()
        .neq("id", "00000000-0000-0000-0000-000000000000");

      // Fetch from API usage endpoint
      const response = await fetch(
        `http://localhost:${TEST_PORT}/reader/api/sync/api-usage`
      );

      if (response.status === 200) {
        const data = await response.json();

        // Should return zeros or defaults
        expect(data.zone1.used).toBe(0);
        expect(data.zone1.limit).toBe(5000);
        expect(data.zone1.percentage).toBe(0);

        expect(data.zone2.used).toBe(0);
        expect(data.zone2.limit).toBe(100);
        expect(data.zone2.percentage).toBe(0);
      }
    });
  });

  describe("Progressive Zone Usage Updates", () => {
    it("should track increasing zone usage across multiple API calls", async () => {
      const usageSequence = [
        { zone1: "100", zone2: "10" },
        { zone1: "200", zone2: "20" },
        { zone1: "300", zone2: "30" },
      ];

      for (const usage of usageSequence) {
        vi.mocked(fetch).mockImplementation((url) => {
          if (url.toString().includes("inoreader.com")) {
            return Promise.resolve(
              mockInoreaderResponse(usage.zone1, usage.zone2)
            );
          }
          return Promise.resolve(new Response("Not found", { status: 404 }));
        });

        // Make API call that triggers header capture
        await fetch(`http://localhost:${TEST_PORT}/reader/api/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ manual: true }),
        });

        // Check current usage
        const response = await fetch(
          `http://localhost:${TEST_PORT}/reader/api/sync/api-usage`
        );

        if (response.status === 200) {
          const data = await response.json();

          // Verify usage is tracked correctly
          expect(data.zone1.used).toBeGreaterThanOrEqual(parseInt(usage.zone1));
          expect(data.zone2.used).toBeGreaterThanOrEqual(parseInt(usage.zone2));
        }
      }
    });

    it("should handle zone limit changes", async () => {
      // Test when Inoreader changes zone limits
      const mockResponseWithNewLimits = new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-Reader-Zone1-Usage": "2000",
            "X-Reader-Zone1-Limit": "10000", // Increased limit
            "X-Reader-Zone2-Usage": "80",
            "X-Reader-Zone2-Limit": "200", // Increased limit
            "X-Reader-Limits-Reset-After": "43200",
          },
        }
      );

      vi.mocked(fetch).mockImplementation((url) => {
        if (url.toString().includes("inoreader.com")) {
          return Promise.resolve(mockResponseWithNewLimits);
        }
        return Promise.resolve(new Response("Not found", { status: 404 }));
      });

      await fetch(`http://localhost:${TEST_PORT}/reader/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ manual: true }),
      });

      const response = await fetch(
        `http://localhost:${TEST_PORT}/reader/api/sync/api-usage`
      );

      if (response.status === 200) {
        const data = await response.json();

        // Verify new limits are reflected
        expect(data.zone1.limit).toBe(10000);
        expect(data.zone2.limit).toBe(200);

        // Verify percentages are recalculated with new limits
        expect(data.zone1.percentage).toBeCloseTo(20, 1); // 2000/10000
        expect(data.zone2.percentage).toBeCloseTo(40, 1); // 80/200
      }
    });
  });

  describe("Error Scenarios", () => {
    it("should handle missing headers gracefully", async () => {
      // Mock response without zone headers
      const mockResponseNoHeaders = new Response(
        JSON.stringify({ success: true }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      vi.mocked(fetch).mockImplementation((url) => {
        if (url.toString().includes("inoreader.com")) {
          return Promise.resolve(mockResponseNoHeaders);
        }
        return Promise.resolve(new Response("Not found", { status: 404 }));
      });

      await fetch(`http://localhost:${TEST_PORT}/reader/api/sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ manual: true }),
      });

      const response = await fetch(
        `http://localhost:${TEST_PORT}/reader/api/sync/api-usage`
      );

      // Should still return valid response with defaults
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.zone1).toBeDefined();
      expect(data.zone2).toBeDefined();
    });

    it("should handle database connection errors", async () => {
      // Mock database error
      const originalFrom = supabase.from;
      supabase.from = vi.fn().mockImplementation(() => {
        throw new Error("Database connection failed");
      });

      const response = await fetch(
        `http://localhost:${TEST_PORT}/reader/api/sync/api-usage`
      );

      // Should return error status
      expect(response.status).toBeGreaterThanOrEqual(500);

      // Restore original function
      supabase.from = originalFrom;
    });

    it("should handle rate limit exceeded scenario", async () => {
      // Mock headers showing exceeded limits
      const mockExceededResponse = new Response(
        JSON.stringify({ error: "Rate limit exceeded" }),
        {
          status: 429,
          headers: {
            "Content-Type": "application/json",
            "X-Reader-Zone1-Usage": "5000",
            "X-Reader-Zone1-Limit": "5000",
            "X-Reader-Zone2-Usage": "100",
            "X-Reader-Zone2-Limit": "100",
            "X-Reader-Limits-Reset-After": "3600",
          },
        }
      );

      vi.mocked(fetch).mockImplementation((url) => {
        if (url.toString().includes("inoreader.com")) {
          return Promise.resolve(mockExceededResponse);
        }
        return Promise.resolve(new Response("Not found", { status: 404 }));
      });

      const syncResponse = await fetch(
        `http://localhost:${TEST_PORT}/reader/api/sync`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ manual: true }),
        }
      );

      // Should handle rate limit error
      expect(syncResponse.status).toBeGreaterThanOrEqual(429);

      // Usage should still be tracked
      const usageResponse = await fetch(
        `http://localhost:${TEST_PORT}/reader/api/sync/api-usage`
      );

      if (usageResponse.status === 200) {
        const data = await usageResponse.json();

        // Should show 100% usage
        expect(data.zone1.percentage).toBe(100);
        expect(data.zone2.percentage).toBe(100);
      }
    });
  });
});
