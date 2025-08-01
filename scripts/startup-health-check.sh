#!/bin/bash

# RSS Reader Startup Health Check
# Verifies all services are healthy after system startup

LOG_FILE="/Users/shayon/DevProjects/rss-news-reader/logs/startup-health.jsonl"
MAX_WAIT_TIME=30  # Maximum seconds to wait for services to be healthy
CHECK_INTERVAL=2  # Seconds between health checks

# Function to log JSONL events
log_event() {
    local event=$1
    echo "$event" >> "$LOG_FILE"
}

# Function to get current timestamp
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Check if PM2 is running
check_pm2() {
    if pm2 pid > /dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Check service health
check_service() {
    local service=$1
    local url=$2
    
    if [ "$service" = "rss-sync-cron" ]; then
        # Check cron via health file
        local health_file="/Users/shayon/DevProjects/rss-news-reader/logs/cron-health.json"
        if [ -f "$health_file" ]; then
            local status=$(jq -r '.status' "$health_file" 2>/dev/null || echo "unknown")
            if [ "$status" = "healthy" ] || [ "$status" = "disabled" ]; then
                return 0
            fi
        fi
        return 1
    else
        # Check HTTP endpoint
        local response=$(curl -s -m 1 -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
        if [ "$response" = "200" ]; then
            return 0
        fi
        return 1
    fi
}

# Wait for service to be healthy
wait_for_service() {
    local service=$1
    local url=$2
    local start_time=$(date +%s)
    
    while true; do
        if check_service "$service" "$url"; then
            local duration=$(($(date +%s) - start_time))
            
            local event=$(jq -c -n \
                --arg ts "$(get_timestamp)" \
                --arg svc "$service" \
                --arg dur "$duration" \
                '{
                    "timestamp": $ts,
                    "event": "service_ready",
                    "service": $svc,
                    "wait_time_seconds": ($dur | tonumber)
                }')
            
            log_event "$event"
            return 0
        fi
        
        local elapsed=$(($(date +%s) - start_time))
        if [ $elapsed -ge $MAX_WAIT_TIME ]; then
            local event=$(jq -c -n \
                --arg ts "$(get_timestamp)" \
                --arg svc "$service" \
                --arg elapsed "$elapsed" \
                '{
                    "timestamp": $ts,
                    "event": "service_timeout",
                    "service": $svc,
                    "elapsed_seconds": ($elapsed | tonumber)
                }')
            
            log_event "$event"
            return 1
        fi
        
        sleep $CHECK_INTERVAL
    done
}

# Main startup check
main() {
    echo "🚀 RSS Reader Startup Health Check"
    echo "=================================="
    
    # Create log directory if needed
    mkdir -p "$(dirname "$LOG_FILE")"
    
    # Log startup begin
    local start_event=$(jq -c -n \
        --arg ts "$(get_timestamp)" \
        '{
            "timestamp": $ts,
            "event": "startup_check_begin",
            "max_wait_seconds": 30
        }')
    
    log_event "$start_event"
    
    # Check if PM2 is running
    echo -n "Checking PM2 daemon... "
    if ! check_pm2; then
        echo "❌ PM2 not running!"
        
        local event=$(jq -c -n \
            --arg ts "$(get_timestamp)" \
            '{
                "timestamp": $ts,
                "event": "pm2_not_running",
                "error": "PM2 daemon is not running"
            }')
        
        log_event "$event"
        exit 1
    fi
    echo "✅"
    
    # Define services to check
    local services=("rss-reader-dev" "rss-sync-server" "rss-sync-cron")
    local urls=("http://localhost:3000/reader/api/health/app?ping=true" "http://localhost:3001/server/health" "cron")
    
    local all_healthy=true
    local unhealthy_services=()
    
    # Check each service
    for i in "${!services[@]}"; do
        local service="${services[$i]}"
        local url="${urls[$i]}"
        echo -n "Checking $service... "
        
        if wait_for_service "$service" "$url"; then
            echo "✅"
        else
            echo "❌"
            all_healthy=false
            unhealthy_services+=("$service")
        fi
    done
    
    echo ""
    
    # Log final status
    if $all_healthy; then
        echo "✅ All services are healthy!"
        
        local event=$(jq -c -n \
            --arg ts "$(get_timestamp)" \
            '{
                "timestamp": $ts,
                "event": "startup_check_complete",
                "status": "success",
                "message": "All services are healthy"
            }')
        
        log_event "$event"
        
        # Optionally start the monitoring service
        if [ "${1:-}" = "--start-monitor" ]; then
            echo "Starting health monitoring service..."
            /Users/shayon/DevProjects/rss-news-reader/scripts/monitor-services.sh start
        fi
        
        exit 0
    else
        echo "❌ Some services failed to start:"
        printf '%s\n' "${unhealthy_services[@]}" | sed 's/^/  - /'
        
        local event=$(jq -c -n \
            --arg ts "$(get_timestamp)" \
            --arg services "$(printf '%s,' "${unhealthy_services[@]}" | sed 's/,$//')" \
            '{
                "timestamp": $ts,
                "event": "startup_check_complete",
                "status": "failed",
                "unhealthy_services": ($services | split(","))
            }')
        
        log_event "$event"
        
        # Send Discord alert for startup failure
        if [ -n "$DISCORD_WEBHOOK" ]; then
            local payload=$(jq -n \
                --arg ts "$(get_timestamp)" \
                --arg services "${unhealthy_services[*]}" \
                '{
                    "embeds": [{
                        "title": "⚠️ RSS Reader Startup Failed",
                        "description": "Some services failed to start after system boot",
                        "color": 16776960,
                        "fields": [
                            {
                                "name": "Failed Services",
                                "value": $services,
                                "inline": false
                            },
                            {
                                "name": "Action Required",
                                "value": "Check PM2 logs for details",
                                "inline": false
                            }
                        ],
                        "timestamp": $ts
                    }]
                }')
            
            curl -s -H "Content-Type: application/json" \
                 -X POST \
                 -d "$payload" \
                 "${DISCORD_WEBHOOK:-https://discord.com/api/webhooks/1398487627765649498/n6mIouChkYqBCL67vj5Jbn0X0XP3uU_rFXhSRcRmQdE2yiJBcvPL7sF9VphClpie5ObE}" > /dev/null
        fi
        
        exit 1
    fi
}

# Run main function
main "$@"