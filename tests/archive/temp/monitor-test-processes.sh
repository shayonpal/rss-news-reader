#!/bin/bash
# Test Process Monitor for RSS News Reader
# Real-time monitoring of test execution to prevent memory exhaustion
# Part of RR-123 fix

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REFRESH_INTERVAL=2 # seconds
MEMORY_WARNING_THRESHOLD=3 # GB
MEMORY_CRITICAL_THRESHOLD=4 # GB
PROCESS_WARNING_THRESHOLD=3
PROCESS_CRITICAL_THRESHOLD=4

# Clear screen function
clear_screen() {
    printf "\033c"
}

# Get memory info for macOS
get_memory_stats() {
    if command -v vm_stat > /dev/null 2>&1; then
        # Get page size
        PAGE_SIZE=$(vm_stat | head -1 | grep -o '[0-9]*')
        
        # Get memory stats
        FREE_PAGES=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        ACTIVE_PAGES=$(vm_stat | grep "Pages active" | awk '{print $3}' | sed 's/\.//')
        INACTIVE_PAGES=$(vm_stat | grep "Pages inactive" | awk '{print $3}' | sed 's/\.//')
        WIRED_PAGES=$(vm_stat | grep "Pages wired" | awk '{print $4}' | sed 's/\.//')
        COMPRESSED_PAGES=$(vm_stat | grep "Pages compressed" | awk '{print $3}' | sed 's/\.//')
        
        # Calculate in GB
        FREE_GB=$(echo "scale=2; ($FREE_PAGES * $PAGE_SIZE) / 1073741824" | bc)
        ACTIVE_GB=$(echo "scale=2; ($ACTIVE_PAGES * $PAGE_SIZE) / 1073741824" | bc)
        INACTIVE_GB=$(echo "scale=2; ($INACTIVE_PAGES * $PAGE_SIZE) / 1073741824" | bc)
        WIRED_GB=$(echo "scale=2; ($WIRED_PAGES * $PAGE_SIZE) / 1073741824" | bc)
        COMPRESSED_GB=$(echo "scale=2; ($COMPRESSED_PAGES * $PAGE_SIZE) / 1073741824" | bc)
        
        TOTAL_USED_GB=$(echo "scale=2; $ACTIVE_GB + $WIRED_GB" | bc)
        AVAILABLE_GB=$(echo "scale=2; $FREE_GB + $INACTIVE_GB" | bc)
    else
        FREE_GB="N/A"
        TOTAL_USED_GB="N/A"
        AVAILABLE_GB="N/A"
    fi
}

# Get vitest process info
get_vitest_processes() {
    VITEST_PIDS=$(pgrep -f vitest 2>/dev/null || echo "")
    VITEST_COUNT=$(echo "$VITEST_PIDS" | grep -c . 2>/dev/null || echo 0)
    
    if [ -n "$VITEST_PIDS" ] && [ "$VITEST_COUNT" -gt 0 ]; then
        VITEST_DETAILS=""
        for PID in $VITEST_PIDS; do
            if ps -p "$PID" > /dev/null 2>&1; then
                # Get process details
                PROC_INFO=$(ps -p "$PID" -o pid,vsz,rss,cpu,etime,comm | tail -1)
                VSZ=$(echo "$PROC_INFO" | awk '{print $2}')
                RSS=$(echo "$PROC_INFO" | awk '{print $3}')
                CPU=$(echo "$PROC_INFO" | awk '{print $4}')
                ETIME=$(echo "$PROC_INFO" | awk '{print $5}')
                
                # Convert memory to MB
                VSZ_MB=$((VSZ / 1024))
                RSS_MB=$((RSS / 1024))
                
                VITEST_DETAILS="${VITEST_DETAILS}  PID: $PID | Memory: ${RSS_MB}MB | CPU: ${CPU}% | Time: $ETIME\n"
            fi
        done
    else
        VITEST_DETAILS="  No vitest processes running\n"
    fi
}

# Get PM2 service status
get_pm2_status() {
    if command -v pm2 > /dev/null 2>&1; then
        PM2_STATUS=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | contains("rss")) | "\(.name): \(.pm2_env.status)"' 2>/dev/null || echo "PM2 not available")
    else
        PM2_STATUS="PM2 not installed"
    fi
}

# Check for test lock
check_test_lock() {
    LOCK_FILE="/tmp/rss-reader-test.lock"
    if [ -f "$LOCK_FILE" ]; then
        LOCK_PID=$(cat "$LOCK_FILE")
        if ps -p "$LOCK_PID" > /dev/null 2>&1; then
            TEST_RUNNING="Yes (PID: $LOCK_PID)"
        else
            TEST_RUNNING="Lock file exists (stale)"
        fi
    else
        TEST_RUNNING="No"
    fi
}

# Main monitoring loop
echo -e "${CYAN}RSS News Reader Test Process Monitor${NC}"
echo "Press Ctrl+C to exit"
echo

while true; do
    clear_screen
    
    # Header
    echo -e "${CYAN}╔═══════════════════════════════════════════════════════════════╗${NC}"
    echo -e "${CYAN}║        RSS News Reader Test Process Monitor (RR-123)          ║${NC}"
    echo -e "${CYAN}╚═══════════════════════════════════════════════════════════════╝${NC}"
    echo
    
    # Timestamp
    echo -e "${BLUE}Last Update:${NC} $(date '+%Y-%m-%d %H:%M:%S')"
    echo
    
    # Get stats
    get_memory_stats
    get_vitest_processes
    get_pm2_status
    check_test_lock
    
    # Memory Status
    echo -e "${BLUE}═══ Memory Status ═══${NC}"
    
    # Determine memory status color
    if (( $(echo "$TOTAL_USED_GB > $MEMORY_CRITICAL_THRESHOLD" | bc -l) )); then
        MEM_COLOR=$RED
        MEM_STATUS="CRITICAL"
    elif (( $(echo "$TOTAL_USED_GB > $MEMORY_WARNING_THRESHOLD" | bc -l) )); then
        MEM_COLOR=$YELLOW
        MEM_STATUS="WARNING"
    else
        MEM_COLOR=$GREEN
        MEM_STATUS="OK"
    fi
    
    echo -e "Total Used: ${MEM_COLOR}${TOTAL_USED_GB}GB${NC} [$MEM_STATUS]"
    echo -e "Available: ${AVAILABLE_GB}GB"
    echo -e "Free: ${FREE_GB}GB"
    echo
    
    # Process Status
    echo -e "${BLUE}═══ Test Process Status ═══${NC}"
    
    # Determine process status color
    if [ "$VITEST_COUNT" -ge "$PROCESS_CRITICAL_THRESHOLD" ]; then
        PROC_COLOR=$RED
        PROC_STATUS="CRITICAL"
    elif [ "$VITEST_COUNT" -ge "$PROCESS_WARNING_THRESHOLD" ]; then
        PROC_COLOR=$YELLOW
        PROC_STATUS="WARNING"
    else
        PROC_COLOR=$GREEN
        PROC_STATUS="OK"
    fi
    
    echo -e "Vitest Processes: ${PROC_COLOR}${VITEST_COUNT}${NC} [$PROC_STATUS]"
    echo -e "Test Running: $TEST_RUNNING"
    echo
    
    # Process Details
    if [ "$VITEST_COUNT" -gt 0 ]; then
        echo -e "${BLUE}═══ Process Details ═══${NC}"
        echo -e "$VITEST_DETAILS"
    fi
    
    # PM2 Status
    echo -e "${BLUE}═══ PM2 Services ═══${NC}"
    echo "$PM2_STATUS"
    echo
    
    # Alerts
    if [ "$MEM_STATUS" = "CRITICAL" ] || [ "$PROC_STATUS" = "CRITICAL" ]; then
        echo -e "${RED}═══ ALERTS ═══${NC}"
        [ "$MEM_STATUS" = "CRITICAL" ] && echo -e "${RED}⚠ Memory usage critical! Consider killing test processes.${NC}"
        [ "$PROC_STATUS" = "CRITICAL" ] && echo -e "${RED}⚠ Too many test processes! Tests may be stuck.${NC}"
        echo
    elif [ "$MEM_STATUS" = "WARNING" ] || [ "$PROC_STATUS" = "WARNING" ]; then
        echo -e "${YELLOW}═══ WARNINGS ═══${NC}"
        [ "$MEM_STATUS" = "WARNING" ] && echo -e "${YELLOW}⚠ Memory usage high. Monitor closely.${NC}"
        [ "$PROC_STATUS" = "WARNING" ] && echo -e "${YELLOW}⚠ Multiple test processes detected.${NC}"
        echo
    fi
    
    # Help
    echo -e "${CYAN}═══ Commands ═══${NC}"
    echo "• Press Ctrl+C to exit"
    echo "• Run './scripts/kill-test-processes.sh' for emergency cleanup"
    echo "• Run 'npm test' to execute tests safely"
    
    # Sleep before refresh
    sleep $REFRESH_INTERVAL
done