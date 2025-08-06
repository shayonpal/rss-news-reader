#!/bin/bash

# PM2 wrapper for monitor-services.sh
# This script runs the monitoring in foreground mode for PM2 compatibility

set -e

# Set up paths
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Set configuration
CHECK_INTERVAL="${CHECK_INTERVAL:-120}"
LOG_FILE="${LOG_FILE:-$PROJECT_ROOT/logs/services-monitor.jsonl}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
MAX_RESTARTS_PER_HOUR="${MAX_RESTARTS_PER_HOUR:-3}"
RESTART_COOLDOWN="${RESTART_COOLDOWN:-300}"

# Health endpoints
health_url="${HEALTH_URL:-http://localhost:3000/api/health}"
cron_health_url="http://localhost:3000/api/health/cron"
sync_health_url="http://localhost:3001/health"

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Restart tracking files (using files instead of associative arrays for compatibility)
RESTART_TRACKING_DIR="$PROJECT_ROOT/logs/restart-tracking"
mkdir -p "$RESTART_TRACKING_DIR"

# Log event in JSONL format
log_event() {
    local event_type="$1"
    local service="$2"
    local status="$3"
    local message="$4"
    local timestamp=$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")
    
    echo "{\"timestamp\":\"$timestamp\",\"event\":\"$event_type\",\"service\":\"$service\",\"status\":\"$status\",\"message\":\"$message\"}" >> "$LOG_FILE"
}

# Send Discord notification
send_discord_notification() {
    local message="$1"
    local color="$2"
    
    if [ -n "$DISCORD_WEBHOOK_URL" ]; then
        local embed_color
        case "$color" in
            "red") embed_color="15158332" ;;
            "yellow") embed_color="16776960" ;;
            "green") embed_color="3066993" ;;
            *) embed_color="8421504" ;;
        esac
        
        curl -s -H "Content-Type: application/json" \
            -d "{\"embeds\":[{\"title\":\"RSS Reader Alert\",\"description\":\"$message\",\"color\":$embed_color,\"timestamp\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\"}]}" \
            "$DISCORD_WEBHOOK_URL" > /dev/null 2>&1
    fi
}

# Get restart count for a service
get_restart_count() {
    local service="$1"
    local count_file="$RESTART_TRACKING_DIR/${service}_count"
    if [ -f "$count_file" ]; then
        cat "$count_file"
    else
        echo "0"
    fi
}

# Set restart count for a service
set_restart_count() {
    local service="$1"
    local count="$2"
    echo "$count" > "$RESTART_TRACKING_DIR/${service}_count"
}

# Get last restart time for a service
get_last_restart_time() {
    local service="$1"
    local time_file="$RESTART_TRACKING_DIR/${service}_time"
    if [ -f "$time_file" ]; then
        cat "$time_file"
    else
        echo "0"
    fi
}

# Set last restart time for a service
set_last_restart_time() {
    local service="$1"
    local time="$2"
    echo "$time" > "$RESTART_TRACKING_DIR/${service}_time"
}

# Rate-limited restart function
restart_service_with_limit() {
    local service="$1"
    local current_time=$(date +%s)
    
    # Get current restart tracking
    local restart_count=$(get_restart_count "$service")
    local last_restart=$(get_last_restart_time "$service")
    local time_since_last=$((current_time - last_restart))
    
    # Reset counter if more than an hour has passed
    if [ $time_since_last -gt 3600 ]; then
        restart_count=0
        set_restart_count "$service" 0
    fi
    
    # Check if within cooldown period
    if [ $time_since_last -lt $RESTART_COOLDOWN ]; then
        local remaining=$((RESTART_COOLDOWN - time_since_last))
        echo -e "${YELLOW}⏳ Restart cooldown active for $service. Wait ${remaining}s${NC}"
        log_event "restart_throttled" "$service" "cooldown" "Waiting ${remaining}s before next restart attempt"
        return 1
    fi
    
    # Check rate limit
    if [ $restart_count -ge $MAX_RESTARTS_PER_HOUR ]; then
        echo -e "${RED}❌ Rate limit reached for $service (max $MAX_RESTARTS_PER_HOUR/hour)${NC}"
        log_event "restart_throttled" "$service" "rate_limited" "Max restarts per hour reached"
        send_discord_notification "⚠️ Service $service restart rate limited. Manual intervention may be required." "red"
        return 1
    fi
    
    # Perform restart
    echo -e "${YELLOW}🔄 Restarting $service...${NC}"
    log_event "restart_attempt" "$service" "starting" "Attempting automatic restart"
    
    case "$service" in
        "rss-reader-dev")
            pm2 restart rss-reader-dev
            ;;
        "rss-sync-cron")
            pm2 restart rss-sync-cron
            ;;
        "rss-sync-server")
            pm2 restart rss-sync-server
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            return 1
            ;;
    esac
    
    # Update counters
    restart_count=$((restart_count + 1))
    set_restart_count "$service" "$restart_count"
    set_last_restart_time "$service" "$current_time"
    
    echo -e "${GREEN}✅ $service restarted ($restart_count/$MAX_RESTARTS_PER_HOUR this hour)${NC}"
    log_event "restart_complete" "$service" "success" "Restart $restart_count of $MAX_RESTARTS_PER_HOUR"
    send_discord_notification "🔄 Service $service automatically restarted (attempt $restart_count/$MAX_RESTARTS_PER_HOUR)" "yellow"
    
    return 0
}

# Check main app health
check_main_app() {
    local response=$(curl -s -m 1 -w "\n%{http_code}" "$health_url" 2>/dev/null || echo "000")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "200" ]; then
        # Check if response is JSON
        if echo "$body" | jq . > /dev/null 2>&1; then
            log_event "health_check" "main_app" "healthy" "HTTP $http_code"
        else
            # HTML response when JSON expected
            echo -e "${RED}⚠️  Main app returned HTML instead of JSON${NC}"
            log_event "health_check" "main_app" "html_response" "Received HTML instead of JSON"
            send_discord_notification "🚨 Main app API returning HTML instead of JSON - attempting restart" "red"
            restart_service_with_limit "rss-reader-dev"
        fi
    elif [ "$http_code" = "000" ]; then
        echo -e "${RED}❌ Main app is not responding${NC}"
        log_event "health_check" "main_app" "timeout" "No response from service"
        restart_service_with_limit "rss-reader-dev"
    else
        echo -e "${YELLOW}⚠️  Main app returned HTTP $http_code${NC}"
        log_event "health_check" "main_app" "unhealthy" "HTTP $http_code"
        
        # Check if error response is HTML
        if echo "$body" | grep -q "<html"; then
            echo -e "${RED}⚠️  Error page is HTML, likely Next.js failure${NC}"
            log_event "health_check" "main_app" "html_error" "HTML error page detected"
            restart_service_with_limit "rss-reader-dev"
        fi
    fi
}

# Check cron service
check_cron_service() {
    local response=$(curl -s -m 1 "$cron_health_url" 2>/dev/null || echo "{}")
    
    if echo "$response" | jq -e '.status == "healthy"' > /dev/null 2>&1; then
        log_event "health_check" "cron" "healthy" "Service running"
    else
        echo -e "${YELLOW}⚠️  Cron service may have issues${NC}"
        log_event "health_check" "cron" "warning" "Check cron logs for details"
    fi
}

# Note: Freshness check removed after RR-106 - monitoring is now handled via sync logs

# Check sync server
check_sync_server() {
    local response=$(curl -s -m 1 -w "\n%{http_code}" "$sync_health_url" 2>/dev/null || echo "000")
    local http_code=$(echo "$response" | tail -n1)
    
    if [ "$http_code" = "200" ]; then
        log_event "health_check" "sync_server" "healthy" "HTTP $http_code"
    elif [ "$http_code" = "000" ]; then
        echo -e "${RED}❌ Sync server is not responding${NC}"
        log_event "health_check" "sync_server" "timeout" "No response from service"
        restart_service_with_limit "rss-sync-server"
    else
        echo -e "${YELLOW}⚠️  Sync server returned HTTP $http_code${NC}"
        log_event "health_check" "sync_server" "unhealthy" "HTTP $http_code"
    fi
}

# Run monitoring loop in foreground (no backgrounding for PM2)
echo "🚀 Starting RSS Reader services monitoring (PM2 mode)"
echo "Monitoring configuration:"
echo "  - Health URL: $health_url"
echo "  - Sync Server URL: $sync_health_url"
echo "  - Check interval: ${CHECK_INTERVAL}s"
echo "  - Log file: $LOG_FILE"

# Handle shutdown gracefully
trap 'echo "Received shutdown signal, stopping monitor..."; exit 0' SIGTERM SIGINT

# Main monitoring loop
while true; do
    check_main_app
    check_cron_service
    check_sync_server
    
    # Sleep with interrupt handling
    sleep "$CHECK_INTERVAL" &
    wait $!
done