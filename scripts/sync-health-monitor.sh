#!/bin/bash

# RSS Reader Sync Health Monitor
# Monitors sync operations and article freshness

LOG_FILE="/Users/shayon/DevProjects/rss-news-reader/logs/sync-health-monitor.jsonl"
SYNC_LOG="/Users/shayon/DevProjects/rss-news-reader/logs/sync-cron.jsonl"
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1398487627765649498/n6mIouChkYqBCL67vj5Jbn0XL67vj5Jbn0X0XP3uU_rFXhSRcRmQdE2yiJBcvPL7sF9VphClpie5ObE"

# Thresholds
SYNC_FAILURE_THRESHOLD=2  # Alert after 2 consecutive failures
ARTICLE_FRESHNESS_HOURS=12  # Alert if no new articles in 12 hours
SYNC_INTERVAL_HOURS=15  # Alert if no sync attempt in 15 hours

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
    
    # Get last 10 sync attempts
    local recent_syncs=$(tail -50 "$SYNC_LOG" | jq -s '
        map(select(.status == "completed" or .status == "error")) | 
        sort_by(.timestamp) | 
        reverse | 
        .[0:10]
    ')
    
    # Count consecutive failures
    local consecutive_failures=0
    local last_success_time=""
    local last_attempt_time=""
    
    while read -r sync; do
        local status=$(echo "$sync" | jq -r '.status')
        local timestamp=$(echo "$sync" | jq -r '.timestamp')
        
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
    done < <(echo "$recent_syncs" | jq -c '.[]')
    
    # Calculate time since last success
    local hours_since_success=""
    if [ -n "$last_success_time" ]; then
        local last_success_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${last_success_time%.*}" +%s 2>/dev/null || date -d "${last_success_time}" +%s)
        local current_epoch=$(date +%s)
        hours_since_success=$(( (current_epoch - last_success_epoch) / 3600 ))
    fi
    
    # Calculate time since last attempt
    local hours_since_attempt=""
    if [ -n "$last_attempt_time" ]; then
        local last_attempt_epoch=$(date -j -f "%Y-%m-%dT%H:%M:%S" "${last_attempt_time%.*}" +%s 2>/dev/null || date -d "${last_attempt_time}" +%s)
        local current_epoch=$(date +%s)
        hours_since_attempt=$(( (current_epoch - last_attempt_epoch) / 3600 ))
    fi
    
    # Return status
    echo "consecutive_failures:$consecutive_failures"
    echo "hours_since_success:$hours_since_success"
    echo "hours_since_attempt:$hours_since_attempt"
}

# Check article freshness via API
check_article_freshness() {
    # Use the freshness API endpoint instead of direct DB query
    local response=$(curl -s "http://localhost:3147/reader/api/health/freshness" 2>/dev/null)
    
    if [ -z "$response" ]; then
        echo "999"
        return
    fi
    
    local hours=$(echo "$response" | jq -r '.hoursSinceLastArticle' 2>/dev/null || echo "999")
    echo "$hours"
}

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
    
    # Check article freshness
    local article_age_hours=$(check_article_freshness)
    
    # Log current status
    local status_event=$(jq -c -n \
        --arg ts "$(get_timestamp)" \
        --arg failures "$consecutive_failures" \
        --arg success_hours "$hours_since_success" \
        --arg attempt_hours "$hours_since_attempt" \
        --arg article_hours "$article_age_hours" \
        '{
            "timestamp": $ts,
            "consecutive_failures": ($failures | tonumber),
            "hours_since_success": ($success_hours | tonumber),
            "hours_since_attempt": ($attempt_hours | tonumber),
            "article_age_hours": ($article_hours | tonumber)
        }')
    
    log_event "$status_event"
    
    # Check alert conditions
    local alerts=()
    
    # Alert 1: Consecutive sync failures
    if [ "$consecutive_failures" -ge "$SYNC_FAILURE_THRESHOLD" ]; then
        alerts+=("sync_failures")
    fi
    
    # Alert 2: No successful sync in threshold time
    if [ -n "$hours_since_success" ] && [ "$hours_since_success" -ge "$ARTICLE_FRESHNESS_HOURS" ]; then
        alerts+=("stale_sync")
    fi
    
    # Alert 3: No sync attempts (cron might be dead)
    if [ -n "$hours_since_attempt" ] && [ "$hours_since_attempt" -ge "$SYNC_INTERVAL_HOURS" ]; then
        alerts+=("no_sync_attempts")
    fi
    
    # Alert 4: Stale articles
    if [ "$article_age_hours" != "999" ] && [ "${article_age_hours%.*}" -ge "$ARTICLE_FRESHNESS_HOURS" ]; then
        alerts+=("stale_articles")
    fi
    
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
        
        if [[ " ${alerts[@]} " =~ " stale_articles " ]]; then
            fields+='{"name":"📰 Article Freshness","value":"No new articles in '${article_age_hours%.*}' hours","inline":true},'
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