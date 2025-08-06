import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { POST } from '@/app/api/sync/route';
import { getAdminClient } from '@/lib/db/supabase-admin';

// Create a test to verify that the sync route ACTUALLY includes author field
describe('RR-142: Integration test for author field extraction', () => {
  let mockSupabase: any;
  let capturedUpsertData: any[] = [];

  beforeEach(() => {
    // Clear captured data
    capturedUpsertData = [];

    // Mock the token manager
    vi.mock('../../../../server/lib/token-manager.js', () => {
      return {
        default: vi.fn().mockImplementation(() => ({
          getAccessToken: vi.fn().mockResolvedValue('mock-token'),
          makeAuthenticatedRequest: vi.fn().mockImplementation((url) => {
            if (url.includes('subscription/list')) {
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                  subscriptions: [{
                    id: 'feed/http://example.com/feed',
                    title: 'Example Feed',
                    url: 'http://example.com/feed',
                    categories: []
                  }]
                })
              });
            }
            if (url.includes('unread-count')) {
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                  unreadcounts: []
                })
              });
            }
            if (url.includes('stream/contents')) {
              return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({
                  items: [{
                    id: 'tag:google.com,2005:reader/item/test123',
                    title: 'Article with Author',
                    author: 'Jane Doe',  // This is the important field!
                    content: { content: 'Test content' },
                    canonical: [{ href: 'http://example.com/article' }],
                    published: Math.floor(Date.now() / 1000),
                    categories: [],
                    origin: { streamId: 'feed/http://example.com/feed' }
                  }, {
                    id: 'tag:google.com,2005:reader/item/test456',
                    title: 'Article without Author',
                    // No author field
                    content: { content: 'Test content 2' },
                    canonical: [{ href: 'http://example.com/article2' }],
                    published: Math.floor(Date.now() / 1000),
                    categories: [],
                    origin: { streamId: 'feed/http://example.com/feed' }
                  }]
                })
              });
            }
            return Promise.resolve({
              ok: false,
              statusText: 'Not Found'
            });
          })
        }))
      };
    });

    // Mock Supabase to capture what gets upserted
    mockSupabase = {
      from: vi.fn((table: string) => {
        if (table === 'articles') {
          return {
            upsert: vi.fn((data: any) => {
              // Capture the data that would be upserted
              capturedUpsertData.push(...(Array.isArray(data) ? data : [data]));
              return Promise.resolve({ data: null, error: null });
            })
          };
        }
        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              single: vi.fn().mockResolvedValue({
                data: table === 'users' ? { id: 'user-123' } : null
              })
            }))
          })),
          upsert: vi.fn().mockResolvedValue({ data: null, error: null }),
          delete: vi.fn().mockResolvedValue({ data: null, error: null }),
          insert: vi.fn().mockResolvedValue({ data: null, error: null })
        };
      }),
      rpc: vi.fn().mockResolvedValue({ data: null, error: null })
    };

    // Mock the getAdminClient function
    vi.mock('@/lib/db/supabase-admin', () => ({
      getAdminClient: vi.fn(() => mockSupabase)
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('should include author field when syncing articles from Inoreader', async () => {
    // Call the sync endpoint
    const response = await POST();
    const data = await response.json();

    // Verify the sync started successfully
    expect(data.success).toBe(true);
    expect(data.syncId).toBeDefined();

    // Wait a bit for async processing
    await new Promise(resolve => setTimeout(resolve, 100));

    // Check that articles were upserted with author field
    const articlesUpserted = capturedUpsertData.filter(item => 
      item.hasOwnProperty('inoreader_id')
    );

    expect(articlesUpserted.length).toBeGreaterThan(0);
    
    // Find the article with author
    const articleWithAuthor = articlesUpserted.find(a => 
      a.inoreader_id === 'tag:google.com,2005:reader/item/test123'
    );
    
    // This test will FAIL until we implement the fix
    expect(articleWithAuthor).toBeDefined();
    expect(articleWithAuthor?.author).toBe('Jane Doe');
    
    // Find the article without author
    const articleWithoutAuthor = articlesUpserted.find(a => 
      a.inoreader_id === 'tag:google.com,2005:reader/item/test456'
    );
    
    expect(articleWithoutAuthor).toBeDefined();
    expect(articleWithoutAuthor?.author).toBeNull();
  });
});