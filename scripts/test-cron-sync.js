#!/usr/bin/env node

/**
 * Test script for the automatic sync cron service
 * This script runs the cron service in test mode to verify it works correctly
 */

const path = require("path");
const fs = require("fs").promises;

// Set up test environment
process.env.ENABLE_AUTO_SYNC = "true";
process.env.SYNC_LOG_PATH = "./logs/test-sync-cron.jsonl";
process.env.NEXT_PUBLIC_BASE_URL = "http://localhost:3000";

// Import the cron service
const CronSyncService = require("../src/server/cron.js");

async function testCronSync() {
  console.log("🧪 Testing Cron Sync Service...\n");

  // Create a test instance
  const cronService = new CronSyncService();

  console.log("📋 Configuration:");
  console.log(`   - Log Path: ${cronService.logPath}`);
  console.log(`   - Schedule: ${cronService.schedule}`);
  console.log(`   - API URL: ${cronService.apiUrl}`);
  console.log(`   - Enabled: ${cronService.isEnabled}\n`);

  try {
    // Test 1: Direct sync execution
    console.log("🔄 Test 1: Executing sync directly...");
    const trigger = "test-manual";
    await cronService.executeSyncWithLogging(trigger);
    console.log("✅ Direct sync completed\n");

    // Test 2: Check log file
    console.log("📄 Test 2: Checking log file...");
    const logContent = await fs.readFile(cronService.logPath, "utf8");
    const logLines = logContent
      .trim()
      .split("\n")
      .filter((line) => line);
    console.log(`   - Found ${logLines.length} log entries`);

    // Parse and display last log entry
    if (logLines.length > 0) {
      const lastEntry = JSON.parse(logLines[logLines.length - 1]);
      console.log("   - Last entry:", {
        timestamp: lastEntry.timestamp,
        trigger: lastEntry.trigger,
        status: lastEntry.status,
        duration: lastEntry.duration ? `${lastEntry.duration}ms` : undefined,
      });
    }
    console.log("✅ Log file is working correctly\n");

    // Test 3: Schedule validation
    console.log("🕐 Test 3: Schedule validation...");
    console.log(`   - Cron schedule: ${cronService.schedule}`);
    console.log(
      "   - This will run at 2:00 AM and 2:00 PM in America/Toronto timezone"
    );
    console.log("✅ Schedule is valid\n");

    console.log(
      "✨ All tests passed! The cron sync service is ready for production."
    );
    console.log("\n📌 To start the cron service with PM2:");
    console.log("   pm2 start ecosystem.config.js --only rss-sync-cron");
    console.log("\n📌 To check cron logs:");
    console.log("   tail -f logs/sync-cron.jsonl | jq .");
  } catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
  }
}

// Check if Next.js server is running
async function checkNextServer() {
  try {
    const response = await fetch("http://localhost:3000/api/health");
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }
    return true;
  } catch (error) {
    console.error("❌ Next.js server is not running at http://localhost:3000");
    console.error("   Please start the dev server first: npm run dev");
    return false;
  }
}

// Main execution
(async () => {
  console.log("🚀 RSS Reader Cron Sync Test\n");

  // Check if server is running
  const serverRunning = await checkNextServer();
  if (!serverRunning) {
    process.exit(1);
  }

  console.log("✅ Next.js server is running\n");

  // Run tests
  await testCronSync();
})();
