import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { withArticleIdValidation } from "@/lib/utils/uuid-validation-middleware";

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// GET /api/articles/[id]/tags - Get tags for an article
const getHandler = async (
  request: NextRequest,
  { params }: { params: { id: string } }
) => {
  try {
    const articleId = params.id;

    // Get tags for this article
    const { data: articleTags, error } = await supabase
      .from("article_tags")
      .select(
        `
        tag:tags(
          id,
          name,
          slug,
          color,
          description
        )
      `
      )
      .eq("article_id", articleId);

    if (error) {
      console.error("Error fetching article tags:", error);
      return NextResponse.json(
        { error: "Failed to fetch tags", details: error.message },
        { status: 500 }
      );
    }

    // Flatten the response to just return the tags
    const tags = articleTags?.map((at) => at.tag).filter(Boolean) || [];

    return NextResponse.json({ tags });
  } catch (error) {
    console.error("Article tags API error:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
};

// Export the wrapped handler with UUID validation
export const GET = withArticleIdValidation(getHandler);
