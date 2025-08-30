#!/bin/bash

# RR-106: Automated Validation Script for Freshness API Removal
# This script validates each phase of the removal process and ensures system integrity

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PROJECT_ROOT="/Users/shayon/DevProjects/rss-news-reader"
LOG_FILE="$PROJECT_ROOT/logs/rr-106-validation.log"
BASE_URL="http://100.96.166.53:3000/reader"
SYNC_SERVER_URL="http://localhost:3001"

# Ensure log directory exists
mkdir -p "$(dirname "$LOG_FILE")"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Status tracking
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
WARNINGS=0

# Test result tracking
test_start() {
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    echo -e "${BLUE}Running Test: $1${NC}"
    log "TEST START: $1"
}

test_pass() {
    PASSED_TESTS=$((PASSED_TESTS + 1))
    echo -e "${GREEN}✅ PASS: $1${NC}"
    log "TEST PASS: $1"
}

test_fail() {
    FAILED_TESTS=$((FAILED_TESTS + 1))
    echo -e "${RED}❌ FAIL: $1${NC}"
    log "TEST FAIL: $1"
    if [ "$2" != "continue" ]; then
        echo -e "${RED}Critical failure detected. Stopping tests.${NC}"
        exit 1
    fi
}

test_warn() {
    WARNINGS=$((WARNINGS + 1))
    echo -e "${YELLOW}⚠️  WARN: $1${NC}"
    log "TEST WARN: $1"
}

# HTTP request helper
check_endpoint() {
    local url=$1
    local expected_status=$2
    local description=$3
    
    local response
    local status_code
    
    response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$url" 2>/dev/null || echo "HTTPSTATUS:000")
    status_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$status_code" = "$expected_status" ]; then
        test_pass "$description (Status: $status_code)"
        return 0
    else
        test_fail "$description (Expected: $expected_status, Got: $status_code)" "continue"
        return 1
    fi
}

# File existence helper
check_file_exists() {
    local file_path=$1
    local should_exist=$2
    local description=$3
    
    if [ "$should_exist" = "true" ]; then
        if [ -f "$file_path" ]; then
            test_pass "$description (File exists)"
            return 0
        else
            test_fail "$description (File missing)" "continue"
            return 1
        fi
    else
        if [ ! -f "$file_path" ]; then
            test_pass "$description (File removed)"
            return 0
        else
            test_fail "$description (File still exists)" "continue"
            return 1
        fi
    fi
}

# Script execution helper
check_script_execution() {
    local script_path=$1
    local description=$2
    local timeout=${3:-30}
    
    if timeout "$timeout" bash "$script_path" > /dev/null 2>&1; then
        test_pass "$description (Script executed successfully)"
        return 0
    else
        test_warn "$description (Script execution issues - may be expected in test environment)"
        return 1
    fi
}

# Main validation function
main() {
    echo "=============================================="
    echo -e "${BLUE}RR-106: Freshness API Removal Validation${NC}"
    echo "=============================================="
    echo "Starting validation at $(date)"
    echo "Log file: $LOG_FILE"
    echo ""
    
    log "=== RR-106 Validation Started ==="
    
    # Phase 1: Pre-Removal Baseline (if freshness still exists)
    echo -e "${BLUE}=== Phase 1: Baseline Validation ===${NC}"
    
    test_start "Verify application is accessible"
    if curl -s "$BASE_URL" > /dev/null 2>&1; then
        test_pass "Main application accessible"
    else
        test_warn "Main application not accessible (may be expected in test environment)"
    fi
    
    test_start "Check remaining health endpoints"
    check_endpoint "$BASE_URL/api/health/app" "200" "App health endpoint"
    check_endpoint "$BASE_URL/api/health/db" "200" "Database health endpoint" 
    check_endpoint "$BASE_URL/api/health/cron" "200" "Cron health endpoint"
    
    test_start "Check sync server endpoint"
    if curl -s "$SYNC_SERVER_URL/server/health" > /dev/null 2>&1; then
        test_pass "Sync server endpoint accessible"
    else
        test_warn "Sync server not accessible (may not be running)"
    fi
    
    # Phase 2: Freshness API Removal Validation
    echo -e "${BLUE}=== Phase 2: Freshness API Status ===${NC}"
    
    test_start "Check freshness API route file"
    check_file_exists "$PROJECT_ROOT/src/app/api/health/freshness/route.ts" "false" "Freshness API route file removal"
    
    test_start "Verify freshness endpoint returns 404"
    check_endpoint "$BASE_URL/api/health/freshness" "404" "Freshness endpoint removal"
    
    # Phase 3: Test File Cleanup Validation
    echo -e "${BLUE}=== Phase 3: Test File Cleanup ===${NC}"
    
    test_start "Check freshness unit test removal"
    check_file_exists "$PROJECT_ROOT/src/__tests__/unit/health-endpoints/freshness.test.ts" "false" "Freshness unit test removal"
    
    test_start "Verify integration tests updated"
    local integration_files=(
        "src/__tests__/integration/health-endpoints.test.ts"
        "src/__tests__/integration/rr-119-acceptance.test.ts" 
        "src/__tests__/integration/rr-121-test-server-integration.test.ts"
        "src/__tests__/acceptance/rr-121-acceptance-criteria.test.ts"
        "src/__tests__/integration/rr-71-api-routes.test.ts"
    )
    
    for file in "${integration_files[@]}"; do
        if [ -f "$PROJECT_ROOT/$file" ]; then
            if grep -q "freshness" "$PROJECT_ROOT/$file" 2>/dev/null; then
                test_warn "File $file still contains freshness references"
            else
                test_pass "File $file cleaned of freshness references"
            fi
        else
            test_warn "Integration test file $file not found"
        fi
    done
    
    # Phase 4: Monitoring Script Validation
    echo -e "${BLUE}=== Phase 4: Monitoring Script Updates ===${NC}"
    
    test_start "Check monitor dashboard script"
    if [ -f "$PROJECT_ROOT/scripts/monitor-dashboard.sh" ]; then
        if grep -q "check_article_freshness" "$PROJECT_ROOT/scripts/monitor-dashboard.sh" 2>/dev/null; then
            test_warn "Monitor dashboard still contains freshness check function"
        else
            test_pass "Monitor dashboard cleaned of freshness checks"
        fi
        
        check_script_execution "$PROJECT_ROOT/scripts/monitor-dashboard.sh" "Monitor dashboard execution" 10
    else
        test_fail "Monitor dashboard script not found" "continue"
    fi
    
    test_start "Check sync health monitor script"  
    if [ -f "$PROJECT_ROOT/scripts/sync-health-monitor.sh" ]; then
        if grep -q "freshness" "$PROJECT_ROOT/scripts/sync-health-monitor.sh" 2>/dev/null; then
            test_warn "Sync health monitor still contains freshness references"
        else
            test_pass "Sync health monitor cleaned of freshness references"
        fi
    else
        test_warn "Sync health monitor script not found"
    fi
    
    test_start "Check Uptime Kuma monitor configuration"
    if [ -f "$PROJECT_ROOT/scripts/setup-sync-monitors.js" ]; then
        if grep -q "Article Freshness" "$PROJECT_ROOT/scripts/setup-sync-monitors.js" 2>/dev/null; then
            test_warn "Uptime Kuma setup still includes freshness monitor"
        else
            test_pass "Uptime Kuma setup cleaned of freshness monitor"
        fi
    else
        test_fail "Uptime Kuma setup script not found" "continue"
    fi
    
    test_start "Check build validation script"
    if [ -f "$PROJECT_ROOT/scripts/validate-build.sh" ]; then
        check_script_execution "$PROJECT_ROOT/scripts/validate-build.sh --mode quick" "Build validation execution" 60
    else
        test_warn "Build validation script not found"
    fi
    
    # Phase 5: Database Function Analysis
    echo -e "${BLUE}=== Phase 5: Database Function Status ===${NC}"
    
    test_start "Check database migration file"
    check_file_exists "$PROJECT_ROOT/src/lib/db/migrations/009_add_article_count_functions.sql" "true" "Database functions migration file exists"
    
    if [ -f "$PROJECT_ROOT/src/lib/db/migrations/009_add_article_count_functions.sql" ]; then
        if grep -q "count_articles_since\|count_all_articles" "$PROJECT_ROOT/src/lib/db/migrations/009_add_article_count_functions.sql" 2>/dev/null; then
            test_pass "Database functions still defined in migration"
        else
            test_warn "Database functions not found in migration file"
        fi
    fi
    
    # Phase 6: Test Suite Execution
    echo -e "${BLUE}=== Phase 6: Test Suite Validation ===${NC}"
    
    test_start "Run unit tests"
    if cd "$PROJECT_ROOT" && timeout 120 npm run test:unit > /dev/null 2>&1; then
        test_pass "Unit tests pass"
    else
        test_warn "Unit tests failed or timed out (may be expected during removal process)"
    fi
    
    test_start "Run integration tests"
    if cd "$PROJECT_ROOT" && timeout 180 npm run test:integration > /dev/null 2>&1; then
        test_pass "Integration tests pass"
    else
        test_warn "Integration tests failed or timed out (may be expected during removal process)"
    fi
    
    test_start "Check TypeScript compilation"
    if cd "$PROJECT_ROOT" && npm run type-check > /dev/null 2>&1; then
        test_pass "TypeScript compilation successful"
    else
        test_fail "TypeScript compilation failed" "continue"
    fi
    
    # Phase 7: System Health Validation
    echo -e "${BLUE}=== Phase 7: System Health Check ===${NC}"
    
    test_start "PM2 services status"
    if command -v pm2 > /dev/null 2>&1; then
        local pm2_status
        pm2_status=$(pm2 jlist 2>/dev/null | jq -r '.[] | select(.name | test("rss-reader")) | .pm2_env.status' 2>/dev/null || echo "unknown")
        
        if [ "$pm2_status" = "online" ]; then
            test_pass "PM2 RSS Reader service online"
        else
            test_warn "PM2 RSS Reader service status: $pm2_status"
        fi
    else
        test_warn "PM2 not available (may not be installed in test environment)"
    fi
    
    test_start "Service logs check"
    if [ -d "$PROJECT_ROOT/logs" ]; then
        local recent_errors
        recent_errors=$(find "$PROJECT_ROOT/logs" -name "*.log" -o -name "*.jsonl" -mtime -1 2>/dev/null | wc -l)
        
        if [ "$recent_errors" -gt 0 ]; then
            test_pass "Recent log files found ($recent_errors files)"
        else
            test_warn "No recent log files found"
        fi
    else
        test_warn "Logs directory not found"
    fi
    
    # Phase 8: Regression Testing
    echo -e "${BLUE}=== Phase 8: Regression Testing ===${NC}"
    
    test_start "Verify sync endpoint accessibility"
    local sync_response
    sync_response=$(curl -s -w "HTTPSTATUS:%{http_code}" "$BASE_URL/api/sync" 2>/dev/null || echo "HTTPSTATUS:000")
    local sync_status
    sync_status=$(echo "$sync_response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    
    if [ "$sync_status" = "405" ] || [ "$sync_status" = "200" ]; then
        test_pass "Sync endpoint accessible (Status: $sync_status)"
    else
        test_warn "Sync endpoint status: $sync_status (may be expected)"
    fi
    
    test_start "Check for freshness references in codebase"
    local freshness_refs
    freshness_refs=$(grep -r "freshness" "$PROJECT_ROOT/src" 2>/dev/null | grep -v "__tests__" | wc -l)
    
    if [ "$freshness_refs" -eq 0 ]; then
        test_pass "No freshness references in source code"
    else
        test_warn "Found $freshness_refs freshness references in source code"
    fi
    
    # Final Summary
    echo ""
    echo "=============================================="
    echo -e "${BLUE}Validation Summary${NC}"
    echo "=============================================="
    echo -e "Total Tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    echo -e "${YELLOW}Warnings: $WARNINGS${NC}"
    echo ""
    
    local success_rate
    if [ "$TOTAL_TESTS" -gt 0 ]; then
        success_rate=$(( (PASSED_TESTS * 100) / TOTAL_TESTS ))
        echo -e "Success Rate: ${success_rate}%"
    fi
    
    log "=== Validation Summary: $PASSED_TESTS/$TOTAL_TESTS passed, $WARNINGS warnings ==="
    
    # Exit code based on results
    if [ "$FAILED_TESTS" -eq 0 ]; then
        echo -e "${GREEN}✅ All critical validations passed!${NC}"
        if [ "$WARNINGS" -gt 0 ]; then
            echo -e "${YELLOW}⚠️  $WARNINGS warnings detected - review recommended${NC}"
            exit 1
        fi
        exit 0
    else
        echo -e "${RED}❌ $FAILED_TESTS critical failures detected${NC}"
        echo -e "${RED}Review failures and fix issues before proceeding${NC}"
        exit 2
    fi
}

# Help function
show_help() {
    echo "RR-106: Freshness API Removal Validation Script"
    echo ""
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --help          Show this help message"
    echo "  --log-file PATH Set custom log file path"
    echo "  --base-url URL  Set custom base URL for testing"
    echo ""
    echo "This script validates the complete removal of the freshness API"
    echo "and ensures system integrity after the removal process."
}

# Parse command line arguments
while [ $# -gt 0 ]; do
    case $1 in
        --help)
            show_help
            exit 0
            ;;
        --log-file)
            LOG_FILE="$2"
            shift 2
            ;;
        --base-url)
            BASE_URL="$2"
            shift 2
            ;;
        *)
            echo "Unknown option: $1"
            show_help
            exit 1
            ;;
    esac
done

# Change to project directory
cd "$PROJECT_ROOT" || {
    echo -e "${RED}Error: Cannot access project directory: $PROJECT_ROOT${NC}"
    exit 1
}

# Run main validation
main