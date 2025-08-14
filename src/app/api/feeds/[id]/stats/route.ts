/**
 * Smart Feed Stats API Routes for RR-175
 * Secure server-side implementation for feed statistics caching
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";

// Server-side Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory cache for feed stats
const cache = new Map<
  string,
  {
    hash: string;
    stats: any;
    expiry: number;
  }
>();

const CACHE_TTL = 30 * 60 * 1000; // 30 minutes for stats cache

interface FeedStats {
  feedId: string;
  totalArticles: number;
  unreadArticles: number;
  lastUpdated: string;
  articlesThisWeek: number;
}

/**
 * Calculate hash for feed articles to detect changes
 */
async function calculateArticleHash(feedId: string): Promise<string> {
  try {
    // Sample fewer articles for better performance (20 instead of 100)
    const { data: articles, error } = await supabase
      .from("articles")
      .select("id, published_at, title")
      .eq("feed_id", feedId)
      .order("published_at", { ascending: false })
      .limit(20); // Reduced from 100 to 20

    if (error) {
      console.error("Error fetching articles for hash:", error);
      return "";
    }

    if (!articles || articles.length === 0) {
      return "empty";
    }

    // Create hash from article data
    const hashInput = articles
      .map((a) => `${a.id}:${a.published_at}:${a.title}`)
      .join("|");

    return crypto.createHash("md5").update(hashInput).digest("hex");
  } catch (error) {
    console.error("Error calculating article hash:", error);
    return "";
  }
}

/**
 * GET /api/feeds/[id]/stats
 * Get feed statistics with smart caching
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const feedId = params.id;
  const cacheKey = `feed_stats:${feedId}`;

  try {
    // Check if we have cached data
    const cached = cache.get(cacheKey);
    let currentHash = "";

    if (cached && cached.expiry > Date.now()) {
      // Calculate current hash to check if data changed
      currentHash = await calculateArticleHash(feedId);

      // If hash matches and cache is still valid, return cached data
      if (currentHash === cached.hash) {
        return NextResponse.json({
          ...cached.stats,
          cached: true,
          hashMatch: true,
        });
      }
    }

    // Data changed or cache expired - recalculate stats
    if (!currentHash) {
      currentHash = await calculateArticleHash(feedId);
    }

    // Calculate fresh stats
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [totalResult, unreadResult, weekResult] = await Promise.all([
      // Total articles
      supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("feed_id", feedId),

      // Unread articles
      supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("feed_id", feedId)
        .eq("is_read", false),

      // Articles this week
      supabase
        .from("articles")
        .select("id", { count: "exact", head: true })
        .eq("feed_id", feedId)
        .gte("published_at", oneWeekAgo.toISOString()),
    ]);

    const stats: FeedStats = {
      feedId,
      totalArticles: totalResult.count || 0,
      unreadArticles: unreadResult.count || 0,
      lastUpdated: new Date().toISOString(),
      articlesThisWeek: weekResult.count || 0,
    };

    // Cache the new stats with hash
    cache.set(cacheKey, {
      hash: currentHash,
      stats,
      expiry: Date.now() + CACHE_TTL,
    });

    return NextResponse.json({
      ...stats,
      cached: false,
      hashMatch: false,
    });
  } catch (error) {
    console.error("Error in feed stats GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/feeds/[id]/stats
 * Clear cache for a specific feed
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const feedId = params.id;
  const cacheKey = `feed_stats:${feedId}`;

  try {
    cache.delete(cacheKey);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error clearing feed stats cache:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
