'use client';

import { useState } from 'react';
import { supabase } from '@/lib/db/supabase';

export default function TestServerAPIPage() {
  const [syncResult, setSyncResult] = useState<any>(null);
  const [syncStatus, setSyncStatus] = useState<any>(null);
  const [contentResult, setContentResult] = useState<any>(null);
  const [summaryResult, setSummaryResult] = useState<any>(null);
  const [selectedArticle, setSelectedArticle] = useState<any>(null);
  const [loading, setLoading] = useState<string | null>(null);

  // Test sync endpoint
  const testSync = async () => {
    setLoading('sync');
    try {
      const response = await fetch('/reader/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setSyncResult({ status: response.status, data });
      
      // If successful, poll status
      if (data.syncId) {
        pollSyncStatus(data.syncId);
      }
    } catch (error) {
      setSyncResult({ error: error instanceof Error ? error.message : 'Failed' });
    } finally {
      setLoading(null);
    }
  };

  // Poll sync status
  const pollSyncStatus = async (syncId: string) => {
    const interval = setInterval(async () => {
      try {
        const response = await fetch(`/reader/api/sync/status/${syncId}`);
        const data = await response.json();
        setSyncStatus(data);
        
        if (data.status === 'completed' || data.status === 'failed') {
          clearInterval(interval);
        }
      } catch (error) {
        clearInterval(interval);
        setSyncStatus({ error: 'Failed to check status' });
      }
    }, 1000);
  };

  // Load a random article for testing
  const loadRandomArticle = async () => {
    setLoading('article');
    try {
      const { data, error } = await supabase
        .from('articles')
        .select('id, title, url, content, ai_summary')
        .limit(10);
      
      if (error) throw error;
      if (data && data.length > 0) {
        const randomArticle = data[Math.floor(Math.random() * data.length)];
        setSelectedArticle(randomArticle);
      }
    } catch (error) {
      console.error('Failed to load article:', error);
    } finally {
      setLoading(null);
    }
  };

  // Test content extraction
  const testContentExtraction = async () => {
    if (!selectedArticle) return;
    
    setLoading('content');
    try {
      const response = await fetch(`/reader/api/articles/${selectedArticle.id}/fetch-content`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await response.json();
      setContentResult({ status: response.status, data });
    } catch (error) {
      setContentResult({ error: error instanceof Error ? error.message : 'Failed' });
    } finally {
      setLoading(null);
    }
  };

  // Test AI summarization
  const testSummarization = async () => {
    if (!selectedArticle) return;
    
    setLoading('summary');
    try {
      const response = await fetch(`/reader/api/articles/${selectedArticle.id}/summarize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate: true })
      });
      const data = await response.json();
      setSummaryResult({ status: response.status, data });
    } catch (error) {
      setSummaryResult({ error: error instanceof Error ? error.message : 'Failed' });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="container mx-auto p-8 space-y-6">
      <h1 className="text-3xl font-bold">Server API Test Page</h1>
      <p className="text-gray-600">Test the US-103 server API endpoints</p>

      {/* Sync Test */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Manual Sync</h2>
        <p className="text-gray-600 mb-4">POST /api/sync - Trigger server-side sync</p>
        <div className="space-y-4">
          <button 
            onClick={testSync} 
            disabled={loading === 'sync'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === 'sync' ? 'Syncing...' : 'Start Sync'}
          </button>
          
          {syncResult && (
            <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
              {JSON.stringify(syncResult, null, 2)}
            </pre>
          )}
          
          {syncStatus && (
            <div>
              <h4 className="font-semibold">Sync Status:</h4>
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs">
                {JSON.stringify(syncStatus, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>

      {/* Article Selection */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">Select Test Article</h2>
        <p className="text-gray-600 mb-4">Load a random article for testing content extraction and summarization</p>
        <div className="space-y-4">
          <button 
            onClick={loadRandomArticle}
            disabled={loading === 'article'}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {loading === 'article' ? 'Loading...' : 'Load Random Article'}
          </button>
          
          {selectedArticle && (
            <div className="bg-gray-100 p-4 rounded space-y-2">
              <p><strong>Title:</strong> {selectedArticle.title}</p>
              <p><strong>ID:</strong> {selectedArticle.id}</p>
              <p><strong>URL:</strong> {selectedArticle.url || 'No URL'}</p>
              <p><strong>Has Summary:</strong> {selectedArticle.ai_summary ? 'Yes' : 'No'}</p>
            </div>
          )}
        </div>
      </div>

      {/* Content Extraction Test */}
      {selectedArticle && (
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">Content Extraction</h2>
          <p className="text-gray-600 mb-4">POST /api/articles/{'{id}'}/fetch-content - Extract full article content</p>
          <div className="space-y-4">
            <button 
              onClick={testContentExtraction}
              disabled={loading === 'content' || !selectedArticle.url}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading === 'content' ? 'Extracting...' : 'Extract Content'}
            </button>
            
            {contentResult && (
              <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs max-h-64">
                {JSON.stringify(contentResult, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}

      {/* AI Summarization Test */}
      {selectedArticle && (
        <div className="border rounded-lg p-6">
          <h2 className="text-xl font-semibold mb-2">AI Summarization</h2>
          <p className="text-gray-600 mb-4">POST /api/articles/{'{id}'}/summarize - Generate AI summary</p>
          <div className="space-y-4">
            <button 
              onClick={testSummarization}
              disabled={loading === 'summary'}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
            >
              {loading === 'summary' ? 'Generating...' : 'Generate Summary'}
            </button>
            
            {summaryResult && (
              <div className="space-y-4">
                <pre className="bg-gray-100 p-4 rounded overflow-auto text-xs max-h-64">
                  {JSON.stringify(summaryResult, null, 2)}
                </pre>
                {summaryResult.data?.summary && (
                  <div className="bg-blue-50 p-4 rounded">
                    <h4 className="font-semibold mb-2">Generated Summary:</h4>
                    <p className="text-sm">{summaryResult.data.summary}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* API Documentation */}
      <div className="border rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-2">API Documentation</h2>
        <p className="text-gray-600 mb-4">US-103 Implementation Details</p>
        <div className="space-y-4 text-sm">
          <div>
            <h4 className="font-semibold">✅ Completed Endpoints:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>POST /api/sync - Trigger manual sync (with rate limiting)</li>
              <li>GET /api/sync/status/:id - Check sync progress</li>
              <li>POST /api/articles/:id/fetch-content - Extract full content using Mozilla Readability</li>
              <li>POST /api/articles/:id/summarize - Generate AI summary using Claude 3.5 Sonnet</li>
            </ul>
          </div>
          
          <div>
            <h4 className="font-semibold">✅ Features Implemented:</h4>
            <ul className="list-disc list-inside space-y-1 text-gray-600">
              <li>Rate limiting (100 calls/day for Inoreader API)</li>
              <li>Proper error codes (429 for rate limit, 404 for not found, 500 for server errors)</li>
              <li>Consistent JSON response format</li>
              <li>API usage tracking in api_usage table</li>
              <li>Content caching to avoid repeated extractions</li>
              <li>Summary caching with regeneration option</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}