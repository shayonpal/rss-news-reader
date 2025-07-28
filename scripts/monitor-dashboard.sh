#!/bin/bash

# RSS Reader Monitoring Dashboard
# Shows comprehensive health status of all services

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to check service status
check_service() {
    local service=$1
    local url=$2
    local expected_status=${3:-200}
    
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "$expected_status" ]; then
        echo -e "${GREEN}✅ ${service}: Healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ ${service}: Down (HTTP $response)${NC}"
        return 1
    fi
}

# Function to check PM2 process
check_pm2_process() {
    local name=$1
    local status=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name == \"$name\") | .pm2_env.status")
    
    if [ "$status" = "online" ]; then
        local restarts=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name == \"$name\") | .pm2_env.restart_time")
        local memory=$(pm2 jlist 2>/dev/null | jq -r ".[] | select(.name == \"$name\") | .monit.memory" | numfmt --to=iec-i --suffix=B)
        echo -e "${GREEN}✅ ${name}: Online${NC} (Restarts: $restarts, Memory: $memory)"
        return 0
    else
        echo -e "${RED}❌ ${name}: $status${NC}"
        return 1
    fi
}

# Function to check sync status
check_sync_status() {
    local sync_log="/Users/shayon/DevProjects/rss-news-reader/logs/sync-cron.jsonl"
    
    if [ ! -f "$sync_log" ]; then
        echo -e "${RED}❌ Sync Status: No log file${NC}"
        return 1
    fi
    
    # Get last sync info
    local last_sync=$(tail -10 "$sync_log" | jq -s 'map(select(.status == "completed" or .status == "error")) | last')
    
    if [ -z "$last_sync" ] || [ "$last_sync" = "null" ]; then
        echo -e "${YELLOW}⚠️  Sync Status: No recent syncs${NC}"
        return 1
    fi
    
    local status=$(echo "$last_sync" | jq -r '.status')
    local timestamp=$(echo "$last_sync" | jq -r '.timestamp')
    local hours_ago=$(( ($(date +%s) - $(date -d "$timestamp" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${timestamp%.*}" +%s)) / 3600 ))
    
    if [ "$status" = "completed" ]; then
        if [ $hours_ago -gt 12 ]; then
            echo -e "${YELLOW}⚠️  Last Sync: ${hours_ago}h ago (stale)${NC}"
        else
            echo -e "${GREEN}✅ Last Sync: ${hours_ago}h ago${NC}"
        fi
    else
        echo -e "${RED}❌ Last Sync: Failed ${hours_ago}h ago${NC}"
    fi
}

# Function to check article freshness
check_article_freshness() {
    local response=$(curl -s "http://localhost:3147/reader/api/health/freshness" 2>/dev/null)
    
    if [ -z "$response" ]; then
        echo -e "${RED}❌ Article Freshness: Cannot check${NC}"
        return 1
    fi
    
    local hours=$(echo "$response" | jq -r '.hoursSinceLastArticle')
    local status=$(echo "$response" | jq -r '.status')
    
    if [ "$status" = "healthy" ]; then
        echo -e "${GREEN}✅ Article Freshness: ${hours}h old${NC}"
    else
        echo -e "${YELLOW}⚠️  Article Freshness: ${hours}h old (stale)${NC}"
    fi
}

# Main dashboard
clear
echo "======================================"
echo -e "${BLUE}RSS Reader Monitoring Dashboard${NC}"
echo "======================================"
echo -e "Time: $(date '+%Y-%m-%d %H:%M:%S %Z')\n"

echo -e "${BLUE}Service Health:${NC}"
echo "---------------------"
check_service "Production App" "http://100.96.166.53:3147/reader/api/health/app?ping=true"
check_service "Sync Server" "http://localhost:3001/server/health"
check_service "Database" "http://100.96.166.53:3147/reader/api/health/db"
check_service "Dev App" "http://100.96.166.53:3000/reader/api/health/app?ping=true" || true

echo -e "\n${BLUE}PM2 Processes:${NC}"
echo "---------------------"
check_pm2_process "rss-reader-prod"
check_pm2_process "rss-sync-server"
check_pm2_process "rss-sync-cron"
check_pm2_process "rss-reader-dev" || true

echo -e "\n${BLUE}Sync Health:${NC}"
echo "---------------------"
check_sync_status
check_article_freshness

echo -e "\n${BLUE}Monitoring Services:${NC}"
echo "---------------------"
# Check internal monitor
if pgrep -f "monitor-services.sh" > /dev/null; then
    echo -e "${GREEN}✅ Internal Monitor: Running${NC}"
else
    echo -e "${YELLOW}⚠️  Internal Monitor: Not running${NC}"
fi

# Check sync health monitor
if pgrep -f "sync-health-monitor.sh daemon" > /dev/null; then
    echo -e "${GREEN}✅ Sync Health Monitor: Running${NC}"
else
    echo -e "${YELLOW}⚠️  Sync Health Monitor: Not running${NC}"
fi

# Check Uptime Kuma
if docker ps | grep -q uptime-kuma; then
    echo -e "${GREEN}✅ Uptime Kuma: Running${NC}"
else
    echo -e "${YELLOW}⚠️  Uptime Kuma: Not running${NC}"
fi

echo -e "\n${BLUE}Recent Alerts:${NC}"
echo "---------------------"
# Check for recent errors in service monitor log
if [ -f "/Users/shayon/DevProjects/rss-news-reader/logs/services-monitor.jsonl" ]; then
    recent_errors=$(tail -20 "/Users/shayon/DevProjects/rss-news-reader/logs/services-monitor.jsonl" | jq -r 'select(.status_code != "200" or .health_status != "healthy") | "\(.timestamp) \(.service): \(.status_code // .health_status)"' | tail -5)
    if [ -z "$recent_errors" ]; then
        echo -e "${GREEN}No recent errors${NC}"
    else
        echo -e "${YELLOW}$recent_errors${NC}"
    fi
else
    echo "No monitor log found"
fi

echo -e "\n======================================"
echo -e "${BLUE}Actions:${NC}"
echo "1. View detailed logs: pm2 logs"
echo "2. Restart all services: pm2 restart ecosystem.config.js"
echo "3. Check Uptime Kuma: http://localhost:3080"
echo "4. Manual sync: curl -X POST http://localhost:3147/reader/api/sync"
echo "======================================"