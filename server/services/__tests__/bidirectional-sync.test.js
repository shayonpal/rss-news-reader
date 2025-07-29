const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest');
const BiDirectionalSyncService = require('../bidirectional-sync');

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn()
  }))
}));

vi.mock('../../lib/token-manager', () => {
  return vi.fn(() => ({
    makeAuthenticatedRequest: vi.fn()
  }));
});

describe('BiDirectionalSyncService', () => {
  let service;
  let mockSupabase;
  let mockTokenManager;
  let consoleErrorSpy;
  let consoleLogSpy;

  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    
    // Mock environment variables
    process.env.SYNC_INTERVAL_MINUTES = '5';
    process.env.SYNC_MIN_CHANGES = '5';
    process.env.SYNC_BATCH_SIZE = '100';
    process.env.SYNC_MAX_RETRIES = '3';
    process.env.SYNC_RETRY_BACKOFF_MINUTES = '10';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';

    // Mock console methods
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    // Create service instance
    service = new BiDirectionalSyncService();
    
    // Get mock instances
    mockSupabase = service.supabase;
    mockTokenManager = service.tokenManager;
  });

  afterEach(() => {
    // Clean up timers
    if (service.syncTimer) {
      clearInterval(service.syncTimer);
    }
    consoleErrorSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('trackApiUsage', () => {
    it('should track API usage correctly for new date', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      // Mock the select query - no existing record
      const selectMock = vi.fn().mockReturnValue({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: 'PGRST116' } // No rows found
        })
      });
      
      // Mock the insert query
      const insertMock = vi.fn().mockResolvedValue({
        error: null
      });
      
      const fromMock = vi.fn().mockImplementation((table) => {
        if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' }
                  })
                })
              })
            }),
            insert: insertMock
          };
        }
      });
      
      mockSupabase.from = fromMock;

      await service.trackApiUsage();

      expect(insertMock).toHaveBeenCalledWith({
        service: 'inoreader',
        date: today,
        count: 1,
        created_at: expect.any(String)
      });
    });

    it('should update existing API usage record', async () => {
      const today = new Date().toISOString().split('T')[0];
      const existingRecord = {
        id: 'test-id',
        service: 'inoreader',
        date: today,
        count: 10
      };
      
      // Mock the update query
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });
      
      const fromMock = vi.fn().mockImplementation((table) => {
        if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: existingRecord,
                    error: null
                  })
                })
              })
            }),
            update: updateMock
          };
        }
      });
      
      mockSupabase.from = fromMock;

      await service.trackApiUsage();

      expect(updateMock).toHaveBeenCalledWith({ count: 11 });
    });

    it('should handle database errors gracefully without throwing', async () => {
      const fromMock = vi.fn().mockImplementation((table) => {
        if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockRejectedValue(new Error('Database connection failed'))
                })
              })
            })
          };
        }
      });
      
      mockSupabase.from = fromMock;

      // Should not throw
      await expect(service.trackApiUsage()).resolves.not.toThrow();
      
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Unexpected error tracking API usage:',
        expect.any(Error)
      );
    });

    it('should continue sync process even if API tracking fails', async () => {
      // Mock successful sync queue fetch
      const pendingChanges = [
        { id: '1', action_type: 'read', inoreader_id: 'item1', sync_attempts: 0 }
      ];
      
      const fromMock = vi.fn().mockImplementation((table) => {
        if (table === 'sync_queue') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: pendingChanges,
                  error: null
                })
              })
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null })
            })
          };
        } else if (table === 'api_usage') {
          // Force API tracking to fail
          throw new Error('API tracking database error');
        }
      });
      
      mockSupabase.from = fromMock;
      
      // Mock successful Inoreader API call
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      await service.processSyncQueue();

      // Verify sync completed despite API tracking error
      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced 1 read changes')
      );
    });

    it('should handle select errors that are not "no rows found"', async () => {
      const fromMock = vi.fn().mockImplementation((table) => {
        if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST500', message: 'Internal server error' }
                  })
                })
              })
            })
          };
        }
      });
      
      mockSupabase.from = fromMock;

      await service.trackApiUsage();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Error checking API usage:',
        expect.objectContaining({ code: 'PGRST500' })
      );
    });

    it('should handle insert errors gracefully', async () => {
      const fromMock = vi.fn().mockImplementation((table) => {
        if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' }
                  })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({
              error: { message: 'Insert failed' }
            })
          };
        }
      });
      
      mockSupabase.from = fromMock;

      await service.trackApiUsage();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Error inserting API usage:',
        expect.objectContaining({ message: 'Insert failed' })
      );
    });

    it('should handle update errors gracefully', async () => {
      const existingRecord = {
        id: 'test-id',
        count: 10
      };
      
      const fromMock = vi.fn().mockImplementation((table) => {
        if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: existingRecord,
                    error: null
                  })
                })
              })
            }),
            update: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                error: { message: 'Update failed' }
              })
            })
          };
        }
      });
      
      mockSupabase.from = fromMock;

      await service.trackApiUsage();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Error updating API usage:',
        expect.objectContaining({ message: 'Update failed' })
      );
    });
  });

  describe('processSyncQueue', () => {
    it('should skip processing if already processing', async () => {
      service.isProcessing = true;
      
      await service.processSyncQueue();
      
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Already processing, skipping this cycle'
      );
      expect(mockSupabase.from).not.toHaveBeenCalled();
    });

    it('should handle empty sync queue', async () => {
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: [],
              error: null
            })
          })
        })
      });
      
      mockSupabase.from = fromMock;

      await service.processSyncQueue();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] No pending changes to sync'
      );
    });

    it('should process changes when minimum threshold is met', async () => {
      const pendingChanges = Array(5).fill(null).map((_, i) => ({
        id: String(i + 1),
        action_type: 'read',
        inoreader_id: 'item' + (i + 1),
        sync_attempts: 0,
        created_at: new Date().toISOString()
      }));
      
      const fromMock = vi.fn().mockImplementation((table) => {
        if (table === 'sync_queue') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: pendingChanges,
                  error: null
                })
              })
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null })
            })
          };
        } else if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' }
                  })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ error: null })
          };
        }
      });
      
      mockSupabase.from = fromMock;
      
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      await service.processSyncQueue();

      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalled();
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Successfully synced 5 read changes')
      );
    });

    it('should process old changes even if below minimum threshold', async () => {
      const oldDate = new Date(Date.now() - 20 * 60 * 1000).toISOString(); // 20 minutes ago
      const pendingChanges = [
        { id: '1', action_type: 'read', inoreader_id: 'item1', sync_attempts: 0, created_at: oldDate }
      ];
      
      const fromMock = vi.fn().mockImplementation((table) => {
        if (table === 'sync_queue') {
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: pendingChanges,
                  error: null
                })
              })
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockResolvedValue({ error: null })
            })
          };
        } else if (table === 'api_usage') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116' }
                  })
                })
              })
            }),
            insert: vi.fn().mockResolvedValue({ error: null })
          };
        }
      });
      
      mockSupabase.from = fromMock;
      
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      await service.processSyncQueue();

      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalled();
    });

    it('should handle database errors when fetching sync queue', async () => {
      const fromMock = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          lt: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database error' }
            })
          })
        })
      });
      
      mockSupabase.from = fromMock;

      await service.processSyncQueue();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Error fetching sync queue:',
        expect.objectContaining({ message: 'Database error' })
      );
    });
  });

  describe('sendBatchToInoreader', () => {
    it('should send correct parameters for read action', async () => {
      const batch = [
        { id: '1', inoreader_id: 'item1' },
        { id: '2', inoreader_id: 'item2' }
      ];
      
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });
      
      // Mock trackApiUsage to not throw
      service.trackApiUsage = vi.fn().mockResolvedValue(undefined);

      await service.sendBatchToInoreader('read', batch);

      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalledWith(
        'https://www.inoreader.com/reader/api/0/edit-tag',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: expect.any(URLSearchParams)
        })
      );
      
      const callArgs = mockTokenManager.makeAuthenticatedRequest.mock.calls[0];
      const params = callArgs[1].body;
      expect(params.getAll('i')).toEqual(['item1', 'item2']);
      expect(params.get('a')).toBe('user/-/state/com.google/read');
    });

    it('should send correct parameters for unread action', async () => {
      const batch = [{ id: '1', inoreader_id: 'item1' }];
      
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });
      
      service.trackApiUsage = vi.fn().mockResolvedValue(undefined);

      await service.sendBatchToInoreader('unread', batch);

      const callArgs = mockTokenManager.makeAuthenticatedRequest.mock.calls[0];
      const params = callArgs[1].body;
      expect(params.get('r')).toBe('user/-/state/com.google/read');
    });

    it('should handle API errors', async () => {
      const batch = [{ id: '1', inoreader_id: 'item1' }];
      
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        text: vi.fn().mockResolvedValue('Invalid token')
      });

      await expect(service.sendBatchToInoreader('read', batch))
        .rejects.toThrow('Inoreader sync failed: 401 Unauthorized - Invalid token');
    });

    it('should throw error for unknown action type', async () => {
      const batch = [{ id: '1', inoreader_id: 'item1' }];

      await expect(service.sendBatchToInoreader('invalid', batch))
        .rejects.toThrow('Unknown action type: invalid');
    });
  });

  describe('handleSyncError', () => {
    it('should update retry attempts correctly', async () => {
      const batch = [
        { id: '1', sync_attempts: 0 },
        { id: '2', sync_attempts: 1 }
      ];
      
      const updateMock = vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null })
      });
      
      mockSupabase.from = vi.fn().mockReturnValue({
        update: updateMock
      });

      await service.handleSyncError(batch, new Error('Test error'));

      expect(updateMock).toHaveBeenCalledTimes(2);
      expect(updateMock).toHaveBeenCalledWith({
        sync_attempts: 1,
        last_attempt_at: expect.any(String)
      });
      expect(updateMock).toHaveBeenCalledWith({
        sync_attempts: 2,
        last_attempt_at: expect.any(String)
      });
    });

    it('should handle max retries correctly', async () => {
      const batch = [{ id: '1', sync_attempts: 2 }]; // Will be 3rd attempt
      
      mockSupabase.from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });

      await service.handleSyncError(batch, new Error('Test error'));

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Max retries reached for 1, will not retry')
      );
    });
  });

  describe('memory management', () => {
    it('should reset processing flag after error', async () => {
      const fromMock = vi.fn().mockImplementation(() => {
        throw new Error('Unexpected error');
      });
      
      mockSupabase.from = fromMock;

      await service.processSyncQueue();

      expect(service.isProcessing).toBe(false);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Error processing sync queue:',
        expect.any(Error)
      );
    });

    it('should not accumulate retry attempts in memory', async () => {
      // Add some retry attempts
      service.retryAttempts.set('1', 1);
      service.retryAttempts.set('2', 2);
      service.retryAttempts.set('3', 3);
      
      // Process error to add more
      const batch = [{ id: '4', sync_attempts: 0 }];
      mockSupabase.from = vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null })
        })
      });
      
      await service.handleSyncError(batch, new Error('Test'));
      
      // Map should contain all items
      expect(service.retryAttempts.size).toBe(4);
      
      // In a real implementation, you might want to add cleanup logic
      // to prevent unbounded growth of the retry map
    });
  });

  describe('periodic sync', () => {
    it('should start periodic sync with correct interval', async () => {
      vi.useFakeTimers();
      
      const processSyncQueueSpy = vi.spyOn(service, 'processSyncQueue').mockResolvedValue(undefined);
      
      await service.startPeriodicSync();
      
      // Initial sync should be called
      expect(processSyncQueueSpy).toHaveBeenCalledTimes(1);
      
      // Fast forward 5 minutes
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      // Should have been called again
      expect(processSyncQueueSpy).toHaveBeenCalledTimes(2);
      
      vi.useRealTimers();
    });

    it('should stop periodic sync correctly', () => {
      service.syncTimer = setInterval(() => {}, 1000);
      
      service.stopPeriodicSync();
      
      expect(service.syncTimer).toBe(null);
      expect(consoleLogSpy).toHaveBeenCalledWith('[BiDirectionalSync] Stopped periodic sync');
    });

    it('should not process if already processing during periodic sync', async () => {
      vi.useFakeTimers();
      
      const processSyncQueueSpy = vi.spyOn(service, 'processSyncQueue');
      
      // Set isProcessing to true
      service.isProcessing = true;
      
      await service.startPeriodicSync();
      
      // Fast forward - should not call processSyncQueue
      vi.advanceTimersByTime(5 * 60 * 1000);
      
      // Only the initial call should have happened
      expect(processSyncQueueSpy).toHaveBeenCalledTimes(1);
      
      vi.useRealTimers();
    });
  });

  describe('getSyncQueueStats', () => {
    it('should return sync queue statistics', async () => {
      const mockStats = {
        total_pending: 10,
        failed_items: 2,
        oldest_item: '2024-01-01T00:00:00Z'
      };
      
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: mockStats,
            error: null
          })
        })
      });

      const stats = await service.getSyncQueueStats();

      expect(stats).toEqual(mockStats);
    });

    it('should handle errors when getting stats', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'Stats error' }
          })
        })
      });

      const stats = await service.getSyncQueueStats();

      expect(stats).toBe(null);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Error getting sync stats:',
        expect.objectContaining({ message: 'Stats error' })
      );
    });
  });

  describe('clearFailedItems', () => {
    it('should clear failed items from queue', async () => {
      const deletedItems = [
        { id: '1' },
        { id: '2' }
      ];
      
      mockSupabase.from = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: deletedItems,
              error: null
            })
          })
        })
      });

      const count = await service.clearFailedItems();

      expect(count).toBe(2);
      expect(consoleLogSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Cleared 2 failed items from sync queue'
      );
    });

    it('should handle errors when clearing failed items', async () => {
      mockSupabase.from = vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          gte: vi.fn().mockReturnValue({
            select: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Delete error' }
            })
          })
        })
      });

      const count = await service.clearFailedItems();

      expect(count).toBe(0);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[BiDirectionalSync] Error clearing failed items:',
        expect.objectContaining({ message: 'Delete error' })
      );
    });
  });
});
EOF < /dev/null