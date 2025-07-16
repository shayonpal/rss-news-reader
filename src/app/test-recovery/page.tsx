'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createRecoverySystem } from '@/lib/db/legacy-recovery';

export default function TestRecoveryPage() {
  const [status, setStatus] = useState<string>('');
  const [databases, setDatabases] = useState<any[]>([]);

  const clearRecoveryFlag = () => {
    localStorage.removeItem('legacy-recovery-seen');
    setStatus('Recovery flag cleared. Reload the page to trigger recovery dialog.');
  };

  const createTestLegacyData = async () => {
    try {
      setStatus('Creating test legacy data...');
      
      // Create a test database with RSS reader structure
      const dbName = 'rss-news-reader-legacy-test';
      const db = await new Promise<IDBDatabase>((resolve, reject) => {
        const request = indexedDB.open(dbName, 1);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
          const db = (event.target as IDBOpenDBRequest).result;
          
          // Create stores matching the RSS reader structure
          if (!db.objectStoreNames.contains('articles')) {
            const articlesStore = db.createObjectStore('articles', { keyPath: 'id' });
            articlesStore.createIndex('feedId', 'feedId', { unique: false });
          }
          
          if (!db.objectStoreNames.contains('feeds')) {
            db.createObjectStore('feeds', { keyPath: 'id' });
          }
          
          if (!db.objectStoreNames.contains('folders')) {
            db.createObjectStore('folders', { keyPath: 'id' });
          }
        };
      });

      // Add test data
      const tx = db.transaction(['articles', 'feeds', 'folders'], 'readwrite');
      
      // Add test feed
      await tx.objectStore('feeds').add({
        id: 'test-feed-1',
        title: 'Test RSS Feed',
        url: 'https://example.com/rss',
        description: 'A test feed for recovery',
        lastBuildDate: new Date().toISOString()
      });

      // Add test articles
      for (let i = 1; i <= 5; i++) {
        await tx.objectStore('articles').add({
          id: `test-article-${i}`,
          feedId: 'test-feed-1',
          title: `Test Article ${i}`,
          content: `This is the content of test article ${i}`,
          url: `https://example.com/article-${i}`,
          publishedAt: new Date(Date.now() - i * 86400000).toISOString(),
          isRead: i % 2 === 0
        });
      }

      // Add test folder
      await tx.objectStore('folders').add({
        id: 'test-folder-1',
        name: 'Test Folder',
        feedIds: ['test-feed-1']
      });

      await tx.complete;
      db.close();

      setStatus('Test legacy data created successfully!');
      await checkDatabases();
    } catch (error) {
      setStatus(`Error creating test data: ${error}`);
    }
  };

  const checkDatabases = async () => {
    try {
      const recoverySystem = createRecoverySystem();
      const dbs = await recoverySystem.discoverLegacyDatabases();
      setDatabases(dbs);
    } catch (error) {
      setStatus(`Error checking databases: ${error}`);
    }
  };

  const clearAllLegacyData = async () => {
    try {
      setStatus('Clearing all legacy databases...');
      const dbs = await indexedDB.databases();
      
      for (const db of dbs) {
        if (db.name && db.name.includes('rss-reader')) {
          await new Promise<void>((resolve, reject) => {
            const deleteReq = indexedDB.deleteDatabase(db.name!);
            deleteReq.onsuccess = () => resolve();
            deleteReq.onerror = () => reject(deleteReq.error);
          });
        }
      }
      
      setStatus('All legacy databases cleared!');
      await checkDatabases();
    } catch (error) {
      setStatus(`Error clearing databases: ${error}`);
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Legacy Recovery Test Page</h1>
      
      <div className="border rounded-lg p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Test Controls</h2>
        <div className="space-y-4">
          <Button onClick={clearRecoveryFlag} className="w-full">
            Clear Recovery Flag (Show Dialog on Reload)
          </Button>
          <Button onClick={createTestLegacyData} className="w-full">
            Create Test Legacy Data
          </Button>
          <Button onClick={checkDatabases} className="w-full">
            Check for Legacy Databases
          </Button>
          <Button onClick={clearAllLegacyData} variant="destructive" className="w-full">
            Clear All Legacy Data
          </Button>
        </div>
      </div>

      {status && (
        <div className="border rounded-lg p-6 mb-6">
          <h3 className="text-lg font-semibold mb-2">Status</h3>
          <p className="text-sm text-gray-600">{status}</p>
        </div>
      )}

      {databases.length > 0 && (
        <div className="border rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Discovered Databases</h3>
          <div className="space-y-4">
            {databases.map((db, index) => (
              <div key={index} className="border rounded p-4">
                <h4 className="font-semibold">{db.name}</h4>
                <p className="text-sm text-gray-600">Domain: {db.domain}</p>
                <div className="mt-2 text-sm">
                  <p>Articles: {db.recordCounts.articles || 0}</p>
                  <p>Feeds: {db.recordCounts.feeds || 0}</p>
                  <p>Folders: {db.recordCounts.folders || 0}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}