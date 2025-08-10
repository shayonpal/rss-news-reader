import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET } from '@/app/api/sync/last-sync/route';
import * as fs from 'fs/promises';

// Mock Supabase
const mockSupabaseClient = {
  from: vi.fn()
};

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockSupabaseClient)
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
  },
  readFile: vi.fn(),
}));

describe('RR-177: /api/sync/last-sync Cache Prevention', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset environment variables
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-key';
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  /**
   * Helper function to verify cache prevention headers
   */
  const verifyCacheHeaders = (response: Response) => {
    expect(response.headers.get('Cache-Control')).toBe('no-store, no-cache, must-revalidate');
    expect(response.headers.get('Pragma')).toBe('no-cache');
    expect(response.headers.get('Expires')).toBe('0');
  };

  describe('1. Cache Headers Presence Tests', () => {
    it('1.1: should include cache headers when returning sync_metadata source', async () => {
      // Setup: Mock sync_metadata returns valid data
      const mockSyncTime = '2025-08-10T10:00:00.000Z';
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { value: mockSyncTime, updated_at: mockSyncTime }
                }))
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: null }))
              }))
            }))
          }))
        };
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      verifyCacheHeaders(response);
      expect(data).toEqual({
        lastSyncTime: mockSyncTime,
        source: 'sync_metadata'
      });
    });

    it('1.2: should include cache headers when returning sync_status source', async () => {
      // Setup: sync_metadata returns null, sync_status returns valid data
      const mockSyncTime = '2025-08-10T09:00:00.000Z';
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null }))
              }))
            }))
          };
        }
        if (table === 'sync_status') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({
                    data: [{
                      completed_at: mockSyncTime,
                      updated_at: mockSyncTime,
                      status: 'completed'
                    }]
                  }))
                }))
              }))
            }))
          };
        }
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      verifyCacheHeaders(response);
      expect(data).toEqual({
        lastSyncTime: mockSyncTime,
        source: 'sync_status'
      });
    });

    it('1.3: should include cache headers when returning sync-log source', async () => {
      // Setup: Both database sources return null, log file has valid entry
      const mockSyncTime = '2025-08-10T08:00:00.000Z';
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: null }))
            }))
          }))
        }))
      });

      const logEntry = {
        status: 'completed',
        timestamp: mockSyncTime
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(logEntry));

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      verifyCacheHeaders(response);
      expect(data).toEqual({
        lastSyncTime: mockSyncTime,
        source: 'sync-log'
      });
    });

    it('1.4: should include cache headers when no sync data found', async () => {
      // Setup: All sources return null/empty
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: null }))
            }))
          }))
        }))
      });
      vi.mocked(fs.readFile).mockResolvedValue('');

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      verifyCacheHeaders(response);
      expect(data).toEqual({
        lastSyncTime: null,
        source: 'none'
      });
    });

    it('1.5: should include cache headers on error response', async () => {
      // Setup: Database connection throws error
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Database connection failed');
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      verifyCacheHeaders(response);
      expect(data).toEqual({
        error: 'Failed to fetch last sync time'
      });
    });
  });

  describe('2. Data Source Priority Tests', () => {
    it('2.1: sync_metadata should take priority over sync_status', async () => {
      const metadataTime = '2025-08-10T10:00:00.000Z';
      const statusTime = '2025-08-10T09:00:00.000Z';

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { value: metadataTime }
                }))
              }))
            }))
          };
        }
        if (table === 'sync_status') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({
                    data: [{ completed_at: statusTime }]
                  }))
                }))
              }))
            }))
          };
        }
      });

      const response = await GET();
      const data = await response.json();

      expect(data.lastSyncTime).toBe(metadataTime);
      expect(data.source).toBe('sync_metadata');
      verifyCacheHeaders(response);
    });

    it('2.2: sync_status should take priority over log file', async () => {
      const statusTime = '2025-08-10T09:00:00.000Z';
      const logTime = '2025-08-10T08:00:00.000Z';

      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null }))
              }))
            }))
          };
        }
        if (table === 'sync_status') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({
                    data: [{ completed_at: statusTime, status: 'completed' }]
                  }))
                }))
              }))
            }))
          };
        }
      });

      vi.mocked(fs.readFile).mockResolvedValue(
        JSON.stringify({ status: 'completed', timestamp: logTime })
      );

      const response = await GET();
      const data = await response.json();

      expect(data.lastSyncTime).toBe(statusTime);
      expect(data.source).toBe('sync_status');
      verifyCacheHeaders(response);
    });
  });

  describe('3. Fresh Data Verification Tests', () => {
    it('3.1: Multiple sequential requests should return fresh data', async () => {
      // First request setup
      const firstTime = '2025-08-10T10:00:00.000Z';
      mockSupabaseClient.from.mockImplementationOnce((table: string) => {
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { value: firstTime }
                }))
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: null }))
              }))
            }))
          }))
        };
      });

      const response1 = await GET();
      const data1 = await response1.json();
      expect(data1.lastSyncTime).toBe(firstTime);
      verifyCacheHeaders(response1);

      // Second request setup - different time
      const secondTime = '2025-08-10T11:00:00.000Z';
      mockSupabaseClient.from.mockImplementationOnce((table: string) => {
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { value: secondTime }
                }))
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: null }))
              }))
            }))
          }))
        };
      });

      const response2 = await GET();
      const data2 = await response2.json();
      expect(data2.lastSyncTime).toBe(secondTime);
      verifyCacheHeaders(response2);

      // Verify different responses (not cached)
      expect(data1.lastSyncTime).not.toBe(data2.lastSyncTime);
    });

    it('3.2: Response should not be cacheable by browser', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({
              data: { value: '2025-08-10T10:00:00.000Z' }
            }))
          }))
        }))
      });

      const response = await GET();

      // Verify headers that prevent caching
      expect(response.headers.get('Cache-Control')).toContain('no-store');
      expect(response.headers.get('Cache-Control')).toContain('no-cache');
      expect(response.headers.get('Cache-Control')).toContain('must-revalidate');
      expect(response.headers.get('Pragma')).toBe('no-cache');
      expect(response.headers.get('Expires')).toBe('0');

      // These headers should prevent 304 Not Modified responses
      expect(response.headers.get('ETag')).toBeNull();
      expect(response.headers.get('Last-Modified')).toBeNull();
    });
  });

  describe('4. Edge Cases', () => {
    it('4.1: should handle invalid date in sync_metadata', async () => {
      mockSupabaseClient.from.mockImplementation((table: string) => {
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { value: 'invalid-date-string' }
                }))
              }))
            }))
          };
        }
        if (table === 'sync_status') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn(() => Promise.resolve({
                    data: [{
                      completed_at: '2025-08-10T09:00:00.000Z',
                      status: 'completed'
                    }]
                  }))
                }))
              }))
            }))
          };
        }
      });

      const response = await GET();
      const data = await response.json();

      // Should fall back to sync_status due to invalid date
      expect(data.source).toBe('sync_status');
      expect(data.lastSyncTime).toBe('2025-08-10T09:00:00.000Z');
      verifyCacheHeaders(response);
    });

    it('4.2: should handle malformed JSON in log file', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: null }))
            }))
          }))
        }))
      });

      const logContent = `invalid json line
{"status": "completed", "timestamp": "2025-08-10T08:00:00.000Z"}
another invalid line`;

      vi.mocked(fs.readFile).mockResolvedValue(logContent);

      const response = await GET();
      const data = await response.json();

      expect(data.lastSyncTime).toBe('2025-08-10T08:00:00.000Z');
      expect(data.source).toBe('sync-log');
      verifyCacheHeaders(response);
    });

    it('4.3: should handle empty log file', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: null }))
            }))
          }))
        }))
      });

      vi.mocked(fs.readFile).mockResolvedValue('');

      const response = await GET();
      const data = await response.json();

      expect(data.lastSyncTime).toBeNull();
      expect(data.source).toBe('none');
      verifyCacheHeaders(response);
    });

    it('4.4: should handle missing log file', async () => {
      mockSupabaseClient.from.mockReturnValue({
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            single: vi.fn(() => Promise.resolve({ data: null })),
            order: vi.fn(() => ({
              limit: vi.fn(() => Promise.resolve({ data: null }))
            }))
          }))
        }))
      });

      vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file'));

      const response = await GET();
      const data = await response.json();

      expect(data.lastSyncTime).toBeNull();
      expect(data.source).toBe('none');
      verifyCacheHeaders(response);
    });
  });

  describe('5. Database Error Handling', () => {
    it('5.1: should handle Supabase connection timeout', async () => {
      mockSupabaseClient.from.mockImplementation(() => {
        throw new Error('Connection timeout');
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to fetch last sync time');
      verifyCacheHeaders(response);
    });

    it('5.2: should handle partial database failure', async () => {
      let callCount = 0;
      mockSupabaseClient.from.mockImplementation((table: string) => {
        callCount++;
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({ data: null }))
              }))
            }))
          };
        }
        if (table === 'sync_status' && callCount === 2) {
          throw new Error('sync_status query failed');
        }
      });

      const logEntry = {
        status: 'completed',
        timestamp: '2025-08-10T08:00:00.000Z'
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(logEntry));

      const response = await GET();
      const data = await response.json();

      // Should fall back to log file after database error
      expect(data.lastSyncTime).toBe('2025-08-10T08:00:00.000Z');
      expect(data.source).toBe('sync-log');
      verifyCacheHeaders(response);
    });
  });

  describe('Integration Test Scenarios', () => {
    it('should prevent "18 hours ago" stale cache issue', async () => {
      // Simulate the bug scenario: first request returns old time
      const oldTime = new Date(Date.now() - 18 * 60 * 60 * 1000).toISOString();
      mockSupabaseClient.from.mockImplementationOnce((table: string) => {
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { value: oldTime }
                }))
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: null }))
              }))
            }))
          }))
        };
      });

      const response1 = await GET();
      const data1 = await response1.json();

      // Verify cache prevention headers are present
      verifyCacheHeaders(response1);

      // Simulate sync occurred, now returns recent time
      const newTime = new Date().toISOString();
      mockSupabaseClient.from.mockImplementationOnce((table: string) => {
        if (table === 'sync_metadata') {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                single: vi.fn(() => Promise.resolve({
                  data: { value: newTime }
                }))
              }))
            }))
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              order: vi.fn(() => ({
                limit: vi.fn(() => Promise.resolve({ data: null }))
              }))
            }))
          }))
        };
      });

      const response2 = await GET();
      const data2 = await response2.json();

      // Verify second request gets fresh data (not cached old time)
      expect(data2.lastSyncTime).toBe(newTime);
      expect(data2.lastSyncTime).not.toBe(oldTime);
      verifyCacheHeaders(response2);
    });
  });
});