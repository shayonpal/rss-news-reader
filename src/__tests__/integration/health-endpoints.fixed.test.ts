/**
 * Integration Tests for Health Endpoints
 * Ensures health monitoring still works after removing test endpoints (RR-69)
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { parse } from "url";
import next from "next";

const dev = process.env.NODE_ENV !== "production";
const port = 3148; // Use different port for testing

describe("Health Endpoints - Post RR-69 Verification", () => {
  let server: any;
  let app: any;

  beforeAll(async () => {
    // Start Next.js server for testing with basePath configuration
    // CRITICAL FIX: Use separate build directory to avoid webpack collision
    app = next({
      dev,
      dir: process.cwd(),
      conf: {
        basePath: "/reader",
        distDir: ".next-test", // <-- THIS IS THE FIX!
      },
    });
    const handle = app.getRequestHandler();
    await app.prepare();

    server = createServer((req, res) => {
      const parsedUrl = parse(req.url!, true);
      handle(req, res, parsedUrl);
    });

    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        console.log(`> Test server ready on http://localhost:${port}`);
        resolve();
      });
    });
  }, 30000); // Increase timeout for server startup

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
    // Clean up test build directory
    const { execSync } = require("child_process");
    execSync("rm -rf .next-test", { stdio: "ignore" });
  });

  // Rest of the tests remain the same...
  describe("Production Health Endpoints", () => {
    it("should return 200 for /reader/api/health/app", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/health/app`
      );
      expect(response.status).toBe(200);

      const data = await response.json();
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("version");
    });

    // ... rest of tests
  });
});
