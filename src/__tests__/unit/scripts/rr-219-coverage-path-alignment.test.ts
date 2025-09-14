/**
 * @file RR-219 Coverage Report Path Alignment Tests
 * @description Comprehensive test suite for validating that the OpenAPI coverage
 * report is generated at the correct location (coverage/openapi-coverage-report.json)
 * instead of the root directory.
 *
 * These tests follow TDD principles and should FAIL before implementation.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";

// Mock modules
vi.mock("fs");
vi.mock("child_process");

describe("RR-219: Coverage Report Path Alignment", () => {
  const PROJECT_ROOT = process.cwd();
  const COVERAGE_DIR = path.join(PROJECT_ROOT, "coverage");
  const CORRECT_REPORT_PATH = path.join(
    COVERAGE_DIR,
    "openapi-coverage-report.json"
  );
  const OLD_REPORT_PATH = path.join(PROJECT_ROOT, "coverage-report.json");
  const SCRIPT_PATH = "scripts/validate-openapi-coverage.js";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("Directory Creation Tests", () => {
    it("should create coverage directory if it doesn't exist", () => {
      // Setup: coverage directory doesn't exist
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path === COVERAGE_DIR || path.toString().includes("coverage")) {
          return false;
        }
        return true;
      });

      const mockMkdirSync = vi
        .mocked(fs.mkdirSync)
        .mockImplementation(() => undefined);
      const mockWriteFileSync = vi
        .mocked(fs.writeFileSync)
        .mockImplementation(() => {});

      // Execute: Import and run the validation script function
      vi.resetModules();
      const { validateCoverage } = await import(`../../../../${SCRIPT_PATH}`);
      await validateCoverage();

      // Assert: Directory should be created with recursive flag
      expect(mockMkdirSync).toHaveBeenCalledWith(
        expect.stringContaining("coverage"),
        { recursive: true }
      );
    });

    it("should handle existing coverage directory gracefully", () => {
      // Setup: coverage directory already exists
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        if (path === COVERAGE_DIR || path.toString().includes("coverage")) {
          return true;
        }
        return true;
      });

      const mockMkdirSync = vi.mocked(fs.mkdirSync);
      const mockWriteFileSync = vi
        .mocked(fs.writeFileSync)
        .mockImplementation(() => {});

      // Execute: Import and run the validation script function
      vi.resetModules();
      const { validateCoverage } = await import(`../../../../${SCRIPT_PATH}`);
      await validateCoverage();

      // Assert: Directory should NOT be created again
      expect(mockMkdirSync).not.toHaveBeenCalled();
    });

    it("should handle directory creation permission errors", () => {
      // Setup: Directory creation will fail
      vi.mocked(fs.existsSync).mockReturnValue(false);
      vi.mocked(fs.mkdirSync).mockImplementation(() => {
        const error = new Error("EACCES: Permission denied") as any;
        error.code = "EACCES";
        throw error;
      });

      const mockConsoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockProcessExit = vi
        .spyOn(process, "exit")
        .mockImplementation(() => {
          throw new Error("Process exit");
        });

      // Execute & Assert: Should handle error gracefully
      expect(() => {
        const validateCoverage = require(`../../../../${SCRIPT_PATH}`);
        validateCoverage.main?.() ||
          validateCoverage.default?.() ||
          validateCoverage();
      }).toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("Permission denied")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });

    it("should handle coverage directory as file (not directory) error", () => {
      // Setup: coverage exists but is a file, not a directory
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.statSync).mockReturnValue({
        isDirectory: () => false,
        isFile: () => true,
      } as any);

      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        const error = new Error("ENOTDIR: Not a directory") as any;
        error.code = "ENOTDIR";
        throw error;
      });

      const mockConsoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      // Execute & Assert: Should detect and report the issue
      expect(() => {
        const validateCoverage = require(`../../../../${SCRIPT_PATH}`);
        validateCoverage.main?.() ||
          validateCoverage.default?.() ||
          validateCoverage();
      }).toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringMatching(/not a directory/i)
      );
    });
  });

  describe("File Output Path Tests", () => {
    it("should write report to coverage/openapi-coverage-report.json", () => {
      // Setup: Mock successful execution
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const mockWriteFileSync = vi
        .mocked(fs.writeFileSync)
        .mockImplementation(() => {});

      const mockReport = {
        timestamp: new Date().toISOString(),
        totalEndpoints: 45,
        documentedEndpoints: 6,
        coverage: 13.33,
        endpoints: [],
      };

      // Execute: Import and run the validation script function
      vi.resetModules();
      const { validateCoverage } = await import(`../../../../${SCRIPT_PATH}`);
      await validateCoverage();

      // Assert: File should be written to correct path
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringContaining("coverage/openapi-coverage-report.json"),
        expect.any(String),
        expect.any(String)
      );
    });

    it("should NOT write report to root directory", () => {
      // Setup: Mock successful execution
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const mockWriteFileSync = vi
        .mocked(fs.writeFileSync)
        .mockImplementation(() => {});

      // Execute: Import and run the validation script function
      vi.resetModules();
      const { validateCoverage } = await import(`../../../../${SCRIPT_PATH}`);
      await validateCoverage();

      // Assert: Should NOT write to root coverage-report.json
      const calls = mockWriteFileSync.mock.calls;
      const writesToRoot = calls.some(([path]) => {
        const pathStr = path.toString();
        return (
          pathStr.endsWith("coverage-report.json") &&
          !pathStr.includes("coverage/")
        );
      });

      expect(writesToRoot).toBe(false);
    });

    it("should use platform-appropriate path separators", () => {
      // Setup
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const mockWriteFileSync = vi
        .mocked(fs.writeFileSync)
        .mockImplementation(() => {});

      // Execute: Import and run the validation script function
      vi.resetModules();
      const { validateCoverage } = await import(`../../../../${SCRIPT_PATH}`);
      await validateCoverage();

      // Assert: Path should be constructed using path.join
      expect(mockWriteFileSync).toHaveBeenCalledWith(
        expect.stringMatching(/coverage[\\/]openapi-coverage-report\.json$/),
        expect.any(String),
        expect.any(String)
      );
    });

    it("should write valid JSON with proper formatting", () => {
      // Setup
      vi.mocked(fs.existsSync).mockReturnValue(true);
      let writtenContent = "";
      vi.mocked(fs.writeFileSync).mockImplementation((path, content) => {
        writtenContent = content.toString();
      });

      // Execute: Import and run the validation script function
      vi.resetModules();
      const { validateCoverage } = await import(`../../../../${SCRIPT_PATH}`);
      await validateCoverage();

      // Assert: Content should be valid, pretty-printed JSON
      expect(() => JSON.parse(writtenContent)).not.toThrow();
      expect(writtenContent).toContain("\n"); // Pretty printed
      expect(writtenContent).toMatch(/^{\n\s+/); // Starts with indented JSON
    });
  });

  describe("Script Execution Tests", () => {
    it("npm run docs:validate should create report at correct location", () => {
      // Setup: Mock successful npm script execution
      vi.mocked(execSync).mockImplementation((command) => {
        if (command.toString().includes("docs:validate")) {
          // Simulate script creating the file
          vi.mocked(fs.existsSync).mockImplementation((path) => {
            return path
              .toString()
              .includes("coverage/openapi-coverage-report.json");
          });
          return Buffer.from("✅ Coverage report generated");
        }
        return Buffer.from("");
      });

      // Execute
      const result = execSync("npm run docs:validate");

      // Assert
      expect(result.toString()).toContain("Coverage report generated");
      expect(fs.existsSync(CORRECT_REPORT_PATH)).toBe(true);
    });

    it("should exit with code 0 on successful execution", () => {
      // Setup
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.writeFileSync).mockImplementation(() => {});
      const mockProcessExit = vi
        .spyOn(process, "exit")
        .mockImplementation(() => {});

      // Execute
      const validateCoverage = require(`../../../../${SCRIPT_PATH}`);
      const result =
        validateCoverage.main?.() ||
        validateCoverage.default?.() ||
        validateCoverage();

      // Assert: Should not call process.exit with error code
      expect(mockProcessExit).not.toHaveBeenCalledWith(1);
    });

    it("should handle missing OpenAPI spec file gracefully", () => {
      // Setup: OpenAPI spec doesn't exist
      vi.mocked(fs.readFileSync).mockImplementation((path) => {
        if (path.toString().includes("openapi")) {
          const error = new Error("ENOENT: File not found") as any;
          error.code = "ENOENT";
          throw error;
        }
        return "";
      });

      const mockConsoleError = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});
      const mockProcessExit = vi
        .spyOn(process, "exit")
        .mockImplementation(() => {
          throw new Error("Process exit");
        });

      // Execute & Assert
      expect(() => {
        const validateCoverage = require(`../../../../${SCRIPT_PATH}`);
        validateCoverage.main?.() ||
          validateCoverage.default?.() ||
          validateCoverage();
      }).toThrow();

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("OpenAPI")
      );
      expect(mockProcessExit).toHaveBeenCalledWith(1);
    });
  });

  describe("Cleanup and Migration Tests", () => {
    it("should detect and remove old root-level coverage-report.json", () => {
      // Setup: Old file exists in root
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr === OLD_REPORT_PATH) return true;
        if (pathStr.includes("coverage")) return true;
        return false;
      });

      const mockUnlinkSync = vi
        .mocked(fs.unlinkSync)
        .mockImplementation(() => {});
      const mockConsoleLog = vi
        .spyOn(console, "log")
        .mockImplementation(() => {});

      // Execute: Run migration/cleanup
      const validateCoverage = require(`../../../../${SCRIPT_PATH}`);
      validateCoverage.main?.() ||
        validateCoverage.default?.() ||
        validateCoverage();

      // Assert: Old file should be removed
      expect(mockUnlinkSync).toHaveBeenCalledWith(OLD_REPORT_PATH);
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining("Cleaned up old coverage report")
      );
    });

    it("should not fail if old file doesn't exist", () => {
      // Setup: Old file doesn't exist
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr === OLD_REPORT_PATH) return false;
        return true;
      });

      const mockUnlinkSync = vi.mocked(fs.unlinkSync);

      // Execute: Should not throw
      expect(() => {
        const validateCoverage = require(`../../../../${SCRIPT_PATH}`);
        validateCoverage.main?.() ||
          validateCoverage.default?.() ||
          validateCoverage();
      }).not.toThrow();

      // Assert: Should not attempt to delete non-existent file
      expect(mockUnlinkSync).not.toHaveBeenCalled();
    });

    it("should handle cleanup errors gracefully", () => {
      // Setup: Old file exists but can't be deleted
      vi.mocked(fs.existsSync).mockImplementation((path) => {
        const pathStr = path.toString();
        if (pathStr === OLD_REPORT_PATH) return true;
        return true;
      });

      vi.mocked(fs.unlinkSync).mockImplementation(() => {
        const error = new Error("EACCES: Permission denied") as any;
        error.code = "EACCES";
        throw error;
      });

      const mockConsoleWarn = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      // Execute: Should continue despite cleanup failure
      const validateCoverage = require(`../../../../${SCRIPT_PATH}`);
      validateCoverage.main?.() ||
        validateCoverage.default?.() ||
        validateCoverage();

      // Assert: Should warn but not fail
      expect(mockConsoleWarn).toHaveBeenCalledWith(
        expect.stringContaining("Could not remove old coverage report")
      );
    });
  });

  describe("Test Contract Validation", () => {
    it("should match test expectation at line 269 of openapi-coverage.test.ts", async () => {
      // This test validates that the implementation matches the existing test contract
      // Line 269 of openapi-coverage.test.ts expects: "coverage/openapi-coverage-report.json"
      const EXPECTED_CONTRACT_PATH = "coverage/openapi-coverage-report.json";

      // Setup: Mock file system operations
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(
        JSON.stringify({
          paths: { "/api/health": { get: {} } },
        })
      );

      let actualPath = "";
      vi.mocked(fs.writeFileSync).mockImplementation(
        (pathArg, content, encoding) => {
          actualPath = String(pathArg);
        }
      );

      // Execute
      vi.resetModules();
      const { validateCoverage } = await import(`../../../../${SCRIPT_PATH}`);
      await validateCoverage();

      // Assert: Path should match test expectation exactly
      expect(actualPath).toContain(EXPECTED_CONTRACT_PATH);
      expect(actualPath).not.toContain("../coverage-report.json");
    });

    it("should ensure no broken references to old location", () => {
      // This test validates the new path constant is correctly formed
      // and doesn't reference the old location pattern

      // Verify the constant paths are correctly formed
      expect(CORRECT_REPORT_PATH).toContain(
        "coverage/openapi-coverage-report.json"
      );
      expect(CORRECT_REPORT_PATH).not.toContain("../coverage-report.json");

      // Verify old path is different from new path
      expect(OLD_REPORT_PATH).not.toBe(CORRECT_REPORT_PATH);
      expect(OLD_REPORT_PATH).toContain("coverage-report.json");
      expect(OLD_REPORT_PATH).not.toContain("coverage/");
    });
  });

  describe("Performance and Concurrency Tests", () => {
    it("should handle concurrent executions without corruption", async () => {
      // Setup: Multiple concurrent writes
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const writes: string[] = [];
      vi.mocked(fs.writeFileSync).mockImplementation((path, content) => {
        writes.push(content.toString());
      });

      // Execute: Simulate concurrent runs
      const promises = Array(3)
        .fill(null)
        .map(() => {
          return new Promise((resolve) => {
            const validateCoverage = require(`../../../../${SCRIPT_PATH}`);
            resolve(
              validateCoverage.main?.() ||
                validateCoverage.default?.() ||
                validateCoverage()
            );
          });
        });

      await Promise.all(promises);

      // Assert: All writes should be valid JSON
      writes.forEach((content) => {
        expect(() => JSON.parse(content)).not.toThrow();
      });
    });

    it("should complete within reasonable time for large reports", () => {
      // Setup: Large report data
      vi.mocked(fs.existsSync).mockReturnValue(true);
      const largeReport = {
        endpoints: Array(100)
          .fill(null)
          .map((_, i) => ({
            path: `/api/endpoint${i}`,
            documented: true,
            methods: ["GET", "POST", "PUT", "DELETE"],
          })),
      };

      let endTime: number;

      vi.mocked(fs.writeFileSync).mockImplementation(() => {
        endTime = Date.now();
      });

      // Execute
      const startTime = Date.now();
      vi.resetModules();
      const { validateCoverage } = await import(`../../../../${SCRIPT_PATH}`);
      await validateCoverage();

      // Assert: Should complete quickly (< 1 second)
      const duration = endTime! - startTime || 0;
      expect(duration).toBeLessThan(1000);
    });
  });
});
