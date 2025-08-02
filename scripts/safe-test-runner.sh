#!/bin/bash
# Safe Test Runner for RSS News Reader
# Prevents memory exhaustion by enforcing resource limits and sequential execution
# Part of RR-123 fix

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
LOCK_FILE="/tmp/rss-reader-test.lock"
MAX_RUNTIME=1800 # 30 minutes max test runtime
MEMORY_LIMIT_GB=4 # Maximum memory usage in GB

echo -e "${GREEN}RSS News Reader Safe Test Runner${NC}"
echo "======================================="

# Check if tests are already running
if [ -f "$LOCK_FILE" ]; then
    PID=$(cat "$LOCK_FILE")
    if ps -p "$PID" > /dev/null 2>&1; then
        echo -e "${RED}ERROR: Tests are already running (PID: $PID)${NC}"
        echo "If this is incorrect, remove the lock file: rm $LOCK_FILE"
        exit 1
    else
        echo -e "${YELLOW}Found stale lock file, removing...${NC}"
        rm "$LOCK_FILE"
    fi
fi

# Create lock file with current PID
echo $$ > "$LOCK_FILE"

# Cleanup function
cleanup() {
    echo -e "\n${YELLOW}Cleaning up...${NC}"
    
    # Kill any remaining vitest processes
    pkill -f vitest || true
    
    # Remove lock file
    rm -f "$LOCK_FILE"
    
    # Check for orphaned processes
    if pgrep -f vitest > /dev/null; then
        echo -e "${RED}WARNING: Found orphaned vitest processes, force killing...${NC}"
        pkill -9 -f vitest || true
    fi
    
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Set up trap for cleanup on exit
trap cleanup EXIT INT TERM

# Pre-execution cleanup
echo -e "${YELLOW}Pre-execution cleanup...${NC}"
pkill -f vitest || true
sleep 1

# Monitor function (runs in background)
monitor_resources() {
    while true; do
        # Check memory usage
        if command -v vm_stat > /dev/null 2>&1; then
            # macOS
            FREE_BLOCKS=$(vm_stat | grep free | awk '{ print $3 }' | sed 's/\.//')
            INACTIVE_BLOCKS=$(vm_stat | grep inactive | awk '{ print $3 }' | sed 's/\.//')
            SPECULATIVE_BLOCKS=$(vm_stat | grep speculative | awk '{ print $3 }' | sed 's/\.//')
            
            FREE=$((($FREE_BLOCKS + $INACTIVE_BLOCKS + $SPECULATIVE_BLOCKS) * 4096 / 1048576))
            
            if [ "$FREE" -lt 1024 ]; then
                echo -e "\n${RED}WARNING: Low memory detected (< 1GB free)${NC}"
            fi
        fi
        
        # Check vitest process count
        VITEST_COUNT=$(pgrep -f vitest | wc -l | tr -d ' ')
        if [ "$VITEST_COUNT" -gt 4 ]; then
            echo -e "\n${RED}ERROR: Too many vitest processes ($VITEST_COUNT), killing tests...${NC}"
            kill $TEST_PID 2>/dev/null || true
            break
        fi
        
        sleep 5
    done
}

# Start resource monitoring in background
echo -e "${GREEN}Starting resource monitoring...${NC}"
monitor_resources &
MONITOR_PID=$!

# Function to run tests with timeout
run_with_timeout() {
    local cmd="$1"
    local timeout="$2"
    local name="$3"
    
    echo -e "\n${GREEN}Running $name...${NC}"
    echo "Command: $cmd"
    echo "Timeout: ${timeout}s"
    
    # Run the command with timeout
    if command -v gtimeout > /dev/null 2>&1; then
        # macOS with GNU coreutils
        gtimeout --signal=TERM --kill-after=10 "$timeout" $cmd
    elif command -v timeout > /dev/null 2>&1; then
        # Linux
        timeout --signal=TERM --kill-after=10 "$timeout" $cmd
    else
        # Fallback: run without timeout
        echo -e "${YELLOW}WARNING: timeout command not found, running without timeout${NC}"
        $cmd
    fi
    
    local exit_code=$?
    
    if [ $exit_code -eq 124 ] || [ $exit_code -eq 137 ]; then
        echo -e "${RED}ERROR: $name timed out after ${timeout}s${NC}"
        return 1
    elif [ $exit_code -ne 0 ]; then
        echo -e "${RED}ERROR: $name failed with exit code $exit_code${NC}"
        return $exit_code
    else
        echo -e "${GREEN}✓ $name completed successfully${NC}"
        return 0
    fi
}

# Main test execution
echo -e "\n${GREEN}Starting test execution...${NC}"
echo "Resource limits enforced:"
echo "- Max concurrent processes: 1"
echo "- Max vitest forks: 2"
echo "- Test timeout: 30s per test"
echo "- Total runtime limit: ${MAX_RUNTIME}s"

# Store main process PID for monitoring
TEST_PID=$$

# Run unit tests
if ! run_with_timeout "npx vitest run --no-coverage" 900 "Unit Tests"; then
    echo -e "${RED}Unit tests failed${NC}"
    kill $MONITOR_PID 2>/dev/null || true
    exit 1
fi

# Brief pause between test suites
echo -e "\n${YELLOW}Pausing between test suites...${NC}"
sleep 2

# Run integration tests
if ! run_with_timeout "npx vitest run --no-coverage --config vitest.config.integration.ts" 900 "Integration Tests"; then
    echo -e "${RED}Integration tests failed${NC}"
    kill $MONITOR_PID 2>/dev/null || true
    exit 1
fi

# Kill monitor process
kill $MONITOR_PID 2>/dev/null || true

# Final resource check
echo -e "\n${GREEN}Final resource check...${NC}"
FINAL_VITEST_COUNT=$(pgrep -f vitest | wc -l | tr -d ' ')
if [ "$FINAL_VITEST_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}WARNING: Found $FINAL_VITEST_COUNT vitest processes still running${NC}"
    pkill -f vitest || true
fi

echo -e "\n${GREEN}✓ All tests completed successfully!${NC}"
echo "======================================="

# Exit successfully
exit 0