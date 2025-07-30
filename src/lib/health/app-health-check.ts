// Enhanced health check for the main Next.js application
import { createClient } from "@supabase/supabase-js";
import type {
  SystemHealth,
  ServiceHealth,
  HealthStatus,
  ComponentHealthCheck,
} from "@/types/health";
import fs from "fs/promises";
import path from "path";

// Track service start time
const SERVICE_START_TIME = Date.now();

// In-memory error tracking (last hour)
const errorLog: { timestamp: number; error: string }[] = [];

// Performance metrics tracking (last 100 operations)
const performanceMetrics = {
  dbQueries: [] as number[],
  apiCalls: [] as number[],
  syncOperations: [] as number[],
};

export class AppHealthCheck {
  private static instance: AppHealthCheck;
  private supabase: any;

  private constructor() {
    // Initialize Supabase client for health checks
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }

  static getInstance(): AppHealthCheck {
    if (!AppHealthCheck.instance) {
      AppHealthCheck.instance = new AppHealthCheck();
    }
    return AppHealthCheck.instance;
  }

  async checkHealth(): Promise<SystemHealth> {
    const services: ServiceHealth[] = [];

    // Check database connectivity
    const dbHealth = await this.checkDatabase();
    services.push(dbHealth);

    // Check OAuth token validity
    const authHealth = await this.checkOAuthTokens();
    services.push(authHealth);

    // Calculate overall status
    const overall = this.calculateOverallStatus(services);

    // Get error count from last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentErrors = errorLog.filter(
      (e) => e.timestamp > oneHourAgo
    ).length;

    // Calculate uptime
    const uptimeSeconds = Math.floor((Date.now() - SERVICE_START_TIME) / 1000);

    // Calculate average performance metrics
    const avgDbQueryTime = this.calculateAverage(performanceMetrics.dbQueries);
    const avgApiCallTime = this.calculateAverage(performanceMetrics.apiCalls);
    const avgSyncTime = this.calculateAverage(
      performanceMetrics.syncOperations
    );

    // Write health check to JSONL log
    await this.logHealthCheck({
      timestamp: new Date().toISOString(),
      service: "rss-reader-app",
      status: overall,
      uptime: uptimeSeconds,
      errorCount: recentErrors,
      performance: {
        avgDbQueryTime,
        avgApiCallTime,
        avgSyncTime,
      },
    });

    return {
      status: overall,
      service: "rss-reader-app",
      uptime: uptimeSeconds,
      lastActivity: new Date().toISOString(),
      errorCount: recentErrors,
      dependencies: {
        database: dbHealth.status,
        oauth: authHealth.status,
      },
      performance: {
        avgDbQueryTime,
        avgApiCallTime,
        avgSyncTime,
      },
      details: {
        services,
      },
    };
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];

    try {
      const start = Date.now();

      // Test basic connectivity with a simple query
      const { data, error } = await this.supabase
        .from("system_config")
        .select("key")
        .limit(1)
        .single();

      const duration = Date.now() - start;

      // Track performance
      this.trackPerformance("dbQueries", duration);

      if (error) {
        checks.push({
          name: "connectivity",
          status: "unhealthy",
          message: "Database connection failed",
          duration,
          error: error.message,
        });
      } else {
        checks.push({
          name: "connectivity",
          status: "healthy",
          message: "Database connection successful",
          duration,
        });

        // Check database performance
        // Threshold: 300ms for degraded, 1000ms for unhealthy
        if (duration > 1000) {
          checks.push({
            name: "performance",
            status: "unhealthy",
            message: `Database response very slow: ${duration}ms`,
            duration,
          });
        } else if (duration > 300) {
          checks.push({
            name: "performance",
            status: "degraded",
            message: `Database response slow: ${duration}ms`,
            duration,
          });
        } else {
          checks.push({
            name: "performance",
            status: "healthy",
            message: `Database response time: ${duration}ms`,
            duration,
          });
        }
      }
    } catch (error) {
      checks.push({
        name: "connectivity",
        status: "unhealthy",
        message: "Database check failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const status = this.calculateServiceStatus(checks);

    return {
      name: "database",
      displayName: "Supabase Database",
      status,
      lastCheck: new Date(),
      message: this.getServiceMessage("database", status),
      checks,
    };
  }

  private async checkOAuthTokens(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];

    try {
      // Check if token file exists
      const tokenPath = path.join(
        process.env.HOME || "/Users/shayon",
        ".rss-reader",
        "tokens.json"
      );

      const exists = await fs
        .access(tokenPath)
        .then(() => true)
        .catch(() => false);

      if (!exists) {
        checks.push({
          name: "token-file",
          status: "unhealthy",
          message: "OAuth token file not found",
        });
      } else {
        // Read and check token validity
        const tokenData = await fs.readFile(tokenPath, "utf-8");
        const tokens = JSON.parse(tokenData);

        if (!tokens.encrypted) {
          checks.push({
            name: "token-file",
            status: "unhealthy",
            message: "OAuth tokens not properly encrypted",
          });
        } else {
          // Check token existence (we can't decrypt to check expiry without the key)
          // Tokens typically last 1 year from creation
          const fileStats = await fs.stat(tokenPath);
          const tokenAge = Date.now() - fileStats.mtime.getTime();
          const daysOld = Math.floor(tokenAge / (1000 * 60 * 60 * 24));

          // Assume tokens expire after 365 days
          const daysRemaining = Math.max(0, 365 - daysOld);

          if (daysRemaining < 30) {
            // Less than 30 days remaining
            checks.push({
              name: "token-validity",
              status: "degraded",
              message: `OAuth tokens may be expiring soon (approx ${daysRemaining} days left)`,
            });
          } else {
            checks.push({
              name: "token-validity",
              status: "healthy",
              message: `OAuth tokens valid (approx ${daysRemaining} days remaining)`,
            });
          }
        }
      }
    } catch (error) {
      checks.push({
        name: "oauth",
        status: "unhealthy",
        message: "OAuth check failed",
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const status = this.calculateServiceStatus(checks);

    return {
      name: "oauth",
      displayName: "OAuth Authentication",
      status,
      lastCheck: new Date(),
      message: this.getServiceMessage("oauth", status),
      checks,
    };
  }

  private calculateOverallStatus(services: ServiceHealth[]): HealthStatus {
    const statuses = services.map((s) => s.status);

    if (statuses.includes("unhealthy")) {
      return "unhealthy";
    } else if (statuses.includes("degraded")) {
      return "degraded";
    }
    return "healthy";
  }

  private calculateServiceStatus(checks: ComponentHealthCheck[]): HealthStatus {
    const statuses = checks.map((c) => c.status);

    if (statuses.includes("unhealthy")) {
      return "unhealthy";
    } else if (statuses.includes("degraded")) {
      return "degraded";
    }
    return "healthy";
  }

  private getServiceMessage(service: string, status: HealthStatus): string {
    const messages = {
      healthy: `${service} is operating normally`,
      degraded: `${service} is experiencing minor issues`,
      unhealthy: `${service} is experiencing major issues`,
      unknown: `${service} status cannot be determined`,
    };
    return messages[status];
  }

  private trackPerformance(
    metric: keyof typeof performanceMetrics,
    duration: number
  ) {
    const metrics = performanceMetrics[metric];
    metrics.push(duration);

    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
  }

  private async logHealthCheck(data: any) {
    try {
      const logPath = path.join(process.cwd(), "logs", "health-checks.jsonl");
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, JSON.stringify(data) + "\n");
    } catch (error) {
      console.error("Failed to log health check:", error);
    }
  }

  // Public method to log errors (called from other parts of the app)
  static logError(error: string) {
    errorLog.push({
      timestamp: Date.now(),
      error,
    });

    // Keep only last hour of errors
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    while (errorLog.length > 0 && errorLog[0].timestamp < oneHourAgo) {
      errorLog.shift();
    }
  }

  // Public method to track performance (called from other parts of the app)
  static trackMetric(
    type: "dbQueries" | "apiCalls" | "syncOperations",
    duration: number
  ) {
    const instance = AppHealthCheck.getInstance();
    instance.trackPerformance(type, duration);
  }
}

export const appHealthCheck = AppHealthCheck.getInstance();
