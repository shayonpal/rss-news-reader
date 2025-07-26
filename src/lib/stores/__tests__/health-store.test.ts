import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useHealthStore } from '../health-store';
import { healthCheckService } from '@/lib/health/health-check-service';
import type { SystemHealth, HealthAlert, HealthCheckHistory, HealthStatus } from '@/types/health';

// Mock the health check service
vi.mock('@/lib/health/health-check-service', () => ({
  healthCheckService: {
    checkHealth: vi.fn(),
  },
}));

describe('HealthStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    useHealthStore.setState({
      currentHealth: null,
      isChecking: false,
      lastCheckError: null,
      checkHistory: [],
      alerts: [],
      unreadAlertCount: 0,
      autoCheckEnabled: true,
      checkInterval: 5,
    });
    vi.clearAllMocks();
  });

  describe('performHealthCheck', () => {
    it('should update current health on successful check', async () => {
      const mockHealth: SystemHealth = {
        status: 'healthy',
        timestamp: new Date(),
        services: [],
        metrics: {
          uptime: 3600,
          totalChecks: 10,
          failedChecks: 0,
          avgResponseTime: 100,
        },
      };

      (healthCheckService.checkHealth as any).mockResolvedValue(mockHealth);

      const { performHealthCheck } = useHealthStore.getState();
      await performHealthCheck();

      const state = useHealthStore.getState();
      expect(state.currentHealth).toEqual(mockHealth);
      expect(state.isChecking).toBe(false);
      expect(state.lastCheckError).toBe(null);
    });

    it('should add to check history', async () => {
      const mockHealth: SystemHealth = {
        status: 'healthy',
        timestamp: new Date(),
        services: [
          {
            name: 'database',
            displayName: 'Database',
            status: 'healthy',
            lastCheck: new Date(),
            message: 'Database is healthy',
            checks: [],
          },
        ],
        metrics: {
          uptime: 3600,
          totalChecks: 10,
          failedChecks: 0,
          avgResponseTime: 100,
        },
      };

      (healthCheckService.checkHealth as any).mockResolvedValue(mockHealth);

      const { performHealthCheck } = useHealthStore.getState();
      await performHealthCheck();

      const state = useHealthStore.getState();
      expect(state.checkHistory).toHaveLength(1);
      expect(state.checkHistory[0].status).toBe('healthy');
      expect(state.checkHistory[0].services).toHaveLength(1);
    });

    it('should limit check history to 100 entries', async () => {
      const mockHealth: SystemHealth = {
        status: 'healthy',
        timestamp: new Date(),
        services: [],
        metrics: {
          uptime: 3600,
          totalChecks: 10,
          failedChecks: 0,
          avgResponseTime: 100,
        },
      };

      (healthCheckService.checkHealth as any).mockResolvedValue(mockHealth);

      // Add 100 entries to history first
      const initialHistory: HealthCheckHistory[] = Array(100).fill(null).map((_, i) => ({
        id: `check-${i}`,
        timestamp: new Date(),
        status: 'healthy' as const,
        services: [],
        alerts: [],
      }));
      useHealthStore.setState({ checkHistory: initialHistory });

      const { performHealthCheck } = useHealthStore.getState();
      await performHealthCheck();

      const state = useHealthStore.getState();
      expect(state.checkHistory).toHaveLength(100);
      expect(state.checkHistory[0].id).toContain('check-'); // Most recent
    });

    it('should handle check failures', async () => {
      const error = new Error('Health check failed');
      (healthCheckService.checkHealth as any).mockRejectedValue(error);

      const { performHealthCheck } = useHealthStore.getState();
      await performHealthCheck();

      const state = useHealthStore.getState();
      expect(state.currentHealth).toBe(null);
      expect(state.isChecking).toBe(false);
      expect(state.lastCheckError).toBe('Health check failed');
    });
  });

  describe('Alert Management', () => {
    it('should generate alerts for unhealthy system', async () => {
      const mockHealth: SystemHealth = {
        overall: 'unhealthy',
        timestamp: new Date(),
        services: [],
        metrics: {
          uptime: 3600,
          totalChecks: 10,
          failedChecks: 0,
          avgResponseTime: 100,
        },
      };

      (healthCheckService.checkHealth as any).mockResolvedValue(mockHealth);

      const { performHealthCheck } = useHealthStore.getState();
      await performHealthCheck();

      const state = useHealthStore.getState();
      expect(state.alerts.length).toBeGreaterThan(0);
      expect(state.alerts[0].severity).toBe('critical');
      expect(state.unreadAlertCount).toBeGreaterThan(0);
    });

    it('should generate alerts for degraded services', async () => {
      const mockHealth: SystemHealth = {
        overall: 'degraded',
        timestamp: new Date(),
        services: [
          {
            name: 'api',
            displayName: 'External APIs',
            status: 'degraded',
            lastCheck: new Date(),
            message: 'API is degraded',
            checks: [
              {
                name: 'inoreader',
                status: 'degraded',
                message: 'Low API quota',
              },
            ],
          },
        ],
        metrics: {
          uptime: 3600,
          totalChecks: 10,
          failedChecks: 0,
          avgResponseTime: 100,
        },
      };

      (healthCheckService.checkHealth as any).mockResolvedValue(mockHealth);

      const { performHealthCheck } = useHealthStore.getState();
      await performHealthCheck();

      const state = useHealthStore.getState();
      const apiAlerts = state.alerts.filter(a => a.service === 'api');
      expect(apiAlerts.length).toBeGreaterThan(0);
      expect(apiAlerts[0].severity).toBe('warning');
    });

    it('should acknowledge alerts', () => {
      const alert: HealthAlert = {
        id: 'alert-1',
        service: 'database',
        severity: 'error',
        message: 'Database error',
        timestamp: new Date(),
        acknowledged: false,
        autoResolve: true,
      };

      useHealthStore.setState({ alerts: [alert], unreadAlertCount: 1 });

      const { acknowledgeAlert } = useHealthStore.getState();
      acknowledgeAlert('alert-1');

      const state = useHealthStore.getState();
      expect(state.alerts[0].acknowledged).toBe(true);
      expect(state.unreadAlertCount).toBe(0);
    });

    it('should dismiss alerts', () => {
      const alerts: HealthAlert[] = [
        {
          id: 'alert-1',
          service: 'database',
          severity: 'error',
          message: 'Database error',
          timestamp: new Date(),
          acknowledged: false,
          autoResolve: true,
        },
        {
          id: 'alert-2',
          service: 'api',
          severity: 'warning',
          message: 'API warning',
          timestamp: new Date(),
          acknowledged: false,
          autoResolve: true,
        },
      ];

      useHealthStore.setState({ alerts, unreadAlertCount: 2 });

      const { dismissAlert } = useHealthStore.getState();
      dismissAlert('alert-1');

      const state = useHealthStore.getState();
      expect(state.alerts).toHaveLength(1);
      expect(state.alerts[0].id).toBe('alert-2');
      expect(state.unreadAlertCount).toBe(1);
    });

    it('should clear all alerts', () => {
      const alerts: HealthAlert[] = Array(5).fill(null).map((_, i) => ({
        id: `alert-${i}`,
        service: 'test',
        severity: 'info',
        message: 'Test alert',
        timestamp: new Date(),
        acknowledged: false,
        autoResolve: true,
      }));

      useHealthStore.setState({ alerts, unreadAlertCount: 5 });

      const { clearAlerts } = useHealthStore.getState();
      clearAlerts();

      const state = useHealthStore.getState();
      expect(state.alerts).toHaveLength(0);
      expect(state.unreadAlertCount).toBe(0);
    });
  });

  describe('Settings', () => {
    it('should update auto check setting', () => {
      const { setAutoCheck } = useHealthStore.getState();
      setAutoCheck(false);

      const state = useHealthStore.getState();
      expect(state.autoCheckEnabled).toBe(false);
    });

    it('should update check interval', () => {
      const { setCheckInterval } = useHealthStore.getState();
      setCheckInterval(10);

      const state = useHealthStore.getState();
      expect(state.checkInterval).toBe(10);
    });
  });

  describe('Health Trend', () => {
    it('should return health trend from history', () => {
      const history: HealthCheckHistory[] = Array(15).fill(null).map((_, i) => ({
        id: `check-${i}`,
        timestamp: new Date(),
        status: (i % 3 === 0 ? 'healthy' : i % 3 === 1 ? 'degraded' : 'unhealthy') as HealthStatus,
        services: [],
        alerts: [],
      }));

      useHealthStore.setState({ checkHistory: history });

      const { getHealthTrend } = useHealthStore.getState();
      const trend = getHealthTrend();

      expect(trend).toHaveLength(10); // Last 10 items
      expect(trend[0]).toBe(history[9].status); // Reversed order
      expect(trend[9]).toBe(history[0].status);
    });

    it('should handle empty history', () => {
      const { getHealthTrend } = useHealthStore.getState();
      const trend = getHealthTrend();

      expect(trend).toHaveLength(0);
    });
  });

  describe('Persistence', () => {
    it('should only persist specific state properties', () => {
      const state = {
        currentHealth: null,
        isChecking: true,
        lastCheckError: 'Some error',
        checkHistory: Array(30).fill(null).map((_, i) => ({
          id: `check-${i}`,
          timestamp: new Date(),
          status: 'healthy' as const,
          services: [],
          alerts: [],
        })),
        alerts: [
          {
            id: 'alert-1',
            service: 'test',
            severity: 'info' as const,
            message: 'Test',
            timestamp: new Date(),
            acknowledged: false,
            autoResolve: true,
          },
          {
            id: 'alert-2',
            service: 'test',
            severity: 'error' as const,
            message: 'Test',
            timestamp: new Date(),
            acknowledged: false,
            autoResolve: false, // Should be persisted
          },
        ],
        unreadAlertCount: 2,
        autoCheckEnabled: false,
        checkInterval: 10,
      };

      useHealthStore.setState(state);

      // Get the partialize function from the store configuration
      const persistConfig = (useHealthStore as any).persist;
      const partialState = persistConfig.partialize(state);

      // Check persisted state
      expect(partialState.checkHistory).toHaveLength(20); // Only last 20
      expect(partialState.autoCheckEnabled).toBe(false);
      expect(partialState.checkInterval).toBe(10);
      expect(partialState.alerts).toHaveLength(1); // Only non-auto-resolve
      expect(partialState.alerts[0].id).toBe('alert-2');
      
      // These should not be persisted
      expect(partialState.currentHealth).toBeUndefined();
      expect(partialState.isChecking).toBeUndefined();
      expect(partialState.lastCheckError).toBeUndefined();
    });
  });
});