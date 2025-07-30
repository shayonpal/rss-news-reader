// Rate limiter for Inoreader API (100 calls per day)
export class RateLimiter {
  private readonly DAILY_LIMIT = 100;
  private readonly STORAGE_KEY = "inoreader_api_usage";

  private usage: {
    date: string;
    calls: number;
    resetTime: number;
  };

  constructor() {
    this.usage = this.loadUsage();
    this.checkReset();
  }

  private loadUsage() {
    if (typeof window === "undefined")
      return { date: "", calls: 0, resetTime: 0 };

    const stored = localStorage.getItem(this.STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        // Invalid JSON, reset
      }
    }

    return {
      date: new Date().toDateString(),
      calls: 0,
      resetTime: this.getNextResetTime(),
    };
  }

  private saveUsage() {
    if (typeof window === "undefined") return;

    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.usage));
  }

  private getNextResetTime(): number {
    // Reset at midnight UTC
    const now = new Date();
    const resetTime = new Date();
    resetTime.setUTCHours(24, 0, 0, 0); // Next midnight UTC
    return resetTime.getTime();
  }

  private checkReset() {
    const today = new Date().toDateString();

    if (this.usage.date !== today || Date.now() >= this.usage.resetTime) {
      this.usage = {
        date: today,
        calls: 0,
        resetTime: this.getNextResetTime(),
      };
      this.saveUsage();
    }
  }

  // Check if we can make a call
  canMakeCall(): boolean {
    this.checkReset();
    return this.usage.calls < this.DAILY_LIMIT;
  }

  // Record a call
  recordCall(): void {
    this.checkReset();
    this.usage.calls++;
    this.saveUsage();
  }

  // Get usage statistics
  getUsageStats() {
    this.checkReset();

    const remaining = Math.max(0, this.DAILY_LIMIT - this.usage.calls);
    const usagePercentage = (this.usage.calls / this.DAILY_LIMIT) * 100;

    return {
      used: this.usage.calls,
      remaining,
      total: this.DAILY_LIMIT,
      percentage: Math.round(usagePercentage),
      resetTime: new Date(this.usage.resetTime),
      canMakeCall: this.canMakeCall(),
      isWarningLevel: usagePercentage >= 80, // 80% used
      isCriticalLevel: usagePercentage >= 95, // 95% used
    };
  }

  // Get time until reset
  getTimeUntilReset(): number {
    this.checkReset();
    return Math.max(0, this.usage.resetTime - Date.now());
  }

  // Format time until reset
  getFormattedTimeUntilReset(): string {
    const ms = this.getTimeUntilReset();
    const hours = Math.floor(ms / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  }

  // Reset usage (for testing)
  reset(): void {
    this.usage = {
      date: new Date().toDateString(),
      calls: 0,
      resetTime: this.getNextResetTime(),
    };
    this.saveUsage();
  }
}

// Global rate limiter instance
export const rateLimiter = new RateLimiter();

// Decorator for API calls
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  errorMessage = "API rate limit exceeded. Please try again later."
): T {
  return (async (...args: Parameters<T>) => {
    if (!rateLimiter.canMakeCall()) {
      const timeUntilReset = rateLimiter.getFormattedTimeUntilReset();
      throw new Error(`${errorMessage} Resets in ${timeUntilReset}.`);
    }

    rateLimiter.recordCall();
    return fn(...args);
  }) as T;
}

// Hook for React components
export function useRateLimit() {
  return {
    rateLimiter,
    stats: rateLimiter.getUsageStats(),
    canMakeCall: rateLimiter.canMakeCall(),
    timeUntilReset: rateLimiter.getFormattedTimeUntilReset(),
  };
}
