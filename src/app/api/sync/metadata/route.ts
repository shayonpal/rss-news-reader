import { NextResponse } from "next/server";
import { getAdminClient } from "@/lib/db/supabase-admin";

// Use singleton Supabase admin client for better connection pooling
const supabase = getAdminClient();

export async function POST(request: Request) {
  try {
    const updates = await request.json();

    // Validate input
    if (!updates || typeof updates !== "object") {
      return NextResponse.json(
        { error: "Invalid request body" },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    // Whitelist of allowed metadata keys
    const allowedKeys = [
      "sync_interval",
      "last_sync_time",
      "last_sync_count",
      "api_calls_count",
      "sync_in_progress",
      "sync_errors_count",
      "last_error",
      "refresh_token",
      "access_token",
      "token_expires_at",
    ];

    // Validate keys
    const invalidKeys = Object.keys(updates).filter(
      (key) => !allowedKeys.includes(key)
    );
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        {
          error: "Invalid metadata keys",
          invalidKeys,
          allowedKeys,
        },
        {
          status: 400,
          headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
          },
        }
      );
    }

    let updatedCount = 0;

    // Use a transaction for bulk operations
    const updatePromises = [];

    // Process each update
    for (const [key, value] of Object.entries(updates)) {
      // Sanitize value
      let sanitizedValue: string;

      if (typeof value === "object" && value !== null && "increment" in value) {
        // Handle increment operations
        const { data: existing } = await supabase
          .from("sync_metadata")
          .select("value")
          .eq("key", key)
          .single();

        const currentValue = parseInt(existing?.value || "0");
        const incrementValue = Number((value as any).increment);

        if (isNaN(incrementValue)) {
          continue; // Skip invalid increment values
        }

        sanitizedValue = String(currentValue + incrementValue);
      } else {
        // Direct value update - sanitize
        sanitizedValue = String(value).substring(0, 1000); // Limit value length
      }

      updatePromises.push(
        supabase.from("sync_metadata").upsert(
          {
            key,
            value: sanitizedValue,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "key" }
        )
      );
      updatedCount++;
    }

    // Execute all updates
    await Promise.all(updatePromises);

    return NextResponse.json(
      { success: true, updatedCount },
      {
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  } catch (error) {
    console.error("Failed to update sync metadata:", error);
    return NextResponse.json(
      { error: "Failed to update sync metadata" },
      {
        status: 500,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
        },
      }
    );
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    },
  });
}
