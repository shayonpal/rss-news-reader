/**
 * Supabase mock helpers for RR-274 tests
 * Provides realistic mock patterns that match the actual implementation
 */

import { vi } from 'vitest';

/**
 * Create a Supabase mock that matches the statistics API pattern:
 * 1. Get user feeds first
 * 2. Count articles using .in(feed_id, feedIds) 
 */
export function createStatisticsMock(stats: {
  feeds: Array<{ id: string }>;
  total: number;
  unread: number;
  starred: number;
}) {
  const mockSupabase = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null
      })
    }
  };

  // Mock the query pattern used by the statistics API
  mockSupabase.from
    .mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: stats.feeds,
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
}

/**
 * Create a mock for article retention that matches the implementation pattern
 */
export function createRetentionMock(data: {
  totalCount: number;
  starredCount: number;
  articlesToDelete: Array<{ id: string }>;
  deleteSuccess: boolean;
}) {
  const mockSupabase = {
    from: vi.fn(),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null
      })
    }
  };

  // Mock the pattern: get feeds, count articles, select articles to delete, delete them
  mockSupabase.from
    // Get user feeds
    .mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [{ id: 'feed-1' }, { id: 'feed-2' }],
          error: null
        })
      })
    })
    // Count total articles
    .mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          count: data.totalCount,
          error: null
        })
      })
    })
    // Count starred articles
    .mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            count: data.starredCount,
            error: null
          })
        })
      })
    })
    // Select articles to delete
    .mockReturnValueOnce({
      select: vi.fn().mockReturnValue({
        in: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue({
                data: data.articlesToDelete,
                error: null
              })
            })
          })
        })
      })
    })
    // Delete articles
    .mockReturnValueOnce({
      delete: vi.fn().mockReturnValue({
        in: vi.fn().mockResolvedValue({
          error: data.deleteSuccess ? null : { message: 'Delete failed' }
        })
      })
    });

  return mockSupabase;
}

/**
 * Simple mock for cases where no feeds exist (should return zero counts)
 */
export function createEmptyFeedsMock() {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({
          data: [], // No feeds
          error: null
        })
      })
    }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'test-user-123' } },
        error: null
      })
    }
  };
}