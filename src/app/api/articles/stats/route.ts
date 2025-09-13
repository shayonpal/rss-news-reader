import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUserId } from "@/lib/utils/get-current-user";

/**
 * RR-274: Article Statistics API Endpoint
 * Returns live article counts for the settings page display
 */
export async function GET() {
  try {
    const supabase = createClient();

    // Get current user ID (single-user MVP system)
    const userId = await getCurrentUserId();

    // First get all feed IDs for this user
    const { data: userFeeds, error: feedsError } = await supabase
      .from("feeds")
      .select("id")
      .eq("user_id", userId);

    if (feedsError) {
      console.error("Error fetching user feeds:", feedsError);
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    const feedIds = userFeeds?.map((feed) => feed.id) || [];

    if (feedIds.length === 0) {
      // No feeds = no articles
      return NextResponse.json({
        total: 0,
        unread: 0,
        starred: 0,
      });
    }

    // Get total article count
    const { count: totalCount, error: totalError } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .in("feed_id", feedIds);

    if (totalError) {
      console.error("Error fetching total count:", totalError);
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    // Get unread count
    const { count: unreadCount, error: unreadError } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .in("feed_id", feedIds)
      .eq("is_read", false);

    if (unreadError) {
      console.error("Error fetching unread count:", unreadError);
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    // Get starred count
    const { count: starredCount, error: starredError } = await supabase
      .from("articles")
      .select("*", { count: "exact", head: true })
      .in("feed_id", feedIds)
      .eq("is_starred", true);

    if (starredError) {
      console.error("Error fetching starred count:", starredError);
      return NextResponse.json(
        { error: "Failed to fetch statistics" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      total: totalCount || 0,
      unread: unreadCount || 0,
      starred: starredCount || 0,
    });
  } catch (error) {
    console.error("Error in statistics endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
