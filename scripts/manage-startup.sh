#!/bin/bash

# RSS Reader Startup Management Script

PLIST_FILE="$HOME/Library/LaunchAgents/com.rss-reader.startup.plist"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

case "$1" in
    enable)
        echo "Enabling RSS Reader startup..."
        launchctl load "$PLIST_FILE"
        echo "✅ Startup enabled. RSS Reader will start automatically on boot."
        ;;
    
    disable)
        echo "Disabling RSS Reader startup..."
        launchctl unload "$PLIST_FILE"
        echo "✅ Startup disabled. RSS Reader will NOT start automatically."
        ;;
    
    status)
        echo "Checking startup status..."
        if launchctl list | grep -q "com.rss-reader.startup"; then
            echo "✅ Startup service is ENABLED"
            launchctl list | grep "com.rss-reader.startup"
        else
            echo "❌ Startup service is DISABLED"
        fi
        ;;
    
    test)
        echo "Testing startup script..."
        "$SCRIPT_DIR/startup.sh"
        ;;
    
    logs)
        echo "=== Recent Startup Logs ==="
        tail -n 50 "$SCRIPT_DIR/../logs/startup.log" 2>/dev/null || echo "No startup logs found"
        echo ""
        echo "=== Recent Error Logs ==="
        tail -n 20 "$SCRIPT_DIR/../logs/startup-error.log" 2>/dev/null || echo "No error logs found"
        ;;
    
    *)
        echo "Usage: $0 {enable|disable|status|test|logs}"
        echo ""
        echo "Commands:"
        echo "  enable   - Enable automatic startup on boot"
        echo "  disable  - Disable automatic startup"
        echo "  status   - Check if startup is enabled"
        echo "  test     - Run the startup script manually"
        echo "  logs     - View recent startup logs"
        exit 1
        ;;
esac