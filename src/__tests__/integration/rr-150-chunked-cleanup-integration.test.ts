import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { setupTestServer } from './test-server';
import type { Server } from 'http';

/**
 * RR-150: Integration tests for chunked article cleanup
 * Tests end-to-end cleanup process with chunked deletion to avoid 414 errors
 */
describe('RR-150: Chunked Cleanup Integration', () => {
  let server: Server;
  let app: any;
  const testPort = 3002;

  beforeAll(async () => {
    const testServer = await setupTestServer(testPort);
    server = testServer.server;
    app = testServer.app;
    
    await new Promise<void>((resolve) => {
      server.listen(testPort, resolve);
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
    if (app) {
      await app.close();
    }
  });

  describe('Chunked Article Cleanup API Integration', () => {
    it('should handle large article cleanup without 414 URI Too Large errors', async () => {
      // Simulate cleanup of 1000+ articles scenario from RR-150
      const response = await fetch(`http://localhost:${testPort}/reader/api/sync`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          cleanup: true,
          maxArticlesPerCleanupBatch: 1000 // Simulate the problematic batch size
        })
      });

      // Should not get 414 error anymore with chunked implementation
      expect(response.status).not.toBe(414);
      expect(response.ok).toBe(true);

      const result = await response.json();
      
      // Verify response structure for cleanup results
      expect(result).toHaveProperty('success');
      if (result.cleanup) {
        expect(result.cleanup).toHaveProperty('readArticlesDeleted');
        expect(result.cleanup).toHaveProperty('trackingEntriesCreated');
        expect(result.cleanup).toHaveProperty('errors');
        
        // Should not contain 414 errors in the error array
        const has414Error = result.cleanup.errors?.some((error: string) => 
          error.includes('414') || error.includes('Request-URI Too Large')
        );
        expect(has414Error).toBe(false);
      }
    });

    it('should process cleanup in chunks when many articles exist', async () => {
      // Test the specific scenario where cleanup processes large batches
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/read-articles`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chunkSize: 200,
          enableTracking: true
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Verify chunked processing indicators
      expect(result).toHaveProperty('totalChunks');
      expect(result).toHaveProperty('successfulChunks');
      expect(result).toHaveProperty('failedChunks');
      expect(result.errors).toBeInstanceOf(Array);

      // Verify no URI length errors
      const uriErrors = result.errors.filter((error: string) => 
        error.includes('414') || error.includes('URI') || error.includes('Too Large')
      );
      expect(uriErrors).toHaveLength(0);
    });

    it('should maintain data consistency during chunked operations', async () => {
      // Test that articles are properly tracked before deletion in chunks
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/test-consistency`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulateArticleCount: 500,
          chunkSize: 100
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Verify tracking consistency
      expect(result.articlesProcessed).toBe(result.trackingEntriesCreated);
      expect(result.articlesDeleted).toBeLessThanOrEqual(result.trackingEntriesCreated);
      expect(result.dataConsistencyCheck).toBe(true);
    });

    it('should handle partial failures gracefully in chunked processing', async () => {
      // Test scenario where some chunks fail but processing continues
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/test-partial-failure`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulateFailureRate: 0.2, // 20% of chunks fail
          totalArticles: 1000,
          chunkSize: 200
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Should continue processing despite failures
      expect(result.totalChunks).toBe(5); // 1000 / 200
      expect(result.successfulChunks).toBeGreaterThan(0);
      expect(result.failedChunks).toBeGreaterThan(0);
      expect(result.successfulChunks + result.failedChunks).toBe(result.totalChunks);

      // Should have processed some articles despite failures
      expect(result.deletedCount).toBeGreaterThan(0);
      expect(result.deletedCount).toBeLessThan(1000);
    });
  });

  describe('Performance and Resource Management', () => {
    it('should complete large cleanup operations within reasonable time', async () => {
      const startTime = Date.now();
      
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/performance-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleCount: 2000,
          chunkSize: 200,
          delayBetweenChunks: 100
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();
      
      const endTime = Date.now();
      const duration = endTime - startTime;

      // Should complete within reasonable time (10 chunks * 100ms delay + processing)
      expect(duration).toBeLessThan(5000); // 5 seconds max
      expect(result.totalProcessingTime).toBeLessThan(4000);
      expect(result.averageChunkTime).toBeLessThan(400);
    });

    it('should maintain stable memory usage during large operations', async () => {
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/memory-test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleCount: 5000,
          chunkSize: 200,
          monitorMemory: true
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Memory should remain stable throughout operation
      expect(result.memoryStats).toHaveProperty('initialMemory');
      expect(result.memoryStats).toHaveProperty('peakMemory');
      expect(result.memoryStats).toHaveProperty('finalMemory');

      // Memory growth should be reasonable (not linear with article count)
      const memoryGrowth = result.memoryStats.peakMemory - result.memoryStats.initialMemory;
      expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // Less than 50MB growth
    });
  });

  describe('Error Recovery and Resilience', () => {
    it('should recover from database connection issues between chunks', async () => {
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/test-resilience`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulateConnectionIssues: true,
          articleCount: 800,
          chunkSize: 200
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Should attempt all chunks despite connection issues
      expect(result.totalChunks).toBe(4);
      expect(result.retryAttempts).toBeGreaterThan(0);
      
      // Should have some success despite simulated issues
      expect(result.successfulChunks).toBeGreaterThan(0);
      
      // Connection errors should be properly logged
      const connectionErrors = result.errors.filter((error: string) => 
        error.includes('connection') || error.includes('timeout')
      );
      expect(connectionErrors.length).toBeGreaterThan(0);
    });

    it('should handle Cloudflare/proxy errors that triggered RR-150', async () => {
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/test-proxy-errors`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          simulate414Error: true,
          articleCount: 1097, // Exact count from RR-150 issue
          chunkSize: 200
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Should not encounter 414 errors with chunked approach
      const has414Error = result.errors.some((error: string) => 
        error.includes('414') || error.includes('Request-URI Too Large')
      );
      expect(has414Error).toBe(false);

      // Should successfully process the problematic 1097 articles
      expect(result.totalChunks).toBe(6); // ceil(1097/200)
      expect(result.articlesProcessed).toBe(1097);
    });
  });

  describe('Configuration and Flexibility', () => {
    it('should respect custom chunk sizes from system configuration', async () => {
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/test-config`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customChunkSize: 150,
          articleCount: 600
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Should use custom chunk size
      expect(result.chunkSizeUsed).toBe(150);
      expect(result.totalChunks).toBe(4); // 600 / 150
      
      // Verify chunks were properly sized
      expect(result.chunkSizes).toEqual([150, 150, 150, 150]);
    });

    it('should allow configurable delays between chunks', async () => {
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/test-delays`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          chunkDelay: 250,
          articleCount: 400,
          chunkSize: 200
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Should respect custom delay
      expect(result.delayUsed).toBe(250);
      expect(result.totalChunks).toBe(2);
      
      // Total time should reflect the delay
      expect(result.totalProcessingTime).toBeGreaterThan(250);
      expect(result.totalProcessingTime).toBeLessThan(1000);
    });
  });

  describe('Monitoring and Observability', () => {
    it('should provide detailed metrics for chunked operations', async () => {
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/test-metrics`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleCount: 1000,
          chunkSize: 200,
          enableMetrics: true
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Should provide comprehensive metrics
      expect(result.metrics).toHaveProperty('totalChunks');
      expect(result.metrics).toHaveProperty('successfulChunks');
      expect(result.metrics).toHaveProperty('failedChunks');
      expect(result.metrics).toHaveProperty('averageChunkTime');
      expect(result.metrics).toHaveProperty('totalProcessingTime');
      expect(result.metrics).toHaveProperty('articlesPerSecond');

      // Metrics should be reasonable
      expect(result.metrics.totalChunks).toBe(5);
      expect(result.metrics.articlesPerSecond).toBeGreaterThan(0);
    });

    it('should log chunk processing progress for monitoring', async () => {
      const response = await fetch(`http://localhost:${testPort}/reader/api/cleanup/test-logging`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          articleCount: 600,
          chunkSize: 200,
          enableProgressLogging: true
        })
      });

      expect(response.ok).toBe(true);
      const result = await response.json();

      // Should have progress logs for each chunk
      expect(result.progressLogs).toHaveLength(3); // 3 chunks
      
      result.progressLogs.forEach((log: any, index: number) => {
        expect(log).toHaveProperty('chunkNumber', index + 1);
        expect(log).toHaveProperty('articlesInChunk');
        expect(log).toHaveProperty('processingTime');
        expect(log).toHaveProperty('success');
      });
    });
  });
});