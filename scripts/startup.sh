#!/bin/bash

# RSS Reader Startup Script
# This script starts PM2 apps and Caddy on system boot

set -e

# Log file
LOG_FILE="/Users/shayon/DevProjects/rss-news-reader/logs/startup.log"
ERROR_FILE="/Users/shayon/DevProjects/rss-news-reader/logs/startup-error.log"

# Create log directory if it doesn't exist
mkdir -p /Users/shayon/DevProjects/rss-news-reader/logs

# Function to log messages
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if a process is running
is_running() {
    pgrep -f "$1" > /dev/null 2>&1
}

log "Starting RSS Reader services..."

# Wait for network connectivity
log "Waiting for network..."
while ! ping -c 1 google.com > /dev/null 2>&1; do
    sleep 2
done
log "Network is available"

# Set up environment
export PATH="/Users/shayon/.nvm/versions/node/v23.5.0/bin:/opt/homebrew/bin:$PATH"
export NVM_DIR="/Users/shayon/.nvm"

# Change to project directory
cd /Users/shayon/DevProjects/rss-news-reader

# Start PM2 if not running
if ! is_running "PM2"; then
    log "Starting PM2 daemon..."
    pm2 resurrect >> "$LOG_FILE" 2>> "$ERROR_FILE"
    
    # Wait for PM2 to start
    sleep 5
    
    # List PM2 processes
    pm2 list >> "$LOG_FILE" 2>> "$ERROR_FILE"
else
    log "PM2 is already running"
fi

# Start Caddy if not running
if ! is_running "caddy"; then
    log "Starting Caddy..."
    caddy start --config ./Caddyfile >> "$LOG_FILE" 2>> "$ERROR_FILE"
    
    # Wait for Caddy to start
    sleep 3
    
    # Check if Caddy is running
    if is_running "caddy"; then
        log "Caddy started successfully"
    else
        log "ERROR: Failed to start Caddy"
        exit 1
    fi
else
    log "Caddy is already running"
fi

# Health check
sleep 5
if curl -s http://localhost:3147/reader > /dev/null; then
    log "✅ RSS Reader is running on port 3147"
else
    log "⚠️  RSS Reader may not be responding correctly"
fi

if curl -s http://localhost/reader > /dev/null; then
    log "✅ Caddy reverse proxy is working"
else
    log "⚠️  Caddy reverse proxy may not be working"
fi

log "Startup complete!"