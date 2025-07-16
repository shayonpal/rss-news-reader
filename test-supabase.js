// Quick test script for Supabase connection
const { createClient } = require('@supabase/supabase-js')

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseAnonKey)

async function testSupabaseConnection() {
  console.log('🔍 Testing Supabase connection...')
  
  try {
    // Test basic connection
    const { data, error } = await supabase
      .from('users')
      .select('*')
      .limit(1)
    
    if (error) {
      console.error('❌ Connection failed:', error.message)
      return false
    }
    
    console.log('✅ Connection successful!')
    console.log('📊 Current users count:', data.length)
    
    // Test insert
    const testUser = {
      email: `test-${Date.now()}@example.com`,
      inoreader_id: `test_${Date.now()}`
    }
    
    const { data: insertData, error: insertError } = await supabase
      .from('users')
      .insert(testUser)
      .select()
      .single()
    
    if (insertError) {
      console.error('❌ Insert failed:', insertError.message)
      return false
    }
    
    console.log('✅ Insert successful!')
    console.log('👤 Created user:', insertData)
    
    // Clean up test data
    await supabase
      .from('users')
      .delete()
      .eq('id', insertData.id)
    
    console.log('🧹 Test data cleaned up')
    console.log('🎉 All tests passed!')
    
    return true
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message)
    return false
  }
}

// Run the test
testSupabaseConnection().then((success) => {
  process.exit(success ? 0 : 1)
})