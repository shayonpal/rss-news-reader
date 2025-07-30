"use client";

import { useHealthStore } from "@/lib/stores/health-store";
import {
  AlertCircle,
  AlertTriangle,
  Info,
  XOctagon,
  X,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HealthAlert } from "@/types/health";

export function HealthAlerts() {
  const { alerts, acknowledgeAlert, dismissAlert, clearAlerts } =
    useHealthStore();

  if (alerts.length === 0) {
    return null;
  }

  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);
  const activeAlerts = alerts.filter((a) => !a.resolvedAt);

  if (activeAlerts.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">
          Active Alerts ({activeAlerts.length})
        </h3>
        {alerts.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearAlerts}
            className="text-muted-foreground"
          >
            Clear All
          </Button>
        )}
      </div>
      <div className="max-h-64 space-y-2 overflow-y-auto">
        {activeAlerts.slice(0, 5).map((alert) => (
          <AlertItem
            key={alert.id}
            alert={alert}
            onAcknowledge={() => acknowledgeAlert(alert.id)}
            onDismiss={() => dismissAlert(alert.id)}
          />
        ))}
        {activeAlerts.length > 5 && (
          <p className="py-2 text-center text-sm text-muted-foreground">
            And {activeAlerts.length - 5} more alerts...
          </p>
        )}
      </div>
    </div>
  );
}

interface AlertItemProps {
  alert: HealthAlert;
  onAcknowledge: () => void;
  onDismiss: () => void;
}

function AlertItem({ alert, onAcknowledge, onDismiss }: AlertItemProps) {
  const severityConfig = {
    info: {
      icon: <Info className="h-4 w-4" />,
      bgColor:
        "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
      textColor: "text-blue-800 dark:text-blue-200",
    },
    warning: {
      icon: <AlertTriangle className="h-4 w-4" />,
      bgColor:
        "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
      textColor: "text-yellow-800 dark:text-yellow-200",
    },
    error: {
      icon: <AlertCircle className="h-4 w-4" />,
      bgColor:
        "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
      textColor: "text-red-800 dark:text-red-200",
    },
    critical: {
      icon: <XOctagon className="h-4 w-4" />,
      bgColor:
        "bg-red-100 dark:bg-red-950/40 border-red-300 dark:border-red-700",
      textColor: "text-red-900 dark:text-red-100",
    },
  };

  const config = severityConfig[alert.severity];
  const timeAgo = getTimeAgo(alert.timestamp);

  return (
    <div
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-opacity",
        config.bgColor,
        alert.acknowledged && "opacity-60"
      )}
    >
      <div className={cn("mt-0.5", config.textColor)}>{config.icon}</div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <p className={cn("text-sm font-medium", config.textColor)}>
              {alert.service}
              {alert.component && ` - ${alert.component}`}
            </p>
            <p className="mt-1 text-sm">{alert.message}</p>
            <p className="mt-1 text-xs text-muted-foreground">{timeAgo}</p>
          </div>
          <div className="flex items-center gap-1">
            {!alert.acknowledged && (
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onAcknowledge}
                title="Acknowledge"
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onDismiss}
              title="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const seconds = Math.floor((now.getTime() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}
