#!/bin/bash

# rotate-health-logs.sh - Rotate health check JSONL logs daily
# Run this script daily via cron to prevent log files from growing too large
# Keeps last 7 days of logs

set -euo pipefail

# Configuration
LOG_DIR="/Users/shayon/DevProjects/rss-news-reader/logs"
RETENTION_DAYS=7
MAX_SIZE_MB=100

# Log files to rotate
LOG_FILES=(
    "health-checks.jsonl"
    "sync-health.jsonl"
    "cron-health.jsonl"
    "inoreader-api-calls.jsonl"
    "tailscale-monitor.log"
    "services-monitor.jsonl"
)

# Function to rotate a single log file
rotate_log() {
    local log_file="$1"
    local full_path="$LOG_DIR/$log_file"
    
    # Skip if file doesn't exist
    if [ ! -f "$full_path" ]; then
        echo "Skip: $log_file does not exist"
        return
    fi
    
    # Get file size in MB
    local size_bytes=$(stat -f%z "$full_path" 2>/dev/null || echo "0")
    local size_mb=$((size_bytes / 1024 / 1024))
    
    # Only rotate if file exists and is not empty
    if [ $size_bytes -gt 0 ]; then
        # Create timestamp for rotated file
        local timestamp=$(date +"%Y%m%d_%H%M%S")
        local rotated_name
        
        # Handle different file extensions
        if [[ "$log_file" == *.jsonl ]]; then
            rotated_name="${log_file%.jsonl}_${timestamp}.jsonl"
        elif [[ "$log_file" == *.log ]]; then
            rotated_name="${log_file%.log}_${timestamp}.log"
        else
            rotated_name="${log_file}_${timestamp}"
        fi
        
        # Move current log to rotated name
        mv "$full_path" "$LOG_DIR/$rotated_name"
        
        # Create new empty log file
        touch "$full_path"
        
        # Compress rotated file
        gzip "$LOG_DIR/$rotated_name"
        
        echo "Rotated: $log_file (${size_mb}MB) -> ${rotated_name}.gz"
    else
        echo "Skip: $log_file is empty"
    fi
}

# Function to clean old rotated logs
clean_old_logs() {
    local log_pattern="$1"
    
    # Handle both .jsonl and .log file extensions
    local base_pattern
    if [[ "$log_pattern" == *.jsonl ]]; then
        base_pattern="${log_pattern%.jsonl}"
        find "$LOG_DIR" -name "${base_pattern}_*.jsonl.gz" -mtime +$RETENTION_DAYS -exec rm {} \; -print | while read -r file; do
            echo "Removed old log: $(basename "$file")"
        done
    elif [[ "$log_pattern" == *.log ]]; then
        base_pattern="${log_pattern%.log}"
        find "$LOG_DIR" -name "${base_pattern}_*.log.gz" -mtime +$RETENTION_DAYS -exec rm {} \; -print | while read -r file; do
            echo "Removed old log: $(basename "$file")"
        done
    fi
}

# Main execution
echo "=== Health Log Rotation Started: $(date) ==="
echo "Log directory: $LOG_DIR"
echo "Retention: $RETENTION_DAYS days"
echo ""

# Check if log directory exists
if [ ! -d "$LOG_DIR" ]; then
    echo "ERROR: Log directory does not exist: $LOG_DIR"
    exit 1
fi

# Rotate each log file
for log_file in "${LOG_FILES[@]}"; do
    echo "Processing: $log_file"
    rotate_log "$log_file"
    clean_old_logs "$log_file"
    echo ""
done

# Also check for any emergency rotation needed (files over max size)
echo "Checking for oversized logs..."
for log_file in "${LOG_FILES[@]}"; do
    full_path="$LOG_DIR/$log_file"
    if [ -f "$full_path" ]; then
        size_bytes=$(stat -f%z "$full_path" 2>/dev/null || echo "0")
        size_mb=$((size_bytes / 1024 / 1024))
        
        if [ $size_mb -gt $MAX_SIZE_MB ]; then
            echo "WARNING: $log_file is ${size_mb}MB (max: ${MAX_SIZE_MB}MB)"
            echo "Forcing immediate rotation..."
            rotate_log "$log_file"
        fi
    fi
done

echo ""
echo "=== Health Log Rotation Completed: $(date) ==="

# Create a summary of current log sizes
echo ""
echo "Current log sizes:"
for log_file in "${LOG_FILES[@]}"; do
    full_path="$LOG_DIR/$log_file"
    if [ -f "$full_path" ]; then
        size_bytes=$(stat -f%z "$full_path" 2>/dev/null || echo "0")
        size_mb=$((size_bytes / 1024 / 1024))
        line_count=$(wc -l < "$full_path" | tr -d ' ')
        echo "  $log_file: ${size_mb}MB (${line_count} lines)"
    fi
done

exit 0