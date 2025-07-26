'use client';

import { useEffect } from 'react';
import { useHealthStore } from '@/lib/stores/health-store';
import { HealthStatusIndicator } from './health-status-indicator';
import { Button } from '@/components/ui/button';
import { Activity, AlertCircle } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import Link from 'next/link';

export function HealthStatusWidget() {
  const { currentHealth, performHealthCheck, unreadAlertCount } = useHealthStore();

  // Perform initial health check
  useEffect(() => {
    if (!currentHealth) {
      performHealthCheck();
    }
  }, [currentHealth, performHealthCheck]);

  const status = currentHealth?.status || 'unknown';

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative flex items-center gap-2"
        >
          <Activity className="h-4 w-4" />
          <HealthStatusIndicator status={status} size="sm" />
          {unreadAlertCount > 0 && (
            <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">
              {unreadAlertCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>System Health</DropdownMenuLabel>
        <DropdownMenuSeparator />
        
        {currentHealth ? (
          <>
            <div className="px-2 py-1.5">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Overall Status</span>
                <HealthStatusIndicator
                  status={currentHealth.status}
                  size="sm"
                  showLabel
                />
              </div>
              
              {unreadAlertCount > 0 && (
                <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400 mb-2">
                  <AlertCircle className="h-4 w-4" />
                  <span className="text-sm">
                    {unreadAlertCount} active alert{unreadAlertCount !== 1 ? 's' : ''}
                  </span>
                </div>
              )}
              
              <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Uptime</span>
                  <span>{formatUptime(currentHealth.metrics.uptime)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Success Rate</span>
                  <span>
                    {currentHealth.metrics.totalChecks > 0
                      ? `${((currentHealth.metrics.totalChecks - currentHealth.metrics.failedChecks) / currentHealth.metrics.totalChecks * 100).toFixed(1)}%`
                      : '100%'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span>Avg Response</span>
                  <span>{Math.round(currentHealth.metrics.avgResponseTime)}ms</span>
                </div>
              </div>
            </div>
            
            <DropdownMenuSeparator />
            
            <div className="px-2 py-1.5 space-y-1">
              {currentHealth.services.map((service) => (
                <div
                  key={service.name}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="capitalize">{service.displayName}</span>
                  <HealthStatusIndicator status={service.status} size="sm" />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="px-2 py-4 text-center text-sm text-muted-foreground">
            Loading health status...
          </div>
        )}
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem onClick={() => window.location.href = '/health'}>
          View Full Dashboard
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatUptime(seconds: number): string {
  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m`;
  } else if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h`;
  } else {
    return `${Math.floor(seconds / 86400)}d`;
  }
}