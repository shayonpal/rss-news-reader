import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { NextApiHandler } from "next";
import fetch from "node-fetch";

// This test verifies the acceptance criteria for RR-119
describe("RR-119 Acceptance Criteria", () => {
  let server: any;
  const PORT = 3149; // Different port to avoid conflicts

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = "test";
    delete process.env.SUPABASE_URL;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    // Create a simple test server
    server = createServer(async (req, res) => {
      if (!req.url) {
        res.statusCode = 404;
        res.end();
        return;
      }

      // Import the actual route handlers
      if (req.url === "/api/health/db") {
        const { GET } = await import("@/app/api/health/db/route");
        const response = await GET(
          new Request(`http://localhost:${PORT}${req.url}`)
        );
        res.statusCode = response.status;
        res.setHeader("Content-Type", "application/json");
        const data = await response.json();
        res.end(JSON.stringify(data));
      } else if (req.url === "/api/health/cron") {
        const { GET } = await import("@/app/api/health/cron/route");
        const response = await GET(
          new Request(`http://localhost:${PORT}${req.url}`)
        );
        res.statusCode = response.status;
        res.setHeader("Content-Type", "application/json");
        const data = await response.json();
        res.end(JSON.stringify(data));
      } else if (req.url === "/api/health/app" || req.url === "/api/health") {
        const { GET } = await import("@/app/api/health/route");
        const response = await GET(
          new Request(`http://localhost:${PORT}${req.url}`)
        );
        res.statusCode = response.status;
        res.setHeader("Content-Type", "application/json");
        const data = await response.json();
        res.end(JSON.stringify(data));
      } else {
        res.statusCode = 404;
        res.end();
      }
    });

    await new Promise<void>((resolve) => {
      server.listen(PORT, resolve);
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(resolve);
    });
  });

  describe("Acceptance Criterion 1: All health endpoints return 200 status even with missing services", () => {
    it("should return 200 for /api/health/db endpoint", async () => {
      const response = await fetch(`http://localhost:${PORT}/api/health/db`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("healthy");
      expect(data.database).toBe("unavailable");
    });

    it("should return 200 for /api/health/cron endpoint", async () => {
      const response = await fetch(`http://localhost:${PORT}/api/health/cron`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("healthy");
      expect(data.message).toContain("skipped");
    });

    it("should return 200 for /api/health/app endpoint", async () => {
      const response = await fetch(`http://localhost:${PORT}/api/health/app`);
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data.status).toBe("healthy");
    });
  });

  describe("Acceptance Criterion 2: Response indicates which services are unavailable", () => {
    it("should indicate database is unavailable in /api/health/db", async () => {
      const response = await fetch(`http://localhost:${PORT}/api/health/db`);
      const data = await response.json();

      expect(data.database).toBe("unavailable");
      expect(data.message).toContain("test environment");
    });

    it("should indicate cron check is skipped in /api/health/cron", async () => {
      const response = await fetch(`http://localhost:${PORT}/api/health/cron`);
      const data = await response.json();

      expect(data.message).toContain("skipped");
      expect(data.lastCheck).toBe(null);
    });

    it("should indicate dependencies are skipped in /api/health/app", async () => {
      const response = await fetch(`http://localhost:${PORT}/api/health/app`);
      const data = await response.json();

      expect(data.dependencies.database).toBe("skipped");
      expect(data.dependencies.oauth).toBe("skipped");
    });
  });

  describe("Acceptance Criterion 3: No 503 errors in test environment", () => {
    const endpoints = [
      "/api/health/db",
      "/api/health/cron",
      "/api/health/app",
      "/api/health",
    ];

    endpoints.forEach((endpoint) => {
      it(`should not return 503 for ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${PORT}${endpoint}`);
        expect(response.status).not.toBe(503);
        expect(response.status).toBe(200);
      });
    });
  });

  describe("Acceptance Criterion 4: All endpoints include environment field", () => {
    const endpoints = ["/api/health/db", "/api/health/cron", "/api/health/app"];

    endpoints.forEach((endpoint) => {
      it(`should include environment field in ${endpoint}`, async () => {
        const response = await fetch(`http://localhost:${PORT}${endpoint}`);
        const data = await response.json();

        expect(data.environment).toBe("test");
      });
    });
  });

  describe("Additional Requirements: Consistent response format", () => {
    it("should include timestamp in all responses", async () => {
      const endpoints = [
        "/api/health/db",
        "/api/health/cron",
        "/api/health/app",
      ];

      for (const endpoint of endpoints) {
        const response = await fetch(`http://localhost:${PORT}${endpoint}`);
        const data = await response.json();

        expect(data.timestamp).toBeDefined();
        expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
      }
    });

    it("should set correct cache headers", async () => {
      const endpoints = ["/api/health/db", "/api/health/cron"];

      for (const endpoint of endpoints) {
        const response = await fetch(`http://localhost:${PORT}${endpoint}`);
        expect(response.headers.get("cache-control")).toBe(
          "no-store, max-age=0"
        );
      }
    });
  });
});
