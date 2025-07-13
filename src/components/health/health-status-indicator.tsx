'use client';

import { cn } from '@/lib/utils';
import type { HealthStatus } from '@/types/health';

interface HealthStatusIndicatorProps {
  status: HealthStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  label?: string;
  pulse?: boolean;
}

export function HealthStatusIndicator({
  status,
  size = 'md',
  showLabel = false,
  label,
  pulse = true,
}: HealthStatusIndicatorProps) {
  const sizeClasses = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  };

  const statusColors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    unhealthy: 'bg-red-500',
    unknown: 'bg-gray-400',
  };

  const pulseColors = {
    healthy: 'bg-green-400',
    degraded: 'bg-yellow-400',
    unhealthy: 'bg-red-400',
    unknown: 'bg-gray-300',
  };

  const statusLabels = {
    healthy: 'Healthy',
    degraded: 'Degraded',
    unhealthy: 'Unhealthy',
    unknown: 'Unknown',
  };

  return (
    <div className="flex items-center gap-2">
      <div className="relative flex items-center justify-center">
        <div
          className={cn(
            'rounded-full',
            sizeClasses[size],
            statusColors[status]
          )}
        />
        {pulse && status !== 'unknown' && (
          <div
            className={cn(
              'absolute rounded-full animate-ping',
              sizeClasses[size],
              pulseColors[status],
              'opacity-75'
            )}
          />
        )}
      </div>
      {showLabel && (
        <span className="text-sm font-medium">
          {label || statusLabels[status]}
        </span>
      )}
    </div>
  );
}