import { NextResponse } from 'next/server'
import { SupabaseOperations } from '@/lib/db/basic-operations'
import { supabase } from '@/lib/db/supabase'

export async function GET() {
  try {
    const results = []
    
    // Test basic connection
    results.push('🔍 Testing server-side Supabase connection...')
    const isConnected = await SupabaseOperations.testConnection()
    
    if (!isConnected) {
      throw new Error('Server-side connection failed')
    }
    
    results.push('✅ Server-side connection successful')
    
    // Test user operations
    const testUser = await SupabaseOperations.createUser({
      email: `server-test-${Date.now()}@example.com`,
      inoreader_id: `server_test_${Date.now()}`
    })
    results.push(`✅ Server-side user created: ${testUser.email}`)
    
    // Test feed operations
    const testFeed = await SupabaseOperations.createFeed({
      user_id: testUser.id,
      inoreader_id: `server_feed_${Date.now()}`,
      title: 'Server Test Feed',
      url: 'https://example.com/server-rss',
      unread_count: 10
    })
    results.push(`✅ Server-side feed created: ${testFeed.title}`)
    
    // Clean up
    await supabase.from('feeds').delete().eq('id', testFeed.id)
    await supabase.from('users').delete().eq('id', testUser.id)
    results.push('🧹 Server-side test data cleaned up')
    
    results.push('🎉 All server-side tests passed!')
    
    return NextResponse.json({
      success: true,
      results,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL
    })
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    
    return NextResponse.json({
      success: false,
      error: errorMessage,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    }, { status: 500 })
  }
}

export async function POST() {
  return NextResponse.json({
    message: 'Use GET method to run Supabase tests'
  }, { status: 405 })
}