import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    // First try to get from sync log
    const syncLogPath = path.join(process.cwd(), "logs", "sync-cron.jsonl");
    
    try {
      const logContent = await fs.readFile(syncLogPath, "utf-8");
      const lines = logContent.trim().split("\n");
      
      // Find the last completed sync
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.status === "completed" && entry.timestamp) {
            return NextResponse.json({
              lastSyncTime: new Date(entry.timestamp).toISOString(),
              source: "sync-log"
            });
          }
        } catch (e) {
          // Skip malformed lines
          continue;
        }
      }
    } catch (fileError) {
      console.log("Could not read sync log, checking database...");
    }

    // Fallback to database
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // Check sync_metadata table for last sync
    const { data: syncMetadata, error } = await supabase
      .from("sync_metadata")
      .select("last_sync_at")
      .single();

    if (!error && syncMetadata?.last_sync_at) {
      return NextResponse.json({
        lastSyncTime: syncMetadata.last_sync_at,
        source: "database"
      });
    }

    // If no sync data found, return null
    return NextResponse.json({
      lastSyncTime: null,
      source: "none"
    });

  } catch (error) {
    console.error("Error fetching last sync time:", error);
    return NextResponse.json(
      { error: "Failed to fetch last sync time" },
      { status: 500 }
    );
  }
}