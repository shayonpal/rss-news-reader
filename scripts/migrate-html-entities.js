#!/usr/bin/env node

/**
 * RR-154: Migration script to fix HTML entities in existing articles
 *
 * This script uses the same 'he' library as the main application to ensure
 * complete consistency between runtime decoding and migration decoding.
 *
 * Features:
 * - Non-destructive: Creates backup columns before modification
 * - Progress tracking with detailed logging
 * - Batch processing to avoid memory issues
 * - Rollback capability
 * - Same decoding logic as TypeScript module
 */

const { createClient } = require("@supabase/supabase-js");
const { decode } = require("he");
const fs = require("fs").promises;

// Configuration
const BATCH_SIZE = 50;
const PROGRESS_LOG_FILE = "logs/html-entity-migration.jsonl";
const BACKUP_ENABLED = true;

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error(
    "❌ Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
  );
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * Same URL detection logic as TypeScript module for consistency
 */
function isSafeUrl(text) {
  if (!text || typeof text !== "string") return false;
  return (
    text.startsWith("http://") ||
    text.startsWith("https://") ||
    text.startsWith("feed://") ||
    text.startsWith("tag:") ||
    text.includes("://")
  );
}

/**
 * Same HTML entity decoding logic as TypeScript module
 */
function decodeHtmlEntities(text) {
  if (!text || typeof text !== "string") return text || "";
  if (isSafeUrl(text)) return text;

  try {
    return decode(text);
  } catch (error) {
    console.warn(`⚠️ Failed to decode: "${text}" - ${error.message}`);
    return text;
  }
}

/**
 * Log progress to both console and file
 */
async function logProgress(data) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ...data,
  };

  console.log(
    `📝 ${logEntry.timestamp} - ${logEntry.message || JSON.stringify(data)}`
  );

  try {
    await fs.mkdir("logs", { recursive: true });
    await fs.appendFile(PROGRESS_LOG_FILE, JSON.stringify(logEntry) + "\n");
  } catch (error) {
    console.warn("⚠️ Failed to write log:", error.message);
  }
}

/**
 * Create backup columns if they don't exist
 */
async function createBackupColumns() {
  if (!BACKUP_ENABLED) {
    await logProgress({
      action: "backup_skip",
      message: "Backup columns disabled",
    });
    return;
  }

  await logProgress({
    action: "backup_start",
    message: "Creating backup columns",
  });

  try {
    // Check if backup columns already exist
    const { data: columns } = await supabase.rpc("get_table_columns", {
      table_name: "articles",
    });

    const hasBackupTitle = columns?.some(
      (col) => col.column_name === "title_original"
    );
    const hasBackupContent = columns?.some(
      (col) => col.column_name === "content_original"
    );

    if (!hasBackupTitle) {
      const { error } = await supabase.rpc("exec_sql", {
        query:
          "ALTER TABLE articles ADD COLUMN IF NOT EXISTS title_original TEXT;",
      });
      if (error) throw error;
      await logProgress({
        action: "backup_column_created",
        column: "title_original",
      });
    }

    if (!hasBackupContent) {
      const { error } = await supabase.rpc("exec_sql", {
        query:
          "ALTER TABLE articles ADD COLUMN IF NOT EXISTS content_original TEXT;",
      });
      if (error) throw error;
      await logProgress({
        action: "backup_column_created",
        column: "content_original",
      });
    }

    await logProgress({
      action: "backup_complete",
      message: "Backup columns ready",
    });
  } catch (error) {
    await logProgress({
      action: "backup_error",
      error: error.message,
      message: "Failed to create backup columns",
    });
    throw error;
  }
}

/**
 * Find articles that need entity decoding
 */
async function findArticlesToProcess() {
  await logProgress({
    action: "scan_start",
    message: "Scanning for articles with HTML entities",
  });

  // Use LIKE patterns for better detection
  const { data: titleMatches, error: titleError } = await supabase
    .from("articles")
    .select("id")
    .or(
      "title.like.%&rsquo;%,title.like.%&lsquo;%,title.like.%&amp;%,title.like.%&quot;%,title.like.%&#8217;%,title.like.%&ndash;%,title.like.%&mdash;%,title.like.%&ldquo;%,title.like.%&rdquo;%"
    );

  const { data: contentMatches, error: contentError } = await supabase
    .from("articles")
    .select("id")
    .or(
      "content.like.%&rsquo;%,content.like.%&lsquo;%,content.like.%&amp;%,content.like.%&quot;%,content.like.%&#8217;%,content.like.%&ndash;%,content.like.%&mdash;%,content.like.%&ldquo;%,content.like.%&rdquo;%"
    );

  if (titleError) throw titleError;
  if (contentError) throw contentError;

  // Combine and deduplicate
  const allIds = new Set([
    ...(titleMatches || []).map((a) => a.id),
    ...(contentMatches || []).map((a) => a.id),
  ]);

  const articlesToProcess = Array.from(allIds);

  await logProgress({
    action: "scan_complete",
    total_articles: articlesToProcess.length,
    title_matches: (titleMatches || []).length,
    content_matches: (contentMatches || []).length,
    message: `Found ${articlesToProcess.length} articles needing entity decoding`,
  });

  return articlesToProcess;
}

/**
 * Process a batch of articles
 */
async function processBatch(articleIds, batchNumber, totalBatches) {
  await logProgress({
    action: "batch_start",
    batch: batchNumber,
    total_batches: totalBatches,
    article_count: articleIds.length,
  });

  // Fetch current articles
  const { data: articles, error: fetchError } = await supabase
    .from("articles")
    .select("id, title, content, title_original, content_original")
    .in("id", articleIds);

  if (fetchError) throw fetchError;

  const updates = [];
  let processedCount = 0;
  let changedCount = 0;

  for (const article of articles) {
    const update = { id: article.id };
    let hasChanges = false;

    // Process title
    if (article.title) {
      const decodedTitle = decodeHtmlEntities(article.title);
      if (decodedTitle !== article.title) {
        update.title = decodedTitle;
        if (BACKUP_ENABLED && !article.title_original) {
          update.title_original = article.title;
        }
        hasChanges = true;
      }
    }

    // Process content
    if (article.content) {
      const decodedContent = decodeHtmlEntities(article.content);
      if (decodedContent !== article.content) {
        update.content = decodedContent;
        if (BACKUP_ENABLED && !article.content_original) {
          update.content_original = article.content;
        }
        hasChanges = true;
      }
    }

    if (hasChanges) {
      updates.push(update);
      changedCount++;
    }
    processedCount++;
  }

  // Apply updates if any
  if (updates.length > 0) {
    const { error: updateError } = await supabase
      .from("articles")
      .upsert(updates, { onConflict: "id" });

    if (updateError) throw updateError;
  }

  await logProgress({
    action: "batch_complete",
    batch: batchNumber,
    processed: processedCount,
    changed: changedCount,
    skipped: processedCount - changedCount,
  });

  return { processed: processedCount, changed: changedCount };
}

/**
 * Verify migration results
 */
async function verifyMigration() {
  await logProgress({
    action: "verify_start",
    message: "Verifying migration results",
  });

  // Count articles with common HTML entities in titles
  const { count: titleCount, error: titleError } = await supabase
    .from("articles")
    .select("*", { count: "exact", head: true })
    .or(
      "title.like.%&rsquo;%,title.like.%&lsquo;%,title.like.%&amp;%,title.like.%&quot;%,title.like.%&#8217;%,title.like.%&ndash;%,title.like.%&mdash;%,title.like.%&ldquo;%,title.like.%&rdquo;%"
    );

  // Count articles with HTML entities in content
  const { count: contentCount, error: contentError } = await supabase
    .from("articles")
    .select("*", { count: "exact", head: true })
    .or(
      "content.like.%&rsquo;%,content.like.%&lsquo;%,content.like.%&amp;%,content.like.%&quot;%,content.like.%&#8217;%,content.like.%&ndash;%,content.like.%&mdash;%,content.like.%&ldquo;%,content.like.%&rdquo;%"
    );

  if (titleError) console.warn("Title count error:", titleError);
  if (contentError) console.warn("Content count error:", contentError);

  const remaining = {
    titles: titleCount || 0,
    content: contentCount || 0,
  };

  await logProgress({
    action: "verify_complete",
    remaining_entities: remaining,
    success: remaining.titles === 0 && remaining.content === 0,
    message: `Verification complete - ${remaining.titles} titles and ${remaining.content} content fields still have entities`,
  });

  return remaining;
}

/**
 * Main migration function
 */
async function runMigration() {
  const startTime = Date.now();

  await logProgress({
    action: "migration_start",
    backup_enabled: BACKUP_ENABLED,
    batch_size: BATCH_SIZE,
    message: "Starting HTML entity decoding migration",
  });

  try {
    // Step 1: Create backup columns
    await createBackupColumns();

    // Step 2: Find articles to process
    const articlesToProcess = await findArticlesToProcess();

    if (articlesToProcess.length === 0) {
      await logProgress({
        action: "migration_complete",
        message: "No articles found with HTML entities - migration not needed",
      });
      return;
    }

    // Step 3: Process in batches
    const totalBatches = Math.ceil(articlesToProcess.length / BATCH_SIZE);
    let totalProcessed = 0;
    let totalChanged = 0;

    for (let i = 0; i < articlesToProcess.length; i += BATCH_SIZE) {
      const batch = articlesToProcess.slice(i, i + BATCH_SIZE);
      const batchNumber = Math.floor(i / BATCH_SIZE) + 1;

      const results = await processBatch(batch, batchNumber, totalBatches);
      totalProcessed += results.processed;
      totalChanged += results.changed;

      // Small delay between batches to avoid overwhelming database
      if (i + BATCH_SIZE < articlesToProcess.length) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
    }

    // Step 4: Verify results
    const verification = await verifyMigration();

    // Step 5: Complete
    const duration = Date.now() - startTime;
    await logProgress({
      action: "migration_complete",
      duration_ms: duration,
      total_processed: totalProcessed,
      total_changed: totalChanged,
      remaining_entities: verification,
      success: verification.titles === 0 && verification.content === 0,
      message: `Migration completed in ${(duration / 1000).toFixed(2)}s`,
    });

    // Update sync metadata
    await supabase.from("sync_metadata").upsert(
      {
        key: "html_entity_migration_completed",
        value: JSON.stringify({
          completed_at: new Date().toISOString(),
          total_processed: totalProcessed,
          total_changed: totalChanged,
          backup_enabled: BACKUP_ENABLED,
          verification: verification,
          success: verification.titles === 0 && verification.content === 0,
        }),
      },
      { onConflict: "key" }
    );

    console.log("✅ Migration completed successfully!");
  } catch (error) {
    await logProgress({
      action: "migration_error",
      error: error.message,
      stack: error.stack,
      message: "Migration failed with error",
    });

    console.error("❌ Migration failed:", error);
    throw error;
  }
}

/**
 * Rollback function to restore original values
 */
async function rollbackMigration() {
  if (!BACKUP_ENABLED) {
    console.log("❌ Cannot rollback - backup was not enabled during migration");
    return;
  }

  await logProgress({
    action: "rollback_start",
    message: "Starting rollback of HTML entity migration",
  });

  try {
    // Restore titles from backup
    const { error: titleError } = await supabase.rpc("exec_sql", {
      query: `
        UPDATE articles 
        SET title = title_original 
        WHERE title_original IS NOT NULL
      `,
    });
    if (titleError) throw titleError;

    // Restore content from backup
    const { error: contentError } = await supabase.rpc("exec_sql", {
      query: `
        UPDATE articles 
        SET content = content_original 
        WHERE content_original IS NOT NULL
      `,
    });
    if (contentError) throw contentError;

    await logProgress({
      action: "rollback_complete",
      message: "Rollback completed successfully",
    });
    console.log("✅ Rollback completed successfully!");
  } catch (error) {
    await logProgress({
      action: "rollback_error",
      error: error.message,
      message: "Rollback failed",
    });
    console.error("❌ Rollback failed:", error);
    throw error;
  }
}

// CLI handling
const args = process.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case "run":
      await runMigration();
      break;
    case "rollback":
      await rollbackMigration();
      break;
    case "verify":
      await verifyMigration();
      break;
    default:
      console.log(`
RR-154 HTML Entity Migration Tool

Usage:
  node scripts/migrate-html-entities.js <command>

Commands:
  run      - Run the HTML entity decoding migration
  rollback - Rollback the migration (requires backup enabled)
  verify   - Verify current state without making changes

Examples:
  node scripts/migrate-html-entities.js run
  node scripts/migrate-html-entities.js verify
  node scripts/migrate-html-entities.js rollback

Configuration:
  BACKUP_ENABLED: ${BACKUP_ENABLED} (creates backup columns before changes)
  BATCH_SIZE: ${BATCH_SIZE} articles per batch
  LOG_FILE: ${PROGRESS_LOG_FILE}
      `);
      process.exit(1);
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error("❌ Script failed:", error);
    process.exit(1);
  });
}

module.exports = { runMigration, rollbackMigration, verifyMigration };
