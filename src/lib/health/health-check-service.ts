import { db } from '@/lib/db';
import type {
  HealthCheckResult,
  ServiceHealth,
  SystemHealth,
  HealthStatus,
  ComponentHealthCheck,
  HealthMetrics,
  DatabaseHealth,
  ApiHealth,
  CacheHealth,
  AuthHealth,
  NetworkHealth,
  HealthCheckConfig,
} from '@/types/health';

export class HealthCheckService {
  private static instance: HealthCheckService;
  private startTime: Date;
  private totalChecks = 0;
  private failedChecks = 0;
  private lastError?: { service: string; error: string; timestamp: Date };
  private checkHistory: Map<string, number[]> = new Map(); // Store response times

  private readonly config: HealthCheckConfig = {
    enabled: true,
    intervalMs: 5 * 60 * 1000, // 5 minutes
    timeout: 30000, // 30 seconds
    retries: 3,
    alertOnFailure: true,
  };

  private constructor() {
    this.startTime = new Date();
  }

  static getInstance(): HealthCheckService {
    if (!HealthCheckService.instance) {
      HealthCheckService.instance = new HealthCheckService();
    }
    return HealthCheckService.instance;
  }

  async checkHealth(): Promise<SystemHealth> {
    const start = Date.now();
    this.totalChecks++;

    try {
      // Run all health checks in parallel
      const [database, api, cache, auth, network] = await Promise.all([
        this.checkDatabase(),
        this.checkApis(),
        this.checkCache(),
        this.checkAuth(),
        this.checkNetwork(),
      ]);

      const services: ServiceHealth[] = [database, api, cache, auth, network];
      const overall = this.calculateOverallStatus(services);

      // Track failed checks
      if (overall === 'unhealthy' || overall === 'degraded') {
        this.failedChecks++;
      }

      return {
        overall,
        timestamp: new Date(),
        services,
        metrics: this.getMetrics(),
      };
    } catch (error) {
      this.failedChecks++;
      this.lastError = {
        service: 'system',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date(),
      };
      throw error;
    }
  }

  private async checkDatabase(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];
    let overallStatus: HealthStatus = 'healthy';

    // Check database connection
    const connectionCheck = await this.checkDatabaseConnection();
    checks.push(connectionCheck);
    if (connectionCheck.status !== 'healthy') {
      overallStatus = 'unhealthy';
    }

    // Check storage usage
    const storageCheck = await this.checkDatabaseStorage();
    checks.push(storageCheck);
    if (storageCheck.status === 'degraded' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    // Check data integrity
    const integrityCheck = await this.checkDatabaseIntegrity();
    checks.push(integrityCheck);
    if (integrityCheck.status !== 'healthy' && overallStatus === 'healthy') {
      overallStatus = 'degraded';
    }

    return {
      name: 'database',
      displayName: 'IndexedDB Database',
      status: overallStatus,
      lastCheck: new Date(),
      message: this.getServiceMessage('database', overallStatus),
      checks,
    };
  }

  private async checkDatabaseConnection(): Promise<DatabaseHealth> {
    const start = Date.now();
    try {
      // Check if we're in a browser environment
      if (typeof window === 'undefined') {
        return {
          name: 'connection',
          status: 'unknown',
          message: 'Database check not available server-side',
          duration: Date.now() - start,
        };
      }
      
      // Test database connection by performing a simple query
      const count = await db.articles.count();
      const duration = Date.now() - start;

      const storageInfo = await db.getStorageInfo();

      return {
        name: 'connection',
        status: 'healthy',
        message: 'Database connection is active',
        duration,
        details: {
          connected: true,
          tablesCount: 8, // Based on your schema
          recordCounts: storageInfo?.counts || {},
          storageUsed: storageInfo?.usage || 0,
          storageQuota: storageInfo?.quota || 0,
        },
      };
    } catch (error) {
      return {
        name: 'connection',
        status: 'unhealthy',
        message: 'Database connection failed',
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkDatabaseStorage(): Promise<ComponentHealthCheck> {
    try {
      if (typeof window === 'undefined') {
        return {
          name: 'storage',
          status: 'unknown',
          message: 'Storage check not available server-side',
        };
      }
      
      const storageInfo = await db.getStorageInfo();
      if (!storageInfo) {
        return {
          name: 'storage',
          status: 'unknown',
          message: 'Unable to determine storage usage',
        };
      }

      const usagePercent = (storageInfo.usage / storageInfo.quota) * 100;
      let status: HealthStatus = 'healthy';
      let message = `Storage usage: ${usagePercent.toFixed(1)}%`;

      if (usagePercent > 90) {
        status = 'unhealthy';
        message = `Critical: Storage almost full (${usagePercent.toFixed(1)}%)`;
      } else if (usagePercent > 75) {
        status = 'degraded';
        message = `Warning: High storage usage (${usagePercent.toFixed(1)}%)`;
      }

      return { name: 'storage', status, message };
    } catch (error) {
      return {
        name: 'storage',
        status: 'unknown',
        message: 'Failed to check storage',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkDatabaseIntegrity(): Promise<ComponentHealthCheck> {
    try {
      if (typeof window === 'undefined') {
        return {
          name: 'integrity',
          status: 'unknown',
          message: 'Integrity check not available server-side',
        };
      }
      
      // Check for orphaned records
      const articles = await db.articles.toArray();
      const feedIds = new Set((await db.feeds.toArray()).map((f) => f.id));
      const orphanedArticles = articles.filter((a) => !feedIds.has(a.feedId));

      if (orphanedArticles.length > 0) {
        return {
          name: 'integrity',
          status: 'degraded',
          message: `Found ${orphanedArticles.length} orphaned articles`,
          details: { orphanedCount: orphanedArticles.length },
        };
      }

      return {
        name: 'integrity',
        status: 'healthy',
        message: 'No data integrity issues found',
      };
    } catch (error) {
      return {
        name: 'integrity',
        status: 'unknown',
        message: 'Failed to check data integrity',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkApis(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];

    // Check Inoreader API
    const inoreaderCheck = await this.checkInoreaderApi();
    checks.push(inoreaderCheck);

    // Check Claude API (if configured)
    const claudeCheck = await this.checkClaudeApi();
    checks.push(claudeCheck);

    // Calculate overall API status
    const statuses = checks.map((c) => c.status);
    let overallStatus: HealthStatus = 'healthy';
    
    if (statuses.includes('unhealthy')) {
      overallStatus = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      name: 'api',
      displayName: 'External APIs',
      status: overallStatus,
      lastCheck: new Date(),
      message: this.getServiceMessage('api', overallStatus),
      checks,
    };
  }

  private async checkInoreaderApi(): Promise<ApiHealth> {
    const start = Date.now();
    try {
      // Build full URL for server-side fetch
      const baseUrl = typeof window !== 'undefined' 
        ? '' 
        : `http://localhost:${process.env.PORT || 3000}`;
      
      const response = await fetch(`${baseUrl}/api/auth/inoreader/status`, {
        signal: AbortSignal.timeout(this.config.timeout),
      });
      
      const duration = Date.now() - start;
      const data = await response.json();

      // Track response time
      this.trackResponseTime('inoreader', duration);

      if (!response.ok) {
        return {
          name: 'inoreader',
          status: 'unhealthy',
          message: 'Inoreader API is not responding correctly',
          duration,
          details: {
            endpoint: '/api/auth/inoreader/status',
            responseTime: duration,
            statusCode: response.status,
          },
        };
      }

      // Check rate limit status
      const rateLimitRemaining = parseInt(response.headers.get('X-RateLimit-Remaining') || '100');
      const rateLimitReset = response.headers.get('X-RateLimit-Reset');

      let status: HealthStatus = 'healthy';
      let message = 'Inoreader API is operational';

      if (rateLimitRemaining < 10) {
        status = 'degraded';
        message = `Low API quota remaining: ${rateLimitRemaining} calls`;
      }

      return {
        name: 'inoreader',
        status,
        message,
        duration,
        details: {
          endpoint: '/api/auth/inoreader/status',
          responseTime: duration,
          statusCode: response.status,
          rateLimitRemaining,
          rateLimitReset: rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000) : undefined,
        },
      };
    } catch (error) {
      return {
        name: 'inoreader',
        status: 'unhealthy',
        message: 'Failed to connect to Inoreader API',
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkClaudeApi(): Promise<ApiHealth> {
    // Note: This check will be performed server-side in the API endpoint
    // Client-side cannot access ANTHROPIC_API_KEY

    const start = Date.now();
    try {
      // Build full URL for server-side fetch
      const baseUrl = typeof window !== 'undefined' 
        ? '' 
        : `http://localhost:${process.env.PORT || 3000}`;
        
      // Simple health check
      const response = await fetch(`${baseUrl}/api/health/claude`, {
        signal: AbortSignal.timeout(this.config.timeout),
      });

      const duration = Date.now() - start;
      this.trackResponseTime('claude', duration);

      if (!response.ok) {
        return {
          name: 'claude',
          status: 'degraded',
          message: 'Claude API health check failed',
          duration,
          details: {
            endpoint: '/api/health/claude',
            responseTime: duration,
            statusCode: response.status,
          },
        };
      }

      return {
        name: 'claude',
        status: 'healthy',
        message: 'Claude API is operational',
        duration,
        details: {
          endpoint: '/api/health/claude',
          responseTime: duration,
          statusCode: response.status,
        },
      };
    } catch (error) {
      return {
        name: 'claude',
        status: 'degraded',
        message: 'Claude API is unreachable',
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkCache(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];

    // Check service worker cache
    const swCacheCheck = await this.checkServiceWorkerCache();
    checks.push(swCacheCheck);

    // Check local storage
    const localStorageCheck = this.checkLocalStorage();
    checks.push(localStorageCheck);

    const overallStatus = this.calculateComponentStatus(checks);

    return {
      name: 'cache',
      displayName: 'Caching System',
      status: overallStatus,
      lastCheck: new Date(),
      message: this.getServiceMessage('cache', overallStatus),
      checks,
    };
  }

  private async checkServiceWorkerCache(): Promise<CacheHealth> {
    try {
      if (typeof window === 'undefined') {
        return {
          name: 'service-worker',
          status: 'unknown',
          message: 'Service Worker check not available server-side',
        };
      }
      
      if (!('caches' in window)) {
        return {
          name: 'service-worker',
          status: 'unhealthy',
          message: 'Service Worker caches not available',
        };
      }

      const cacheNames = await caches.keys();
      const cacheStats = await this.getCacheStats();

      return {
        name: 'service-worker',
        status: 'healthy',
        message: `${cacheNames.length} caches active`,
        details: {
          hitRate: cacheStats.hitRate,
          missRate: cacheStats.missRate,
          size: cacheStats.size,
          maxSize: cacheStats.maxSize,
          oldestEntry: cacheStats.oldestEntry,
        },
      };
    } catch (error) {
      return {
        name: 'service-worker',
        status: 'unknown',
        message: 'Failed to check service worker cache',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private checkLocalStorage(): ComponentHealthCheck {
    try {
      if (typeof window === 'undefined') {
        return {
          name: 'local-storage',
          status: 'unknown',
          message: 'LocalStorage check not available server-side',
        };
      }
      
      const test = '__health_check__';
      localStorage.setItem(test, test);
      localStorage.removeItem(test);

      // Check storage usage
      const usage = this.getLocalStorageSize();
      const maxSize = 10 * 1024 * 1024; // 10MB estimate
      const usagePercent = (usage / maxSize) * 100;

      let status: HealthStatus = 'healthy';
      let message = `LocalStorage usage: ${(usage / 1024).toFixed(1)}KB`;

      if (usagePercent > 90) {
        status = 'degraded';
        message = `High LocalStorage usage: ${(usage / 1024).toFixed(1)}KB`;
      }

      return { name: 'local-storage', status, message };
    } catch (error) {
      return {
        name: 'local-storage',
        status: 'unhealthy',
        message: 'LocalStorage is not accessible',
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  private async checkAuth(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];

    try {
      // Build full URL for server-side fetch
      const baseUrl = typeof window !== 'undefined' 
        ? '' 
        : `http://localhost:${process.env.PORT || 3000}`;
        
      const response = await fetch(`${baseUrl}/api/auth/inoreader/status`);
      const data = await response.json();

      const authCheck: AuthHealth = {
        name: 'authentication',
        status: data.authenticated ? 'healthy' : 'degraded',
        message: data.authenticated ? 'User authenticated' : 'User not authenticated',
        details: {
          authenticated: data.authenticated,
          tokenValid: data.authenticated && !data.needsRefresh,
          refreshAvailable: data.authenticated,
        },
      };

      checks.push(authCheck);

      if (data.authenticated && data.needsRefresh) {
        checks.push({
          name: 'token-refresh',
          status: 'degraded',
          message: 'Token needs refresh',
        });
      }
    } catch (error) {
      checks.push({
        name: 'authentication',
        status: 'unknown',
        message: 'Failed to check authentication status',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    const overallStatus = this.calculateComponentStatus(checks);

    return {
      name: 'auth',
      displayName: 'Authentication',
      status: overallStatus,
      lastCheck: new Date(),
      message: this.getServiceMessage('auth', overallStatus),
      checks,
    };
  }

  private async checkNetwork(): Promise<ServiceHealth> {
    const checks: ComponentHealthCheck[] = [];

    // Basic connectivity check
    const connectivityCheck: NetworkHealth = {
      name: 'connectivity',
      status: typeof navigator !== 'undefined' ? (navigator.onLine ? 'healthy' : 'unhealthy') : 'unknown',
      message: typeof navigator !== 'undefined' 
        ? (navigator.onLine ? 'Network is online' : 'Network is offline')
        : 'Network check not available server-side',
      details: typeof navigator !== 'undefined' ? {
        online: navigator.onLine,
        connectionType: (navigator as any).connection?.effectiveType,
        downlink: (navigator as any).connection?.downlink,
        rtt: (navigator as any).connection?.rtt,
      } : {},
    };
    checks.push(connectivityCheck);

    // Check external connectivity
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      const externalCheck = await this.checkExternalConnectivity();
      checks.push(externalCheck);
    }

    const overallStatus = this.calculateComponentStatus(checks);

    return {
      name: 'network',
      displayName: 'Network Connectivity',
      status: overallStatus,
      lastCheck: new Date(),
      message: this.getServiceMessage('network', overallStatus),
      checks,
    };
  }

  private async checkExternalConnectivity(): Promise<ComponentHealthCheck> {
    const start = Date.now();
    try {
      // Try to reach a reliable external endpoint
      const response = await fetch('https://www.google.com/favicon.ico', {
        mode: 'no-cors',
        signal: AbortSignal.timeout(5000),
      });
      
      return {
        name: 'external',
        status: 'healthy',
        message: 'External connectivity verified',
        duration: Date.now() - start,
      };
    } catch (error) {
      return {
        name: 'external',
        status: 'degraded',
        message: 'External connectivity issues',
        duration: Date.now() - start,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  // Helper methods
  private calculateOverallStatus(services: ServiceHealth[]): HealthStatus {
    const statuses = services.map((s) => s.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    } else if (statuses.includes('degraded')) {
      return 'degraded';
    } else if (statuses.includes('unknown')) {
      return 'unknown';
    }
    return 'healthy';
  }

  private calculateComponentStatus(checks: ComponentHealthCheck[]): HealthStatus {
    const statuses = checks.map((c) => c.status);
    
    if (statuses.every((s) => s === 'healthy')) {
      return 'healthy';
    } else if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    } else if (statuses.includes('degraded')) {
      return 'degraded';
    }
    return 'unknown';
  }

  private getServiceMessage(service: string, status: HealthStatus): string {
    const messages = {
      healthy: `${service} is operating normally`,
      degraded: `${service} is experiencing minor issues`,
      unhealthy: `${service} is experiencing major issues`,
      unknown: `${service} status cannot be determined`,
    };
    return messages[status];
  }

  private trackResponseTime(service: string, duration: number): void {
    if (!this.checkHistory.has(service)) {
      this.checkHistory.set(service, []);
    }
    
    const history = this.checkHistory.get(service)!;
    history.push(duration);
    
    // Keep only last 100 measurements
    if (history.length > 100) {
      history.shift();
    }
  }

  private getMetrics(): HealthMetrics {
    const uptime = Math.floor((Date.now() - this.startTime.getTime()) / 1000);
    
    // Calculate average response time from all tracked services
    let totalResponseTime = 0;
    let responseCount = 0;
    
    this.checkHistory.forEach((times) => {
      times.forEach((time) => {
        totalResponseTime += time;
        responseCount++;
      });
    });
    
    const avgResponseTime = responseCount > 0 ? totalResponseTime / responseCount : 0;

    return {
      uptime,
      totalChecks: this.totalChecks,
      failedChecks: this.failedChecks,
      avgResponseTime,
      lastError: this.lastError,
    };
  }

  private async getCacheStats(): Promise<{
    hitRate: number;
    missRate: number;
    size: number;
    maxSize: number;
    oldestEntry?: Date;
  }> {
    // This would need to be implemented with actual cache statistics
    // For now, return mock data
    return {
      hitRate: 0.85,
      missRate: 0.15,
      size: 50 * 1024 * 1024, // 50MB
      maxSize: 100 * 1024 * 1024, // 100MB
      oldestEntry: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
    };
  }

  private getLocalStorageSize(): number {
    let size = 0;
    for (const key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        size += localStorage[key].length + key.length;
      }
    }
    return size;
  }
}

// Export singleton instance
export const healthCheckService = HealthCheckService.getInstance();