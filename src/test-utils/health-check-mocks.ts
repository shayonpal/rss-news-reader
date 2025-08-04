import { vi } from 'vitest';
import type { UISystemHealth, HealthStatus } from '@/types/health';

/**
 * Creates a mock health check result for testing
 */
export function createMockHealthCheckResult(overrides?: Partial<UISystemHealth>): UISystemHealth {
  return {
    status: 'healthy' as HealthStatus,
    timestamp: new Date().toISOString(),
    metrics: {
      totalChecks: 1,
      failedChecks: 0,
      lastCheck: new Date().toISOString(),
      avgResponseTime: 50
    },
    services: [
      {
        name: 'database',
        status: 'healthy' as HealthStatus,
        checks: [
          {
            name: 'connection',
            status: 'healthy' as HealthStatus,
            message: 'Database connection established'
          }
        ]
      },
      {
        name: 'network',
        status: 'healthy' as HealthStatus,
        checks: [
          {
            name: 'connectivity',
            status: 'healthy' as HealthStatus,
            message: 'Network connectivity verified'
          }
        ]
      },
      {
        name: 'cache',
        status: 'healthy' as HealthStatus,
        checks: [
          {
            name: 'service-worker',
            status: 'healthy' as HealthStatus,
            message: 'Service worker registered'
          }
        ]
      }
    ],
    ...overrides
  };
}

/**
 * Creates a mock HealthCheckService instance
 */
export function createMockHealthCheckService() {
  const mockService = {
    checkHealth: vi.fn().mockResolvedValue(createMockHealthCheckResult()),
    reset: vi.fn(),
    getInstance: vi.fn()
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
  
  vi.mock('@/lib/health/health-check-service', () => ({
    HealthCheckService: {
      getInstance: () => mockService
    }
  }));
  
  return mockService;
}