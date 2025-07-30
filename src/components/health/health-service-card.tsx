"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Clock } from "lucide-react";
import { HealthStatusIndicator } from "./health-status-indicator";
import type { ServiceHealth } from "@/types/health";
import { cn } from "@/lib/utils";

interface HealthServiceCardProps {
  service: ServiceHealth;
}

export function HealthServiceCard({ service }: HealthServiceCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const statusBgColors = {
    healthy:
      "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
    degraded:
      "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
    unhealthy:
      "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
    unknown:
      "bg-gray-50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800",
  };

  return (
    <div
      className={cn(
        "rounded-lg border p-4 transition-colors",
        statusBgColors[service.status]
      )}
    >
      <div
        className="flex cursor-pointer items-center justify-between"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center gap-3">
          <HealthStatusIndicator status={service.status} size="md" />
          <div>
            <h3 className="font-semibold">{service.displayName}</h3>
            <p className="text-sm text-muted-foreground">{service.message}</p>
          </div>
        </div>
        <button className="rounded p-1 hover:bg-gray-100 dark:hover:bg-gray-800">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </button>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-3 border-t pt-3">
          {service.checks.map((check, index) => (
            <div key={index} className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HealthStatusIndicator
                    status={check.status}
                    size="sm"
                    pulse={false}
                  />
                  <span className="text-sm font-medium capitalize">
                    {check.name.replace(/-/g, " ")}
                  </span>
                </div>
                {check.duration && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {check.duration}ms
                  </div>
                )}
              </div>
              <p className="ml-5 text-sm text-muted-foreground">
                {check.message}
              </p>
              {check.error && (
                <p className="ml-5 text-sm text-red-600 dark:text-red-400">
                  Error: {check.error}
                </p>
              )}
              {check.details && (
                <div className="ml-5 mt-2 space-y-1">
                  {Object.entries(check.details).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex gap-2 text-xs text-muted-foreground"
                    >
                      <span className="font-medium capitalize">
                        {key.replace(/([A-Z])/g, " $1").trim()}:
                      </span>
                      <span>{formatDetailValue(value)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {service.metadata && (
        <div className="mt-3 border-t pt-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            {Object.entries(service.metadata).map(([key, value]) => (
              <div key={key}>
                <span className="capitalize text-muted-foreground">
                  {key.replace(/([A-Z])/g, " $1").trim()}:
                </span>{" "}
                <span className="font-medium">{formatDetailValue(value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatDetailValue(value: any): string {
  if (value === null || value === undefined) return "N/A";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (value instanceof Date) return value.toLocaleString();
  if (typeof value === "number") {
    if (value > 1000000) return `${(value / 1000000).toFixed(1)}MB`;
    if (value > 1000) return `${(value / 1000).toFixed(1)}KB`;
    return value.toString();
  }
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}
