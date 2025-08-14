import { rateLimiter } from "./rate-limiter";
import { captureRateLimitHeaders } from "./capture-rate-limit-headers";

/**
 * Process Inoreader API response and extract rate limit headers
 * This should be called after every Inoreader API response
 */
export function processInoreaderResponse(response: Response): void {
  try {
    // Update rate limiter with header information
    rateLimiter.updateFromHeaders(response.headers);

    // Also capture headers to database for RR-5
    captureRateLimitHeaders(response.headers).catch((err) =>
      console.error("[Inoreader API] Failed to capture headers to DB:", err)
    );

    // Log rate limit status if approaching limits
    const serverInfo = rateLimiter.getServerInfo();
    if (serverInfo && serverInfo.usage && serverInfo.limit) {
      const percentage = (serverInfo.usage / serverInfo.limit) * 100;

      if (percentage >= 90) {
        console.warn(
          `[Inoreader API] High usage warning: ${serverInfo.usage}/${serverInfo.limit} (${percentage.toFixed(1)}%)`
        );
      } else if (percentage >= 80) {
        console.log(
          `[Inoreader API] Usage: ${serverInfo.usage}/${serverInfo.limit} (${percentage.toFixed(1)}%)`
        );
      }
    }

    // Check if we should implement throttling
    if (rateLimiter.shouldThrottleRequests()) {
      const delay = rateLimiter.getRecommendedDelay();
      console.log(`[Inoreader API] Throttling recommended: ${delay}ms delay`);
    }
  } catch (error) {
    console.error("[Inoreader API] Error processing headers:", error);
  }
}

/**
 * Create a delay if throttling is needed
 */
export async function applyThrottleIfNeeded(): Promise<void> {
  if (rateLimiter.shouldThrottleRequests()) {
    const delay = rateLimiter.getRecommendedDelay();
    console.log(`[Inoreader API] Applying throttle delay: ${delay}ms`);
    await new Promise((resolve) => setTimeout(resolve, delay));
  }
}

/**
 * Get current rate limit status for display
 */
export function getRateLimitStatus(): {
  local: {
    used: number;
    limit: number;
    percentage: number;
  };
  server: {
    used: number;
    limit: number;
    percentage: number;
    resetIn: string;
  } | null;
} {
  const stats = rateLimiter.getUsageStats();
  const serverInfo = rateLimiter.getServerInfo();

  const result = {
    local: {
      used: stats.used,
      limit: stats.total,
      percentage: stats.percentage,
    },
    server: null as any,
  };

  if (serverInfo) {
    const resetInMs = serverInfo.resetAfterSeconds * 1000;
    const hours = Math.floor(resetInMs / (1000 * 60 * 60));
    const minutes = Math.floor((resetInMs % (1000 * 60 * 60)) / (1000 * 60));

    result.server = {
      used: serverInfo.usage,
      limit: serverInfo.limit,
      percentage: Math.round((serverInfo.usage / serverInfo.limit) * 100),
      resetIn: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    };
  }

  return result;
}
