#!/bin/bash

# RSS Reader Sync Health Monitor
# Monitors sync operations and health

LOG_FILE="/Users/shayon/DevProjects/rss-news-reader/logs/sync-health-monitor.jsonl"
SYNC_LOG="/Users/shayon/DevProjects/rss-news-reader/logs/sync-cron.jsonl"
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1398487627765649498/n6mIouChkYqBCL67vj5Jbn0XL67vj5Jbn0X0XP3uU_rFXhSRcRmQdE2yiJBcvPL7sF9VphClpie5ObE"

# Thresholds (Updated for 6x daily sync frequency)
SYNC_FAILURE_THRESHOLD=2  # Alert after 2 consecutive failures
SYNC_SUCCESS_HOURS=4  # Alert if no successful sync in 4 hours (matching sync interval)
SYNC_INTERVAL_HOURS=5  # Alert if no sync attempt in 5 hours (4-hour interval + 1 hour buffer)

# Get current timestamp
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Log event
log_event() {
    echo "$1" >> "$LOG_FILE"
}

# Check recent sync status
check_sync_status() {
    if [ ! -f "$SYNC_LOG" ]; then
        echo "no_sync_log"
        return 1
    fi
    
    # Get last 10 sync attempts with timeout
    local recent_syncs=$(timeout 5 tail -50 "$SYNC_LOG" | jq -s '
        map(select(.status == "completed" or .status == "error")) | 
        sort_by(.timestamp) | 
        reverse | 
        .[0:10]
    ' 2>/dev/null)
    
    if [ -z "$recent_syncs" ] || [ "$recent_syncs" = "null" ]; then
        echo "consecutive_failures:0"
        echo "hours_since_success:999"
        echo "hours_since_attempt:999"
        return 0
    fi
    
    # Count consecutive failures
    local consecutive_failures=0
    local last_success_time=""
    local last_attempt_time=""
    
    # Process each sync entry (avoid subshell with process substitution)
    while IFS= read -r sync; do
        local status=$(echo "$sync" | jq -r '.status' 2>/dev/null || echo "error")
        local timestamp=$(echo "$sync" | jq -r '.timestamp' 2>/dev/null || echo "")
        
        if [ -z "$timestamp" ]; then
            continue
        fi
        
        if [ -z "$last_attempt_time" ]; then
            last_attempt_time="$timestamp"
        fi
        
        if [ "$status" = "error" ]; then
            consecutive_failures=$((consecutive_failures + 1))
        else
            if [ -z "$last_success_time" ]; then
                last_success_time="$timestamp"
            fi
            break
        fi
    done < <(echo "$recent_syncs" | jq -c '.[]' 2>/dev/null || echo "")
    
    # Calculate time since last success
    local hours_since_success=""
    if [ -n "$last_success_time" ]; then
        # Use Node.js for cross-platform date parsing
        local last_success_epoch=$(node -e "console.log(Math.floor(new Date('$last_success_time').getTime() / 1000))")
        local current_epoch=$(date +%s)
        hours_since_success=$(( (current_epoch - last_success_epoch) / 3600 ))
    fi
    
    # Calculate time since last attempt
    local hours_since_attempt=""
    if [ -n "$last_attempt_time" ]; then
        # Use Node.js for cross-platform date parsing
        local last_attempt_epoch=$(node -e "console.log(Math.floor(new Date('$last_attempt_time').getTime() / 1000))")
        local current_epoch=$(date +%s)
        hours_since_attempt=$(( (current_epoch - last_attempt_epoch) / 3600 ))
    fi
    
    # Return status
    echo "consecutive_failures:$consecutive_failures"
    echo "hours_since_success:$hours_since_success"
    echo "hours_since_attempt:$hours_since_attempt"
}

# Function removed - freshness API no longer exists

# Send critical alert
send_critical_alert() {
    local title=$1
    local description=$2
    local fields=$3
    
    local payload=$(jq -n \
        --arg ts "$(get_timestamp)" \
        --arg title "$title" \
        --arg desc "$description" \
        --argjson fields "$fields" \
        '{
            "content": "@everyone",
            "embeds": [{
                "title": $title,
                "description": $desc,
                "color": 16711680,
                "fields": $fields,
                "timestamp": $ts
            }]
        }')
    
    curl -s -H "Content-Type: application/json" \
         -X POST \
         -d "$payload" \
         "$DISCORD_WEBHOOK" > /dev/null
}

# Main monitoring function
monitor_sync_health() {
    # Check sync status
    local sync_status=$(check_sync_status)
    
    local consecutive_failures=$(echo "$sync_status" | grep "consecutive_failures:" | cut -d: -f2)
    local hours_since_success=$(echo "$sync_status" | grep "hours_since_success:" | cut -d: -f2)
    local hours_since_attempt=$(echo "$sync_status" | grep "hours_since_attempt:" | cut -d: -f2)
    
    # Push to Kuma if configured
    if [ -n "${KUMA_SYNC_URL:-}" ]; then
        /Users/shayon/DevProjects/rss-news-reader/scripts/push-to-kuma.sh sync
    fi
    
    # Log current status (removed article freshness)
    local status_event=$(jq -c -n \
        --arg ts "$(get_timestamp)" \
        --arg failures "$consecutive_failures" \
        --arg success_hours "$hours_since_success" \
        --arg attempt_hours "$hours_since_attempt" \
        '{
            "timestamp": $ts,
            "consecutive_failures": ($failures | tonumber),
            "hours_since_success": ($success_hours | tonumber),
            "hours_since_attempt": ($attempt_hours | tonumber)
        }')
    
    log_event "$status_event"
    
    # Check alert conditions
    local alerts=()
    
    # Alert 1: Consecutive sync failures
    if [ "$consecutive_failures" -ge "$SYNC_FAILURE_THRESHOLD" ]; then
        alerts+=("sync_failures")
    fi
    
    # Alert 2: No successful sync in threshold time
    if [ -n "$hours_since_success" ] && [ "$hours_since_success" -ge "$SYNC_SUCCESS_HOURS" ]; then
        alerts+=("stale_sync")
    fi
    
    # Alert 3: No sync attempts (cron might be dead)
    if [ -n "$hours_since_attempt" ] && [ "$hours_since_attempt" -ge "$SYNC_INTERVAL_HOURS" ]; then
        alerts+=("no_sync_attempts")
    fi
    
    # Alert 4 removed - freshness API no longer exists
    
    # Send alerts if needed
    if [ ${#alerts[@]} -gt 0 ]; then
        local fields='['
        
        if [[ " ${alerts[@]} " =~ " sync_failures " ]]; then
            fields+='{"name":"❌ Sync Failures","value":"'$consecutive_failures' consecutive failures","inline":true},'
        fi
        
        if [[ " ${alerts[@]} " =~ " stale_sync " ]]; then
            fields+='{"name":"⏰ Last Successful Sync","value":"'$hours_since_success' hours ago","inline":true},'
        fi
        
        if [[ " ${alerts[@]} " =~ " no_sync_attempts " ]]; then
            fields+='{"name":"💀 Cron Service","value":"No sync attempts in '$hours_since_attempt' hours","inline":true},'
        fi
        
        
        # Add recommended actions
        fields+='{"name":"🔧 Recommended Actions","value":"1. Check PM2 status\\n2. Review sync logs\\n3. Verify API endpoints\\n4. Check OAuth tokens","inline":false}'
        
        fields+=']'
        
        send_critical_alert \
            "🚨 RSS Reader Sync Health Alert" \
            "Critical sync issues detected. Users may be seeing stale content!" \
            "$fields"
    fi
}

# Run as daemon or one-shot
case "${1:-}" in
    daemon)
        echo "Starting sync health monitor daemon..."
        while true; do
            monitor_sync_health
            sleep 3600  # Check every hour
        done
        ;;
    check)
        monitor_sync_health
        ;;
    *)
        echo "Usage: $0 {daemon|check}"
        echo "  daemon - Run continuously, checking every hour"
        echo "  check  - Run once and exit"
        exit 1
        ;;
esac