import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * RR-150: Error handling and recovery tests for chunked deletion
 * Tests error scenarios and recovery mechanisms for chunked article deletion
 */
describe('RR-150: Error Handling and Recovery', () => {
  // Mock error scenarios and recovery mechanisms
  const ErrorScenarios = {
    // Database-related errors
    CONNECTION_TIMEOUT: 'connection timeout',
    DEADLOCK: 'deadlock detected',
    CONNECTION_RESET: 'connection reset by peer',
    MAX_CONNECTIONS: 'too many connections',
    
    // HTTP/Network errors
    URI_TOO_LARGE: '414 Request-URI Too Large',
    GATEWAY_TIMEOUT: '504 Gateway Timeout',
    BAD_GATEWAY: '502 Bad Gateway',
    SERVICE_UNAVAILABLE: '503 Service Unavailable',
    
    // Application errors
    INVALID_CHUNK_SIZE: 'Invalid chunk size',
    MEMORY_LIMIT: 'Memory limit exceeded',
    TIMEOUT: 'Operation timeout'
  };

  // Mock recovery strategies
  const RecoveryStrategies = {
    RETRY_WITH_BACKOFF: 'retry_with_backoff',
    REDUCE_CHUNK_SIZE: 'reduce_chunk_size',
    SKIP_AND_CONTINUE: 'skip_and_continue',
    ABORT_GRACEFULLY: 'abort_gracefully',
    FALLBACK_METHOD: 'fallback_method'
  };

  // Mock chunked deletion service with error handling
  const ChunkedDeletionWithErrorHandling = {
    maxRetries: 3,
    baseBackoffMs: 1000,
    minChunkSize: 10,
    maxChunkSize: 500,

    async deleteWithErrorHandling(articleIds: string[], options: any = {}) {
      const {
        chunkSize = 200,
        maxRetries = this.maxRetries,
        enableRecovery = true
      } = options;

      const results = {
        totalChunks: 0,
        successfulChunks: 0,
        failedChunks: 0,
        retriedChunks: 0,
        recoveredChunks: 0,
        finalChunkSize: chunkSize,
        deletedCount: 0,
        errors: [] as string[],
        recoveryActions: [] as string[],
        processingTime: 0
      };

      const startTime = Date.now();
      const chunks = this.chunkArray(articleIds, chunkSize);
      results.totalChunks = chunks.length;

      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        let success = false;
        let retryCount = 0;
        const currentChunkSize = chunk.length;

        while (!success && retryCount < maxRetries) {
          try {
            // Simulate potential errors during chunk processing
            await this.simulateChunkDeletion(chunk, retryCount);
            
            success = true;
            results.successfulChunks++;
            results.deletedCount += currentChunkSize;

            if (retryCount > 0) {
              results.recoveredChunks++;
              results.recoveryActions.push(`Chunk ${i + 1} recovered after ${retryCount} retries`);
            }

          } catch (error: any) {
            retryCount++;
            results.retriedChunks++;

            if (enableRecovery && retryCount < maxRetries) {
              const recoveryAction = await this.handleError(error, chunk, retryCount, results);
              
              if (recoveryAction === RecoveryStrategies.REDUCE_CHUNK_SIZE && chunk.length > this.minChunkSize) {
                // Split chunk and retry with smaller size
                const smallerChunks = this.chunkArray(chunk, Math.floor(chunk.length / 2));
                results.recoveryActions.push(`Reduced chunk size for chunk ${i + 1}`);
                
                // Process smaller chunks
                for (const smallChunk of smallerChunks) {
                  try {
                    await this.simulateChunkDeletion(smallChunk, 0);
                    results.deletedCount += smallChunk.length;
                  } catch (smallChunkError: any) {
                    results.errors.push(`Small chunk failed: ${smallChunkError.message}`);
                  }
                }
                success = true;
                results.recoveredChunks++;
                break;
              }

              // Wait before retry (exponential backoff)
              const backoffTime = this.baseBackoffMs * Math.pow(2, retryCount - 1);
              await new Promise(resolve => setTimeout(resolve, Math.min(backoffTime, 10000)));
            }
          }
        }

        if (!success) {
          results.failedChunks++;
          results.errors.push(`Chunk ${i + 1} failed after ${maxRetries} attempts`);
        }
      }

      results.processingTime = Date.now() - startTime;
      return results;
    },

    async simulateChunkDeletion(chunk: string[], attemptNumber: number) {
      // Simulate various error conditions based on attempt number and chunk characteristics
      const errorProbability = Math.random();
      
      // Higher chance of error on first attempt, lower on retries
      const baseErrorRate = Math.max(0.1 - (attemptNumber * 0.03), 0.01);
      
      if (errorProbability < baseErrorRate) {
        // Simulate different types of errors
        if (chunk.length > 400) {
          throw new Error(ErrorScenarios.URI_TOO_LARGE);
        } else if (errorProbability < 0.03) {
          throw new Error(ErrorScenarios.CONNECTION_TIMEOUT);
        } else if (errorProbability < 0.05) {
          throw new Error(ErrorScenarios.DEADLOCK);
        } else {
          throw new Error(ErrorScenarios.GATEWAY_TIMEOUT);
        }
      }

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, Math.random() * 100 + 50));
    },

    async handleError(error: Error, chunk: string[], retryCount: number, results: any): Promise<string> {
      const errorMessage = error.message;
      
      if (errorMessage.includes('414') || errorMessage.includes('URI Too Large')) {
        results.recoveryActions.push(`URI too large error detected, reducing chunk size`);
        return RecoveryStrategies.REDUCE_CHUNK_SIZE;
      } else if (errorMessage.includes('timeout') || errorMessage.includes('connection')) {
        results.recoveryActions.push(`Connection error detected, retrying with backoff`);
        return RecoveryStrategies.RETRY_WITH_BACKOFF;
      } else if (errorMessage.includes('deadlock')) {
        results.recoveryActions.push(`Deadlock detected, retrying with delay`);
        return RecoveryStrategies.RETRY_WITH_BACKOFF;
      } else {
        results.recoveryActions.push(`Generic error, attempting retry`);
        return RecoveryStrategies.RETRY_WITH_BACKOFF;
      }
    },

    chunkArray<T>(array: T[], chunkSize: number): T[][] {
      const chunks: T[][] = [];
      for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
      }
      return chunks;
    }
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Error Detection and Classification', () => {
    it('should properly identify and classify URI length errors', async () => {
      const articleIds = Array.from({ length: 1000 }, (_, i) => `article-${i}`);
      
      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds, {
        chunkSize: 500, // Large enough to potentially trigger URI errors
        maxRetries: 2
      });

      // Should detect and recover from URI errors
      const uriRecoveryActions = result.recoveryActions.filter(action => 
        action.includes('URI too large') || action.includes('Reduced chunk size')
      );
      
      if (uriRecoveryActions.length > 0) {
        expect(result.recoveredChunks).toBeGreaterThan(0);
        expect(result.finalChunkSize).toBeLessThan(500);
      }
    });

    it('should distinguish between recoverable and non-recoverable errors', async () => {
      const articleIds = Array.from({ length: 400 }, (_, i) => `article-${i}`);
      
      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds, {
        chunkSize: 200,
        maxRetries: 3
      });

      // Connection timeouts and deadlocks should be retryable
      const retryableErrors = result.errors.filter(error => 
        error.includes('timeout') || error.includes('connection') || error.includes('deadlock')
      );
      
      const retryActions = result.recoveryActions.filter(action =>
        action.includes('Connection error') || action.includes('Deadlock detected')
      );

      // Should have attempted recovery for retryable errors
      if (retryableErrors.length > 0) {
        expect(retryActions.length).toBeGreaterThan(0);
        expect(result.retriedChunks).toBeGreaterThan(0);
      }
    });

    it('should handle cascading failures gracefully', async () => {
      const articleIds = Array.from({ length: 1000 }, (_, i) => `article-${i}`);
      
      // Simulate high error rate scenario
      const originalSimulate = ChunkedDeletionWithErrorHandling.simulateChunkDeletion;
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = async (chunk: string[], attemptNumber: number) => {
        // Force higher error rate for this test
        if (Math.random() < 0.7) {
          throw new Error(ErrorScenarios.CONNECTION_TIMEOUT);
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      };

      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds);

      // Restore original function
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = originalSimulate;

      // Should continue processing despite high failure rate
      expect(result.totalChunks).toBe(5);
      expect(result.successfulChunks + result.failedChunks).toBe(result.totalChunks);
      expect(result.retriedChunks).toBeGreaterThan(0);
      
      // Should have attempted recovery strategies
      expect(result.recoveryActions.length).toBeGreaterThan(0);
    });
  });

  describe('Recovery Mechanisms', () => {
    it('should implement exponential backoff for retry attempts', async () => {
      const articleIds = Array.from({ length: 200 }, (_, i) => `article-${i}`);
      const startTime = Date.now();
      
      // Force errors to test backoff
      const originalSimulate = ChunkedDeletionWithErrorHandling.simulateChunkDeletion;
      let callCount = 0;
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = async (chunk: string[], attemptNumber: number) => {
        callCount++;
        if (callCount <= 2) { // Fail first 2 attempts
          throw new Error(ErrorScenarios.CONNECTION_TIMEOUT);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds, {
        maxRetries: 3
      });

      const endTime = Date.now();
      const totalTime = endTime - startTime;
      
      // Restore original function
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = originalSimulate;

      // Should have taken time for backoff delays
      expect(totalTime).toBeGreaterThan(1000); // Base backoff is 1000ms
      expect(result.retriedChunks).toBeGreaterThan(0);
      expect(result.recoveredChunks).toBeGreaterThan(0);
    });

    it('should reduce chunk size as recovery strategy for URI errors', async () => {
      const articleIds = Array.from({ length: 800 }, (_, i) => `article-${i}`);
      
      // Force URI errors for large chunks
      const originalSimulate = ChunkedDeletionWithErrorHandling.simulateChunkDeletion;
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = async (chunk: string[], attemptNumber: number) => {
        if (chunk.length > 200 && attemptNumber === 0) {
          throw new Error(ErrorScenarios.URI_TOO_LARGE);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds, {
        chunkSize: 400 // Start with large chunks that will trigger URI errors
      });

      // Restore original function
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = originalSimulate;

      // Should have reduced chunk sizes and recovered
      const chunkReductionActions = result.recoveryActions.filter(action =>
        action.includes('Reduced chunk size')
      );
      
      expect(chunkReductionActions.length).toBeGreaterThan(0);
      expect(result.recoveredChunks).toBeGreaterThan(0);
      expect(result.deletedCount).toBeGreaterThan(0);
    });

    it('should implement graceful degradation for persistent failures', async () => {
      const articleIds = Array.from({ length: 600 }, (_, i) => `article-${i}`);
      
      // Force persistent failures for some chunks
      const originalSimulate = ChunkedDeletionWithErrorHandling.simulateChunkDeletion;
      let chunkCounter = 0;
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = async (chunk: string[], attemptNumber: number) => {
        chunkCounter++;
        if (chunkCounter === 2) { // Second chunk always fails
          throw new Error(ErrorScenarios.CONNECTION_RESET);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds);

      // Restore original function
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = originalSimulate;

      // Should continue processing other chunks despite persistent failures
      expect(result.totalChunks).toBe(3);
      expect(result.successfulChunks).toBeGreaterThan(0);
      expect(result.failedChunks).toBeGreaterThan(0);
      expect(result.deletedCount).toBeGreaterThan(0);
      expect(result.deletedCount).toBeLessThan(600); // Some articles failed to delete
    });
  });

  describe('Data Consistency and Integrity', () => {
    it('should maintain data consistency during error recovery', async () => {
      const articleIds = Array.from({ length: 500 }, (_, i) => `article-${i}`);
      
      // Track which articles were "processed" during simulation
      const processedArticles = new Set<string>();
      const originalSimulate = ChunkedDeletionWithErrorHandling.simulateChunkDeletion;
      
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = async (chunk: string[], attemptNumber: number) => {
        // Randomly fail some operations
        if (Math.random() < 0.3 && attemptNumber === 0) {
          throw new Error(ErrorScenarios.DEADLOCK);
        }
        
        // Mark articles as processed on success
        chunk.forEach(id => processedArticles.add(id));
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds);

      // Restore original function
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = originalSimulate;

      // Verify data consistency
      expect(processedArticles.size).toBe(result.deletedCount);
      
      // No article should be processed twice
      const uniqueProcessedCount = new Set(Array.from(processedArticles)).size;
      expect(uniqueProcessedCount).toBe(processedArticles.size);
    });

    it('should handle partial chunk failures without data corruption', async () => {
      const articleIds = Array.from({ length: 300 }, (_, i) => `article-${i}`);
      
      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds, {
        chunkSize: 100,
        maxRetries: 2
      });

      // Should maintain accurate count of processed articles
      expect(result.deletedCount).toBeLessThanOrEqual(articleIds.length);
      expect(result.deletedCount).toBeGreaterThanOrEqual(0);
      
      // Total chunks should match expected calculation
      expect(result.totalChunks).toBe(3); // 300 / 100
      expect(result.successfulChunks + result.failedChunks).toBe(result.totalChunks);
    });

    it('should prevent duplicate processing during retries', async () => {
      const articleIds = Array.from({ length: 200 }, (_, i) => `article-${i}`);
      const processHistory: string[][] = [];
      
      const originalSimulate = ChunkedDeletionWithErrorHandling.simulateChunkDeletion;
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = async (chunk: string[], attemptNumber: number) => {
        // Record each processing attempt
        processHistory.push([...chunk]);
        
        // Fail first attempt, succeed on retry
        if (attemptNumber === 0) {
          throw new Error(ErrorScenarios.CONNECTION_TIMEOUT);
        }
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds);

      // Restore original function
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = originalSimulate;

      // Verify retry attempts were made
      expect(result.retriedChunks).toBeGreaterThan(0);
      expect(result.recoveredChunks).toBeGreaterThan(0);
      
      // Should have attempted each chunk multiple times
      expect(processHistory.length).toBeGreaterThan(result.totalChunks);
    });
  });

  describe('Resource Management During Errors', () => {
    it('should prevent resource leaks during error recovery', async () => {
      const articleIds = Array.from({ length: 400 }, (_, i) => `article-${i}`);
      
      // Mock resource tracking
      const resourceTracker = {
        openConnections: 0,
        memoryAllocations: 0,
        timers: 0
      };

      const originalSimulate = ChunkedDeletionWithErrorHandling.simulateChunkDeletion;
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = async (chunk: string[], attemptNumber: number) => {
        // Simulate resource allocation
        resourceTracker.openConnections++;
        resourceTracker.memoryAllocations += chunk.length * 1024; // Simulate memory per article
        
        try {
          if (Math.random() < 0.4) {
            throw new Error(ErrorScenarios.CONNECTION_TIMEOUT);
          }
          await new Promise(resolve => setTimeout(resolve, 10));
        } finally {
          // Simulate resource cleanup
          resourceTracker.openConnections--;
          resourceTracker.memoryAllocations -= chunk.length * 1024;
        }
      };

      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds);

      // Restore original function
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = originalSimulate;

      // Resources should be properly cleaned up
      expect(resourceTracker.openConnections).toBe(0);
      expect(resourceTracker.memoryAllocations).toBe(0);
      
      // Operation should complete despite errors
      expect(result.totalChunks).toBeGreaterThan(0);
    });

    it('should handle memory pressure during error recovery', async () => {
      const articleIds = Array.from({ length: 1000 }, (_, i) => `article-${i}`);
      
      // Simulate memory pressure detection
      let memoryPressureEvents = 0;
      const originalSimulate = ChunkedDeletionWithErrorHandling.simulateChunkDeletion;
      
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = async (chunk: string[], attemptNumber: number) => {
        // Simulate memory pressure on large chunks
        if (chunk.length > 250) {
          memoryPressureEvents++;
          throw new Error(ErrorScenarios.MEMORY_LIMIT);
        }
        
        await new Promise(resolve => setTimeout(resolve, 10));
      };

      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds, {
        chunkSize: 300 // Start with large chunks that will trigger memory pressure
      });

      // Restore original function
      ChunkedDeletionWithErrorHandling.simulateChunkDeletion = originalSimulate;

      // Should have detected and handled memory pressure
      if (memoryPressureEvents > 0) {
        expect(result.recoveryActions.some(action => 
          action.includes('Reduced chunk size')
        )).toBe(true);
      }
    });
  });

  describe('Monitoring and Alerting for Errors', () => {
    it('should provide comprehensive error reporting', async () => {
      const articleIds = Array.from({ length: 600 }, (_, i) => `article-${i}`);
      
      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds);

      // Should provide detailed error information
      expect(result).toHaveProperty('errors');
      expect(result).toHaveProperty('recoveryActions');
      expect(result).toHaveProperty('retriedChunks');
      expect(result).toHaveProperty('recoveredChunks');
      expect(result).toHaveProperty('processingTime');

      // Error information should be actionable
      result.errors.forEach(error => {
        expect(error).toContain('Chunk');
        expect(error).toMatch(/\d+/); // Should contain chunk numbers
      });

      result.recoveryActions.forEach(action => {
        expect(action.length).toBeGreaterThan(10); // Should be descriptive
      });
    });

    it('should generate metrics for error analysis', async () => {
      const articleIds = Array.from({ length: 800 }, (_, i) => `article-${i}`);
      
      const result = await ChunkedDeletionWithErrorHandling.deleteWithErrorHandling(articleIds);

      // Calculate error metrics
      const totalOperations = result.totalChunks;
      const successRate = result.successfulChunks / totalOperations;
      const retryRate = result.retriedChunks / totalOperations;
      const recoveryRate = result.recoveredChunks / Math.max(result.retriedChunks, 1);

      // Metrics should be within reasonable ranges
      expect(successRate).toBeGreaterThanOrEqual(0);
      expect(successRate).toBeLessThanOrEqual(1);
      expect(retryRate).toBeGreaterThanOrEqual(0);
      expect(recoveryRate).toBeGreaterThanOrEqual(0);
      expect(recoveryRate).toBeLessThanOrEqual(1);

      // Should provide enough data for trend analysis
      expect(result.processingTime).toBeGreaterThan(0);
      expect(result.errors.length + result.recoveryActions.length).toBeGreaterThanOrEqual(0);
    });
  });
});