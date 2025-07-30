import { describe, it, expect } from "vitest";
import { existsSync } from "fs";
import { join } from "path";

/**
 * Integration tests for RR-71: API Route Cleanup
 * Tests that auth API routes are deleted and functional routes remain
 */

describe("RR-71: API Route Cleanup", () => {
  const srcPath = join(process.cwd(), "src");

  describe("Deleted Auth Routes Should Not Exist", () => {
    const deletedRoutes = [
      "app/api/auth/inoreader/authorize/route.ts",
      "app/api/auth/inoreader/logout/route.ts",
      "app/api/auth/inoreader/refresh/route.ts",
      "app/api/auth/inoreader/status/route.ts",
      "app/api/auth/callback/inoreader/route.ts",
    ];

    deletedRoutes.forEach((route) => {
      it(`should not have route file: ${route}`, () => {
        const routePath = join(srcPath, route);
        expect(existsSync(routePath)).toBe(false);
      });
    });

    it("should not have auth directory at all", () => {
      const authDir = join(srcPath, "app/api/auth");
      expect(existsSync(authDir)).toBe(false);
    });
  });

  describe("Preserved API Routes Should Still Exist", () => {
    const preservedRoutes = [
      "app/api/sync/route.ts",
      "app/api/health/app/route.ts",
      "app/api/health/db/route.ts",
      "app/api/health/freshness/route.ts",
      "app/api/health/route.ts",
    ];

    preservedRoutes.forEach((route) => {
      it(`should still have route file: ${route}`, () => {
        const routePath = join(srcPath, route);
        expect(existsSync(routePath)).toBe(true);
      });
    });
  });

  describe("HTTP Client Should Not Have Auth Code", () => {
    it("should not import auth store in client.ts", () => {
      const fs = require("fs");
      const path = require("path");
      const clientPath = path.join(process.cwd(), "src/lib/api/client.ts");
      const clientContent = fs.readFileSync(clientPath, "utf-8");

      // Should not contain auth store references
      expect(clientContent).not.toMatch(/auth-store|useAuthStore/i);
    });

    it("should not have refresh token interceptor logic", () => {
      const fs = require("fs");
      const path = require("path");
      const clientPath = path.join(process.cwd(), "src/lib/api/client.ts");
      const clientContent = fs.readFileSync(clientPath, "utf-8");

      // Should not contain refresh endpoint calls
      expect(clientContent).not.toMatch(/\/api\/auth\/inoreader\/refresh/);
      expect(clientContent).not.toMatch(/useAuthStore.*logout/);
    });
  });
});
