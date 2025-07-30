"use client";

import { Activity, Clock, TrendingUp, AlertCircle } from "lucide-react";
import type { HealthMetrics } from "@/types/health";

interface HealthMetricsCardProps {
  metrics: HealthMetrics;
}

export function HealthMetricsCard({ metrics }: HealthMetricsCardProps) {
  const formatUptime = (seconds: number): string => {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  };

  const successRate =
    metrics.totalChecks > 0
      ? (
          ((metrics.totalChecks - metrics.failedChecks) / metrics.totalChecks) *
          100
        ).toFixed(1)
      : "100.0";

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <MetricCard
        icon={<Clock className="h-5 w-5" />}
        label="Uptime"
        value={formatUptime(metrics.uptime)}
        color="blue"
      />
      <MetricCard
        icon={<Activity className="h-5 w-5" />}
        label="Success Rate"
        value={`${successRate}%`}
        color={
          parseFloat(successRate) >= 95
            ? "green"
            : parseFloat(successRate) >= 80
              ? "yellow"
              : "red"
        }
      />
      <MetricCard
        icon={<TrendingUp className="h-5 w-5" />}
        label="Avg Response Time"
        value={`${Math.round(metrics.avgResponseTime)}ms`}
        color={
          metrics.avgResponseTime < 1000
            ? "green"
            : metrics.avgResponseTime < 3000
              ? "yellow"
              : "red"
        }
      />
      <MetricCard
        icon={<AlertCircle className="h-5 w-5" />}
        label="Failed Checks"
        value={metrics.failedChecks.toString()}
        color={
          metrics.failedChecks === 0
            ? "green"
            : metrics.failedChecks < 5
              ? "yellow"
              : "red"
        }
      />
    </div>
  );
}

interface MetricCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: "blue" | "green" | "yellow" | "red";
}

function MetricCard({ icon, label, value, color }: MetricCardProps) {
  const colorClasses = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/20",
    green:
      "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-950/20",
    yellow:
      "text-yellow-600 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-950/20",
    red: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/20",
  };

  return (
    <div className="rounded-lg bg-white p-4 shadow-sm dark:bg-gray-800">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${colorClasses[color]}`}>{icon}</div>
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </div>
    </div>
  );
}
