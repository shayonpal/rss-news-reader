#!/usr/bin/env node

/**
 * Cleanup script for old parsed content
 * Runs via cron to remove parsed content older than retention period
 * Schedule: Daily at 3 AM
 */

const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function cleanupParsedContent() {
  console.log(`[${new Date().toISOString()}] Starting parsed content cleanup...`);

  try {
    // Get retention policy from config
    const { data: config } = await supabase
      .from("system_config")
      .select("value")
      .eq("key", "content_retention_days")
      .single();

    const retentionDays = parseInt(config?.value || "30");
    console.log(`Using retention policy: ${retentionDays} days`);

    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);
    
    console.log(`Cleaning content parsed before: ${cutoffDate.toISOString()}`);

    // Count articles to be cleaned
    const { count: beforeCount } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .not("full_content", "is", null)
      .lt("parsed_at", cutoffDate.toISOString())
      .eq("is_read", true)
      .eq("is_starred", false);

    console.log(`Found ${beforeCount || 0} articles to clean`);

    if (beforeCount && beforeCount > 0) {
      // Perform cleanup
      const { data, error } = await supabase
        .from("articles")
        .update({
          full_content: null,
          parsed_at: null,
        })
        .lt("parsed_at", cutoffDate.toISOString())
        .eq("is_read", true)
        .eq("is_starred", false)
        .not("full_content", "is", null)
        .select();

      if (error) {
        throw error;
      }

      console.log(`Successfully cleaned ${data?.length || 0} articles`);

      // Log cleanup stats
      await supabase.from("system_logs").insert({
        log_type: "cleanup",
        message: `Cleaned ${data?.length || 0} parsed articles older than ${retentionDays} days`,
        metadata: {
          retention_days: retentionDays,
          cutoff_date: cutoffDate.toISOString(),
          articles_cleaned: data?.length || 0,
        },
        created_at: new Date().toISOString(),
      });
    }

    // Also run the database function to detect partial feeds
    console.log("Running partial feed detection...");
    const { error: detectError } = await supabase.rpc("detect_partial_feeds");
    
    if (detectError) {
      console.error("Error detecting partial feeds:", detectError);
    } else {
      console.log("Partial feed detection completed");
    }

    console.log(`[${new Date().toISOString()}] Cleanup completed successfully`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Cleanup error:`, error);
    
    // Log error
    await supabase.from("system_logs").insert({
      log_type: "cleanup_error",
      message: `Cleanup failed: ${error.message}`,
      metadata: {
        error: error.message,
        stack: error.stack,
      },
      created_at: new Date().toISOString(),
    }).catch(console.error);
    
    process.exit(1);
  }
}

// Run cleanup
cleanupParsedContent().catch(console.error);