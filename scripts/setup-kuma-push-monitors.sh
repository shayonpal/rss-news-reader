#!/bin/bash

# Setup Uptime Kuma Push Monitors for RSS Reader
# This script helps configure and test push monitor integration

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration file for push URLs
CONFIG_FILE="/Users/shayon/DevProjects/rss-news-reader/.kuma-push-urls"
ENV_FILE="/Users/shayon/DevProjects/rss-news-reader/.env.local"

echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo -e "${BLUE}   Uptime Kuma Push Monitor Setup for RSS Reader    ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════${NC}"
echo ""

# Function to save URLs
save_urls() {
    cat > "$CONFIG_FILE" << EOF
# Uptime Kuma Push Monitor URLs
# Generated: $(date)
export KUMA_SYNC_URL="$1"
export KUMA_API_URL="$2"
export KUMA_FETCH_URL="$3"
export KUMA_DB_URL="$4"
EOF
    
    # Also append to .env.local if it exists
    if [ -f "$ENV_FILE" ]; then
        echo "" >> "$ENV_FILE"
        echo "# Uptime Kuma Push Monitor URLs (added $(date))" >> "$ENV_FILE"
        echo "KUMA_SYNC_URL=\"$1\"" >> "$ENV_FILE"
        echo "KUMA_API_URL=\"$2\"" >> "$ENV_FILE"
        echo "KUMA_FETCH_URL=\"$3\"" >> "$ENV_FILE"
        echo "KUMA_DB_URL=\"$4\"" >> "$ENV_FILE"
    fi
    
    echo -e "${GREEN}✅ URLs saved to $CONFIG_FILE${NC}"
    [ -f "$ENV_FILE" ] && echo -e "${GREEN}✅ URLs also added to .env.local${NC}"
}

# Function to test a push URL
test_push_url() {
    local url=$1
    local name=$2
    local msg=$3
    
    echo -n -e "Testing $name... "
    
    response=$(curl -s -G "$url" \
        --data-urlencode "status=0" \
        --data-urlencode "msg=$msg" \
        --data-urlencode "ping=" 2>&1)
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Success${NC}"
        return 0
    else
        echo -e "${RED}❌ Failed${NC}"
        echo "  Error: $response"
        return 1
    fi
}

# Check if URLs are already configured
if [ -f "$CONFIG_FILE" ]; then
    echo -e "${YELLOW}Found existing configuration in $CONFIG_FILE${NC}"
    source "$CONFIG_FILE"
    echo ""
    echo "Current URLs:"
    echo "  Sync:  ${KUMA_SYNC_URL:-Not set}"
    echo "  API:   ${KUMA_API_URL:-Not set}"
    echo "  Fetch: ${KUMA_FETCH_URL:-Not set}"
    echo "  DB:    ${KUMA_DB_URL:-Not set}"
    echo ""
    read -p "Do you want to reconfigure? (y/N): " reconfigure
    if [[ ! "$reconfigure" =~ ^[Yy]$ ]]; then
        echo "Using existing configuration."
    else
        KUMA_SYNC_URL=""
        KUMA_API_URL=""
        KUMA_FETCH_URL=""
        KUMA_DB_URL=""
    fi
fi

# Setup instructions if URLs not configured
if [ -z "$KUMA_SYNC_URL" ] || [ -z "$KUMA_API_URL" ] || [ -z "$KUMA_FETCH_URL" ] || [ -z "$KUMA_DB_URL" ]; then
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${YELLOW}Setup Instructions:${NC}"
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    echo "1. Open Uptime Kuma: http://localhost:3080"
    echo "2. Create 4 new monitors with these settings:"
    echo ""
    echo -e "${BLUE}Monitor 1: RSS Sync Status${NC}"
    echo "  - Monitor Type: Push"
    echo "  - Friendly Name: RSS Sync Status"
    echo "  - Heartbeat Interval: 300 seconds (5 minutes)"
    echo "  - Retries: 0"
    echo ""
    echo -e "${BLUE}Monitor 2: RSS API Usage${NC}"
    echo "  - Monitor Type: Push"
    echo "  - Friendly Name: RSS API Usage"
    echo "  - Heartbeat Interval: 3600 seconds (1 hour)"
    echo "  - Retries: 0"
    echo ""
    echo -e "${BLUE}Monitor 3: RSS Fetch Stats${NC}"
    echo "  - Monitor Type: Push"
    echo "  - Friendly Name: RSS Fetch Success Rate"
    echo "  - Heartbeat Interval: 1800 seconds (30 minutes)"
    echo "  - Retries: 0"
    echo ""
    echo -e "${BLUE}Monitor 4: RSS Database Health${NC}"
    echo "  - Monitor Type: Push"
    echo "  - Friendly Name: RSS Database Health"
    echo "  - Heartbeat Interval: 600 seconds (10 minutes)"
    echo "  - Retries: 0"
    echo ""
    echo "3. After creating each monitor, copy the Push URL"
    echo "   (looks like: http://localhost:3080/api/push/XXXXXXXXXX?...)"
    echo ""
    echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo ""
    
    # Collect URLs from user
    echo "Please enter the Push URLs from Uptime Kuma:"
    echo ""
    read -p "1. Sync Status Push URL: " KUMA_SYNC_URL
    read -p "2. API Usage Push URL: " KUMA_API_URL
    read -p "3. Fetch Stats Push URL: " KUMA_FETCH_URL
    read -p "4. Database Health Push URL: " KUMA_DB_URL
    
    # Save URLs
    save_urls "$KUMA_SYNC_URL" "$KUMA_API_URL" "$KUMA_FETCH_URL" "$KUMA_DB_URL"
fi

# Test the URLs
echo ""
echo -e "${BLUE}Testing Push URLs...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

source "$CONFIG_FILE" 2>/dev/null || true

test_push_url "$KUMA_SYNC_URL" "Sync Status" "Initial test - sync monitoring active"
test_push_url "$KUMA_API_URL" "API Usage" "Initial test - API monitoring active"
test_push_url "$KUMA_FETCH_URL" "Fetch Stats" "Initial test - fetch monitoring active"
test_push_url "$KUMA_DB_URL" "Database" "Initial test - DB monitoring active"

echo ""
echo -e "${BLUE}Setting up automated pushing...${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Create a systemd-style PM2 ecosystem config for monitoring
MONITOR_CONFIG="/Users/shayon/DevProjects/rss-news-reader/kuma-monitor.config.js"

cat > "$MONITOR_CONFIG" << 'EOF'
module.exports = {
  apps: [
    {
      name: "kuma-push-monitor",
      script: "/Users/shayon/DevProjects/rss-news-reader/scripts/kuma-push-daemon.sh",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "50M",
      env: {
        NODE_ENV: "production"
      },
      error_file: "/Users/shayon/DevProjects/rss-news-reader/logs/kuma-push-error.log",
      out_file: "/Users/shayon/DevProjects/rss-news-reader/logs/kuma-push-out.log",
      log_date_format: "YYYY-MM-DD HH:mm:ss Z",
      merge_logs: true
    }
  ]
};
EOF

# Create the daemon script
cat > "/Users/shayon/DevProjects/rss-news-reader/scripts/kuma-push-daemon.sh" << 'EOF'
#!/bin/bash

# Kuma Push Monitor Daemon
# Runs continuously and pushes metrics to Uptime Kuma

# Load configuration
source /Users/shayon/DevProjects/rss-news-reader/.kuma-push-urls 2>/dev/null || {
    echo "Error: Kuma URLs not configured. Run setup-kuma-push-monitors.sh first."
    exit 1
}

# Push script location
PUSH_SCRIPT="/Users/shayon/DevProjects/rss-news-reader/scripts/push-to-kuma.sh"

echo "Starting Kuma Push Monitor Daemon..."
echo "Sync URL: ${KUMA_SYNC_URL:0:50}..."
echo "API URL: ${KUMA_API_URL:0:50}..."
echo "Fetch URL: ${KUMA_FETCH_URL:0:50}..."
echo "DB URL: ${KUMA_DB_URL:0:50}..."

# Main loop
while true; do
    # Push sync status every 5 minutes
    $PUSH_SCRIPT sync
    
    # Push DB health every 10 minutes
    if [ $(($(date +%M) % 10)) -eq 0 ]; then
        $PUSH_SCRIPT db
    fi
    
    # Push fetch stats every 30 minutes
    if [ $(($(date +%M) % 30)) -eq 0 ]; then
        $PUSH_SCRIPT fetch
    fi
    
    # Push API usage every hour
    if [ $(date +%M) -eq 0 ]; then
        $PUSH_SCRIPT api
    fi
    
    # Sleep for 5 minutes
    sleep 300
done
EOF

chmod +x "/Users/shayon/DevProjects/rss-news-reader/scripts/kuma-push-daemon.sh"

echo -e "${GREEN}✅ Created kuma-push-daemon.sh${NC}"
echo -e "${GREEN}✅ Created PM2 config at $MONITOR_CONFIG${NC}"

echo ""
echo -e "${BLUE}Integration Options:${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Option 1: Add to PM2 (Recommended)"
echo -e "${YELLOW}pm2 start $MONITOR_CONFIG${NC}"
echo -e "${YELLOW}pm2 save${NC}"
echo ""
echo "Option 2: Add to existing sync-health-monitor"
echo "The sync-health-monitor.sh already has integration hooks."
echo "Just ensure it's running with the environment variables."
echo ""
echo "Option 3: Manual testing"
echo -e "${YELLOW}source $CONFIG_FILE${NC}"
echo -e "${YELLOW}./scripts/push-to-kuma.sh all${NC}"
echo ""

# Ask if user wants to start with PM2 now
read -p "Would you like to start the Kuma push monitor with PM2 now? (y/N): " start_now
if [[ "$start_now" =~ ^[Yy]$ ]]; then
    echo ""
    echo "Starting Kuma push monitor with PM2..."
    pm2 start "$MONITOR_CONFIG"
    pm2 save
    echo ""
    echo -e "${GREEN}✅ Kuma push monitor is now running!${NC}"
    echo "View status with: pm2 status kuma-push-monitor"
    echo "View logs with: pm2 logs kuma-push-monitor"
else
    echo ""
    echo "To start later, run:"
    echo "  pm2 start $MONITOR_CONFIG"
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"
echo -e "${GREEN}   Setup Complete! Monitoring is configured.        ${NC}"
echo -e "${GREEN}═══════════════════════════════════════════════════${NC}"