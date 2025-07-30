import { healthCheckService } from "./health-check-service";
import { useHealthStore } from "@/lib/stores/health-store";

export class HealthCheckScheduler {
  private static instance: HealthCheckScheduler;
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;

  private constructor() {}

  static getInstance(): HealthCheckScheduler {
    if (!HealthCheckScheduler.instance) {
      HealthCheckScheduler.instance = new HealthCheckScheduler();
    }
    return HealthCheckScheduler.instance;
  }

  start(): void {
    if (this.isRunning) {
      console.log("Health check scheduler already running");
      return;
    }

    const store = useHealthStore.getState();
    if (!store.autoCheckEnabled) {
      console.log("Auto health checks disabled");
      return;
    }

    this.isRunning = true;
    console.log(
      `Starting health check scheduler (interval: ${store.checkInterval} minutes)`
    );

    // Perform initial check
    this.performCheck();

    // Schedule regular checks
    const intervalMs = store.checkInterval * 60 * 1000;
    this.intervalId = setInterval(() => {
      this.performCheck();
    }, intervalMs);
  }

  stop(): void {
    if (!this.isRunning) {
      return;
    }

    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }

    this.isRunning = false;
    console.log("Health check scheduler stopped");
  }

  restart(): void {
    this.stop();
    this.start();
  }

  async performCheck(): Promise<void> {
    try {
      const store = useHealthStore.getState();
      await store.performHealthCheck();
    } catch (error) {
      console.error("Scheduled health check failed:", error);
    }
  }

  getStatus(): { isRunning: boolean; nextCheck: Date | null } {
    const store = useHealthStore.getState();
    let nextCheck: Date | null = null;

    if (this.isRunning && store.currentHealth) {
      const intervalMs = store.checkInterval * 60 * 1000;
      nextCheck = new Date(
        store.currentHealth.timestamp.getTime() + intervalMs
      );
    }

    return {
      isRunning: this.isRunning,
      nextCheck,
    };
  }
}

// Export singleton instance
export const healthScheduler = HealthCheckScheduler.getInstance();

// Browser-only auto-start function
export function initializeHealthScheduler(): void {
  if (typeof window === "undefined") {
    return;
  }

  // Start scheduler when the app loads
  healthScheduler.start();

  // Listen for visibility changes to pause/resume checks
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      console.log("App hidden, pausing health checks");
      healthScheduler.stop();
    } else {
      console.log("App visible, resuming health checks");
      healthScheduler.start();
    }
  });

  // Listen for online/offline events
  window.addEventListener("online", () => {
    console.log("Network online, resuming health checks");
    healthScheduler.start();
  });

  window.addEventListener("offline", () => {
    console.log("Network offline, pausing health checks");
    healthScheduler.stop();
  });

  // Subscribe to store changes
  useHealthStore.subscribe((state, prevState) => {
    // Restart if interval or enabled state changes
    if (
      state.autoCheckEnabled !== prevState.autoCheckEnabled ||
      state.checkInterval !== prevState.checkInterval
    ) {
      healthScheduler.restart();
    }
  });
}
