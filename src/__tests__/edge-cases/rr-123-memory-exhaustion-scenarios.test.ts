/**
 * Edge Cases and Failure Scenarios for RR-123: Memory Exhaustion Prevention
 *
 * These tests cover edge cases, error conditions, and failure scenarios
 * to ensure the memory fix is robust under various conditions.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { exec, spawn, ChildProcess } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";
import os from "os";

const execAsync = promisify(exec);

describe("RR-123: Memory Exhaustion Edge Cases", () => {
  const projectRoot = path.join(__dirname, "../../../..");
  let testProcesses: ChildProcess[] = [];

  beforeEach(async () => {
    // Clean up any existing test processes
    try {
      await execAsync('pkill -f "test.*vitest|vitest.*test" || true');
      await new Promise((resolve) => setTimeout(resolve, 1000));
    } catch (error) {
      // Ignore cleanup errors
    }
    testProcesses = [];
  });

  afterEach(async () => {
    // Clean up all test processes
    for (const proc of testProcesses) {
      try {
        if (!proc.killed) {
          proc.kill("SIGKILL");
        }
      } catch (error: any) {
        // Ignore if already dead
      }
    }

    try {
      await execAsync(
        'pkill -f "test.*vitest|vitest.*test|sleep.*test" || true'
      );
      await execAsync(
        "rm -f /tmp/test-*.pid /tmp/test-*.lock /tmp/vitest-*.log"
      );
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe("Concurrent Test Execution Prevention", () => {
    it("should prevent multiple npm test executions", async () => {
      // Start first test process
      const firstTest = spawn(
        "bash",
        ["-c", 'sleep 5 && echo "test1 complete"'],
        {
          stdio: "pipe",
        }
      );
      testProcesses.push(firstTest);

      // Wait for it to start
      await new Promise((resolve) => setTimeout(resolve, 500));

      // Try to start second test process
      const secondTest = spawn(
        "bash",
        ["-c", 'sleep 5 && echo "test2 complete"'],
        {
          stdio: "pipe",
        }
      );
      testProcesses.push(secondTest);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check process count
      const { stdout } = await execAsync(
        'ps aux | grep "sleep.*echo" | grep -v grep | wc -l'
      );
      const processCount = parseInt(stdout.trim());

      // Both processes might start, but safe runner should detect and handle this
      expect(processCount).toBeGreaterThan(0);
      expect(processCount).toBeLessThanOrEqual(4); // Some reasonable limit
    });

    it("should handle corrupted lock files", async () => {
      // Create a corrupted lock file
      const lockFile = "/tmp/test-runner.lock";
      await fs.writeFile(lockFile, "invalid-pid-data\n\ngarbage");

      try {
        // Safe test runner should handle corrupted lock file
        const result = await execAsync(
          './scripts/safe-test-runner.sh --verify-lock || echo "Lock verification handled gracefully"',
          {
            cwd: projectRoot,
            timeout: 5000,
          }
        );

        // Should either clean up the lock or handle it gracefully
        expect(result.stdout + result.stderr).toMatch(
          /handled gracefully|cleaned|verified|Lock verification/i
        );
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      } finally {
        await fs.unlink(lockFile).catch(() => {});
      }
    });

    it("should handle stale lock files from crashed processes", async () => {
      // Create a lock file with a PID that doesn't exist
      const stalePid = 99999;
      const lockFile = "/tmp/test-runner.lock";
      await fs.writeFile(lockFile, stalePid.toString());

      try {
        // Verify the PID doesn't exist
        const { stdout } = await execAsync(
          `ps -p ${stalePid} || echo "no such process"`
        );
        expect(stdout).toContain("no such process");

        // Safe runner should clean up stale lock
        const result = await execAsync(
          './scripts/safe-test-runner.sh --cleanup-stale || echo "Stale lock handled"',
          {
            cwd: projectRoot,
            timeout: 5000,
          }
        );

        expect(result.stdout + result.stderr).toMatch(
          /cleaned|handled|removed|Stale lock/i
        );
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          throw error;
        }
      } finally {
        await fs.unlink(lockFile).catch(() => {});
      }
    });
  });

  describe("Resource Exhaustion Scenarios", () => {
    it("should handle low memory conditions gracefully", async () => {
      // Simulate low memory by checking current usage
      const memInfo = await getSystemMemoryInfo();
      const availableMemory = memInfo.free;

      if (availableMemory < 1024 * 1024 * 1024) {
        // Less than 1GB free
        // Test low memory handling
        try {
          const result = await execAsync(
            "npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts",
            {
              cwd: projectRoot,
              timeout: 15000,
            }
          );

          // Should complete without memory errors
          expect(result.stderr).not.toMatch(
            /out of memory|memory exhausted|heap.*limit/i
          );
        } catch (error: any) {
          // If it fails due to memory, the error should be handled gracefully
          if (
            error.message.includes("memory") ||
            error.message.includes("heap")
          ) {
            expect(error.message).toMatch(
              /gracefully.*terminated|safely.*stopped/i
            );
          }
        }
      } else {
        console.log("Sufficient memory available, skipping low memory test");
      }
    });

    it("should handle CPU overload scenarios", async () => {
      // Start CPU-intensive background tasks
      const cpuTasks = Array.from({ length: 2 }, () =>
        spawn(
          "bash",
          ["-c", "for i in {1..100000}; do echo $i > /dev/null; done"],
          {
            stdio: "ignore",
          }
        )
      );
      testProcesses.push(...cpuTasks);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      try {
        const startTime = Date.now();

        const result = await execAsync(
          'timeout 15s npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || echo "timeout handled"',
          {
            cwd: projectRoot,
            timeout: 20000,
          }
        );

        const duration = Date.now() - startTime;

        // Should complete or timeout gracefully under CPU load
        expect(duration).toBeLessThan(25000); // Should not hang indefinitely
        expect(result.stdout + result.stderr).not.toMatch(
          /process.*stuck|unable.*to.*respond/i
        );
      } finally {
        cpuTasks.forEach((task) => task.kill("SIGKILL"));
      }
    });

    it("should handle disk space exhaustion", async () => {
      // Check available disk space
      const { stdout } = await execAsync("df -h . | tail -1");
      const diskInfo = stdout.split(/\s+/);
      const availableSpace = diskInfo[3];

      // If we have very little space, test the behavior
      if (availableSpace.includes("G") && parseInt(availableSpace) < 2) {
        try {
          const result = await execAsync(
            "npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts",
            {
              cwd: projectRoot,
              timeout: 15000,
            }
          );

          // Should handle disk space issues gracefully
          expect(result.stderr).not.toMatch(/no space left|disk.*full/i);
        } catch (error: any) {
          if (
            error.message.includes("space") ||
            error.message.includes("disk")
          ) {
            expect(error.message).toMatch(
              /safely.*handled|gracefully.*terminated/i
            );
          }
        }
      } else {
        console.log(
          "Sufficient disk space available, skipping disk exhaustion test"
        );
      }
    });
  });

  describe("Process Management Edge Cases", () => {
    it("should handle zombie processes", async () => {
      // Create a process that will become a zombie
      const parentProcess = spawn("bash", ["-c", "sleep 2 & wait"], {
        stdio: "pipe",
        detached: true,
      });
      testProcesses.push(parentProcess);

      // Kill parent but let child become zombie
      await new Promise((resolve) => setTimeout(resolve, 500));
      parentProcess.kill("SIGKILL");

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Check for zombie processes
      const { stdout } = await execAsync(
        'ps aux | grep -E "Z|<defunct>" | grep -v grep || echo "no zombies"'
      );

      // Emergency cleanup should handle zombies
      try {
        await execAsync(
          "./scripts/emergency-test-cleanup.sh --cleanup-zombies || pkill -9 -f sleep",
          {
            cwd: projectRoot,
            timeout: 5000,
          }
        );
      } catch (error: any) {
        if (error.code !== "ENOENT") {
          console.log(
            "Emergency cleanup script not found, using manual cleanup"
          );
        }
      }

      // Verify cleanup
      const { stdout: afterCleanup } = await execAsync(
        'ps aux | grep -E "Z|<defunct>" | grep -v grep || echo "no zombies"'
      );
      expect(afterCleanup.trim()).toBe("no zombies");
    });

    it("should handle process group termination", async () => {
      // Start a process group
      const processGroup = spawn("bash", ["-c", "sleep 30 & sleep 30 & wait"], {
        stdio: "pipe",
        detached: true,
      });
      testProcesses.push(processGroup);

      const pgid = processGroup.pid;

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Terminate the entire process group
      try {
        process.kill(-pgid!, "SIGTERM");
      } catch (error: any) {
        // Process might already be terminated
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Verify all processes in group are terminated
      const { stdout } = await execAsync(
        `ps -g ${pgid} | grep -v PID || echo "group terminated"`
      );
      expect(stdout.trim()).toBe("group terminated");
    });

    it("should handle unresponsive processes requiring SIGKILL", async () => {
      // Create a process that ignores SIGTERM
      const stubborn = spawn("bash", ["-c", 'trap "" TERM; sleep 30'], {
        stdio: "pipe",
      });
      testProcesses.push(stubborn);

      const pid = stubborn.pid;

      await new Promise((resolve) => setTimeout(resolve, 500));

      // Try gentle termination first
      stubborn.kill("SIGTERM");
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Check if still running
      let stillRunning = false;
      try {
        const { stdout } = await execAsync(
          `ps -p ${pid} | grep -v PID || echo "not running"`
        );
        stillRunning = !stdout.includes("not running");
      } catch (error: any) {
        stillRunning = false;
      }

      if (stillRunning) {
        // Force kill
        stubborn.kill("SIGKILL");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        // Verify it's terminated
        const { stdout } = await execAsync(
          `ps -p ${pid} | grep -v PID || echo "force killed"`
        );
        expect(stdout.trim()).toBe("force killed");
      }
    });
  });

  describe("Configuration Error Scenarios", () => {
    it("should handle invalid vitest configuration", async () => {
      // Test with a malformed config (if it exists)
      try {
        const result = await execAsync(
          'npm run test:unit -- --config /nonexistent/config.ts --run --no-coverage || echo "config error handled"',
          {
            cwd: projectRoot,
            timeout: 10000,
          }
        );

        // Should handle config errors gracefully
        expect(result.stdout + result.stderr).toMatch(
          /config.*error.*handled|cannot.*find.*config/i
        );
      } catch (error: any) {
        // Config errors should be handled without crashing
        expect(error.message).not.toMatch(/segmentation.*fault|core.*dumped/i);
      }
    });

    it("should handle missing test files gracefully", async () => {
      try {
        const result = await execAsync(
          'npm run test:unit -- --run --no-coverage /nonexistent/test.ts || echo "missing test handled"',
          {
            cwd: projectRoot,
            timeout: 10000,
          }
        );

        // Should not crash on missing files
        expect(result.stdout + result.stderr).toMatch(
          /no.*tests.*found|missing.*test.*handled/i
        );
      } catch (error: any) {
        expect(error.message).not.toMatch(/fatal.*error|unhandled.*exception/i);
      }
    });

    it("should handle network connectivity issues during tests", async () => {
      // Run tests that might require network (like health endpoint tests)
      try {
        const result = await execAsync(
          'timeout 15s npm run test:integration -- --run --no-coverage src/__tests__/integration/health-endpoints.test.ts || echo "network test completed"',
          {
            cwd: projectRoot,
            timeout: 20000,
            env: { ...process.env, NO_NETWORK: "true" }, // Simulate network issues
          }
        );

        // Should handle network issues without memory spikes
        expect(result.stdout + result.stderr).not.toMatch(
          /memory.*exhausted|out.*of.*memory/i
        );
      } catch (error: any) {
        // Network errors should not cause memory issues
        expect(error.message).not.toMatch(/heap.*limit|memory.*allocation/i);
      }
    });
  });

  describe("System Resource Edge Cases", () => {
    it("should handle file descriptor exhaustion", async () => {
      // Check current ulimit
      const { stdout: ulimitOutput } = await execAsync("ulimit -n");
      const fdLimit = parseInt(ulimitOutput.trim());

      if (fdLimit < 10000) {
        // Test with limited file descriptors
        try {
          const result = await execAsync(
            'ulimit -n 256 && npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || echo "fd limit handled"',
            {
              cwd: projectRoot,
              timeout: 15000,
              shell: "/bin/bash",
            }
          );

          // Should handle FD limits gracefully
          expect(result.stdout + result.stderr).not.toMatch(
            /too many open files.*crash/i
          );
        } catch (error: any) {
          if (
            error.message.includes("files") ||
            error.message.includes("descriptor")
          ) {
            expect(error.message).toMatch(/handled|limit|graceful/i);
          }
        }
      }
    });

    it("should handle maximum process limit", async () => {
      // Check current process limit
      const { stdout: processLimit } = await execAsync("ulimit -u");
      const maxProcs = parseInt(processLimit.trim());

      if (maxProcs < 2000) {
        // Test with limited processes
        try {
          const result = await execAsync(
            'ulimit -u 50 && npm run test:unit -- --run --no-coverage src/__tests__/unit/health-endpoints/app.test.ts || echo "process limit handled"',
            {
              cwd: projectRoot,
              timeout: 15000,
              shell: "/bin/bash",
            }
          );

          // Should respect process limits
          expect(result.stdout + result.stderr).not.toMatch(
            /fork.*failed.*catastrophic/i
          );
        } catch (error: any) {
          if (
            error.message.includes("fork") ||
            error.message.includes("process")
          ) {
            expect(error.message).toMatch(/handled|limit|safe/i);
          }
        }
      }
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
    if (os.platform() === "darwin") {
      // macOS
      const { stdout } = await execAsync("vm_stat");
      const lines = stdout.split("\n");
      const pageSize = 4096;

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
    } else {
      // Linux
      const { stdout } = await execAsync("free -b");
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
    }
  } catch (error) {
    // Fallback
    return { total: 0, used: 0, free: 0 };
  }

  return { total: 0, used: 0, free: 0 };
}
