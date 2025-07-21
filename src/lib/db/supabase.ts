import { createClient } from '@supabase/supabase-js'
import { Database } from './types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

console.log('[Supabase] Initializing client...');
const initStartTime = performance.now();

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  }
})

console.log(`[Supabase] Client initialized in ${(performance.now() - initStartTime).toFixed(2)}ms`);

// Helper function to check if Supabase is connected
export async function checkSupabaseConnection(): Promise<boolean> {
  try {
    const { data, error } = await supabase.from('users').select('id').limit(1)
    if (error) {
      console.error('Supabase connection error:', error)
      return false
    }
    return true
  } catch (error) {
    console.error('Supabase connection failed:', error)
    return false
  }
}

// Helper function to get current user ID
export async function getCurrentUserId(): Promise<string | null> {
  try {
    const { data: { user } } = await supabase.auth.getUser()
    return user?.id || null
  } catch (error) {
    console.error('Error getting current user:', error)
    return null
  }
}

// Helper function to sign in with custom user ID (for Inoreader integration)
export async function signInWithCustomUser(inoreaderUserId: string, email: string): Promise<void> {
  try {
    // Check if user exists
    const { data: existingUser } = await supabase
      .from('users')
      .select('id')
      .eq('inoreader_id', inoreaderUserId)
      .single()

    if (!existingUser) {
      // Create new user
      const { error } = await supabase
        .from('users')
        .insert({
          email,
          inoreader_id: inoreaderUserId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })

      if (error) {
        throw error
      }
    }
  } catch (error) {
    console.error('Error signing in with custom user:', error)
    throw error
  }
}

export default supabase