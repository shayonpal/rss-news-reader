import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './types';

let adminClient: SupabaseClient<Database> | null = null;

/**
 * Get or create a singleton Supabase admin client for server-side operations.
 * This uses the service role key and bypasses Row Level Security.
 * 
 * Benefits:
 * - Connection pooling: Reuses the same client instance
 * - Better performance: Avoids creating new connections per request
 * - Resource efficiency: Reduces connection overhead
 */
export function getAdminClient(): SupabaseClient<Database> {
  if (!adminClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error('Missing Supabase environment variables');
    }

    console.log('[Supabase Admin] Creating singleton admin client...');
    const startTime = performance.now();

    adminClient = createClient<Database>(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
      },
      db: {
        schema: 'public'
      },
      global: {
        headers: {
          'x-connection-source': 'admin-singleton'
        }
      }
    });

    const duration = performance.now() - startTime;
    console.log(`[Supabase Admin] Admin client created in ${duration.toFixed(2)}ms`);
  }

  return adminClient;
}

/**
 * Reset the admin client (useful for testing or when configuration changes)
 */
export function resetAdminClient(): void {
  adminClient = null;
  console.log('[Supabase Admin] Admin client reset');
}