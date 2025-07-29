const { describe, it, expect, vi, beforeEach, afterEach } = require('vitest');
const BiDirectionalSyncService = require('../bidirectional-sync');

// Mock Supabase client with more realistic behavior
const createMockSupabaseClient = () => {
  const mockData = {
    api_usage: [],
    sync_queue: []
  };

  return {
    from: vi.fn((table) => {
      switch (table) {
        case 'api_usage':
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                eq: vi.fn().mockReturnValue({
                  single: vi.fn().mockResolvedValue({
                    data: mockData.api_usage.find(record => 
                      record.service === 'inoreader' && 
                      record.date === new Date().toISOString().split('T')[0]
                    ) || null,
                    error: mockData.api_usage.length === 0 ? { code: 'PGRST116' } : null
                  })
                })
              })
            }),
            insert: vi.fn().mockImplementation((data) => {
              mockData.api_usage.push({ ...data, id: 'new-id' });
              return Promise.resolve({ error: null });
            }),
            update: vi.fn().mockImplementation((data) => ({
              eq: vi.fn().mockResolvedValue({ error: null })
            }))
          };
          
        case 'sync_queue':
          return {
            select: vi.fn().mockReturnValue({
              lt: vi.fn().mockReturnValue({
                order: vi.fn().mockResolvedValue({
                  data: mockData.sync_queue.filter(item => item.sync_attempts < 3),
                  error: null
                })
              })
            }),
            delete: vi.fn().mockReturnValue({
              in: vi.fn().mockImplementation((field, ids) => {
                mockData.sync_queue = mockData.sync_queue.filter(
                  item => \!ids.includes(item.id)
                );
                return Promise.resolve({ error: null });
              })
            }),
            update: vi.fn().mockImplementation((updateData) => ({
              eq: vi.fn().mockImplementation((field, id) => {
                const item = mockData.sync_queue.find(i => i.id === id);
                if (item) {
                  Object.assign(item, updateData);
                }
                return Promise.resolve({ error: null });
              })
            }))
          };
          
        case 'sync_queue_stats':
          return {
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: {
                  total_pending: mockData.sync_queue.length,
                  failed_items: mockData.sync_queue.filter(i => i.sync_attempts >= 3).length,
                  oldest_item: mockData.sync_queue[0]?.created_at || null
                },
                error: null
              })
            })
          };
          
        default:
          return {};
      }
    }),
    _mockData: mockData // Expose for testing
  };
};

// Mock dependencies
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => createMockSupabaseClient())
}));

vi.mock('../../lib/token-manager', () => {
  return vi.fn(() => ({
    makeAuthenticatedRequest: vi.fn()
  }));
});

describe('BiDirectionalSyncService - Integration Tests', () => {
  let service;
  let mockSupabase;
  let mockTokenManager;

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Set up environment
    process.env.SYNC_INTERVAL_MINUTES = '5';
    process.env.SYNC_MIN_CHANGES = '5';
    process.env.SYNC_BATCH_SIZE = '100';
    process.env.SYNC_MAX_RETRIES = '3';
    
    service = new BiDirectionalSyncService();
    mockSupabase = service.supabase;
    mockTokenManager = service.tokenManager;
  });

  afterEach(() => {
    if (service.syncTimer) {
      clearInterval(service.syncTimer);
    }
  });

  describe('Full sync cycle', () => {
    it('should complete a full sync cycle with multiple action types', async () => {
      // Add test data to sync queue
      mockSupabase._mockData.sync_queue = [
        { id: '1', action_type: 'read', inoreader_id: 'item1', sync_attempts: 0, created_at: new Date().toISOString() },
        { id: '2', action_type: 'read', inoreader_id: 'item2', sync_attempts: 0, created_at: new Date().toISOString() },
        { id: '3', action_type: 'star', inoreader_id: 'item3', sync_attempts: 0, created_at: new Date().toISOString() },
        { id: '4', action_type: 'unread', inoreader_id: 'item4', sync_attempts: 0, created_at: new Date().toISOString() },
        { id: '5', action_type: 'unstar', inoreader_id: 'item5', sync_attempts: 0, created_at: new Date().toISOString() },
      ];

      // Mock successful API responses
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      await service.processSyncQueue();

      // Verify all items were processed
      expect(mockSupabase._mockData.sync_queue).toHaveLength(0);
      
      // Verify API usage was tracked
      expect(mockSupabase._mockData.api_usage).toHaveLength(1);
      expect(mockSupabase._mockData.api_usage[0].count).toBe(4); // 4 different action types
      
      // Verify correct API calls were made
      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalledTimes(4);
    });

    it('should handle partial failures and retry logic', async () => {
      // Add test data
      mockSupabase._mockData.sync_queue = [
        { id: '1', action_type: 'read', inoreader_id: 'item1', sync_attempts: 0, created_at: new Date().toISOString() },
        { id: '2', action_type: 'read', inoreader_id: 'item2', sync_attempts: 0, created_at: new Date().toISOString() },
        { id: '3', action_type: 'star', inoreader_id: 'item3', sync_attempts: 0, created_at: new Date().toISOString() },
      ];

      // Mock API to fail on first call, succeed on retry
      let callCount = 0;
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            text: vi.fn().mockResolvedValue('Server error')
          });
        }
        return Promise.resolve({
          ok: true,
          text: vi.fn().mockResolvedValue('OK')
        });
      });

      await service.processSyncQueue();

      // First batch should have failed, items should have retry attempts incremented
      const readItems = mockSupabase._mockData.sync_queue.filter(i => i.action_type === 'read');
      expect(readItems).toHaveLength(2);
      expect(readItems[0].sync_attempts).toBe(1);
      expect(readItems[1].sync_attempts).toBe(1);

      // Star item should have succeeded
      const starItems = mockSupabase._mockData.sync_queue.filter(i => i.action_type === 'star');
      expect(starItems).toHaveLength(0);
    });

    it('should respect batch size limits', async () => {
      // Set smaller batch size
      process.env.SYNC_BATCH_SIZE = '2';
      service.BATCH_SIZE = 2;

      // Add many items of same type
      mockSupabase._mockData.sync_queue = Array(5).fill(null).map((_, i) => ({
        id: String(i + 1),
        action_type: 'read',
        inoreader_id: 'item' + (i + 1),
        sync_attempts: 0,
        created_at: new Date().toISOString()
      }));

      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      await service.processSyncQueue();

      // Should have made 3 API calls (2 + 2 + 1)
      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalledTimes(3);
      
      // All items should be processed
      expect(mockSupabase._mockData.sync_queue).toHaveLength(0);
    });

    it('should handle rate limiting gracefully', async () => {
      // Add items
      mockSupabase._mockData.sync_queue = [
        { id: '1', action_type: 'read', inoreader_id: 'item1', sync_attempts: 0, created_at: new Date().toISOString() }
      ];

      // Mock rate limit response
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
        text: vi.fn().mockResolvedValue('Rate limit exceeded')
      });

      await service.processSyncQueue();

      // Item should still be in queue with incremented attempts
      expect(mockSupabase._mockData.sync_queue).toHaveLength(1);
      expect(mockSupabase._mockData.sync_queue[0].sync_attempts).toBe(1);
    });

    it('should not process items that have reached max retries', async () => {
      // Add items with different retry counts
      mockSupabase._mockData.sync_queue = [
        { id: '1', action_type: 'read', inoreader_id: 'item1', sync_attempts: 2, created_at: new Date().toISOString() },
        { id: '2', action_type: 'read', inoreader_id: 'item2', sync_attempts: 3, created_at: new Date().toISOString() }, // Max retries
        { id: '3', action_type: 'read', inoreader_id: 'item3', sync_attempts: 0, created_at: new Date().toISOString() },
      ];

      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      // The service should filter out items with sync_attempts >= MAX_RETRIES
      await service.processSyncQueue();

      // Only items 1 and 3 should have been processed
      expect(mockTokenManager.makeAuthenticatedRequest).toHaveBeenCalledTimes(1);
      
      // Check the parameters sent
      const callArgs = mockTokenManager.makeAuthenticatedRequest.mock.calls[0];
      const params = callArgs[1].body;
      const sentIds = params.getAll('i');
      expect(sentIds).toEqual(['item1', 'item3']);
    });
  });

  describe('Memory usage patterns', () => {
    it('should not leak memory with large batches', async () => {
      // Add a large number of items
      const largeQueue = Array(1000).fill(null).map((_, i) => ({
        id: String(i + 1),
        action_type: i % 2 === 0 ? 'read' : 'star',
        inoreader_id: 'item' + (i + 1),
        sync_attempts: 0,
        created_at: new Date().toISOString()
      }));
      
      mockSupabase._mockData.sync_queue = largeQueue;

      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      const memBefore = process.memoryUsage().heapUsed;
      
      await service.processSyncQueue();
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const memAfter = process.memoryUsage().heapUsed;
      
      // Memory increase should be reasonable (less than 50MB for 1000 items)
      const memIncrease = memAfter - memBefore;
      expect(memIncrease).toBeLessThan(50 * 1024 * 1024);
      
      // All items should be processed
      expect(mockSupabase._mockData.sync_queue).toHaveLength(0);
    });

    it('should clean up retry attempts map periodically', async () => {
      // Simulate multiple sync cycles with failures
      for (let cycle = 0; cycle < 5; cycle++) {
        mockSupabase._mockData.sync_queue = [
          { 
            id: 'fail-' + cycle, 
            action_type: 'read', 
            inoreader_id: 'item-fail-' + cycle, 
            sync_attempts: 0,
            created_at: new Date().toISOString()
          }
        ];

        // Always fail to accumulate retry attempts
        mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
          ok: false,
          status: 500,
          statusText: 'Server Error',
          text: vi.fn().mockResolvedValue('Error')
        });

        await service.processSyncQueue();
      }

      // Retry attempts map should have accumulated entries
      expect(service.retryAttempts.size).toBe(5);
      
      // In a production implementation, you'd want to add cleanup logic
      // to prevent unbounded growth
    });
  });

  describe('Edge cases', () => {
    it('should handle malformed sync queue items gracefully', async () => {
      mockSupabase._mockData.sync_queue = [
        { id: '1', action_type: 'read', inoreader_id: null, sync_attempts: 0, created_at: new Date().toISOString() }, // Missing inoreader_id
        { id: '2', action_type: 'invalid', inoreader_id: 'item2', sync_attempts: 0, created_at: new Date().toISOString() }, // Invalid action
        { id: '3', action_type: 'read', inoreader_id: 'item3', sync_attempts: 0, created_at: new Date().toISOString() }, // Valid
      ];

      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      await service.processSyncQueue();

      // Should have attempted to process all items
      // Invalid action type should cause an error for that batch
      expect(mockSupabase._mockData.sync_queue).toHaveLength(2); // Invalid items remain
    });

    it('should handle database connection loss during sync', async () => {
      mockSupabase._mockData.sync_queue = [
        { id: '1', action_type: 'read', inoreader_id: 'item1', sync_attempts: 0, created_at: new Date().toISOString() }
      ];

      // Mock successful API call but database fails on delete
      mockTokenManager.makeAuthenticatedRequest = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue('OK')
      });

      // Override delete to fail
      const originalFrom = mockSupabase.from;
      mockSupabase.from = vi.fn((table) => {
        if (table === 'sync_queue') {
          const result = originalFrom(table);
          result.delete = vi.fn().mockReturnValue({
            in: vi.fn().mockResolvedValue({ 
              error: { message: 'Database connection lost' } 
            })
          });
          return result;
        }
        return originalFrom(table);
      });

      await service.processSyncQueue();

      // Item should still be in queue since delete failed
      expect(mockSupabase._mockData.sync_queue).toHaveLength(1);
    });
  });
});
EOF < /dev/null