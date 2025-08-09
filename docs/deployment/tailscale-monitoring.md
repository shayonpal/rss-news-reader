# Tailscale Monitoring Setup

## Overview

This monitoring solution ensures Tailscale stays connected, automatically restarting it if the connection drops. This is critical because without Tailscale, clients cannot access the RSS Reader service. This applies to the current dev-only setup running on the Mac Mini.

## Components

### 1. Monitor Script (`scripts/monitor-tailscale.sh`)

- Checks Tailscale connection status every 5 minutes
- Automatically runs `sudo tailscale up` if disconnected
- Logs all activities to `logs/tailscale-monitor.log`
- Can run as a background service or one-time test

### 2. Sudo Configuration (`scripts/setup-tailscale-sudo.sh`)

- Sets up passwordless sudo for `tailscale up` command only
- Required for automatic restart functionality
- Creates `/etc/sudoers.d/tailscale-monitor`

### 3. LaunchD Service (macOS)

- `tailscale-monitor.plist` - Service definition
- `scripts/install-tailscale-monitor.sh` - Easy installer
- Runs monitor automatically on system startup
- Restarts monitor if it crashes

## Installation Steps

### Step 1: Configure Passwordless Sudo

```bash
# Run once to setup sudo permissions
./scripts/setup-tailscale-sudo.sh

# Test that it works (should not ask for password)
sudo tailscale up
```

### Step 2: Test the Monitor

```bash
# Run a single test to verify it works
./scripts/monitor-tailscale.sh test

# Check the status
./scripts/monitor-tailscale.sh status
```

### Step 3: Install as System Service (Recommended)

```bash
# Install as launchd service (macOS)
./scripts/install-tailscale-monitor.sh

# The service will now run automatically
```

### Alternative: Run Manually

```bash
# Start in background
./scripts/monitor-tailscale.sh start

# Stop the monitor
./scripts/monitor-tailscale.sh stop

# Check status
./scripts/monitor-tailscale.sh status
```

## Monitoring Commands

### Check Service Status

```bash
# Using the script
./scripts/monitor-tailscale.sh status

# Using launchctl (if installed as service)
launchctl list | grep tailscale-monitor
```

### View Logs

```bash
# Real-time log monitoring
tail -f logs/tailscale-monitor.log

# Last 20 log entries
tail -20 logs/tailscale-monitor.log

# Search for errors
grep "❌" logs/tailscale-monitor.log
```

### Manual Service Control

```bash
# Stop the service
launchctl unload ~/Library/LaunchAgents/com.rss-reader.tailscale-monitor.plist

# Start the service
launchctl load ~/Library/LaunchAgents/com.rss-reader.tailscale-monitor.plist

# Restart the service
launchctl unload ~/Library/LaunchAgents/com.rss-reader.tailscale-monitor.plist
launchctl load ~/Library/LaunchAgents/com.rss-reader.tailscale-monitor.plist
```

## Log Format

The monitor logs all activities with timestamps:

```
[2025-07-21 15:30:00] ✅ Tailscale is connected. IP: 100.96.166.53
[2025-07-21 15:35:00] ⚠️  Tailscale is not connected. Attempting to restart...
[2025-07-21 15:35:05] ✅ Tailscale is now connected! IP: 100.96.166.53
```

## Troubleshooting

### Monitor Not Starting

1. Check permissions: `ls -l scripts/monitor-tailscale.sh`
2. Check sudo setup: `sudo tailscale up` (should not ask for password)
3. Check logs: `tail logs/tailscale-monitor-error.log`

### Tailscale Not Reconnecting

1. Check Tailscale status manually: `tailscale status`
2. Try manual connection: `tailscale up`
3. Check network connectivity
4. Review Tailscale logs: `tailscale netcheck`

### High CPU Usage

- The monitor sleeps for 5 minutes between checks
- If CPU usage is high, check for restart loops in logs
- Increase check interval by editing the sleep duration in the script

## Security Notes

- Sudo permission is limited to ONLY `tailscale up` command
- Monitor runs as current user, not root
- All logs are stored locally in the project directory
