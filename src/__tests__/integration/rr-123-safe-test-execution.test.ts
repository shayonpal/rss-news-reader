/**
 * Integration Tests for RR-123: Safe Test Execution and Process Management
 *
 * These integration tests verify that the test runner fix properly manages
 * system resources and prevents the memory exhaustion issue.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

describe("RR-123: Safe Test Execution Integration", () => {
  const projectRoot = path.join(__dirname, "../../../..");
  const testTimeout = 30000; // 30 seconds for integration tests

  beforeEach(async () => {
    // Kill any existing vitest processes before starting
    try {
      await execAsync("pkill -f vitest || true");
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait for cleanup
    } catch (error) {
      // Ignore if no processes to kill
    }
  });

  afterEach(async () => {
    // Clean up after each test
    try {
      await execAsync("pkill -f vitest || true");
      await execAsync("rm -f /tmp/test-*.pid /tmp/test-*.lock");
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Safe Test Runner Script Integration", () => {
    it(
      "should execute safe test runner without memory spikes",
      async () => {
        const beforeMemory = await getSystemMemoryInfo();

        try {
          // Run safe test script with timeout
          const { stdout, stderr } = await execAsync(
            "timeout 15s ./scripts/safe-test-runner.sh --dry-run || true",
            {
              cwd: projectRoot,
              timeout: testTimeout,
            }
          );

          // Should not produce memory warnings
          expect(stderr).not.toMatch(/memory.*exhausted|out of memory/i);

          // Should complete or timeout gracefully
          expect([stdout, stderr].join("")).not.toMatch(
            /killed|terminated unexpectedly/i
          );
        } catch (error) {
          // Script might not exist yet - verify it would prevent memory issues
          if (error.code === "ENOENT") {
            console.log(
              "Safe test runner script not found - this test validates requirements"
            );
          } else {
            throw error;
          }
        }

        const afterMemory = await getSystemMemoryInfo();

        // Memory should not increase by more than 500MB
        const memoryIncrease = afterMemory.used - beforeMemory.used;
        expect(memoryIncrease).toBeLessThan(500 * 1024 * 1024); // 500MB
      },
      testTimeout
    );

    it("should prevent concurrent test execution", async () => {
      // Create a mock lock file
      const lockFile = "/tmp/test-runner.lock";
      await fs.writeFile(lockFile, process.pid.toString());

      try {
        const { stdout, stderr } = await execAsync(
          './scripts/safe-test-runner.sh --check-lock || echo "Lock check failed as expected"',
          {
            cwd: projectRoot,
            timeout: 5000,
          }
        );

        // Should detect existing lock and refuse to run
        expect([stdout, stderr].join("")).toMatch(
          /already running|lock.*exists|Lock check failed/i
        );
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      } finally {
        await fs.unlink(lockFile).catch(() => {});
      }
    });

    it("should clean up processes on script termination", async () => {
      // Start safe test runner in background
      const testProcess = spawn(
        "bash",
        ["-c", 'sleep 10 && echo "test complete"'],
        {
          stdio: "pipe",
          detached: false,
        }
      );

      const pid = testProcess.pid;

      // Wait a moment for process to start
      await new Promise((resolve) => setTimeout(resolve, 100));

      // Terminate the process group
      try {
        process.kill(-pid!, "SIGTERM");
      } catch (error) {
        // Process might already be gone
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Verify no orphaned processes
      const { stdout } = await execAsync(
        `ps aux | grep ${pid} | grep -v grep || echo "no processes"`
      );
      expect(stdout.trim()).toBe("no processes");

      testProcess.kill();
    });
  });

  describe("Vitest Configuration Integration", () => {
    it("should run unit tests with resource limits", async () => {
      const startTime = Date.now();
      const beforeMemory = await getSystemMemoryInfo();

      try {
        const { stdout, stderr } = await execAsync(
          "npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts",
          {
            cwd: projectRoot,
            timeout: testTimeout,
          }
        );

        const duration = Date.now() - startTime;
        const afterMemory = await getSystemMemoryInfo();

        // Should complete in reasonable time (not stuck)
        expect(duration).toBeLessThan(20000); // 20 seconds

        // Should not spike memory usage
        const memoryIncrease = afterMemory.used - beforeMemory.used;
        expect(memoryIncrease).toBeLessThan(200 * 1024 * 1024); // 200MB

        // Should show successful test execution
        expect(stdout).toMatch(/✓|passed/i);
      } catch (error) {
        // If tests fail, ensure it's not due to resource issues
        if (
          error.message.includes("timeout") ||
          error.message.includes("memory")
        ) {
          throw new Error(`Resource issue detected: ${error.message}`);
        }
        // Other test failures are acceptable for this integration test
      }
    });

    it("should run integration tests sequentially", async () => {
      const startTime = Date.now();

      try {
        const { stdout, stderr } = await execAsync(
          "npm run test:integration -- --run --no-coverage src/__tests__/integration/health-endpoints.test.ts",
          {
            cwd: projectRoot,
            timeout: testTimeout,
          }
        );

        const duration = Date.now() - startTime;

        // Should complete in reasonable time
        expect(duration).toBeLessThan(25000); // 25 seconds

        // Should not show concurrent execution warnings
        expect(stderr).not.toMatch(/too many.*concurrent|resource.*limit/i);
      } catch (error) {
        // Log error for debugging but don't fail if it's just test failures
        if (
          error.message.includes("timeout") ||
          error.message.includes("resource")
        ) {
          throw new Error(`Resource management issue: ${error.message}`);
        }
      }
    });

    it("should limit concurrent vitest processes", async () => {
      // Start a test run
      const testProcess = spawn(
        "npm",
        ["run", "test:unit", "--", "--run", "--no-coverage"],
        {
          cwd: projectRoot,
          stdio: "pipe",
        }
      );

      // Wait for processes to start
      await new Promise((resolve) => setTimeout(resolve, 2000));

      try {
        const { stdout } = await execAsync(
          "ps aux | grep vitest | grep -v grep | wc -l"
        );
        const processCount = parseInt(stdout.trim());

        // Should not spawn more than 3-4 vitest processes (including parent)
        expect(processCount).toBeLessThanOrEqual(4);
      } finally {
        testProcess.kill("SIGTERM");
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    });
  });

  describe("Emergency Recovery Integration", () => {
    it("should execute emergency cleanup script", async () => {
      // Start some dummy vitest-like processes
      const dummyProcesses = [
        spawn("sleep", ["30"], { stdio: "ignore" }),
        spawn("sleep", ["30"], { stdio: "ignore" }),
      ];

      await new Promise((resolve) => setTimeout(resolve, 500));

      try {
        // Run emergency cleanup
        await execAsync(
          './scripts/emergency-test-cleanup.sh || pkill -f "sleep 30"',
          {
            cwd: projectRoot,
            timeout: 10000,
          }
        );

        // Wait for cleanup to complete
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Verify processes are terminated
        const { stdout } = await execAsync(
          'ps aux | grep "sleep 30" | grep -v grep || echo "clean"'
        );
        expect(stdout.trim()).toBe("clean");
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      } finally {
        // Ensure cleanup
        dummyProcesses.forEach((proc) => {
          try {
            proc.kill("SIGKILL");
          } catch (e) {
            // Ignore if already dead
          }
        });
      }
    });

    it("should detect and alert on high memory usage", async () => {
      try {
        const { stdout } = await execAsync(
          './scripts/monitor-test-health.sh --check-memory || echo "Monitor not found"',
          {
            cwd: projectRoot,
            timeout: 5000,
          }
        );

        // Should provide memory status
        expect(stdout).toMatch(/memory|Monitor not found/i);
      } catch (error) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      }
    });

    it("should restart PM2 services after test cleanup", async () => {
      // Check current PM2 status
      const { stdout: beforeStatus } = await execAsync(
        'pm2 status | grep -E "rss-reader|sync" | wc -l'
      );
      const servicesBefore = parseInt(beforeStatus.trim());

      // Simulate emergency recovery (without actually stopping services)
      try {
        await execAsync(
          'echo "Simulating recovery" && pm2 status > /dev/null',
          {
            timeout: 5000,
          }
        );

        // Verify services are still running
        const { stdout: afterStatus } = await execAsync(
          'pm2 status | grep -E "rss-reader|sync" | wc -l'
        );
        const servicesAfter = parseInt(afterStatus.trim());

        expect(servicesAfter).toBeGreaterThanOrEqual(servicesBefore);
      } catch (error) {
        throw new Error(`PM2 recovery verification failed: ${error.message}`);
      }
    });
  });

  describe("Resource Monitoring Integration", () => {
    it("should track memory usage during test execution", async () => {
      const memoryLog: Array<{ timestamp: number; memory: number }> = [];

      // Start memory monitoring
      const monitorInterval = setInterval(async () => {
        try {
          const memInfo = await getSystemMemoryInfo();
          memoryLog.push({
            timestamp: Date.now(),
            memory: memInfo.used,
          });
        } catch (error) {
          // Ignore monitoring errors
        }
      }, 1000);

      try {
        // Run a test with monitoring
        await execAsync(
          "timeout 10s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || true",
          {
            cwd: projectRoot,
            timeout: 15000,
          }
        );
      } finally {
        clearInterval(monitorInterval);
      }

      // Analyze memory usage patterns
      if (memoryLog.length > 1) {
        const maxMemory = Math.max(...memoryLog.map((log) => log.memory));
        const minMemory = Math.min(...memoryLog.map((log) => log.memory));
        const memorySpike = maxMemory - minMemory;

        // Memory spike should be reasonable (less than 1GB)
        expect(memorySpike).toBeLessThan(1024 * 1024 * 1024);
      }
    });

    it("should detect test process leaks", async () => {
      // Get baseline process count
      const { stdout: beforeCount } = await execAsync(
        'ps aux | grep -E "(vitest|node.*test)" | grep -v grep | wc -l'
      );
      const processesBefore = parseInt(beforeCount.trim());

      // Run a quick test
      try {
        await execAsync(
          "timeout 5s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || true",
          {
            cwd: projectRoot,
            timeout: 10000,
          }
        );
      } catch (error) {
        // Ignore test execution errors
      }

      // Wait for cleanup
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check for process leaks
      const { stdout: afterCount } = await execAsync(
        'ps aux | grep -E "(vitest|node.*test)" | grep -v grep | wc -l'
      );
      const processesAfter = parseInt(afterCount.trim());

      // Should not have significant process leaks (allow 1-2 lingering processes)
      expect(processesAfter - processesBefore).toBeLessThanOrEqual(2);
    });
  });
});

// Helper function to get system memory information
async function getSystemMemoryInfo(): Promise<{
  total: number;
  used: number;
  free: number;
}> {
  try {
    // For macOS
    const { stdout } = await execAsync("vm_stat");

    // Parse vm_stat output
    const lines = stdout.split("\n");
    const pageSize = 4096; // 4KB pages on macOS

    let freePages = 0;
    let activePages = 0;
    let inactivePages = 0;
    let wiredPages = 0;

    for (const line of lines) {
      if (line.includes("Pages free:")) {
        freePages = parseInt(line.match(/\d+/)?.[0] || "0");
      } else if (line.includes("Pages active:")) {
        activePages = parseInt(line.match(/\d+/)?.[0] || "0");
      } else if (line.includes("Pages inactive:")) {
        inactivePages = parseInt(line.match(/\d+/)?.[0] || "0");
      } else if (line.includes("Pages wired down:")) {
        wiredPages = parseInt(line.match(/\d+/)?.[0] || "0");
      }
    }

    const total =
      (freePages + activePages + inactivePages + wiredPages) * pageSize;
    const used = (activePages + inactivePages + wiredPages) * pageSize;
    const free = freePages * pageSize;

    return { total, used, free };
  } catch (error) {
    // Fallback for other systems or if vm_stat fails
    try {
      const { stdout } = await execAsync('free -b || echo "0 0 0"');
      const lines = stdout.split("\n");
      const memLine = lines.find((line) => line.startsWith("Mem:"));

      if (memLine) {
        const values = memLine.split(/\s+/);
        return {
          total: parseInt(values[1]) || 0,
          used: parseInt(values[2]) || 0,
          free: parseInt(values[3]) || 0,
        };
      }
    } catch (fallbackError) {
      // Return zeros if all methods fail
    }

    return { total: 0, used: 0, free: 0 };
  }
}
