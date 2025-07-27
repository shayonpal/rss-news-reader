# Caddy and PM2 Production Setup

## Overview
This document describes the production deployment setup using Caddy as a reverse proxy and PM2 as the process manager.

## Production URL
- **Production URL**: http://100.96.166.53:3147/reader (Direct access, port 3147)
- **Development URL**: http://100.96.166.53:3000/reader (Dev server, port 3000)
- **Note**: Using port 3147 due to Obsidian Docker container on port 80

## Configuration Files

### 1. Caddyfile
Located at `/Caddyfile` - Configures Caddy reverse proxy to:
- Proxy `/reader/*` requests to the Next.js app on port 3000
- Provide a health check endpoint at `/health`
- Log access to `logs/caddy-access.log`

### 2. ecosystem.config.js
Located at `/ecosystem.config.js` - Configures PM2 with production-grade stability improvements:

**Service Configuration**:
- **4 Services**: rss-reader-prod (3147), rss-reader-dev (3000), rss-sync-cron, rss-sync-server (3001)
- **Fork Mode**: All services use fork mode (not cluster) for optimal Next.js compatibility
- **Conservative Memory Limits**: 512M for Next.js apps, 256M for support services

**Stability Features**:
- **Restart Protection**: min_uptime: 10s prevents rapid restart loops
- **Graceful Shutdowns**: Service-specific kill_timeout (12s HTTP, 30s sync, 15s server)
- **Smart Restart Strategy**: Exponential backoff delays, max_restarts: 50 for production resilience
- **Health Check Integration**: wait_ready: true with 20s listen_timeout for HTTP services
- **Pre-start Validation**: PM2 hooks prevent deployment of broken builds

**Logging**:
- Service-specific log files in `logs/` directory
- Timestamped entries for all log outputs
- JSONL format for structured logging

### 3. Next.js Configuration
The `next.config.mjs` already has:
- `basePath: '/reader'` configured
- PWA service worker setup
- Security headers

## Deployment Steps

### First-Time Setup
```bash
# 1. Install PM2 globally (already done)
npm install -g pm2

# 2. Build the application
npm run build

# 3. Start with PM2
pm2 start ecosystem.config.js

# 4. Save PM2 configuration
pm2 save

# 5. Setup PM2 to start on boot (run once with sudo)
pm2 startup

# 6. Start Caddy
caddy start --config ./Caddyfile
```

### Quick Deployment
```bash
# Use the deployment script
./scripts/deploy.sh
```

### Testing Locally
```bash
# 1. Start the dev server with network access
npm run dev:network

# 2. Test Caddy configuration
./scripts/test-caddy.sh

# 3. Access at http://localhost/reader
```

## Management Commands

### PM2 Commands
```bash
pm2 status              # Check app status
pm2 logs                # View real-time logs
pm2 logs --lines 100   # View last 100 lines
pm2 restart rss-reader  # Restart the app
pm2 stop rss-reader     # Stop the app
pm2 delete rss-reader   # Remove from PM2
pm2 monit               # Real-time monitoring
```

### Caddy Commands
```bash
caddy reload --config ./Caddyfile  # Reload configuration
caddy stop                          # Stop Caddy
caddy version                       # Check version
caddy list-modules                  # List available modules
```

## Troubleshooting

### App not accessible
1. Check PM2 status: `pm2 status`
2. Check PM2 logs: `pm2 logs`
3. Check if Caddy is running: `ps aux | grep caddy`
4. Check Caddy logs: `tail -f logs/caddy-access.log`

### 500 Internal Server Error
**Issue**: Production returns 500 errors on homepage or API endpoints
**Cause**: Empty `src/pages/` directory confuses Next.js (project uses App Router)
**Solution**: 
1. Remove the empty `src/pages/` directory: `rm -rf src/pages`
2. Clear Next.js cache: `rm -rf .next`
3. Rebuild: `npm run build`
4. Restart PM2: `pm2 restart rss-reader-prod`

### PM2 Restart Loops
**Issue**: PM2 service restarts continuously (100+ times)
**Cause**: PM2 cluster mode is incompatible with Next.js production builds
**Solution**: 
1. Edit `ecosystem.config.js` and change `exec_mode: 'cluster'` to `exec_mode: 'fork'`
2. Restart PM2: `pm2 delete rss-reader-prod && pm2 start ecosystem.config.js --only rss-reader-prod`
3. Verify stability: `pm2 status` (check restart count)

### Port conflicts
- Ensure nothing else is running on port 80 (Caddy)
- Ensure nothing else is running on port 3000 (Next.js)
- Check with: `lsof -i :80` and `lsof -i :3000`

### Memory issues
- PM2 will auto-restart if memory exceeds 1GB
- Monitor with: `pm2 monit`
- Adjust limit in `ecosystem.config.js` if needed

## Log Files
All logs are stored in the `logs/` directory:
- `pm2-error.log` - Application errors
- `pm2-out.log` - Application output
- `caddy-access.log` - HTTP access logs

## Next Steps
After this setup is complete, configure:
1. TODO-012: Tailscale monitoring script
2. TODO-013: Clean data migration