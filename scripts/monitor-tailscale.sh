#!/bin/bash

# Tailscale Monitoring Script
# Checks Tailscale status every 5 minutes and restarts if disconnected

LOG_FILE="/Users/shayon/DevProjects/rss-news-reader/logs/tailscale-monitor.log"
PIDFILE="/tmp/tailscale-monitor.pid"

# Function to log messages with timestamp
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Function to check if Tailscale is connected
check_tailscale() {
    if tailscale status &>/dev/null; then
        # Check if we have an IP (indicates we're connected)
        if tailscale ip -4 &>/dev/null; then
            return 0  # Connected
        else
            return 1  # Not connected (no IP)
        fi
    else
        return 1  # Not connected (command failed)
    fi
}

# Function to restart Tailscale
restart_tailscale() {
    log "⚠️  Tailscale is not connected. Attempting to restart..."
    
    # Try to bring Tailscale up
    if sudo tailscale up; then
        log "✅ Tailscale restart command executed successfully"
        
        # Wait a few seconds for connection
        sleep 5
        
        # Check if it's actually connected now
        if check_tailscale; then
            local ip=$(tailscale ip -4 2>/dev/null)
            log "✅ Tailscale is now connected! IP: $ip"
            return 0
        else
            log "❌ Tailscale restart attempted but still not connected"
            return 1
        fi
    else
        log "❌ Failed to execute tailscale up command"
        return 1
    fi
}

# Function to run the monitoring loop
monitor_loop() {
    log "🚀 Starting Tailscale monitoring service"
    
    while true; do
        if check_tailscale; then
            # Tailscale is connected - log status every hour
            if [ $(($(date +%M) % 60)) -eq 0 ]; then
                local ip=$(tailscale ip -4 2>/dev/null)
                log "✅ Tailscale is connected. IP: $ip"
            fi
        else
            # Tailscale is not connected - try to restart
            restart_tailscale
        fi
        
        # Wait 5 minutes before next check
        sleep 300
    done
}

# Function to setup the service
setup_service() {
    # Check if already running
    if [ -f "$PIDFILE" ]; then
        OLD_PID=$(cat "$PIDFILE")
        if ps -p $OLD_PID > /dev/null 2>&1; then
            echo "Tailscale monitor is already running (PID: $OLD_PID)"
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
    
    log "✅ Tailscale monitor started with PID: $MONITOR_PID"
    echo "Monitor is running in background. Check logs at: $LOG_FILE"
}

# Function to stop the service
stop_service() {
    if [ -f "$PIDFILE" ]; then
        PID=$(cat "$PIDFILE")
        if ps -p $PID > /dev/null 2>&1; then
            kill $PID
            rm "$PIDFILE"
            log "🛑 Tailscale monitor stopped (PID: $PID)"
        else
            echo "Monitor not running (stale PID file)"
            rm "$PIDFILE"
        fi
    else
        echo "Monitor is not running (no PID file)"
    fi
}

# Function to show status
show_status() {
    echo "🔍 Tailscale Monitor Status"
    echo "=========================="
    
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
    
    # Check Tailscale status
    echo ""
    echo "Tailscale Status:"
    if check_tailscale; then
        local ip=$(tailscale ip -4 2>/dev/null)
        echo "✅ Connected (IP: $ip)"
    else
        echo "❌ Not connected"
    fi
    
    # Show recent logs
    if [ -f "$LOG_FILE" ]; then
        echo ""
        echo "Recent log entries:"
        tail -5 "$LOG_FILE" | sed 's/^/  /'
    fi
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
        # Test mode - run once
        log "🧪 Running in test mode (single check)"
        if check_tailscale; then
            ip=$(tailscale ip -4 2>/dev/null)
            log "✅ Tailscale is connected. IP: $ip"
        else
            restart_tailscale
        fi
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|test}"
        echo ""
        echo "Commands:"
        echo "  start   - Start the monitoring service"
        echo "  stop    - Stop the monitoring service"
        echo "  restart - Restart the monitoring service"
        echo "  status  - Show current status"
        echo "  test    - Run a single test (doesn't daemonize)"
        exit 1
        ;;
esac