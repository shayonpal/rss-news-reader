import { describe, it, expect, vi, beforeEach } from "vitest";
import { useHealthStore } from "../health-store";
import { healthCheckService } from "@/lib/health/health-check-service";
import type {
  UISystemHealth,
  HealthAlert,
  HealthCheckHistory,
  HealthStatus,
} from "@/types/health";

// Mock the health check service
vi.mock("@/lib/health/health-check-service", () => ({
  healthCheckService: {
    checkHealth: vi.fn(),
  },
}));

describe("HealthStore", () => {
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

  describe("performHealthCheck", () => {
    it("should update current health on successful check", async () => {
      const mockHealth: UISystemHealth = {
        status: "healthy",
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

      const store = useHealthStore.getState();
      await store.performHealthCheck();

      const updatedState = useHealthStore.getState();
      expect(updatedState.currentHealth).toEqual(mockHealth);
      expect(updatedState.isChecking).toBe(false);
      expect(updatedState.lastCheckError).toBeNull();
    });

    it("should handle check errors", async () => {
      const errorMessage = "Health check failed";
      (healthCheckService.checkHealth as any).mockRejectedValue(
        new Error(errorMessage)
      );

      const store = useHealthStore.getState();
      await store.performHealthCheck();

      const updatedState = useHealthStore.getState();
      expect(updatedState.currentHealth).toBeNull();
      expect(updatedState.isChecking).toBe(false);
      expect(updatedState.lastCheckError).toBe(errorMessage);
    });
  });

  describe("acknowledgeAlert", () => {
    it("should acknowledge alert and update unread count", () => {
      const alert: HealthAlert = {
        id: "alert-1",
        service: "database",
        severity: "error",
        message: "Connection failed",
        timestamp: new Date(),
        acknowledged: false,
        autoResolve: false,
      };

      // Set up initial state with an alert
      useHealthStore.setState({
        alerts: [alert],
        unreadAlertCount: 1,
      });

      const store = useHealthStore.getState();
      store.acknowledgeAlert("alert-1");

      const updatedState = useHealthStore.getState();
      const acknowledgedAlert = updatedState.alerts.find(
        (a) => a.id === "alert-1"
      );
      expect(acknowledgedAlert?.acknowledged).toBe(true);
      expect(updatedState.unreadAlertCount).toBe(0);
    });
  });

  describe("clearAlerts", () => {
    it("should clear all alerts", () => {
      const alerts: HealthAlert[] = [
        {
          id: "alert-1",
          service: "database",
          severity: "error",
          message: "Connection failed",
          timestamp: new Date(),
          acknowledged: false,
          autoResolve: false,
        },
      ];

      useHealthStore.setState({
        alerts,
        unreadAlertCount: 1,
      });

      const store = useHealthStore.getState();
      store.clearAlerts();

      const updatedState = useHealthStore.getState();
      expect(updatedState.alerts).toHaveLength(0);
      expect(updatedState.unreadAlertCount).toBe(0);
    });
  });
});
