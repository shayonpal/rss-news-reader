// Rate limiter for Inoreader API (100 calls per day)
export class RateLimiter {
  private readonly DAILY_LIMIT = 100;
  private readonly STORAGE_KEY = "inoreader_api_usage";
  private readonly HEADER_INFO_KEY = "inoreader_api_headers";

  private usage: {
    date: string;
    calls: number;
    resetTime: number;
  };

  // Server-reported rate limit info from headers
  private serverInfo: {
    usage: number;
    limit: number;
    resetAfterSeconds: number;
    lastUpdated: number;
  } | null = null;

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

  // Update rate limit info from API response headers
  updateFromHeaders(headers: Headers): void {
    const usage = headers.get("X-Reader-Zone1-Usage");
    const limit = headers.get("X-Reader-Zone1-Limit");
    const resetAfter = headers.get("X-Reader-Limits-Reset-After");

    if (usage || limit || resetAfter) {
      this.serverInfo = {
        usage: parseInt(usage?.trim().replace(/,/g, "") || "0"),
        limit: parseInt(limit?.trim().replace(/,/g, "") || "5000"),
        resetAfterSeconds: parseInt(
          resetAfter?.trim().replace(/\.\d+$/, "") || "86400"
        ),
        lastUpdated: Date.now(),
      };

      // Log warning if server usage differs significantly from local tracking
      if (
        this.serverInfo.usage &&
        Math.abs(this.serverInfo.usage - this.usage.calls) > 10
      ) {
        console.warn("Rate limit mismatch detected", {
          local: this.usage.calls,
          server: this.serverInfo.usage,
          difference: Math.abs(this.serverInfo.usage - this.usage.calls),
        });
      }

      // Update reset time based on server info
      if (resetAfter) {
        const newResetTime =
          Date.now() + this.serverInfo.resetAfterSeconds * 1000;
        this.usage.resetTime = newResetTime;
        this.saveUsage();
      }

      // Save server info to localStorage
      if (typeof window !== "undefined") {
        localStorage.setItem(
          this.HEADER_INFO_KEY,
          JSON.stringify(this.serverInfo)
        );
      }
    }
  }

  // Get server-reported rate limit info
  getServerInfo(): typeof this.serverInfo {
    if (!this.serverInfo && typeof window !== "undefined") {
      const stored = localStorage.getItem(this.HEADER_INFO_KEY);
      if (stored) {
        try {
          this.serverInfo = JSON.parse(stored);
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
    return this.serverInfo;
  }

  // Check if we should throttle requests based on usage
  shouldThrottleRequests(): boolean {
    const serverInfo = this.getServerInfo();
    if (serverInfo && serverInfo.usage && serverInfo.limit) {
      const percentage = (serverInfo.usage / serverInfo.limit) * 100;
      return percentage >= 80; // Throttle at 80% usage
    }
    return this.getUsageStats().isWarningLevel;
  }

  // Get recommended delay in milliseconds for throttling
  getRecommendedDelay(): number {
    const serverInfo = this.getServerInfo();
    if (!this.shouldThrottleRequests()) return 0;

    if (serverInfo && serverInfo.usage && serverInfo.limit) {
      const percentage = (serverInfo.usage / serverInfo.limit) * 100;
      if (percentage >= 95) return 5000; // 5 seconds at 95%+
      if (percentage >= 90) return 3000; // 3 seconds at 90%+
      if (percentage >= 80) return 1000; // 1 second at 80%+
    }

    return 1000; // Default 1 second delay
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
