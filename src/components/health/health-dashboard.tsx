'use client';

import { useEffect } from 'react';
import { useHealthStore, useAutoHealthCheck } from '@/lib/stores/health-store';
import { HealthStatusIndicator } from './health-status-indicator';
import { HealthServiceCard } from './health-service-card';
import { HealthMetricsCard } from './health-metrics-card';
import { HealthAlerts } from './health-alerts';
import { Button } from '@/components/ui/button';
import { RefreshCw, Activity, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';

export function HealthDashboard() {
  const {
    currentHealth,
    isChecking,
    lastCheckError,
    performHealthCheck,
    clearError,
    unreadAlertCount,
  } = useHealthStore();

  // Set up automatic health checks
  useAutoHealthCheck();

  // Perform initial health check on mount
  useEffect(() => {
    if (!currentHealth) {
      performHealthCheck();
    }
  }, [currentHealth, performHealthCheck]);

  const handleRefresh = async () => {
    await performHealthCheck();
  };

  if (lastCheckError) {
    return (
      <div className="p-6 bg-red-50 dark:bg-red-950/20 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <AlertTriangle className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-semibold text-red-900 dark:text-red-100">
              Health Check Error
            </h2>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={clearError}
            className="text-red-600 hover:text-red-700"
          >
            Dismiss
          </Button>
        </div>
        <p className="text-red-800 dark:text-red-200 mb-4">{lastCheckError}</p>
        <Button onClick={handleRefresh} disabled={isChecking} size="sm">
          <RefreshCw className={cn('h-4 w-4 mr-2', isChecking && 'animate-spin')} />
          Retry
        </Button>
      </div>
    );
  }

  if (!currentHealth) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="text-center">
          <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4 animate-pulse" />
          <p className="text-gray-500">Loading health status...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold">System Health</h1>
          <HealthStatusIndicator
            status={currentHealth.overall}
            size="lg"
            showLabel
          />
          {unreadAlertCount > 0 && (
            <div className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
              <AlertTriangle className="h-5 w-5" />
              <span className="text-sm font-medium">
                {unreadAlertCount} new alert{unreadAlertCount > 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            Last checked: {new Date(currentHealth.timestamp).toLocaleTimeString()}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isChecking}
          >
            <RefreshCw
              className={cn('h-4 w-4 mr-2', isChecking && 'animate-spin')}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Alerts */}
      <HealthAlerts />

      {/* Metrics Overview */}
      <HealthMetricsCard metrics={currentHealth.metrics} />

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {currentHealth.services.map((service) => (
          <HealthServiceCard key={service.name} service={service} />
        ))}
      </div>

      {/* Health Trend */}
      <HealthTrend />
    </div>
  );
}

function HealthTrend() {
  const { checkHistory, getHealthTrend } = useHealthStore();
  const trend = getHealthTrend();

  if (trend.length < 2) {
    return null;
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-sm">
      <h3 className="text-lg font-semibold mb-4">Health Trend</h3>
      <div className="flex items-center gap-2">
        {trend.map((status, index) => (
          <div key={index} className="flex flex-col items-center gap-1">
            <HealthStatusIndicator status={status} size="sm" pulse={false} />
            <span className="text-xs text-muted-foreground">
              {index === 0 ? 'Oldest' : index === trend.length - 1 ? 'Latest' : ''}
            </span>
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground mt-4">
        Showing last {trend.length} health checks
      </p>
    </div>
  );
}