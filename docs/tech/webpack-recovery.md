# Webpack Recovery Procedures

## Overview

This document outlines procedures for handling webpack build corruption issues that can occur with the RSS News Reader development server.

## Symptoms

The following symptoms indicate webpack corruption:

1. **Error Message**: `Cannot find module './XXX.js'` where XXX is a number (e.g., './276.js')
2. **Dev Server Crashes**: Server crashes during or after running tests
3. **Build Failures**: Next.js build process fails with module resolution errors
4. **Health Check Failures**: `/reader/api/health/app` endpoint returns errors or times out

## Automatic Prevention

The system now includes automatic prevention mechanisms:

1. **Startup Cleanup**: The `startup-sequence.sh` script automatically removes the `.next` directory on every startup
2. **Increased Memory Limits**: PM2 memory limit increased from 512MB to 1024MB for rss-reader-dev
3. **Health Monitoring**: The `monitor-services.sh` script detects webpack errors and runs recovery automatically

## Manual Recovery

If automatic recovery fails, use the one-command recovery script:

```bash
./scripts/webpack-recovery.sh
```

This script performs the following actions:

1. Stops the rss-reader-dev service
2. Removes `.next` and `node_modules/.cache` directories
3. Restarts the service
4. Verifies health check passes

## Alternative Manual Steps

If the recovery script is unavailable:

```bash
# 1. Stop the dev server
pm2 stop rss-reader-dev

# 2. Clean webpack artifacts
rm -rf .next
rm -rf node_modules/.cache

# 3. Restart the dev server
pm2 start ecosystem.config.js --only rss-reader-dev

# 4. Verify health
curl http://localhost:3000/reader/api/health/app
```

## Running Tests Safely

To prevent dev server crashes during testing:

```bash
# Use the safe test script
npm run test:integration:safe

# Or manually stop/start
pm2 stop rss-reader-dev
npm run test:integration
pm2 start rss-reader-dev
```

## Monitoring

Check for webpack errors in PM2 logs:

```bash
# View recent logs
pm2 logs rss-reader-dev --lines 50

# Check for specific errors
pm2 logs rss-reader-dev --lines 100 | grep "Cannot find module"
```

## Prevention Tips

1. **Regular Restarts**: The startup sequence now handles cleanup automatically
2. **Memory Monitoring**: Watch memory usage with `pm2 monit`
3. **Test Isolation**: Always use `test:integration:safe` for integration tests
4. **Log Monitoring**: Enable sync health monitor for automatic detection

## Troubleshooting

If recovery fails repeatedly:

1. Check disk space: `df -h`
2. Check memory: `free -h`
3. Clear all Next.js caches: `npm run clean`
4. Restart PM2 daemon: `pm2 kill && pm2 resurrect`
5. Check file permissions on `.next` directory

## Related Issues

- RR-110: Fix integration test server configuration
- RR-82: Webpack vendor chunk corruption (duplicate)
- RR-111: Integration test failures (duplicate)
