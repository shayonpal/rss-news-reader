/**
 * RR-237: API Usage Tracker with RPC function support
 * Server-side implementation for Node.js
 */

class ApiUsageTracker {
  constructor(supabase) {
    this.supabase = supabase;
  }

  /**
   * Track API usage using RPC function
   * Uses atomic UPSERT operation to avoid race conditions
   */
  async trackUsage(params) {
    // Validate required parameters
    if (!params.service || params.service.trim() === "") {
      return {
        success: false,
        error: "Service name is required",
      };
    }

    const date = params.date || new Date().toISOString().split("T")[0];
    const increment = params.increment ?? 1;

    try {
      // If zone parameters are provided, use update_api_usage_zones
      if (
        params.zone1_usage !== undefined ||
        params.zone2_usage !== undefined ||
        params.zone1_limit !== undefined ||
        params.zone2_limit !== undefined ||
        params.reset_after !== undefined
      ) {
        const { data, error } = await this.supabase.rpc(
          "update_api_usage_zones",
          {
            p_service: params.service,
            p_date: date,
            p_zone1_usage: params.zone1_usage ?? null,
            p_zone2_usage: params.zone2_usage ?? null,
            p_zone1_limit: params.zone1_limit ?? null,
            p_zone2_limit: params.zone2_limit ?? null,
            p_reset_after: params.reset_after ?? null,
          }
        );

        if (error) {
          return {
            success: false,
            error: error.message,
          };
        }

        return {
          success: true,
          data,
        };
      }

      // Otherwise use increment_api_usage for simple counting
      const { data, error } = await this.supabase.rpc("increment_api_usage", {
        p_service: params.service,
        p_date: date,
        p_increment: increment,
      });

      if (error) {
        return {
          success: false,
          error: error.message,
        };
      }

      return {
        success: true,
        data,
      };
    } catch (error) {
      return {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      };
    }
  }

  /**
   * Track API usage with automatic fallback to direct table update
   * Provides backward compatibility during migration
   */
  async trackUsageWithFallback(params) {
    // First try RPC function
    const rpcResult = await this.trackUsage(params);

    if (rpcResult.success) {
      return rpcResult;
    }

    // If RPC fails (function not found, permissions, etc), fallback to direct update
    console.warn(
      `[ApiUsageTracker] RPC failed for service '${params.service}', falling back to direct update: ${rpcResult.error}`
    );

    const date = params.date || new Date().toISOString().split("T")[0];
    const increment = params.increment ?? 1;

    try {
      // Check if record exists
      const { data: existing, error: selectError } = await this.supabase
        .from("api_usage")
        .select("*")
        .eq("service", params.service)
        .eq("date", date)
        .single();

      if (selectError && selectError.code !== "PGRST116") {
        // PGRST116 means no rows found, which is expected
        throw selectError;
      }

      if (existing) {
        // Update existing record
        const updateData = {
          count: existing.count + increment,
        };

        if (params.zone1_usage !== undefined)
          updateData.zone1_usage = params.zone1_usage;
        if (params.zone2_usage !== undefined)
          updateData.zone2_usage = params.zone2_usage;
        if (params.zone1_limit !== undefined)
          updateData.zone1_limit = params.zone1_limit;
        if (params.zone2_limit !== undefined)
          updateData.zone2_limit = params.zone2_limit;
        if (params.reset_after !== undefined)
          updateData.reset_after = params.reset_after;

        const { data, error } = await this.supabase
          .from("api_usage")
          .update(updateData)
          .eq("id", existing.id)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          data,
        };
      } else {
        // Insert new record
        const insertData = {
          service: params.service,
          date,
          count: increment,
          zone1_usage: params.zone1_usage ?? 0,
          zone2_usage: params.zone2_usage ?? 0,
          zone1_limit: params.zone1_limit ?? 5000,
          zone2_limit: params.zone2_limit ?? 100,
          reset_after: params.reset_after ?? 0,
        };

        const { data, error } = await this.supabase
          .from("api_usage")
          .insert(insertData)
          .select()
          .single();

        if (error) throw error;

        return {
          success: true,
          data,
        };
      }
    } catch (error) {
      return {
        success: false,
        error: `Failed to track API usage: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}

module.exports = ApiUsageTracker;
