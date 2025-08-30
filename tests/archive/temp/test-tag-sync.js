#!/usr/bin/env node

/**
 * Test script to verify tag extraction during sync
 * This will trigger a sync and check if tags are being properly extracted
 */

require("dotenv").config();

async function testTagSync() {
  console.log("🏷️  Testing Tag Sync Implementation\n");
  console.log("==========================================\n");

  try {
    // Trigger sync via API endpoint
    console.log("📡 Triggering manual sync...");
    const syncResponse = await fetch("http://localhost:3000/reader/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!syncResponse.ok) {
      throw new Error(`Sync failed: ${syncResponse.statusText}`);
    }

    const syncData = await syncResponse.json();
    console.log("✅ Sync triggered:", syncData.syncId);
    console.log("");

    // Poll for sync completion
    console.log("⏳ Waiting for sync to complete...");
    let status = "running";
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max

    while (status === "running" && attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Wait 1 second

      const statusResponse = await fetch(
        `http://localhost:3000/reader/api/sync/status/${syncData.syncId}`
      );
      if (statusResponse.ok) {
        const statusData = await statusResponse.json();
        status = statusData.status;

        if (statusData.progress) {
          process.stdout.write(
            `\rProgress: ${statusData.progress}% - ${statusData.message || "Processing..."}`
          );
        }
      }
      attempts++;
    }

    console.log("\n");

    if (status === "completed") {
      console.log("✅ Sync completed successfully!\n");

      // Check database for tags
      console.log("📊 Checking database for tags...\n");

      const { createClient } = require("@supabase/supabase-js");
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );

      // Get tag counts
      const { data: tags, error: tagError } = await supabase
        .from("tags")
        .select("name, slug, article_count")
        .order("article_count", { ascending: false });

      if (tagError) {
        console.error("Error fetching tags:", tagError);
      } else {
        console.log(`Found ${tags.length} tags in database:\n`);

        if (tags.length > 0) {
          tags.forEach((tag) => {
            console.log(`  • ${tag.name} (${tag.article_count} articles)`);
          });
        } else {
          console.log("  No tags found - checking why...");
        }
      }

      // Check article-tag associations
      const { data: associations, error: assocError } = await supabase
        .from("article_tags")
        .select("article_id, tag_id")
        .limit(10);

      console.log(
        `\n📎 Article-tag associations: ${associations ? associations.length : 0} found`
      );

      // Check if any articles have categories with labels
      const { data: articles, error: articleError } = await supabase
        .from("articles")
        .select("inoreader_id, title")
        .limit(5);

      if (articles && articles.length > 0) {
        console.log(`\n📰 Sample articles checked: ${articles.length}`);
      }
    } else if (status === "failed") {
      console.error("❌ Sync failed!");
    } else {
      console.error("⏱️  Sync timed out");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

// Check if dev server is running
async function checkDevServer() {
  try {
    const response = await fetch("http://localhost:3000/reader/api/health");
    return response.ok;
  } catch {
    return false;
  }
}

// Main execution
(async () => {
  const isDevRunning = await checkDevServer();

  if (!isDevRunning) {
    console.error("❌ Dev server is not running!");
    console.log("Please run: npm run dev");
    process.exit(1);
  }

  await testTagSync();
})();
