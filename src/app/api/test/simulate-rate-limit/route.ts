import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/db/supabase-admin";

const supabase = getAdminClient();

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { zone1Usage, zone2Usage, resetScenario } = body;

    const today = new Date().toISOString().split("T")[0];

    // Reset scenario - clear existing data
    if (resetScenario) {
      await supabase
        .from("api_usage")
        .delete()
        .eq("service", "inoreader")
        .eq("date", today);

      return NextResponse.json({
        success: true,
        message: "Rate limit data reset for testing",
      });
    }

    // Simulate different rate limit scenarios
    const zone1Limit = 5000; // Zone 1 (read operations)
    const zone2Limit = 100; // Zone 2 (write operations)

    // Ensure values don't exceed limits
    const actualZone1 = Math.min(zone1Usage || 0, zone1Limit);
    const actualZone2 = Math.min(zone2Usage || 0, zone2Limit);

    // Check if record exists for today
    const { data: existing } = await supabase
      .from("api_usage")
      .select("id")
      .eq("service", "inoreader")
      .eq("date", today)
      .single();

    if (existing) {
      // Update existing record
      const { error } = await supabase
        .from("api_usage")
        .update({
          zone1_usage: actualZone1,
          zone1_limit: zone1Limit,
          zone2_usage: actualZone2,
          zone2_limit: zone2Limit,
          reset_after: 86400, // 24 hours in seconds
          updated_at: new Date().toISOString(),
          count: actualZone1, // Legacy support
        })
        .eq("id", existing.id);

      if (error) {
        throw error;
      }
    } else {
      // Insert new record
      const { error } = await supabase.from("api_usage").insert({
        service: "inoreader",
        date: today,
        zone1_usage: actualZone1,
        zone1_limit: zone1Limit,
        zone2_usage: actualZone2,
        zone2_limit: zone2Limit,
        reset_after: 86400,
        count: actualZone1, // Legacy support
      });

      if (error) {
        throw error;
      }
    }

    return NextResponse.json({
      success: true,
      message: "Rate limit simulation set up successfully",
      data: {
        zone1: {
          usage: actualZone1,
          limit: zone1Limit,
          percentage: ((actualZone1 / zone1Limit) * 100).toFixed(1),
        },
        zone2: {
          usage: actualZone2,
          limit: zone2Limit,
          percentage: ((actualZone2 / zone2Limit) * 100).toFixed(1),
        },
      },
    });
  } catch (error) {
    console.error("[Test] Rate limit simulation error:", error);
    return NextResponse.json(
      {
        error: "simulation_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("api_usage")
      .select("*")
      .eq("service", "inoreader")
      .eq("date", today)
      .single();

    if (error && error.code !== "PGRST116") {
      throw error;
    }

    if (!data) {
      return NextResponse.json({
        zone1: { usage: 0, limit: 5000, percentage: 0 },
        zone2: { usage: 0, limit: 100, percentage: 0 },
        message: "No data for today - use POST to simulate",
      });
    }

    return NextResponse.json({
      zone1: {
        usage: data.zone1_usage || 0,
        limit: data.zone1_limit || 5000,
        percentage: data.zone1_limit
          ? ((data.zone1_usage / data.zone1_limit) * 100).toFixed(1)
          : 0,
      },
      zone2: {
        usage: data.zone2_usage || 0,
        limit: data.zone2_limit || 100,
        percentage: data.zone2_limit
          ? ((data.zone2_usage / data.zone2_limit) * 100).toFixed(1)
          : 0,
      },
      lastUpdated: data.updated_at,
    });
  } catch (error) {
    console.error("[Test] Error fetching rate limit data:", error);
    return NextResponse.json(
      {
        error: "fetch_failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
