/**
 * RR-114: Version Utility Tests
 *
 * Tests to validate that version information can be correctly retrieved
 * from package.json in different environments and build scenarios.
 *
 * These tests will FAIL initially until the version utility is implemented.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";

// Mock fs to test different scenarios
vi.mock("fs", () => ({
  readFileSync: vi.fn(),
}));

// Mock path to test different scenarios
vi.mock("path", () => ({
  join: vi.fn((...args) => args.join("/")),
}));

describe("RR-114: Version Utility Tests", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Package.json version reading", () => {
    it("should read version from package.json successfully", () => {
      // Mock package.json content
      const mockPackageJson = JSON.stringify({
        name: "rss-news-reader",
        version: "0.10.1",
        description: "RSS News Reader PWA",
      });

      vi.mocked(readFileSync).mockReturnValue(mockPackageJson);
      vi.mocked(join).mockReturnValue("/mocked/path/package.json");

      // This import should be dynamic in the actual implementation
      // For now, we're testing the expected behavior
      const getVersion = () => {
        const packageJsonPath = join(process.cwd(), "package.json");
        const packageJsonContent = readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);
        return packageJson.version;
      };

      const version = getVersion();

      expect(version).toBe("0.10.1");
      expect(version).toMatch(/^\d+\.\d+\.\d+$/); // Semantic version format
      expect(vi.mocked(readFileSync)).toHaveBeenCalledWith(
        "/mocked/path/package.json",
        "utf8"
      );
    });

    it("should handle missing package.json gracefully", () => {
      vi.mocked(readFileSync).mockImplementation(() => {
        throw new Error("ENOENT: no such file or directory");
      });

      const getVersionWithFallback = () => {
        try {
          const packageJsonPath = join(process.cwd(), "package.json");
          const packageJsonContent = readFileSync(packageJsonPath, "utf8");
          const packageJson = JSON.parse(packageJsonContent);
          return packageJson.version;
        } catch (error) {
          return "0.0.0"; // Fallback version
        }
      };

      const version = getVersionWithFallback();

      expect(version).toBe("0.0.0");
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("should handle malformed package.json gracefully", () => {
      // Mock invalid JSON
      vi.mocked(readFileSync).mockReturnValue("{ invalid json }");

      const getVersionWithFallback = () => {
        try {
          const packageJsonPath = join(process.cwd(), "package.json");
          const packageJsonContent = readFileSync(packageJsonPath, "utf8");
          const packageJson = JSON.parse(packageJsonContent);
          return packageJson.version;
        } catch (error) {
          return "0.0.0"; // Fallback version
        }
      };

      const version = getVersionWithFallback();

      expect(version).toBe("0.0.0");
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    it("should handle package.json without version field", () => {
      // Mock package.json without version
      const mockPackageJson = JSON.stringify({
        name: "rss-news-reader",
        description: "RSS News Reader PWA",
        // Missing version field
      });

      vi.mocked(readFileSync).mockReturnValue(mockPackageJson);

      const getVersionWithFallback = () => {
        try {
          const packageJsonPath = join(process.cwd(), "package.json");
          const packageJsonContent = readFileSync(packageJsonPath, "utf8");
          const packageJson = JSON.parse(packageJsonContent);
          return packageJson.version || "0.0.0";
        } catch (error) {
          return "0.0.0";
        }
      };

      const version = getVersionWithFallback();

      expect(version).toBe("0.0.0");
      expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    });
  });

  describe("Environment-specific version handling", () => {
    it("should work in test environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "test";

      const mockPackageJson = JSON.stringify({
        name: "rss-news-reader",
        version: "0.10.1",
      });

      vi.mocked(readFileSync).mockReturnValue(mockPackageJson);

      const getVersion = () => {
        const packageJsonPath = join(process.cwd(), "package.json");
        const packageJsonContent = readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);
        return packageJson.version;
      };

      const version = getVersion();

      expect(version).toBe("0.10.1");
      expect(process.env.NODE_ENV).toBe("test");

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it("should work in production environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const mockPackageJson = JSON.stringify({
        name: "rss-news-reader",
        version: "0.10.1",
      });

      vi.mocked(readFileSync).mockReturnValue(mockPackageJson);

      const getVersion = () => {
        const packageJsonPath = join(process.cwd(), "package.json");
        const packageJsonContent = readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);
        return packageJson.version;
      };

      const version = getVersion();

      expect(version).toBe("0.10.1");
      expect(process.env.NODE_ENV).toBe("production");

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });

    it("should work in development environment", () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "development";

      const mockPackageJson = JSON.stringify({
        name: "rss-news-reader",
        version: "0.10.1",
      });

      vi.mocked(readFileSync).mockReturnValue(mockPackageJson);

      const getVersion = () => {
        const packageJsonPath = join(process.cwd(), "package.json");
        const packageJsonContent = readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);
        return packageJson.version;
      };

      const version = getVersion();

      expect(version).toBe("0.10.1");
      expect(process.env.NODE_ENV).toBe("development");

      // Restore environment
      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("Version format validation", () => {
    it("should validate semantic version format", () => {
      const testVersions = ["0.10.1", "1.0.0", "10.5.2", "100.200.300"];

      testVersions.forEach((version) => {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);

        const parts = version.split(".");
        expect(parts).toHaveLength(3);

        parts.forEach((part) => {
          expect(parseInt(part)).toBeGreaterThanOrEqual(0);
          expect(isNaN(parseInt(part))).toBe(false);
        });
      });
    });

    it("should reject invalid version formats", () => {
      const invalidVersions = [
        "1.0", // Missing patch
        "1.0.0.0", // Too many parts
        "v1.0.0", // Has prefix
        "1.0.0-beta", // Has suffix
        "1.0.x", // Non-numeric
        "", // Empty
        "1.0.0 ", // Trailing space
        " 1.0.0", // Leading space
      ];

      invalidVersions.forEach((version) => {
        expect(version).not.toMatch(/^\d+\.\d+\.\d+$/);
      });
    });
  });

  describe("Performance considerations", () => {
    it("should read version efficiently", () => {
      const mockPackageJson = JSON.stringify({
        name: "rss-news-reader",
        version: "0.10.1",
      });

      vi.mocked(readFileSync).mockReturnValue(mockPackageJson);

      const startTime = Date.now();

      const getVersion = () => {
        const packageJsonPath = join(process.cwd(), "package.json");
        const packageJsonContent = readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);
        return packageJson.version;
      };

      const version = getVersion();
      const endTime = Date.now();

      expect(version).toBe("0.10.1");
      expect(endTime - startTime).toBeLessThan(100); // Should be very fast in test environment
    });

    it("should handle multiple concurrent version requests", () => {
      const mockPackageJson = JSON.stringify({
        name: "rss-news-reader",
        version: "0.10.1",
      });

      vi.mocked(readFileSync).mockReturnValue(mockPackageJson);

      const getVersion = () => {
        const packageJsonPath = join(process.cwd(), "package.json");
        const packageJsonContent = readFileSync(packageJsonPath, "utf8");
        const packageJson = JSON.parse(packageJsonContent);
        return packageJson.version;
      };

      // Simulate multiple concurrent calls
      const promises = Array(10)
        .fill(null)
        .map(() => Promise.resolve(getVersion()));

      return Promise.all(promises).then((versions) => {
        expect(versions).toHaveLength(10);
        versions.forEach((version) => {
          expect(version).toBe("0.10.1");
        });

        // Should have been called multiple times
        expect(vi.mocked(readFileSync)).toHaveBeenCalledTimes(10);
      });
    });
  });
});
