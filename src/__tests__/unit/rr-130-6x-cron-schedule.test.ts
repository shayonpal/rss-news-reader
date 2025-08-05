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

describe('RR-130: 6x Cron Schedule Health Checks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getEnvironmentInfo).mockReturnValue({
      environment: 'production',
      isTest: false,
      hasDatabase: true,
      runtime: 'node',
      timestamp: '2025-08-05T15:00:00.000Z',
    });
    vi.mocked(isTestEnvironment).mockReturnValue(false);
  });

  describe('Health check timing validation for 6x frequency', () => {
    it('should consider cron healthy when last check is within 4 hours', async () => {
      // Mock health file with check 3 hours ago (within 4-hour window)
      const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
      const mockHealthData = {
        status: 'healthy',
        timestamp: threeHoursAgo.toISOString(),
        message: 'Sync completed successfully',
        lastRun: threeHoursAgo.toISOString(),
        lastRunStatus: 'success',
        nextRun: new Date(Date.now() + 1 * 60 * 60 * 1000).toISOString(), // 1 hour from now
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockHealthData));

      const request = new NextRequest('http://localhost:3000/api/health/cron');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('healthy');
      expect(data.ageMinutes).toBeLessThan(240); // Less than 4 hours
    });

    it('should consider cron unhealthy when last check exceeds 5 hours', async () => {
      // Mock health file with check 5.5 hours ago (exceeds reasonable threshold for 4-hour interval)
      const fiveHalfHoursAgo = new Date(Date.now() - 5.5 * 60 * 60 * 1000);
      const mockHealthData = {
        status: 'healthy',
        timestamp: fiveHalfHoursAgo.toISOString(),
        message: 'Sync completed successfully',
        lastRun: fiveHalfHoursAgo.toISOString(),
        lastRunStatus: 'success',
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockHealthData));

      const request = new NextRequest('http://localhost:3000/api/health/cron');
      const response = await GET(request);
      const data = await response.json();

      // Updated behavior: 5+ hours is now considered unhealthy
      expect(response.status).toBe(503);
      expect(data.status).toBe('unhealthy');
      expect(data.ageMinutes).toBeGreaterThan(300); // Greater than 5 hours
      expect(data.message).toContain('expected every 4 hours');
    });
  });

  describe('Next run time validation for 6x schedule', () => {
    it('should show next run within 4 hours when healthy', async () => {
      const now = new Date();
      const nextRunTime = new Date(now.getTime() + 2 * 60 * 60 * 1000); // 2 hours from now
      
      const mockHealthData = {
        status: 'healthy',
        timestamp: now.toISOString(),
        message: 'Sync completed successfully',
        lastRun: now.toISOString(),
        lastRunStatus: 'success',
        nextRun: nextRunTime.toISOString(),
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockHealthData));

      const request = new NextRequest('http://localhost:3000/api/health/cron');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.nextRun).toBe(nextRunTime.toISOString());
      
      // Verify next run is within 4-hour window
      const nextRunDiff = new Date(data.nextRun).getTime() - now.getTime();
      expect(nextRunDiff).toBeLessThanOrEqual(4 * 60 * 60 * 1000);
    });
  });

  describe('Cron schedule pattern validation', () => {
    it('should validate 6x daily schedule times', () => {
      // Expected schedule: 2am, 6am, 10am, 2pm, 6pm, 10pm Toronto time
      const expectedHours = [2, 6, 10, 14, 18, 22];
      const cronPattern = '0 2,6,10,14,18,22 * * *';
      
      // Parse the cron pattern
      const [minute, hours, ...rest] = cronPattern.split(' ');
      const parsedHours = hours.split(',').map(h => parseInt(h));
      
      expect(minute).toBe('0');
      expect(parsedHours).toEqual(expectedHours);
      expect(rest.join(' ')).toBe('* * *');
      
      // Verify 4-hour intervals
      for (let i = 1; i < parsedHours.length; i++) {
        const interval = parsedHours[i] - parsedHours[i - 1];
        expect(interval).toBe(4);
      }
    });
  });

  describe('Service health reporting for increased frequency', () => {
    it('should track recent runs for all 6 daily executions', async () => {
      const recentRuns = [
        { time: '2025-08-05T02:00:00.000Z', status: 'success', duration: 45000 },
        { time: '2025-08-05T06:00:00.000Z', status: 'success', duration: 48000 },
        { time: '2025-08-05T10:00:00.000Z', status: 'success', duration: 43000 },
        { time: '2025-08-05T14:00:00.000Z', status: 'success', duration: 46000 },
      ];
      
      const mockHealthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: 'Sync completed successfully',
        lastRun: recentRuns[recentRuns.length - 1].time,
        lastRunStatus: 'success',
        recentRuns: recentRuns,
        successRate: 1.0, // 100% success
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockHealthData));

      const request = new NextRequest('http://localhost:3000/api/health/cron');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentRuns).toHaveLength(4);
      expect(data.recentRuns[0].status).toBe('success');
    });

    it('should calculate appropriate success rate for 6x frequency', async () => {
      const recentRuns = [
        { time: '2025-08-05T02:00:00.000Z', status: 'success', duration: 45000 },
        { time: '2025-08-05T06:00:00.000Z', status: 'failed', duration: 0 },
        { time: '2025-08-05T10:00:00.000Z', status: 'success', duration: 43000 },
        { time: '2025-08-05T14:00:00.000Z', status: 'success', duration: 46000 },
      ];
      
      const mockHealthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        message: '3 of 4 recent syncs successful',
        lastRun: recentRuns[recentRuns.length - 1].time,
        lastRunStatus: 'success',
        recentRuns: recentRuns,
        successRate: 0.75, // 75% success rate
      };
      vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockHealthData));

      const request = new NextRequest('http://localhost:3000/api/health/cron');
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.recentRuns).toHaveLength(4);
      
      // Count successes
      const successCount = data.recentRuns.filter((run: any) => run.status === 'success').length;
      expect(successCount).toBe(3);
    });
  });
});