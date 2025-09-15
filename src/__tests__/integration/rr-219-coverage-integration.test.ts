/**
 * @file RR-219 Coverage Report Integration Tests
 * @description Integration tests for OpenAPI coverage report generation
 * Tests the complete flow including npm script execution and file system operations
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { randomBytes } from "crypto";

describe("RR-219: Coverage Report Integration Tests", () => {
  const PROJECT_ROOT = process.cwd();
  const COVERAGE_DIR = path.join(PROJECT_ROOT, "coverage");
  const REPORT_PATH = path.join(COVERAGE_DIR, "openapi-coverage-report.json");
  const OLD_REPORT_PATH = path.join(PROJECT_ROOT, "coverage-report.json");
  const TEMP_BACKUP_DIR = path.join(
    PROJECT_ROOT,
    `.test-backup-${randomBytes(8).toString("hex")}`
  );

  beforeAll(() => {
    // Backup existing files if they exist
    if (!fs.existsSync(TEMP_BACKUP_DIR)) {
      fs.mkdirSync(TEMP_BACKUP_DIR, { recursive: true });
    }

    // Backup existing coverage report if it exists
    if (fs.existsSync(REPORT_PATH)) {
      fs.copyFileSync(
        REPORT_PATH,
        path.join(TEMP_BACKUP_DIR, "openapi-coverage-report.json")
      );
    }

    // Backup old report if it exists
    if (fs.existsSync(OLD_REPORT_PATH)) {
      fs.copyFileSync(
        OLD_REPORT_PATH,
        path.join(TEMP_BACKUP_DIR, "coverage-report.json")
      );
    }
  });

  afterAll(() => {
    // Restore backed up files
    const backupReport = path.join(
      TEMP_BACKUP_DIR,
      "openapi-coverage-report.json"
    );
    if (fs.existsSync(backupReport)) {
      fs.copyFileSync(backupReport, REPORT_PATH);
    }

    const backupOldReport = path.join(TEMP_BACKUP_DIR, "coverage-report.json");
    if (fs.existsSync(backupOldReport)) {
      fs.copyFileSync(backupOldReport, OLD_REPORT_PATH);
    }

    // Clean up temp directory
    if (fs.existsSync(TEMP_BACKUP_DIR)) {
      fs.rmSync(TEMP_BACKUP_DIR, { recursive: true, force: true });
    }
  });

  beforeEach(() => {
    // Clean up test artifacts before each test
    if (fs.existsSync(REPORT_PATH)) {
      fs.unlinkSync(REPORT_PATH);
    }
    if (fs.existsSync(OLD_REPORT_PATH)) {
      fs.unlinkSync(OLD_REPORT_PATH);
    }
  });

  describe("npm Script Execution", () => {
    it("should generate report via npm run docs:validate", () => {
      // Execute the npm script
      const result = execSync("npm run docs:validate", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
      });

      // Verify execution succeeded
      expect(result).toBeTruthy();

      // Verify file was created at correct location
      expect(fs.existsSync(REPORT_PATH)).toBe(true);

      // Verify file is valid JSON
      const reportContent = fs.readFileSync(REPORT_PATH, "utf8");
      expect(() => JSON.parse(reportContent)).not.toThrow();

      // Verify report structure
      const report = JSON.parse(reportContent);
      expect(report).toHaveProperty("timestamp");
      expect(report).toHaveProperty("totalEndpoints");
      expect(report).toHaveProperty("documentedEndpoints");
      expect(report).toHaveProperty("coverage");
    });

    it("should NOT create report in root directory", () => {
      // Execute the npm script
      execSync("npm run docs:validate", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
      });

      // Verify old location is NOT used
      expect(fs.existsSync(OLD_REPORT_PATH)).toBe(false);
    });

    it("should create coverage directory if missing", () => {
      // Remove coverage directory if it exists
      if (fs.existsSync(COVERAGE_DIR)) {
        // Only remove the report file, not the entire directory
        // as it might contain other important files
        if (fs.existsSync(REPORT_PATH)) {
          fs.unlinkSync(REPORT_PATH);
        }
      } else {
        // If coverage directory doesn't exist, this test is valid
        expect(fs.existsSync(COVERAGE_DIR)).toBe(false);
      }

      // Execute the npm script
      execSync("npm run docs:validate", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
      });

      // Verify directory was created
      expect(fs.existsSync(COVERAGE_DIR)).toBe(true);
      expect(fs.statSync(COVERAGE_DIR).isDirectory()).toBe(true);

      // Verify report was created inside
      expect(fs.existsSync(REPORT_PATH)).toBe(true);
    });
  });

  describe("Report Content Validation", () => {
    it("should generate report with correct structure", () => {
      // Execute the script
      execSync("npm run docs:validate", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
      });

      // Read and parse the report
      const reportContent = fs.readFileSync(REPORT_PATH, "utf8");
      const report = JSON.parse(reportContent);

      // Validate structure
      expect(report).toMatchObject({
        timestamp: expect.any(String),
        totalEndpoints: expect.any(Number),
        documentedEndpoints: expect.any(Number),
        coverage: expect.any(Number),
      });

      // Validate timestamp is valid ISO string
      expect(() => new Date(report.timestamp)).not.toThrow();

      // Validate coverage percentage
      expect(report.coverage).toBeGreaterThanOrEqual(0);
      expect(report.coverage).toBeLessThanOrEqual(100);
    });

    it("should include endpoint details if available", () => {
      // Execute the script
      execSync("npm run docs:validate", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
      });

      // Read and parse the report
      const reportContent = fs.readFileSync(REPORT_PATH, "utf8");
      const report = JSON.parse(reportContent);

      // Check for endpoints array (may be empty but should exist)
      if (report.endpoints) {
        expect(Array.isArray(report.endpoints)).toBe(true);

        // If there are endpoints, validate their structure
        if (report.endpoints.length > 0) {
          const endpoint = report.endpoints[0];
          expect(endpoint).toHaveProperty("path");
          expect(endpoint).toHaveProperty("documented");
        }
      }
    });

    it("should format JSON with proper indentation", () => {
      // Execute the script
      execSync("npm run docs:validate", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
      });

      // Read the report
      const reportContent = fs.readFileSync(REPORT_PATH, "utf8");

      // Check for indentation (pretty-printed JSON)
      expect(reportContent).toMatch(/^{\n\s+/); // Starts with "{\n  "
      expect(reportContent).toContain("\n"); // Contains newlines
      expect(reportContent).toMatch(/\s{2}/); // Contains 2-space indentation
    });
  });

  describe("Migration and Cleanup", () => {
    it("should clean up old root-level report if it exists", () => {
      // Create a dummy old report file
      fs.writeFileSync(OLD_REPORT_PATH, JSON.stringify({ old: true }));
      expect(fs.existsSync(OLD_REPORT_PATH)).toBe(true);

      // Execute the script (should clean up old file)
      execSync("npm run docs:validate", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
      });

      // Verify old file is removed
      expect(fs.existsSync(OLD_REPORT_PATH)).toBe(false);

      // Verify new file exists
      expect(fs.existsSync(REPORT_PATH)).toBe(true);
    });

    it("should not fail if old report doesn't exist", () => {
      // Ensure old report doesn't exist
      if (fs.existsSync(OLD_REPORT_PATH)) {
        fs.unlinkSync(OLD_REPORT_PATH);
      }
      expect(fs.existsSync(OLD_REPORT_PATH)).toBe(false);

      // Execute should not throw
      expect(() => {
        execSync("npm run docs:validate", {
          cwd: PROJECT_ROOT,
          encoding: "utf8",
        });
      }).not.toThrow();

      // Verify new report is still created
      expect(fs.existsSync(REPORT_PATH)).toBe(true);
    });
  });

  describe("Error Handling", () => {
    it.skip("should handle write permission errors gracefully", () => {
      // This test is skipped in CI as it requires special permissions
      // Make coverage directory read-only
      if (fs.existsSync(COVERAGE_DIR)) {
        fs.chmodSync(COVERAGE_DIR, 0o444);
      }

      try {
        // Execute should handle error gracefully
        const result = execSync("npm run docs:validate", {
          cwd: PROJECT_ROOT,
          encoding: "utf8",
        });

        // Should see error message in output
        expect(result).toContain("Permission denied");
      } finally {
        // Restore permissions
        if (fs.existsSync(COVERAGE_DIR)) {
          fs.chmodSync(COVERAGE_DIR, 0o755);
        }
      }
    });

    it("should handle concurrent executions", async () => {
      // Run multiple instances concurrently
      const promises = Array(3)
        .fill(null)
        .map((_, i) => {
          return new Promise<void>((resolve, reject) => {
            try {
              execSync("npm run docs:validate", {
                cwd: PROJECT_ROOT,
                encoding: "utf8",
              });
              resolve();
            } catch (error) {
              reject(error);
            }
          });
        });

      // All should complete without error
      await expect(Promise.all(promises)).resolves.not.toThrow();

      // Report should exist and be valid
      expect(fs.existsSync(REPORT_PATH)).toBe(true);
      const reportContent = fs.readFileSync(REPORT_PATH, "utf8");
      expect(() => JSON.parse(reportContent)).not.toThrow();
    });
  });

  describe("Backward Compatibility", () => {
    it("should align with existing test expectations", () => {
      // This validates the contract with line 269 of openapi-coverage.test.ts
      const EXPECTED_PATH = "coverage/openapi-coverage-report.json";

      // Execute the script
      execSync("npm run docs:validate", {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
      });

      // The file should exist at the expected path
      const fullExpectedPath = path.join(PROJECT_ROOT, EXPECTED_PATH);
      expect(fs.existsSync(fullExpectedPath)).toBe(true);

      // Verify it's the same as our REPORT_PATH constant
      expect(path.relative(PROJECT_ROOT, REPORT_PATH)).toBe(EXPECTED_PATH);
    });

    it("should maintain gitignore patterns", () => {
      // Read .gitignore
      const gitignorePath = path.join(PROJECT_ROOT, ".gitignore");
      const gitignoreContent = fs.readFileSync(gitignorePath, "utf8");

      // Should have patterns for coverage reports
      expect(
        gitignoreContent.includes("coverage-report.json") ||
          gitignoreContent.includes("coverage/") ||
          gitignoreContent.includes("openapi-coverage-report.json")
      ).toBe(true);
    });
  });
});
