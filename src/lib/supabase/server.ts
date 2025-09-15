import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export function createClient(url?: string, key?: string) {
  // In test environment, allow simplified mocking
  if (process.env.NODE_ENV === "test") {
    const supabaseUrl =
      url || process.env.NEXT_PUBLIC_SUPABASE_URL || "http://test.supabase.co";
    const supabaseKey =
      key || process.env.SUPABASE_SERVICE_ROLE_KEY || "test-key";
    return createSupabaseClient(supabaseUrl, supabaseKey);
  }

  const supabaseUrl = url || process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = key || process.env.SUPABASE_SERVICE_ROLE_KEY!;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Missing Supabase environment variables");
  }

  return createSupabaseClient(supabaseUrl, supabaseKey);
}
