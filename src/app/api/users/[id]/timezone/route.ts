/**
 * User Timezone API Routes for RR-175
 * Secure server-side implementation for timezone caching
 */

import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

// Server-side Supabase client with service role
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// In-memory cache for timezone data
const cache = new Map<string, { value: string; expiry: number }>();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const DEFAULT_TIMEZONE = "America/Toronto";

/**
 * GET /api/users/[id]/timezone
 * Get timezone for a user with caching
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = params.id;
  const cacheKey = `timezone:${userId}`;

  try {
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && cached.expiry > Date.now()) {
      return NextResponse.json({
        timezone: cached.value,
        cached: true,
      });
    }

    // Query database for user preferences
    const { data: user, error } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    if (error || !user) {
      console.error("Error fetching user for timezone:", error);
      return NextResponse.json({
        timezone: DEFAULT_TIMEZONE,
        cached: false,
      });
    }

    // Extract timezone from preferences or use default
    const timezone = user.preferences?.timezone || DEFAULT_TIMEZONE;

    // Store in cache
    cache.set(cacheKey, {
      value: timezone,
      expiry: Date.now() + CACHE_TTL,
    });

    return NextResponse.json({
      timezone,
      cached: false,
    });
  } catch (error) {
    console.error("Error in timezone GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/users/[id]/timezone
 * Set timezone for a user (updates cache and database)
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const userId = params.id;
  const cacheKey = `timezone:${userId}`;

  try {
    const { timezone } = await request.json();

    if (!timezone || typeof timezone !== "string") {
      return NextResponse.json(
        { error: "Invalid timezone provided" },
        { status: 400 }
      );
    }

    // Update cache immediately
    cache.set(cacheKey, {
      value: timezone,
      expiry: Date.now() + CACHE_TTL,
    });

    // Get existing preferences first to preserve other fields
    const { data: existingUser, error: fetchError } = await supabase
      .from("users")
      .select("preferences")
      .eq("id", userId)
      .single();

    if (fetchError) {
      console.error("Error fetching existing preferences:", fetchError);
      return NextResponse.json(
        { error: "Failed to fetch user preferences" },
        { status: 500 }
      );
    }

    // Merge timezone with existing preferences
    const updatedPreferences = {
      ...(existingUser?.preferences || {}),
      timezone: timezone,
    };

    // Update database with merged preferences
    const { error } = await supabase
      .from("users")
      .update({
        preferences: updatedPreferences,
      })
      .eq("id", userId);

    if (error) {
      console.error("Error updating user timezone:", error);
      return NextResponse.json(
        { error: "Failed to update timezone" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      timezone,
    });
  } catch (error) {
    console.error("Error in timezone PUT:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
