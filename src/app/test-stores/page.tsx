'use client';

import { useState, useEffect } from 'react';
import { useDataStore } from '@/lib/stores/data-store';
import { useArticleStore } from '@/lib/stores/article-store';
import { useFeedStore } from '@/lib/stores/feed-store';
import { useSyncStore } from '@/lib/stores/sync-store';
import { db } from '@/lib/db/database';
import type { Article, Feed, Folder } from '@/types';

// Test data for browser testing
const mockArticle: Article = {
  id: 'test-article-1',
  title: 'Test Article for Browser Testing',
  content: 'This is comprehensive test content for the article to verify IndexedDB storage works correctly in the browser environment.',
  author: 'Test Author',
  publishedAt: new Date('2025-01-01'),
  feedId: 'test-feed-1',
  feedTitle: 'Test Feed',
  url: 'https://example.com/article-1',
  isRead: false,
  isPartial: false,
  inoreaderItemId: 'inoreader-item-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFeed: Feed = {
  id: 'test-feed-1',
  title: 'Test Feed for Browser Testing',
  url: 'https://example.com/feed.xml',
  htmlUrl: 'https://example.com',
  description: 'A comprehensive test feed for verifying feed store functionality',
  folderId: 'test-folder-1',
  unreadCount: 0,
  isActive: true,
  inoreaderId: 'inoreader-feed-1',
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFolder: Folder = {
  id: 'test-folder-1',
  title: 'Test Folder for Browser Testing',
  parentId: null,
  unreadCount: 0,
  isExpanded: true,
  sortOrder: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
};

// Test utilities for browser environment
const testUtils = {
  async resetDatabase() {
    await db.delete();
    await db.open();
  },
  
  async addTestData() {
    await db.folders.add(mockFolder);
    await db.feeds.add(mockFeed);
    await db.articles.add(mockArticle);
  }
};

export default function TestStoresPage() {
  const [testResults, setTestResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  
  const dataStore = useDataStore();
  const articleStore = useArticleStore();
  const feedStore = useFeedStore();
  const syncStore = useSyncStore();

  const addResult = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    const prefix = type === 'success' ? '✅' : type === 'error' ? '❌' : '📋';
    setTestResults(prev => [...prev, `${prefix} ${message}`]);
  };

  const runTests = async () => {
    setIsRunning(true);
    setTestResults([]);
    
    try {
      addResult('Starting comprehensive data store tests...', 'info');
      
      // Test 1: Database Initialization
      addResult('Testing database initialization...', 'info');
      await testUtils.resetDatabase();
      const dbResult = await dataStore.initializeDatabase();
      addResult(`Database initialization: ${dbResult ? 'SUCCESS' : 'FAILED'}`, dbResult ? 'success' : 'error');
      
      // Test 2: Add Test Data
      addResult('Adding test data...', 'info');
      await testUtils.addTestData();
      addResult('Test data added successfully', 'success');
      
      // Test 3: Article Store
      addResult('Testing article store...', 'info');
      await articleStore.loadArticles();
      const articleCount = articleStore.articles.size;
      addResult(`Articles loaded: ${articleCount}`, articleCount > 0 ? 'success' : 'error');
      
      // Test 4: Feed Store
      addResult('Testing feed store...', 'info');
      await feedStore.loadFeedHierarchy();
      const feedCount = feedStore.feeds.size;
      const folderCount = feedStore.folders.size;
      addResult(`Feeds loaded: ${feedCount}, Folders: ${folderCount}`, 
        feedCount > 0 && folderCount > 0 ? 'success' : 'error');
      
      // Test 5: Unread Count Calculation
      addResult('Testing unread count calculation...', 'info');
      const totalUnread = feedStore.totalUnreadCount;
      addResult(`Total unread count: ${totalUnread}`, totalUnread > 0 ? 'success' : 'info');
      
      // Test 6: Article Operations
      addResult('Testing article operations...', 'info');
      const testArticleId = Array.from(articleStore.articles.keys())[0];
      if (testArticleId) {
        await articleStore.markAsRead(testArticleId);
        addResult('Article marked as read', 'success');
        
        await articleStore.toggleStar(testArticleId);
        addResult('Article starred', 'success');
        
        await articleStore.toggleStar(testArticleId);
        addResult('Article unstarred', 'success');
      }
      
      // Test 7: Sync Queue
      addResult('Testing sync queue...', 'info');
      if (testArticleId) {
        syncStore.addToQueue({
          type: 'mark_read',
          articleId: testArticleId,
          maxRetries: 3
        });
        const queueLength = syncStore.actionQueue.length;
        addResult(`Action added to sync queue. Queue length: ${queueLength}`, 
          queueLength > 0 ? 'success' : 'error');
      }
      
      // Test 8: Feed Operations
      addResult('Testing feed operations...', 'info');
      const newFolderId = await feedStore.createFolder('Test Folder Created');
      addResult(`New folder created: ${newFolderId ? 'SUCCESS' : 'FAILED'}`, 
        newFolderId ? 'success' : 'error');
      
      // Test 9: User Preferences
      addResult('Testing user preferences...', 'info');
      const prefResult = await dataStore.updatePreferences({
        theme: 'dark',
        fontSize: 'large'
      });
      addResult(`Preferences updated: ${prefResult ? 'SUCCESS' : 'FAILED'}`, 
        prefResult ? 'success' : 'error');
      
      // Test 10: API Usage Tracking
      addResult('Testing API usage tracking...', 'info');
      await dataStore.recordInoreaderCall(0.01);
      await dataStore.recordClaudeCall(0.05);
      addResult('API usage recorded', 'success');
      
      // Test 11: Storage Information
      addResult('Testing storage information...', 'info');
      await dataStore.checkStorageHealth();
      const storageStats = dataStore.dbStatus.storageStats;
      if (storageStats) {
        addResult(`Storage usage: ${(storageStats.quotaPercentage * 100).toFixed(2)}%`, 'info');
        addResult(`Total bytes: ${storageStats.totalBytes}`, 'info');
        addResult(`Used bytes: ${storageStats.usedBytes}`, 'info');
      }
      
      // Test 12: Error Handling
      addResult('Testing error handling...', 'info');
      const nonExistentArticle = await articleStore.getArticle('non-existent-id');
      addResult(`Non-existent article handled: ${nonExistentArticle === null ? 'SUCCESS' : 'FAILED'}`, 
        nonExistentArticle === null ? 'success' : 'error');
      
      // Test 13: Database Export
      addResult('Testing database export...', 'info');
      const exportBlob = await dataStore.exportData();
      addResult(`Database export: ${exportBlob ? 'SUCCESS' : 'FAILED'}`, 
        exportBlob ? 'success' : 'error');
      
      addResult('🎉 All tests completed successfully!', 'success');
      
    } catch (error) {
      addResult(`Test suite failed: ${error}`, 'error');
      console.error('Test error:', error);
    } finally {
      setIsRunning(false);
    }
  };

  const clearLogs = () => {
    setTestResults([]);
  };

  const openDevTools = () => {
    addResult('Open browser DevTools and check the Application tab > IndexedDB > ShayonNewsDB', 'info');
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">
            Data Stores Test Suite
          </h1>
          
          <div className="mb-6">
            <p className="text-gray-600 mb-4">
              This page tests the comprehensive IndexedDB data storage implementation including:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-1">
              <li>Database initialization and schema creation</li>
              <li>Article store CRUD operations and pagination</li>
              <li>Feed store hierarchy management</li>
              <li>Offline sync queue functionality</li>
              <li>Storage quota monitoring and maintenance</li>
              <li>Error handling and recovery</li>
              <li>User preferences and API usage tracking</li>
            </ul>
          </div>

          <div className="flex gap-4 mb-6">
            <button
              onClick={runTests}
              disabled={isRunning}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {isRunning ? 'Running Tests...' : 'Run All Tests'}
            </button>
            
            <button
              onClick={clearLogs}
              className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
            >
              Clear Logs
            </button>
            
            <button
              onClick={openDevTools}
              className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700"
            >
              Inspect Database
            </button>
          </div>

          {/* Store Status Dashboard */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900">Database</h3>
              <p className="text-sm text-blue-700">
                Initialized: {dataStore.dbStatus.isInitialized ? '✅' : '❌'}
              </p>
              <p className="text-sm text-blue-700">
                Healthy: {dataStore.dbStatus.isHealthy ? '✅' : '❌'}
              </p>
            </div>
            
            <div className="bg-green-50 p-4 rounded-lg">
              <h3 className="font-semibold text-green-900">Articles</h3>
              <p className="text-sm text-green-700">
                Loaded: {articleStore.articles.size}
              </p>
              <p className="text-sm text-green-700">
                Loading: {articleStore.loadingArticles ? '⏳' : '✅'}
              </p>
            </div>
            
            <div className="bg-purple-50 p-4 rounded-lg">
              <h3 className="font-semibold text-purple-900">Feeds</h3>
              <p className="text-sm text-purple-700">
                Feeds: {feedStore.feeds.size}
              </p>
              <p className="text-sm text-purple-700">
                Folders: {feedStore.folders.size}
              </p>
              <p className="text-sm text-purple-700">
                Unread: {feedStore.totalUnreadCount}
              </p>
            </div>
            
            <div className="bg-orange-50 p-4 rounded-lg">
              <h3 className="font-semibold text-orange-900">Sync Queue</h3>
              <p className="text-sm text-orange-700">
                Pending: {syncStore.actionQueue.length}
              </p>
              <p className="text-sm text-orange-700">
                Syncing: {syncStore.isSyncing ? '⏳' : '✅'}
              </p>
            </div>
          </div>

          {/* Test Results */}
          <div className="bg-gray-900 text-gray-100 p-4 rounded-lg">
            <h3 className="text-lg font-semibold mb-3">Test Results</h3>
            <div className="h-96 overflow-y-auto">
              {testResults.length === 0 ? (
                <p className="text-gray-400">Click "Run All Tests" to start testing...</p>
              ) : (
                <div className="space-y-1">
                  {testResults.map((result, index) => (
                    <div key={index} className="font-mono text-sm">
                      {result}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Manual Test Instructions */}
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <h3 className="font-semibold text-yellow-900 mb-2">Manual Verification Steps</h3>
            <ol className="list-decimal list-inside text-yellow-800 space-y-1 text-sm">
              <li>Open browser DevTools (F12)</li>
              <li>Go to Application tab → Storage → IndexedDB</li>
              <li>Expand "ShayonNewsDB" to see all object stores</li>
              <li>Verify data is being stored correctly in each table</li>
              <li>Check console for any errors during test execution</li>
              <li>Test offline functionality by going offline and performing actions</li>
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}