// Server-side health check that only checks server-accessible services
import type {
  SystemHealth,
  ServiceHealth,
  HealthStatus,
  ComponentHealthCheck,
  ApiHealth,
  AuthHealth,
} from "@/types/health";

export class ServerHealthCheck {
  private static instance: ServerHealthCheck;

  private constructor() {}

  static getInstance(): ServerHealthCheck {
    if (!ServerHealthCheck.instance) {
      ServerHealthCheck.instance = new ServerHealthCheck();
    }
    return ServerHealthCheck.instance;
  }

  async checkHealth(): Promise<SystemHealth> {
    const services: ServiceHealth[] = [];

    // Check APIs
    const apiHealth = await this.checkApis();
    services.push(apiHealth);

    // Check auth
    const authHealth = await this.checkAuth();
    services.push(authHealth);

    // Basic network check
    const networkHealth = await this.checkNetwork();
    services.push(networkHealth);

    const overall = this.calculateOverallStatus(services);

    return {
      status: overall,
      service: "rss-reader-server",
      uptime: 0, // Would need process tracking for real uptime
      lastActivity: new Date().toISOString(),
      errorCount: overall === "unhealthy" ? 1 : 0,
      dependencies: {
        api: services.find((s) => s.name === "api")?.status || "unknown",
        auth: services.find((s) => s.name === "auth")?.status || "unknown",
        network:
          services.find((s) => s.name === "network")?.status || "unknown",
      },
      performance: {
        avgSyncTime: 0,
        avgDbQueryTime: 0,
        avgApiCallTime: 0,
      },
    };
  }

  private async checkApis(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];

    // Check Inoreader API
    const inoreaderCheck = await this.checkInoreaderApi();
    checks.push(inoreaderCheck);

    // Check Claude API
    const claudeCheck = await this.checkClaudeApi();
    checks.push(claudeCheck);

    const status = this.calculateServiceStatus(checks);

    return {
      name: "api",
      displayName: "External APIs",
      status,
      lastCheck: new Date(),
      message: this.getServiceMessage("api", status),
      checks,
    };
  }

  private async checkInoreaderApi(): Promise<ApiHealth> {
    // DISABLED: Inoreader API is now handled server-side only
    return {
      name: "inoreader",
      status: "unknown",
      message: "Inoreader API check disabled (server-side auth only)",
      duration: 0,
      details: {
        endpoint: "N/A - Server-side only",
        responseTime: 0,
        statusCode: 0,
      },
    };
  }

  private async checkClaudeApi(): Promise<ApiHealth> {
    // DISABLED: Claude API health check endpoint removed
    return {
      name: "claude",
      status: "unknown",
      message: "Claude API check disabled (endpoint removed)",
      duration: 0,
      details: {
        endpoint: "N/A - Endpoint removed",
        responseTime: 0,
        statusCode: 0,
      },
    };
  }

  private async checkAuth(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];

    // DISABLED: Authentication is now handled server-side only
    const authCheck: AuthHealth = {
      name: "authentication",
      status: "unknown",
      message: "Authentication check disabled (server-side auth only)",
      details: {
        authenticated: false,
        tokenValid: false,
        refreshAvailable: false,
      },
    };

    checks.push(authCheck);

    const status = this.calculateServiceStatus(checks);

    return {
      name: "auth",
      displayName: "Authentication",
      status,
      lastCheck: new Date(),
      message: this.getServiceMessage("auth", status),
      checks,
    };
  }

  private async checkNetwork(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];

    // Basic external connectivity check
    const start = Date.now();
    try {
      const response = await fetch("https://www.google.com/favicon.ico", {
        signal: AbortSignal.timeout(5000),
      });

      checks.push({
        name: "external",
        status: "healthy",
        message: "External connectivity verified",
        duration: Date.now() - start,
      });
    } catch (error) {
      checks.push({
        name: "external",
        status: "degraded",
        message: "External connectivity issues",
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    const status = this.calculateServiceStatus(checks);

    return {
      name: "network",
      displayName: "Network Connectivity",
      status,
      lastCheck: new Date(),
      message: this.getServiceMessage("network", status),
      checks,
    };
  }

  private calculateOverallStatus(services: ServiceHealth[]): HealthStatus {
    const statuses = services.map((s) => s.status);

    if (statuses.includes("unhealthy")) {
      return "unhealthy";
    } else if (statuses.includes("degraded")) {
      return "degraded";
    } else if (statuses.includes("unknown")) {
      return "unknown";
    }
    return "healthy";
  }

  private calculateServiceStatus(checks: ComponentHealthCheck[]): HealthStatus {
    const statuses = checks.map((c) => c.status);

    if (statuses.every((s) => s === "healthy")) {
      return "healthy";
    } else if (statuses.includes("unhealthy")) {
      return "unhealthy";
    } else if (statuses.includes("degraded")) {
      return "degraded";
    }
    return "unknown";
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
}

export const serverHealthCheck = ServerHealthCheck.getInstance();
