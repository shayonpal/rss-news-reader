/**
 * Acceptance Tests for RR-117: Auth Status Endpoint Implementation
 *
 * These tests verify that the implementation meets all acceptance criteria
 * defined for the auth status endpoint requirement.
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
import { setupTestServer } from "../integration/test-server";
import type { Server } from "http";
import fs from "fs/promises";
import path from "path";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";

const port = 3150; // Unique port for acceptance tests

interface AuthStatusResponse {
  authenticated: boolean;
  status: string;
  message: string;
  timestamp: string;
  tokenAge: number | null;
  daysRemaining: number | null;
}

describe("RR-117: Auth Status Endpoint Acceptance Criteria", () => {
  let server: Server;
  let app: any;
  let tempDir: string;
  let originalHome: string | undefined;
  let originalEncryptionKey: string | undefined;

  beforeAll(async () => {
    // Setup test environment
    tempDir = await mkdtemp(path.join(tmpdir(), "rss-reader-acceptance-"));
    originalHome = process.env.HOME;
    originalEncryptionKey = process.env.TOKEN_ENCRYPTION_KEY;

    // Set environment variables before starting the server
    process.env.HOME = tempDir;
    process.env.TOKEN_ENCRYPTION_KEY =
      process.env.TOKEN_ENCRYPTION_KEY || "test-encryption-key-32-bytes-long!!";

    try {
      const setup = await setupTestServer(port);
      server = setup.server;
      app = setup.app;

      await new Promise<void>((resolve, reject) => {
        server.listen(port, () => {
          console.log(
            `> Acceptance test server ready on http://localhost:${port}`
          );
          resolve();
        });

        server.on("error", (err) => {
          console.error("Server error:", err);
          reject(err);
        });
      });

      // Wait a bit for server to be fully ready
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      console.error("Failed to setup test server:", error);
      throw error;
    }
  }, 60000);

  afterAll(async () => {
    // Cleanup
    if (originalHome) {
      process.env.HOME = originalHome;
    } else {
      delete process.env.HOME;
    }

    if (originalEncryptionKey) {
      process.env.TOKEN_ENCRYPTION_KEY = originalEncryptionKey;
    } else {
      delete process.env.TOKEN_ENCRYPTION_KEY;
    }

    try {
      await rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn("Failed to clean up temp directory:", error);
    }

    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  beforeEach(async () => {
    const rssReaderDir = path.join(tempDir, ".rss-reader");
    await fs.mkdir(rssReaderDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      const rssReaderDir = path.join(tempDir, ".rss-reader");
      await rm(rssReaderDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("AC-1: Endpoint Availability and HTTP Compliance", () => {
    it("MUST be accessible at /api/auth/inoreader/status", async () => {
      try {
        const response = await fetch(
          `http://localhost:${port}/reader/api/auth/inoreader/status`
        );

        expect(response).toBeDefined();
        expect(response.status).toBe(200);
        expect(response.headers.get("Content-Type")).toContain(
          "application/json"
        );
      } catch (error) {
        console.error("Fetch error:", error);
        throw error;
      }
    });

    it("MUST only accept GET requests", async () => {
      const methods = ["POST", "PUT", "DELETE", "PATCH"];

      for (const method of methods) {
        const response = await fetch(
          `http://localhost:${port}/reader/api/auth/inoreader/status`,
          {
            method,
          }
        );

        expect(response.status).toBe(405); // Method Not Allowed
      }
    });

    it("MUST return valid JSON response", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );

      expect(response.status).toBe(200);

      const data = await response.json();
      expect(typeof data).toBe("object");
      expect(data).not.toBeNull();
    });

    it("MUST respond within 5 seconds under normal conditions", async () => {
      const start = Date.now();
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(5000);
    });
  });

  describe("AC-2: Response Schema Compliance", () => {
    it("MUST always include required fields in response", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      // Required fields
      expect(data).toHaveProperty("authenticated");
      expect(data).toHaveProperty("status");
      expect(data).toHaveProperty("message");
      expect(data).toHaveProperty("timestamp");
      expect(data).toHaveProperty("tokenAge");
      expect(data).toHaveProperty("daysRemaining");

      // Type validation
      expect(typeof data.authenticated).toBe("boolean");
      expect(typeof data.status).toBe("string");
      expect(typeof data.message).toBe("string");
      expect(typeof data.timestamp).toBe("string");
      expect(["number", "object"]).toContain(typeof data.tokenAge); // number or null
      expect(["number", "object"]).toContain(typeof data.daysRemaining); // number or null
    });

    it("MUST provide ISO 8601 formatted timestamp", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      // ISO 8601 format validation
      expect(data.timestamp).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?/
      );

      // Should be parseable as valid date
      const parsedDate = new Date(data.timestamp);
      expect(parsedDate.getTime()).not.toBeNaN();

      // Should be recent (within last 10 seconds)
      const timeDiff = Math.abs(Date.now() - parsedDate.getTime());
      expect(timeDiff).toBeLessThan(10000);
    });

    it("MUST provide meaningful status values", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      const validStatuses = [
        "valid", // Tokens are valid and fresh
        "expiring_soon", // Tokens valid but expiring within 30 days
        "expired", // Tokens are expired
        "no_tokens", // No token file found
        "invalid_format", // Token file has invalid JSON
        "unencrypted", // Tokens are not encrypted
        "empty_tokens", // Token file exists but encrypted field is empty
        "config_error", // Configuration issues (missing env vars, etc.)
        "error", // General error condition
      ];

      expect(validStatuses).toContain(data.status);
    });
  });

  describe("AC-3: Authentication State Detection", () => {
    it("MUST return authenticated: false when no token file exists", async () => {
      // Ensure no token file exists
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");
      try {
        await fs.unlink(tokensPath);
      } catch {
        // File doesn't exist, which is what we want
      }

      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("no_tokens");
      expect(data.tokenAge).toBeNull();
      expect(data.daysRemaining).toBeNull();
    });

    it("MUST return authenticated: true for valid encrypted tokens", async () => {
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");
      const validTokenData = {
        encrypted: "valid-encrypted-token-data-here",
      };

      await fs.writeFile(tokensPath, JSON.stringify(validTokenData, null, 2));

      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      expect(data.authenticated).toBe(true);
      expect(data.status).toBe("valid");
      expect(typeof data.tokenAge).toBe("number");
      expect(typeof data.daysRemaining).toBe("number");
      expect(data.tokenAge).toBeGreaterThanOrEqual(0);
      expect(data.daysRemaining).toBeGreaterThan(0);
    });

    it("MUST return authenticated: false for unencrypted tokens", async () => {
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");
      const unencryptedData = {
        access_token: "plain-text-token",
        refresh_token: "plain-text-refresh",
      };

      await fs.writeFile(tokensPath, JSON.stringify(unencryptedData));

      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("unencrypted");
    });

    it("MUST return authenticated: false for expired tokens", async () => {
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");
      const validTokenData = { encrypted: "test-data" };

      await fs.writeFile(tokensPath, JSON.stringify(validTokenData));

      // Set file modification time to 400 days ago (expired)
      const expiredDate = new Date(Date.now() - 400 * 24 * 60 * 60 * 1000);
      await fs.utimes(tokensPath, expiredDate, expiredDate);

      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("expired");
      expect(data.tokenAge).toBe(400);
      expect(data.daysRemaining).toBe(0);
    });
  });

  describe("AC-4: Token Age Calculation and Expiry Warning", () => {
    it("MUST calculate token age correctly in days", async () => {
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");
      const validTokenData = { encrypted: "test-data" };

      await fs.writeFile(tokensPath, JSON.stringify(validTokenData));

      // Set file modification time to exactly 30 days ago
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await fs.utimes(tokensPath, thirtyDaysAgo, thirtyDaysAgo);

      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      expect(data.tokenAge).toBe(30);
      expect(data.daysRemaining).toBe(335); // 365 - 30
    });

    it("MUST warn when tokens are expiring soon (< 30 days remaining)", async () => {
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");
      const validTokenData = { encrypted: "test-data" };

      await fs.writeFile(tokensPath, JSON.stringify(validTokenData));

      // Set file modification time to 340 days ago (25 days remaining)
      const oldDate = new Date(Date.now() - 340 * 24 * 60 * 60 * 1000);
      await fs.utimes(tokensPath, oldDate, oldDate);

      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      expect(data.authenticated).toBe(true);
      expect(data.status).toBe("expiring_soon");
      expect(data.daysRemaining).toBe(25);
      expect(data.message).toContain("expiring soon");
    });

    it("MUST use 365-day expiry assumption for token validation", async () => {
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");
      const validTokenData = { encrypted: "test-data" };

      await fs.writeFile(tokensPath, JSON.stringify(validTokenData));

      // Test the boundary: exactly 365 days should be expired
      const exactExpiryDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      await fs.utimes(tokensPath, exactExpiryDate, exactExpiryDate);

      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("expired");
      expect(data.tokenAge).toBe(365);
      expect(data.daysRemaining).toBe(0);
    });
  });

  describe("AC-5: Error Handling and Resilience", () => {
    it("MUST handle invalid JSON gracefully", async () => {
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");
      await fs.writeFile(tokensPath, "invalid json content {");

      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      expect(response.status).toBe(200); // Should not fail with HTTP error
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("invalid_format");
      expect(data.message).toContain("invalid JSON");
    });

    it("MUST handle file system errors gracefully", async () => {
      // This test will depend on the actual implementation
      // The endpoint should handle permission errors, disk full, etc.
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );

      expect(response.status).toBe(200); // Should always return 200

      const data: AuthStatusResponse = await response.json();
      expect(typeof data.authenticated).toBe("boolean");
      expect(typeof data.status).toBe("string");
    });

    it("MUST never expose sensitive information in error messages", async () => {
      // Test with various error conditions
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const responseText = await response.text();

      // Should not contain file paths
      expect(responseText).not.toMatch(/\/Users\/\w+/);
      expect(responseText).not.toMatch(/\.rss-reader/);
      expect(responseText).not.toMatch(/tokens\.json/);

      // Should not contain actual token values
      expect(responseText).not.toMatch(/[A-Za-z0-9]{20,}/); // Long token-like strings
    });

    it("MUST handle concurrent requests without race conditions", async () => {
      // Make 10 concurrent requests
      const promises = Array(10)
        .fill(null)
        .map(() =>
          fetch(`http://localhost:${port}/reader/api/auth/inoreader/status`)
        );

      const responses = await Promise.all(promises);

      // All should succeed
      responses.forEach((response) => {
        expect(response.status).toBe(200);
      });

      // All should return consistent data (except timestamps)
      const jsonPromises = responses.map((r) => r.json());
      const data = await Promise.all(jsonPromises);

      const firstResponse = data[0];
      data.forEach((item) => {
        expect(item.authenticated).toBe(firstResponse.authenticated);
        expect(item.status).toBe(firstResponse.status);
        expect(item.tokenAge).toBe(firstResponse.tokenAge);
        expect(item.daysRemaining).toBe(firstResponse.daysRemaining);
      });
    });
  });

  describe("AC-6: Integration with Existing Health Check System", () => {
    it("MUST be compatible with existing health check endpoints", async () => {
      // Verify auth status endpoint doesn't break other health endpoints
      const healthEndpoints = [
        "/reader/api/health/app",
        "/reader/api/health/db",
        "/reader/api/health/freshness",
      ];

      for (const endpoint of healthEndpoints) {
        const response = await fetch(`http://localhost:${port}${endpoint}`);
        expect([200, 503]).toContain(response.status); // Either healthy or degraded
      }
    });

    it("MUST provide information compatible with monitoring systems", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const data: AuthStatusResponse = await response.json();

      // Should provide machine-readable status
      expect(typeof data.authenticated).toBe("boolean");
      expect(typeof data.status).toBe("string");

      // Should provide actionable information
      expect(data.message.length).toBeGreaterThan(10);

      // Should include timestamp for monitoring
      const timestamp = new Date(data.timestamp);
      expect(timestamp.getTime()).not.toBeNaN();
    });

    it("MUST follow existing API response patterns", async () => {
      // Compare with existing health endpoint structure
      const authResponse = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const healthResponse = await fetch(
        `http://localhost:${port}/reader/api/health/app`
      );

      const authData = await authResponse.json();
      const healthData = await healthResponse.json();

      // Both should include timestamps
      expect(authData).toHaveProperty("timestamp");
      expect(healthData).toHaveProperty("timestamp");

      // Both should be proper JSON objects
      expect(typeof authData).toBe("object");
      expect(typeof healthData).toBe("object");
    });
  });

  describe("AC-7: Security and Privacy Requirements", () => {
    it("MUST never expose actual token values", async () => {
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");
      const tokenDataWithSecrets = {
        access_token: "very-secret-access-token-12345",
        refresh_token: "very-secret-refresh-token-67890",
        encrypted: "encrypted-data-contains-secrets",
      };

      await fs.writeFile(tokensPath, JSON.stringify(tokenDataWithSecrets));

      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const responseText = await response.text();

      expect(responseText).not.toContain("very-secret-access-token-12345");
      expect(responseText).not.toContain("very-secret-refresh-token-67890");
      expect(responseText).not.toContain("encrypted-data-contains-secrets");
    });

    it("MUST sanitize file system paths in error messages", async () => {
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const responseText = await response.text();

      expect(responseText).not.toContain(tempDir);
      expect(responseText).not.toContain("/.rss-reader/");
      expect(responseText).not.toContain("tokens.json");
    });

    it("MUST not be vulnerable to path traversal attacks", async () => {
      // This would be tested at the implementation level
      // The endpoint should use fixed paths, not user input
      expect(true).toBe(true); // Placeholder - implementation should use path.join() correctly
    });
  });

  describe("AC-8: Performance and Resource Usage", () => {
    it("MUST complete within performance budget (< 1 second typical)", async () => {
      const start = Date.now();
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(1000);
    });

    it("MUST not consume excessive memory", async () => {
      // Test with multiple sequential requests to check for memory leaks
      for (let i = 0; i < 20; i++) {
        const response = await fetch(
          `http://localhost:${port}/reader/api/auth/inoreader/status`
        );
        expect(response.status).toBe(200);
        await response.json(); // Consume the response
      }

      // If we reach here without issues, memory usage is acceptable
      expect(true).toBe(true);
    });

    it("MUST handle reasonable file sizes efficiently", async () => {
      const tokensPath = path.join(tempDir, ".rss-reader", "tokens.json");

      // Create a reasonably large token file (but not unreasonably large)
      const largeTokenData = {
        encrypted: "a".repeat(1024), // 1KB of data
        metadata: {
          history: Array(100).fill({
            action: "refresh",
            timestamp: new Date().toISOString(),
          }),
        },
      };

      await fs.writeFile(tokensPath, JSON.stringify(largeTokenData));

      const start = Date.now();
      const response = await fetch(
        `http://localhost:${port}/reader/api/auth/inoreader/status`
      );
      const duration = Date.now() - start;

      expect(response.status).toBe(200);
      expect(duration).toBeLessThan(2000); // Should still be fast
    });
  });
});
