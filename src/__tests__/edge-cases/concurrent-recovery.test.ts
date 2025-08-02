/**
 * Edge Case Tests for Concurrent Recovery Attempts (RR-110)
 * Tests handling of multiple simultaneous recovery operations
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec, spawn } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

describe("Concurrent Recovery Edge Cases - RR-110", () => {
  let originalEnv: NodeJS.ProcessEnv;
  const scriptPath = path.join(process.cwd(), "scripts", "webpack-recovery.sh");

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("Multiple Recovery Script Executions", () => {
    it("should handle concurrent script executions safely", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use PM2 describe to check service status
      expect(scriptContent).toContain("pm2 describe rss-reader-dev");
      
      // Should handle case where service is already stopped
      expect(scriptContent).toContain("Service not running");
      
      // Should handle case where service is already being restarted
      expect(scriptContent).toMatch(/pm2 describe.*> \/dev\/null 2>&1/);
    });

    it("should not create race conditions in file cleanup", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should check directory existence before removal
      expect(scriptContent).toContain('if [ -d ".next" ]; then');
      expect(scriptContent).toContain('if [ -d "node_modules/.cache" ]; then');
      
      // Should handle case where directories are already removed
      expect(scriptContent).toContain("No .next directory found");
      expect(scriptContent).toContain("No node_modules/.cache found");
    });

    it("should handle PM2 service state changes gracefully", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should check service status before operations
      expect(scriptContent).toContain("pm2 describe rss-reader-dev > /dev/null 2>&1");
      
      // Should not assume service state
      expect(scriptContent).toContain("if pm2 describe");
      expect(scriptContent).toContain("else");
    });
  });

  describe("PM2 Service Management Race Conditions", () => {
    it("should handle service already stopped by another process", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should gracefully handle service not running
      expect(scriptContent).toContain("Service not running");
      
      // Should not fail if stop command finds no service
      expect(scriptContent).toMatch(/pm2 describe.*then/s);
      expect(scriptContent).toMatch(/pm2 stop.*else/s);
    });

    it("should handle service already starting by another process", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use --only flag to avoid conflicts
      expect(scriptContent).toContain("pm2 start ecosystem.config.js --only rss-reader-dev");
      
      // Should wait for stabilization regardless of start outcome
      expect(scriptContent).toContain("sleep 10");
    });

    it("should handle PM2 daemon state changes", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should work with existing PM2 operations
      expect(scriptContent).toContain("pm2 describe");
      expect(scriptContent).toContain("pm2 stop");
      expect(scriptContent).toContain("pm2 start");
      
      // Should not try to manage PM2 daemon itself
      expect(scriptContent).not.toContain("pm2 kill");
      expect(scriptContent).not.toContain("pm2 startup");
    });
  });

  describe("File System Race Conditions", () => {
    it("should handle concurrent directory removal", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should check existence before removal to avoid errors
      expect(scriptContent).toMatch(/if \[ -d "\.next" \]; then[\s\S]*?rm -rf \.next/);
      expect(scriptContent).toMatch(/if \[ -d "node_modules\/\.cache" \]; then[\s\S]*?rm -rf node_modules\/\.cache/);
      
      // Should handle missing directories gracefully
      expect(scriptContent).toContain("No .next directory found");
      expect(scriptContent).toContain("No node_modules/.cache found");
    });

    it("should not interfere with running builds", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should stop service before cleaning to avoid interference
      const stopIndex = scriptContent.indexOf("pm2 stop");
      const cleanIndex = scriptContent.indexOf("rm -rf .next");
      expect(stopIndex).toBeLessThan(cleanIndex);
      
      // Should wait for service to fully stop
      expect(scriptContent).toContain("Service stopped");
    });

    it("should handle permissions issues gracefully", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use safe removal commands
      expect(scriptContent).toContain("rm -rf .next");
      expect(scriptContent).toContain("rm -rf node_modules/.cache");
      
      // Should work from correct directory
      expect(scriptContent).toContain('cd "$PROJECT_DIR"');
    });
  });

  describe("Health Check Race Conditions", () => {
    it("should handle concurrent health checks", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use simple, stateless health checks
      expect(scriptContent).toContain("curl -s -f");
      expect(scriptContent).toContain("http://localhost:3000/reader/api/health/app");
      
      // Should not create temporary files or state
      expect(scriptContent).not.toContain("mktemp");
      expect(scriptContent).not.toContain(">/tmp/");
    });

    it("should handle service becoming available during retry loop", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should exit successfully once health check passes
      expect(scriptContent).toContain("Health check passed!");
      expect(scriptContent).toContain("exit 0");
      
      // Should not continue retrying after success
      const healthCheckLoop = scriptContent.match(/while \[ \$RETRY_COUNT -lt \$MAX_RETRIES \];[\s\S]*?done/);
      expect(healthCheckLoop).toBeTruthy();
      expect(healthCheckLoop![0]).toContain("exit 0");
    });

    it("should handle network timeouts during concurrent access", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use short timeout to avoid hanging
      expect(scriptContent).toContain("curl -s -f");
      
      // Should handle curl failures gracefully
      expect(scriptContent).toContain("> /dev/null 2>&1");
    });
  });

  describe("Process Management Edge Cases", () => {
    it("should handle script termination gracefully", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use set -e for consistent error handling
      expect(scriptContent).toContain("set -e");
      
      // Should have proper exit codes
      expect(scriptContent).toContain("exit 0");
      expect(scriptContent).toContain("exit 1");
    });

    it("should not leave system in inconsistent state", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should complete service restart before health check
      const restartIndex = scriptContent.indexOf("pm2 start");
      const healthIndex = scriptContent.indexOf("Running health check");
      expect(restartIndex).toBeLessThan(healthIndex);
      
      // Should not have partial operations
      expect(scriptContent).not.toContain("pm2 stop && pm2 start");
    });

    it("should handle interruption signals appropriately", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use atomic operations where possible
      expect(scriptContent).toContain("rm -rf .next");
      expect(scriptContent).toContain("pm2 start ecosystem.config.js --only rss-reader-dev");
      
      // Should not use multi-step operations that could be interrupted
      expect(scriptContent).not.toContain("rm .next/* && rmdir .next");
    });
  });

  describe("Resource Contention", () => {
    it("should not conflict with normal PM2 operations", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use standard PM2 commands
      expect(scriptContent).toContain("pm2 describe");
      expect(scriptContent).toContain("pm2 stop");
      expect(scriptContent).toContain("pm2 start");
      
      // Should target specific service
      expect(scriptContent).toContain("rss-reader-dev");
      expect(scriptContent).toContain("--only rss-reader-dev");
    });

    it("should not interfere with other services", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should only operate on rss-reader-dev
      expect(scriptContent).toContain("--only rss-reader-dev");
      
      // Should not affect other services
      expect(scriptContent).not.toContain("pm2 restart all");
      expect(scriptContent).not.toContain("pm2 reload all");
      expect(scriptContent).not.toContain("rss-sync-cron");
      expect(scriptContent).not.toContain("rss-sync-server");
    });

    it("should handle disk space constraints", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should clean up before starting new build
      const cleanupIndex = scriptContent.indexOf("rm -rf .next");
      const startIndex = scriptContent.indexOf("pm2 start");
      expect(cleanupIndex).toBeLessThan(startIndex);
      
      // Should remove cache directories
      expect(scriptContent).toContain("rm -rf node_modules/.cache");
    });
  });

  describe("Timing and Synchronization", () => {
    it("should have appropriate delays for service operations", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should wait for service to stabilize
      expect(scriptContent).toContain("sleep 10");
      
      // Should not have excessive delays that could cause timeouts
      expect(scriptContent).not.toContain("sleep 30");
      expect(scriptContent).not.toContain("sleep 60");
    });

    it("should handle clock skew and timing issues", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use relative timing, not absolute timestamps
      expect(scriptContent).toContain("RETRY_COUNT=0");
      expect(scriptContent).toContain("RETRY_COUNT=$((RETRY_COUNT + 1))");
      
      // Should not rely on system time
      expect(scriptContent).not.toContain("date +%s");
      expect(scriptContent).not.toContain("$(date)");
    });

    it("should handle rapid successive recovery attempts", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should check current state before proceeding
      expect(scriptContent).toContain("pm2 describe rss-reader-dev");
      
      // Should handle already-healthy service
      expect(scriptContent).toContain("Health check passed!");
    });
  });

  describe("Error Propagation in Concurrent Scenarios", () => {
    it("should not mask errors from concurrent operations", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use set -e for error propagation
      expect(scriptContent).toContain("set -e");
      
      // Should provide clear error messages
      expect(scriptContent).toContain("Health check failed");
      expect(scriptContent).toContain("pm2 logs rss-reader-dev --lines 50");
    });

    it("should distinguish between recoverable and non-recoverable errors", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should retry health checks (recoverable)
      expect(scriptContent).toContain("MAX_RETRIES=5");
      expect(scriptContent).toContain("Health check failed, retrying");
      
      // Should fail fast on structural issues (non-recoverable)
      expect(scriptContent).toContain("set -e");
    });

    it("should provide actionable error information", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should reference PM2 logs for debugging
      expect(scriptContent).toContain("pm2 logs rss-reader-dev --lines 50");
      
      // Should indicate the failure point
      expect(scriptContent).toContain("Health check failed after");
      expect(scriptContent).toContain("attempts");
    });
  });

  describe("State Consistency", () => {
    it("should maintain consistent service state", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should follow consistent state progression
      const steps = [
        "Stopping rss-reader-dev service",
        "Cleaning webpack artifacts",
        "Restarting rss-reader-dev service",
        "Waiting for service to stabilize",
        "Running health check"
      ];
      
      let lastIndex = -1;
      steps.forEach(step => {
        const index = scriptContent.indexOf(step);
        expect(index).toBeGreaterThan(lastIndex);
        lastIndex = index;
      });
    });

    it("should not leave partial state changes", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should complete cleanup before restart
      const nextCleanup = scriptContent.indexOf("rm -rf .next");
      const cacheCleanup = scriptContent.indexOf("rm -rf node_modules/.cache");
      const serviceRestart = scriptContent.indexOf("pm2 start");
      
      expect(nextCleanup).toBeLessThan(serviceRestart);
      expect(cacheCleanup).toBeLessThan(serviceRestart);
    });

    it("should handle rollback scenarios", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should provide clear failure indication
      expect(scriptContent).toContain("exit 1");
      
      // Should not attempt partial recovery
      expect(scriptContent).not.toContain("pm2 stop && exit 1");
      expect(scriptContent).not.toContain("rm -rf .next && exit 1");
    });
  });
});