/**
 * @fileoverview Read Status Reconciliation Endpoint
 * Syncs read status from Inoreader to app using inverse logic:
 * - Fetch ONLY unread articles from Inoreader
 * - Mark everything else in the app as read
 */

import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/db/supabase-admin";

// @ts-ignore
import TokenManager from "../../../../../server/lib/token-manager.js";

const supabase = getAdminClient();

export async function POST() {
  try {
    console.log("[MarkOthersRead] Starting read status reconciliation...");

    // Initialize token manager
    const tokenManager = new TokenManager();

    // Step 1: Fetch ONLY unread articles from Inoreader
    // Using xt parameter to exclude read articles (same as main sync)
    const streamUrl = `https://www.inoreader.com/reader/api/0/stream/contents/user/-/state/com.google/reading-list?n=5000&xt=user/-/state/com.google/read`;

    console.log("[MarkOthersRead] Fetching unread articles from Inoreader...");
    const streamResponse =
      await tokenManager.makeAuthenticatedRequest(streamUrl);

    if (!streamResponse.ok) {
      throw new Error(`Failed to fetch articles: ${streamResponse.statusText}`);
    }

    const streamData = await streamResponse.json();
    const unreadArticles = streamData.items || [];

    console.log(
      `[MarkOthersRead] Found ${unreadArticles.length} unread articles in Inoreader`
    );

    // Step 2: Extract Inoreader IDs of unread articles
    const unreadInoreaderIds = unreadArticles.map((article: any) => article.id);

    if (unreadInoreaderIds.length === 0) {
      // No unread articles - mark everything as read
      console.log(
        "[MarkOthersRead] No unread articles in Inoreader - marking all app articles as read"
      );

      const { error: updateError, count } = await supabase
        .from("articles")
        .update({
          is_read: true,
          updated_at: new Date().toISOString(),
        })
        .eq("is_read", false);

      if (updateError) {
        throw new Error(`Database update failed: ${updateError.message}`);
      }

      return NextResponse.json({
        success: true,
        message: "All articles marked as read",
        stats: {
          unreadInInoreader: 0,
          markedAsRead: count || 0,
        },
      });
    }

    // Step 3: Mark articles as read that are NOT in the unread list
    console.log(
      `[MarkOthersRead] Marking articles as read that are not in the unread list...`
    );

    const { error: updateError, count } = await supabase
      .from("articles")
      .update({
        is_read: true,
        updated_at: new Date().toISOString(),
      })
      .not("inoreader_id", "in", `(${unreadInoreaderIds.join(",")})`)
      .eq("is_read", false);

    if (updateError) {
      throw new Error(`Database update failed: ${updateError.message}`);
    }

    console.log(
      `[MarkOthersRead] Successfully marked ${count || 0} articles as read`
    );

    // Step 4: Refresh materialized view for accurate counts
    await supabase.rpc("refresh_feed_stats");

    return NextResponse.json({
      success: true,
      message: "Read status reconciliation completed",
      stats: {
        unreadInInoreader: unreadInoreaderIds.length,
        markedAsRead: count || 0,
      },
    });
  } catch (error) {
    console.error("[MarkOthersRead] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
