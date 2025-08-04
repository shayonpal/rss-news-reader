import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '@/app/api/health/cron/route';
import { NextRequest } from 'next/server';
import * as fs from 'fs/promises';

// Mock the environment utilities
vi.mock('@/lib/utils/environment', () => ({
  isTestEnvironment: vi.fn(),
  getEnvironmentInfo: vi.fn(),
}));

// Mock fs/promises
vi.mock('fs/promises', () => ({
  default: {
    readFile: vi.fn(),
    access: vi.fn(),
  },
  readFile: vi.fn(),
  access: vi.fn(),
}));

import { isTestEnvironment, getEnvironmentInfo } from '@/lib/utils/environment';

describe('/api/health/cron', () => {
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

  it('returns 200 with "Cron health check skipped" when log file missing in test environment', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/health/cron');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      message: 'Cron health check skipped in test environment',
      environment: 'test',
      lastCheck: null,
      timestamp: expect.any(String),
    });
    expect(response.headers.get('Cache-Control')).toBe('no-store, max-age=0');
  });

  it('returns 503 for real cron failures in production', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    // Mock file not found
    vi.mocked(fs.readFile).mockRejectedValue(new Error('ENOENT: no such file or directory'));

    const request = new NextRequest('http://localhost:3000/api/health/cron');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      status: 'unknown',
      message: 'Health file not found',
      environment: 'production',
      lastCheck: null,
    });
  });

  it('includes environment field in all responses', async () => {
    // Test environment case
    vi.mocked(isTestEnvironment).mockReturnValue(true);
    let request = new NextRequest('http://localhost:3000/api/health/cron');
    let response = await GET(request);
    let data = await response.json();
    expect(data.environment).toBe('test');

    // Production case with valid health file
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    const mockHealthData = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      message: 'Sync completed successfully',
    };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockHealthData));

    request = new NextRequest('http://localhost:3000/api/health/cron');
    response = await GET(request);
    data = await response.json();
    expect(data.environment).toBe('production');
  });

  it('returns healthy status when cron is running properly in production', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    const lastCheckTime = new Date();
    const mockHealthData = {
      status: 'healthy',
      timestamp: lastCheckTime.toISOString(),
      message: 'Sync completed successfully',
    };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockHealthData));

    const request = new NextRequest('http://localhost:3000/api/health/cron');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      status: 'healthy',
      message: 'Sync completed successfully',
      environment: 'production',
      lastCheck: lastCheckTime.toISOString(),
    });
  });

  it('returns unhealthy when cron check is stale in production', async () => {
    vi.mocked(isTestEnvironment).mockReturnValue(false);
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-02T06:00:00.000Z',
    });

    // Mock health file with stale timestamp (25 hours ago)
    const staleTime = new Date(Date.now() - 25 * 60 * 60 * 1000);
    const mockHealthData = {
      status: 'healthy',
      timestamp: staleTime.toISOString(),
      message: 'Sync completed successfully',
    };
    vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockHealthData));

    const request = new NextRequest('http://localhost:3000/api/health/cron');
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data).toMatchObject({
      status: 'unhealthy',
      message: expect.stringContaining('Last check was'),
      environment: 'production',
      lastCheck: staleTime.toISOString(),
    });
  });
});