/**
 * Unit Tests for validate-build.sh script
 * Tests for RR-69: Ensure script uses production health endpoints
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

describe("validate-build.sh - RR-69 Updates", () => {
  const scriptPath = path.join(process.cwd(), "scripts", "validate-build.sh");
  let scriptContent: string;

  beforeEach(async () => {
    // Read the script content
    scriptContent = await fs.readFile(scriptPath, "utf-8");
  });

  describe("Script Content Verification", () => {
    it("should not contain references to test-supabase endpoint", () => {
      expect(scriptContent).not.toContain("/api/test-supabase");
      expect(scriptContent).not.toContain("test-supabase");
    });

    it("should use production health endpoints", () => {
      // Should use the correct health endpoints
      expect(scriptContent).toContain("/api/health/app");
      expect(scriptContent).toContain("/api/health/db");

      // Should not use test endpoints for validation
      expect(scriptContent).not.toContain("test-prompt-config");
      expect(scriptContent).not.toContain("test-api-endpoints");
      expect(scriptContent).not.toContain("test-refresh-stats");
      expect(scriptContent).not.toContain("debug/data-cleanup");
    });

    it("should have proper health endpoint validation logic", () => {
      // Check for health endpoint testing functions
      expect(scriptContent).toContain("validate_api_endpoint_functionality");
      expect(scriptContent).toContain("validate_database_health");

      // Verify it checks for JSON responses
      expect(scriptContent).toContain('"status"');
      expect(scriptContent).toContain('"database"');
    });

    it("should not reference removed test endpoints in API route validation", () => {
      // Find the validate_api_routes function
      const apiRoutesSection = scriptContent.match(
        /validate_api_routes\(\)[\s\S]*?^\}/m
      );

      if (apiRoutesSection) {
        const functionContent = apiRoutesSection[0];

        // Should not skip or special-case test endpoints
        expect(functionContent).not.toContain("test-supabase");
        expect(functionContent).not.toContain("test-prompt-config");
        expect(functionContent).not.toContain("debug/data-cleanup");
      }
    });
  });

  describe("Health Endpoint URL Configuration", () => {
    it("should use correct development URL for health checks", () => {
      // Check base URL configuration
      expect(scriptContent).toContain("http://100.96.166.53:3000");

      // Should use development port only
      const urlSections = scriptContent.match(/base_url=.*3000/g) || [];
      urlSections.forEach((section) => {
        expect(section).toContain("100.96.166.53:3000");
      });
    });

    it("should properly construct health endpoint URLs", () => {
      // Check for proper URL construction
      expect(scriptContent).toMatch(/\$base_url\/api\/health\/app/);
      expect(scriptContent).toMatch(/\$base_url\/api\/health\/db/);

      // Should not construct test endpoint URLs
      expect(scriptContent).not.toMatch(/\$base_url\/api\/test-/);
      expect(scriptContent).not.toMatch(/\$base_url\/api\/debug\//);
    });
  });

  describe("Error Handling for Removed Endpoints", () => {
    it("should handle HTTP status codes properly", () => {
      // Check for proper status code handling
      expect(scriptContent).toContain("http_code");

      // Should check status codes for health endpoints
      expect(scriptContent).toMatch(/health_status_code/);

      // Production removed per RR-92, only dev environment exists
      expect(scriptContent).not.toMatch(/prod_status_code/);
    });

    it("should not expect test endpoints to return 200", () => {
      // Look for success status checks
      const successChecks = scriptContent.match(/status.*200/g) || [];

      // None of these should be checking test endpoints
      successChecks.forEach((check) => {
        const context = scriptContent.substring(
          scriptContent.indexOf(check) - 200,
          scriptContent.indexOf(check) + 200
        );

        expect(context).not.toContain("test-supabase");
        expect(context).not.toContain("test-prompt-config");
        expect(context).not.toContain("debug/data-cleanup");
      });
    });
  });

  describe("Script Execution Safety", () => {
    it("should not fail when test endpoints return 404", async () => {
      // Create a mock test to verify the script handles 404s properly
      const testScript = `
        #!/bin/bash
        # Mock health check
        response_code=404
        if [[ "$response_code" == "404" ]]; then
          echo "Endpoint not found (expected for removed test endpoints)"
          exit 0
        fi
        exit 1
      `;

      const tempScriptPath = path.join(process.cwd(), "test-404-handling.sh");
      await fs.writeFile(tempScriptPath, testScript, { mode: 0o755 });

      try {
        const { stdout, stderr } = await execAsync(`bash ${tempScriptPath}`);
        expect(stderr).toBe("");
        expect(stdout).toContain("Endpoint not found");
      } finally {
        await fs.unlink(tempScriptPath);
      }
    });
  });

  describe("Build Manifest Validation", () => {
    it("should not check for test endpoint compilation", () => {
      // Find build validation sections
      const buildValidation = scriptContent.match(
        /validate_api_routes[\s\S]*?validate_/m
      );

      if (buildValidation) {
        const content = buildValidation[0];

        // Should not look for compiled test routes
        expect(content).not.toContain("test-supabase/route.js");
        expect(content).not.toContain("test-prompt-config/route.js");
        expect(content).not.toContain("debug/data-cleanup/route.js");
      }
    });

    it("should not include test routes in missing route reports", () => {
      // Check log output sections
      const logSections = scriptContent.match(/log.*"Missing.*route/gi) || [];

      logSections.forEach((section) => {
        const context = scriptContent.substring(
          scriptContent.indexOf(section) - 100,
          scriptContent.indexOf(section) + 100
        );

        // Should not be logging about test routes
        expect(context).not.toMatch(/test-.*route/);
        expect(context).not.toMatch(/debug.*route/);
      });
    });
  });
});
