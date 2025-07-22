module.exports = {
  apps: [{
    name: 'rss-reader',
    script: 'npm',
    args: 'start',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: 'logs/pm2-error.log',
    out_file: 'logs/pm2-out.log',
    merge_logs: true,
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }, {
    name: 'rss-sync-cron',
    script: './src/server/cron.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '256M',
    env: {
      NODE_ENV: 'production',
      ENABLE_AUTO_SYNC: 'true',
      SYNC_CRON_SCHEDULE: '0 2,14 * * *',
      SYNC_LOG_PATH: './logs/sync-cron.jsonl',
      NEXT_PUBLIC_BASE_URL: 'http://localhost:3000'
    },
    error_file: 'logs/cron-error.log',
    out_file: 'logs/cron-out.log',
    merge_logs: true,
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
};