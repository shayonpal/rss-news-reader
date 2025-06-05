# Mac Mini Deployment Guide - Shayon's News

## Overview

This guide covers deploying the RSS Reader PWA on a Mac Mini for 24/7 self-hosted operation. The deployment uses PM2 for process management and runs on a non-standard port for security.

## System Requirements

### Hardware
- **Mac Mini**: M1/M2 or Intel-based
- **RAM**: 24GB available
- **Storage**: 10GB free space for app + data
- **Network**: Stable internet connection

### Software Prerequisites
- **macOS**: 12.0 (Monterey) or later
- **Node.js**: 18.x or 20.x LTS
- **npm**: 8.x or later
- **Git**: For pulling updates. `gh` CLI is already installed in the development machine.

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Mac Mini Server                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────────────┐    ┌─────────────────┐               │
│  │   Next.js App   │    │    PM2 Manager   │               │
│  │   Port: 7419    │◄───│   (Process Mgr)  │               │
│  └────────┬────────┘    └─────────────────┘               │
│           │                                                 │
│           ▼                                                 │
│  ┌─────────────────┐    ┌─────────────────┐               │
│  │   IndexedDB     │    │   File System   │               │
│  │  (Browser Data) │    │  (Cached Files) │               │
│  └─────────────────┘    └─────────────────┘               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
                    External APIs
                    - Inoreader API
                    - Anthropic Claude API
```

## Installation Steps

### 1. Initial Setup

```bash
# Create application directory
mkdir -p ~/DevProjects/rss-news-reader
cd ~/DevProjects/rss-news-reader

# Clone the repository
git clone https://github.com/shayonpal/rss-news-reader.git .

# Install dependencies
npm install

# Build the application
npm run build
```

### 2. Environment Configuration

Create `.env.local` file:
```bash
# Application Configuration
NODE_ENV=production
PORT=7419  # Non-standard port for security

# API Keys (replace with actual values)
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_INOREADER_CLIENT_ID=...
NEXT_PUBLIC_INOREADER_CLIENT_SECRET=...
NEXT_PUBLIC_INOREADER_REDIRECT_URI=http://localhost:7419/auth/callback

# Performance Settings
NEXT_TELEMETRY_DISABLED=1
```

### 3. PM2 Process Manager Setup

```bash
# Install PM2 globally
npm install -g pm2

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'shayon-news',
    script: 'node_modules/.bin/next',
    args: 'start',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'production',
      PORT: 7419
    },
    error_file: 'logs/error.log',
    out_file: 'logs/output.log',
    log_file: 'logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z'
  }]
}
EOF

# Create logs directory
mkdir -p logs
```

### 4. Start the Application

```bash
# Start with PM2
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Set up auto-start on boot
pm2 startup
# Follow the command output to complete setup
```

### 5. Configure macOS for 24/7 Operation

#### Prevent Sleep
```bash
# Create a launch agent to prevent sleep
cat > ~/Library/LaunchAgents/com.shayon.news.nosleep.plist << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" 
  "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.shayon.news.nosleep</string>
    <key>ProgramArguments</key>
    <array>
        <string>caffeinate</string>
        <string>-i</string>
        <string>-s</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

# Load the agent
launchctl load ~/Library/LaunchAgents/com.shayon.news.nosleep.plist
```

#### System Preferences
1. **Energy Saver**:
   - Prevent computer from sleeping automatically
   - Wake for network access: ON
   - Start up automatically after power failure: ON

2. **Security & Privacy**:
   - Firewall: Allow incoming connections for Node.js
   - Full Disk Access: Grant to Terminal (for PM2)

3. **Users & Groups**:
   - Login Options: Automatic login for deployment user
   - Set strong password for remote access

## Network Configuration

### 1. Local Network Access

```bash
# Check current firewall status
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --getglobalstate

# Allow Node.js through firewall
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --add $(which node)
sudo /usr/libexec/ApplicationFirewall/socketfilterfw --unblockapp $(which node)
```

### 2. Router Configuration (if needed for external access)

- Forward port 7419 to Mac Mini's internal IP
- Set static IP for Mac Mini via DHCP reservation
- Configure dynamic DNS if needed

### 3. Security Hardening

```nginx
# If using nginx as reverse proxy (optional)
server {
    listen 80;
    server_name shayon-news.local;
    
    location / {
        proxy_pass http://localhost:7419;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # Security headers
        add_header X-Frame-Options "SAMEORIGIN" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-XSS-Protection "1; mode=block" always;
    }
}
```

## Monitoring & Maintenance

### 1. Health Monitoring

```bash
# Create health check script
cat > ~/Applications/shayon-news/health-check.sh << 'EOF'
#!/bin/bash

# Check if app is running
if pm2 list | grep -q "shayon-news.*online"; then
    echo "✅ App is running"
else
    echo "❌ App is not running"
    pm2 restart shayon-news
fi

# Check port availability
if lsof -i :7419 | grep -q LISTEN; then
    echo "✅ Port 7419 is listening"
else
    echo "❌ Port 7419 is not listening"
fi

# Check API endpoint
if curl -s -o /dev/null -w "%{http_code}" http://localhost:7419/api/health | grep -q "200"; then
    echo "✅ API is responding"
else
    echo "❌ API is not responding"
fi
EOF

chmod +x ~/Applications/shayon-news/health-check.sh

# Add to crontab for regular checks
(crontab -l 2>/dev/null; echo "*/15 * * * * ~/Applications/shayon-news/health-check.sh >> ~/Applications/shayon-news/logs/health.log 2>&1") | crontab -
```

### 2. Log Management

```bash
# PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# View logs
pm2 logs shayon-news
pm2 logs shayon-news --lines 100
```

### 3. Backup Strategy

```bash
# Create backup script
cat > ~/Applications/shayon-news/backup.sh << 'EOF'
#!/bin/bash

BACKUP_DIR=~/Backups/shayon-news
DATE=$(date +%Y%m%d_%H%M%S)

# Create backup directory
mkdir -p $BACKUP_DIR

# Backup environment files
cp .env.local $BACKUP_DIR/.env.local.$DATE

# Backup PM2 configuration
pm2 save
cp ~/.pm2/dump.pm2 $BACKUP_DIR/pm2-dump.$DATE

# Backup application data (if stored locally)
# Add specific backup commands for IndexedDB exports if implemented

echo "Backup completed: $BACKUP_DIR/*.$DATE"
EOF

chmod +x ~/Applications/shayon-news/backup.sh

# Add to crontab for daily backups
(crontab -l 2>/dev/null; echo "0 2 * * * ~/Applications/shayon-news/backup.sh") | crontab -
```

## Updating the Application

```bash
# Standard update procedure
cd ~/Applications/shayon-news

# Stop the application
pm2 stop shayon-news

# Pull latest changes
git pull origin main

# Install new dependencies
npm install

# Build the application
npm run build

# Start the application
pm2 restart shayon-news

# Verify deployment
pm2 status
curl http://localhost:7419/api/health
```

## Troubleshooting

### Common Issues

#### 1. Port Already in Use
```bash
# Find process using port 7419
lsof -i :7419

# Kill process if needed
kill -9 <PID>
```

#### 2. PM2 Not Starting on Boot
```bash
# Re-run startup command
pm2 startup

# Copy and execute the output command
pm2 save
```

#### 3. High Memory Usage
```bash
# Check memory usage
pm2 monit

# Restart if needed
pm2 restart shayon-news

# Adjust memory limit in ecosystem.config.js
```

#### 4. Database Issues
```bash
# Clear browser cache/IndexedDB
# Navigate to: http://localhost:7419
# Open DevTools > Application > Storage > Clear site data
```

### Debug Mode
```bash
# Run in debug mode
NODE_ENV=development npm run dev

# Check detailed logs
pm2 logs shayon-news --raw
```

## Performance Optimization

### 1. macOS Specific Optimizations
```bash
# Increase file descriptor limits
ulimit -n 4096

# Add to ~/.zshrc or ~/.bash_profile
echo "ulimit -n 4096" >> ~/.zshrc
```

### 2. Node.js Optimizations
```javascript
// In ecosystem.config.js
module.exports = {
  apps: [{
    // ... existing config
    node_args: '--max-old-space-size=2048',
    env: {
      NODE_OPTIONS: '--max-http-header-size=16384'
    }
  }]
}
```

### 3. Next.js Production Optimizations
```javascript
// next.config.js
module.exports = {
  compress: true,
  poweredByHeader: false,
  generateEtags: true,
  
  experimental: {
    // Enable if using app directory
    appDir: true,
  }
}
```

## Security Checklist

- [ ] Strong password on Mac Mini user account
- [ ] FileVault encryption enabled
- [ ] Firewall configured and enabled
- [ ] Automatic security updates enabled
- [ ] Remote access limited (SSH disabled or key-only)
- [ ] Environment variables properly secured
- [ ] Regular backups configured
- [ ] Log monitoring in place
- [ ] API keys rotated regularly

## Monitoring Dashboard

Access the application and monitoring:
- **Application**: http://localhost:7419
- **PM2 Web Monitor**: `pm2 web` (runs on port 9615)
- **System Logs**: `~/Applications/shayon-news/logs/`

## Support Resources

- **PM2 Documentation**: https://pm2.keymetrics.io/
- **Next.js Production**: https://nextjs.org/docs/deployment
- **macOS Server Guide**: https://support.apple.com/guide/mac-help/
- **Application Logs**: `~/Applications/shayon-news/logs/`

---

*This deployment is optimized for single-user access on a local network. For multi-user or internet-facing deployments, additional security measures would be required.*