#!/bin/bash

# Optimize sync server for memory-constrained environment
# Created for RR-66: Sync API Health Check Critical Issue

set -e

echo "=== RSS Reader Sync Server Optimization ==="
echo "Addressing critical memory and stability issues"
echo

# 1. Check current memory status
echo "Current Memory Status:"
vm_stat | grep -E "free|compressed|swapins" | head -3
echo

# 2. Backup current PM2 configuration
echo "Backing up PM2 configuration..."
cp ecosystem.config.js ecosystem.config.js.backup-$(date +%Y%m%d-%H%M%S)

# 3. Apply memory optimizations
echo "Applying memory optimizations..."

# Create optimized PM2 config for sync server
cat > ecosystem.config.sync-optimized.js << 'EOF'
// Optimized configuration for sync server - RR-66
module.exports = {
  apps: [{
    name: 'rss-sync-server',
    script: './server/server.js',
    instances: 1,
    exec_mode: 'fork',
    
    // Memory management
    max_memory_restart: '200M',  // Reduced from 256M
    node_args: '--max-old-space-size=192',  // Explicit heap limit
    
    // Restart policy
    min_uptime: 30000,  // 30 seconds - increased from 10s
    max_restarts: 20,   // Reduced from 30
    restart_delay: 5000,  // 5 seconds fixed delay
    exp_backoff_restart_delay: 0,  // Disable exponential backoff
    
    // Kill settings
    kill_timeout: 20000,  // 20 seconds - increased from 15s
    kill_retry_time: 3000,  // 3 seconds between retries
    
    // Health monitoring
    watch: false,
    autorestart: true,
    time: true,
    
    env: {
      NODE_ENV: 'production',
      SERVER_PORT: 3001,
      
      // Memory optimization flags
      NODE_OPTIONS: '--max-old-space-size=192',
      UV_THREADPOOL_SIZE: 2,  // Reduce thread pool size
      
      // Sync configuration
      SYNC_INTERVAL_MINUTES: 10,  // Increased from 5
      SYNC_MIN_CHANGES: 10,  // Increased from 5
      SYNC_BATCH_SIZE: 50,  // Reduced from 100
      SYNC_MAX_RETRIES: 2,  // Reduced from 3
      SYNC_RETRY_BACKOFF_MINUTES: 30,  // Increased from 10
      
      // Database
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
      NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      
      // Inoreader OAuth
      INOREADER_CLIENT_ID: process.env.INOREADER_CLIENT_ID,
      INOREADER_CLIENT_SECRET: process.env.INOREADER_CLIENT_SECRET,
      INOREADER_REDIRECT_URI: process.env.INOREADER_REDIRECT_URI,
      
      // Token encryption
      TOKEN_ENCRYPTION_KEY: process.env.TOKEN_ENCRYPTION_KEY,
      RSS_READER_TOKENS_PATH: '/Users/shayon/.rss-reader/tokens.json'
    },
    
    error_file: './logs/sync-server-error.log',
    out_file: './logs/sync-server-out.log',
    merge_logs: false,
    log_date_format: 'YYYY-MM-DD HH:mm:ss'
  }]
};
EOF

# 4. Apply system-level optimizations
echo "Applying system optimizations..."

# Rotate logs to free up space
pm2 flush rss-sync-server || true

# Clear old log files
find logs/ -name "sync-server-*.log" -mtime +7 -delete 2>/dev/null || true

# 5. Restart sync server with new configuration
echo "Restarting sync server with optimized configuration..."
pm2 delete rss-sync-server || true
pm2 start ecosystem.config.sync-optimized.js

# 6. Save PM2 state
pm2 save --force

# 7. Display new status
echo
echo "Optimization complete. New sync server status:"
pm2 show rss-sync-server

echo
echo "Memory status after optimization:"
vm_stat | grep -E "free|compressed|swapins" | head -3

echo
echo "=== Recommendations ==="
echo "1. Monitor sync server closely for next 24 hours"
echo "2. Check logs: pm2 logs rss-sync-server"
echo "3. If stable, merge optimized config into main ecosystem.config.js"
echo "4. Consider implementing proper database schema fix for api_usage table"
echo "5. Set up automated memory monitoring alerts"
echo
echo "To rollback: pm2 delete rss-sync-server && pm2 start ecosystem.config.js"