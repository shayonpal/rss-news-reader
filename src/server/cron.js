const cron = require("node-cron");
const fs = require("fs").promises;
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { exec } = require("child_process");
const { promisify } = require("util");
const execAsync = promisify(exec);

class CronSyncService {
  constructor() {
    this.logPath = process.env.SYNC_LOG_PATH || "./logs/sync-cron.jsonl";
    this.healthLogPath = "./logs/cron-health.jsonl";
    this.isEnabled = process.env.ENABLE_AUTO_SYNC === "true";
    this.schedule = process.env.SYNC_CRON_SCHEDULE || "0 2,14 * * *"; // 2am, 2pm
    this.apiUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    this.serviceStartTime = Date.now();
    this.successCount = 0;
    this.failureCount = 0;
    this.lastRunTime = null;
    this.lastRunStatus = null;
    this.lastError = null;
  }

  async start() {
    if (!this.isEnabled) {
      console.log("[Cron] Automatic sync is disabled");
      await this.writeHealthStatus("disabled");
      return;
    }

    // Ensure log directory exists
    const logDir = path.dirname(this.logPath);
    await fs.mkdir(logDir, { recursive: true });

    // Write initial health status
    await this.writeHealthStatus("healthy");

    // Schedule cron job
    cron.schedule(
      this.schedule,
      async () => {
        const trigger = this.getTriggerName();
        await this.executeSyncWithLogging(trigger);
      },
      {
        timezone: "America/Toronto",
      }
    );

    console.log(
      `[Cron] Automatic sync scheduled: ${this.schedule} (America/Toronto)`
    );
  }

  async sendUptimeKumaPush(status = "up", message = "") {
    try {
      const scriptPath = path.join(
        __dirname,
        "../../scripts/uptime-kuma-push.sh"
      );
      const cmd = `${scriptPath} push cron ${status} "${message}"`;
      await execAsync(cmd);
      console.log("[Cron] Uptime Kuma push sent:", status);
    } catch (error) {
      console.error("[Cron] Failed to send Uptime Kuma push:", error);
    }
  }

  async sendDiscordAlert(title, message, trigger) {
    try {
      const webhook =
        "https://discord.com/api/webhooks/1398487627765649498/n6mIouChkYqBCL67vj5Jbn0XL67vj5Jbn0X0XP3uU_rFXhSRcRmQdE2yiJBcvPL7sF9VphClpie5ObE";

      const payload = {
        embeds: [
          {
            title: `🚨 RSS Sync ${title}`,
            description: message,
            color: 16711680, // Red
            fields: [
              { name: "Trigger", value: trigger, inline: true },
              {
                name: "Time",
                value: new Date().toLocaleString("en-US", {
                  timeZone: "America/Toronto",
                }),
                inline: true,
              },
              { name: "API URL", value: this.apiUrl, inline: true },
              {
                name: "Action Required",
                value: "Check API endpoints and server logs immediately",
                inline: false,
              },
            ],
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const response = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        throw new Error(`Discord webhook failed: ${response.status}`);
      }
    } catch (error) {
      console.error("[Cron] Failed to send Discord alert:", error);
    }
  }

  async executeSyncWithLogging(trigger) {
    const syncId = uuidv4();
    const startTime = Date.now();

    // Log sync start
    await this.logEvent({
      timestamp: new Date().toISOString(),
      trigger,
      status: "started",
      syncId,
    });

    try {
      // Call the sync API endpoint
      const response = await fetch(`${this.apiUrl}/reader/api/sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) {
        throw new Error(`Sync API returned ${response.status}`);
      }

      const result = await response.json();

      // Poll for completion
      await this.pollSyncStatus(result.syncId, trigger, startTime);
    } catch (error) {
      const duration = Date.now() - startTime;

      // Log sync error
      await this.logEvent({
        timestamp: new Date().toISOString(),
        trigger,
        status: "error",
        error: error.message,
        duration,
      });

      // Update health status and send alerts
      this.failureCount++;
      this.lastRunStatus = "failed";
      this.lastError = error.message;
      this.lastRunTime = new Date().toISOString();

      await this.writeHealthStatus("unhealthy", error.message);
      await this.sendUptimeKumaPush("down", error.message);

      // Send immediate Discord alert for API errors
      if (error.message.includes("404") || error.message.includes("500")) {
        await this.sendDiscordAlert("API Error", error.message, trigger);
      }

      // Update sync metadata in Supabase
      await this.updateSyncMetadata({
        last_sync_status: "failed",
        last_sync_error: error.message,
        sync_failure_count: { increment: 1 },
      });

      // Update internal state
      this.lastRunTime = new Date().toISOString();
      this.lastRunStatus = "failed";
      this.lastError = error.message;
      this.failureCount++;

      // Write health status
      await this.writeHealthStatus("degraded");

      // Send Uptime Kuma push notification for failure
      await this.sendUptimeKumaPush("down", `Sync failed: ${error.message}`);
    }
  }

  async pollSyncStatus(syncId, trigger, startTime) {
    const maxAttempts = 60; // 2 minutes max
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const response = await fetch(
          `${this.apiUrl}/reader/api/sync/status/${syncId}`
        );
        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`);
        }

        const status = await response.json();

        if (status.status === "completed") {
          const duration = Date.now() - startTime;

          // Log success
          await this.logEvent({
            timestamp: new Date().toISOString(),
            trigger,
            status: "completed",
            duration,
            feeds: status.feedsCount,
            articles: status.articlesCount,
          });

          // Update sync metadata
          await this.updateSyncMetadata({
            last_sync_time: new Date().toISOString(),
            last_sync_status: "success",
            last_sync_error: null,
            sync_success_count: { increment: 1 },
          });

          // Update internal state
          this.lastRunTime = new Date().toISOString();
          this.lastRunStatus = "success";
          this.lastError = null;
          this.successCount++;

          // Write health status
          await this.writeHealthStatus("healthy");

          // Send Uptime Kuma push notification
          await this.sendUptimeKumaPush(
            "up",
            `Sync completed: ${status.articlesCount} articles`
          );

          return;
        } else if (status.status === "failed") {
          throw new Error(status.error || "Sync failed");
        }

        // Log progress updates at 20% intervals
        if (status.progress && status.progress % 20 === 0) {
          await this.logEvent({
            timestamp: new Date().toISOString(),
            trigger,
            status: "running",
            progress: status.progress,
            message: status.message,
          });
        }
      } catch (error) {
        // Ignore transient errors during polling
        console.error(`[Cron] Status check error: ${error.message}`);
      }

      await new Promise((resolve) => setTimeout(resolve, 2000));
      attempts++;
    }

    throw new Error("Sync timeout after 2 minutes");
  }

  async logEvent(event) {
    try {
      const line = JSON.stringify(event) + "\n";
      await fs.appendFile(this.logPath, line);
    } catch (error) {
      console.error("[Cron] Failed to write log:", error);
    }
  }

  async updateSyncMetadata(updates) {
    try {
      // We need to update this via the API since we can't directly access Supabase from here
      const response = await fetch(`${this.apiUrl}/reader/api/sync/metadata`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        console.error(
          "[Cron] Failed to update sync metadata:",
          response.status
        );
      }
    } catch (error) {
      console.error("[Cron] Failed to update sync metadata:", error);
    }
  }

  getTriggerName() {
    const hour = new Date().getHours();
    return hour < 12 ? "cron-2am" : "cron-2pm";
  }

  async writeHealthStatus(overallStatus = null) {
    try {
      const uptimeSeconds = Math.floor(
        (Date.now() - this.serviceStartTime) / 1000
      );
      const nextRunTime = this.getNextRunTime();

      const healthData = {
        timestamp: new Date().toISOString(),
        status:
          overallStatus ||
          (this.lastRunStatus === "failed" ? "degraded" : "healthy"),
        service: "rss-sync-cron",
        enabled: this.isEnabled,
        schedule: this.schedule,
        uptime: uptimeSeconds,
        lastRun: this.lastRunTime,
        lastRunStatus: this.lastRunStatus,
        nextRun: nextRunTime,
        recentRuns: {
          successful: this.successCount,
          failed: this.failureCount,
          lastFailure: this.lastError
            ? {
                timestamp: this.lastRunTime,
                error: this.lastError,
              }
            : null,
        },
        performance: {
          avgSyncTime: 0, // Would need to track this
          totalSyncs: this.successCount + this.failureCount,
        },
      };

      await fs.appendFile(
        this.healthLogPath,
        JSON.stringify(healthData) + "\n"
      );
    } catch (error) {
      console.error("[Cron] Failed to write health status:", error);
    }
  }

  getNextRunTime() {
    if (!this.isEnabled) return null;

    // Parse cron schedule to determine next run
    const now = new Date();
    const hour = now.getHours();

    // Schedule is '0 2,14 * * *' (2am and 2pm)
    if (hour < 2) {
      // Next run is 2am today
      const next = new Date(now);
      next.setHours(2, 0, 0, 0);
      return next.toISOString();
    } else if (hour < 14) {
      // Next run is 2pm today
      const next = new Date(now);
      next.setHours(14, 0, 0, 0);
      return next.toISOString();
    } else {
      // Next run is 2am tomorrow
      const next = new Date(now);
      next.setDate(next.getDate() + 1);
      next.setHours(2, 0, 0, 0);
      return next.toISOString();
    }
  }
}

// Entry point for PM2
if (require.main === module) {
  const cronService = new CronSyncService();
  cronService.start().catch((error) => {
    console.error("[Cron] Failed to start service:", error);
    process.exit(1);
  });

  // Keep process alive
  process.stdin.resume();

  // Graceful shutdown
  process.on("SIGTERM", () => {
    console.log("[Cron] Shutting down...");
    process.exit(0);
  });
}

module.exports = CronSyncService;
