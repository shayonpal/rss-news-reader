import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/db/supabase-admin";

export async function GET() {
  const supabase = getAdminClient();
  const today = new Date().toISOString().split("T")[0];

  try {
    // Get ALL records for today (not just single)
    const { data, error } = await supabase
      .from("api_usage")
      .select("*")
      .eq("service", "inoreader")
      .eq("date", today)
      .order("updated_at", { ascending: false });

    if (error) {
      throw error;
    }

    return NextResponse.json({
      date: today,
      record_count: data?.length || 0,
      records: data || [],
      issue:
        data && data.length > 1
          ? "⚠️ DUPLICATE RECORDS FOUND!"
          : "✅ No duplicates",
      explanation:
        data && data.length > 1
          ? "Multiple records for the same date cause inconsistent readings. The '.single()' query might return either one."
          : "Single record as expected",
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "check_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
