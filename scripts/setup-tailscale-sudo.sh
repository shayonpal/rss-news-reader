#!/bin/bash

# Setup script for passwordless sudo for tailscale command
# This needs to be run once with sudo privileges

echo "🔐 Setting up passwordless sudo for tailscale..."
echo ""
echo "This script will create a sudoers file to allow the current user"
echo "to run 'tailscale up' without a password prompt."
echo ""

# Get current username
CURRENT_USER=$(whoami)

# Create sudoers content
SUDOERS_CONTENT="${CURRENT_USER} ALL=(ALL) NOPASSWD: /usr/bin/tailscale up"

# Sudoers file path
SUDOERS_FILE="/etc/sudoers.d/tailscale-monitor"

echo "The following line will be added to $SUDOERS_FILE:"
echo "  $SUDOERS_CONTENT"
echo ""
echo "You will be prompted for your sudo password to create this file."
echo ""

# Ask for confirmation
read -p "Do you want to proceed? (y/N): " confirm
if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
    echo "Setup cancelled."
    exit 0
fi

# Create temporary file
TEMP_FILE=$(mktemp)
echo "$SUDOERS_CONTENT" > "$TEMP_FILE"

# Validate the sudoers syntax
if sudo visudo -c -f "$TEMP_FILE"; then
    # Copy to sudoers.d
    sudo cp "$TEMP_FILE" "$SUDOERS_FILE"
    sudo chmod 440 "$SUDOERS_FILE"
    
    echo "✅ Passwordless sudo for 'tailscale up' has been configured!"
    echo ""
    echo "You can test it by running:"
    echo "  sudo tailscale up"
    echo ""
    echo "It should not ask for a password."
else
    echo "❌ Sudoers syntax validation failed. Setup aborted."
    rm "$TEMP_FILE"
    exit 1
fi

# Clean up
rm "$TEMP_FILE"

echo ""
echo "Next steps:"
echo "1. Test the setup: sudo tailscale up"
echo "2. Start the monitor: ./scripts/monitor-tailscale.sh start"