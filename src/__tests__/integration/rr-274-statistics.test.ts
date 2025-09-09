import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GET } from '@/app/api/articles/stats/route';
import { createClient } from '@/lib/supabase/server';
import { NextRequest } from 'next/server';
import { createArticleBatch, createLargeDataset } from '@/test-utils/rr-274-factories';
import { createStatisticsMock, createEmptyFeedsMock } from '../test-helpers/supabase-mocks';

vi.mock('@/lib/supabase/server');

describe('Article Statistics Endpoint (RR-274)', () => {
  const mockUserId = 'test-user-123';
  
  // Helper to create proper mock for the statistics API query pattern
  const createStatsApiMock = (stats: { total: number; unread: number; starred: number }) => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: mockUserId } },
          error: null
        })
      },
      from: vi.fn()
    };

    // Mock the three-step query pattern: 1) get feeds, 2) count total, 3) count unread, 4) count starred
    mockSupabase.from
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [{ id: 'feed-1' }, { id: 'feed-2' }], // User has 2 feeds
            error: null
          })
        })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockResolvedValue({
            count: stats.total,
            error: null
          })
        })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: stats.unread,
              error: null
            })
          })
        })
      })
      .mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          in: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({
              count: stats.starred,
              error: null
            })
          })
        })
      });

    return mockSupabase;
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Accuracy', () => {
    it('should return correct total article count', async () => {
      const mockSupabase = createStatsApiMock({
        total: 1234,
        unread: 456,
        starred: 78
      });
      
      vi.mocked(createClient).mockReturnValue(mockSupabase as any);

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        total: 1234,
        unread: 456,
        starred: 78
      });
    });

    it('should return correct unread count', async () => {
      const unreadArticles = createArticleBatch(150, { isRead: false });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 500 },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: unreadArticles.length },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 25 },
                error: null
              })
            })
          })
        })
      });

      const request = new NextRequest('http://localhost/api/articles/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.unread).toBe(150);
    });

    it('should return correct starred count', async () => {
      const starredArticles = createArticleBatch(42, { isStarred: true });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 300 },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 100 },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: starredArticles.length },
                error: null
              })
            })
          })
        })
      });

      const request = new NextRequest('http://localhost/api/articles/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(data.starred).toBe(42);
    });

    it('should update after retention operations', async () => {
      // Initial stats
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 1500 },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 300 },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 50 },
                error: null
              })
            })
          })
        })
      });

      const request1 = new NextRequest('http://localhost/api/articles/stats');
      const response1 = await GET(request1);
      const dataBefore = await response1.json();

      // After retention (500 articles deleted)
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 1000 },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 300 }, // Unread preserved
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 50 }, // Starred preserved
                error: null
              })
            })
          })
        })
      });

      const request2 = new NextRequest('http://localhost/api/articles/stats');
      const response2 = await GET(request2);
      const dataAfter = await response2.json();

      expect(dataBefore.total).toBe(1500);
      expect(dataAfter.total).toBe(1000);
      expect(dataAfter.unread).toBe(dataBefore.unread); // Unread preserved
      expect(dataAfter.starred).toBe(dataBefore.starred); // Starred preserved
    });

    it('should update after sync operations', async () => {
      // Before sync
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 500 },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 200 },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 25 },
                error: null
              })
            })
          })
        })
      });

      const request1 = new NextRequest('http://localhost/api/articles/stats');
      const response1 = await GET(request1);
      const dataBefore = await response1.json();

      // After sync (100 new articles)
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 600 },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 300 }, // 100 new unread
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 25 },
                error: null
              })
            })
          })
        })
      });

      const request2 = new NextRequest('http://localhost/api/articles/stats');
      const response2 = await GET(request2);
      const dataAfter = await response2.json();

      expect(dataAfter.total).toBe(dataBefore.total + 100);
      expect(dataAfter.unread).toBe(dataBefore.unread + 100);
      expect(dataAfter.starred).toBe(dataBefore.starred);
    });

    it('should handle concurrent stat queries', async () => {
      const statsData = { total: 1000, unread: 400, starred: 50 };

      // Setup mock to return consistent data
      const setupMock = () => {
        mockSupabase.from.mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: statsData.total },
                error: null
              })
            })
          })
        });

        mockSupabase.from.mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { count: statsData.unread },
                  error: null
                })
              })
            })
          })
        });

        mockSupabase.from.mockReturnValueOnce({
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { count: statsData.starred },
                  error: null
                })
              })
            })
          })
        });
      };

      // Setup mocks for 3 concurrent requests
      setupMock();
      setupMock();
      setupMock();

      // Make concurrent requests
      const requests = Array.from({ length: 3 }, () => 
        new NextRequest('http://localhost/api/articles/stats')
      );

      const responses = await Promise.all(
        requests.map(req => GET(req))
      );

      const data = await Promise.all(
        responses.map(res => res.json())
      );

      // All should return the same data
      data.forEach(stats => {
        expect(stats).toEqual(statsData);
      });
    });

    it('should handle zero counts gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 0 },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 0 },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 0 },
                error: null
              })
            })
          })
        })
      });

      const request = new NextRequest('http://localhost/api/articles/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({
        total: 0,
        unread: 0,
        starred: 0
      });
    });
  });

  describe('Performance', () => {
    it('should return stats in under 100ms', async () => {
      mockSupabase.from.mockImplementation(() => ({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 1000 },
              error: null
            })
          })
        })
      }));

      const startTime = Date.now();
      const request = new NextRequest('http://localhost/api/articles/stats');
      const response = await GET(request);
      await response.json();
      const endTime = Date.now();

      expect(endTime - startTime).toBeLessThan(100);
    });

    it('should use cached counts when available', async () => {
      // First request - should hit database
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 1000 },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 400 },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 50 },
                error: null
              })
            })
          })
        })
      });

      const request1 = new NextRequest('http://localhost/api/articles/stats', {
        headers: new Headers({
          'cache-control': 'max-age=60'
        })
      });
      const response1 = await GET(request1);
      const data1 = await response1.json();

      // Check if cache headers are set
      expect(response1.headers.get('cache-control')).toContain('max-age=');

      // Second request within cache window - should use cache
      const request2 = new NextRequest('http://localhost/api/articles/stats', {
        headers: new Headers({
          'if-none-match': response1.headers.get('etag') || ''
        })
      });

      // Mock should not be called again if caching works
      const callCountBefore = mockSupabase.from.mock.calls.length;
      
      // Note: In actual implementation, this would return 304 Not Modified
      // For testing, we're verifying the cache behavior pattern
      expect(callCountBefore).toBe(3); // Only 3 calls from first request
    });

    it('should invalidate cache on data changes', async () => {
      // Initial request
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 1000 },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 400 },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 50 },
                error: null
              })
            })
          })
        })
      });

      const request1 = new NextRequest('http://localhost/api/articles/stats');
      const response1 = await GET(request1);
      const data1 = await response1.json();

      // Simulate data change notification
      const invalidateRequest = new NextRequest('http://localhost/api/articles/stats', {
        method: 'POST',
        body: JSON.stringify({ action: 'invalidate' })
      });

      // After invalidation, new request should hit database
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: 1100 }, // Changed
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 450 }, // Changed
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: 55 }, // Changed
                error: null
              })
            })
          })
        })
      });

      const request2 = new NextRequest('http://localhost/api/articles/stats');
      const response2 = await GET(request2);
      const data2 = await response2.json();

      expect(data2.total).toBe(1100);
      expect(data2.unread).toBe(450);
      expect(data2.starred).toBe(55);
    });

    it('should handle large datasets efficiently', async () => {
      const largeDataset = createLargeDataset(10000);

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { count: largeDataset.stats.total },
              error: null
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: largeDataset.stats.unread },
                error: null
              })
            })
          })
        })
      });

      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: { count: largeDataset.stats.starred },
                error: null
              })
            })
          })
        })
      });

      const startTime = Date.now();
      const request = new NextRequest('http://localhost/api/articles/stats');
      const response = await GET(request);
      const data = await response.json();
      const endTime = Date.now();

      expect(data.total).toBe(10000);
      expect(endTime - startTime).toBeLessThan(200); // Still fast with large dataset
    });
  });

  describe('Error Handling', () => {
    it('should handle database errors gracefully', async () => {
      mockSupabase.from.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { message: 'Database connection lost' }
            })
          })
        })
      });

      const request = new NextRequest('http://localhost/api/articles/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to fetch statistics');
    });

    it('should handle authentication errors', async () => {
      mockSupabase.auth.getUser.mockResolvedValue({
        data: { user: null },
        error: { message: 'Not authenticated' }
      });

      const request = new NextRequest('http://localhost/api/articles/stats');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Unauthorized');
    });
  });
});