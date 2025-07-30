// Health check types for monitoring system status

export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

// UI Health System Interface (combines old and new structures)
export interface UISystemHealth {
  status: HealthStatus;
  timestamp: Date;
  services: ServiceHealth[];
  metrics: HealthMetrics;
}

export interface HealthCheckResult {
  status: HealthStatus;
  message: string;
  details?: Record<string, any>;
  timestamp: Date;
  duration?: number; // in milliseconds
}

export interface ServiceHealth {
  name: string;
  displayName: string;
  status: HealthStatus;
  lastCheck: Date;
  message: string;
  checks: ComponentHealthCheck[];
  metadata?: Record<string, any>;
}

export interface ComponentHealthCheck {
  name: string;
  status: HealthStatus;
  message: string;
  duration?: number;
  error?: string;
  details?: Record<string, any>;
}

export interface SystemHealth {
  status: HealthStatus;
  service: string;
  uptime: number;
  lastActivity: string;
  errorCount: number;
  dependencies: Record<string, HealthStatus>;
  performance: {
    avgSyncTime: number;
    avgDbQueryTime: number;
    avgApiCallTime: number;
  };
  details?: {
    services?: ServiceHealth[];
    [key: string]: any;
  };
}

export interface HealthMetrics {
  uptime: number; // in seconds
  totalChecks: number;
  failedChecks: number;
  avgResponseTime: number; // in milliseconds
  lastError?: {
    service: string;
    error: string;
    timestamp: Date;
  };
}

export interface HealthCheckConfig {
  enabled: boolean;
  intervalMs: number; // Default: 5 minutes
  timeout: number; // in milliseconds
  retries: number;
  alertOnFailure: boolean;
}

// Service-specific health check interfaces
export interface DatabaseHealth extends ComponentHealthCheck {
  details?: {
    connected: boolean;
    tablesCount: number;
    recordCounts: Record<string, number>;
    storageUsed: number;
    storageQuota: number;
  };
}

export interface ApiHealth extends ComponentHealthCheck {
  details?: {
    endpoint: string;
    responseTime: number;
    statusCode?: number;
    rateLimitRemaining?: number;
    rateLimitReset?: Date;
  };
}

export interface CacheHealth extends ComponentHealthCheck {
  details?: {
    hitRate: number;
    missRate: number;
    size: number;
    maxSize: number;
    oldestEntry?: Date;
  };
}

export interface AuthHealth extends ComponentHealthCheck {
  details?: {
    authenticated: boolean;
    tokenValid: boolean;
    tokenExpiry?: Date;
    refreshAvailable: boolean;
  };
}

export interface NetworkHealth extends ComponentHealthCheck {
  details?: {
    online: boolean;
    connectionType?: string;
    downlink?: number; // Mbps
    rtt?: number; // Round trip time in ms
  };
}

// Health check alert types
export interface HealthAlert {
  id: string;
  service: string;
  component?: string;
  severity: "info" | "warning" | "error" | "critical";
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  autoResolve: boolean;
  resolvedAt?: Date;
}

// Health check history
export interface HealthCheckHistory {
  id: string;
  timestamp: Date;
  overall: HealthStatus;
  services: Array<{
    name: string;
    status: HealthStatus;
    duration: number;
  }>;
  alerts: string[]; // Alert IDs
}
