# Health Check System Documentation

## Overview

The RSS News Reader includes a comprehensive health check system that monitors the status of various services and components. This system provides real-time monitoring, alerting, and diagnostic information to ensure the application runs smoothly.

## Architecture

### Core Components

1. **Health Check Service** (`/src/lib/health/health-check-service.ts`)
   - Singleton service that performs health checks
   - Monitors database, APIs, cache, authentication, and network
   - Tracks metrics and response times
   - Calculates overall system health status

2. **Health Store** (`/src/lib/stores/health-store.ts`)
   - Zustand store for health state management
   - Manages check history, alerts, and settings
   - Persists configuration and critical data
   - Provides health trend analysis

3. **Health Scheduler** (`/src/lib/health/health-scheduler.ts`)
   - Automated health check scheduling
   - Respects app visibility and network status
   - Configurable check intervals
   - Automatic pause/resume functionality

4. **UI Components** (`/src/components/health/`)
   - Health dashboard for detailed monitoring
   - Status indicators with visual feedback
   - Alert system with severity levels
   - Metrics visualization

## Health Check Categories

### 1. Database Health

- **Connection Check**: Verifies IndexedDB connectivity
- **Storage Check**: Monitors storage usage and quota
- **Integrity Check**: Detects orphaned records

### 2. API Health

- **Inoreader API**: Checks authentication and rate limits
- **Claude API**: Verifies AI service availability
- **Response Times**: Tracks API performance

### 3. Cache Health

- **Service Worker Cache**: Monitors cache status
- **LocalStorage**: Checks availability and usage
- **Cache Statistics**: Hit/miss rates and size

### 4. Authentication Health

- **Auth Status**: Verifies user authentication
- **Token Validity**: Checks token expiration
- **Refresh Capability**: Ensures token refresh works

### 5. Network Health

- **Connectivity**: Basic online/offline status
- **External Access**: Verifies internet connectivity
- **Connection Quality**: Network type and speed

## Health Status Levels

- **Healthy** 🟢: All systems operating normally
- **Degraded** 🟡: Minor issues detected, functionality reduced
- **Unhealthy** 🔴: Major issues, critical functionality affected
- **Unknown** ⚪: Unable to determine status

## API Endpoints

### GET /api/health

Main health check endpoint that returns comprehensive system status.

**Response:**

```json
{
  "overall": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "services": [
    {
      "name": "database",
      "displayName": "IndexedDB Database",
      "status": "healthy",
      "lastCheck": "2024-01-01T00:00:00.000Z",
      "message": "database is operating normally",
      "checks": [...]
    }
  ],
  "metrics": {
    "uptime": 3600,
    "totalChecks": 100,
    "failedChecks": 2,
    "avgResponseTime": 150
  }
}
```

### GET /api/health?ping=true

Simple ping endpoint for basic availability check.

### GET /api/health/claude

Claude API specific health check endpoint.

## Configuration

The health check system can be configured through the health store:

```typescript
// Enable/disable automatic health checks
setAutoCheck(true);

// Set check interval (in minutes)
setCheckInterval(5);
```

## Alert System

The system generates alerts based on health status:

### Alert Severities

- **Info**: Informational messages
- **Warning**: Non-critical issues requiring attention
- **Error**: Significant problems affecting functionality
- **Critical**: System-wide failures requiring immediate action

### Alert Management

- Alerts can be acknowledged to mark as read
- Alerts can be dismissed to remove from view
- Auto-resolve alerts clear automatically when issues are fixed
- Persistent alerts remain until manually dismissed

## Usage Examples

### Basic Health Check

```typescript
import { healthCheckService } from "@/lib/health/health-check-service";

const health = await healthCheckService.checkHealth();
console.log("System status:", health.overall);
```

### Using Health Store

```typescript
import { useHealthStore } from '@/lib/stores/health-store';

function HealthStatus() {
  const { currentHealth, performHealthCheck } = useHealthStore();

  return (
    <div>
      Status: {currentHealth?.overall || 'checking...'}
      <button onClick={performHealthCheck}>Check Now</button>
    </div>
  );
}
```

### Health Status Widget

```tsx
import { HealthStatusWidget } from "@/components/health/health-status-widget";

// Add to your layout
<HealthStatusWidget />;
```

## Monitoring Best Practices

1. **Regular Checks**: Default 5-minute interval balances freshness with performance
2. **Alert Response**: Address critical alerts immediately
3. **Storage Management**: Monitor storage usage to prevent quota issues
4. **API Limits**: Watch rate limit warnings to avoid service disruption
5. **Network Issues**: Check connectivity when sync problems occur

## Troubleshooting

### Common Issues

1. **High Storage Usage**
   - Run database vacuum to clean orphaned data
   - Reduce article retention period
   - Clear old API usage records

2. **API Rate Limits**
   - Reduce sync frequency
   - Batch API operations
   - Monitor usage patterns

3. **Authentication Failures**
   - Check token expiration
   - Verify OAuth configuration
   - Re-authenticate if needed

4. **Network Connectivity**
   - Check device network settings
   - Verify firewall/proxy settings
   - Test external connectivity

## Performance Considerations

- Health checks are lightweight and non-blocking
- Checks pause when app is hidden to save resources
- Response times are tracked for performance monitoring
- Failed checks are retried with exponential backoff

## Future Enhancements

- Historical trend graphs
- Predictive failure detection
- Custom health check plugins
- Export health reports
- Push notifications for critical alerts
