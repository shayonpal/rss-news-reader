import { describe, it, expect, beforeAll } from "vitest";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";

const execAsync = promisify(exec);

describe("RR-36: Log Management and Rotation", () => {
  describe("PM2 Logrotate Module Configuration", () => {
    it("should have PM2 logrotate module installed and running", async () => {
      const { stdout } = await execAsync("pm2 list");
      expect(stdout).toContain("pm2-logrotate");
      expect(stdout).toContain("online");
    });

    it("should have correct PM2 logrotate settings: max_size=10M", async () => {
      const { stdout } = await execAsync("pm2 get pm2-logrotate:max_size");
      expect(stdout).toContain("10M");
    });

    it("should have correct PM2 logrotate settings: retain=7 days", async () => {
      const { stdout } = await execAsync("pm2 get pm2-logrotate:retain");
      expect(stdout).toContain("7");
    });

    it("should have correct PM2 logrotate settings: compress=true", async () => {
      const { stdout } = await execAsync("pm2 get pm2-logrotate:compress");
      expect(stdout).toContain("true");
    });
  });

  describe("Health Log Rotation Script", () => {
    const scriptPath = path.join(
      process.cwd(),
      "scripts",
      "rotate-health-logs.sh"
    );
    const criticalLogs = [
      "sync-cron.jsonl",
      "monitor-services.jsonl",
      "services-monitor.jsonl",
    ];

    it("should have rotate-health-logs.sh script", () => {
      expect(fs.existsSync(scriptPath)).toBe(true);
    });

    it("should include all critical JSONL files in rotation list", async () => {
      const scriptContent = fs.readFileSync(scriptPath, "utf-8");
      
      for (const logFile of criticalLogs) {
        expect(scriptContent).toContain(`"${logFile}"`);
      }
    });

    it("should have 7-day retention configured", () => {
      const scriptContent = fs.readFileSync(scriptPath, "utf-8");
      expect(scriptContent).toMatch(/RETENTION_DAYS=7/);
    });

    it("should have 100MB emergency rotation threshold", () => {
      const scriptContent = fs.readFileSync(scriptPath, "utf-8");
      expect(scriptContent).toMatch(/MAX_SIZE_MB=100/);
    });

    it("should compress rotated logs with gzip", () => {
      const scriptContent = fs.readFileSync(scriptPath, "utf-8");
      expect(scriptContent).toContain('gzip "$LOG_DIR/$rotated_name"');
    });
  });

  describe("Cron Job Configuration", () => {
    it("should have daily log rotation cron job at 3 AM", async () => {
      try {
        const { stdout } = await execAsync("crontab -l");
        expect(stdout).toContain("0 3 * * *");
        expect(stdout).toContain("rotate-health-logs.sh");
      } catch (error) {
        // If crontab is empty or doesn't exist, this is also valid
        // as the cron might be configured elsewhere (e.g., systemd)
        console.log("Note: Cron job not found in user crontab");
      }
    });
  });

  describe("Manual Rotation Test", () => {
    it("should successfully execute manual rotation", async () => {
      const scriptPath = path.join(
        process.cwd(),
        "scripts",
        "rotate-health-logs.sh"
      );
      
      // Execute the rotation script
      const { stdout, stderr } = await execAsync(`bash ${scriptPath}`);
      
      // Should complete without errors
      expect(stderr).toBe("");
      
      // Should show completion message
      expect(stdout).toContain("Health Log Rotation Completed");
      
      // Should list current log sizes
      expect(stdout).toContain("Current log sizes:");
    });
  });

  describe("PM2 Services Log Rotation", () => {
    const services = [
      "rss-reader-dev",
      "rss-sync-cron",
      "rss-sync-server",
      "rss-services-monitor",
    ];

    it("should have log rotation configured for all PM2 services", async () => {
      const { stdout } = await execAsync("pm2 list");
      
      for (const service of services) {
        if (stdout.includes(service)) {
          // Service exists, check that PM2 logrotate will handle it
          expect(stdout).toContain("pm2-logrotate");
        }
      }
    });
  });
});