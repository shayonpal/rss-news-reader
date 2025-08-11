#!/bin/bash
# Optimized Test Runner for RSS News Reader (RR-183)
# Provides mass test execution with resource management and progress monitoring

set -e

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
LOCK_FILE="/tmp/rss-reader-test.lock"
MAX_RUNTIME=600 # 10 minutes max test runtime
START_TIME=$(date +%s)

echo -e "${BLUE}╔════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║     RSS News Reader - Optimized Test Suite Runner         ║${NC}"
echo -e "${BLUE}║                    (RR-183 Implementation)                ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════╝${NC}"
echo ""

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
    pkill -f vitest 2>/dev/null || true
    
    # Remove lock file
    rm -f "$LOCK_FILE"
    
    # Calculate total runtime
    END_TIME=$(date +%s)
    DURATION=$((END_TIME - START_TIME))
    MINUTES=$((DURATION / 60))
    SECONDS=$((DURATION % 60))
    
    echo -e "${GREEN}Total execution time: ${MINUTES}m ${SECONDS}s${NC}"
    echo -e "${GREEN}Cleanup complete${NC}"
}

# Set up trap for cleanup on exit
trap cleanup EXIT INT TERM

# Function to monitor test progress
monitor_progress() {
    local test_type="$1"
    local pid="$2"
    local start=$(date +%s)
    local spinner=('⠋' '⠙' '⠹' '⠸' '⠼' '⠴' '⠦' '⠧' '⠇' '⠏')
    local spin_idx=0
    
    while kill -0 "$pid" 2>/dev/null; do
        local current=$(date +%s)
        local elapsed=$((current - start))
        local mins=$((elapsed / 60))
        local secs=$((elapsed % 60))
        
        printf "\r${spinner[$spin_idx]} Running $test_type... [${mins}m ${secs}s]"
        
        spin_idx=$(( (spin_idx + 1) % 10 ))
        sleep 0.5
    done
    
    wait "$pid"
    local exit_code=$?
    
    local current=$(date +%s)
    local elapsed=$((current - start))
    local mins=$((elapsed / 60))
    local secs=$((elapsed % 60))
    
    if [ $exit_code -eq 0 ]; then
        printf "\r${GREEN}✓${NC} $test_type completed [${mins}m ${secs}s]\n"
    else
        printf "\r${RED}✗${NC} $test_type failed [${mins}m ${secs}s]\n"
    fi
    
    return $exit_code
}

# Function to run tests with different modes
run_test_mode() {
    local mode="$1"
    local description="$2"
    
    echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}Running: $description${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
    
    case "$mode" in
        "parallel")
            # Run with parallel execution
            echo -e "${YELLOW}Mode: Parallel execution (4 threads)${NC}"
            npx vitest run --no-coverage &
            monitor_progress "$description" $!
            ;;
        "sequential")
            # Run with sequential execution
            echo -e "${YELLOW}Mode: Sequential execution (1 thread)${NC}"
            npx vitest run --no-coverage --pool=forks --poolOptions.forks.maxForks=1 &
            monitor_progress "$description" $!
            ;;
        "sharded")
            # Run with sharding for large test suites
            echo -e "${YELLOW}Mode: Sharded execution${NC}"
            
            # Shard 1
            npx vitest run --no-coverage --shard=1/3 &
            local pid1=$!
            
            # Shard 2
            npx vitest run --no-coverage --shard=2/3 &
            local pid2=$!
            
            # Shard 3
            npx vitest run --no-coverage --shard=3/3 &
            local pid3=$!
            
            # Wait for all shards
            wait $pid1 $pid2 $pid3
            ;;
    esac
    
    return $?
}

# Pre-execution system check
echo -e "${YELLOW}Pre-execution system check...${NC}"

# Check available memory (macOS)
if command -v vm_stat > /dev/null 2>&1; then
    FREE_BLOCKS=$(vm_stat | grep free | awk '{ print $3 }' | sed 's/\.//')
    INACTIVE_BLOCKS=$(vm_stat | grep inactive | awk '{ print $3 }' | sed 's/\.//')
    FREE_MB=$((($FREE_BLOCKS + $INACTIVE_BLOCKS) * 4096 / 1048576))
    
    echo -e "Available memory: ${FREE_MB}MB"
    
    if [ "$FREE_MB" -lt 2048 ]; then
        echo -e "${RED}WARNING: Low memory available (< 2GB). Tests may fail.${NC}"
        echo -e "${YELLOW}Consider closing other applications.${NC}"
    fi
fi

# Kill any existing vitest processes
echo -e "${YELLOW}Cleaning up any existing test processes...${NC}"
pkill -f vitest 2>/dev/null || true
sleep 1

# Main test execution
echo -e "\n${GREEN}Starting optimized test execution...${NC}"
echo -e "Configuration:"
echo -e "  • Max threads: 4"
echo -e "  • Test timeout: 30s"
echo -e "  • Hook timeout: 10s"
echo -e "  • Max runtime: ${MAX_RUNTIME}s"
echo -e "  • Mock cleanup: Enabled"

# Choose execution mode based on environment or argument
EXECUTION_MODE="${1:-parallel}"
SHARD_NUMBER="${2:-}"
TOTAL_SHARDS="${3:-}"

# Special handling for CI/CD sharding
if [ "$EXECUTION_MODE" = "shard" ] && [ -n "$SHARD_NUMBER" ] && [ -n "$TOTAL_SHARDS" ]; then
    echo -e "${BLUE}Running CI/CD shard $SHARD_NUMBER of $TOTAL_SHARDS${NC}"
    npx vitest run --no-coverage --shard=$SHARD_NUMBER/$TOTAL_SHARDS --reporter=verbose
    TEST_EXIT_CODE=$?
    
    # Skip normal cleanup for CI sharding
    rm -f "$LOCK_FILE"
    exit $TEST_EXIT_CODE
fi

case "$EXECUTION_MODE" in
    "parallel")
        run_test_mode "parallel" "Full Test Suite (Parallel)"
        TEST_EXIT_CODE=$?
        ;;
    "sequential")
        run_test_mode "sequential" "Full Test Suite (Sequential)"
        TEST_EXIT_CODE=$?
        ;;
    "sharded")
        run_test_mode "sharded" "Full Test Suite (Sharded)"
        TEST_EXIT_CODE=$?
        ;;
    "progressive")
        # Progressive testing: Start with quick smoke tests, then full suite
        echo -e "\n${BLUE}Progressive Test Execution${NC}"
        
        # Run critical tests first
        echo -e "\n${YELLOW}Phase 1: Critical Tests${NC}"
        npx vitest run --no-coverage src/__tests__/unit/rr-176-auto-parse-logic.test.ts &
        monitor_progress "Critical Tests" $!
        
        if [ $? -eq 0 ]; then
            # Run full suite if critical tests pass
            echo -e "\n${YELLOW}Phase 2: Full Test Suite${NC}"
            run_test_mode "parallel" "Full Test Suite"
            TEST_EXIT_CODE=$?
        else
            echo -e "${RED}Critical tests failed, skipping full suite${NC}"
            TEST_EXIT_CODE=1
        fi
        ;;
    *)
        echo -e "${RED}Unknown execution mode: $EXECUTION_MODE${NC}"
        echo "Available modes: parallel, sequential, sharded, progressive"
        exit 1
        ;;
esac

# Final summary
echo -e "\n${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}                    Test Execution Summary                  ${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo -e "${GREEN}✓ All tests completed successfully!${NC}"
else
    echo -e "${RED}✗ Test suite failed with exit code: $TEST_EXIT_CODE${NC}"
fi

# Resource usage summary
if command -v vm_stat > /dev/null 2>&1; then
    FREE_BLOCKS_AFTER=$(vm_stat | grep free | awk '{ print $3 }' | sed 's/\.//')
    INACTIVE_BLOCKS_AFTER=$(vm_stat | grep inactive | awk '{ print $3 }' | sed 's/\.//')
    FREE_MB_AFTER=$((($FREE_BLOCKS_AFTER + $INACTIVE_BLOCKS_AFTER) * 4096 / 1048576))
    MEMORY_USED=$((FREE_MB - FREE_MB_AFTER))
    
    echo -e "Memory used during tests: ~${MEMORY_USED}MB"
fi

# Check for any lingering processes
VITEST_COUNT=$(pgrep -f vitest 2>/dev/null | wc -l | tr -d ' ')
if [ "$VITEST_COUNT" -gt 0 ]; then
    echo -e "${YELLOW}WARNING: Found $VITEST_COUNT vitest processes still running${NC}"
    pkill -f vitest 2>/dev/null || true
fi

echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"

# Exit with test exit code
exit $TEST_EXIT_CODE