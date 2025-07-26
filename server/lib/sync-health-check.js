const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Track service start time
const SERVICE_START_TIME = Date.now();

// In-memory error tracking (last hour)
const errorLog = [];

// Performance metrics tracking (last 100 operations)
const performanceMetrics = {
  dbQueries: [],
  syncOperations: [],
  inoreaderApiCalls: [],
};

class SyncHealthCheck {
  constructor() {
    // Initialize Supabase client for health checks
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );
  }

  async checkHealth(syncService) {
    const dependencies = {};
    const details = { services: [] };
    
    // Check database connectivity
    const dbHealth = await this.checkDatabase();
    details.services.push(dbHealth);
    dependencies.database = dbHealth.status;
    
    // Check OAuth token validity
    const authHealth = await this.checkOAuthTokens();
    details.services.push(authHealth);
    dependencies.oauth = authHealth.status;
    
    // Check sync queue status
    const syncQueueHealth = await this.checkSyncQueue(syncService);
    details.services.push(syncQueueHealth);
    dependencies.syncQueue = syncQueueHealth.status;
    
    // Calculate overall status
    const statuses = Object.values(dependencies);
    let status = 'healthy';
    if (statuses.includes('unhealthy')) {
      status = 'unhealthy';
    } else if (statuses.includes('degraded')) {
      status = 'degraded';
    }
    
    // Get error count from last hour
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    const recentErrors = errorLog.filter(e => e.timestamp > oneHourAgo).length;
    
    // Calculate uptime
    const uptimeSeconds = Math.floor((Date.now() - SERVICE_START_TIME) / 1000);
    
    // Calculate average performance metrics
    const avgDbQueryTime = this.calculateAverage(performanceMetrics.dbQueries);
    const avgSyncTime = this.calculateAverage(performanceMetrics.syncOperations);
    const avgApiCallTime = this.calculateAverage(performanceMetrics.inoreaderApiCalls);
    
    // Get last sync activity
    let lastActivity = new Date().toISOString();
    if (syncQueueHealth.metadata && syncQueueHealth.metadata.lastProcessed) {
      lastActivity = syncQueueHealth.metadata.lastProcessed;
    }
    
    // Write health check to JSONL log
    await this.logHealthCheck({
      timestamp: new Date().toISOString(),
      service: 'rss-sync-server',
      status,
      uptime: uptimeSeconds,
      errorCount: recentErrors,
      performance: {
        avgDbQueryTime,
        avgApiCallTime,
        avgSyncTime,
      },
      syncQueue: syncQueueHealth.metadata,
    });
    
    return {
      status,
      service: 'rss-sync-server',
      uptime: uptimeSeconds,
      lastActivity,
      errorCount: recentErrors,
      dependencies,
      performance: {
        avgSyncTime,
        avgDbQueryTime,
        avgApiCallTime,
      },
      details,
    };
  }

  async checkDatabase() {
    const checks = [];
    
    try {
      const start = Date.now();
      
      // Test basic connectivity with a simple query
      const { data, error } = await this.supabase
        .from('sync_queue')
        .select('id')
        .limit(1);
      
      const duration = Date.now() - start;
      
      // Track performance
      this.trackPerformance('dbQueries', duration);
      
      if (error) {
        checks.push({
          name: 'connectivity',
          status: 'unhealthy',
          message: 'Database connection failed',
          duration,
          error: error.message,
        });
      } else {
        checks.push({
          name: 'connectivity',
          status: 'healthy',
          message: 'Database connection successful',
          duration,
        });
        
        // Check database performance
        if (duration > 1000) {
          checks.push({
            name: 'performance',
            status: 'unhealthy',
            message: `Database response very slow: ${duration}ms`,
            duration,
          });
        } else if (duration > 300) {
          checks.push({
            name: 'performance',
            status: 'degraded',
            message: `Database response slow: ${duration}ms`,
            duration,
          });
        } else {
          checks.push({
            name: 'performance',
            status: 'healthy',
            message: `Database response time: ${duration}ms`,
            duration,
          });
        }
      }
    } catch (error) {
      checks.push({
        name: 'connectivity',
        status: 'unhealthy',
        message: 'Database check failed',
        error: error.message,
      });
    }
    
    const status = this.calculateServiceStatus(checks);
    
    return {
      name: 'database',
      displayName: 'Supabase Database',
      status,
      lastCheck: new Date(),
      message: this.getServiceMessage('database', status),
      checks,
    };
  }

  async checkOAuthTokens() {
    const checks = [];
    
    try {
      // Check if token file exists
      const tokenPath = process.env.RSS_READER_TOKENS_PATH || 
        path.join(process.env.HOME || '/Users/shayon', '.rss-reader', 'tokens.json');
      
      const exists = await fs.access(tokenPath).then(() => true).catch(() => false);
      
      if (!exists) {
        checks.push({
          name: 'token-file',
          status: 'unhealthy',
          message: 'OAuth token file not found',
        });
      } else {
        // Read and check token validity
        const tokenData = await fs.readFile(tokenPath, 'utf-8');
        const tokens = JSON.parse(tokenData);
        
        if (!tokens.encrypted) {
          checks.push({
            name: 'token-file',
            status: 'unhealthy',
            message: 'OAuth tokens not properly encrypted',
          });
        } else {
          // Check token age
          const fileStats = await fs.stat(tokenPath);
          const tokenAge = Date.now() - fileStats.mtime.getTime();
          const daysOld = Math.floor(tokenAge / (1000 * 60 * 60 * 24));
          const daysRemaining = Math.max(0, 365 - daysOld);
          
          if (daysRemaining < 30) {
            checks.push({
              name: 'token-validity',
              status: 'degraded',
              message: `OAuth tokens may be expiring soon (approx ${daysRemaining} days left)`,
            });
          } else {
            checks.push({
              name: 'token-validity',
              status: 'healthy',
              message: `OAuth tokens valid (approx ${daysRemaining} days remaining)`,
            });
          }
        }
      }
    } catch (error) {
      checks.push({
        name: 'oauth',
        status: 'unhealthy',
        message: 'OAuth check failed',
        error: error.message,
      });
    }
    
    const status = this.calculateServiceStatus(checks);
    
    return {
      name: 'oauth',
      displayName: 'OAuth Authentication',
      status,
      lastCheck: new Date(),
      message: this.getServiceMessage('oauth', status),
      checks,
    };
  }

  async checkSyncQueue(syncService) {
    const checks = [];
    let metadata = {};
    
    try {
      // Get sync queue statistics
      const stats = await syncService.getSyncQueueStats();
      
      if (stats) {
        metadata = {
          pending: stats.pending_count || 0,
          failed: stats.failed_count || 0,
          retryPending: stats.retry_pending_count || 0,
          neverAttempted: stats.never_attempted_count || 0,
          lastProcessed: syncService.lastProcessedTime || new Date().toISOString(),
        };
        
        // Check if sync is healthy based on queue metrics
        if (stats.failed_count > 50) {
          checks.push({
            name: 'queue-health',
            status: 'unhealthy',
            message: `High number of failed sync items: ${stats.failed_count}`,
            details: metadata,
          });
        } else if (stats.pending_count > 100 || stats.failed_count > 10) {
          checks.push({
            name: 'queue-health',
            status: 'degraded',
            message: `Sync queue backlog: ${stats.pending_count} pending, ${stats.failed_count} failed`,
            details: metadata,
          });
        } else {
          checks.push({
            name: 'queue-health',
            status: 'healthy',
            message: `Sync queue healthy: ${stats.pending_count || 0} pending`,
            details: metadata,
          });
        }
        
        // Check if sync is active
        const syncActive = syncService.syncTimer !== null;
        checks.push({
          name: 'sync-status',
          status: syncActive ? 'healthy' : 'degraded',
          message: syncActive ? 'Bi-directional sync is active' : 'Bi-directional sync is inactive',
        });
      } else {
        checks.push({
          name: 'queue-health',
          status: 'unknown',
          message: 'Unable to retrieve sync queue statistics',
        });
      }
    } catch (error) {
      checks.push({
        name: 'sync-queue',
        status: 'unhealthy',
        message: 'Sync queue check failed',
        error: error.message,
      });
    }
    
    const status = this.calculateServiceStatus(checks);
    
    return {
      name: 'syncQueue',
      displayName: 'Sync Queue',
      status,
      lastCheck: new Date(),
      message: this.getServiceMessage('sync queue', status),
      checks,
      metadata,
    };
  }

  calculateServiceStatus(checks) {
    const statuses = checks.map(c => c.status);
    
    if (statuses.includes('unhealthy')) {
      return 'unhealthy';
    } else if (statuses.includes('degraded')) {
      return 'degraded';
    } else if (statuses.includes('unknown')) {
      return 'unknown';
    }
    return 'healthy';
  }

  getServiceMessage(service, status) {
    const messages = {
      healthy: `${service} is operating normally`,
      degraded: `${service} is experiencing minor issues`,
      unhealthy: `${service} is experiencing major issues`,
      unknown: `${service} status cannot be determined`,
    };
    return messages[status];
  }

  trackPerformance(metric, duration) {
    const metrics = performanceMetrics[metric];
    metrics.push(duration);
    
    // Keep only last 100 measurements
    if (metrics.length > 100) {
      metrics.shift();
    }
  }

  calculateAverage(values) {
    if (values.length === 0) return 0;
    const sum = values.reduce((a, b) => a + b, 0);
    return Math.round(sum / values.length);
  }

  async logHealthCheck(data) {
    try {
      const logPath = path.join(process.cwd(), 'logs', 'sync-health.jsonl');
      await fs.mkdir(path.dirname(logPath), { recursive: true });
      await fs.appendFile(logPath, JSON.stringify(data) + '\n');
    } catch (error) {
      console.error('Failed to log health check:', error);
    }
  }

  // Public method to log errors
  static logError(error) {
    errorLog.push({
      timestamp: Date.now(),
      error,
    });
    
    // Keep only last hour of errors
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    while (errorLog.length > 0 && errorLog[0].timestamp < oneHourAgo) {
      errorLog.shift();
    }
  }

  // Public method to track performance
  static trackMetric(type, duration) {
    if (performanceMetrics[type]) {
      performanceMetrics[type].push(duration);
      
      // Keep only last 100 measurements
      if (performanceMetrics[type].length > 100) {
        performanceMetrics[type].shift();
      }
    }
  }
}

module.exports = SyncHealthCheck;