#!/bin/bash

# cleanup-large-logs.sh - Immediate cleanup of large log files
# Implementation for RR-75: Clean Up Log Files (30MB)

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/../logs"
BACKUP_DIR="$LOG_DIR/backup-$(date +%Y%m%d_%H%M%S)"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================="
echo "Large Log Files Cleanup (RR-75)"
echo "========================================="
echo ""

# Check if log directory exists
if [ ! -d "$LOG_DIR" ]; then
    echo -e "${RED}ERROR:${NC} Log directory does not exist: $LOG_DIR"
    exit 1
fi

# Create backup directory for important logs
mkdir -p "$BACKUP_DIR"
echo -e "${YELLOW}INFO:${NC} Created backup directory: $BACKUP_DIR"

# Function to safely remove or backup large files
remove_large_file() {
    local file="$1"
    local size_mb="$2"
    local action="$3"  # "remove" or "backup"
    
    if [ ! -f "$file" ]; then
        echo -e "${YELLOW}SKIP:${NC} File not found: $(basename "$file")"
        return
    fi
    
    if [ "$action" = "backup" ]; then
        echo -e "${YELLOW}BACKUP:${NC} $(basename "$file") (${size_mb}MB) -> backup/"
        cp "$file" "$BACKUP_DIR/"
        rm "$file"
    else
        echo -e "${GREEN}REMOVE:${NC} $(basename "$file") (${size_mb}MB)"
        rm "$file"
    fi
}

echo "Analyzing log files..."
echo ""

# Get current directory size
current_size=$(du -sm "$LOG_DIR" | cut -f1)
echo -e "${YELLOW}CURRENT:${NC} Log directory size: ${current_size}MB"
echo ""

# 1. Remove large regenerable files (tailscale monitor logs)
echo "1. Removing large regenerable files:"
remove_large_file "$LOG_DIR/tailscale-monitor-out.log" "14" "remove"
remove_large_file "$LOG_DIR/tailscale-monitor.log" "7" "remove"

# 2. Clean up old numbered PM2 logs (keep only current ones)
echo ""
echo "2. Cleaning up old numbered PM2 logs:"

# Remove old dev logs (keep only current)
for file in "$LOG_DIR"/dev-error-*.log; do
    if [ -f "$file" ]; then
        file_num=$(echo "$file" | grep -o '[0-9]\+' | tail -1)
        size_bytes=$(stat -f%z "$file" 2>/dev/null || echo "0")
        size_mb=$((size_bytes / 1024 / 1024))
        
        # Keep only files smaller than 1MB or the very latest
        if [ "$size_mb" -gt 1 ] && [ "$file_num" -lt 7 ]; then
            remove_large_file "$file" "$size_mb" "remove"
        fi
    fi
done

# Remove old dev out logs
for file in "$LOG_DIR"/dev-out-*.log; do
    if [ -f "$file" ]; then
        size_bytes=$(stat -f%z "$file" 2>/dev/null || echo "0")
        size_mb=$((size_bytes / 1024 / 1024))
        
        if [ "$size_mb" -gt 1 ]; then
            remove_large_file "$file" "$size_mb" "remove"
        fi
    fi
done

# 3. Clean up large service monitor logs
echo ""
echo "3. Cleaning up service monitor logs:"
if [ -f "$LOG_DIR/services-monitor.jsonl" ]; then
    size_bytes=$(stat -f%z "$LOG_DIR/services-monitor.jsonl" 2>/dev/null || echo "0")
    size_mb=$((size_bytes / 1024 / 1024))
    
    if [ "$size_mb" -gt 1 ]; then
        # Backup and truncate (keep recent entries)
        tail -100 "$LOG_DIR/services-monitor.jsonl" > "$LOG_DIR/services-monitor.jsonl.tmp"
        mv "$LOG_DIR/services-monitor.jsonl.tmp" "$LOG_DIR/services-monitor.jsonl"
        echo -e "${GREEN}TRUNCATE:${NC} services-monitor.jsonl (kept last 100 entries)"
    fi
fi

# 4. Remove empty log files
echo ""
echo "4. Removing empty log files:"
find "$LOG_DIR" -name "*.log" -size 0 -delete -print | while read -r file; do
    echo -e "${GREEN}REMOVE:${NC} $(basename "$file") (empty)"
done

echo ""
echo "========================================="
echo "Cleanup Summary"
echo "========================================="

# Calculate new size
new_size=$(du -sm "$LOG_DIR" | cut -f1)
freed_space=$((current_size - new_size))

echo -e "${YELLOW}BEFORE:${NC} ${current_size}MB"
echo -e "${YELLOW}AFTER:${NC} ${new_size}MB"
echo -e "${GREEN}FREED:${NC} ${freed_space}MB"

if [ -d "$BACKUP_DIR" ] && [ "$(ls -A "$BACKUP_DIR" 2>/dev/null || echo "")" ]; then
    backup_size=$(du -sm "$BACKUP_DIR" | cut -f1)
    echo -e "${YELLOW}BACKUP:${NC} ${backup_size}MB in $BACKUP_DIR"
else
    rmdir "$BACKUP_DIR" 2>/dev/null || true
    echo -e "${YELLOW}BACKUP:${NC} No files backed up"
fi

echo ""
if [ "$new_size" -lt 10 ]; then
    echo -e "${GREEN}SUCCESS:${NC} Log directory reduced to target size (<10MB) ✅"
else
    echo -e "${YELLOW}WARNING:${NC} Log directory still ${new_size}MB (target: <10MB)"
fi

echo ""
echo "Remaining large files (>1MB):"
find "$LOG_DIR" -name "*.log" -o -name "*.jsonl" | while read -r file; do
    if [ -f "$file" ]; then
        size_bytes=$(stat -f%z "$file" 2>/dev/null || echo "0")
        size_mb=$((size_bytes / 1024 / 1024))
        
        if [ "$size_mb" -gt 1 ]; then
            echo "  $(basename "$file"): ${size_mb}MB"
        fi
    fi
done | head -10

echo ""
echo -e "${GREEN}Cleanup completed!${NC}"