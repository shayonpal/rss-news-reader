import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { setupTestServer } from "../integration/test-server";
import type { Server } from "http";

const port = 3151; // Different port to avoid conflicts

describe("RR-117: Simple Server Test", () => {
  let server: Server;
  let app: any;

  beforeAll(async () => {
    console.log("Setting up test server...");

    // Set required env vars
    process.env.TOKEN_ENCRYPTION_KEY =
      process.env.TOKEN_ENCRYPTION_KEY ||
      "test-key-32-bytes-long-for-testing!!";

    try {
      const setup = await setupTestServer(port);
      server = setup.server;
      app = setup.app;

      await new Promise<void>((resolve, reject) => {
        server.listen(port, () => {
          console.log(`Test server listening on port ${port}`);
          resolve();
        });

        server.on("error", (err) => {
          console.error("Server error:", err);
          reject(err);
        });
      });

      // Give server time to fully initialize
      await new Promise((resolve) => setTimeout(resolve, 2000));
      console.log("Server setup complete");
    } catch (error) {
      console.error("Failed to setup server:", error);
      throw error;
    }
  }, 60000);

  afterAll(async () => {
    console.log("Cleaning up...");
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it("should be able to fetch from the test server", async () => {
    console.log(`Fetching from http://localhost:${port}/reader/api/health/app`);

    try {
      const response = await fetch(
        `http://localhost:${port}/reader/api/health/app`
      );
      console.log("Response received:", response ? "yes" : "no");
      console.log("Response status:", response?.status);

      expect(response).toBeDefined();
      expect(response.status).toBeDefined();
    } catch (error) {
      console.error("Fetch failed:", error);
      throw error;
    }
  });

  it("should be able to fetch auth status endpoint", async () => {
    console.log(
      `Fetching from http://localhost:${port}/reader/api/auth/inoreader/status`
    );

    try {
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      console.log("Auth response received:", response ? "yes" : "no");
      console.log("Auth response status:", response?.status);

      expect(response).toBeDefined();
      expect(response.status).toBeDefined();

      const data = await response.json();
      console.log("Auth response data:", data);

      expect(data).toHaveProperty("authenticated");
      expect(data).toHaveProperty("status");
    } catch (error) {
      console.error("Auth fetch failed:", error);
      throw error;
    }
  });
});
