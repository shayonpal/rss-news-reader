#!/bin/bash

# test-log-rotation.sh - Test script for log rotation functionality
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

# Test 1: PM2 logrotate configuration
test_pm2_logrotate_config() {
    log_test "Verifying PM2 logrotate configuration"
    
    # Check if pm2-logrotate module is running
    local pm2_module_status
    pm2_module_status=$(pm2 list | grep "pm2-logrotate" | grep -c "online" || echo "0")
    
    if [ "$pm2_module_status" -eq 1 ]; then
        log_pass "PM2 logrotate module is running"
    else
        log_fail "PM2 logrotate module is not running"
        return
    fi
    
    # Check configuration settings
    local config_output
    config_output=$(pm2 conf pm2-logrotate 2>/dev/null || echo "")
    
    # Check max_size setting (should be 10M)
    if echo "$config_output" | grep -q "max_size 10M"; then
        log_pass "PM2 logrotate max_size set to 10M"
    else
        log_fail "PM2 logrotate max_size not set to 10M"
    fi
    
    # Check retain setting (should be 7)
    if echo "$config_output" | grep -q "retain 7"; then
        log_pass "PM2 logrotate retain set to 7 days"
    else
        log_fail "PM2 logrotate retain not set to 7 days"
    fi
    
    # Check compress setting (should be true)
    if echo "$config_output" | grep -q "compress true"; then
        log_pass "PM2 logrotate compression enabled"
    else
        log_fail "PM2 logrotate compression not enabled"
    fi
}

# Test 2: Health log rotation functionality
test_health_log_rotation() {
    log_test "Verifying health log rotation functionality"
    
    local rotation_script="$SCRIPT_DIR/rotate-health-logs.sh"
    
    if [ -f "$rotation_script" ]; then
        log_pass "Health log rotation script exists"
    else
        log_fail "Health log rotation script not found"
        return
    fi
    
    # Check if script is executable
    if [ -x "$rotation_script" ]; then
        log_pass "Health log rotation script is executable"
    else
        log_fail "Health log rotation script is not executable"
    fi
    
    # Check if cron job exists
    local cron_check
    cron_check=$(crontab -l 2>/dev/null | grep -c "rotate-health-logs.sh" || echo "0")
    
    if [ "$cron_check" -eq 1 ]; then
        log_pass "Health log rotation cron job exists"
    else
        log_fail "Health log rotation cron job not found"
    fi
}

# Test 3: Tailscale logs in rotation list
test_tailscale_logs_rotation() {
    log_test "Verifying tailscale logs are included in rotation"
    
    local rotation_script="$SCRIPT_DIR/rotate-health-logs.sh"
    
    if [ ! -f "$rotation_script" ]; then
        log_fail "Health log rotation script not found"
        return
    fi
    
    # Check if tailscale logs are in the rotation list
    if grep -q "tailscale-monitor" "$rotation_script"; then
        log_pass "Tailscale logs included in rotation script"
    else
        log_fail "Tailscale logs not found in rotation script"
    fi
}

# Test 4: Compressed log files exist
test_compressed_logs() {
    log_test "Verifying compressed log files exist"
    
    local gz_count
    gz_count=$(find "$LOG_DIR" -name "*.gz" | wc -l | tr -d ' ')
    
    if [ "$gz_count" -gt 0 ]; then
        log_pass "Found $gz_count compressed log files"
    else
        log_fail "No compressed log files found (rotation may not be working)"
    fi
}

# Test 5: Log retention policy
test_log_retention() {
    log_test "Verifying log retention policy"
    
    # Count PM2 log files per service (should be max 3-5)
    local services=("prod" "dev" "cron")
    local retention_violations=0
    
    for service in "${services[@]}"; do
        local error_logs
        local out_logs
        error_logs=$(ls "$LOG_DIR"/${service}-error*.log 2>/dev/null | wc -l | tr -d ' ')
        out_logs=$(ls "$LOG_DIR"/${service}-out*.log 2>/dev/null | wc -l | tr -d ' ')
        
        if [ "$error_logs" -gt 5 ] || [ "$out_logs" -gt 5 ]; then
            ((retention_violations++))
        fi
    done
    
    if [ "$retention_violations" -eq 0 ]; then
        log_pass "Log retention policy respected (≤5 files per service)"
    else
        log_fail "$retention_violations service(s) have too many log files"
    fi
}

# Test 6: Service continuity after rotation
test_service_continuity() {
    log_test "Verifying service continuity after rotation"
    
    # Check if all required PM2 services are running
    local required_services=("rss-reader-dev" "rss-sync-cron")
    local running_services=0
    
    for service in "${required_services[@]}"; do
        if pm2 list | grep "$service" | grep -q "online"; then
            ((running_services++))
        fi
    done
    
    if [ "$running_services" -eq ${#required_services[@]} ]; then
        log_pass "All required services remain online ($running_services/${#required_services[@]})"
    else
        log_fail "Some services offline (running: $running_services/${#required_services[@]})"
    fi
}

# Main test execution
main() {
    echo "========================================="
    echo "Log Rotation Functionality Tests (RR-75)"
    echo "========================================="
    echo ""
    
    # Check if log directory exists
    if [ ! -d "$LOG_DIR" ]; then
        log_fail "Log directory does not exist: $LOG_DIR"
        exit 1
    fi
    
    # Run all tests
    test_pm2_logrotate_config
    test_health_log_rotation
    test_tailscale_logs_rotation
    test_compressed_logs
    test_log_retention
    test_service_continuity
    
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