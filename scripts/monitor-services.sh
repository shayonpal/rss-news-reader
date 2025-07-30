#!/bin/bash

# RSS Reader Services Health Monitor
# Checks all services every 2 minutes and sends batched Discord notifications

LOG_FILE="/Users/shayon/DevProjects/rss-news-reader/logs/services-monitor.jsonl"
PIDFILE="/tmp/rss-services-monitor.pid"
ERROR_BUFFER="/tmp/rss-services-errors.json"
DISCORD_WEBHOOK="https://discord.com/api/webhooks/1398487627765649498/n6mIouChkYqBCL67vj5Jbn0X0XP3uU_rFXhSRcRmQdE2yiJBcvPL7sF9VphClpie5ObE"

# Service restart tracking (to prevent restart loops)
RESTART_TRACKING="/tmp/rss-services-restarts.json"

# Function to log JSONL events
log_event() {
    local event=$1
    echo "$event" >> "$LOG_FILE"
}

# Function to get current timestamp
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Initialize error buffer
init_error_buffer() {
    if [ ! -f "$ERROR_BUFFER" ]; then
        echo '{"errors": [], "window_start": "'$(get_timestamp)'"}' > "$ERROR_BUFFER"
    fi
}

# Initialize restart tracking
init_restart_tracking() {
    if [ ! -f "$RESTART_TRACKING" ]; then
        echo '{}' > "$RESTART_TRACKING"
    fi
}

# Add error to buffer
add_error_to_buffer() {
    local service=$1
    local error_type=$2
    local error_msg=$3
    local timestamp=$(get_timestamp)
    
    # Read current buffer
    local buffer=$(cat "$ERROR_BUFFER")
    
    # Add error using jq
    local updated=$(echo "$buffer" | jq --arg service "$service" \
        --arg type "$error_type" --arg msg "$error_msg" --arg ts "$timestamp" \
        '.errors += [{"service": $service, "type": $type, "message": $msg, "timestamp": $ts}]')
    
    echo "$updated" > "$ERROR_BUFFER"
}

# Check if service can be restarted (rate limiting)
can_restart_service() {
    local service=$1
    local current_time=$(date +%s)
    local tracking=$(cat "$RESTART_TRACKING")
    
    # Get service restart info
    local service_info=$(echo "$tracking" | jq -r --arg svc "$service" '.[$svc] // empty')
    
    if [ -z "$service_info" ]; then
        # First restart
        return 0
    fi
    
    local count=$(echo "$service_info" | jq -r '.count')
    local last_restart=$(echo "$service_info" | jq -r '.last_restart')
    local first_restart=$(echo "$service_info" | jq -r '.first_restart')
    
    # Reset counter if more than 1 hour since first restart
    if [ $((current_time - first_restart)) -gt 3600 ]; then
        return 0
    fi
    
    # Check if we've exceeded max restarts (3 per hour)
    if [ "$count" -ge 3 ]; then
        return 1
    fi
    
    # Check backoff time (1 min, 5 min, 15 min)
    local backoff_times=(60 300 900)
    local backoff=${backoff_times[$((count - 1))]}
    
    if [ $((current_time - last_restart)) -lt $backoff ]; then
        return 1
    fi
    
    return 0
}

# Update restart tracking
update_restart_tracking() {
    local service=$1
    local current_time=$(date +%s)
    local tracking=$(cat "$RESTART_TRACKING")
    
    # Get current service info
    local service_info=$(echo "$tracking" | jq -r --arg svc "$service" '.[$svc] // empty')
    
    if [ -z "$service_info" ]; then
        # First restart
        local updated=$(echo "$tracking" | jq --arg svc "$service" --arg time "$current_time" \
            '.[$svc] = {"count": 1, "first_restart": ($time | tonumber), "last_restart": ($time | tonumber)}')
    else
        local count=$(echo "$service_info" | jq -r '.count')
        local first_restart=$(echo "$service_info" | jq -r '.first_restart')
        
        # Reset if more than 1 hour
        if [ $((current_time - first_restart)) -gt 3600 ]; then
            local updated=$(echo "$tracking" | jq --arg svc "$service" --arg time "$current_time" \
                '.[$svc] = {"count": 1, "first_restart": ($time | tonumber), "last_restart": ($time | tonumber)}')
        else
            # Increment count
            local updated=$(echo "$tracking" | jq --arg svc "$service" --arg time "$current_time" \
                '.[$svc].count += 1 | .[$svc].last_restart = ($time | tonumber)')
        fi
    fi
    
    echo "$updated" > "$RESTART_TRACKING"
}

# Check main app health
check_main_app() {
    local start_time=$(date +%s)
    local health_url="http://localhost:3147/reader/api/health/app?ping=true"
    
    # Try production port first, then dev
    local response=$(curl -s -m 1 -w "\n%{http_code}" "$health_url" 2>/dev/null || echo "000")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" = "000" ]; then
        # Try dev port
        health_url="http://localhost:3000/reader/api/health/app?ping=true"
        response=$(curl -s -m 1 -w "\n%{http_code}" "$health_url" 2>/dev/null || echo "000")
        http_code=$(echo "$response" | tail -n1)
        body=$(echo "$response" | sed '$d')
    fi
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local event=$(jq -c -n \
        --arg ts "$(get_timestamp)" \
        --arg service "rss-reader-app" \
        --arg url "$health_url" \
        --arg code "$http_code" \
        --arg duration "$duration" \
        --arg body "$body" \
        '{
            "timestamp": $ts,
            "service": $service,
            "endpoint": $url,
            "status_code": $code,
            "duration_seconds": ($duration | tonumber),
            "response": $body
        }')
    
    log_event "$event"
    
    if [ "$http_code" != "200" ]; then
        add_error_to_buffer "rss-reader-app" "health_check_failed" "HTTP $http_code"
        return 1
    fi
    
    return 0
}

# Check sync server health
check_sync_server() {
    local start_time=$(date +%s)
    local health_url="http://localhost:3001/server/health"
    
    local response=$(curl -s -m 1 -w "\n%{http_code}" "$health_url" 2>/dev/null || echo "000")
    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')
    
    local end_time=$(date +%s)
    local duration=$((end_time - start_time))
    
    local event=$(jq -c -n \
        --arg ts "$(get_timestamp)" \
        --arg service "rss-sync-server" \
        --arg url "$health_url" \
        --arg code "$http_code" \
        --arg duration "$duration" \
        --arg body "$body" \
        '{
            "timestamp": $ts,
            "service": $service,
            "endpoint": $url,
            "status_code": $code,
            "duration_seconds": ($duration | tonumber),
            "response": $body
        }')
    
    log_event "$event"
    
    if [ "$http_code" != "200" ]; then
        add_error_to_buffer "rss-sync-server" "health_check_failed" "HTTP $http_code"
        return 1
    fi
    
    return 0
}

# Check cron health (via JSON file)
check_cron_health() {
    local health_file="/Users/shayon/DevProjects/rss-news-reader/logs/cron-health.jsonl"
    
    if [ ! -f "$health_file" ]; then
        add_error_to_buffer "rss-sync-cron" "health_file_missing" "Health file not found"
        return 1
    fi
    
    # Check file age
    local file_age=$(($(date +%s) - $(stat -f %m "$health_file" 2>/dev/null || echo 0)))
    
    if [ $file_age -gt 3600 ]; then
        add_error_to_buffer "rss-sync-cron" "stale_health_data" "Health data is $((file_age / 60)) minutes old"
        return 1
    fi
    
    # Parse health status from last line of JSONL file
    local status=$(tail -n 1 "$health_file" | jq -r '.status' 2>/dev/null || echo "unknown")
    
    local event=$(jq -c -n \
        --arg ts "$(get_timestamp)" \
        --arg service "rss-sync-cron" \
        --arg status "$status" \
        --arg age "$file_age" \
        '{
            "timestamp": $ts,
            "service": $service,
            "health_status": $status,
            "file_age_seconds": ($age | tonumber)
        }')
    
    log_event "$event"
    
    if [ "$status" != "healthy" ]; then
        add_error_to_buffer "rss-sync-cron" "unhealthy_status" "Status: $status"
        return 1
    fi
    
    return 0
}

# Restart service using PM2
restart_service() {
    local service=$1
    
    if ! can_restart_service "$service"; then
        add_error_to_buffer "$service" "restart_limit_exceeded" "Max restarts reached"
        return 1
    fi
    
    echo "Restarting $service..."
    local result=$(pm2 restart "$service" 2>&1)
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        update_restart_tracking "$service"
        
        local event=$(jq -c -n \
            --arg ts "$(get_timestamp)" \
            --arg service "$service" \
            --arg result "$result" \
            '{
                "timestamp": $ts,
                "service": $service,
                "action": "restart",
                "success": true,
                "output": $result
            }')
        
        log_event "$event"
        return 0
    else
        add_error_to_buffer "$service" "restart_failed" "$result"
        return 1
    fi
}

# Send Discord notification
send_discord_notification() {
    local error_buffer=$(cat "$ERROR_BUFFER")
    local errors=$(echo "$error_buffer" | jq -r '.errors')
    local error_count=$(echo "$errors" | jq 'length')
    
    if [ "$error_count" -eq 0 ]; then
        return
    fi
    
    # Group errors by service
    local summary=$(echo "$errors" | jq -r 'group_by(.service) | map({
        service: .[0].service,
        count: length,
        types: [.[].type] | unique,
        last_error: .[-1].message
    })')
    
    # Build Discord embed fields
    local fields=""
    while IFS= read -r service_summary; do
        local service=$(echo "$service_summary" | jq -r '.service')
        local count=$(echo "$service_summary" | jq -r '.count')
        local types=$(echo "$service_summary" | jq -r '.types | join(", ")')
        local last_error=$(echo "$service_summary" | jq -r '.last_error')
        
        if [ -n "$fields" ]; then
            fields="$fields,"
        fi
        
        fields="$fields{\"name\":\"❌ $service\",\"value\":\"$count errors: $types\\nLast: $last_error\",\"inline\":false}"
    done < <(echo "$summary" | jq -c '.[]')
    
    # Get restart info
    local restart_info=""
    if [ -f "$RESTART_TRACKING" ]; then
        local restarts=$(cat "$RESTART_TRACKING" | jq -r 'to_entries | map(select(.value.count > 0)) | length')
        if [ "$restarts" -gt 0 ]; then
            restart_info=",{\"name\":\"🔄 Restarts\",\"value\":\"$restarts services restarted\",\"inline\":false}"
        fi
    fi
    
    # Build payload
    local payload=$(jq -n \
        --arg ts "$(get_timestamp)" \
        --arg count "$error_count" \
        --argjson fields "[$fields$restart_info]" \
        '{
            "embeds": [{
                "title": "🚨 RSS Reader Service Health Alert",
                "description": "Multiple service issues detected in the last 2 minutes",
                "color": 16711680,
                "fields": $fields,
                "footer": {
                    "text": "Total errors: " + $count
                },
                "timestamp": $ts
            }]
        }')
    
    # Send to Discord
    curl -s -H "Content-Type: application/json" \
         -X POST \
         -d "$payload" \
         "$DISCORD_WEBHOOK" > /dev/null
    
    # Clear error buffer
    echo '{"errors": [], "window_start": "'$(get_timestamp)'"}' > "$ERROR_BUFFER"
}

# Check for critical failures (all services down)
check_critical_failure() {
    local app_down=$1
    local sync_down=$2
    local cron_down=$3
    
    if [ "$app_down" -eq 1 ] && [ "$sync_down" -eq 1 ] && [ "$cron_down" -eq 1 ]; then
        # Send immediate critical alert
        local payload=$(jq -n \
            --arg ts "$(get_timestamp)" \
            '{
                "content": "<@USER_ID>",
                "embeds": [{
                    "title": "🚨 CRITICAL: All Services Down",
                    "description": "All RSS Reader services are not responding. Manual intervention required.",
                    "color": 16711680,
                    "fields": [
                        {"name": "❌ Main App", "value": "Not responding", "inline": true},
                        {"name": "❌ Sync Server", "value": "Not responding", "inline": true},
                        {"name": "❌ Cron Service", "value": "Not responding", "inline": true},
                        {"name": "Action Required", "value": "SSH to server and check PM2 status", "inline": false}
                    ],
                    "timestamp": $ts
                }]
            }')
        
        curl -s -H "Content-Type: application/json" \
             -X POST \
             -d "$payload" \
             "$DISCORD_WEBHOOK" > /dev/null
        
        # Clear buffer to avoid duplicate notifications
        echo '{"errors": [], "window_start": "'$(get_timestamp)'"}' > "$ERROR_BUFFER"
        
        return 0
    fi
    
    return 1
}

# Main monitoring loop
monitor_loop() {
    echo "🚀 Starting RSS Reader services monitoring"
    
    init_error_buffer
    init_restart_tracking
    
    local last_notification_time=0
    
    while true; do
        local current_time=$(date +%s)
        
        # Check all services
        local app_down=0
        local sync_down=0
        local cron_down=0
        
        if ! check_main_app; then
            app_down=1
            # Try to restart
            restart_service "rss-reader-prod"
        fi
        
        if ! check_sync_server; then
            sync_down=1
            # Try to restart
            restart_service "rss-sync-server"
        fi
        
        if ! check_cron_health; then
            cron_down=1
            # Cron can't be directly restarted, just log
        fi
        
        # Check for critical failure
        if check_critical_failure $app_down $sync_down $cron_down; then
            last_notification_time=$current_time
        else
            # Send batched notification every 2 minutes if there are errors
            if [ $((current_time - last_notification_time)) -ge 120 ]; then
                send_discord_notification
                last_notification_time=$current_time
            fi
        fi
        
        # Wait 2 minutes before next check
        sleep 120
    done
}

# Setup service
setup_service() {
    # Check if already running
    if [ -f "$PIDFILE" ]; then
        OLD_PID=$(cat "$PIDFILE")
        if ps -p $OLD_PID > /dev/null 2>&1; then
            echo "Services monitor is already running (PID: $OLD_PID)"
            exit 0
        else
            echo "Removing stale PID file"
            rm "$PIDFILE"
        fi
    fi
    
    # Create log directory if needed
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Start monitoring in background
    monitor_loop &
    MONITOR_PID=$!
    echo $MONITOR_PID > "$PIDFILE"
    
    echo "✅ Services monitor started with PID: $MONITOR_PID"
    echo "Monitor is running in background. Check logs at: $LOG_FILE"
}

# Stop service
stop_service() {
    if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE")
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID
            rm "$PIDFILE"
            echo "🛑 Services monitor stopped (PID: $PID)"
        else
            echo "Monitor not running (stale PID file)"
            rm "$PIDFILE"
        fi
    else
        echo "Monitor is not running (no PID file)"
    fi
}

# Show status
show_status() {
    echo "🔍 RSS Reader Services Monitor Status"
    echo "===================================="
    
    # Check if monitor is running
    if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE")
        if ps -p $PID > /dev/null 2>&1; then
            echo "✅ Monitor is running (PID: $PID)"
        else
            echo "❌ Monitor is not running (stale PID file)"
        fi
    else
        echo "❌ Monitor is not running"
    fi
    
    echo ""
    echo "Service Status:"
    
    # Quick health check
    if check_main_app >/dev/null 2>&1; then
        echo "✅ Main App: Healthy"
    else
        echo "❌ Main App: Not responding"
    fi
    
    if check_sync_server >/dev/null 2>&1; then
        echo "✅ Sync Server: Healthy"
    else
        echo "❌ Sync Server: Not responding"
    fi
    
    if check_cron_health >/dev/null 2>&1; then
        echo "✅ Cron Service: Healthy"
    else
        echo "❌ Cron Service: Issues detected"
    fi
    
    # Show recent logs
    if [ -f "$LOG_FILE" ]; then
        echo ""
        echo "Recent log entries:"
        tail -5 "$LOG_FILE" | jq -r '"[\(.timestamp)] \(.service): \(.status_code // .health_status // .action)"' | sed 's/^/  /'
    fi
}

# Test mode - run checks once
test_checks() {
    echo "🧪 Running health checks in test mode"
    
    init_error_buffer
    init_restart_tracking
    
    echo ""
    echo "Checking Main App..."
    if check_main_app; then
        echo "✅ Main App is healthy"
    else
        echo "❌ Main App check failed"
    fi
    
    echo ""
    echo "Checking Sync Server..."
    if check_sync_server; then
        echo "✅ Sync Server is healthy"
    else
        echo "❌ Sync Server check failed"
    fi
    
    echo ""
    echo "Checking Cron Service..."
    if check_cron_health; then
        echo "✅ Cron Service is healthy"
    else
        echo "❌ Cron Service check failed"
    fi
    
    # Show error buffer
    echo ""
    echo "Error Buffer:"
    cat "$ERROR_BUFFER" | jq .
}

# Main script logic
case "${1:-}" in
    start)
        setup_service
        ;;
    stop)
        stop_service
        ;;
    restart)
        stop_service
        sleep 1
        setup_service
        ;;
    status)
        show_status
        ;;
    test)
        test_checks
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|test}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the monitoring service"
        echo "  stop    - Stop the monitoring service"
        echo "  restart - Restart the monitoring service"
        echo "  status  - Show current status"
        echo "  test    - Run health checks once (doesn't daemonize)"
        exit 1
        ;;
esac