import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/db/route';
import { NextRequest } from 'next/server';

// Mock the environment utilities
vi.mock('@/lib/utils/environment', () => ({
  isTestEnvironment: vi.fn(),
  getEnvironmentInfo: vi.fn(),
}));

// Mock Supabase
vi.mock('@/lib/db/supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    }),
  },
}));

import { isTestEnvironment, getEnvironmentInfo } from '@/lib/utils/environment';
import { supabase } from '@/lib/db/supabase';

describe('/api/health/db', () => {
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

  it('returns 200 with database:unavailable in test environment', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/health/db');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      database: 'unavailable',
      message: 'Database health check skipped in test environment',
      environment: 'test',
      timestamp: expect.any(String),
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('returns 503 with real database errors in production', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    const mockError = new Error('Connection refused');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockRejectedValue(mockError),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/health/db');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      status: 'unhealthy',
      database: 'error',
      message: 'Database query failed',
      error: 'Connection refused',
      environment: 'production',
    });
  });

  it('includes environment field in all responses', async () => {
    // Test environment case
    vi.mocked(isTestEnvironment).mockReturnValue(true);
    let request = new NextRequest('http://localhost:3000/api/health/db');
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
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ count: 1 }], error: null }),
    } as any);

    request = new NextRequest('http://localhost:3000/api/health/db');
    response = await GET(request);
    data = await response.json();
    expect(data.environment).toBe('production');
  });

  it('returns healthy status with real database connection in production', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn().mockResolvedValue({ data: [{ count: 1 }], error: null }),
    } as any);

    const request = new NextRequest('http://localhost:3000/api/health/db');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      database: 'connected',
      environment: 'production',
      queryTime: expect.any(Number),
    });
  });
});