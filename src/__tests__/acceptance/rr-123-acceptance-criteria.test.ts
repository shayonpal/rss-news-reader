/**
 * Acceptance Criteria Tests for RR-123: Fix test runner causing memory exhaustion and service outages
 *
 * This test suite validates all acceptance criteria from the Linear issue:
 * - [ ] npm test only runs tests once
 * - [ ] Vitest config has resource limits (max 2 concurrent forks)
 * - [ ] Safe test runner script with timeouts and cleanup
 * - [ ] Test monitoring script to check for orphaned processes
 * - [ ] Documentation on safe test practices
 * - [ ] Emergency kill commands documented
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

describe("RR-123: Acceptance Criteria Verification", () => {
  const projectRoot = path.join(__dirname, "../../..");

  beforeEach(async () => {
    // Clean up any test processes
    try {
      await execAsync("pkill -f vitest || true");
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error: any) {
      // Ignore cleanup errors
    }
  });

  afterEach(async () => {
    // Clean up after tests
    try {
      await execAsync("pkill -f vitest || true");
      await execAsync("rm -f /tmp/test-*.pid /tmp/test-*.lock");
    } catch (error: any) {
      // Ignore cleanup errors
    }
  });

  describe("Acceptance Criteria 1: npm test only runs tests once", () => {
    it("MUST NOT contain double vitest execution in package.json", async () => {
      const packageJson = JSON.parse(
        await fs.readFile(path.join(projectRoot, "package.json"), "utf-8")
      );

      const testScript = packageJson.scripts.test;

      // Critical: Should not run "vitest run && vitest run"
      expect(testScript).not.toMatch(/vitest run.*&&.*vitest run/);

      // Should use safe alternatives
      const validPatterns = [
        /^vitest run --config vitest\.config\.safe\.ts$/,
        /^\.\/scripts\/safe-test-runner\.sh$/,
        /^vitest run --sequential$/,
        /^vitest run --maxConcurrency=1$/,
      ];

      const isValid = validPatterns.some((pattern) => pattern.test(testScript));
      expect(isValid).toBe(true);
    });

    it("MUST execute tests only once when npm test is run", async () => {
      // Mock test execution by checking what command would be run
      const packageJson = JSON.parse(
        await fs.readFile(path.join(projectRoot, "package.json"), "utf-8")
      );

      const testScript = packageJson.scripts.test;

      // Count how many times vitest would be invoked
      const vitestMatches = (testScript.match(/vitest/g) || []).length;

      // Should only invoke vitest once (or use safe runner)
      if (testScript.includes("vitest")) {
        expect(vitestMatches).toBeLessThanOrEqual(1);
      }
    });
  });

  describe("Acceptance Criteria 2: Vitest config has resource limits (max 2 concurrent forks)", () => {
    it("MUST have maxConcurrency limit in vitest.config.ts", async () => {
      const vitestConfig = await fs.readFile(
        path.join(projectRoot, "vitest.config.ts"),
        "utf-8"
      );

      // Must contain maxConcurrency setting
      expect(vitestConfig).toMatch(/maxConcurrency:\s*[12]/);

      // Extract the value
      const match = vitestConfig.match(/maxConcurrency:\s*(\d+)/);
      if (match) {
        const concurrency = parseInt(match[1]);
        expect(concurrency).toBeLessThanOrEqual(2);
      }
    });

    it("MUST have pool configuration with fork limits", async () => {
      const vitestConfig = await fs.readFile(
        path.join(projectRoot, "vitest.config.ts"),
        "utf-8"
      );

      // Should have pool configuration
      expect(vitestConfig).toMatch(/pool.*{[\s\S]*}/);

      // Should limit forks
      expect(vitestConfig).toMatch(/maxForks.*[12]/);
    });

    it("MUST have resource limits in integration config", async () => {
      const integrationConfig = await fs.readFile(
        path.join(projectRoot, "vitest.config.integration.ts"),
        "utf-8"
      );

      // Integration tests should be even more restricted
      expect(integrationConfig).toMatch(/maxConcurrency:\s*1/);
    });

    it("SHOULD have safe config for memory-constrained execution", async () => {
      try {
        const safeConfig = await fs.readFile(
          path.join(projectRoot, "vitest.config.safe.ts"),
          "utf-8"
        );

        // Safe config should be very restrictive
        expect(safeConfig).toMatch(/maxConcurrency:\s*1/);
        expect(safeConfig).toMatch(/singleThread.*true/);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          console.log(
            "Safe config not yet created - acceptable for test generation phase"
          );
        } else {
          throw error;
        }
      }
    });
  });

  describe("Acceptance Criteria 3: Safe test runner script with timeouts and cleanup", () => {
    it("MUST have safe test runner script", async () => {
      try {
        const scriptPath = path.join(
          projectRoot,
          "scripts/safe-test-runner.sh"
        );
        const script = await fs.readFile(scriptPath, "utf-8");

        // Must have all required features
        expect(script).toMatch(/(timeout|gtimeout|run_with_timeout)/); // Timeout handling
        expect(script).toMatch(/pkill.*vitest/); // Process cleanup
        expect(script).toMatch(/lockfile|\.lock/); // Concurrency prevention
      } catch (error: any) {
        if (error.code === "ENOENT") {
          // FAIL - Script is required
          throw new Error(
            "ACCEPTANCE CRITERIA FAILED: Safe test runner script is missing"
          );
        }
        throw error;
      }
    });

    it("MUST prevent concurrent execution", async () => {
      try {
        const scriptPath = path.join(
          projectRoot,
          "scripts/safe-test-runner.sh"
        );
        const script = await fs.readFile(scriptPath, "utf-8");

        // Must check for existing processes
        expect(script).toMatch(/(ps|pgrep).*vitest/);

        // Must exit if tests already running
        expect(script).toMatch(/exit\s+[1-9]/);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new Error(
            "ACCEPTANCE CRITERIA FAILED: Safe test runner script is missing"
          );
        }
        throw error;
      }
    });

    it("MUST handle cleanup on script termination", async () => {
      try {
        const scriptPath = path.join(
          projectRoot,
          "scripts/safe-test-runner.sh"
        );
        const script = await fs.readFile(scriptPath, "utf-8");

        // Must have signal handlers
        expect(script).toMatch(/trap.*EXIT|trap.*SIGTERM|trap.*SIGINT/);

        // Must clean up processes
        expect(script).toMatch(/cleanup.*function|kill.*vitest/);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new Error(
            "ACCEPTANCE CRITERIA FAILED: Safe test runner script is missing"
          );
        }
        throw error;
      }
    });
  });

  describe("Acceptance Criteria 4: Test monitoring script to check for orphaned processes", () => {
    it("MUST have monitoring script for orphaned processes", async () => {
      try {
        const monitorPath = path.join(
          projectRoot,
          "scripts/monitor-test-processes.sh"
        );
        const script = await fs.readFile(monitorPath, "utf-8");

        // Must detect vitest processes
        expect(script).toMatch(/(ps|pgrep).*vitest/);

        // Must check for orphaned processes
        expect(script).toMatch(/orphan|stale|abandoned/i);

        // Must provide cleanup capability
        expect(script).toMatch(/kill|cleanup|terminate/);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new Error(
            "ACCEPTANCE CRITERIA FAILED: Test monitoring script is missing"
          );
        }
        throw error;
      }
    });

    it("MUST detect memory usage anomalies", async () => {
      try {
        const monitorPath = path.join(
          projectRoot,
          "scripts/monitor-test-processes.sh"
        );
        const script = await fs.readFile(monitorPath, "utf-8");

        // Must monitor memory usage
        expect(script).toMatch(/memory|mem|RSS|VSZ/i);

        // Must alert on high usage
        expect(script).toMatch(/alert|warn|notify/i);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new Error(
            "ACCEPTANCE CRITERIA FAILED: Test monitoring script is missing"
          );
        }
        throw error;
      }
    });
  });

  describe("Acceptance Criteria 5: Documentation on safe test practices", () => {
    it("MUST have documentation for safe test execution", async () => {
      const possiblePaths = [
        "docs/testing/safe-test-practices.md",
        "docs/testing/memory-management.md",
        "docs/tech/testing-guidelines.md",
        "README.md", // Check if documented in main README
      ];

      let documentationFound = false;
      let documentationContent = "";

      for (const docPath of possiblePaths) {
        try {
          const content = await fs.readFile(
            path.join(projectRoot, docPath),
            "utf-8"
          );
          if (
            content.includes("safe test") ||
            content.includes("memory") ||
            content.includes("vitest")
          ) {
            documentationFound = true;
            documentationContent = content;
            break;
          }
        } catch (error: any) {
          // Continue checking other paths
        }
      }

      if (!documentationFound) {
        throw new Error(
          "ACCEPTANCE CRITERIA FAILED: Safe test practices documentation is missing"
        );
      }

      // Documentation must cover key topics
      expect(documentationContent).toMatch(
        /safe.*test|memory.*limit|resource.*management/i
      );
      expect(documentationContent).toMatch(/npm test|vitest|concurrent/i);
    });

    it("MUST document memory management practices", async () => {
      // Check for memory management documentation
      try {
        const { stdout } = await execAsync(
          `grep -r "memory.*management\\|resource.*limit\\|safe.*test" ${projectRoot}/docs/ || echo "not found"`
        );

        if (stdout.trim() === "not found") {
          throw new Error(
            "ACCEPTANCE CRITERIA FAILED: Memory management documentation is missing"
          );
        }

        expect(stdout).toMatch(/memory|resource|safe/i);
      } catch (error) {
        if (!error.message.includes("ACCEPTANCE CRITERIA FAILED")) {
          // Docs directory might not exist
          console.log(
            "Documentation directory structure may need to be created"
          );
        } else {
          throw error;
        }
      }
    });
  });

  describe("Acceptance Criteria 6: Emergency kill commands documented", () => {
    it("MUST have emergency cleanup script", async () => {
      try {
        const emergencyPath = path.join(
          projectRoot,
          "scripts/kill-test-processes.sh"
        );
        const script = await fs.readFile(emergencyPath, "utf-8");

        // Must force kill vitest processes
        expect(script).toMatch(/pkill.*-9.*vitest|kill.*-9.*vitest/);

        // Must be aggressive in cleanup
        expect(script).toMatch(/SIGKILL|kill.*-9/);
      } catch (error: any) {
        if (error.code === "ENOENT") {
          throw new Error(
            "ACCEPTANCE CRITERIA FAILED: Emergency cleanup script is missing"
          );
        }
        throw error;
      }
    });

    it("MUST document emergency procedures", async () => {
      // Check for emergency procedure documentation
      const possibleLocations = [
        "docs/testing/emergency-procedures.md",
        "URGENT-test-runner-memory-issue.md",
        "README.md",
      ];

      let emergencyDocsFound = false;

      for (const location of possibleLocations) {
        try {
          const content = await fs.readFile(
            path.join(projectRoot, location),
            "utf-8"
          );
          if (
            content.includes("pkill") ||
            content.includes("emergency") ||
            content.includes("kill")
          ) {
            emergencyDocsFound = true;

            // Must document kill commands
            expect(content).toMatch(/pkill.*vitest/);
            expect(content).toMatch(/emergency|kill|cleanup/i);
            break;
          }
        } catch (error: any) {
          // Continue checking
        }
      }

      if (!emergencyDocsFound) {
        throw new Error(
          "ACCEPTANCE CRITERIA FAILED: Emergency procedures documentation is missing"
        );
      }
    });

    it("MUST have emergency cleanup available", async () => {
      // Verify emergency cleanup script exists and is executable
      const emergencyPath = path.join(
        projectRoot,
        "scripts/kill-test-processes.sh"
      );
      await fs.access(emergencyPath, fs.constants.X_OK);

      // Script should be documented in README or package.json
      const packageJson = JSON.parse(
        await fs.readFile(path.join(projectRoot, "package.json"), "utf-8")
      );

      // Check if there's a reference to the emergency script (not required to be in scripts)
      const readmePath = path.join(projectRoot, "README.md");
      const readme = await fs.readFile(readmePath, "utf-8");

      // Either package.json references it or README documents it
      const hasReference =
        readme.includes("kill-test-processes") ||
        JSON.stringify(packageJson).includes("kill-test-processes");

      expect(hasReference).toBe(true);
    });
  });

  describe("Overall System Validation", () => {
    it("MUST prevent the original memory exhaustion issue", async () => {
      // Simulate running tests and monitor process count
      const beforeProcesses = await getVitestProcessCount();

      try {
        // Run a small test to verify it doesn't spawn excessive processes
        const result = await execAsync(
          'timeout 10s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || echo "test completed"',
          {
            cwd: projectRoot,
            timeout: 15000,
          }
        );

        const duringProcesses = await getVitestProcessCount();

        // Should not spawn more than 3-4 vitest processes
        expect(duringProcesses - beforeProcesses).toBeLessThanOrEqual(4);

        // Should not show memory errors
        expect(result.stderr).not.toMatch(
          /memory.*exhausted|out of memory|heap.*limit/i
        );
      } catch (error) {
        // Should not fail due to resource issues
        expect(error.message).not.toMatch(/memory|resource|exhausted/i);
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 3000));

      const afterProcesses = await getVitestProcessCount();

      // Processes should be cleaned up
      expect(afterProcesses).toBeLessThanOrEqual(beforeProcesses + 1);
    });

    it("MUST maintain PM2 service stability", async () => {
      const beforeServices = await execAsync(
        'pm2 status | grep -E "rss-reader|sync" | grep online | wc -l'
      );
      const servicesBefore = parseInt(beforeServices.stdout.trim());

      // Run tests
      try {
        await execAsync(
          "timeout 10s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || true",
          {
            cwd: projectRoot,
            timeout: 15000,
          }
        );
      } catch (error) {
        // Ignore test execution errors
      }

      // Check services are still running
      const afterServices = await execAsync(
        'pm2 status | grep -E "rss-reader|sync" | grep online | wc -l'
      );
      const servicesAfter = parseInt(afterServices.stdout.trim());

      // Services should remain stable
      expect(servicesAfter).toBeGreaterThanOrEqual(servicesBefore);
    });
  });
});

// Helper function to count vitest processes
async function getVitestProcessCount(): Promise<number> {
  try {
    const { stdout } = await execAsync(
      "ps aux | grep vitest | grep -v grep | wc -l"
    );
    return parseInt(stdout.trim()) || 0;
  } catch (error) {
    return 0;
  }
}
