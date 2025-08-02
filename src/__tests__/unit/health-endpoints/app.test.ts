import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/app/route';
import { NextRequest } from 'next/server';

// Mock the environment utilities
vi.mock('@/lib/utils/environment', () => ({
  isTestEnvironment: vi.fn(),
  getEnvironmentInfo: vi.fn(),
}));

// Mock the app health check service
vi.mock('@/lib/health/app-health-check', () => ({
  appHealthCheck: {
    checkHealth: vi.fn(),
  },
  AppHealthCheck: {
    logError: vi.fn(),
  },
}));

import { isTestEnvironment, getEnvironmentInfo } from '@/lib/utils/environment';
import { appHealthCheck } from '@/lib/health/app-health-check';

describe('/api/health/app', () => {
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

  it('skips dependency checks in test environment', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(true);
    vi.mocked(appHealthCheck.checkHealth).mockResolvedValue({
      status: 'healthy',
      service: 'rss-reader-app',
      uptime: 100,
      lastActivity: new Date().toISOString(),
      errorCount: 0,
      environment: 'test',
      dependencies: {
        database: 'skipped',
        oauth: 'skipped',
      },
      performance: {
        avgSyncTime: 0,
        avgDbQueryTime: 0,
        avgApiCallTime: 0,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/health/app');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      service: 'rss-reader-app',
      environment: 'test',
      dependencies: {
        database: 'skipped',
        oauth: 'skipped',
      },
      uptime: expect.any(Number),
      timestamp: expect.any(String),
    });
  });

  it('returns 200 with minimal health data in test mode', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(true);
    vi.mocked(appHealthCheck.checkHealth).mockResolvedValue({
      status: 'healthy',
      service: 'rss-reader-app',
      uptime: 100,
      lastActivity: new Date().toISOString(),
      errorCount: 0,
      environment: 'test',
      dependencies: {
        database: 'skipped',
        oauth: 'skipped',
      },
      performance: {
        avgSyncTime: 0,
        avgDbQueryTime: 0,
        avgApiCallTime: 0,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/health/app');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.uptime).toBeGreaterThan(0);
    expect(data.dependencies.database).toBe('skipped');
    expect(data.dependencies.oauth).toBe('skipped');
  });

  it('includes environment field in response', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(true);
    vi.mocked(appHealthCheck.checkHealth).mockResolvedValue({
      status: 'healthy',
      service: 'rss-reader-app',
      uptime: 100,
      lastActivity: new Date().toISOString(),
      errorCount: 0,
      environment: 'test',
      dependencies: {
        database: 'skipped',
        oauth: 'skipped',
      },
      performance: {
        avgSyncTime: 0,
        avgDbQueryTime: 0,
        avgApiCallTime: 0,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/health/app');
    const response = await GET(request);
    const data = await response.json();
    expect(data.environment).toBe('test');
  });

  it('checks dependencies in production environment', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    vi.mocked(appHealthCheck.checkHealth).mockResolvedValue({
      status: 'healthy',
      service: 'rss-reader-app',
      uptime: 100,
      lastActivity: new Date().toISOString(),
      errorCount: 0,
      environment: 'production',
      dependencies: {
        database: 'healthy',
        oauth: 'healthy',
      },
      performance: {
        avgSyncTime: 100,
        avgDbQueryTime: 50,
        avgApiCallTime: 150,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/health/app');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      environment: 'production',
      dependencies: {
        database: 'healthy',
        oauth: 'healthy',
      },
    });
  });

  it('reports unhealthy when dependencies fail in production', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    vi.mocked(appHealthCheck.checkHealth).mockResolvedValue({
      status: 'unhealthy',
      service: 'rss-reader-app',
      uptime: 100,
      lastActivity: new Date().toISOString(),
      errorCount: 5,
      environment: 'production',
      dependencies: {
        database: 'unhealthy',
        oauth: 'healthy',
      },
      performance: {
        avgSyncTime: 0,
        avgDbQueryTime: 0,
        avgApiCallTime: 0,
      },
    });

    const request = new NextRequest('http://localhost:3000/api/health/app');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      status: 'unhealthy',
      environment: 'production',
      dependencies: {
        database: 'unhealthy',
        oauth: 'healthy',
      },
    });
  });

  it('handles health check service errors gracefully', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    vi.mocked(appHealthCheck.checkHealth).mockRejectedValue(new Error('Service unavailable'));

    const request = new NextRequest('http://localhost:3000/api/health/app');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      status: 'unhealthy',
      error: 'Service unavailable',
      timestamp: expect.any(String),
    });
  });
});