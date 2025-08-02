import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/freshness/route';
import { NextRequest } from 'next/server';

// Mock the environment utilities
vi.mock('@/lib/utils/environment', () => ({
  isTestEnvironment: vi.fn(),
  getEnvironmentInfo: vi.fn(),
}));

// Mock Supabase
vi.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: vi.fn(),
    rpc: vi.fn(),
  },
}));

import { isTestEnvironment, getEnvironmentInfo } from '@/lib/utils/environment';
import { supabase } from '@/lib/db/supabase';

describe('/api/health/freshness', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'test',
      isTest: true,
      hasDatabase: false,
      runtime: 'vitest',
      timestamp: '2025-08-02T06:00:00.000Z',
    });
  });

  it('returns 200 with mock data when database unavailable in test environment', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/health/freshness');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      message: 'Freshness check skipped in test environment',
      environment: 'test',
      data: {
        latestArticleTime: null,
        hoursSinceLatest: null,
        articlesLast24h: 0,
        totalArticles: 0,
      },
      timestamp: expect.any(String),
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('returns 503 for real freshness issues in production', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    const mockError = new Error('Database connection failed');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockRejectedValue(mockError),
        }),
      }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/health/freshness');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      status: 'error',
      message: 'Failed to check article freshness',
      error: 'Database connection failed',
      environment: 'production',
    });
  });

  it('includes environment field in all responses', async () => {
    // Test environment case
    vi.mocked(isTestEnvironment).mockReturnValue(true);
    let request = new NextRequest('http://localhost:3000/api/health/freshness');
    let response = await GET(request);
    let data = await response.json();
    expect(data.environment).toBe('test');

    // Production success case
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    const mockLatestArticle = {
      published_at: new Date().toISOString(),
    };
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [mockLatestArticle], error: null }),
        }),
      }),
    } as any);
    vi.mocked(supabase.rpc).mockResolvedValue({ data: [{ count: 100 }], error: null });

    request = new NextRequest('http://localhost:3000/api/health/freshness');
    response = await GET(request);
    data = await response.json();
    expect(data.environment).toBe('production');
  });

  it('returns healthy status with fresh articles in production', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    const latestTime = new Date();
    const mockLatestArticle = {
      published_at: latestTime.toISOString(),
    };
    
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [mockLatestArticle], error: null }),
        }),
      }),
    } as any);
    
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: [{ count: 50 }], error: null }) // articles last 24h
      .mockResolvedValueOnce({ data: [{ count: 1000 }], error: null }); // total articles

    const request = new NextRequest('http://localhost:3000/api/health/freshness');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      message: 'Articles are fresh',
      environment: 'production',
      data: {
        latestArticleTime: latestTime.toISOString(),
        hoursSinceLatest: 0,
        articlesLast24h: 50,
        totalArticles: 1000,
      },
    });
  });

  it('returns unhealthy when articles are stale in production', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    // Article from 3 days ago
    const staleTime = new Date(Date.now() - 72 * 60 * 60 * 1000);
    const mockLatestArticle = {
      published_at: staleTime.toISOString(),
    };
    
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [mockLatestArticle], error: null }),
        }),
      }),
    } as any);
    
    vi.mocked(supabase.rpc)
      .mockResolvedValueOnce({ data: [{ count: 0 }], error: null }) // no articles last 24h
      .mockResolvedValueOnce({ data: [{ count: 1000 }], error: null }); // total articles

    const request = new NextRequest('http://localhost:3000/api/health/freshness');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      status: 'stale',
      message: expect.stringContaining('No new articles in the last'),
      environment: 'production',
      data: {
        latestArticleTime: staleTime.toISOString(),
        hoursSinceLatest: 72,
        articlesLast24h: 0,
        totalArticles: 1000,
      },
    });
  });
});