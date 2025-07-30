#!/bin/bash

# Uptime Kuma Push Monitor Helper
# This script sends heartbeat signals to Uptime Kuma push monitors

# Configuration
KUMA_BASE_URL="http://localhost:3080/api/push"
PUSH_KEY_FILE="/Users/shayon/.rss-reader/uptime-kuma-push-keys.json"

# Function to send push notification
send_push() {
    local monitor_name=$1
    local status=${2:-"up"}  # up, down, or integer for ping
    local msg=${3:-""}
    
    # Get push key from file
    if [ ! -f "$PUSH_KEY_FILE" ]; then
        echo "Push key file not found: $PUSH_KEY_FILE"
        echo "Please create this file with your push monitor keys from Uptime Kuma"
        echo "Format: {\"cron\": \"YOUR_PUSH_KEY\", \"sync\": \"ANOTHER_KEY\"}"
        return 1
    fi
    
    # Extract push key for monitor
    local push_key=$(jq -r ".\"$monitor_name\"" "$PUSH_KEY_FILE" 2>/dev/null)
    
    if [ -z "$push_key" ] || [ "$push_key" = "null" ]; then
        echo "No push key found for monitor: $monitor_name"
        return 1
    fi
    
    # Build URL
    local url="$KUMA_BASE_URL/$push_key"
    
    # Add parameters
    if [ "$status" != "up" ]; then
        url="$url?status=$status"
        if [ -n "$msg" ]; then
            url="$url&msg=$(echo -n "$msg" | jq -sRr @uri)"
        fi
    fi
    
    # Send push
    curl -s "$url" > /dev/null
    local result=$?
    
    if [ $result -eq 0 ]; then
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Push sent to $monitor_name: status=$status"
    else
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] Failed to send push to $monitor_name"
        return 1
    fi
}

# Function to wrap command execution with push monitoring
wrap_with_push() {
    local monitor_name=$1
    shift  # Remove monitor name from arguments
    local command="$@"
    
    echo "Executing: $command"
    
    # Execute command
    eval "$command"
    local exit_code=$?
    
    # Send push based on result
    if [ $exit_code -eq 0 ]; then
        send_push "$monitor_name" "up" "Command executed successfully"
    else
        send_push "$monitor_name" "down" "Command failed with exit code: $exit_code"
    fi
    
    return $exit_code
}

# Main script logic
case "${1:-}" in
    push)
        # Direct push: ./uptime-kuma-push.sh push <monitor> [status] [message]
        send_push "$2" "${3:-up}" "${4:-}"
        ;;
    wrap)
        # Wrap command: ./uptime-kuma-push.sh wrap <monitor> <command...>
        monitor=$2
        shift 2
        wrap_with_push "$monitor" "$@"
        ;;
    setup)
        # Create example push key file
        if [ ! -f "$PUSH_KEY_FILE" ]; then
            mkdir -p "$(dirname "$PUSH_KEY_FILE")"
            cat > "$PUSH_KEY_FILE" << EOF
{
  "cron": "REPLACE_WITH_CRON_PUSH_KEY",
  "sync": "REPLACE_WITH_SYNC_PUSH_KEY",
  "backup": "REPLACE_WITH_BACKUP_PUSH_KEY"
}
EOF
            chmod 600 "$PUSH_KEY_FILE"
            echo "Created template push key file: $PUSH_KEY_FILE"
            echo "Please update it with actual push keys from Uptime Kuma"
        else
            echo "Push key file already exists: $PUSH_KEY_FILE"
        fi
        ;;
    *)
        echo "Uptime Kuma Push Monitor Helper"
        echo ""
        echo "Usage:"
        echo "  $0 push <monitor> [status] [message]   - Send push notification"
        echo "  $0 wrap <monitor> <command...>         - Execute command and send push"
        echo "  $0 setup                               - Create template push key file"
        echo ""
        echo "Examples:"
        echo "  $0 push cron up"
        echo "  $0 push sync down 'Database connection failed'"
        echo "  $0 wrap cron npm run sync"
        echo ""
        echo "Status values: up, down, or ping time in ms"
        exit 1
        ;;
esac