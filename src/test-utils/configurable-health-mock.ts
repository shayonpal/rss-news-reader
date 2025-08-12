import { vi } from "vitest";
import type {
  UISystemHealth,
  HealthStatus,
  ServiceHealth,
  ComponentHealthCheck,
} from "@/types/health";

/**
 * Configurable health check service mock that can simulate different conditions
 */
export class ConfigurableHealthCheckMock {
  private mockHealth: UISystemHealth;
  private checkHealthImpl: any;

  constructor() {
    this.mockHealth = this.createDefaultHealth();
    this.checkHealthImpl = vi.fn().mockImplementation(() => {
      // Return a copy to prevent mutations affecting the mock
      return Promise.resolve(JSON.parse(JSON.stringify(this.mockHealth)));
    });
  }

  private createDefaultHealth(): UISystemHealth {
    return {
      status: "healthy",
      timestamp: new Date(),
      services: [
        {
          name: "database",
          displayName: "Database",
          status: "healthy",
          lastCheck: new Date(),
          message: "Database operational",
          checks: [
            {
              name: "connection",
              status: "healthy",
              message: "Database connected",
            },
          ],
        },
        {
          name: "network",
          displayName: "Network",
          status: "healthy",
          lastCheck: new Date(),
          message: "Network available",
          checks: [
            {
              name: "connectivity",
              status: "healthy",
              message: "Network connected",
            },
          ],
        },
        {
          name: "cache",
          displayName: "Cache",
          status: "healthy",
          lastCheck: new Date(),
          message: "Cache operational",
          checks: [
            {
              name: "service-worker",
              status: "healthy",
              message: "Service worker registered",
            },
            {
              name: "local-storage",
              status: "healthy",
              message: "Local storage available",
            },
          ],
        },
      ],
      metrics: {
        uptime: 3600,
        totalChecks: 1,
        failedChecks: 0,
        avgResponseTime: 50,
      },
    };
  }

  setHealthStatus(status: HealthStatus): void {
    this.mockHealth.status = status;
    // Update all services to match overall status
    this.mockHealth.services.forEach((service) => {
      service.status = status;
      service.checks.forEach((check) => {
        check.status = status;
        check.message = `${check.name} ${status}`;
      });
    });
    this.updateMockImplementation();
  }

  private updateMockImplementation(): void {
    this.checkHealthImpl.mockImplementation(() => {
      return Promise.resolve(JSON.parse(JSON.stringify(this.mockHealth)));
    });
  }

  setServiceStatus(
    serviceName: string,
    status: HealthStatus,
    message?: string
  ): void {
    const service = this.mockHealth.services.find(
      (s) => s.name === serviceName
    );
    if (service) {
      service.status = status;
      service.message = message || `${serviceName} ${status}`;
      service.checks.forEach((check) => {
        check.status = status;
        check.message = message || `${check.name} ${status}`;
      });
      // Update overall status
      this.updateOverallStatus();
    }
    this.updateMockImplementation();
  }

  setCheckStatus(
    serviceName: string,
    checkName: string,
    status: HealthStatus,
    message?: string
  ): void {
    const service = this.mockHealth.services.find(
      (s) => s.name === serviceName
    );
    if (service) {
      const check = service.checks.find((c) => c.name === checkName);
      if (check) {
        check.status = status;
        check.message = message || `${checkName} ${status}`;
        // Update service status based on checks
        service.status = this.calculateServiceStatus(service.checks);
        // Update overall status
        this.updateOverallStatus();
      }
    }
  }

  simulateServerEnvironment(): void {
    // Simulate server-side environment where browser APIs are not available
    const cacheService = this.mockHealth.services.find(
      (s) => s.name === "cache"
    );
    if (cacheService) {
      cacheService.status = "unknown";
      cacheService.message = "Cache not available server-side";
      cacheService.checks.forEach((check) => {
        if (check.name === "service-worker" || check.name === "local-storage") {
          check.status = "unknown";
          check.message = `${check.name} not available server-side`;
        }
      });
    }

    const networkService = this.mockHealth.services.find(
      (s) => s.name === "network"
    );
    if (networkService) {
      networkService.status = "unknown";
      networkService.message = "Network status unknown server-side";
      networkService.checks.forEach((check) => {
        if (check.name === "connectivity") {
          check.status = "unknown";
          check.message = "Browser connectivity not available server-side";
        }
      });
    }

    this.updateOverallStatus();
    this.updateMockImplementation();
  }

  setCacheChecks(checkNames: string[]): void {
    const cacheService = this.mockHealth.services.find(
      (s) => s.name === "cache"
    );
    if (cacheService) {
      cacheService.checks = checkNames.map((name) => ({
        name,
        status: "healthy",
        message: `${name} available`,
      }));
    }
    this.updateMockImplementation();
  }

  simulateDatabaseFailure(): void {
    this.setServiceStatus(
      "database",
      "unhealthy",
      "Database connection failed"
    );
  }

  simulateNetworkFailure(): void {
    this.setServiceStatus("network", "unhealthy", "Network unavailable");
  }

  simulateCacheFailure(): void {
    this.setServiceStatus("cache", "unhealthy", "Cache service failed");
  }

  simulatePartialFailure(): void {
    this.setServiceStatus("database", "healthy");
    this.setServiceStatus("network", "degraded", "Network intermittent");
    this.setServiceStatus("cache", "healthy");
  }

  setCustomHealth(health: Partial<UISystemHealth>): void {
    this.mockHealth = {
      ...this.mockHealth,
      ...health,
    };
    this.updateMockImplementation();
  }

  setMockHealthFunction(
    fn: () => Promise<UISystemHealth> | UISystemHealth
  ): void {
    this.checkHealthImpl.mockImplementation(fn);
  }

  getService() {
    return {
      checkHealth: this.checkHealthImpl,
      reset: vi.fn(() => {
        this.mockHealth = this.createDefaultHealth();
      }),
    };
  }

  reset(): void {
    this.mockHealth = this.createDefaultHealth();
    // Update the mock implementation to return the new health state
    this.checkHealthImpl.mockImplementation(() => {
      return Promise.resolve(JSON.parse(JSON.stringify(this.mockHealth)));
    });
  }

  private calculateServiceStatus(checks: ComponentHealthCheck[]): HealthStatus {
    if (checks.every((c) => c.status === "healthy")) return "healthy";
    if (checks.some((c) => c.status === "unhealthy")) return "unhealthy";
    if (checks.some((c) => c.status === "degraded")) return "degraded";
    return "unknown";
  }

  private updateOverallStatus(): void {
    const statuses = this.mockHealth.services.map((s) => s.status);
    if (statuses.every((s) => s === "healthy")) {
      this.mockHealth.status = "healthy";
    } else if (statuses.some((s) => s === "unhealthy")) {
      this.mockHealth.status = "unhealthy";
    } else if (statuses.some((s) => s === "degraded")) {
      this.mockHealth.status = "degraded";
    } else {
      this.mockHealth.status = "unknown";
    }
  }
}

/**
 * Factory function to create and configure health check mocks
 */
export function createConfigurableHealthCheckMock() {
  return new ConfigurableHealthCheckMock();
}
