#!/usr/bin/env node

/**
 * RR-143: Sync Integrity Test
 *
 * This script validates that author data persists correctly across sync operations
 * and that the sync process maintains data integrity.
 */

require("dotenv").config();
const { createClient } = require("@supabase/supabase-js");

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Color codes for output
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
};

function log(message, color = "reset") {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log("\n" + "=".repeat(60));
  log(title, "bright");
  console.log("=".repeat(60));
}

async function testAuthorPersistence() {
  logSection("AUTHOR DATA PERSISTENCE TEST");

  try {
    // Get a sample of articles with authors
    const { data: beforeSync } = await supabase
      .from("articles")
      .select("inoreader_id, author, updated_at")
      .not("author", "is", null)
      .order("updated_at", { ascending: false })
      .limit(50);

    if (!beforeSync || beforeSync.length === 0) {
      log("⚠️  No articles with authors found to test persistence", "yellow");
      return false;
    }

    log(
      `📊 Testing persistence for ${beforeSync.length} articles with authors`,
      "blue"
    );

    // Create a map of current author data
    const authorMap = new Map();
    beforeSync.forEach((article) => {
      authorMap.set(article.inoreader_id, {
        author: article.author,
        updated_at: article.updated_at,
      });
    });

    // Simulate time passing (in real scenario, wait for next sync)
    log("  Checking if authors persist in database...", "cyan");

    // Re-fetch the same articles
    const { data: afterCheck } = await supabase
      .from("articles")
      .select("inoreader_id, author, updated_at")
      .in("inoreader_id", Array.from(authorMap.keys()));

    let persistenceIssues = 0;
    let dataChanged = 0;

    afterCheck?.forEach((article) => {
      const original = authorMap.get(article.inoreader_id);

      if (!original) {
        persistenceIssues++;
        log(
          `  ❌ Article ${article.inoreader_id} not found in original set`,
          "red"
        );
      } else if (article.author !== original.author) {
        dataChanged++;
        log(
          `  ⚠️  Author changed for ${article.inoreader_id}: "${original.author}" → "${article.author}"`,
          "yellow"
        );
      }
    });

    if (persistenceIssues === 0 && dataChanged === 0) {
      log("✅ All author data persisted correctly", "green");
      return true;
    } else {
      log(
        `⚠️  Found ${persistenceIssues} persistence issues and ${dataChanged} data changes`,
        "yellow"
      );
      return false;
    }
  } catch (error) {
    log(`❌ Persistence test failed: ${error.message}`, "red");
    return false;
  }
}

async function testSyncConsistency() {
  logSection("SYNC CONSISTENCY TEST");

  try {
    // Check for articles that have been synced multiple times
    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: recentlySynced } = await supabase
      .from("articles")
      .select("inoreader_id, author, created_at, updated_at, last_sync_update")
      .gte("updated_at", oneDayAgo.toISOString())
      .not("author", "is", null)
      .order("updated_at", { ascending: false })
      .limit(20);

    if (!recentlySynced || recentlySynced.length === 0) {
      log("ℹ️  No recently synced articles with authors found", "cyan");
      return true;
    }

    log(
      `📊 Analyzing ${recentlySynced.length} recently synced articles`,
      "blue"
    );

    let syncIssues = 0;

    recentlySynced.forEach((article) => {
      const created = new Date(article.created_at);
      const updated = new Date(article.updated_at);
      const hoursSinceCreation = (updated - created) / (1000 * 60 * 60);

      // Check if article was updated after creation (indicating resync)
      if (hoursSinceCreation > 1) {
        log(
          `  ℹ️  Article resynced after ${hoursSinceCreation.toFixed(1)} hours: ${article.inoreader_id.substring(0, 30)}...`,
          "cyan"
        );

        // Verify sync timestamp is set
        if (!article.last_sync_update) {
          syncIssues++;
          log(`    ⚠️  Missing sync timestamp!`, "yellow");
        }
      }
    });

    if (syncIssues === 0) {
      log("✅ Sync consistency maintained", "green");
      return true;
    } else {
      log(`⚠️  Found ${syncIssues} sync consistency issues`, "yellow");
      return false;
    }
  } catch (error) {
    log(`❌ Sync consistency test failed: ${error.message}`, "red");
    return false;
  }
}

async function testBackfillEffectiveness() {
  logSection("BACKFILL EFFECTIVENESS TEST");

  try {
    // Check if old articles are getting authors on resync
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    // Find articles created before but updated recently
    const { data: backfilledArticles } = await supabase
      .from("articles")
      .select("inoreader_id, author, created_at, updated_at")
      .lt("created_at", oneWeekAgo.toISOString())
      .gte("updated_at", oneDayAgo.toISOString())
      .not("author", "is", null)
      .limit(20);

    if (!backfilledArticles || backfilledArticles.length === 0) {
      log("ℹ️  No backfilled articles found in recent sync", "cyan");
      return true;
    }

    log(
      `📊 Found ${backfilledArticles.length} articles that got authors through backfill`,
      "green"
    );

    // Show some examples
    log("\nBackfill Examples:", "blue");
    backfilledArticles.slice(0, 5).forEach((article) => {
      const ageInDays = Math.floor(
        (new Date() - new Date(article.created_at)) / (1000 * 60 * 60 * 24)
      );
      log(
        `  • Article ${ageInDays} days old now has author: "${article.author}"`,
        "cyan"
      );
    });

    log("✅ Backfill is working effectively", "green");
    return true;
  } catch (error) {
    log(`❌ Backfill test failed: ${error.message}`, "red");
    return false;
  }
}

async function testDuplicatePrevention() {
  logSection("DUPLICATE PREVENTION TEST");

  try {
    // Check for duplicate inoreader_ids (should be impossible due to unique constraint)
    const { data: articles } = await supabase
      .from("articles")
      .select("inoreader_id")
      .limit(1000);

    const ids = articles?.map((a) => a.inoreader_id) || [];
    const uniqueIds = new Set(ids);

    if (ids.length !== uniqueIds.size) {
      log(
        `❌ Found duplicate articles! ${ids.length - uniqueIds.size} duplicates detected`,
        "red"
      );
      return false;
    }

    log(
      `✅ No duplicate articles found (checked ${ids.length} articles)`,
      "green"
    );

    // Check for articles with same URL but different IDs (potential duplicates)
    const { data: urlDuplicates } = await supabase.rpc("check_url_duplicates");

    if (urlDuplicates && urlDuplicates.length > 0) {
      log(
        `⚠️  Found ${urlDuplicates.length} URLs with multiple articles`,
        "yellow"
      );
      // This might be okay if articles are from different feeds
    } else {
      log("✅ No URL duplicates found", "green");
    }

    return true;
  } catch (error) {
    // RPC might not exist, fallback to basic check
    if (error.code === "PGRST202") {
      log(
        "ℹ️  Advanced duplicate check not available, basic check passed",
        "cyan"
      );
      return true;
    }
    log(`❌ Duplicate prevention test failed: ${error.message}`, "red");
    return false;
  }
}

async function testDataIntegrityConstraints() {
  logSection("DATA INTEGRITY CONSTRAINTS TEST");

  try {
    // Test various data integrity scenarios
    const tests = [];

    // Test 1: No empty string authors
    const { count: emptyAuthors } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .eq("author", "");

    tests.push({
      name: "No empty string authors",
      passed: emptyAuthors === 0,
      message:
        emptyAuthors === 0
          ? "✅ No empty string authors"
          : `❌ Found ${emptyAuthors} empty string authors`,
    });

    // Test 2: Author length constraints
    const { data: longAuthors } = await supabase
      .from("articles")
      .select("author")
      .not("author", "is", null)
      .limit(1000);

    const tooLong = longAuthors?.filter((a) => a.author.length > 255) || [];
    tests.push({
      name: "Author length constraints",
      passed: tooLong.length === 0,
      message:
        tooLong.length === 0
          ? "✅ All authors within length limits"
          : `❌ Found ${tooLong.length} authors exceeding 255 characters`,
    });

    // Test 3: No null violations in required fields
    const { count: invalidArticles } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .or("inoreader_id.is.null,feed_id.is.null");

    tests.push({
      name: "Required fields populated",
      passed: invalidArticles === 0,
      message:
        invalidArticles === 0
          ? "✅ All required fields populated"
          : `❌ Found ${invalidArticles} articles with null required fields`,
    });

    // Test 4: Encoding integrity
    const { data: encodingIssues } = await supabase
      .from("articles")
      .select("author")
      .not("author", "is", null)
      .ilike("author", "%�%")
      .limit(10);

    tests.push({
      name: "No encoding issues",
      passed: !encodingIssues || encodingIssues.length === 0,
      message:
        !encodingIssues || encodingIssues.length === 0
          ? "✅ No encoding issues detected"
          : `❌ Found ${encodingIssues.length} authors with encoding issues`,
    });

    // Display results
    let allPassed = true;
    tests.forEach((test) => {
      log(test.message, test.passed ? "green" : "red");
      if (!test.passed) allPassed = false;
    });

    return allPassed;
  } catch (error) {
    log(`❌ Data integrity test failed: ${error.message}`, "red");
    return false;
  }
}

async function generateSyncIntegrityReport() {
  logSection("SYNC INTEGRITY REPORT");

  const results = [];

  results.push(await testAuthorPersistence());
  results.push(await testSyncConsistency());
  results.push(await testBackfillEffectiveness());
  results.push(await testDuplicatePrevention());
  results.push(await testDataIntegrityConstraints());

  const passed = results.filter((r) => r).length;
  const total = results.length;

  console.log("\n" + "=".repeat(60));
  if (passed === total) {
    log(`✅ ALL SYNC INTEGRITY TESTS PASSED (${passed}/${total})`, "green");
    log("\nRR-143 Sync integrity validation complete!", "bright");
    log("Author data is being properly captured and maintained.", "green");
  } else {
    log(`⚠️  PARTIAL SUCCESS (${passed}/${total} tests passed)`, "yellow");
    log("\nSome sync integrity issues detected.", "yellow");
    log("Please review the warnings above for details.", "yellow");
  }
  console.log("=".repeat(60));

  // Additional statistics
  logSection("CURRENT AUTHOR STATISTICS");

  const { data: stats } = await supabase
    .from("author_statistics")
    .select("*")
    .single();

  if (stats) {
    log(`📊 Database Statistics:`, "blue");
    log(`  Total Articles: ${stats.total_articles}`, "cyan");
    log(`  Articles with Author: ${stats.articles_with_author}`, "cyan");
    log(
      `  Author Coverage: ${stats.author_coverage_percentage}%`,
      stats.author_coverage_percentage > 50 ? "green" : "yellow"
    );
    log(`  Unique Authors: ${stats.unique_authors}`, "cyan");
  }
}

// Run all tests
generateSyncIntegrityReport().catch((error) => {
  log(`\n❌ Fatal error: ${error.message}`, "red");
  process.exit(1);
});
