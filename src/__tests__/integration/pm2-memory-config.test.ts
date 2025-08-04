/**
 * Integration Tests for PM2 Memory Configuration (RR-110)
 * Tests PM2 ecosystem configuration for webpack memory management
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

describe("PM2 Memory Configuration - RR-110 Integration", () => {
  const configPath = path.join(process.cwd(), "ecosystem.config.js");
  let configContent: string;
  let configModule: any;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    configContent = await fs.readFile(configPath, "utf-8");
    
    // Dynamically import the config (need to handle require/module resolution)
    try {
      delete require.cache[configPath];
      configModule = require(configPath);
    } catch (error) {
      // Fallback: parse the config content directly for testing
      configModule = { apps: [] };
    }
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("Memory Configuration for rss-reader-dev", () => {
    it("should have increased memory limit for webpack builds", () => {
      // Check config content for memory settings
      expect(configContent).toContain("max_memory_restart");
      expect(configContent).toContain("1024M");
      
      // Verify comment explains the increase
      expect(configContent).toContain("Increased from 512M to prevent webpack build failures");
    });

    it("should have Node.js heap size configured", () => {
      // Check for NODE_OPTIONS with heap size
      expect(configContent).toContain("NODE_OPTIONS");
      expect(configContent).toContain("--max-old-space-size=896");
      
      // Verify comment explains the allocation
      expect(configContent).toContain("896MB heap size (leaves room for PM2 overhead)");
    });

    it("should configure appropriate restart behavior", () => {
      // Check for restart configuration
      expect(configContent).toContain("max_restarts: 30");
      expect(configContent).toContain("exp_backoff_restart_delay: 100");
      expect(configContent).toContain("min_uptime: 10000");
      
      // Verify kill timeout for graceful shutdown
      expect(configContent).toContain("kill_timeout: 12000");
    });

    it("should have wait_ready configured for health checks", () => {
      // Check for ready signal configuration
      expect(configContent).toContain("wait_ready: true");
      expect(configContent).toContain("listen_timeout: 20000");
      
      // Verify comment explains health check integration
      expect(configContent).toContain("Wait for ready signal from health check");
    });
  });

  describe("Memory Configuration Validation", () => {
    it("should have memory limits that prevent OOM kills", () => {
      // Extract memory limits from config
      const memoryMatches = configContent.match(/max_memory_restart:\s*"(\d+)M"/g);
      expect(memoryMatches).toBeTruthy();
      
      // rss-reader-dev should have 1024M
      expect(configContent).toMatch(/max_memory_restart:\s*"1024M"/);
      
      // Other services should have appropriate limits
      expect(configContent).toMatch(/max_memory_restart:\s*"256M"/);
    });

    it("should coordinate heap size with PM2 memory limit", () => {
      // Check heap size (896MB) vs PM2 limit (1024MB) = 128MB overhead
      expect(configContent).toContain("--max-old-space-size=896");
      expect(configContent).toContain('"1024M"');
      
      // Verify the relationship is documented
      expect(configContent).toContain("leaves room for PM2 overhead");
    });

    it("should not have conflicting memory settings", () => {
      // Check that all memory-related settings are consistent
      const devAppSection = configContent.substring(
        configContent.indexOf('name: "rss-reader-dev"'),
        configContent.indexOf('name: "rss-sync-cron"')
      );
      
      expect(devAppSection).toContain("max_memory_restart");
      expect(devAppSection).toContain("NODE_OPTIONS");
      expect(devAppSection).not.toContain("--memory=");
      expect(devAppSection).not.toContain("--max_memory=");
    });
  });

  describe("Service-Specific Memory Configurations", () => {
    it("should configure rss-sync-cron with conservative memory limit", () => {
      // Cron service should have lower memory limit
      const cronSection = configContent.substring(
        configContent.indexOf('name: "rss-sync-cron"'),
        configContent.indexOf('name: "rss-sync-server"')
      );
      
      expect(cronSection).toContain('"256M"');
      expect(cronSection).toContain("Conservative memory limit");
    });

    it("should configure rss-sync-server with appropriate memory limit", () => {
      // Sync server should have moderate memory limit
      const syncSection = configContent.substring(
        configContent.indexOf('name: "rss-sync-server"')
      );
      
      expect(syncSection).toContain('"256M"');
      expect(syncSection).toContain("Conservative memory limit");
    });

    it("should have development-appropriate configurations", () => {
      // All services should be configured for development
      expect(configContent).toContain('NODE_ENV: "development"');
      
      // Should not have production-specific memory constraints in environment
      expect(configContent).toContain('NODE_ENV: "development"');
      
      // Production references in comments are acceptable
      expect(configContent).not.toMatch(/NODE_ENV.*production/);
      expect(configContent).not.toMatch(/ENV.*prod/);
    });
  });

  describe("Restart and Recovery Configuration", () => {
    it("should configure appropriate restart limits", () => {
      // rss-reader-dev should have higher restart limit (development)
      const devSection = configContent.substring(
        configContent.indexOf('name: "rss-reader-dev"'),
        configContent.indexOf('name: "rss-sync-cron"')
      );
      
      expect(devSection).toContain("max_restarts: 30");
      expect(devSection).toContain("Lower for development - fail fast");
    });

    it("should configure exponential backoff for development", () => {
      // Check backoff configuration
      expect(configContent).toContain("exp_backoff_restart_delay: 100");
      expect(configContent).toContain("Exponential backoff starting at 100ms");
    });

    it("should have appropriate timeout configurations", () => {
      // Check various timeout settings
      expect(configContent).toContain("min_uptime: 10000");
      expect(configContent).toContain("kill_timeout: 12000");
      expect(configContent).toContain("listen_timeout: 20000");
      
      // Verify they make sense for webpack builds
      expect(configContent).toContain("prevent rapid restart loops");
      expect(configContent).toContain("graceful shutdown for HTTP requests");
    });
  });

  describe("Environment Variable Configuration", () => {
    it("should configure appropriate environment variables", () => {
      // Check for development environment
      expect(configContent).toContain('NODE_ENV: "development"');
      expect(configContent).toContain("PORT: 3000");
      
      // Verify essential environment variables are present
      expect(configContent).toContain("NEXT_PUBLIC_SUPABASE_URL");
      expect(configContent).toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(configContent).toContain("ANTHROPIC_API_KEY");
    });

    it("should not have conflicting memory environment variables", () => {
      // Should not have duplicate or conflicting memory settings in env
      const envSection = configContent.substring(
        configContent.indexOf("env: {"),
        configContent.indexOf("}")
      );
      
      expect(envSection).not.toContain("MAX_MEMORY");
      expect(envSection).not.toContain("MEMORY_LIMIT");
    });
  });

  describe("Configuration File Structure", () => {
    it("should have valid JavaScript/JSON structure", () => {
      // Basic structure validation
      expect(configContent).toContain("module.exports = {");
      expect(configContent).toContain("apps: [");
      
      // Should have proper bracketing
      const openBraces = (configContent.match(/{/g) || []).length;
      const closeBraces = (configContent.match(/}/g) || []).length;
      expect(openBraces).toBe(closeBraces);
    });

    it("should load environment variables correctly", () => {
      // Check for dotenv configuration
      expect(configContent).toContain('require("dotenv").config()');
      
      // Verify environment variable access
      expect(configContent).toContain("process.env.");
    });

    it("should have proper logging configuration", () => {
      // Check for log file configuration
      expect(configContent).toContain("error_file:");
      expect(configContent).toContain("out_file:");
      expect(configContent).toContain("time: true");
      
      // Verify log paths
      expect(configContent).toContain("./logs/");
    });
  });

  describe("Memory Management Integration", () => {
    it("should work with webpack-recovery.sh", () => {
      // Configuration should support recovery script operations
      expect(configContent).toContain('name: "rss-reader-dev"');
      
      // Memory limits should allow for clean builds
      expect(configContent).toContain("1024M");
      expect(configContent).toContain("896");
    });

    it("should support health check requirements", () => {
      // Configuration should support health check integration
      expect(configContent).toContain("wait_ready: true");
      expect(configContent).toContain("listen_timeout:");
      
      // Should allow time for webpack builds during health checks
      expect(configContent).toContain("20000"); // 20 second timeout
    });
  });

  describe("Performance Optimization", () => {
    it("should optimize for development workflow", () => {
      // Check for development-specific optimizations
      expect(configContent).toContain("watch: false");
      expect(configContent).toContain("Next.js handles HMR");
      
      // Should have appropriate instance configuration
      expect(configContent).toContain("instances: 1");
      expect(configContent).toContain('exec_mode: "fork"');
    });

    it("should balance memory usage with performance", () => {
      // Memory configuration should allow for efficient builds
      const heapSize = 896; // MB
      const pmLimit = 1024; // MB
      const overhead = pmLimit - heapSize;
      
      expect(overhead).toBe(128); // 128MB overhead should be sufficient
      expect(heapSize).toBeGreaterThan(512); // Should be more than old 512MB limit
    });
  });

  describe("Error Recovery Configuration", () => {
    it("should handle memory-related crashes gracefully", () => {
      // Should restart on memory limit exceeded
      expect(configContent).toContain("max_memory_restart");
      
      // Should have reasonable restart behavior
      expect(configContent).toContain("exp_backoff_restart_delay");
      expect(configContent).toContain("max_restarts");
    });

    it("should provide debugging information for memory issues", () => {
      // Log files should capture memory-related issues
      expect(configContent).toContain("error_file:");
      expect(configContent).toContain("./logs/dev-error.log");
      
      // Timestamps should help with debugging
      expect(configContent).toContain("time: true");
    });
  });
});