'use client';

import { useState } from 'react';
import { useFeedStore } from '@/lib/stores/feed-store';
import { Button } from '@/components/ui/button';
import { supabase } from '@/lib/db/supabase';

export default function TestPerformancePage() {
  const [results, setResults] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const { loadFeedHierarchy } = useFeedStore();

  const runPerformanceTest = async () => {
    setIsRunning(true);
    const newResults: string[] = [];
    
    // Test 1: Supabase Connection
    newResults.push('=== Supabase Connection Test ===');
    const connectionStart = performance.now();
    try {
      const { data, error } = await supabase.from('users').select('id').limit(1);
      const connectionTime = performance.now() - connectionStart;
      if (error) {
        newResults.push(`❌ Connection failed: ${error.message}`);
      } else {
        newResults.push(`✅ Connection successful in ${connectionTime.toFixed(2)}ms`);
      }
    } catch (error) {
      const connectionTime = performance.now() - connectionStart;
      newResults.push(`❌ Connection error in ${connectionTime.toFixed(2)}ms: ${error}`);
    }
    
    // Test 2: Simple Query
    newResults.push('\n=== Simple Query Test ===');
    const queryStart = performance.now();
    try {
      const { data, error } = await supabase
        .from('feeds')
        .select('id, title')
        .limit(5);
      const queryTime = performance.now() - queryStart;
      if (error) {
        newResults.push(`❌ Query failed: ${error.message}`);
      } else {
        newResults.push(`✅ Query returned ${data?.length || 0} feeds in ${queryTime.toFixed(2)}ms`);
      }
    } catch (error) {
      const queryTime = performance.now() - queryStart;
      newResults.push(`❌ Query error in ${queryTime.toFixed(2)}ms: ${error}`);
    }
    
    // Test 3: Count Query (what's used in unread counts)
    newResults.push('\n=== Count Query Test ===');
    const countStart = performance.now();
    try {
      const { count, error } = await supabase
        .from('articles')
        .select('*', { count: 'exact', head: true })
        .eq('is_read', false)
        .limit(1);
      const countTime = performance.now() - countStart;
      if (error) {
        newResults.push(`❌ Count query failed: ${error.message}`);
      } else {
        newResults.push(`✅ Count query returned ${count} unread articles in ${countTime.toFixed(2)}ms`);
      }
    } catch (error) {
      const countTime = performance.now() - countStart;
      newResults.push(`❌ Count error in ${countTime.toFixed(2)}ms: ${error}`);
    }
    
    // Test 4: Full Feed Load
    newResults.push('\n=== Full Feed Load Test ===');
    newResults.push('Check browser console for detailed timing logs...');
    const loadStart = performance.now();
    try {
      await loadFeedHierarchy();
      const loadTime = performance.now() - loadStart;
      newResults.push(`✅ Feed hierarchy loaded in ${loadTime.toFixed(2)}ms`);
    } catch (error) {
      const loadTime = performance.now() - loadStart;
      newResults.push(`❌ Load error in ${loadTime.toFixed(2)}ms: ${error}`);
    }
    
    setResults(newResults);
    setIsRunning(false);
  };
  
  return (
    <div className="max-w-4xl mx-auto p-8">
      <h1 className="text-2xl font-bold mb-6">Performance Test</h1>
      
      <div className="mb-6">
        <Button 
          onClick={runPerformanceTest} 
          disabled={isRunning}
          className="mr-4"
        >
          {isRunning ? 'Running Tests...' : 'Run Performance Test'}
        </Button>
        <Button 
          variant="outline"
          onClick={() => setResults([])}
          disabled={isRunning}
        >
          Clear Results
        </Button>
      </div>
      
      {results.length > 0 && (
        <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg">
          <pre className="text-sm font-mono whitespace-pre-wrap">
            {results.join('\n')}
          </pre>
        </div>
      )}
      
      <div className="mt-8 text-sm text-gray-600 dark:text-gray-400">
        <p className="mb-2">This page tests:</p>
        <ul className="list-disc ml-6">
          <li>Supabase connection latency</li>
          <li>Simple query performance</li>
          <li>Count query performance (used for unread counts)</li>
          <li>Full feed hierarchy loading</li>
        </ul>
        <p className="mt-4">Open the browser console to see detailed timing logs during the feed load test.</p>
      </div>
    </div>
  );
}