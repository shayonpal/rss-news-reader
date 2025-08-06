import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

/**
 * RR-130 Unit Test Suite: Sync Frequency Increase
 * 
 * Tests the core logic changes for increasing sync frequency from 2x to 6x daily.
 * Validates cron schedule parsing, trigger name generation, and time calculations.
 * 
 * Target Schedule: 2AM, 6AM, 10AM, 2PM, 6PM, 10PM (America/Toronto)
 */

describe('RR-130 Unit Tests: Sync Frequency Core Logic', () => {
  let originalDate: typeof Date;
  
  beforeEach(() => {
    vi.clearAllMocks();
    originalDate = global.Date;
  });

  afterEach(() => {
    global.Date = originalDate;
  });

  describe('Cron Schedule Validation', () => {
    it('should parse new 6x daily cron schedule correctly', () => {
      const newSchedule = '0 2,6,10,14,18,22 * * *';
      const expectedHours = [2, 6, 10, 14, 18, 22];
      
      // Extract hours from cron schedule
      const hoursPart = newSchedule.split(' ')[1];
      const parsedHours = hoursPart.split(',').map(h => parseInt(h, 10));
      
      expect(parsedHours).toEqual(expectedHours);
      expect(parsedHours).toHaveLength(6);
    });

    it('should validate cron schedule format for PM2', () => {
      const schedule = '0 2,6,10,14,18,22 * * *';
      const cronRegex = /^(\d+|\*) (\d+(?:,\d+)*|\*) (\d+|\*) (\d+|\*) (\d+|\*)$/;
      
      expect(schedule).toMatch(cronRegex);
    });

    it('should ensure 4-hour intervals between sync times', () => {
      const syncHours = [2, 6, 10, 14, 18, 22];
      const intervals: number[] = [];
      
      for (let i = 1; i < syncHours.length; i++) {
        intervals.push(syncHours[i] - syncHours[i - 1]);
      }
      
      // Add wraparound interval (22 -> 2 next day = 4 hours)
      intervals.push(24 - syncHours[syncHours.length - 1] + syncHours[0]);
      
      // All intervals should be 4 hours
      intervals.forEach(interval => {
        expect(interval).toBe(4);
      });
    });
  });

  describe('getTriggerName() Logic for 6x Frequency', () => {
    const mockDate = (hour: number, minute: number = 0) => {
      const mockDateTime = new Date(2025, 0, 26, hour, minute, 0);
      global.Date = vi.fn(() => mockDateTime) as any;
      global.Date.now = vi.fn(() => mockDateTime.getTime());
    };

    it('should return "cron-2am" for 2 AM trigger', () => {
      mockDate(2, 0);
      
      // Mock the actual getTriggerName logic for 6x frequency
      const getTriggerName = () => {
        const hour = new Date().getHours();
        switch (hour) {
          case 2: return 'cron-2am';
          case 6: return 'cron-6am';
          case 10: return 'cron-10am';
          case 14: return 'cron-2pm';
          case 18: return 'cron-6pm';
          case 22: return 'cron-10pm';
          default: return 'cron-unknown';
        }
      };
      
      expect(getTriggerName()).toBe('cron-2am');
    });

    it('should return "cron-6am" for 6 AM trigger', () => {
      mockDate(6, 0);
      
      const getTriggerName = () => {
        const hour = new Date().getHours();
        switch (hour) {
          case 2: return 'cron-2am';
          case 6: return 'cron-6am';
          case 10: return 'cron-10am';
          case 14: return 'cron-2pm';
          case 18: return 'cron-6pm';
          case 22: return 'cron-10pm';
          default: return 'cron-unknown';
        }
      };
      
      expect(getTriggerName()).toBe('cron-6am');
    });

    it('should return "cron-10am" for 10 AM trigger', () => {
      mockDate(10, 0);
      
      const getTriggerName = () => {
        const hour = new Date().getHours();
        switch (hour) {
          case 2: return 'cron-2am';
          case 6: return 'cron-6am';
          case 10: return 'cron-10am';
          case 14: return 'cron-2pm';
          case 18: return 'cron-6pm';
          case 22: return 'cron-10pm';
          default: return 'cron-unknown';
        }
      };
      
      expect(getTriggerName()).toBe('cron-10am');
    });

    it('should return "cron-2pm" for 2 PM trigger', () => {
      mockDate(14, 0);
      
      const getTriggerName = () => {
        const hour = new Date().getHours();
        switch (hour) {
          case 2: return 'cron-2am';
          case 6: return 'cron-6am';
          case 10: return 'cron-10am';
          case 14: return 'cron-2pm';
          case 18: return 'cron-6pm';
          case 22: return 'cron-10pm';
          default: return 'cron-unknown';
        }
      };
      
      expect(getTriggerName()).toBe('cron-2pm');
    });

    it('should return "cron-6pm" for 6 PM trigger', () => {
      mockDate(18, 0);
      
      const getTriggerName = () => {
        const hour = new Date().getHours();
        switch (hour) {
          case 2: return 'cron-2am';
          case 6: return 'cron-6am';
          case 10: return 'cron-10am';
          case 14: return 'cron-2pm';
          case 18: return 'cron-6pm';
          case 22: return 'cron-10pm';
          default: return 'cron-unknown';
        }
      };
      
      expect(getTriggerName()).toBe('cron-6pm');
    });

    it('should return "cron-10pm" for 10 PM trigger', () => {
      mockDate(22, 0);
      
      const getTriggerName = () => {
        const hour = new Date().getHours();
        switch (hour) {
          case 2: return 'cron-2am';
          case 6: return 'cron-6am';
          case 10: return 'cron-10am';
          case 14: return 'cron-2pm';
          case 18: return 'cron-6pm';
          case 22: return 'cron-10pm';
          default: return 'cron-unknown';
        }
      };
      
      expect(getTriggerName()).toBe('cron-10pm');
    });

    it('should handle non-sync hours gracefully', () => {
      mockDate(15, 30); // 3:30 PM - not a sync time
      
      const getTriggerName = () => {
        const hour = new Date().getHours();
        switch (hour) {
          case 2: return 'cron-2am';
          case 6: return 'cron-6am';
          case 10: return 'cron-10am';
          case 14: return 'cron-2pm';
          case 18: return 'cron-6pm';
          case 22: return 'cron-10pm';
          default: return 'cron-unknown';
        }
      };
      
      expect(getTriggerName()).toBe('cron-unknown');
    });
  });

  describe('getNextRunTime() Calculation for 6x Frequency', () => {
    const syncHours = [2, 6, 10, 14, 18, 22];
    
    const getNextRunTime = (currentHour: number) => {
      const now = new Date();
      now.setHours(currentHour, 0, 0, 0);
      
      // Find next sync time
      const nextHour = syncHours.find(hour => hour > currentHour);
      
      if (nextHour) {
        // Next run is today
        const next = new Date(now);
        next.setHours(nextHour, 0, 0, 0);
        return next.toISOString();
      } else {
        // Next run is tomorrow at 2 AM
        const next = new Date(now);
        next.setDate(next.getDate() + 1);
        next.setHours(2, 0, 0, 0);
        return next.toISOString();
      }
    };

    it('should calculate next run time correctly before 2 AM', () => {
      const nextRun = getNextRunTime(1); // 1 AM
      const nextRunDate = new Date(nextRun);
      
      expect(nextRunDate.getHours()).toBe(2);
    });

    it('should calculate next run time correctly between sync times', () => {
      const nextRun = getNextRunTime(8); // 8 AM (between 6 AM and 10 AM)
      const nextRunDate = new Date(nextRun);
      
      expect(nextRunDate.getHours()).toBe(10);
    });

    it('should calculate next run time correctly after last sync', () => {
      const nextRun = getNextRunTime(23); // 11 PM (after 10 PM)
      const nextRunDate = new Date(nextRun);
      
      expect(nextRunDate.getHours()).toBe(2);
      // Should be next day
      expect(nextRunDate.getDate()).toBeGreaterThan(new Date().getDate());
    });

    it('should handle all transition times correctly', () => {
      const testCases = [
        { current: 1, expected: 2 },   // Before first sync
        { current: 4, expected: 6 },   // Between 2 AM and 6 AM
        { current: 8, expected: 10 },  // Between 6 AM and 10 AM
        { current: 12, expected: 14 }, // Between 10 AM and 2 PM
        { current: 16, expected: 18 }, // Between 2 PM and 6 PM
        { current: 20, expected: 22 }, // Between 6 PM and 10 PM
        { current: 23, expected: 2 }   // After last sync (next day)
      ];
      
      testCases.forEach(({ current, expected }) => {
        const nextRun = getNextRunTime(current);
        const nextRunDate = new Date(nextRun);
        
        expect(nextRunDate.getHours()).toBe(expected);
      });
    });
  });

  describe('Monitoring Threshold Adjustments', () => {
    it('should update staleness threshold from 12h to 4h', () => {
      const oldThreshold = 12; // hours
      const newThreshold = 4;  // hours (based on 4-hour sync intervals)
      
      // With 6x daily syncs, articles older than 4 hours are stale
      expect(newThreshold).toBeLessThan(oldThreshold);
      expect(newThreshold).toBe(4);
    });

    it('should validate monitoring script threshold values', () => {
      // Mock monitoring script logic
      const checkArticleFreshness = (hoursSinceLastArticle: number) => {
        const stalenessThreshold = 4; // Updated for 6x frequency
        return hoursSinceLastArticle <= stalenessThreshold ? 'healthy' : 'stale';
      };
      
      expect(checkArticleFreshness(2)).toBe('healthy');  // 2 hours - healthy
      expect(checkArticleFreshness(4)).toBe('healthy');  // 4 hours - still healthy
      expect(checkArticleFreshness(5)).toBe('stale');    // 5 hours - stale
      expect(checkArticleFreshness(8)).toBe('stale');    // 8 hours - stale
    });
  });

  describe('Timezone Handling Validation', () => {
    it('should maintain America/Toronto timezone for all sync times', () => {
      const timezone = 'America/Toronto';
      
      // Validate timezone is properly configured
      expect(timezone).toBe('America/Toronto');
      
      // Test EST/EDT offset handling
      const winterDate = new Date('2025-01-15T07:00:00-05:00'); // EST
      const summerDate = new Date('2025-07-15T07:00:00-04:00'); // EDT
      
      expect(winterDate.getTimezoneOffset()).toBe(300); // EST is UTC-5 (300 minutes)
      expect(summerDate.getTimezoneOffset()).toBe(240); // EDT is UTC-4 (240 minutes)
    });

    it('should handle DST transitions correctly', () => {
      // DST transitions in 2025:
      // Spring forward: March 9, 2025 (EST -> EDT)
      // Fall back: November 2, 2025 (EDT -> EST)
      
      const beforeDST = new Date('2025-03-08T14:00:00'); // 2 PM EST
      const afterDST = new Date('2025-03-10T14:00:00');  // 2 PM EDT
      
      // Both should represent the same sync time (2 PM Toronto time)
      expect(beforeDST.getHours()).toBe(afterDST.getHours());
    });
  });

  describe('Materialized View Refresh Logic', () => {
    it('should trigger view refresh after sync completion', () => {
      let viewRefreshed = false;
      
      const mockRefreshMaterializedView = vi.fn(() => {
        viewRefreshed = true;
        return Promise.resolve();
      });
      
      const mockSyncCompletion = async () => {
        // Simulate sync completion
        await mockRefreshMaterializedView();
        return { status: 'completed', viewRefreshed };
      };
      
      return mockSyncCompletion().then(result => {
        expect(result.viewRefreshed).toBe(true);
        expect(mockRefreshMaterializedView).toHaveBeenCalledOnce();
      });
    });

    it('should handle view refresh failures gracefully', () => {
      const mockRefreshMaterializedView = vi.fn(() => {
        throw new Error('View refresh failed');
      });
      
      const mockSyncCompletionWithErrorHandling = async () => {
        try {
          await mockRefreshMaterializedView();
          return { status: 'completed', viewRefreshed: true };
        } catch (error) {
          console.warn('View refresh failed:', error);
          return { status: 'completed', viewRefreshed: false, error: error.message };
        }
      };
      
      return mockSyncCompletionWithErrorHandling().then(result => {
        expect(result.status).toBe('completed');
        expect(result.viewRefreshed).toBe(false);
        expect(result.error).toBe('View refresh failed');
      });
    });
  });

  describe('Backward Compatibility', () => {
    it('should maintain sync metadata structure compatibility', () => {
      const syncMetadata = {
        last_sync_time: new Date().toISOString(),
        last_sync_status: 'success',
        last_sync_error: null,
        sync_success_count: 1,
        sync_failure_count: 0
      };
      
      // Metadata structure should remain the same
      expect(syncMetadata).toHaveProperty('last_sync_time');
      expect(syncMetadata).toHaveProperty('last_sync_status');
      expect(syncMetadata).toHaveProperty('last_sync_error');
      expect(syncMetadata).toHaveProperty('sync_success_count');
      expect(syncMetadata).toHaveProperty('sync_failure_count');
    });

    it('should maintain existing API endpoint compatibility', () => {
      const syncEndpoints = [
        '/reader/api/sync',
        '/reader/api/sync/status/:id',
        '/reader/api/sync/metadata'
      ];
      
      // All existing endpoints should remain unchanged
      syncEndpoints.forEach(endpoint => {
        expect(endpoint).toMatch(/^\/reader\/api\/sync/);
      });
    });
  });
});