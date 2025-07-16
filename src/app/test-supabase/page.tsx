'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/db/supabase'
import { SupabaseOperations } from '@/lib/db/basic-operations'

export default function TestSupabasePage() {
  const [connectionStatus, setConnectionStatus] = useState<'testing' | 'connected' | 'failed'>('testing')
  const [testResults, setTestResults] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  const addResult = (message: string) => {
    setTestResults(prev => [...prev, message])
  }

  const testSupabaseConnection = async () => {
    try {
      addResult('🔍 Testing Supabase connection...')
      
      // Test basic connection
      const isConnected = await SupabaseOperations.testConnection()
      if (!isConnected) {
        throw new Error('Basic connection test failed')
      }
      addResult('✅ Basic connection successful')
      
      // Test user creation
      const testUser = await SupabaseOperations.createUser({
        email: `test-${Date.now()}@example.com`,
        inoreader_id: `test_${Date.now()}`
      })
      addResult(`✅ User created: ${testUser.email}`)
      
      // Test user retrieval
      const retrievedUser = await SupabaseOperations.getUserByInoreaderID(testUser.inoreader_id!)
      addResult(`✅ User retrieved: ${retrievedUser.email}`)
      
      // Test feed creation
      const testFeed = await SupabaseOperations.createFeed({
        user_id: testUser.id,
        inoreader_id: `feed_${Date.now()}`,
        title: 'Test Feed',
        url: 'https://example.com/rss',
        unread_count: 5
      })
      addResult(`✅ Feed created: ${testFeed.title}`)
      
      // Test article creation
      const testArticle = await SupabaseOperations.createArticle({
        feed_id: testFeed.id,
        inoreader_id: `article_${Date.now()}`,
        title: 'Test Article',
        content: 'This is a test article content',
        url: 'https://example.com/article',
        published_at: new Date().toISOString(),
        is_read: false,
        is_starred: false
      })
      addResult(`✅ Article created: ${testArticle.title}`)
      
      // Test read status update
      const updatedArticle = await SupabaseOperations.updateArticleReadStatus(testArticle.id, true)
      addResult(`✅ Article marked as read: ${updatedArticle.is_read}`)
      
      // Test folder creation
      const testFolder = await SupabaseOperations.createFolder({
        user_id: testUser.id,
        inoreader_id: `folder_${Date.now()}`,
        name: 'Test Folder'
      })
      addResult(`✅ Folder created: ${testFolder.name}`)
      
      // Clean up test data
      await supabase.from('articles').delete().eq('id', testArticle.id)
      await supabase.from('feeds').delete().eq('id', testFeed.id)
      await supabase.from('folders').delete().eq('id', testFolder.id)
      await supabase.from('users').delete().eq('id', testUser.id)
      addResult('🧹 Test data cleaned up')
      
      addResult('🎉 All Supabase tests passed!')
      setConnectionStatus('connected')
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      addResult(`❌ Test failed: ${errorMessage}`)
      setConnectionStatus('failed')
    }
  }

  useEffect(() => {
    testSupabaseConnection()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-white rounded-lg shadow-md p-6">
          <h1 className="text-2xl font-bold text-gray-900 mb-6">
            Supabase Integration Test
          </h1>
          
          {/* Connection Status */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <span className="font-semibold">Connection Status:</span>
              <span className={`px-2 py-1 rounded text-sm ${
                connectionStatus === 'testing' ? 'bg-yellow-100 text-yellow-800' :
                connectionStatus === 'connected' ? 'bg-green-100 text-green-800' :
                'bg-red-100 text-red-800'
              }`}>
                {connectionStatus === 'testing' ? 'Testing...' :
                 connectionStatus === 'connected' ? 'Connected' :
                 'Failed'}
              </span>
            </div>
            
            {error && (
              <div className="bg-red-50 border border-red-200 rounded p-3">
                <p className="text-red-800 text-sm font-medium">Error:</p>
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}
          </div>

          {/* Test Results */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Test Results</h2>
            <div className="bg-gray-50 rounded-lg p-4 max-h-96 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-gray-500 text-sm">Running tests...</p>
              ) : (
                <ul className="space-y-1">
                  {testResults.map((result, index) => (
                    <li key={index} className="text-sm font-mono">
                      {result}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          {/* Database Schema Info */}
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Database Schema</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-blue-50 rounded-lg p-4">
                <h3 className="font-semibold text-blue-900 mb-2">Tables Created</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>✅ users - User authentication and profiles</li>
                  <li>✅ feeds - RSS feed subscriptions</li>
                  <li>✅ articles - Article content and metadata</li>
                  <li>✅ folders - Feed organization</li>
                </ul>
              </div>
              
              <div className="bg-green-50 rounded-lg p-4">
                <h3 className="font-semibold text-green-900 mb-2">Features Tested</h3>
                <ul className="text-sm text-green-800 space-y-1">
                  <li>✅ Database connection</li>
                  <li>✅ User CRUD operations</li>
                  <li>✅ Feed management</li>
                  <li>✅ Article operations</li>
                  <li>✅ Folder organization</li>
                  <li>✅ Read state management</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Environment Info */}
          <div className="text-sm text-gray-600 border-t pt-4">
            <p><strong>Supabase URL:</strong> {process.env.NEXT_PUBLIC_SUPABASE_URL}</p>
            <p><strong>Environment:</strong> {process.env.NODE_ENV}</p>
            <p><strong>Test Page:</strong> /test-supabase</p>
          </div>
        </div>
      </div>
    </div>
  )
}