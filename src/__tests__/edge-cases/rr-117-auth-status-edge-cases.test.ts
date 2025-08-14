/**
 * Edge Cases and Error Handling Tests for RR-117: Auth Status Endpoint
 *
 * Comprehensive edge case testing for the /api/auth/inoreader/status endpoint,
 * covering unusual scenarios, boundary conditions, and error recovery.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";
import fs from "fs/promises";
import path from "path";

// Mock fs module
vi.mock("fs/promises");
const mockFs = vi.mocked(fs);

// Mock crypto operations if needed
vi.mock("crypto", () => ({
  createDecipheriv: vi.fn(),
  timingSafeEqual: vi.fn(),
}));

describe("RR-117: Auth Status Endpoint Edge Cases", () => {
  let GET: (request: NextRequest) => Promise<Response>;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.HOME = "/Users/shayon";
    process.env.TOKEN_ENCRYPTION_KEY = "test-key-32-chars-long-for-aes256";
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("Boundary Conditions", () => {
    it("should handle token file with exactly 365 days age", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: "data" }));

      // Exactly 365 days ago
      const exactExpiryDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
      mockFs.stat.mockResolvedValue({ mtime: exactExpiryDate } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("expired");
      expect(data.tokenAge).toBe(365);
      expect(data.daysRemaining).toBe(0);
    });

    it("should handle token file with exactly 30 days remaining", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: "data" }));

      // Exactly 335 days ago (30 days remaining)
      const warningThresholdDate = new Date(
        Date.now() - 335 * 24 * 60 * 60 * 1000
      );
      mockFs.stat.mockResolvedValue({ mtime: warningThresholdDate } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(true);
      expect(data.status).toBe("expiring_soon");
      expect(data.tokenAge).toBe(335);
      expect(data.daysRemaining).toBe(30);
    });

    it("should handle very large token files (simulating memory pressure)", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);

      // Simulate reading a very large file
      const largeTokenData = {
        encrypted: "a".repeat(1024 * 1024), // 1MB of data
      };
      mockFs.readFile.mockResolvedValue(JSON.stringify(largeTokenData));
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(true);
      expect(data.status).toBe("valid");
    });

    it("should handle zero-byte token file", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue("");

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("invalid_format");
      expect(data.message).toContain("invalid JSON");
    });
  });

  describe("Unusual File System States", () => {
    it("should handle token file that exists but is a directory", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(
        new Error("EISDIR: illegal operation on a directory")
      );

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("error");
      expect(data.message).toContain("Unable to read token file");
    });

    it("should handle symbolic link to non-existent file", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(
        new Error("ENOENT: no such file or directory")
      );

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("error");
      expect(data.message).toContain("Unable to read token file");
    });

    it("should handle token file with unusual permissions", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error("EACCES: permission denied"));

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("error");
      expect(data.message).toContain("permission denied");
    });

    it("should handle stat() failure while file is readable", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: "data" }));
      mockFs.stat.mockRejectedValue(new Error("EACCES: permission denied"));

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("error");
      expect(data.message).toContain("Unable to check token age");
    });
  });

  describe("Malformed JSON Edge Cases", () => {
    it("should handle JSON with Unicode escape sequences", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(
        '{"encrypted": "\\u0041\\u0042\\u0043"}'
      );
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(true);
      expect(data.status).toBe("valid");
    });

    it("should handle JSON with nested objects", async () => {
      // Arrange
      const complexTokenData = {
        encrypted: "valid-data",
        metadata: {
          created: "2024-01-01",
          version: "1.0",
          nested: {
            deep: "value",
          },
        },
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(complexTokenData));
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(true);
      expect(data.status).toBe("valid");
    });

    it("should handle JSON with arrays", async () => {
      // Arrange
      const arrayTokenData = {
        encrypted: "valid-data",
        scopes: ["read", "write"],
        history: [
          { action: "created", date: "2024-01-01" },
          { action: "refreshed", date: "2024-01-15" },
        ],
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(arrayTokenData));
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(true);
      expect(data.status).toBe("valid");
    });

    it("should handle JSON with null values", async () => {
      // Arrange
      const nullTokenData = {
        encrypted: "valid-data",
        expires_at: null,
        last_used: null,
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(nullTokenData));
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(true);
      expect(data.status).toBe("valid");
    });

    it("should handle JSON with boolean and number values", async () => {
      // Arrange
      const mixedTokenData = {
        encrypted: "valid-data",
        active: true,
        version: 2,
        rate_limit: 100.5,
      };

      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify(mixedTokenData));
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(true);
      expect(data.status).toBe("valid");
    });
  });

  describe("Environment Variable Edge Cases", () => {
    it("should handle HOME pointing to non-existent directory", async () => {
      // Arrange
      process.env.HOME = "/non/existent/directory";
      mockFs.access.mockRejectedValue(
        new Error("ENOENT: no such file or directory")
      );

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("no_tokens");
      expect(data.message).toContain("OAuth token file not found");
    });

    it("should handle HOME with special characters", async () => {
      // Arrange
      process.env.HOME = "/Users/test user with spaces/special-chars!@#$%";
      mockFs.access.mockRejectedValue(new Error("ENOENT"));

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
    });

    it("should handle very short TOKEN_ENCRYPTION_KEY", async () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = "short";
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: "data" }));
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("config_error");
      expect(data.message).toContain("configuration");
    });

    it("should handle TOKEN_ENCRYPTION_KEY with special characters", async () => {
      // Arrange
      process.env.TOKEN_ENCRYPTION_KEY = "key-with-special-chars-!@#$%^&*()";
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: "data" }));
      mockFs.stat.mockResolvedValue({ mtime: new Date() } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      // Should either be valid or have config error depending on implementation
      expect(["valid", "config_error"]).toContain(data.status);
    });
  });

  describe("Time and Date Edge Cases", () => {
    it("should handle system clock changes (future date)", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: "data" }));

      // File modified in the future (clock was changed)
      const futureDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
      mockFs.stat.mockResolvedValue({ mtime: futureDate } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.tokenAge).toBeLessThanOrEqual(0); // Negative or zero age
      expect(data.daysRemaining).toBeGreaterThanOrEqual(365); // More than normal max
    });

    it("should handle very old file dates (before Unix epoch)", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: "data" }));

      // Very old date (before 1970)
      const ancientDate = new Date("1960-01-01");
      mockFs.stat.mockResolvedValue({ mtime: ancientDate } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("expired");
      expect(data.tokenAge).toBeGreaterThan(365);
    });

    it("should handle daylight saving time transitions", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockResolvedValue(JSON.stringify({ encrypted: "data" }));

      // Date during DST transition (this is complex to test precisely)
      const dstDate = new Date("2024-03-10T02:30:00"); // Spring forward
      mockFs.stat.mockResolvedValue({ mtime: dstDate } as any);

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(typeof data.tokenAge).toBe("number");
      expect(typeof data.daysRemaining).toBe("number");
    });
  });

  describe("Memory and Resource Constraints", () => {
    it("should handle out-of-memory conditions gracefully", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(new Error("Cannot allocate memory"));

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("error");
    });

    it("should handle file system full conditions", async () => {
      // Arrange
      mockFs.access.mockResolvedValue(undefined);
      mockFs.readFile.mockRejectedValue(
        new Error("ENOSPC: no space left on device")
      );

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("error");
    });

    it("should handle network filesystem timeouts", async () => {
      // Arrange
      mockFs.access.mockImplementation(
        () =>
          new Promise((_, reject) => {
            setTimeout(
              () => reject(new Error("ETIMEDOUT: operation timed out")),
              100
            );
          })
      );

      const { GET: handler } = await import(
        "@/app/api/auth/inoreader/status/route"
      );
      GET = handler;

      const request = new NextRequest(
        "http://localhost:3000/api/auth/inoreader/status"
      );

      // Act
      const response = await GET(request);
      const data = await response.json();

      // Assert
      expect(response.status).toBe(200);
      expect(data.authenticated).toBe(false);
      expect(data.status).toBe("no_tokens");
    });
  });
});
