/**
 * Analytics endpoint for fetch logs
 * Used by tests to verify fetch attempts were logged correctly
 */

import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/db/supabase";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const articleId = searchParams.get("article_id");
    const limit = parseInt(searchParams.get("limit") || "10");

    let query = supabase
      .from("fetch_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (articleId) {
      query = query.eq("article_id", articleId);
    }

    const { data: logs, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({
      logs: logs || [],
      count: logs?.length || 0,
    });
  } catch (error) {
    console.error("Error fetching logs:", error);
    return NextResponse.json(
      { error: "Failed to fetch logs" },
      { status: 500 }
    );
  }
}
