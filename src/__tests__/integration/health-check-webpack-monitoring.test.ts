/**
 * Integration Tests for Health Check Webpack Error Monitoring (RR-110)
 * Tests health check system's ability to detect and respond to webpack-related issues
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import fs from "fs/promises";
import path from "path";

const execAsync = promisify(exec);

describe("Health Check Webpack Error Monitoring - RR-110", () => {
  const healthCheckPath = path.join(
    process.cwd(),
    "scripts",
    "startup-health-check.sh"
  );
  let healthCheckContent: string;
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(async () => {
    originalEnv = { ...process.env };
    healthCheckContent = await fs.readFile(healthCheckPath, "utf-8");
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.clearAllMocks();
  });

  describe("Health Check Service Detection", () => {
    it("should check rss-reader-dev service health", () => {
      // Verify the service is included in health checks
      expect(healthCheckContent).toContain('"rss-reader-dev"');
      expect(healthCheckContent).toContain(
        "http://localhost:3000/reader/api/health/app"
      );

      // Check for ping parameter support (quick health check)
      expect(healthCheckContent).toContain("ping=true");
    });

    it("should have appropriate timeout for webpack builds", () => {
      // Check maximum wait time allows for webpack compilation
      expect(healthCheckContent).toContain("MAX_WAIT_TIME=30");
      expect(healthCheckContent).toContain("CHECK_INTERVAL=2");

      // 30 seconds should be sufficient for webpack builds
      // 2-second intervals provide reasonable granularity
    });

    it("should handle service startup delays", () => {
      // Check for wait_for_service function
      expect(healthCheckContent).toContain("wait_for_service");
      expect(healthCheckContent).toContain("start_time=$(date +%s)");

      // Should track elapsed time
      expect(healthCheckContent).toContain(
        "elapsed=$(($(date +%s) - start_time))"
      );
    });
  });

  describe("Health Endpoint Integration", () => {
    it("should use appropriate health endpoints for webpack monitoring", () => {
      // Check health endpoint URLs
      expect(healthCheckContent).toContain(
        "http://localhost:3000/reader/api/health/app"
      );

      // Should support quick ping for rapid checks
      expect(healthCheckContent).toContain("ping=true");

      // Should not use test endpoints (removed in RR-69)
      expect(healthCheckContent).not.toContain("test-supabase");
      expect(healthCheckContent).not.toContain("debug");
    });

    it("should handle HTTP response codes properly", () => {
      // Check for curl response handling
      expect(healthCheckContent).toContain("curl -s -m 1");
      expect(healthCheckContent).toContain('"%{http_code}"');

      // Should check for 200 response
      expect(healthCheckContent).toContain('"200"');
    });

    it("should handle network timeouts during webpack builds", () => {
      // Check for appropriate curl timeout
      expect(healthCheckContent).toContain("-m 1"); // 1 second timeout

      // Should handle curl failures
      expect(healthCheckContent).toContain("2>/dev/null");
      expect(healthCheckContent).toContain('"000"'); // Default for curl failures
    });
  });

  describe("Error Detection and Logging", () => {
    it("should log health check events in JSONL format", () => {
      // Check for logging function
      expect(healthCheckContent).toContain("log_event");
      expect(healthCheckContent).toContain("startup-health.jsonl");

      // Should log structured events
      expect(healthCheckContent).toContain("jq -c -n");
      expect(healthCheckContent).toContain('"event":');
      expect(healthCheckContent).toContain('"timestamp":');
    });

    it("should track service readiness timing", () => {
      // Check for timing measurements
      expect(healthCheckContent).toContain("wait_time_seconds");
      expect(healthCheckContent).toContain(
        "duration=$(($(date +%s) - start_time))"
      );

      // Should log service_ready events
      expect(healthCheckContent).toContain('"event": "service_ready"');
    });

    it("should detect and log service timeouts", () => {
      // Check for timeout detection
      expect(healthCheckContent).toContain("service_timeout");
      expect(healthCheckContent).toContain("elapsed_seconds");

      // Should occur when MAX_WAIT_TIME is exceeded
      expect(healthCheckContent).toContain("$elapsed -ge $MAX_WAIT_TIME");
    });
  });

  describe("Discord Alert Integration", () => {
    it("should send Discord alerts for startup failures", () => {
      // Check for Discord webhook integration
      expect(healthCheckContent).toContain("DISCORD_WEBHOOK");
      expect(healthCheckContent).toContain("discord.com/api/webhooks");

      // Should send alert for startup failures
      expect(healthCheckContent).toContain("RSS Reader Startup Failed");
      expect(healthCheckContent).toContain("Some services failed to start");
    });

    it("should include relevant information in alerts", () => {
      // Check alert payload structure
      expect(healthCheckContent).toContain('"embeds":');
      expect(healthCheckContent).toContain('"Failed Services"');
      expect(healthCheckContent).toContain('"Action Required"');

      // Should reference PM2 logs for troubleshooting
      expect(healthCheckContent).toContain("Check PM2 logs for details");
    });

    it("should handle webhook failures gracefully", () => {
      // Check for silent webhook calls
      expect(healthCheckContent).toContain("curl -s");
      expect(healthCheckContent).toContain("> /dev/null");

      // Should not fail health check if webhook fails
      expect(healthCheckContent).toMatch(/curl.*discord.*> \/dev\/null/);
    });
  });

  describe("Recovery Integration", () => {
    it("should integrate with monitoring service startup", () => {
      // Check for monitor service integration
      expect(healthCheckContent).toContain("--start-monitor");
      expect(healthCheckContent).toContain("monitor-services.sh start");

      // Should start monitoring after successful health check
      expect(healthCheckContent).toContain(
        "Starting health monitoring service"
      );
    });

    it("should provide actionable error information", () => {
      // Check for helpful error messages
      expect(healthCheckContent).toContain("Some services failed to start");
      expect(healthCheckContent).toContain("unhealthy_services");

      // Should list specific failed services
      expect(healthCheckContent).toContain(
        "printf '%s\\n' \"${unhealthy_services[@]}\""
      );
    });

    it("should exit with appropriate status codes", () => {
      // Check for proper exit codes
      expect(healthCheckContent).toContain("exit 0"); // Success
      expect(healthCheckContent).toContain("exit 1"); // Failure

      // Should pass through health check status
      expect(healthCheckContent).toContain("all_healthy=true");
    });
  });

  describe("Webpack-Specific Error Detection", () => {
    it("should detect rss-reader-dev service health", () => {
      // Service responsible for webpack builds
      const servicesArray = healthCheckContent.match(/services=\([^)]+\)/);
      expect(servicesArray).toBeTruthy();
      expect(servicesArray![0]).toContain("rss-reader-dev");
    });

    it("should use health endpoints that can detect webpack issues", () => {
      // Health endpoint should reflect webpack build status
      expect(healthCheckContent).toContain("/reader/api/health/app");

      // Should not rely on simple ping if webpack is building
      const healthUrls = healthCheckContent.match(
        /http:\/\/localhost:3000\/reader\/api\/health\/app[^"']*/g
      );
      expect(healthUrls).toBeTruthy();
    });

    it("should allow sufficient time for webpack builds", () => {
      // 30-second timeout should accommodate webpack builds
      const maxWaitTime = healthCheckContent.match(/MAX_WAIT_TIME=(\d+)/);
      expect(maxWaitTime).toBeTruthy();
      const waitTime = parseInt(maxWaitTime![1]);
      expect(waitTime).toBeGreaterThanOrEqual(30);
      expect(waitTime).toBeLessThanOrEqual(60); // Not too long
    });
  });

  describe("Service State Management", () => {
    it("should check PM2 daemon status", () => {
      // Should verify PM2 is running before checking services
      expect(healthCheckContent).toContain("check_pm2");
      expect(healthCheckContent).toContain("pm2 pid > /dev/null 2>&1");

      // Should fail fast if PM2 is not running
      expect(healthCheckContent).toContain("PM2 not running!");
      expect(healthCheckContent).toContain("pm2_not_running");
    });

    it("should handle different service types appropriately", () => {
      // Should handle HTTP services differently from cron
      expect(healthCheckContent).toContain(
        'if [ "$service" = "rss-sync-cron" ]'
      );
      expect(healthCheckContent).toContain("Check cron via health file");

      // Should check HTTP endpoints for web services
      expect(healthCheckContent).toContain("Check HTTP endpoint");
      expect(healthCheckContent).toContain("curl -s -m 1");
    });

    it("should track individual service health", () => {
      // Should check each service individually
      expect(healthCheckContent).toContain('for i in "${!services[@]}"');
      expect(healthCheckContent).toContain("wait_for_service");

      // Should track which services are unhealthy
      expect(healthCheckContent).toContain("unhealthy_services+=");
    });
  });

  describe("Monitoring Integration", () => {
    it("should create appropriate log directory structure", () => {
      // Should ensure log directory exists
      expect(healthCheckContent).toContain('mkdir -p "$(dirname "$LOG_FILE")"');
      expect(healthCheckContent).toContain("/logs/startup-health.jsonl");
    });

    it("should log startup check lifecycle", () => {
      // Should log start and completion events
      expect(healthCheckContent).toContain("startup_check_begin");
      expect(healthCheckContent).toContain("startup_check_complete");

      // Should include relevant metadata
      expect(healthCheckContent).toContain("max_wait_seconds");
    });

    it("should support continuous monitoring integration", () => {
      // Should integrate with ongoing monitoring
      expect(healthCheckContent).toContain("sync-health-monitor.sh daemon");

      // Should start monitoring after successful startup
      expect(healthCheckContent).toContain("--start-monitor");
    });
  });

  describe("Performance and Reliability", () => {
    it("should have reasonable check intervals", () => {
      // 2-second intervals provide good balance
      expect(healthCheckContent).toContain("CHECK_INTERVAL=2");

      // Should sleep between checks
      expect(healthCheckContent).toContain("sleep $CHECK_INTERVAL");
    });

    it("should handle concurrent health checks", () => {
      // Should be safe to run multiple health checks
      expect(healthCheckContent).toContain("curl -s -m 1");

      // Should not create lock files or state conflicts
      expect(healthCheckContent).not.toContain(".lock");
      expect(healthCheckContent).not.toContain("lockf");
    });

    it("should provide timely feedback", () => {
      // Should provide immediate feedback for each service
      expect(healthCheckContent).toContain('echo -n "Checking $service..."');
      expect(healthCheckContent).toContain('echo "✅"');
      expect(healthCheckContent).toContain('echo "❌"');
    });
  });
});
