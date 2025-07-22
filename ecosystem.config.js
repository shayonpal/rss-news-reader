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
  }]
};