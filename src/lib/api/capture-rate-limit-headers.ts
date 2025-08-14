import { getAdminClient } from "@/lib/db/supabase-admin";

/**
 * Captures and stores Inoreader API rate limit headers in the database
 * for RR-5: Sync Status Display
 */
export async function captureRateLimitHeaders(headers: Headers): Promise<void> {
  try {
    // Extract zone headers
    const zone1Usage = headers.get("X-Reader-Zone1-Usage");
    const zone1Limit = headers.get("X-Reader-Zone1-Limit");
    const zone2Usage = headers.get("X-Reader-Zone2-Usage");
    const zone2Limit = headers.get("X-Reader-Zone2-Limit");
    const resetAfter = headers.get("X-Reader-Limits-Reset-After");

    console.log("[RateLimitCapture] Headers received:", {
      zone1Usage,
      zone1Limit,
      zone2Usage,
      zone2Limit,
      resetAfter,
    });

    // If we have any relevant headers, update the database (only what we received)
    if (zone1Usage || zone1Limit || zone2Usage || zone2Limit || resetAfter) {
      const supabase = getAdminClient();
      const today = new Date().toISOString().split("T")[0];

      // Parse values only if present
      const usage1 =
        zone1Usage != null ? parseInt(zone1Usage.replace(/,/g, "")) : undefined;
      const limit1 =
        zone1Limit != null ? parseInt(zone1Limit.replace(/,/g, "")) : undefined;
      const usage2 =
        zone2Usage != null ? parseInt(zone2Usage.replace(/,/g, "")) : undefined;
      const limit2 =
        zone2Limit != null ? parseInt(zone2Limit.replace(/,/g, "")) : undefined;
      const resetSeconds =
        resetAfter != null
          ? parseInt(resetAfter.replace(/\.\d+$/, ""))
          : undefined;

      // Check if record exists for today
      const { data: existing } = await supabase
        .from("api_usage")
        .select("id")
        .eq("service", "inoreader")
        .eq("date", today)
        .single();

      if (existing) {
        // Update existing record
        console.log("[RateLimitCapture] Attempting to update record:", {
          id: existing.id,
          zone1_usage: usage1,
          zone2_usage: usage2,
        });

        const updateFields: Record<string, any> = {
          updated_at: new Date().toISOString(),
        };
        if (usage1 !== undefined) updateFields.zone1_usage = usage1;
        if (limit1 !== undefined) updateFields.zone1_limit = limit1;
        if (usage2 !== undefined) updateFields.zone2_usage = usage2;
        if (limit2 !== undefined) updateFields.zone2_limit = limit2;
        if (resetSeconds !== undefined) updateFields.reset_after = resetSeconds;

        const { data: updateData, error } = await supabase
          .from("api_usage")
          .update(updateFields)
          .eq("id", existing.id)
          .select();

        if (error) {
          console.error(
            "[RateLimitCapture] Failed to update api_usage:",
            error
          );
          console.error("[RateLimitCapture] Update details:", {
            id: existing.id,
            attempted_values: { zone1_usage: usage1, zone2_usage: usage2 },
          });
        } else {
          console.log("[RateLimitCapture] Successfully updated:", updateData);
          console.log("[RateLimitCapture] Updated zone usage:", {
            zone1: `${usage1}/${limit1} (${((usage1 / limit1) * 100).toFixed(1)}%)`,
            zone2: `${usage2}/${limit2} (${((usage2 / limit2) * 100).toFixed(1)}%)`,
            resetAfter: `${resetSeconds}s`,
          });
        }
      } else {
        // Insert new record
        const insertFields: Record<string, any> = {
          service: "inoreader",
          date: today,
        };
        if (usage1 !== undefined) insertFields.zone1_usage = usage1;
        if (limit1 !== undefined) insertFields.zone1_limit = limit1;
        if (usage2 !== undefined) insertFields.zone2_usage = usage2;
        if (limit2 !== undefined) insertFields.zone2_limit = limit2;
        if (resetSeconds !== undefined) insertFields.reset_after = resetSeconds;

        const { error } = await supabase.from("api_usage").insert(insertFields);

        if (error) {
          console.error(
            "[RateLimitCapture] Failed to insert api_usage:",
            error
          );
        } else {
          console.log("[RateLimitCapture] Created zone usage record:", {
            zone1: `${usage1}/${limit1}`,
            zone2: `${usage2}/${limit2}`,
          });
        }
      }
    }
  } catch (error) {
    console.error("[RateLimitCapture] Error capturing headers:", error);
    // Don't throw - this should not break the API call
  }
}

/**
 * Gets current API usage from the database
 */
export async function getCurrentApiUsage() {
  try {
    const supabase = getAdminClient();
    const today = new Date().toISOString().split("T")[0];

    const { data, error } = await supabase
      .from("api_usage")
      .select(
        "zone1_usage, zone1_limit, zone2_usage, zone2_limit, reset_after, updated_at, count"
      )
      .eq("service", "inoreader")
      .eq("date", today)
      .single();

    if (error || !data) {
      // Return defaults if no data
      return {
        zone1: { used: 0, limit: 10000, percentage: 0 },
        zone2: { used: 0, limit: 2000, percentage: 0 },
        resetAfterSeconds: 86400,
        lastUpdated: null,
      };
    }

    // Hybrid: use the larger of header usage or daily call count for Zone 1 to mitigate header lag
    const zone1Limit = data.zone1_limit || 100;
    const zone1UsedHeader = data.zone1_usage || 0;
    const dailyCount = data.count || 0;
    const zone1Used = Math.min(
      Math.max(zone1UsedHeader, dailyCount),
      zone1Limit
    );

    return {
      zone1: {
        used: zone1Used,
        limit: zone1Limit,
        percentage: zone1Limit ? (zone1Used / zone1Limit) * 100 : 0,
      },
      zone2: {
        used: data.zone2_usage || 0,
        limit: data.zone2_limit || 100,
        percentage:
          data.zone2_limit || 100
            ? ((data.zone2_usage || 0) / (data.zone2_limit || 100)) * 100
            : 0,
      },
      resetAfterSeconds: data.reset_after || 86400,
      lastUpdated: data.updated_at,
    };
  } catch (error) {
    console.error("[GetApiUsage] Error fetching usage:", error);
    // Return defaults on error
    return {
      zone1: { used: 0, limit: 10000, percentage: 0 },
      zone2: { used: 0, limit: 2000, percentage: 0 },
      resetAfterSeconds: 86400,
      lastUpdated: null,
    };
  }
}
