import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  UISystemHealth,
  HealthAlert,
  HealthCheckHistory,
  HealthStatus,
} from "@/types/health";
import { healthCheckService } from "@/lib/health/health-check-service";

interface HealthState {
  // Current health status
  currentHealth: UISystemHealth | null;
  isChecking: boolean;
  lastCheckError: string | null;

  // History
  checkHistory: HealthCheckHistory[];

  // Alerts
  alerts: HealthAlert[];
  unreadAlertCount: number;

  // Settings
  autoCheckEnabled: boolean;
  checkInterval: number; // in minutes

  // Actions
  performHealthCheck: () => Promise<void>;
  clearError: () => void;
  acknowledgeAlert: (alertId: string) => void;
  dismissAlert: (alertId: string) => void;
  clearAlerts: () => void;
  setAutoCheck: (enabled: boolean) => void;
  setCheckInterval: (minutes: number) => void;
  getHealthTrend: () => HealthStatus[];
}

// Helper function to generate alerts from health status
function generateAlerts(health: UISystemHealth): HealthAlert[] {
  const alerts: HealthAlert[] = [];
  const timestamp = new Date();

  // Check overall system health
  if (health.status === "unhealthy") {
    alerts.push({
      id: `alert-${Date.now()}-system`,
      service: "system",
      severity: "critical",
      message: "System is experiencing critical issues",
      timestamp,
      acknowledged: false,
      autoResolve: true,
    });
  } else if (health.status === "degraded") {
    alerts.push({
      id: `alert-${Date.now()}-system`,
      service: "system",
      severity: "warning",
      message: "System is experiencing degraded performance",
      timestamp,
      acknowledged: false,
      autoResolve: true,
    });
  }

  // Check individual services
  health.services.forEach((service) => {
    if (service.status === "unhealthy") {
      alerts.push({
        id: `alert-${Date.now()}-${service.name}`,
        service: service.name,
        severity: "error",
        message: `${service.displayName} is not functioning properly`,
        timestamp,
        acknowledged: false,
        autoResolve: true,
      });
    } else if (service.status === "degraded") {
      // Check for specific issues
      service.checks.forEach((check) => {
        if (check.status === "unhealthy" || check.status === "degraded") {
          alerts.push({
            id: `alert-${Date.now()}-${service.name}-${check.name}`,
            service: service.name,
            component: check.name,
            severity: check.status === "unhealthy" ? "error" : "warning",
            message: check.message,
            timestamp,
            acknowledged: false,
            autoResolve: true,
          });
        }
      });
    }
  });

  // Check metrics for issues
  if (health.metrics.avgResponseTime > 5000) {
    alerts.push({
      id: `alert-${Date.now()}-performance`,
      service: "system",
      severity: "warning",
      message: `High average response time: ${Math.round(health.metrics.avgResponseTime)}ms`,
      timestamp,
      acknowledged: false,
      autoResolve: true,
    });
  }

  if (health.metrics.failedChecks > health.metrics.totalChecks * 0.3) {
    alerts.push({
      id: `alert-${Date.now()}-reliability`,
      service: "system",
      severity: "error",
      message: `High failure rate: ${Math.round((health.metrics.failedChecks / health.metrics.totalChecks) * 100)}%`,
      timestamp,
      acknowledged: false,
      autoResolve: false,
    });
  }

  return alerts;
}

export const useHealthStore = create<HealthState>()(
  persist(
    (set, get) => ({
      // Initial state
      currentHealth: null,
      isChecking: false,
      lastCheckError: null,
      checkHistory: [],
      alerts: [],
      unreadAlertCount: 0,
      autoCheckEnabled: true,
      checkInterval: 5, // 5 minutes default

      // Perform health check
      performHealthCheck: async () => {
        set({ isChecking: true, lastCheckError: null });

        try {
          const health = await healthCheckService.checkHealth();

          // Update current health
          set({ currentHealth: health, isChecking: false });

          // Add to history (keep last 100 entries)
          const history = get().checkHistory;
          const newEntry: HealthCheckHistory = {
            id: `check-${Date.now()}`,
            timestamp: health.timestamp,
            overall: health.status,
            services: health.services.map((s) => ({
              name: s.name,
              status: s.status,
              duration: s.checks.reduce((sum, c) => sum + (c.duration || 0), 0),
            })),
            alerts: [],
          };

          const updatedHistory = [newEntry, ...history].slice(0, 100);
          set({ checkHistory: updatedHistory });

          // Generate alerts based on health status
          const alerts = generateAlerts(health);
          if (alerts.length > 0) {
            set((state) => ({
              alerts: [...alerts, ...state.alerts].slice(0, 50), // Keep last 50 alerts
              unreadAlertCount: state.unreadAlertCount + alerts.length,
            }));
          }
        } catch (error) {
          console.error("Health check failed:", error);
          set({
            isChecking: false,
            lastCheckError:
              error instanceof Error ? error.message : "Health check failed",
          });
        }
      },

      // Clear error
      clearError: () => set({ lastCheckError: null }),

      // Alert management
      acknowledgeAlert: (alertId: string) => {
        set((state) => ({
          alerts: state.alerts.map((alert) =>
            alert.id === alertId ? { ...alert, acknowledged: true } : alert
          ),
          unreadAlertCount: Math.max(0, state.unreadAlertCount - 1),
        }));
      },

      dismissAlert: (alertId: string) => {
        set((state) => ({
          alerts: state.alerts.filter((alert) => alert.id !== alertId),
          unreadAlertCount: state.alerts.find(
            (a) => a.id === alertId && !a.acknowledged
          )
            ? Math.max(0, state.unreadAlertCount - 1)
            : state.unreadAlertCount,
        }));
      },

      clearAlerts: () => set({ alerts: [], unreadAlertCount: 0 }),

      // Settings
      setAutoCheck: (enabled: boolean) => set({ autoCheckEnabled: enabled }),
      setCheckInterval: (minutes: number) => set({ checkInterval: minutes }),

      // Get health trend from history
      getHealthTrend: () => {
        const history = get().checkHistory;
        return history
          .slice(0, 10)
          .map((h) => h.overall)
          .reverse();
      },
    }),
    {
      name: "health-storage",
      partialize: (state) => ({
        // Persist settings and some history
        checkHistory: state.checkHistory.slice(0, 20), // Keep last 20 for persistence
        autoCheckEnabled: state.autoCheckEnabled,
        checkInterval: state.checkInterval,
        alerts: state.alerts.filter((a) => !a.autoResolve), // Only persist non-auto-resolve alerts
      }),
    }
  )
);

// Auto health check hook
export function useAutoHealthCheck() {
  const { autoCheckEnabled, checkInterval, performHealthCheck } =
    useHealthStore();

  if (typeof window !== "undefined" && autoCheckEnabled) {
    const interval = setInterval(
      async () => {
        await performHealthCheck();
      },
      checkInterval * 60 * 1000
    );

    return () => clearInterval(interval);
  }
}
