const { createClient } = require("@supabase/supabase-js");

/**
 * Node.js version of header capture for use in TokenManager
 * This ensures EVERY Inoreader API call is tracked
 */
async function captureRateLimitHeaders(headers) {
  try {
    // Extract zone headers
    const zone1Usage = headers.get("X-Reader-Zone1-Usage");
    const zone1Limit = headers.get("X-Reader-Zone1-Limit");
    const zone2Usage = headers.get("X-Reader-Zone2-Usage");
    const zone2Limit = headers.get("X-Reader-Zone2-Limit");
    const resetAfter = headers.get("X-Reader-Limits-Reset-After");

    // Only proceed if we have rate limit headers
    if (!zone1Usage && !zone2Usage) {
      return; // No rate limit headers to capture
    }

    console.log("[TokenManager] Rate limit headers detected:", {
      zone1: zone1Usage,
      zone2: zone2Usage,
    });

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const today = new Date().toISOString().split("T")[0];

    // Parse values only if present (trust headers; no hard defaults)
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
      // Update existing record (partial update based on provided headers)
      const updateFields = { updated_at: new Date().toISOString() };
      if (usage1 !== undefined) updateFields.zone1_usage = usage1;
      if (limit1 !== undefined) updateFields.zone1_limit = limit1;
      if (usage2 !== undefined) updateFields.zone2_usage = usage2;
      if (limit2 !== undefined) updateFields.zone2_limit = limit2;
      if (resetSeconds !== undefined) updateFields.reset_after = resetSeconds;

      const { error } = await supabase
        .from("api_usage")
        .update(updateFields)
        .eq("id", existing.id);

      if (error) {
        console.error("[TokenManager] Failed to update api_usage:", error);
      } else {
        console.log(
          "[TokenManager] Updated api_usage - Zone 1:",
          usage1,
          "Zone 2:",
          usage2
        );
      }
    } else {
      // Insert new record with only fields provided by headers
      const insertFields = { service: "inoreader", date: today };
      if (usage1 !== undefined) insertFields.zone1_usage = usage1;
      if (limit1 !== undefined) insertFields.zone1_limit = limit1;
      if (usage2 !== undefined) insertFields.zone2_usage = usage2;
      if (limit2 !== undefined) insertFields.zone2_limit = limit2;
      if (resetSeconds !== undefined) insertFields.reset_after = resetSeconds;

      const { error } = await supabase.from("api_usage").insert(insertFields);

      if (error) {
        console.error("[TokenManager] Failed to insert api_usage:", error);
      } else {
        console.log(
          "[TokenManager] Created api_usage - Zone 1:",
          usage1,
          "Zone 2:",
          usage2
        );
      }
    }
  } catch (error) {
    console.error("[TokenManager] Error capturing headers:", error);
    // Don't throw - this should not break API calls
  }
}

module.exports = { captureRateLimitHeaders };
