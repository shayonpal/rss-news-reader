# RSS News Reader Health Monitoring Overview

The RSS News Reader implements comprehensive health monitoring at both the client and server levels to ensure reliability and optimal performance.

## Two-Layer Health Monitoring Architecture

### 1. Server-Side Health Endpoints (External Monitoring)

**Purpose**: Enable external monitoring tools like Uptime Kuma to track service availability and performance.

**Documentation**: [Server Health Endpoints Guide](./server-health-endpoints.md)

**Key Features**:

- REST API health endpoints for all services
- Standardized JSON response format
- No authentication required for monitoring
- JSONL logging for historical analysis
- Integration with Uptime Kuma

**Endpoints**:

- `/api/health/app` - Main application health
- `/server/health` - Bi-directional sync server
- `/api/health/cron` - Scheduled sync jobs

**Use Cases**:

- External monitoring and alerting
- Service availability tracking
- Performance baseline monitoring
- Incident detection and response

### 2. Client-Side Health System (In-App Monitoring)

**Purpose**: Provide real-time health monitoring within the browser application for end users.

**Documentation**: [Client Health System Guide](./client-health-system.md)

**Key Features**:

- Browser-based health checks
- IndexedDB and storage monitoring
- Service worker cache health
- Visual health indicators in UI
- Local alert system

**Components**:

- Health Check Service (singleton)
- Health Store (Zustand)
- Health Dashboard UI
- Auto health check scheduler

**Use Cases**:

- User-facing health status
- Browser storage monitoring
- Cache performance tracking
- Offline capability detection

## How They Work Together

```
┌─────────────────────────────────────────────────────────┐
│                   External Monitoring                    │
│                    (Uptime Kuma)                        │
└─────────────────┬───────────────────────────────────────┘
                  │ HTTP Requests
                  ▼
┌─────────────────────────────────────────────────────────┐
│              Server Health Endpoints                     │
│         /api/health/app, /server/health, etc.          │
├─────────────────────────────────────────────────────────┤
│                    RSS News Reader                       │
│                  Server-Side Services                    │
│  - Next.js App    - Sync Server    - Cron Jobs         │
└─────────────────────────────────────────────────────────┘
                  ║
                  ║ Data Flow
                  ▼
┌─────────────────────────────────────────────────────────┐
│                  Browser Application                     │
│                                                         │
│  ┌─────────────────────────────────────────────────┐  │
│  │          Client-Side Health System               │  │
│  │  - IndexedDB Health                             │  │
│  │  - Service Worker Health                        │  │
│  │  - Local Storage Health                         │  │
│  │  - UI Health Dashboard                          │  │
│  └─────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## When to Use Which System

### Use Server-Side Health Endpoints When:

- Setting up external monitoring (Uptime Kuma, etc.)
- Monitoring service availability from outside
- Tracking server performance metrics
- Setting up alerting for outages
- Performing health checks in CI/CD pipelines

### Use Client-Side Health System When:

- Displaying health status to users
- Monitoring browser-specific resources
- Checking offline capabilities
- Debugging client-side issues
- Monitoring PWA functionality

## Health Status Definitions

Both systems use the same status levels:

- **🟢 Healthy**: All systems functioning normally
- **🟡 Degraded**: Some non-critical issues detected, but service is operational
- **🔴 Unhealthy**: Critical issues affecting service functionality
- **⚫ Unknown**: Unable to determine status

## Performance Thresholds

### Database Response Times

- **Healthy**: < 300ms
- **Degraded**: 300-1000ms
- **Unhealthy**: > 1000ms

### API Response Times

- **Healthy**: < 500ms
- **Degraded**: 500-2000ms
- **Unhealthy**: > 2000ms

## Monitoring Best Practices

1. **External Monitoring**:
   - Configure Uptime Kuma to check health endpoints every 60 seconds
   - Set up alerts for status changes
   - Monitor all critical services

2. **Client Monitoring**:
   - Enable auto health checks with reasonable intervals
   - Review health dashboard during troubleshooting
   - Monitor browser console for health warnings

3. **Log Management**:
   - Health logs rotate daily (kept for 7 days)
   - Monitor log sizes to prevent disk issues
   - Review logs for performance trends

## Troubleshooting

### Server Health Issues

1. Check server logs: `pm2 logs`
2. Verify service status: `pm2 status`
3. Test endpoints manually: `curl http://localhost:3000/reader/api/health/app`
4. Review JSONL logs in `/logs` directory

### Client Health Issues

1. Open browser developer tools
2. Check IndexedDB storage
3. Review service worker status
4. Clear cache if needed

## Future Enhancements

- Webhook recovery endpoints (TODO-039c)
- Historical health data API
- Performance trend analysis
- Custom health check plugins
