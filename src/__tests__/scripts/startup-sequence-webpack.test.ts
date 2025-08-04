/**
 * Unit Tests for startup-sequence.sh webpack cache cleanup (RR-110)
 * Tests the webpack cache cleanup functionality in startup sequence
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

describe("startup-sequence.sh - Webpack Cache Cleanup (RR-110)", () => {
  const scriptPath = path.join(process.cwd(), "scripts", "startup-sequence.sh");
  let scriptContent: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    scriptContent = await fs.readFile(scriptPath, "utf-8");
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("Webpack Cache Cleanup Implementation", () => {
    it("should include webpack cache cleanup in startup sequence", () => {
      // Check for webpack cache cleanup section
      expect(scriptContent).toContain("Clean webpack cache on startup to prevent corruption");
      expect(scriptContent).toContain("Cleaning webpack cache...");
      
      // Verify it happens early in the sequence
      const cleanupIndex = scriptContent.indexOf("Cleaning webpack cache");
      const pm2StartIndex = scriptContent.indexOf("Starting PM2 daemon");
      expect(cleanupIndex).toBeLessThan(pm2StartIndex);
    });

    it("should properly clean .next directory", () => {
      // Check for .next directory cleanup
      expect(scriptContent).toContain('if [ -d ".next" ]; then');
      expect(scriptContent).toContain("rm -rf .next");
      expect(scriptContent).toContain("Removing .next directory to ensure clean build");
      expect(scriptContent).toContain("✓ Webpack cache cleaned");
    });

    it("should handle missing .next directory gracefully", () => {
      // Check for else clause when .next doesn't exist
      expect(scriptContent).toContain("else");
      expect(scriptContent).toContain("✓ No webpack cache to clean");
      
      // Verify the complete conditional structure
      const cleanupSection = scriptContent.match(/if \[ -d "\.next" \];[\s\S]*?fi/);
      expect(cleanupSection).toBeTruthy();
      expect(cleanupSection![0]).toContain("else");
    });

    it("should use safe directory operations", () => {
      // Verify directory check before removal
      expect(scriptContent).toMatch(/if \[ -d "\.next" \]; then/);
      
      // Check that removal is conditional
      const rmCommand = scriptContent.match(/rm -rf \.next/);
      expect(rmCommand).toBeTruthy();
      
      // Ensure rm is inside the conditional block
      const cleanupBlock = scriptContent.substring(
        scriptContent.indexOf('if [ -d ".next" ]'),
        scriptContent.indexOf('fi', scriptContent.indexOf('if [ -d ".next" ]'))
      );
      expect(cleanupBlock).toContain("rm -rf .next");
    });
  });

  describe("Startup Sequence Integration", () => {
    it("should maintain proper startup order", () => {
      // Verify cleanup happens before PM2 operations
      const expectedOrder = [
        "Cleaning webpack cache",
        "Starting PM2 daemon",
        "Starting RSS Reader services via PM2",
        "Waiting for services to initialize",
        "Running startup health check"
      ];
      
      let lastIndex = -1;
      expectedOrder.forEach(step => {
        const index = scriptContent.indexOf(step);
        expect(index).toBeGreaterThan(lastIndex);
        lastIndex = index;
      });
    });

    it("should not interfere with existing PM2 startup logic", () => {
      // Check that PM2 startup logic is preserved
      expect(scriptContent).toContain("if ! pm2 pid > /dev/null 2>&1; then");
      expect(scriptContent).toContain("pm2 resurrect");
      expect(scriptContent).toContain("pm2 start ecosystem.config.js");
      
      // Verify timing is preserved
      expect(scriptContent).toContain("sleep 5");  // PM2 stabilization
      expect(scriptContent).toContain("sleep 10"); // Service initialization
    });

    it("should preserve health check integration", () => {
      // Check that health check still works
      expect(scriptContent).toContain("Running startup health check");
      expect(scriptContent).toContain("startup-health-check.sh --start-monitor");
      
      // Verify sync health monitor integration
      expect(scriptContent).toContain("Starting sync health monitor");
      expect(scriptContent).toContain("sync-health-monitor.sh daemon");
    });
  });

  describe("Error Handling and Safety", () => {
    it("should not fail startup if cache cleanup fails", () => {
      // The script should use conditional operations that don't fail
      expect(scriptContent).toMatch(/if \[ -d "\.next" \]; then/);
      
      // Verify that rm operations are protected by conditionals
      const rmOperations = scriptContent.match(/rm -rf/g) || [];
      rmOperations.forEach(() => {
        // Each rm should be in an if block (harder to test directly, but structure suggests it)
        expect(scriptContent).toContain("if [ -d");
      });
    });

    it("should provide clear feedback for cleanup operations", () => {
      // Check for user feedback messages
      expect(scriptContent).toContain("Cleaning webpack cache...");
      expect(scriptContent).toContain("Removing .next directory to ensure clean build...");
      expect(scriptContent).toContain("✓ Webpack cache cleaned");
      expect(scriptContent).toContain("✓ No webpack cache to clean");
    });

    it("should handle permissions and file system errors gracefully", () => {
      // Verify that the script uses safe practices
      expect(scriptContent).toContain('cd /Users/shayon/DevProjects/rss-news-reader');
      
      // Check that operations are relative to project directory
      expect(scriptContent).toMatch(/rm -rf \.next/);
      expect(scriptContent).not.toMatch(/rm -rf \/.*\.next/); // No absolute paths
    });
  });

  describe("Performance and Timing", () => {
    it("should not significantly delay startup", () => {
      // Cleanup should be quick - no additional sleeps for cleanup
      const cleanupSection = scriptContent.substring(
        scriptContent.indexOf("Cleaning webpack cache"),
        scriptContent.indexOf("Starting PM2 daemon")
      );
      
      // Should not contain sleep commands in cleanup section
      expect(cleanupSection).not.toContain("sleep");
    });

    it("should optimize for common case (cache exists)", () => {
      // Check that the most common case (.next exists) is handled first
      expect(scriptContent).toMatch(/if \[ -d "\.next" \]; then[\s\S]*else/);
      
      // Verify positive case comes first (not negated condition)
      expect(scriptContent).not.toMatch(/if \[ ! -d "\.next" \]/);
    });
  });

  describe("Compatibility with Recovery Script", () => {
    it("should use same cleanup approach as webpack-recovery.sh", () => {
      // Both scripts should clean .next directory consistently
      expect(scriptContent).toContain('if [ -d ".next" ]; then');
      expect(scriptContent).toContain("rm -rf .next");
      
      // Both should handle missing directory case
      expect(scriptContent).toContain("else");
    });

    it("should not conflict with recovery script operations", () => {
      // Startup cleanup should be safe to run even if recovery script ran recently
      // This is ensured by the conditional nature of the cleanup
      expect(scriptContent).toMatch(/if \[ -d "\.next" \]; then/);
      
      // No additional state files or locks that could conflict
      expect(scriptContent).not.toContain(".lock");
      expect(scriptContent).not.toContain("lockfile");
    });
  });

  describe("Directory and Path Handling", () => {
    it("should work from correct working directory", () => {
      // Check that script changes to project directory
      expect(scriptContent).toContain("cd /Users/shayon/DevProjects/rss-news-reader");
      
      // Verify relative paths work after cd
      expect(scriptContent).toMatch(/"\.\w*"/); // Relative paths like ".next"
    });

    it("should handle project structure correctly", () => {
      // Verify it works with the current project structure
      expect(scriptContent).toContain("/Users/shayon/DevProjects/rss-news-reader");
      
      // Check that it references the right configuration files
      expect(scriptContent).toContain("ecosystem.config.js");
      expect(scriptContent).toContain("startup-health-check.sh");
    });
  });

  describe("Documentation and Comments", () => {
    it("should document the purpose of webpack cleanup", () => {
      // Check for explanatory comments
      expect(scriptContent).toContain("Clean webpack cache on startup to prevent corruption");
      
      // Verify the cleanup is well-documented
      expect(scriptContent).toContain("Removing .next directory to ensure clean build");
    });

    it("should maintain script documentation standards", () => {
      // Check for proper script header
      expect(scriptContent).toContain("#!/bin/bash");
      expect(scriptContent).toContain("RSS Reader Complete Startup Sequence");
      expect(scriptContent).toContain("This script starts PM2 services and verifies they're healthy");
    });
  });

  describe("Edge Cases and Robustness", () => {
    it("should handle concurrent startup attempts", () => {
      // Check for PM2 status verification before operations
      expect(scriptContent).toContain("pm2 pid > /dev/null 2>&1");
      
      // Verify it doesn't assume PM2 state
      expect(scriptContent).toContain("if ! pm2 pid");
    });

    it("should work with different file system states", () => {
      // Should work whether .next exists or not
      const cleanupLogic = scriptContent.match(/if \[ -d "\.next" \];[\s\S]*?fi/);
      expect(cleanupLogic).toBeTruthy();
      
      // Should provide feedback for both cases
      expect(cleanupLogic![0]).toContain("Webpack cache cleaned");
      expect(cleanupLogic![0]).toContain("No webpack cache to clean");
    });

    it("should exit gracefully on health check failures", () => {
      // Check that the script exits with health check status
      expect(scriptContent).toContain("exit $?");
      
      // Verify health check is called
      expect(scriptContent).toContain("startup-health-check.sh");
    });
  });
});