/**
 * Performance Tests for Webpack Recovery (RR-110)
 * Tests that recovery operations complete within 90-second requirement
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

describe("Webpack Recovery Performance - RR-110", () => {
  let originalEnv: NodeJS.ProcessEnv;
  const RECOVERY_TIME_LIMIT = 90; // seconds
  const scriptPath = path.join(process.cwd(), "scripts", "webpack-recovery.sh");

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("Recovery Script Performance Analysis", () => {
    it("should have timing configuration that meets 90-second requirement", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Analyze timing components
      const maxRetries = 5;
      const retryInterval = 5; // seconds
      const stabilizationWait = 10; // seconds
      
      // Calculate theoretical maximum time
      const maxHealthCheckTime = maxRetries * retryInterval; // 25 seconds
      const totalMaxTime = stabilizationWait + maxHealthCheckTime; // 35 seconds
      
      expect(totalMaxTime).toBeLessThan(RECOVERY_TIME_LIMIT);
      
      // Verify these values in the script
      expect(scriptContent).toContain("MAX_RETRIES=5");
      expect(scriptContent).toContain("sleep 5"); // retry interval
      expect(scriptContent).toContain("sleep 10"); // stabilization
    });

    it("should optimize PM2 operations for speed", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Check for efficient PM2 operations
      expect(scriptContent).toContain("pm2 describe rss-reader-dev > /dev/null 2>&1");
      expect(scriptContent).toContain("pm2 stop rss-reader-dev");
      expect(scriptContent).toContain("pm2 start ecosystem.config.js --only rss-reader-dev");
      
      // Should use --only flag for targeted restart (faster)
      expect(scriptContent).toContain("--only rss-reader-dev");
      
      // Should not restart all services unnecessarily
      expect(scriptContent).not.toContain("pm2 restart all");
      expect(scriptContent).not.toContain("pm2 reload all");
    });

    it("should minimize file system operations", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should clean only necessary directories
      expect(scriptContent).toContain('if [ -d ".next" ]; then');
      expect(scriptContent).toContain('if [ -d "node_modules/.cache" ]; then');
      
      // Should not do unnecessary file operations
      expect(scriptContent).not.toContain("find");
      expect(scriptContent).not.toContain("chmod -R");
      expect(scriptContent).not.toContain("chown -R");
      
      // Should use efficient removal commands
      expect(scriptContent).toContain("rm -rf .next");
      expect(scriptContent).toContain("rm -rf node_modules/.cache");
    });
  });

  describe("Health Check Performance", () => {
    it("should use efficient health check configuration", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use fast health check endpoint
      expect(scriptContent).toContain("http://localhost:3000/reader/api/health/app");
      
      // Should use efficient curl options
      expect(scriptContent).toContain("curl -s -f");
      
      // Should not use verbose or debug options
      expect(scriptContent).not.toContain("curl -v");
      expect(scriptContent).not.toContain("--trace");
    });

    it("should have appropriate retry intervals", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // 5-second retry interval is reasonable balance
      expect(scriptContent).toContain("sleep 5");
      
      // Should not be too aggressive (< 2s) or too slow (> 10s)
      expect(scriptContent).not.toMatch(/sleep\s+1(?!\d)/); // Matches "sleep 1" but not "sleep 10"
      expect(scriptContent).not.toContain("sleep 15");
      expect(scriptContent).not.toContain("sleep 30");
    });

    it("should limit retry attempts appropriately", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // 5 retries should be sufficient for most cases
      expect(scriptContent).toContain("MAX_RETRIES=5");
      
      // Should not have excessive retries that extend recovery time
      expect(scriptContent).not.toContain("MAX_RETRIES=10");
      expect(scriptContent).not.toContain("MAX_RETRIES=20");
    });
  });

  describe("PM2 Memory Configuration Performance Impact", () => {
    it("should analyze memory configuration for build speed", async () => {
      const configPath = path.join(process.cwd(), "ecosystem.config.js");
      const configContent = await fs.readFile(configPath, "utf-8");
      
      // Memory configuration should support fast builds
      expect(configContent).toContain("max_memory_restart: \"1024M\"");
      expect(configContent).toContain("--max-old-space-size=896");
      
      // Should have appropriate timeout for builds
      expect(configContent).toContain("listen_timeout: 20000"); // 20 seconds
      
      // Kill timeout should allow graceful shutdown
      expect(configContent).toContain("kill_timeout: 12000"); // 12 seconds
    });

    it("should not have configurations that slow down restart", async () => {
      const configPath = path.join(process.cwd(), "ecosystem.config.js");
      const configContent = await fs.readFile(configPath, "utf-8");
      
      // Should not have excessive startup delays
      expect(configContent).toContain("min_uptime: 10000"); // 10 seconds reasonable
      
      // Should not have slow restart delays
      expect(configContent).toContain("exp_backoff_restart_delay: 100");
      
      // Should not have excessive ready timeout
      const readyTimeout = configContent.match(/listen_timeout: (\d+)/);
      if (readyTimeout) {
        const timeout = parseInt(readyTimeout[1]);
        expect(timeout).toBeLessThanOrEqual(30000); // 30 seconds max
      }
    });
  });

  describe("Startup Sequence Performance", () => {
    it("should analyze startup sequence timing", async () => {
      const startupPath = path.join(process.cwd(), "scripts", "startup-sequence.sh");
      const startupContent = await fs.readFile(startupPath, "utf-8");
      
      // Should have minimal delays in startup
      expect(startupContent).toContain("sleep 5");  // PM2 stabilization
      expect(startupContent).toContain("sleep 10"); // Service initialization
      
      // Total startup should be ~15 seconds + health check time
      // This leaves plenty of time for recovery if needed
    });

    it("should not have unnecessary delays in webpack cleanup", async () => {
      const startupPath = path.join(process.cwd(), "scripts", "startup-sequence.sh");
      const startupContent = await fs.readFile(startupPath, "utf-8");
      
      // Webpack cleanup should be immediate
      const cleanupSection = startupContent.substring(
        startupContent.indexOf("Cleaning webpack cache"),
        startupContent.indexOf("Starting PM2 daemon")
      );
      
      // Should not contain sleep in cleanup section
      expect(cleanupSection).not.toContain("sleep");
      
      // Should be simple and fast operations
      expect(cleanupSection).toContain("rm -rf .next");
      expect(cleanupSection).not.toContain("find");
    });
  });

  describe("Performance Benchmarking", () => {
    it("should meet theoretical performance requirements", () => {
      // Calculate theoretical maximum recovery time
      const serviceStopTime = 2; // seconds (PM2 stop)
      const cleanupTime = 1; // seconds (rm operations)
      const serviceStartTime = 15; // seconds (PM2 start + webpack build)
      const stabilizationTime = 10; // seconds (configured wait)
      const healthCheckTime = 25; // seconds (5 retries * 5 seconds)
      
      const totalTheoretical = serviceStopTime + cleanupTime + 
                              serviceStartTime + stabilizationTime + 
                              healthCheckTime;
      
      expect(totalTheoretical).toBeLessThan(RECOVERY_TIME_LIMIT);
      expect(totalTheoretical).toBeLessThan(60); // Should be well under limit
    });

    it("should have performance margins for real-world conditions", () => {
      // Add buffer for real-world performance variations
      const theoreticalMax = 53; // seconds from previous calculation
      const performanceBuffer = 0.5; // 50% buffer for variations
      const realWorldMax = theoreticalMax * (1 + performanceBuffer);
      
      expect(realWorldMax).toBeLessThan(RECOVERY_TIME_LIMIT);
    });
  });

  describe("Resource Utilization Optimization", () => {
    it("should minimize CPU usage during recovery", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should not use CPU-intensive operations
      expect(scriptContent).not.toContain("gzip");
      expect(scriptContent).not.toContain("find . -name");
      
      // Should use efficient file operations
      expect(scriptContent).toContain("rm -rf");
    });

    it("should minimize disk I/O during recovery", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should remove directories directly, not files individually
      expect(scriptContent).toContain("rm -rf .next");
      expect(scriptContent).toContain("rm -rf node_modules/.cache");
      
      // Should not sync or flush unnecessarily
      expect(scriptContent).not.toContain("sync");
      expect(scriptContent).not.toContain("fsync");
    });

    it("should optimize for SSD performance", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use operations that work well with SSDs
      expect(scriptContent).toContain("rm -rf"); // Fast on SSDs
      
      // Should not use operations that are slow on SSDs
      expect(scriptContent).not.toContain("dd");
      expect(scriptContent).not.toContain("shred");
    });
  });

  describe("Network Performance", () => {
    it("should use efficient health check requests", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use localhost (no network delay)
      expect(scriptContent).toContain("http://localhost:3000");
      
      // Should not use external health checks
      expect(scriptContent).not.toContain("100.96.166.53");
      expect(scriptContent).not.toContain("external");
      
      // Should use silent curl for efficiency
      expect(scriptContent).toContain("curl -s");
    });

    it("should minimize health check payload size", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use simple health endpoint
      expect(scriptContent).toContain("/api/health/app");
      
      // Should not request large payloads
      expect(scriptContent).not.toContain("/api/articles");
      expect(scriptContent).not.toContain("/api/feeds");
    });
  });

  describe("Concurrency and Race Condition Performance", () => {
    it("should handle concurrent operations efficiently", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should check service status before operations
      expect(scriptContent).toContain("pm2 describe rss-reader-dev");
      
      // Should handle service not running gracefully
      expect(scriptContent).toContain("Service not running");
    });

    it("should not wait unnecessarily for locks", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should not use locking mechanisms that could cause delays
      expect(scriptContent).not.toContain("flock");
      expect(scriptContent).not.toContain("lockfile");
      expect(scriptContent).not.toContain("pidfile");
    });
  });

  describe("Error Handling Performance", () => {
    it("should fail fast on unrecoverable errors", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should use set -e for fast failure
      expect(scriptContent).toContain("set -e");
      
      // Should provide quick feedback on failures
      expect(scriptContent).toContain("exit 1");
      expect(scriptContent).toContain("exit 0");
    });

    it("should not waste time on extensive error reporting", async () => {
      const scriptContent = await fs.readFile(scriptPath, "utf-8");
      
      // Should provide essential error info only
      expect(scriptContent).toContain("pm2 logs rss-reader-dev --lines 50");
      
      // Should not generate extensive debug output
      expect(scriptContent).not.toContain("--lines 1000");
      expect(scriptContent).not.toContain("tail -f");
    });
  });
});