/**
 * Test endpoint for verifying article content state
 * Used by Playwright tests to check if auto-fetch worked correctly
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Get article with content status
    const { data: article, error } = await supabase
      .from("articles")
      .select("has_full_content, full_content, content, ai_summary")
      .eq("id", id)
      .single();

    if (error || !article) {
      return NextResponse.json({ error: "Article not found" }, { status: 404 });
    }

    return NextResponse.json({
      article_id: id,
      has_full_content: article.has_full_content,
      full_content: article.full_content,
      content: article.content,
      ai_summary: article.ai_summary,
      full_content_length: article.full_content?.length || 0,
      content_length: article.content?.length || 0,
    });
  } catch (error) {
    console.error("Error checking article content:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
