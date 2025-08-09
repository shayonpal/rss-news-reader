import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Test Specification for RR-171: Rate Limiting and Countdown
 * 
 * CRITICAL REQUIREMENTS:
 * 1. 429 response triggers 5-minute cooldown (configurable)
 * 2. Respect server Retry-After header if present
 * 3. Button shows countdown: "Retry in 4:59"
 * 4. Persist cooldownUntil in localStorage
 * 5. Countdown updates every second
 * 
 * The implementation MUST conform to these tests. Do NOT modify tests to match
 * implementation - fix the implementation to pass these tests.
 */

interface RateLimitManager {
  checkRateLimit(): boolean;
  handleRateLimitError(retryAfter?: number): void;
  getRemainingCooldown(): number;
  formatCountdown(seconds: number): string;
  clearCooldown(): void;
  isInCooldown(): boolean;
  getCooldownEndTime(): number | null;
}

interface SyncButtonState {
  disabled: boolean;
  label: string;
  onClick: () => void;
}

describe('RR-171: Rate Limiting Contract', () => {
  let rateLimitManager: RateLimitManager;
  let mockLocalStorage: Storage;
  let mockSystemConfig: any;
  
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    
    // Mock localStorage
    const storage: { [key: string]: string } = {};
    mockLocalStorage = {
      getItem: vi.fn((key: string) => storage[key] || null),
      setItem: vi.fn((key: string, value: string) => { storage[key] = value; }),
      removeItem: vi.fn((key: string) => { delete storage[key]; }),
      clear: vi.fn(() => { Object.keys(storage).forEach(key => delete storage[key]); }),
      length: 0,
      key: vi.fn()
    };
    
    Object.defineProperty(window, 'localStorage', {
      value: mockLocalStorage,
      writable: true
    });
    
    // Mock system config
    mockSystemConfig = {
      rate_limit_cooldown_minutes: 5 // Default 5 minutes
    };
    
    // Implementation should provide this
    rateLimitManager = {
      checkRateLimit: () => {
        const cooldownUntil = mockLocalStorage.getItem('syncCooldownUntil');
        if (!cooldownUntil) return true;
        
        const now = Date.now();
        const endTime = parseInt(cooldownUntil, 10);
        return now >= endTime;
      },
      
      handleRateLimitError: (retryAfter?: number) => {
        const cooldownSeconds = retryAfter || (mockSystemConfig.rate_limit_cooldown_minutes * 60);
        const cooldownUntil = Date.now() + (cooldownSeconds * 1000);
        mockLocalStorage.setItem('syncCooldownUntil', cooldownUntil.toString());
      },
      
      getRemainingCooldown: () => {
        const cooldownUntil = mockLocalStorage.getItem('syncCooldownUntil');
        if (!cooldownUntil) return 0;
        
        const now = Date.now();
        const endTime = parseInt(cooldownUntil, 10);
        const remaining = Math.max(0, Math.ceil((endTime - now) / 1000));
        return remaining;
      },
      
      formatCountdown: (seconds: number) => {
        if (seconds <= 0) return 'Sync';
        
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        
        if (minutes > 0) {
          return `Retry in ${minutes}:${secs.toString().padStart(2, '0')}`;
        }
        return `Retry in ${seconds}s`;
      },
      
      clearCooldown: () => {
        mockLocalStorage.removeItem('syncCooldownUntil');
      },
      
      isInCooldown: () => {
        return rateLimitManager.getRemainingCooldown() > 0;
      },
      
      getCooldownEndTime: () => {
        const cooldownUntil = mockLocalStorage.getItem('syncCooldownUntil');
        return cooldownUntil ? parseInt(cooldownUntil, 10) : null;
      }
    };
  });
  
  afterEach(() => {
    vi.useRealTimers();
  });
  
  describe('Rate Limit Detection', () => {
    it('should trigger cooldown on 429 response', async () => {
      const response = new NextResponse(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
      
      expect(response.status).toBe(429);
      
      // Handle the rate limit error
      rateLimitManager.handleRateLimitError();
      
      expect(rateLimitManager.isInCooldown()).toBe(true);
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(
        'syncCooldownUntil',
        expect.any(String)
      );
    });
    
    it('should respect Retry-After header when present', async () => {
      const retryAfterSeconds = 180; // 3 minutes
      
      const response = new NextResponse(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { 
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': retryAfterSeconds.toString()
          }
        }
      );
      
      // Parse Retry-After header
      const retryAfter = response.headers.get('Retry-After');
      expect(retryAfter).toBe('180');
      
      // Handle with server-specified retry time
      rateLimitManager.handleRateLimitError(parseInt(retryAfter!, 10));
      
      const remaining = rateLimitManager.getRemainingCooldown();
      expect(remaining).toBe(180);
    });
    
    it('should use default 5-minute cooldown when no Retry-After header', () => {
      rateLimitManager.handleRateLimitError(); // No retryAfter parameter
      
      const remaining = rateLimitManager.getRemainingCooldown();
      expect(remaining).toBe(300); // 5 minutes = 300 seconds
    });
    
    it('should use configurable cooldown from system_config', () => {
      // Change config to 10 minutes
      mockSystemConfig.rate_limit_cooldown_minutes = 10;
      
      rateLimitManager.handleRateLimitError();
      
      const remaining = rateLimitManager.getRemainingCooldown();
      expect(remaining).toBe(600); // 10 minutes = 600 seconds
    });
  });
  
  describe('LocalStorage Persistence', () => {
    it('should persist cooldown end time in localStorage', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      
      rateLimitManager.handleRateLimitError(120); // 2 minutes
      
      const storedValue = mockLocalStorage.getItem('syncCooldownUntil');
      expect(storedValue).toBeTruthy();
      
      const endTime = parseInt(storedValue!, 10);
      expect(endTime).toBe(now + 120000); // 120 seconds in milliseconds
    });
    
    it('should restore cooldown state after page reload', () => {
      // Simulate existing cooldown in localStorage
      const futureTime = Date.now() + 150000; // 2.5 minutes from now
      mockLocalStorage.setItem('syncCooldownUntil', futureTime.toString());
      
      // Check if still in cooldown
      expect(rateLimitManager.isInCooldown()).toBe(true);
      expect(rateLimitManager.getRemainingCooldown()).toBe(150);
    });
    
    it('should clear expired cooldown from localStorage', () => {
      // Set cooldown in the past
      const pastTime = Date.now() - 1000; // 1 second ago
      mockLocalStorage.setItem('syncCooldownUntil', pastTime.toString());
      
      expect(rateLimitManager.isInCooldown()).toBe(false);
      expect(rateLimitManager.getRemainingCooldown()).toBe(0);
    });
    
    it('should handle missing localStorage entry gracefully', () => {
      // No cooldown stored
      expect(mockLocalStorage.getItem('syncCooldownUntil')).toBeNull();
      
      expect(rateLimitManager.isInCooldown()).toBe(false);
      expect(rateLimitManager.getRemainingCooldown()).toBe(0);
      expect(rateLimitManager.getCooldownEndTime()).toBeNull();
    });
  });
  
  describe('Countdown Formatting', () => {
    it('should format countdown as M:SS for times over 1 minute', () => {
      expect(rateLimitManager.formatCountdown(299)).toBe('Retry in 4:59');
      expect(rateLimitManager.formatCountdown(180)).toBe('Retry in 3:00');
      expect(rateLimitManager.formatCountdown(125)).toBe('Retry in 2:05');
      expect(rateLimitManager.formatCountdown(61)).toBe('Retry in 1:01');
    });
    
    it('should format countdown as Ns for times under 1 minute', () => {
      expect(rateLimitManager.formatCountdown(59)).toBe('Retry in 59s');
      expect(rateLimitManager.formatCountdown(30)).toBe('Retry in 30s');
      expect(rateLimitManager.formatCountdown(10)).toBe('Retry in 10s');
      expect(rateLimitManager.formatCountdown(1)).toBe('Retry in 1s');
    });
    
    it('should show "Sync" when countdown reaches zero', () => {
      expect(rateLimitManager.formatCountdown(0)).toBe('Sync');
      expect(rateLimitManager.formatCountdown(-1)).toBe('Sync'); // Handle negative
    });
    
    it('should pad seconds with leading zero in M:SS format', () => {
      expect(rateLimitManager.formatCountdown(120)).toBe('Retry in 2:00');
      expect(rateLimitManager.formatCountdown(121)).toBe('Retry in 2:01');
      expect(rateLimitManager.formatCountdown(129)).toBe('Retry in 2:09');
      expect(rateLimitManager.formatCountdown(130)).toBe('Retry in 2:10');
    });
  });
  
  describe('Button State Management', () => {
    it('should disable button during cooldown', () => {
      rateLimitManager.handleRateLimitError(60);
      
      const buttonState: SyncButtonState = {
        disabled: rateLimitManager.isInCooldown(),
        label: rateLimitManager.formatCountdown(rateLimitManager.getRemainingCooldown()),
        onClick: vi.fn()
      };
      
      expect(buttonState.disabled).toBe(true);
      expect(buttonState.label).toBe('Retry in 1:00');
    });
    
    it('should enable button when cooldown expires', () => {
      // Set cooldown
      rateLimitManager.handleRateLimitError(2); // 2 seconds
      
      // Advance time past cooldown
      vi.advanceTimersByTime(3000);
      
      const buttonState: SyncButtonState = {
        disabled: rateLimitManager.isInCooldown(),
        label: rateLimitManager.formatCountdown(rateLimitManager.getRemainingCooldown()),
        onClick: vi.fn()
      };
      
      expect(buttonState.disabled).toBe(false);
      expect(buttonState.label).toBe('Sync');
    });
    
    it('should update button label every second during countdown', () => {
      rateLimitManager.handleRateLimitError(5); // 5 seconds
      
      const labels: string[] = [];
      
      // Simulate countdown updates
      for (let i = 0; i <= 5; i++) {
        labels.push(rateLimitManager.formatCountdown(rateLimitManager.getRemainingCooldown()));
        vi.advanceTimersByTime(1000);
      }
      
      expect(labels).toEqual([
        'Retry in 5s',
        'Retry in 4s',
        'Retry in 3s',
        'Retry in 2s',
        'Retry in 1s',
        'Sync'
      ]);
    });
  });
  
  describe('Countdown Timer Updates', () => {
    it('should update remaining time accurately', () => {
      const startTime = Date.now();
      vi.setSystemTime(startTime);
      
      rateLimitManager.handleRateLimitError(300); // 5 minutes
      
      // Check initial state
      expect(rateLimitManager.getRemainingCooldown()).toBe(300);
      
      // Advance 1 minute
      vi.advanceTimersByTime(60000);
      expect(rateLimitManager.getRemainingCooldown()).toBe(240);
      
      // Advance another 2 minutes
      vi.advanceTimersByTime(120000);
      expect(rateLimitManager.getRemainingCooldown()).toBe(120);
      
      // Advance to completion
      vi.advanceTimersByTime(120000);
      expect(rateLimitManager.getRemainingCooldown()).toBe(0);
    });
    
    it('should handle system time changes gracefully', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      
      // Set cooldown for 5 minutes
      const endTime = now + 300000;
      mockLocalStorage.setItem('syncCooldownUntil', endTime.toString());
      
      // Simulate system time jump forward by 2 minutes
      vi.setSystemTime(now + 120000);
      expect(rateLimitManager.getRemainingCooldown()).toBe(180);
      
      // Simulate system time jump backward (should not extend cooldown)
      vi.setSystemTime(now + 60000);
      expect(rateLimitManager.getRemainingCooldown()).toBe(240);
    });
  });
  
  describe('Manual Cooldown Management', () => {
    it('should allow clearing cooldown manually', () => {
      rateLimitManager.handleRateLimitError(300);
      expect(rateLimitManager.isInCooldown()).toBe(true);
      
      rateLimitManager.clearCooldown();
      
      expect(rateLimitManager.isInCooldown()).toBe(false);
      expect(mockLocalStorage.getItem('syncCooldownUntil')).toBeNull();
    });
    
    it('should handle concurrent rate limit responses correctly', () => {
      // First rate limit: 2 minutes
      rateLimitManager.handleRateLimitError(120);
      const firstEndTime = rateLimitManager.getCooldownEndTime();
      
      // Second rate limit: 5 minutes (should override)
      rateLimitManager.handleRateLimitError(300);
      const secondEndTime = rateLimitManager.getCooldownEndTime();
      
      expect(secondEndTime).toBeGreaterThan(firstEndTime!);
      expect(rateLimitManager.getRemainingCooldown()).toBe(300);
    });
  });
  
  describe('Edge Cases', () => {
    it('should handle very long cooldown periods', () => {
      const oneHour = 3600; // seconds
      rateLimitManager.handleRateLimitError(oneHour);
      
      expect(rateLimitManager.formatCountdown(3600)).toBe('Retry in 60:00');
      expect(rateLimitManager.getRemainingCooldown()).toBe(3600);
    });
    
    it('should handle invalid localStorage data gracefully', () => {
      // Set invalid data
      mockLocalStorage.setItem('syncCooldownUntil', 'invalid');
      
      // Should handle gracefully
      expect(rateLimitManager.getRemainingCooldown()).toBe(0);
      expect(rateLimitManager.isInCooldown()).toBe(false);
    });
    
    it('should round up partial seconds in countdown', () => {
      const now = Date.now();
      vi.setSystemTime(now);
      
      // Set cooldown that ends at a fractional second
      const endTime = now + 2500; // 2.5 seconds
      mockLocalStorage.setItem('syncCooldownUntil', endTime.toString());
      
      // Should round up to 3 seconds
      expect(rateLimitManager.getRemainingCooldown()).toBe(3);
    });
  });
});