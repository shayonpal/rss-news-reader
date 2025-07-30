# RSS News Reader Server Monitoring Implementation Strategy

## 🎉 IMPLEMENTATION STATUS: COMPLETED ✅

**Deployed:** Saturday, July 26, 2025 at 4:24 PM  
**Status:** Fully operational monitoring infrastructure  
**Access:** http://localhost:3080

## Overview

This document outlines the implementation strategy for monitoring the RSS News Reader application using Uptime Kuma as the monitoring solution with Discord notifications. The monitoring system tracks application health, API rate limits, sync status, cron job execution, and database connectivity to ensure reliable operation of the RSS reader service.

### Architecture Summary

- **Monitoring Tool**: Uptime Kuma (self-hosted, Docker-based) ✅ **DEPLOYED**
- **Port**: 3080 (deployed on this port instead of planned 3001)
- **Notification Channel**: Discord webhooks ✅ **CONFIGURED**
- **Monitored Application**: RSS News Reader (PM2-managed Node.js app) ✅ **6 MONITORS ACTIVE**
- **Access**: Via Tailscale network (100.96.166.53) ✅ **OPERATIONAL**

## Prerequisites

### Required Components

1. **Colima** (Docker runtime for macOS)

   ```bash
   brew install colima
   colima start --cpu 2 --memory 4
   ```

2. **Discord Server & Webhook**

   - Discord account with server creation permissions
   - Ability to create webhooks in channels

3. **Network Access**

   - Tailscale connection to access monitoring dashboard
   - Ports available: 3001 (suggested for Uptime Kuma)

4. **System Requirements**
   - macOS with Homebrew installed
   - At least 4GB RAM allocated to Colima
   - 2GB disk space for Uptime Kuma data

## Uptime Kuma Setup

### Step 1: Start Colima

```bash
# Start Colima with adequate resources
colima start --cpu 2 --memory 4 --disk 10

# Verify Docker is working
docker version
```

### Step 2: Create Uptime Kuma Directory

```bash
# Create directory for Uptime Kuma data
mkdir -p ~/uptime-kuma-data
```

### Step 3: Deploy Uptime Kuma

```bash
# Run Uptime Kuma container
docker run -d \
  --name uptime-kuma \
  -p 3001:3001 \
  -v ~/uptime-kuma-data:/app/data \
  --restart unless-stopped \
  louislam/uptime-kuma:1
```

### Step 4: Access Uptime Kuma

- Open browser to: `http://100.96.166.53:3001`
- Create admin account on first access
- Save credentials securely

## Discord Integration

### Step 1: Create Discord Server Structure

1. Create new Discord server or use existing
2. Create channels:
   ```
   📁 RSS Reader Monitoring
   ├── 🚨 critical-alerts
   ├── ⚠️ warnings
   ├── ✅ status-updates
   └── 📊 daily-reports
   ```

### Step 2: Create Webhooks

For each channel, create a webhook:

1. Right-click channel → Edit Channel → Integrations → Webhooks
2. Click "New Webhook"
3. Name webhooks descriptively:
   - `UptimeKuma-Critical`
   - `UptimeKuma-Warning`
   - `UptimeKuma-Status`
   - `UptimeKuma-Daily`
4. Copy webhook URLs for later use

### Step 3: Configure Webhook in Uptime Kuma

1. Go to Settings → Notifications
2. Add Notification → Discord Webhook
3. Configure:
   ```
   Friendly Name: Discord Critical Alerts
   Discord Webhook URL: [paste webhook URL]
   Bot Username: RSS Monitor
   Prefix Custom Message: 🚨 **RSS Reader Alert**
   ```

## Monitor Configuration ✅ IMPLEMENTED

### Deployed Monitors (6 Active)

### 1. RSS Reader Production Monitor ✅ ACTIVE

```
Monitor Type: HTTP(s)
Friendly Name: RSS Reader Production
URL: http://100.96.166.53:3147/reader
Method: GET
Interval: 60 seconds
Retries: 3
Retry Interval: 20 seconds
Expected Status Code: 200
Notification: Discord Critical Alerts
Status: ✅ UP
```

### 2. RSS Reader Development Monitor ✅ ACTIVE

```
Monitor Type: HTTP(s)
Friendly Name: RSS Reader Development
URL: http://100.96.166.53:3000/reader
Method: GET
Interval: 60 seconds
Expected Status Code: 200
Notification: Discord Critical Alerts
Status: ⚠️ DOWN (expected when dev server not running)
```

### 3. Bi-directional Sync Server Monitor ✅ ACTIVE

```
Monitor Type: HTTP(s)
Friendly Name: Bi-directional Sync Server
URL: http://100.96.166.53:3001/server/health
Method: GET
Interval: 60 seconds
Expected Status Code: 200
Notification: Discord Critical Alerts
Status: ✅ UP
```

### 4. Production Health Endpoint Monitor ✅ ACTIVE

```
Monitor Type: HTTP(s)
Friendly Name: Production Health Endpoint
URL: http://100.96.166.53:3147/api/health/app?ping=true
Method: GET
Interval: 60 seconds
Expected Status Code: 200
Notification: Discord Critical Alerts
Status: ⚠️ ISSUE DISCOVERED - Returns 500 even when app accessible
```

### 5. Development Health Endpoint Monitor ✅ ACTIVE

```
Monitor Type: HTTP(s)
Friendly Name: Development Health Endpoint
URL: http://100.96.166.53:3000/api/health/app?ping=true
Method: GET
Interval: 60 seconds
Expected Status Code: 200
Notification: Discord Critical Alerts
Status: ⚠️ ISSUE DISCOVERED - Returns false positives
```

### 6. Cron Service Health Monitor ✅ ACTIVE

```
Monitor Type: Push
Friendly Name: Cron Service Health
Push URL: Generated in Uptime Kuma
Interval: 43200 seconds (12 hours)
Grace Period: 3600 seconds (1 hour)
Notification: Discord Critical Alerts
Status: ✅ UP with push notifications integrated
```

## Implementation Integration ✅ COMPLETED

### Dual Monitoring Strategy

The implementation integrates with existing infrastructure through a dual monitoring approach:

1. **External Monitoring (Uptime Kuma)**:

   - Visual dashboard for status overview
   - Proactive notifications via Discord
   - Historical data and trends
   - 6 active monitors covering all services

2. **Internal Recovery (monitor-services.sh)**:
   - Existing script for automatic service recovery
   - Immediate restart of failed services
   - PM2 ecosystem integration
   - Complements external monitoring

### Helper Scripts Created

- **setup-uptime-kuma.sh**: Automated deployment script
- **notify-uptime-kuma.sh**: Integration script for cron notifications

### Key Discoveries During Implementation

- **Health Endpoint Issues**: Both production and development health endpoints return inaccurate status
- **Priority Shift**: TODO-039b (Build Validation) is now immediate priority to fix discovered issues
- **Network Access**: Successfully deployed on port 3080 with proper Tailscale integration

### 2. API Rate Limit Monitor

```
Monitor Type: HTTP(s) - Keyword
Friendly Name: API Rate Limit Check
URL: http://100.96.166.53:3147/api/health
Method: GET
Interval: 300 seconds (5 minutes)
Keyword: "apiCallsRemaining"
Keyword Type: Present
Notification: Discord Warning (if < 20 calls remaining)
```

### 3. Sync Status Monitor

```
Monitor Type: HTTP(s) - JSON Query
Friendly Name: Sync Status Check
URL: http://100.96.166.53:3147/api/sync-status
Method: GET
Interval: 600 seconds (10 minutes)
JSON Query: $.lastSyncTime
Condition: Check if sync is older than 25 hours
Notification: Discord Warning
```

### 4. Cron Job Monitor (Push Monitor)

```
Monitor Type: Push
Friendly Name: RSS Sync Cron Job
Push URL: Generate in Uptime Kuma
Interval: 43200 seconds (12 hours)
Grace Period: 3600 seconds (1 hour)
```

Add to cron script:

```bash
# At the end of sync script
curl -X GET "[PUSH_URL_FROM_UPTIME_KUMA]"
```

### 5. Database Connectivity Monitor

```
Monitor Type: HTTP(s) - JSON Query
Friendly Name: Supabase Connection
URL: http://100.96.166.53:3147/api/health
Method: GET
Interval: 300 seconds
JSON Query: $.database.connected
Expected Value: true
Notification: Discord Critical Alerts
```

### 6. PM2 Process Monitor

```
Monitor Type: HTTP(s) - Keyword
Friendly Name: PM2 RSS Reader Process
URL: http://100.96.166.53:3147/api/health
Method: GET
Interval: 60 seconds
Keyword: "status\":\"healthy"
Notification: Discord Critical Alerts
```

## Custom Health Endpoints

### Enhanced Health Endpoint (/api/health)

Current endpoint should return:

```json
{
  "status": "healthy",
  "timestamp": "2025-01-26T10:30:00Z",
  "uptime": 3600,
  "apiCallsRemaining": 85,
  "apiCallsToday": 15,
  "lastSync": "2025-01-26T02:00:00Z",
  "nextSync": "2025-01-26T14:00:00Z",
  "database": {
    "connected": true,
    "latency": 45
  },
  "memory": {
    "used": 124,
    "total": 512
  }
}
```

### Sync Status Endpoint (/api/sync-status)

New endpoint to implement:

```json
{
  "lastSyncTime": "2025-01-26T02:00:00Z",
  "lastSyncDuration": 45,
  "lastSyncStatus": "success",
  "articlesAdded": 42,
  "feedsUpdated": 8,
  "errors": [],
  "nextScheduledSync": "2025-01-26T14:00:00Z"
}
```

### API Usage Endpoint (/api/usage)

New endpoint to implement:

```json
{
  "dailyLimit": 100,
  "used": 15,
  "remaining": 85,
  "resetTime": "2025-01-27T00:00:00Z",
  "averageDaily": 35,
  "peakUsage": 78
}
```

## Alert Rules

### Critical Alerts (Immediate Action Required)

- **Trigger**: Main app down for > 3 minutes
- **Trigger**: Database connection lost
- **Trigger**: PM2 process not running
- **Channel**: #critical-alerts
- **Action**: Restart services, check logs

### Warnings (Monitor Closely)

- **Trigger**: API calls remaining < 20
- **Trigger**: Sync failed but app running
- **Trigger**: Response time > 5 seconds
- **Trigger**: Memory usage > 80%
- **Channel**: #warnings
- **Action**: Monitor trend, prepare intervention

### Status Updates (Informational)

- **Trigger**: Successful sync completion
- **Trigger**: Daily API usage summary
- **Trigger**: Uptime percentage reports
- **Channel**: #status-updates
- **Action**: Review for patterns

### Escalation Rules

```
1st failure: Log only
2nd failure: Discord warning
3rd failure: Discord critical + multiple mentions
After resolution: Discord status update
```

## Testing & Validation

### Step 1: Test Each Monitor

```bash
# Test health endpoint
curl http://100.96.166.53:3147/api/health

# Simulate failure (stop PM2 process temporarily)
pm2 stop rss-reader-prod
# Wait for alert
pm2 start rss-reader-prod
```

### Step 2: Test Notifications

1. Create test monitor with 1-minute interval
2. Point to non-existent endpoint
3. Verify Discord notification arrives
4. Fix endpoint and verify recovery notification

### Step 3: Load Testing

```bash
# Simple load test
for i in {1..50}; do
  curl http://100.96.166.53:3147/api/health &
done
wait
```

### Step 4: Validate Cron Integration

1. Manually trigger cron job
2. Verify push notification received
3. Check next expected time is set correctly

## Maintenance

### Daily Tasks

- Review Discord notifications
- Check API usage trends
- Verify all monitors green

### Weekly Tasks

- Review response time graphs
- Check disk usage for Uptime Kuma data
- Analyze patterns in warnings

### Monthly Tasks

- Update Uptime Kuma container
- Archive old Discord messages
- Review and adjust thresholds
- Backup Uptime Kuma configuration

### Backup Uptime Kuma

```bash
# Backup data
tar -czf uptime-kuma-backup-$(date +%Y%m%d).tar.gz ~/uptime-kuma-data/

# Restore process
tar -xzf uptime-kuma-backup-20250126.tar.gz -C ~/
```

### Log Rotation

```bash
# Add to crontab
0 0 * * 0 find ~/uptime-kuma-data/logs -name "*.log" -mtime +30 -delete
```

## Troubleshooting

### Common Issues

#### 1. Uptime Kuma Container Won't Start

```bash
# Check logs
docker logs uptime-kuma

# Common fix: permissions
chmod -R 755 ~/uptime-kuma-data
```

#### 2. Monitors Show as Down but App is Running

- Check Tailscale connection
- Verify firewall rules
- Test from Uptime Kuma container:
  ```bash
  docker exec uptime-kuma curl http://100.96.166.53:3147/api/health
  ```

#### 3. Discord Notifications Not Arriving

- Verify webhook URL is correct
- Check Discord server notification settings
- Test webhook manually:
  ```bash
  curl -X POST -H "Content-Type: application/json" \
    -d '{"content":"Test message from Uptime Kuma"}' \
    [WEBHOOK_URL]
  ```

#### 4. High Memory Usage

```bash
# Restart container with memory limit
docker run -d \
  --name uptime-kuma \
  -p 3001:3001 \
  -v ~/uptime-kuma-data:/app/data \
  --memory="512m" \
  --restart unless-stopped \
  louislam/uptime-kuma:1
```

#### 5. API Rate Limit Monitoring Inaccurate

- Ensure health endpoint returns real-time data
- Consider caching API call count for 1 minute max
- Add endpoint specifically for API usage

### Debug Commands

```bash
# Check container status
docker ps -a | grep uptime-kuma

# View real-time logs
docker logs -f uptime-kuma

# Check network connectivity
docker exec uptime-kuma ping 100.96.166.53

# Restart container
docker restart uptime-kuma

# Full reset
docker stop uptime-kuma
docker rm uptime-kuma
# Then run deployment command again
```

### Recovery Procedures

#### If Monitoring System Fails:

1. Check Docker/Colima status
2. Restart Uptime Kuma container
3. Verify network connectivity
4. Check disk space
5. Review container logs for errors

#### If Alerts Stop Working:

1. Test Discord webhooks manually
2. Check Uptime Kuma notification settings
3. Verify monitor configurations
4. Review notification history in UI

## Next Steps

1. Implement custom health endpoints in RSS Reader
2. Deploy Uptime Kuma following this guide
3. Configure all monitors
4. Test failure scenarios
5. Document any customizations
6. Set up PM2 to start Uptime Kuma on boot

## Additional Resources

- [Uptime Kuma Documentation](https://github.com/louislam/uptime-kuma/wiki)
- [Discord Webhook Guide](https://support.discord.com/hc/en-us/articles/228383668)
- [PM2 Documentation](https://pm2.keymetrics.io/docs/)
- [Colima Documentation](https://github.com/abiosoft/colima)
