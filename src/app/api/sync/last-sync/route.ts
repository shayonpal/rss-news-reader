import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import fs from "fs/promises";
import path from "path";

export async function GET() {
  try {
    // Prefer database truth for both manual and cron syncs
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    // 1) sync_metadata key last_sync_time (written at end of sync)
    const { data: metaRow } = await supabase
      .from("sync_metadata")
      .select("value, updated_at")
      .eq("key", "last_sync_time")
      .single();

    if (metaRow?.value) {
      return NextResponse.json({
        lastSyncTime: new Date(metaRow.value).toISOString(),
        source: "sync_metadata"
      });
    }

    // 2) sync_status table latest completed
    const { data: statusRows } = await supabase
      .from("sync_status")
      .select("completed_at, updated_at, status")
      .eq("status", "completed")
      .order("updated_at", { ascending: false })
      .limit(1);

    const statusRow = Array.isArray(statusRows) ? statusRows[0] : null;
    if (statusRow?.completed_at) {
      return NextResponse.json({
        lastSyncTime: new Date(statusRow.completed_at).toISOString(),
        source: "sync_status"
      });
    }

    // 3) Fallback to sync-cron log file (older cron-only approach)
    try {
      const syncLogPath = path.join(process.cwd(), "logs", "sync-cron.jsonl");
      const logContent = await fs.readFile(syncLogPath, "utf-8");
      const lines = logContent.trim().split("\n");
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const entry = JSON.parse(lines[i]);
          if (entry.status === "completed" && entry.timestamp) {
            return NextResponse.json({
              lastSyncTime: new Date(entry.timestamp).toISOString(),
              source: "sync-log"
            });
          }
        } catch {
          continue;
        }
      }
    } catch {
      // Ignore
    }

    // No data found
    return NextResponse.json({ lastSyncTime: null, source: "none" });

  } catch (error) {
    console.error("Error fetching last sync time:", error);
    return NextResponse.json(
      { error: "Failed to fetch last sync time" },
      { status: 500 }
    );
  }
}