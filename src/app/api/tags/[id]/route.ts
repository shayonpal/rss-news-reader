import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withTagIdValidation } from "@/lib/utils/uuid-validation-middleware";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/tags/[id] - Get tag details with associated articles
const getHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const tagId = params.id;

    // Get user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", "shayon")
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Get tag details
    const { data: tag, error: tagError } = await supabase
      .from("tags")
      .select("*")
      .eq("id", tagId)
      .eq("user_id", userData.id)
      .single();

    if (tagError || !tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Get associated articles (optionally)
    const { searchParams } = new URL(request.url);
    const includeArticles = searchParams.get("includeArticles") === "true";
    const limit = parseInt(searchParams.get("limit") || "10");

    if (includeArticles) {
      const { data: articleTags, error: articlesError } = await supabase
        .from("article_tags")
        .select(
          `
          articles (
            id,
            title,
            url,
            published_at,
            is_read,
            is_starred,
            feeds (
              id,
              title
            )
          )
        `
        )
        .eq("tag_id", tagId)
        .order("created_at", { ascending: false })
        .limit(limit);

      if (articlesError) {
        console.error("Error fetching articles for tag:", articlesError);
      }

      return NextResponse.json({
        ...tag,
        articles: articleTags?.map((at) => at.articles).filter(Boolean) || [],
      });
    }

    return NextResponse.json(tag);
  } catch (error) {
    console.error("Get tag error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};

// Export the wrapped GET handler with UUID validation
export const GET = withTagIdValidation(getHandler);

// DELETE /api/tags/[id] - Delete a tag and all associations
const deleteHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const tagId = params.id;

    // Get user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", "shayon")
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if tag exists and belongs to user
    const { data: tag, error: tagError } = await supabase
      .from("tags")
      .select("id")
      .eq("id", tagId)
      .eq("user_id", userData.id)
      .single();

    if (tagError || !tag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Delete tag (CASCADE will handle article_tags)
    const { error: deleteError } = await supabase
      .from("tags")
      .delete()
      .eq("id", tagId);

    if (deleteError) {
      console.error("Error deleting tag:", deleteError);
      return NextResponse.json(
        { error: "Failed to delete tag", details: deleteError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { message: "Tag deleted successfully" },
      { status: 200 }
    );
  } catch (error) {
    console.error("Delete tag error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};

// Export the wrapped DELETE handler with UUID validation
export const DELETE = withTagIdValidation(deleteHandler);

// PATCH /api/tags/[id] - Update a tag
const patchHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const tagId = params.id;
    const body = await request.json();

    const { name, color, description } = body;

    // Get user
    const { data: userData, error: userError } = await supabase
      .from("users")
      .select("id")
      .eq("inoreader_id", "shayon")
      .single();

    if (userError || !userData) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check if tag exists and belongs to user
    const { data: existingTag, error: tagError } = await supabase
      .from("tags")
      .select("*")
      .eq("id", tagId)
      .eq("user_id", userData.id)
      .single();

    if (tagError || !existingTag) {
      return NextResponse.json({ error: "Tag not found" }, { status: 404 });
    }

    // Prepare update data
    const updateData: any = {};

    if (name !== undefined && name.trim().length > 0) {
      updateData.name = name.trim();
      updateData.slug = name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
    }

    if (color !== undefined) {
      updateData.color = color;
    }

    if (description !== undefined) {
      updateData.description = description;
    }

    // Update tag
    const { data: updatedTag, error: updateError } = await supabase
      .from("tags")
      .update(updateData)
      .eq("id", tagId)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating tag:", updateError);
      return NextResponse.json(
        { error: "Failed to update tag", details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(updatedTag);
  } catch (error) {
    console.error("Update tag error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};

// Export the wrapped PATCH handler with UUID validation
export const PATCH = withTagIdValidation(patchHandler);
