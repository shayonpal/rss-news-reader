#!/bin/bash
# Emergency Test Process Killer for RSS News Reader
# Quick recovery when tests go rogue and cause memory exhaustion
# Part of RR-123 fix

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${RED}Emergency Test Process Killer${NC}"
echo "======================================="
echo -e "${YELLOW}WARNING: This will forcefully terminate all test processes${NC}"
echo

# Function to show process info
show_processes() {
    echo -e "${BLUE}Current vitest processes:${NC}"
    ps aux | grep -E "(vitest|node.*test)" | grep -v grep || echo "No vitest processes found"
    echo
}

# Function to get memory usage on macOS
get_memory_info() {
    if command -v vm_stat > /dev/null 2>&1; then
        echo -e "${BLUE}Memory Status:${NC}"
        
        # Get page size
        PAGE_SIZE=$(vm_stat | head -1 | grep -o '[0-9]*')
        
        # Get memory stats
        FREE_PAGES=$(vm_stat | grep "Pages free" | awk '{print $3}' | sed 's/\.//')
        ACTIVE_PAGES=$(vm_stat | grep "Pages active" | awk '{print $3}' | sed 's/\.//')
        INACTIVE_PAGES=$(vm_stat | grep "Pages inactive" | awk '{print $3}' | sed 's/\.//')
        WIRED_PAGES=$(vm_stat | grep "Pages wired" | awk '{print $4}' | sed 's/\.//')
        
        # Calculate in MB
        FREE_MB=$((FREE_PAGES * PAGE_SIZE / 1048576))
        ACTIVE_MB=$((ACTIVE_PAGES * PAGE_SIZE / 1048576))
        INACTIVE_MB=$((INACTIVE_PAGES * PAGE_SIZE / 1048576))
        WIRED_MB=$((WIRED_PAGES * PAGE_SIZE / 1048576))
        TOTAL_USED_MB=$((ACTIVE_MB + WIRED_MB))
        
        echo "Free Memory: ${FREE_MB}MB"
        echo "Active Memory: ${ACTIVE_MB}MB"
        echo "Inactive Memory: ${INACTIVE_MB}MB"
        echo "Wired Memory: ${WIRED_MB}MB"
        echo "Total Used: ${TOTAL_USED_MB}MB"
        echo
    fi
}

# Show initial state
echo -e "${YELLOW}Initial System State:${NC}"
show_processes
get_memory_info

# Kill vitest processes
echo -e "${RED}Killing vitest processes...${NC}"
pkill -f vitest 2>/dev/null || echo "No vitest processes to kill"

# Kill node test processes
echo -e "${RED}Killing node test processes...${NC}"
pkill -f "node.*test" 2>/dev/null || echo "No node test processes to kill"

# Give processes time to die
sleep 1

# Force kill if any remain
if pgrep -f vitest > /dev/null 2>&1; then
    echo -e "${RED}Force killing remaining vitest processes...${NC}"
    pkill -9 -f vitest 2>/dev/null || true
fi

if pgrep -f "node.*test" > /dev/null 2>&1; then
    echo -e "${RED}Force killing remaining node test processes...${NC}"
    pkill -9 -f "node.*test" 2>/dev/null || true
fi

# Remove lock file if exists
LOCK_FILE="/tmp/rss-reader-test.lock"
if [ -f "$LOCK_FILE" ]; then
    echo -e "${YELLOW}Removing test lock file...${NC}"
    rm -f "$LOCK_FILE"
fi

# Clean up any zombie processes
echo -e "${YELLOW}Cleaning up zombie processes...${NC}"
ps aux | grep defunct | grep -v grep | awk '{print $2}' | xargs -r kill -9 2>/dev/null || true

# Show final state
echo
echo -e "${GREEN}Final System State:${NC}"
show_processes
get_memory_info

# Check PM2 services
if command -v pm2 > /dev/null 2>&1; then
    echo -e "${BLUE}PM2 Service Status:${NC}"
    pm2 list
    
    # Restart services if they're in error state
    if pm2 list | grep -E "(error|stopped)" > /dev/null 2>&1; then
        echo -e "${YELLOW}Found stopped/errored PM2 services, restarting...${NC}"
        pm2 restart all
    fi
fi

echo
echo -e "${GREEN}✓ Emergency cleanup complete!${NC}"
echo -e "${YELLOW}You can now safely run tests again with: npm test${NC}"
echo "======================================="

exit 0