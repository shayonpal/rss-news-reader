/**
 * API Rate Limiter for Inoreader
 * Tracks API usage to prevent exceeding the 100 calls/day limit
 */

const RATE_LIMIT_KEY = "inoreader_api_usage";
const DAILY_LIMIT = 100;
const WARNING_THRESHOLD = 80; // Warn at 80% usage

interface ApiUsage {
  date: string; // YYYY-MM-DD
  count: number;
  lastCallTime: number;
}

export class ApiRateLimiter {
  private static getToday(): string {
    return new Date().toISOString().split("T")[0];
  }

  static getUsage(): ApiUsage {
    if (typeof window === "undefined") {
      return { date: this.getToday(), count: 0, lastCallTime: Date.now() };
    }

    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (!stored) {
      return { date: this.getToday(), count: 0, lastCallTime: Date.now() };
    }

    const usage = JSON.parse(stored) as ApiUsage;

    // Reset if it's a new day
    if (usage.date !== this.getToday()) {
      return { date: this.getToday(), count: 0, lastCallTime: Date.now() };
    }

    return usage;
  }

  static incrementUsage(calls: number = 1): void {
    if (typeof window === "undefined") return;

    const usage = this.getUsage();
    usage.count += calls;
    usage.lastCallTime = Date.now();

    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(usage));

    // Warn if approaching limit
    if (usage.count >= WARNING_THRESHOLD) {
      console.warn(
        `⚠️ Inoreader API usage: ${usage.count}/${DAILY_LIMIT} calls today`
      );
    }
  }

  static canMakeCall(requiredCalls: number = 1): boolean {
    const usage = this.getUsage();
    return usage.count + requiredCalls <= DAILY_LIMIT;
  }

  static getRemainingCalls(): number {
    const usage = this.getUsage();
    return Math.max(0, DAILY_LIMIT - usage.count);
  }

  static getUsagePercentage(): number {
    const usage = this.getUsage();
    return Math.round((usage.count / DAILY_LIMIT) * 100);
  }

  static shouldWarnUser(): boolean {
    return this.getUsagePercentage() >= 80;
  }

  static resetUsage(): void {
    if (typeof window === "undefined") return;
    localStorage.removeItem(RATE_LIMIT_KEY);
  }
}
