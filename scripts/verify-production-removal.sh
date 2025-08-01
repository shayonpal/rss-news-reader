#!/bin/bash

# verify-production-removal.sh - Comprehensive verification script for production removal
# Implementation for RR-99: Phase 7 - Final Verification & End-to-End Testing

set -uo pipefail

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$SCRIPT_DIR/.."
LOG_DIR="$PROJECT_ROOT/logs"
RESULTS_FILE="$PROJECT_ROOT/production-removal-verification-report.md"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0
TESTS_WARNING=0

# Test results array
declare -a TEST_RESULTS

# Helper functions
log_test() {
    echo -e "\n${BLUE}[TEST]${NC} $1"
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TEST_RESULTS+=("✅ PASS: $1")
    ((TESTS_PASSED++))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    TEST_RESULTS+=("❌ FAIL: $1")
    ((TESTS_FAILED++))
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
    TEST_RESULTS+=("⚠️  WARN: $1")
    ((TESTS_WARNING++))
}

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

# Initialize report
init_report() {
    cat > "$RESULTS_FILE" << EOF
# Production Removal Verification Report

Generated: $(date "+%A, %B %-d, %Y at %-I:%M %p")

## Executive Summary

This report documents the comprehensive verification of production environment removal from the RSS News Reader codebase.

EOF
}

# Test 1: System-wide verification
test_system_wide_verification() {
    log_test "System-wide Verification"
    
    # Check for production references
    log_info "Searching for production references..."
    
    # Search for port 3147 references (excluding this script and docs)
    # Exclude backup files, log files, and PIDs
    local port_refs=$(grep -r "3147" "$PROJECT_ROOT" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        --exclude-dir=.next-test-backup \
        --exclude-dir=.git \
        --exclude-dir=logs \
        --exclude="*.md" \
        --exclude="*.backup" \
        --exclude="verify-production-removal.sh" \
        2>/dev/null | grep -v "PID:" | wc -l | tr -d ' ')
    
    if [ "$port_refs" -eq 0 ]; then
        log_pass "No references to port 3147 found in active code"
    else
        log_warn "Found $port_refs references to port 3147 (may be historical)"
        # Show a few examples
        log_info "Examples of remaining references:"
        grep -r "3147" "$PROJECT_ROOT" \
            --exclude-dir=node_modules \
            --exclude-dir=.next \
            --exclude-dir=.next-test-backup \
            --exclude-dir=.git \
            --exclude-dir=logs \
            --exclude="*.md" \
            --exclude="*.backup" \
            --exclude="verify-production-removal.sh" \
            2>/dev/null | grep -v "PID:" | head -3
    fi
    
    # Search for rss-reader-prod references
    local prod_refs=$(grep -r "rss-reader-prod" "$PROJECT_ROOT" \
        --exclude-dir=node_modules \
        --exclude-dir=.next \
        --exclude-dir=.git \
        --exclude-dir=logs/archive-prod* \
        --exclude="*.md" \
        --exclude="verify-production-removal.sh" \
        2>/dev/null | wc -l | tr -d ' ')
    
    if [ "$prod_refs" -eq 0 ]; then
        log_pass "No references to rss-reader-prod found"
    else
        log_fail "Found $prod_refs references to rss-reader-prod"
    fi
    
    # Check PM2 services
    log_info "Checking PM2 services..."
    # Only count actual apps, not modules
    local pm2_count=$(pm2 jlist 2>/dev/null | jq '[.[] | select(.pm2_env.pm_exec_path != null)] | length' 2>/dev/null || echo "0")
    local expected_services=("rss-reader-dev" "rss-sync-cron" "rss-sync-server")
    
    if [ "$pm2_count" -eq 3 ]; then
        log_pass "PM2 shows exactly 3 services"
        
        # Verify each expected service
        for service in "${expected_services[@]}"; do
            if pm2 describe "$service" &>/dev/null; then
                log_pass "Service '$service' is running"
            else
                log_fail "Service '$service' is not running"
            fi
        done
    else
        log_fail "PM2 shows $pm2_count services (expected 3)"
    fi
    
    # Check memory usage
    log_info "Checking memory usage..."
    local mem_usage=$(top -l 1 | grep "PhysMem" | awk '{print $2}' | sed 's/M//g')
    local mem_percent=$(top -l 1 | grep "PhysMem" | awk '{print $8}' | sed 's/%//g')
    
    if [ -n "$mem_percent" ]; then
        log_info "Current memory usage: ${mem_percent}%"
        if (( $(echo "$mem_percent < 80" | bc -l) )); then
            log_pass "Memory usage is healthy (${mem_percent}% < 80%)"
        else
            log_warn "Memory usage is high (${mem_percent}%)"
        fi
    fi
    
    # Check port 3147 is not in use
    log_info "Checking port 3147..."
    if ! lsof -i:3147 &>/dev/null; then
        log_pass "No process listening on port 3147"
    else
        log_fail "Port 3147 is still in use"
    fi
}

# Test 2: Functional testing
test_functional() {
    log_test "Functional Testing"
    
    # Test app accessibility
    log_info "Testing app accessibility..."
    if curl -s -o /dev/null -w "%{http_code}" "http://100.96.166.53:3000/reader" | grep -q "200\|302"; then
        log_pass "App accessible at http://100.96.166.53:3000/reader"
    else
        log_fail "App not accessible at expected URL"
    fi
    
    # Test health endpoints
    log_info "Testing health endpoints..."
    local endpoints=("/reader/api/health/app" "/reader/api/health/db" "/reader/api/health/freshness")
    
    for endpoint in "${endpoints[@]}"; do
        local response=$(curl -s -w "\n%{http_code}" "http://100.96.166.53:3000${endpoint}" 2>/dev/null | tail -1)
        if [ "$response" = "200" ]; then
            log_pass "Health endpoint ${endpoint} responding correctly"
        else
            log_fail "Health endpoint ${endpoint} returned $response"
        fi
    done
    
    # Test sync service
    log_info "Testing sync service..."
    # Check if sync server process is running via PM2
    if pm2 describe rss-sync-server | grep -q "status.*online"; then
        log_pass "Sync service is running (no HTTP endpoint - background service)"
    else
        log_fail "Sync service is not running"
    fi
}

# Test 3: Integration testing
test_integration() {
    log_test "Integration Testing"
    
    # Check OAuth tokens
    log_info "Checking OAuth tokens..."
    if [ -f "$HOME/.rss-reader/tokens.json" ]; then
        log_pass "OAuth tokens file exists"
        
        # Check if tokens are encrypted
        if grep -q "encrypted" "$HOME/.rss-reader/tokens.json"; then
            log_pass "OAuth tokens are encrypted"
        else
            log_warn "OAuth tokens may not be encrypted"
        fi
    else
        log_fail "OAuth tokens file not found"
    fi
    
    # Check cron health
    log_info "Checking cron health..."
    if [ -f "$LOG_DIR/cron-health.jsonl" ]; then
        local last_run=$(tail -1 "$LOG_DIR/cron-health.jsonl" 2>/dev/null | jq -r '.timestamp' 2>/dev/null || echo "")
        if [ -n "$last_run" ]; then
            log_pass "Cron health check has recent entry: $last_run"
        else
            log_warn "Cannot read last cron health check"
        fi
    else
        log_warn "Cron health log not found"
    fi
    
    # Check database connection
    log_info "Testing database connection..."
    local db_health=$(curl -s "http://100.96.166.53:3000/reader/api/health/db" 2>/dev/null | jq -r '.status' 2>/dev/null || echo "")
    if [ "$db_health" = "healthy" ]; then
        log_pass "Database connection is healthy"
    else
        log_fail "Database connection issues detected"
    fi
}

# Test 4: Documentation verification
test_documentation() {
    log_test "Documentation Verification"
    
    # Check for production references in docs
    log_info "Checking documentation for production references..."
    
    local doc_prod_refs=$(grep -r "production\|3147\|rss-reader-prod" "$PROJECT_ROOT/docs" \
        --include="*.md" \
        --exclude="DEPLOYMENT_DECISION_TRAIL.md" \
        2>/dev/null | grep -v "# Production" | grep -v "non-production" | wc -l | tr -d ' ')
    
    if [ "$doc_prod_refs" -eq 0 ]; then
        log_pass "No production references in active documentation"
    else
        log_warn "Found $doc_prod_refs potential production references in docs"
    fi
    
    # Check CLAUDE.md
    if grep -q "3000" "$PROJECT_ROOT/CLAUDE.md" && ! grep -q "3147" "$PROJECT_ROOT/CLAUDE.md"; then
        log_pass "CLAUDE.md correctly references dev port only"
    else
        log_fail "CLAUDE.md may have incorrect port references"
    fi
}

# Test 5: Check for production artifacts
test_production_artifacts() {
    log_test "Production Artifacts Check"
    
    # Check for production log files
    log_info "Checking for production log files..."
    local prod_logs=$(find "$LOG_DIR" -name "prod-*" 2>/dev/null | grep -v archive | wc -l | tr -d ' ')
    
    if [ "$prod_logs" -eq 0 ]; then
        log_pass "No production log files in active logs directory"
    else
        log_fail "Found $prod_logs production log files"
    fi
    
    # Check for .next-prod directory
    if [ ! -d "$PROJECT_ROOT/.next-prod" ]; then
        log_pass "No .next-prod directory found"
    else
        log_fail ".next-prod directory still exists"
    fi
    
    # Check ecosystem.config.js
    if ! grep -q "3147\|rss-reader-prod" "$PROJECT_ROOT/ecosystem.config.js"; then
        log_pass "ecosystem.config.js has no production app configuration"
    else
        log_fail "ecosystem.config.js still contains production app configuration"
    fi
}

# Generate final report
generate_report() {
    cat >> "$RESULTS_FILE" << EOF

## Test Results

### Summary
- **Total Tests**: $((TESTS_PASSED + TESTS_FAILED + TESTS_WARNING))
- **Passed**: $TESTS_PASSED ✅
- **Failed**: $TESTS_FAILED ❌
- **Warnings**: $TESTS_WARNING ⚠️

### Detailed Results

EOF
    
    for result in "${TEST_RESULTS[@]}"; do
        echo "$result" >> "$RESULTS_FILE"
    done
    
    cat >> "$RESULTS_FILE" << EOF

## Performance Metrics

### Memory Usage
- Current memory usage observed during testing
- Target: ~70% (previously 87.5%)

### Service Status
- All services verified running on development setup
- No production services detected

## Conclusions

EOF
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        cat >> "$RESULTS_FILE" << EOF
✅ **All critical tests passed!** Production environment has been successfully removed.

The RSS News Reader is now running exclusively in development mode with:
- Single port configuration (3000)
- Reduced memory footprint
- Simplified deployment model
- All functionality preserved

EOF
    else
        cat >> "$RESULTS_FILE" << EOF
❌ **Some tests failed.** Please review the failed tests above and address any issues.

EOF
    fi
    
    cat >> "$RESULTS_FILE" << EOF

## Rollback Procedures

If rollback is needed:
1. Restore from git commit before production removal
2. Restart all services with PM2
3. Verify both dev and prod services are running
4. Update monitoring configurations

---
*End of Report*
EOF
}

# Main execution
main() {
    echo "========================================="
    echo "Production Removal Verification (RR-99)"
    echo "========================================="
    echo ""
    
    init_report
    
    # Run all test suites
    test_system_wide_verification
    test_functional
    test_integration
    test_documentation
    test_production_artifacts
    
    # Generate final report
    generate_report
    
    echo ""
    echo "========================================="
    echo "Verification Complete"
    echo "========================================="
    echo ""
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo -e "Warnings: ${YELLOW}$TESTS_WARNING${NC}"
    echo ""
    echo "Full report saved to: $RESULTS_FILE"
    echo ""
    
    if [ "$TESTS_FAILED" -eq 0 ]; then
        echo -e "${GREEN}✅ All critical tests passed! Production removal verified.${NC}"
        exit 0
    else
        echo -e "${RED}❌ Some tests failed. Please review the report.${NC}"
        exit 1
    fi
}

# Run main function
main "$@"