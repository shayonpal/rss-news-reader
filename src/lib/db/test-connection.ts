import { supabase, checkSupabaseConnection } from "./supabase";

export async function testSupabaseConnection() {
  console.log("Testing Supabase connection...");

  try {
    // Test basic connection
    const isConnected = await checkSupabaseConnection();
    console.log("Connection status:", isConnected ? "SUCCESS" : "FAILED");

    // Test auth session
    const {
      data: { session },
      error: authError,
    } = await supabase.auth.getSession();
    console.log("Auth session:", session ? "EXISTS" : "NONE");
    if (authError) {
      console.log("Auth error:", authError.message);
    }

    // Test database access
    const { data, error } = await supabase.from("users").select("*").limit(1);

    if (error) {
      console.log("Database error:", error.message);
      console.log("Error details:", error);
    } else {
      console.log("Database query success:", data);
    }
  } catch (error) {
    console.error("Connection test failed:", error);
  }
}

// Run test if called directly
if (require.main === module) {
  testSupabaseConnection();
}
