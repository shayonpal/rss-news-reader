/**
 * Utility to get the current user ID
 *
 * For MVP single-user system, returns the first user ID from database
 * In the future, this will integrate with proper authentication
 */

// Check if we're in a test environment
const isTestEnvironment =
  process.env.NODE_ENV === "test" || process.env.VITEST === "true";

// Conditionally import Supabase only if not in test environment
const createServerClient = isTestEnvironment
  ? () => null
  : require("@/lib/db/supabase").createServerClient;

let cachedUserId: string | null = null;

export async function getCurrentUserId(): Promise<string> {
  // In test environment, return a test user ID
  if (isTestEnvironment) {
    return "test-user-id";
  }

  // Return cached value if available
  if (cachedUserId) {
    return cachedUserId;
  }

  // Check if we're in the browser (client-side)
  if (typeof window !== "undefined") {
    // For MVP single-user system, use the known user ID
    // In production, this would come from authentication
    cachedUserId = "7ecd1c0b-7a04-487d-9d3c-7575f34ae27f"; // shayon@local user
    return cachedUserId;
  }

  try {
    const supabase = createServerClient();

    // For MVP, get the first user (single-user system)
    const { data, error } = await supabase
      .from("users")
      .select("id")
      .limit(1)
      .single();

    if (error || !data) {
      // If no user exists, create a default one
      const { data: newUser, error: createError } = await supabase
        .from("users")
        .insert({
          inoreader_id: "default_user",
          email: "user@example.com",
          name: "Default User",
        })
        .select("id")
        .single();

      if (createError || !newUser) {
        throw new Error("Failed to get or create default user");
      }

      cachedUserId = newUser.id;
      return newUser.id;
    }

    cachedUserId = data.id;
    return data.id;
  } catch (error) {
    console.error("Failed to get current user ID:", error);
    // Fallback to a default ID for development
    return "7ecd1c0b-7a04-487d-9d3c-7575f34ae27f"; // Use known user ID
  }
}

/**
 * Clear the cached user ID (useful for testing)
 */
export function clearUserIdCache() {
  cachedUserId = null;
}
