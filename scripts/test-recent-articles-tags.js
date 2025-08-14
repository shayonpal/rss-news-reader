#!/usr/bin/env node

/**
 * Test script to fetch recent articles and check their tags
 * This simulates what would happen during a normal sync with new articles
 */

require("dotenv").config();
const TokenManager = require("../server/lib/token-manager.js");

async function testRecentArticlesTags() {
  console.log("🏷️  Testing Tag Extraction for Recent Articles\n");
  console.log("==========================================\n");

  try {
    const tm = new TokenManager();

    // Fetch recent 5 articles to test
    console.log("📡 Fetching 5 most recent articles from Inoreader...\n");
    const response = await tm.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/stream/contents/user/-/state/com.google/reading-list?n=5"
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch articles: ${response.statusText}`);
    }

    const data = await response.json();
    const articles = data.items || [];

    console.log(`Found ${articles.length} articles\n`);

    // First, get folder names to distinguish from tags
    console.log("📂 Fetching subscription list to identify folders...\n");
    const subsResponse = await tm.makeAuthenticatedRequest(
      "https://www.inoreader.com/reader/api/0/subscription/list"
    );

    const subsData = await subsResponse.json();
    const folders = new Set();

    for (const sub of subsData.subscriptions || []) {
      if (sub.categories && Array.isArray(sub.categories)) {
        for (const category of sub.categories) {
          if (category.label) {
            folders.add(category.label);
          }
        }
      }
    }

    console.log(`Identified ${folders.size} folders:`, Array.from(folders));
    console.log();

    // Analyze each article's categories
    let totalTags = 0;
    let totalFolders = 0;

    for (const article of articles) {
      console.log(`📰 Article: "${article.title.substring(0, 60)}..."`);

      if (article.categories && article.categories.length > 0) {
        const labels = article.categories
          .filter((cat) => cat.includes("/label/"))
          .map((cat) => cat.replace(/^user\/[^\/]*\/label\//, ""));

        if (labels.length > 0) {
          console.log(`  Total labels: ${labels.length}`);

          const tags = [];
          const folderLabels = [];

          for (const label of labels) {
            if (folders.has(label)) {
              folderLabels.push(label);
              totalFolders++;
            } else {
              tags.push(label);
              totalTags++;
            }
          }

          if (tags.length > 0) {
            console.log(`  ✅ Tags: ${tags.join(", ")}`);
          }
          if (folderLabels.length > 0) {
            console.log(`  📁 Folders: ${folderLabels.join(", ")}`);
          }
        } else {
          console.log("  No labels found");
        }
      } else {
        console.log("  No categories found");
      }

      console.log();
    }

    console.log("📊 Summary:");
    console.log(`  • Articles analyzed: ${articles.length}`);
    console.log(`  • Total tag occurrences: ${totalTags}`);
    console.log(`  • Total folder occurrences: ${totalFolders}`);
    console.log();

    if (totalTags > 0) {
      console.log("✅ Tag extraction would work correctly during sync!");
      console.log(
        "   Tags would be saved to database and associated with articles."
      );
    } else {
      console.log("⚠️  No tags found in recent articles.");
      console.log("   This could mean:");
      console.log("   1. Articles don't have tags assigned in Inoreader");
      console.log("   2. All labels are folders, not tags");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  }
}

testRecentArticlesTags();
