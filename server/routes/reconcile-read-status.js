const express = require("express");
const { createClient } = require("@supabase/supabase-js");
const TokenManager = require("../lib/token-manager");

const router = express.Router();

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

/**
 * POST /server/reconcile-read-status
 * Syncs read status from Inoreader to app using inverse logic:
 * - Fetch ONLY unread articles from Inoreader
 * - Mark everything else in the app as read
 */
router.post("/reconcile-read-status", async (req, res) => {
  try {
    console.log("[ReconcileReadStatus] Starting read status reconciliation...");

    // Initialize token manager
    const tokenManager = new TokenManager();

    // Step 1: Fetch ONLY unread articles from Inoreader
    // Using xt parameter to exclude read articles (same as main sync)
    const streamUrl = `https://www.inoreader.com/reader/api/0/stream/contents/user/-/state/com.google/reading-list?n=5000&xt=user/-/state/com.google/read`;

    console.log(
      "[ReconcileReadStatus] Fetching unread articles from Inoreader..."
    );
    const streamResponse =
      await tokenManager.makeAuthenticatedRequest(streamUrl);

    if (!streamResponse.ok) {
      throw new Error(`Failed to fetch articles: ${streamResponse.statusText}`);
    }

    const streamData = await streamResponse.json();
    const unreadArticles = streamData.items || [];

    console.log(
      `[ReconcileReadStatus] Found ${unreadArticles.length} unread articles in Inoreader`
    );

    // Step 2: Extract Inoreader IDs of unread articles
    const unreadInoreaderIds = unreadArticles.map((article) => article.id);

    if (unreadInoreaderIds.length === 0) {
      // No unread articles - mark everything as read
      console.log(
        "[ReconcileReadStatus] No unread articles in Inoreader - marking all app articles as read"
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

      // Refresh materialized view
      await supabase.rpc("refresh_feed_stats");

      return res.json({
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
      `[ReconcileReadStatus] Marking articles as read that are not in the unread list...`
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
      `[ReconcileReadStatus] Successfully marked ${count || 0} articles as read`
    );

    // Step 4: Refresh materialized view for accurate counts
    await supabase.rpc("refresh_feed_stats");

    return res.json({
      success: true,
      message: "Read status reconciliation completed",
      stats: {
        unreadInInoreader: unreadInoreaderIds.length,
        markedAsRead: count || 0,
      },
    });
  } catch (error) {
    console.error("[ReconcileReadStatus] Error:", error);
    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error",
    });
  }
});

module.exports = router;
