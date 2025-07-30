#!/bin/bash

# test-log-cleanup.sh - Test script for log cleanup validation
# Tests for RR-75: Clean Up Log Files (30MB)

set -euo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_DIR="$SCRIPT_DIR/../logs"
TEST_RESULTS=()
FAILED_TESTS=0

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Helper functions
log_test() {
    echo -e "${YELLOW}TEST:${NC} $1"
}

log_pass() {
    echo -e "${GREEN}PASS:${NC} $1"
    TEST_RESULTS+=("PASS: $1")
}

log_fail() {
    echo -e "${RED}FAIL:${NC} $1"
    TEST_RESULTS+=("FAIL: $1")
    ((FAILED_TESTS++))
}

# Test 1: Verify safe deletion of large files without breaking active processes
test_safe_deletion() {
    log_test "Verifying safe deletion of large files"
    
    # Check if PM2 processes are still running
    local pm2_status
    pm2_status=$(pm2 list | grep -c "online" || echo "0")
    
    if [ "$pm2_status" -gt 0 ]; then
        log_pass "PM2 processes remain online after cleanup ($pm2_status services)"
    else
        log_fail "PM2 processes not running - cleanup may have broken services"
    fi
}

# Test 2: Verify storage recovery
test_storage_recovery() {
    log_test "Verifying storage recovery"
    
    local current_size
    current_size=$(du -sm "$LOG_DIR" | cut -f1)
    
    if [ "$current_size" -lt 10 ]; then
        log_pass "Log directory size reduced to ${current_size}MB (target: <10MB)"
    else
        log_fail "Log directory still ${current_size}MB (should be <10MB)"
    fi
}

# Test 3: Verify active logs are preserved
test_active_logs_preserved() {
    log_test "Verifying active logs are preserved"
    
    local active_log_patterns=(
        "prod-out*.log"
        "prod-error*.log"
        "dev-out*.log"
        "dev-error*.log"
        "cron-out*.log"
        "cron-error*.log"
        "sync-cron.jsonl"
    )
    
    local preserved_count=0
    for log_pattern in "${active_log_patterns[@]}"; do
        if ls "$LOG_DIR"/$log_pattern >/dev/null 2>&1; then
            ((preserved_count++))
        fi
    done
    
    if [ "$preserved_count" -ge 4 ]; then
        log_pass "Active logs preserved ($preserved_count/7 found)"
    else
        log_fail "Too few active logs preserved ($preserved_count/7 found)"
    fi
}

# Test 4: Check for removal of oversized files (or that they're now small)
test_oversized_files_removed() {
    log_test "Verifying oversized files were cleaned up"
    
    local oversized_files=(
        "tailscale-monitor-out.log"
        "tailscale-monitor.log"
    )
    
    local cleaned_count=0
    for log_file in "${oversized_files[@]}"; do
        if [ ! -f "$LOG_DIR/$log_file" ]; then
            # File removed completely
            ((cleaned_count++))
        else
            # Check if file is now small (<1MB)
            local size_bytes size_mb
            size_bytes=$(stat -f%z "$LOG_DIR/$log_file" 2>/dev/null || echo "0")
            size_mb=$((size_bytes / 1024 / 1024))
            if [ "$size_mb" -lt 1 ]; then
                ((cleaned_count++))
            fi
        fi
    done
    
    if [ "$cleaned_count" -eq ${#oversized_files[@]} ]; then
        log_pass "All oversized files cleaned up ($cleaned_count/${#oversized_files[@]})"
    else
        log_fail "Some oversized files remain (cleaned: $cleaned_count/${#oversized_files[@]})"
    fi
}

# Test 5: Verify no individual log exceeds size limit
test_log_size_limits() {
    log_test "Verifying no logs exceed 5MB size limit"
    
    local oversized_logs=()
    while IFS= read -r -d '' file; do
        local size_mb
        size_mb=$(stat -f%z "$file" | awk '{print int($1/1024/1024)}')
        if [ "$size_mb" -gt 5 ]; then
            oversized_logs+=("$(basename "$file"): ${size_mb}MB")
        fi
    done < <(find "$LOG_DIR" -name "*.log" -print0)
    
    if [ ${#oversized_logs[@]} -eq 0 ]; then
        log_pass "No logs exceed 5MB limit"
    else
        log_fail "Found oversized logs: ${oversized_logs[*]}"
    fi
}

# Main test execution
main() {
    echo "========================================="
    echo "Log Cleanup Validation Tests (RR-75)"
    echo "========================================="
    echo ""
    
    # Check if log directory exists
    if [ ! -d "$LOG_DIR" ]; then
        log_fail "Log directory does not exist: $LOG_DIR"
        exit 1
    fi
    
    # Run all tests
    test_safe_deletion
    test_storage_recovery
    test_active_logs_preserved
    test_oversized_files_removed
    test_log_size_limits
    
    echo ""
    echo "========================================="
    echo "Test Results Summary"
    echo "========================================="
    
    for result in "${TEST_RESULTS[@]}"; do
        if [[ $result == PASS* ]]; then
            echo -e "${GREEN}$result${NC}"
        else
            echo -e "${RED}$result${NC}"
        fi
    done
    
    echo ""
    if [ $FAILED_TESTS -eq 0 ]; then
        echo -e "${GREEN}All tests passed! ✅${NC}"
        exit 0
    else
        echo -e "${RED}$FAILED_TESTS test(s) failed! ❌${NC}"
        exit 1
    fi
}

# Run main function
main "$@"