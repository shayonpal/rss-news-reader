import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/tags - List all tags with optional filtering
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // Query parameters
    const search = searchParams.get("search") || "";
    const sortBy = searchParams.get("sortBy") || "name"; // name, count, recent
    const order = searchParams.get("order") || "asc";
    const limit = parseInt(searchParams.get("limit") || "50");
    const offset = parseInt(searchParams.get("offset") || "0");
    const includeEmpty = searchParams.get("includeEmpty") === "true";

    // Get user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", "shayon")
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // First get all tags
    let query = supabase.from("tags").select("*").eq("user_id", userData.id);

    // Apply search filter
    if (search) {
      query = query.ilike("name", `%${search}%`);
    }

    // Filter out empty tags unless requested
    if (!includeEmpty) {
      query = query.gt("article_count", 0);
    }

    // Apply sorting
    switch (sortBy) {
      case "count":
        query = query.order("article_count", { ascending: order === "asc" });
        break;
      case "recent":
        query = query.order("updated_at", { ascending: order === "asc" });
        break;
      default:
        query = query.order("name", { ascending: order === "asc" });
    }

    // Apply pagination
    query = query.range(offset, offset + limit - 1);

    const { data: tags, error, count } = await query;

    if (error) {
      console.error("Error fetching tags:", error);
      return NextResponse.json(
        { error: "Failed to fetch tags", details: error.message },
        { status: 500 }
      );
    }

    // Get unread counts for all tags in one query scoped to the user's feeds
    // 1) Fetch all feed IDs for this user
    const { data: userFeeds, error: feedsError } = await supabase
      .from("feeds")
      .select("id")
      .eq("user_id", userData.id);

    if (feedsError) {
      console.error(
        "Error fetching user feeds for tag unread counts:",
        feedsError
      );
    }

    const feedIds = (userFeeds || []).map((f: any) => f.id);

    // 2) Fetch unread articles joined with tag associations, filtered by user's feeds
    const { data: unreadCounts, error: unreadError } = await supabase
      .from("articles")
      .select(
        `
        id,
        feed_id,
        is_read,
        article_tags!inner(
          tag_id,
          tags!inner(id)
        )
      `
      )
      .in(
        "feed_id",
        feedIds.length > 0 ? feedIds : ["00000000-0000-0000-0000-000000000000"]
      ) // guard against empty IN
      .eq("is_read", false);

    if (unreadError) {
      console.error("Error fetching unread tag counts:", unreadError);
    }

    // Build unread count map
    const unreadMap = new Map<string, number>();
    unreadCounts?.forEach((article: any) => {
      if (article.article_tags && Array.isArray(article.article_tags)) {
        article.article_tags.forEach((tagRelation: any) => {
          const tagId = tagRelation.tags?.id;
          if (tagId) {
            unreadMap.set(tagId, (unreadMap.get(tagId) || 0) + 1);
          }
        });
      }
    });

    // Add unread counts to tags
    const enrichedTags = (tags || []).map((tag) => ({
      ...tag,
      unread_count: unreadMap.get(tag.id) || 0,
    }));

    return NextResponse.json({
      tags: enrichedTags,
      pagination: {
        limit,
        offset,
        total: count || 0,
        hasMore: count ? offset + limit < count : false,
      },
    });
  } catch (error) {
    console.error("Tags API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

// POST /api/tags - Create a new tag
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const { name, color, description } = body;

    if (!name || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Tag name is required" },
        { status: 400 }
      );
    }

    // Get user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", "shayon")
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Create slug
    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

    // Check if tag already exists
    const { data: existingTag } = await supabase
      .from("tags")
      .select("id")
      .eq("user_id", userData.id)
      .eq("slug", slug)
      .single();

    if (existingTag) {
      return NextResponse.json(
        { error: "Tag already exists" },
        { status: 409 }
      );
    }

    // Create tag
    const { data: newTag, error: createError } = await supabase
      .from("tags")
      .insert({
        name: name.trim(),
        slug,
        color: color || null,
        description: description || null,
        user_id: userData.id,
        article_count: 0,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating tag:", createError);
      return NextResponse.json(
        { error: "Failed to create tag", details: createError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(newTag, { status: 201 });
  } catch (error) {
    console.error("Create tag error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
