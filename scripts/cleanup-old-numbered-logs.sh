#!/bin/bash

# cleanup-old-numbered-logs.sh - Clean up old numbered PM2 logs
# Keep only the 3 most recent files for each service

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/../logs"
KEEP_FILES=3

echo "Cleaning up old numbered PM2 logs..."
echo "Keeping only $KEEP_FILES most recent files per service"
echo ""

# Function to clean up numbered logs for a service
cleanup_service_logs() {
    local service="$1"
    local log_type="$2"  # "error" or "out"
    
    echo "Processing ${service}-${log_type} logs:"
    
    # Find all numbered log files for this service/type, sort by number (newest first)
    local files=($(ls "$LOG_DIR"/${service}-${log_type}-*.log 2>/dev/null | sort -V -r || true))
    
    if [ ${#files[@]} -le $KEEP_FILES ]; then
        echo "  Only ${#files[@]} files found, keeping all"
        return
    fi
    
    echo "  Found ${#files[@]} files, keeping $KEEP_FILES newest, removing $((${#files[@]} - KEEP_FILES))"
    
    # Keep the first KEEP_FILES files, remove the rest
    for ((i=KEEP_FILES; i<${#files[@]}; i++)); do
        local file="${files[$i]}"
        local size_bytes size_mb
        size_bytes=$(stat -f%z "$file" 2>/dev/null || echo "0")
        size_mb=$((size_bytes / 1024 / 1024))
        
        echo "    Removing: $(basename "$file") (${size_mb}MB)"
        rm "$file"
    done
}

# Clean up logs for each service
services=("prod" "dev" "cron")

for service in "${services[@]}"; do
    cleanup_service_logs "$service" "error"
    cleanup_service_logs "$service" "out"
    echo ""
done

echo "Old numbered log cleanup completed!"
echo ""
echo "Remaining log files per service:"
for service in "${services[@]}"; do
    error_count=$(ls "$LOG_DIR"/${service}-error*.log 2>/dev/null | wc -l | tr -d ' ')
    out_count=$(ls "$LOG_DIR"/${service}-out*.log 2>/dev/null | wc -l | tr -d ' ')
    echo "  $service: ${error_count} error logs, ${out_count} out logs"
done