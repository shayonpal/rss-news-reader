/**
 * Cursor-Based Pagination API Route for RR-175
 * Secure server-side implementation for article pagination
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { Article } from "@/lib/db/types";

// Server-side Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DEFAULT_PAGE_SIZE = 50;

interface CursorPaginationParams {
  cursor?: string;
  direction?: "next" | "prev";
  pageSize?: number;
  feedId?: string;
  userId?: string;
  isRead?: boolean;
}

interface PaginationResult {
  articles: Article[];
  nextCursor: string | null;
  prevCursor: string | null;
  hasNext: boolean;
  hasPrev: boolean;
  total?: number;
}

/**
 * Validate cursor format
 */
function validateCursor(cursor: string): boolean {
  if (!cursor) return false;

  try {
    // Cursor should be a timestamp or article ID
    const parsed = new Date(cursor);
    return !isNaN(parsed.getTime());
  } catch {
    // Try as UUID format for article ID
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(cursor);
  }
}

/**
 * GET /api/articles/paginated
 * Get paginated articles with cursor-based pagination
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const cursor = searchParams.get("cursor") || undefined;
  const direction =
    (searchParams.get("direction") as "next" | "prev") || "next";
  const pageSize = Math.min(
    parseInt(searchParams.get("pageSize") || "50"),
    100
  ); // Max 100
  const feedId = searchParams.get("feedId") || undefined;
  const userId = searchParams.get("userId") || undefined;
  const isRead = searchParams.get("isRead")
    ? searchParams.get("isRead") === "true"
    : undefined;

  try {
    // Validate cursor if provided
    if (cursor && !validateCursor(cursor)) {
      return NextResponse.json(
        { error: "Invalid cursor format" },
        { status: 400 }
      );
    }

    // Build base query
    let query = supabase.from("articles").select(`
        id,
        feed_id,
        inoreader_id,
        title,
        content,
        full_content,
        has_full_content,
        ai_summary,
        author,
        url,
        published_at,
        is_read,
        is_starred,
        parsed_at,
        parse_failed,
        parse_attempts,
        created_at,
        updated_at
      `);

    // Add filters
    if (feedId) {
      query = query.eq("feed_id", feedId);
    }

    if (userId) {
      query = query.eq("user_id", userId);
    }

    if (isRead !== undefined) {
      query = query.eq("is_read", isRead);
    }

    // Apply cursor-based pagination
    if (cursor) {
      if (direction === "next") {
        // For next page, get articles published before cursor
        query = query
          .lt("published_at", cursor)
          .order("published_at", { ascending: false });
      } else {
        // For previous page, get articles published after cursor
        query = query
          .gt("published_at", cursor)
          .order("published_at", { ascending: true }); // Note: ascending for prev
      }
    } else {
      // First page - start from most recent
      query = query.order("published_at", { ascending: false });
    }

    // Fetch one extra to check if there are more pages
    query = query.limit(pageSize + 1);

    const { data: articles, error } = await query;

    if (error) {
      console.error("Error fetching paginated articles:", error);
      return NextResponse.json(
        { error: "Failed to fetch articles" },
        { status: 500 }
      );
    }

    if (!articles) {
      return NextResponse.json({
        articles: [],
        nextCursor: null,
        prevCursor: null,
        hasNext: false,
        hasPrev: false,
      });
    }

    // Check if we have more pages
    const hasMore = articles.length > pageSize;
    const resultArticles = hasMore ? articles.slice(0, pageSize) : articles;

    // For previous direction, reverse the order back to descending
    if (direction === "prev") {
      resultArticles.reverse();
    }

    // Determine cursors and navigation availability
    let nextCursor: string | null = null;
    let prevCursor: string | null = null;
    let hasNext = false;
    let hasPrev = false;

    if (resultArticles.length > 0) {
      const firstArticle = resultArticles[0];
      const lastArticle = resultArticles[resultArticles.length - 1];

      if (direction === "next") {
        // We can go back if we have a cursor (not on first page)
        hasPrev = !!cursor;
        prevCursor = hasPrev ? firstArticle.published_at : null;

        // We can go forward if there are more articles
        hasNext = hasMore;
        nextCursor = hasNext ? lastArticle.published_at : null;
      } else {
        // Previous direction
        hasNext = !!cursor; // We can go forward if we came from somewhere
        nextCursor = hasNext ? lastArticle.published_at : null;

        hasPrev = hasMore;
        prevCursor = hasPrev ? firstArticle.published_at : null;
      }
    }

    const result: PaginationResult = {
      articles: resultArticles,
      nextCursor,
      prevCursor,
      hasNext,
      hasPrev,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in paginated articles GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
