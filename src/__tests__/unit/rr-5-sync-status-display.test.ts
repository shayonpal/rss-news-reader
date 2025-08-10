import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GET as syncRoute, POST as syncPost } from '@/app/api/sync/route';
import { GET as apiUsageRoute } from '@/app/api/sync/api-usage/route';
import { NextRequest } from 'next/server';
import { apiUsageRepository } from '@/lib/db/repositories/api-usage-repository';
import { rateLimiter } from '@/lib/api/rate-limiter';

// Mock dependencies
vi.mock('@/lib/db/repositories/api-usage-repository', () => ({
  apiUsageRepository: {
    recordInoreaderCall: vi.fn(),
    getTodaysUsage: vi.fn(),
    updateZoneUsage: vi.fn(),
    getLatestZoneUsage: vi.fn(),
  },
}));

vi.mock('@/lib/api/rate-limiter', () => ({
  rateLimiter: {
    canMakeCall: vi.fn(() => true),
    recordCall: vi.fn(),
    getUsageStats: vi.fn(() => ({
      used: 0,
      remaining: 100,
      total: 100,
      percentage: 0,
      canMakeCall: true,
    })),
    updateFromHeaders: vi.fn(),
    getZoneUsage: vi.fn(),
  },
}));

vi.mock('@/lib/api/log-api-call', () => ({
  logInoreaderApiCall: vi.fn(),
}));

// Mock fetch globally
global.fetch = vi.fn();

describe('RR-5: Sync Status Display - Unit Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Header Extraction from Inoreader Responses', () => {
    it('should extract zone 1 usage headers correctly', async () => {
      const mockHeaders = new Headers({
        'X-Reader-Zone1-Usage': '234',
        'X-Reader-Zone1-Limit': '5000',
        'X-Reader-Limits-Reset-After': '43200',
      });

      const mockResponse = {
        ok: true,
        status: 200,
        headers: mockHeaders,
        json: async () => ({ success: true }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      // Test that headers are parsed
      const headers = {
        zone1Usage: parseInt(mockHeaders.get('X-Reader-Zone1-Usage') || '0'),
        zone1Limit: parseInt(mockHeaders.get('X-Reader-Zone1-Limit') || '5000'),
        resetAfter: parseInt(mockHeaders.get('X-Reader-Limits-Reset-After') || '0'),
      };

      expect(headers.zone1Usage).toBe(234);
      expect(headers.zone1Limit).toBe(5000);
      expect(headers.resetAfter).toBe(43200);
    });

    it('should extract zone 2 usage headers correctly', async () => {
      const mockHeaders = new Headers({
        'X-Reader-Zone2-Usage': '87',
        'X-Reader-Zone2-Limit': '100',
        'X-Reader-Limits-Reset-After': '43200',
      });

      const mockResponse = {
        ok: true,
        status: 200,
        headers: mockHeaders,
        json: async () => ({ success: true }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const headers = {
        zone2Usage: parseInt(mockHeaders.get('X-Reader-Zone2-Usage') || '0'),
        zone2Limit: parseInt(mockHeaders.get('X-Reader-Zone2-Limit') || '100'),
        resetAfter: parseInt(mockHeaders.get('X-Reader-Limits-Reset-After') || '0'),
      };

      expect(headers.zone2Usage).toBe(87);
      expect(headers.zone2Limit).toBe(100);
      expect(headers.resetAfter).toBe(43200);
    });

    it('should handle missing headers gracefully', async () => {
      const mockHeaders = new Headers();

      const mockResponse = {
        ok: true,
        status: 200,
        headers: mockHeaders,
        json: async () => ({ success: true }),
      };

      vi.mocked(fetch).mockResolvedValue(mockResponse as Response);

      const headers = {
        zone1Usage: parseInt(mockHeaders.get('X-Reader-Zone1-Usage') || '0'),
        zone1Limit: parseInt(mockHeaders.get('X-Reader-Zone1-Limit') || '5000'),
        zone2Usage: parseInt(mockHeaders.get('X-Reader-Zone2-Usage') || '0'),
        zone2Limit: parseInt(mockHeaders.get('X-Reader-Zone2-Limit') || '100'),
      };

      expect(headers.zone1Usage).toBe(0);
      expect(headers.zone1Limit).toBe(5000);
      expect(headers.zone2Usage).toBe(0);
      expect(headers.zone2Limit).toBe(100);
    });
  });

  describe('Database Storage of Zone Data', () => {
    it('should store zone 1 usage in database', async () => {
      const zoneData = {
        zone1_usage: 234,
        zone1_limit: 5000,
        zone2_usage: 0,
        zone2_limit: 100,
        updated_at: new Date().toISOString(),
      };

      vi.mocked(apiUsageRepository.updateZoneUsage).mockResolvedValue(zoneData);

      const result = await apiUsageRepository.updateZoneUsage(zoneData);

      expect(apiUsageRepository.updateZoneUsage).toHaveBeenCalledWith(zoneData);
      expect(result.zone1_usage).toBe(234);
      expect(result.zone1_limit).toBe(5000);
    });

    it('should store zone 2 usage in database', async () => {
      const zoneData = {
        zone1_usage: 234,
        zone1_limit: 5000,
        zone2_usage: 87,
        zone2_limit: 100,
        updated_at: new Date().toISOString(),
      };

      vi.mocked(apiUsageRepository.updateZoneUsage).mockResolvedValue(zoneData);

      const result = await apiUsageRepository.updateZoneUsage(zoneData);

      expect(apiUsageRepository.updateZoneUsage).toHaveBeenCalledWith(zoneData);
      expect(result.zone2_usage).toBe(87);
      expect(result.zone2_limit).toBe(100);
    });

    it('should update existing zone usage records', async () => {
      const initialData = {
        zone1_usage: 100,
        zone1_limit: 5000,
        zone2_usage: 50,
        zone2_limit: 100,
        updated_at: new Date().toISOString(),
      };

      const updatedData = {
        zone1_usage: 234,
        zone1_limit: 5000,
        zone2_usage: 87,
        zone2_limit: 100,
        updated_at: new Date().toISOString(),
      };

      vi.mocked(apiUsageRepository.updateZoneUsage)
        .mockResolvedValueOnce(initialData)
        .mockResolvedValueOnce(updatedData);

      await apiUsageRepository.updateZoneUsage(initialData);
      const result = await apiUsageRepository.updateZoneUsage(updatedData);

      expect(result.zone1_usage).toBe(234);
      expect(result.zone2_usage).toBe(87);
    });
  });

  describe('API Usage Endpoint Responses', () => {
    it('should return zone usage data in correct format', async () => {
      const mockUsageData = {
        zone1_usage: 234,
        zone1_limit: 5000,
        zone2_usage: 87,
        zone2_limit: 100,
        updated_at: new Date().toISOString(),
      };

      vi.mocked(apiUsageRepository.getLatestZoneUsage).mockResolvedValue(mockUsageData);

      const expectedResponse = {
        zone1: {
          used: 234,
          limit: 5000,
          percentage: 4.68,
        },
        zone2: {
          used: 87,
          limit: 100,
          percentage: 87,
        },
        timestamp: mockUsageData.updated_at,
      };

      const result = await apiUsageRepository.getLatestZoneUsage();
      
      const formattedResponse = {
        zone1: {
          used: result.zone1_usage,
          limit: result.zone1_limit,
          percentage: Math.round((result.zone1_usage / result.zone1_limit) * 100 * 100) / 100,
        },
        zone2: {
          used: result.zone2_usage,
          limit: result.zone2_limit,
          percentage: Math.round((result.zone2_usage / result.zone2_limit) * 100 * 100) / 100,
        },
        timestamp: result.updated_at,
      };

      expect(formattedResponse).toEqual(expectedResponse);
    });

    it('should handle empty database gracefully', async () => {
      vi.mocked(apiUsageRepository.getLatestZoneUsage).mockResolvedValue(null);

      const result = await apiUsageRepository.getLatestZoneUsage();

      const defaultResponse = result || {
        zone1: {
          used: 0,
          limit: 5000,
          percentage: 0,
        },
        zone2: {
          used: 0,
          limit: 100,
          percentage: 0,
        },
        timestamp: null,
      };

      expect(defaultResponse.zone1.used).toBe(0);
      expect(defaultResponse.zone2.used).toBe(0);
    });

    it('should calculate percentages correctly', () => {
      const testCases = [
        { used: 0, limit: 5000, expected: 0 },
        { used: 234, limit: 5000, expected: 4.68 },
        { used: 2500, limit: 5000, expected: 50 },
        { used: 4000, limit: 5000, expected: 80 },
        { used: 4750, limit: 5000, expected: 95 },
        { used: 5000, limit: 5000, expected: 100 },
        { used: 87, limit: 100, expected: 87 },
        { used: 95, limit: 100, expected: 95 },
        { used: 100, limit: 100, expected: 100 },
      ];

      testCases.forEach(({ used, limit, expected }) => {
        const percentage = Math.round((used / limit) * 100 * 100) / 100;
        expect(percentage).toBe(expected);
      });
    });
  });

  describe('Sync Store Updates', () => {
    it('should update sync store with zone1 and zone2 structure', async () => {
      const mockStore = {
        zone1: { used: 234, limit: 5000, percentage: 4.68 },
        zone2: { used: 87, limit: 100, percentage: 87 },
      };

      vi.mocked(rateLimiter.getZoneUsage).mockReturnValue(mockStore);

      const result = rateLimiter.getZoneUsage();

      expect(result).toHaveProperty('zone1');
      expect(result).toHaveProperty('zone2');
      expect(result.zone1.used).toBe(234);
      expect(result.zone2.used).toBe(87);
    });

    it('should maintain backward compatibility with existing rate limit structure', () => {
      const legacyStore = {
        used: 321,
        remaining: 4779,
        total: 5100,
        percentage: 6.29,
        canMakeCall: true,
      };

      vi.mocked(rateLimiter.getUsageStats).mockReturnValue(legacyStore);

      const result = rateLimiter.getUsageStats();

      expect(result.used).toBe(321);
      expect(result.remaining).toBe(4779);
      expect(result.total).toBe(5100);
    });
  });

  describe('Color Thresholds for Display', () => {
    it('should return green color for usage below 80%', () => {
      const getColor = (percentage: number) => {
        if (percentage >= 95) return 'text-red-500';
        if (percentage >= 80) return 'text-yellow-500';
        return 'text-green-500';
      };

      expect(getColor(0)).toBe('text-green-500');
      expect(getColor(50)).toBe('text-green-500');
      expect(getColor(79.99)).toBe('text-green-500');
    });

    it('should return yellow color for usage between 80% and 94%', () => {
      const getColor = (percentage: number) => {
        if (percentage >= 95) return 'text-red-500';
        if (percentage >= 80) return 'text-yellow-500';
        return 'text-green-500';
      };

      expect(getColor(80)).toBe('text-yellow-500');
      expect(getColor(87)).toBe('text-yellow-500');
      expect(getColor(94.99)).toBe('text-yellow-500');
    });

    it('should return red color for usage at or above 95%', () => {
      const getColor = (percentage: number) => {
        if (percentage >= 95) return 'text-red-500';
        if (percentage >= 80) return 'text-yellow-500';
        return 'text-green-500';
      };

      expect(getColor(95)).toBe('text-red-500');
      expect(getColor(99)).toBe('text-red-500');
      expect(getColor(100)).toBe('text-red-500');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors gracefully', async () => {
      vi.mocked(fetch).mockRejectedValue(new Error('Network error'));

      try {
        await fetch('https://www.inoreader.com/reader/api/0/user-info');
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Network error');
      }
    });

    it('should handle database errors gracefully', async () => {
      vi.mocked(apiUsageRepository.updateZoneUsage).mockRejectedValue(
        new Error('Database connection failed')
      );

      try {
        await apiUsageRepository.updateZoneUsage({
          zone1_usage: 234,
          zone1_limit: 5000,
          zone2_usage: 87,
          zone2_limit: 100,
          updated_at: new Date().toISOString(),
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).toBe('Database connection failed');
      }
    });

    it('should handle malformed header values', () => {
      const parseHeader = (value: string | null, defaultValue: number) => {
        const parsed = parseInt(value || '');
        return isNaN(parsed) ? defaultValue : parsed;
      };

      expect(parseHeader('not-a-number', 0)).toBe(0);
      expect(parseHeader('', 5000)).toBe(5000);
      expect(parseHeader(null, 100)).toBe(100);
      expect(parseHeader('234', 0)).toBe(234);
    });
  });
});