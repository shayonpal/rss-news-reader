#!/bin/bash

# Push monitoring data to Uptime Kuma
# Integrates with existing monitoring infrastructure

# Load configuration if available
CONFIG_FILE="/Users/shayon/DevProjects/rss-news-reader/.kuma-push-urls"
[ -f "$CONFIG_FILE" ] && source "$CONFIG_FILE"

# Configuration - Use environment variables or config file
KUMA_SYNC_URL="${KUMA_SYNC_URL:-}"
KUMA_API_URL="${KUMA_API_URL:-}"
KUMA_FETCH_URL="${KUMA_FETCH_URL:-}"
KUMA_DB_URL="${KUMA_DB_URL:-}"

# Source files
SYNC_LOG="/Users/shayon/DevProjects/rss-news-reader/logs/sync-cron.jsonl"
API_USAGE_URL="http://localhost:3000/reader/api/health/app"
FETCH_STATS_URL="http://localhost:3000/reader/api/health/parsing"
DB_HEALTH_URL="http://localhost:3001/server/health"

# Function to push sync status to Kuma
push_sync_status() {
    if [ -z "$KUMA_SYNC_URL" ]; then
        return 0
    fi
    
    # Get last sync info
    if [ -f "$SYNC_LOG" ]; then
        local last_sync=$(tail -10 "$SYNC_LOG" | jq -s 'map(select(.status == "completed" or .status == "error")) | last')
        
        if [ -n "$last_sync" ] && [ "$last_sync" != "null" ]; then
            local status=$(echo "$last_sync" | jq -r '.status')
            local timestamp=$(echo "$last_sync" | jq -r '.timestamp')
            local hours_ago=$(( ($(date +%s) - $(date -d "$timestamp" +%s 2>/dev/null || date -j -f "%Y-%m-%dT%H:%M:%S" "${timestamp%.*}" +%s)) / 3600 ))
            
            local msg="Last sync: ${hours_ago}h ago (${status})"
            local kuma_status="up"
            
            # Set status based on sync health
            if [ "$status" = "error" ]; then
                kuma_status="down"
            elif [ $hours_ago -gt 4 ]; then
                kuma_status="down"  # Down for stale sync
            fi
            
            # Push to Kuma with custom message
            curl -s -G "$KUMA_SYNC_URL" \
                --data-urlencode "status=${kuma_status}" \
                --data-urlencode "msg=${msg}" \
                --data-urlencode "ping=" > /dev/null 2>&1
        fi
    fi
}

# Function to push API usage to Kuma
push_api_usage() {
    if [ -z "$KUMA_API_URL" ]; then
        return 0
    fi
    
    # Check the health endpoint
    local response=$(curl -s "$API_USAGE_URL" 2>/dev/null)
    local http_code=$(curl -s -o /dev/null -w "%{http_code}" "$API_USAGE_URL" 2>/dev/null)
    
    if [ "$http_code" = "200" ] && [ -n "$response" ]; then
        # Extract health status and any relevant info
        local health_status=$(echo "$response" | jq -r '.status // "unknown"')
        local db_status=$(echo "$response" | jq -r '.dependencies.database // "unknown"')
        local oauth_status=$(echo "$response" | jq -r '.dependencies.oauth // "unknown"')
        local uptime=$(echo "$response" | jq -r '.uptime // 0')
        
        # Convert uptime to human readable
        local uptime_min=$((uptime / 60))
        
        local msg="API: ${health_status} | DB: ${db_status} | OAuth: ${oauth_status} | Uptime: ${uptime_min}m"
        local kuma_status="up"
        
        # Mark as down if health is not healthy or degraded
        if [ "$health_status" != "healthy" ] && [ "$health_status" != "degraded" ]; then
            kuma_status="down"
        fi
        
        curl -s -G "$KUMA_API_URL" \
            --data-urlencode "status=${kuma_status}" \
            --data-urlencode "msg=${msg}" \
            --data-urlencode "ping=" > /dev/null 2>&1
    else
        # Endpoint failed
        curl -s -G "$KUMA_API_URL" \
            --data-urlencode "status=down" \
            --data-urlencode "msg=API health endpoint unreachable (HTTP $http_code)" \
            --data-urlencode "ping=" > /dev/null 2>&1
    fi
}

# Function to push fetch success rate to Kuma
push_fetch_stats() {
    if [ -z "$KUMA_FETCH_URL" ]; then
        return 0
    fi
    
    local response=$(curl -s "$FETCH_STATS_URL" 2>/dev/null)
    
    if [ -n "$response" ] && echo "$response" | jq -e '.metrics.fetch' > /dev/null 2>&1; then
        # Extract the success rate (already formatted as percentage string)
        local success_rate=$(echo "$response" | jq -r '.metrics.fetch.successRate // "0%"')
        local api_total=$(echo "$response" | jq -r '.metrics.fetch.last24Hours.api.total // 0')
        local auto_total=$(echo "$response" | jq -r '.metrics.fetch.last24Hours.auto.total // 0')
        
        local msg="Fetch rate: ${success_rate} (${api_total} API calls, ${auto_total} auto-fetch excluded)"
        local kuma_status="up"
        
        # Extract numeric rate for comparison (remove % sign)
        local numeric_rate=$(echo "$success_rate" | sed 's/%$//')
        
        # Down if success rate is low (but only if there were actual API calls)
        if [ "$api_total" -gt 0 ] && [ $(echo "$numeric_rate < 80" | bc -l 2>/dev/null || echo 0) -eq 1 ]; then
            kuma_status="down"
        fi
        
        curl -s -G "$KUMA_FETCH_URL" \
            --data-urlencode "status=${kuma_status}" \
            --data-urlencode "msg=${msg}" \
            --data-urlencode "ping=" > /dev/null 2>&1
    else
        # If endpoint fails, report error
        curl -s -G "$KUMA_FETCH_URL" \
            --data-urlencode "status=down" \
            --data-urlencode "msg=Fetch stats endpoint error" \
            --data-urlencode "ping=" > /dev/null 2>&1
    fi
}

# Function to push database health to Kuma
push_db_health() {
    if [ -z "$KUMA_DB_URL" ]; then
        return 0
    fi
    
    local response=$(curl -s "$DB_HEALTH_URL" 2>/dev/null)
    
    if [ -n "$response" ]; then
        local queue_size=$(echo "$response" | jq -r '.queueStatus.size // 0')
        local last_activity=$(echo "$response" | jq -r '.lastActivity // "unknown"')
        
        local msg="DB Queue: ${queue_size} items"
        local kuma_status="up"
        
        # Down if queue is building up
        if [ "$queue_size" -gt 100 ]; then
            kuma_status="down"
        fi
        
        curl -s -G "$KUMA_DB_URL" \
            --data-urlencode "status=${kuma_status}" \
            --data-urlencode "msg=${msg}" \
            --data-urlencode "ping=" > /dev/null 2>&1
    fi
}

# Main execution
case "${1:-all}" in
    sync)
        push_sync_status
        ;;
    api)
        push_api_usage
        ;;
    fetch)
        push_fetch_stats
        ;;
    db)
        push_db_health
        ;;
    all)
        push_sync_status
        push_api_usage
        push_fetch_stats
        push_db_health
        ;;
    *)
        echo "Usage: $0 {sync|api|fetch|db|all}"
        echo "  sync  - Push sync status to Kuma"
        echo "  api   - Push API usage to Kuma"
        echo "  fetch - Push fetch success rate to Kuma"
        echo "  db    - Push database health to Kuma"
        echo "  all   - Push all metrics (default)"
        exit 1
        ;;
esac