import { vi } from "vitest";
import type { UISystemHealth, HealthStatus } from "@/types/health";

/**
 * Creates a mock health check result for testing
 */
export function createMockHealthCheckResult(
  overrides?: Partial<UISystemHealth>
): UISystemHealth {
  return {
    status: "healthy" as HealthStatus,
    timestamp: new Date(),
    metrics: {
      uptime: 3600,
      totalChecks: 1,
      failedChecks: 0,
      avgResponseTime: 50,
    },
    services: [
      {
        name: "database",
        displayName: "Database",
        status: "healthy" as HealthStatus,
        lastCheck: new Date(),
        message: "Database connection established",
        checks: [
          {
            name: "connection",
            status: "healthy" as HealthStatus,
            message: "Database connection established",
          },
        ],
      },
      {
        name: "network",
        displayName: "Network",
        status: "healthy" as HealthStatus,
        lastCheck: new Date(),
        message: "Network connectivity verified",
        checks: [
          {
            name: "connectivity",
            status: "healthy" as HealthStatus,
            message: "Network connectivity verified",
          },
        ],
      },
      {
        name: "cache",
        displayName: "Cache",
        status: "healthy" as HealthStatus,
        lastCheck: new Date(),
        message: "Service worker registered",
        checks: [
          {
            name: "service-worker",
            status: "healthy" as HealthStatus,
            message: "Service worker registered",
          },
        ],
      },
    ],
    ...overrides,
  };
}

/**
 * Creates a mock HealthCheckService instance
 */
export function createMockHealthCheckService() {
  const mockService = {
    checkHealth: vi.fn().mockResolvedValue(createMockHealthCheckResult()),
    reset: vi.fn(),
    getInstance: vi.fn(),
  };

  // Make getInstance return the mock service
  mockService.getInstance.mockReturnValue(mockService);

  return mockService;
}

/**
 * Setup health check service mocks for tests
 */
export function setupHealthCheckMocks() {
  const mockService = createMockHealthCheckService();

  vi.mock("@/lib/health/health-check-service", () => ({
    HealthCheckService: {
      getInstance: () => mockService,
    },
  }));

  return mockService;
}
