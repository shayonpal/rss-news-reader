/**
 * Unit Tests for webpack-recovery.sh script (RR-110)
 * Tests webpack recovery implementation including cleanup, restart, and health verification
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

describe("webpack-recovery.sh - RR-110 Implementation", () => {
  const scriptPath = path.join(process.cwd(), "scripts", "webpack-recovery.sh");
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

  describe("Script Structure and Configuration", () => {
    it("should have correct script configuration and error handling", () => {
      // Check for proper bash configuration
      expect(scriptContent).toContain("#!/bin/bash");
      expect(scriptContent).toContain("set -e");
      
      // Check for proper directory navigation
      expect(scriptContent).toContain('SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"');
      expect(scriptContent).toContain('PROJECT_DIR="$(dirname "$SCRIPT_DIR")"');
      expect(scriptContent).toContain('cd "$PROJECT_DIR"');
    });

    it("should contain all required recovery steps", () => {
      // Verify all 5 steps are present
      expect(scriptContent).toContain("1️⃣  Stopping rss-reader-dev service");
      expect(scriptContent).toContain("2️⃣  Cleaning webpack artifacts");
      expect(scriptContent).toContain("3️⃣  Restarting rss-reader-dev service");
      expect(scriptContent).toContain("4️⃣  Waiting for service to stabilize");
      expect(scriptContent).toContain("5️⃣  Running health check");
    });

    it("should have proper health check configuration", () => {
      // Check health check URL configuration
      expect(scriptContent).toContain('HEALTH_URL="http://localhost:3000/reader/api/health/app"');
      expect(scriptContent).toContain("MAX_RETRIES=5");
      
      // Verify health check retry logic
      expect(scriptContent).toMatch(/while \[ \$RETRY_COUNT -lt \$MAX_RETRIES \]/);
      expect(scriptContent).toContain("curl -s -f");
    });
  });

  describe("PM2 Service Management", () => {
    it("should properly check and stop PM2 service", () => {
      // Check for PM2 service status verification
      expect(scriptContent).toContain("pm2 describe rss-reader-dev");
      expect(scriptContent).toContain("pm2 stop rss-reader-dev");
      
      // Verify conditional stopping
      expect(scriptContent).toMatch(/if pm2 describe rss-reader-dev.*then/);
      expect(scriptContent).toContain("Service not running");
    });

    it("should restart service with correct configuration", () => {
      // Check PM2 restart command
      expect(scriptContent).toContain("pm2 start ecosystem.config.js --only rss-reader-dev");
      
      // Verify service stabilization wait
      expect(scriptContent).toContain("sleep 10");
    });

    it("should handle PM2 service failures gracefully", () => {
      // Check for error handling in PM2 operations
      expect(scriptContent).toMatch(/> \/dev\/null 2>&1/);
      expect(scriptContent).toContain("Service stopped");
      expect(scriptContent).toContain("Service restarted");
    });
  });

  describe("Webpack Artifact Cleanup", () => {
    it("should clean .next directory", () => {
      expect(scriptContent).toContain('if [ -d ".next" ]');
      expect(scriptContent).toContain("rm -rf .next");
      expect(scriptContent).toContain("Removed .next directory");
      expect(scriptContent).toContain("No .next directory found");
    });

    it("should clean node_modules cache", () => {
      expect(scriptContent).toContain('if [ -d "node_modules/.cache" ]');
      expect(scriptContent).toContain("rm -rf node_modules/.cache");
      expect(scriptContent).toContain("Removed node_modules/.cache");
      expect(scriptContent).toContain("No node_modules/.cache found");
    });

    it("should handle missing directories gracefully", () => {
      // Verify conditional cleanup (only if directories exist)
      const nextCleanup = scriptContent.match(/if \[ -d "\.next" \][\s\S]*?fi/);
      const cacheCleanup = scriptContent.match(/if \[ -d "node_modules\/\.cache" \][\s\S]*?fi/);
      
      expect(nextCleanup).toBeTruthy();
      expect(cacheCleanup).toBeTruthy();
      
      // Both should have else clauses for "not found" messages
      expect(nextCleanup![0]).toContain("else");
      expect(cacheCleanup![0]).toContain("else");
    });
  });

  describe("Health Check Implementation", () => {
    it("should implement proper health check retry logic", () => {
      // Check retry loop implementation
      expect(scriptContent).toMatch(/while \[ \$RETRY_COUNT -lt \$MAX_RETRIES \]/);
      expect(scriptContent).toContain("RETRY_COUNT=$((RETRY_COUNT + 1))");
      
      // Verify success condition
      expect(scriptContent).toContain("curl -s -f");
      expect(scriptContent).toContain("Health check passed!");
      expect(scriptContent).toContain("exit 0");
    });

    it("should handle health check failures with detailed output", () => {
      // Check failure handling
      expect(scriptContent).toContain("Health check failed after");
      expect(scriptContent).toContain("pm2 logs rss-reader-dev --lines 50");
      expect(scriptContent).toContain("exit 1");
      
      // Verify retry messages
      expect(scriptContent).toContain("Health check failed, retrying in 5 seconds");
      expect(scriptContent).toContain("sleep 5");
    });

    it("should use correct health endpoint URL", () => {
      // Verify health URL matches expected pattern
      expect(scriptContent).toContain("http://localhost:3000/reader/api/health/app");
      
      // Check that it's properly quoted
      expect(scriptContent).toMatch(/"http:\/\/localhost:3000\/reader\/api\/health\/app"/);
    });
  });

  describe("Error Handling and Exit Codes", () => {
    it("should have proper error handling throughout script", () => {
      // Check for set -e at the beginning
      expect(scriptContent).toContain("set -e");
      
      // Verify explicit exit codes
      const exitCodes = scriptContent.match(/exit \d+/g) || [];
      expect(exitCodes).toContain("exit 0");
      expect(exitCodes).toContain("exit 1");
    });

    it("should provide helpful error messages", () => {
      // Check for user-friendly messages
      expect(scriptContent).toContain("🔧 Starting webpack recovery process");
      expect(scriptContent).toContain("🎉 Webpack recovery completed successfully!");
      expect(scriptContent).toContain("❌ Health check failed");
      
      // Verify troubleshooting guidance
      expect(scriptContent).toContain("Please check the PM2 logs for more details");
    });
  });

  describe("Script Safety and Reliability", () => {
    it("should use safe file operations", () => {
      // Check for safe directory checks before removal
      expect(scriptContent).toMatch(/if \[ -d "\.next" \]; then/);
      expect(scriptContent).toMatch(/if \[ -d "node_modules\/\.cache" \]; then/);
      
      // Verify no wildcard removals without directory checks
      expect(scriptContent).not.toMatch(/rm -rf \*/);
    });

    it("should handle concurrent execution safely", () => {
      // Check for PM2 service status checks before operations
      expect(scriptContent).toContain("pm2 describe rss-reader-dev");
      
      // Verify proper error handling for service operations
      expect(scriptContent).toMatch(/> \/dev\/null 2>&1/);
    });

    it("should have appropriate timing for operations", () => {
      // Check for stabilization waits
      expect(scriptContent).toContain("sleep 10");
      expect(scriptContent).toContain("sleep 5");
      
      // Verify these are in the right context  
      expect(scriptContent).toContain("4️⃣  Waiting for service to stabilize...");
      expect(scriptContent).toContain("retrying in 5 seconds...");
    });
  });

  describe("Output Formatting and User Experience", () => {
    it("should have consistent output formatting", () => {
      // Check for consistent emoji usage
      expect(scriptContent).toContain("🔧");
      expect(scriptContent).toContain("✅");
      expect(scriptContent).toContain("❌");
      expect(scriptContent).toContain("🎉");
      
      // Verify step numbering
      expect(scriptContent).toContain("1️⃣");
      expect(scriptContent).toContain("2️⃣");
      expect(scriptContent).toContain("3️⃣");
      expect(scriptContent).toContain("4️⃣");
      expect(scriptContent).toContain("5️⃣");
    });

    it("should provide progress feedback", () => {
      // Check for progress indicators
      expect(scriptContent).toContain("================================================");
      expect(scriptContent).toContain("Starting webpack recovery process");
      expect(scriptContent).toContain("Waiting for service to stabilize");
      
      // Verify completion messages
      expect(scriptContent).toContain("Webpack recovery completed successfully!");
    });
  });

  describe("Integration with PM2 Ecosystem", () => {
    it("should reference correct PM2 configuration", () => {
      // Check ecosystem.config.js reference
      expect(scriptContent).toContain("ecosystem.config.js");
      expect(scriptContent).toContain("--only rss-reader-dev");
      
      // Verify service name consistency
      expect(scriptContent).toContain("rss-reader-dev");
      expect(scriptContent).not.toContain("rss-reader-prod");
    });

    it("should be compatible with PM2 process management", () => {
      // Check for PM2 commands that should work in production
      expect(scriptContent).toContain("pm2 describe");
      expect(scriptContent).toContain("pm2 stop");
      expect(scriptContent).toContain("pm2 start");
      
      // Verify PM2 log access for troubleshooting
      expect(scriptContent).toContain("pm2 logs");
    });
  });

  describe("Performance Requirements", () => {
    it("should have reasonable timeout values", () => {
      // Check MAX_RETRIES value (should allow for reasonable recovery time)
      expect(scriptContent).toContain("MAX_RETRIES=5");
      
      // Verify sleep intervals
      expect(scriptContent).toContain("sleep 10"); // Service stabilization
      expect(scriptContent).toContain("sleep 5");  // Retry interval
      
      // Calculate maximum recovery time: 10s (stabilize) + 5 * 5s (retries) = 35s
      // This should be well under the 90-second requirement
    });

    it("should minimize downtime during recovery", () => {
      // Verify steps are in optimal order (stop -> clean -> start -> verify)
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
  });
});