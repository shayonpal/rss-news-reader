#!/bin/bash

# Install Tailscale monitor as a launchd service

PLIST_NAME="com.rss-reader.tailscale-monitor"
PLIST_FILE="/Users/shayon/DevProjects/rss-news-reader/tailscale-monitor.plist"
LAUNCH_AGENTS_DIR="$HOME/Library/LaunchAgents"
INSTALLED_PLIST="$LAUNCH_AGENTS_DIR/$PLIST_NAME.plist"

echo "🚀 Installing Tailscale Monitor Service"
echo "===================================="
echo ""

# Check if monitor script exists
if [ ! -f "/Users/shayon/DevProjects/rss-news-reader/scripts/monitor-tailscale.sh" ]; then
    echo "❌ Error: monitor-tailscale.sh not found!"
    exit 1
fi

# Create LaunchAgents directory if it doesn't exist
mkdir -p "$LAUNCH_AGENTS_DIR"

# Stop service if already running
if launchctl list | grep -q "$PLIST_NAME"; then
    echo "Stopping existing service..."
    launchctl unload "$INSTALLED_PLIST" 2>/dev/null
fi

# Copy plist file
echo "Installing service configuration..."
cp "$PLIST_FILE" "$INSTALLED_PLIST"

# Load the service
echo "Starting service..."
launchctl load "$INSTALLED_PLIST"

# Check if loaded successfully
if launchctl list | grep -q "$PLIST_NAME"; then
    echo "✅ Tailscale monitor service installed successfully!"
    echo ""
    echo "The monitor will:"
    echo "  - Check Tailscale status every 5 minutes"
    echo "  - Auto-restart Tailscale if disconnected"
    echo "  - Start automatically on system boot"
    echo "  - Log to: logs/tailscale-monitor.log"
    echo ""
    echo "Useful commands:"
    echo "  Check status:    ./scripts/monitor-tailscale.sh status"
    echo "  View logs:       tail -f logs/tailscale-monitor.log"
    echo "  Stop service:    launchctl unload ~/Library/LaunchAgents/$PLIST_NAME.plist"
    echo "  Start service:   launchctl load ~/Library/LaunchAgents/$PLIST_NAME.plist"
else
    echo "❌ Failed to install service"
    exit 1
fi