# Uptime Kuma Setup Documentation

## Overview

Uptime Kuma has been deployed as an external monitoring solution for the RSS News Reader application. It provides real-time monitoring, alerting, and a dashboard for tracking service health.

## Access Information

- **URL**: http://localhost:3080
- **Container Name**: uptime-kuma
- **Port**: 3080 (mapped from internal 3001)
- **Data Volume**: uptime-kuma-data

## Architecture

```
┌─────────────────┐
│  Uptime Kuma    │ External Monitor
│  (Port 3080)    │
└────────┬────────┘
         │ Monitors
         ▼
┌─────────────────────────────────────┐
│        RSS Reader Services          │
├─────────────────┬───────────────────┤
│ Production App  │ Sync Server       │
│ (Port 3147)     │ (Port 3001)       │
├─────────────────┼───────────────────┤
│ Dev App         │ Cron Service      │
│ (Port 3000)     │ (Schedule-based)  │
└─────────────────┴───────────────────┘
         ▲
         │ Auto-recovery
┌────────┴────────┐
│ monitor-services│ Internal Monitor
│      .sh        │
└─────────────────┘
```

## Monitors Configuration

### HTTP Monitors

1. **RSS Reader - Production App**
   - URL: `http://100.96.166.53:3147/reader/api/health/app?ping=true`
   - Interval: 60 seconds
   - Retry: 3 times with 20s interval

2. **RSS Reader - Sync Server**
   - URL: `http://localhost:3001/server/health`
   - Interval: 60 seconds
   - Retry: 3 times with 20s interval

3. **RSS Reader - Dev App**
   - URL: `http://100.96.166.53:3000/reader/api/health/app?ping=true`
   - Interval: 300 seconds (less critical)
   - Retry: 2 times with 60s interval

4. **RSS Reader - Database**
   - URL: `http://100.96.166.53:3147/reader/api/health/db`
   - Interval: 300 seconds
   - Retry: 3 times with 60s interval

### Port Monitors

5. **RSS Reader - Production Port**
   - Host: 100.96.166.53
   - Port: 3147
   - Interval: 300 seconds

6. **RSS Reader - Sync Port**
   - Host: localhost
   - Port: 3001
   - Interval: 300 seconds

### Push Monitor (for Cron)

7. **RSS Reader - Cron Service**
   - Type: Push
   - Interval: 15 hours (alert if no push)
   - Integration: Add to cron job

## Setup Instructions

### Initial Setup (Completed)

1. Deploy Uptime Kuma:

   ```bash
   ./scripts/setup-uptime-kuma.sh
   ```

2. Access UI and create admin account:
   - Navigate to http://localhost:3080
   - Set up username and password

### Adding Monitors

1. Click "Add New Monitor"
2. Configure according to specifications above
3. Enable notifications for each monitor

### Discord Notifications

1. Go to Settings → Notifications
2. Add Discord webhook:
   - Friendly Name: RSS Reader Alerts
   - Webhook URL: `https://discord.com/api/webhooks/1398487627765649498/[token]`
   - Bot Display Name: Uptime Kuma - RSS Reader

### Push Monitor Integration

For the cron service:

1. Create a Push monitor in Uptime Kuma
2. Copy the push URL (contains unique key)
3. Update `/Users/shayon/.rss-reader/uptime-kuma-push-keys.json`:

   ```json
   {
     "cron": "YOUR_PUSH_KEY_HERE"
   }
   ```

4. Integrate into cron job using the helper script:
   ```bash
   ./scripts/uptime-kuma-push.sh push cron up
   ```

## Helper Scripts

### Setup Script

- **Path**: `/scripts/setup-uptime-kuma.sh`
- **Purpose**: Deploy or restart Uptime Kuma container

### Push Helper

- **Path**: `/scripts/uptime-kuma-push.sh`
- **Usage**:

  ```bash
  # Send push notification
  ./scripts/uptime-kuma-push.sh push cron up

  # Wrap command with monitoring
  ./scripts/uptime-kuma-push.sh wrap cron npm run sync
  ```

### Status Check

- **Path**: `/scripts/uptime-kuma-status.sh`
- **Purpose**: Quick health check of all services

### Monitor Configuration

- **Path**: `/scripts/configure-uptime-kuma-monitors.js`
- **Purpose**: Display monitor configuration for manual setup

## Docker Management

```bash
# View logs
docker logs uptime-kuma

# Stop container
docker stop uptime-kuma

# Start container
docker start uptime-kuma

# Remove container (preserves data)
docker rm -f uptime-kuma

# Remove everything (including data)
docker rm -f uptime-kuma
docker volume rm uptime-kuma-data
```

## Monitoring Strategy

1. **Uptime Kuma**: External monitoring and alerting
   - Tracks service availability
   - Sends Discord notifications
   - Provides uptime statistics

2. **monitor-services.sh**: Internal recovery
   - Faster response time (checks every 2 min)
   - Automatic restart attempts
   - Rate-limited recovery

3. **Dual Notifications**: Both systems alert independently
   - Redundancy in case one fails
   - Different perspectives on issues

## Next Steps

1. ✅ Deploy Uptime Kuma (DONE)
2. ⏳ Configure monitors in UI
3. ⏳ Set up Discord notifications
4. ⏳ Create push monitor for cron
5. ⏳ Update cron job to send heartbeats
6. ⏳ Monitor for 24 hours to establish baseline

## Troubleshooting

### Container Won't Start

```bash
# Check if port is in use
lsof -i :3080

# Check Docker logs
docker logs uptime-kuma

# Restart Colima if needed
colima restart
```

### Monitors Show Down

- Verify service is actually running: `./scripts/uptime-kuma-status.sh`
- Check network connectivity to Tailscale IP
- Verify health endpoints are responding

### Push Monitor Not Working

- Check push key in `/Users/shayon/.rss-reader/uptime-kuma-push-keys.json`
- Verify cron job includes push command
- Check Uptime Kuma logs for push receipts
