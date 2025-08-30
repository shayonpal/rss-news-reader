#!/bin/bash

# Validation test script for RR-124: Update monitoring scripts after Freshness API removal
# This script validates that all freshness API references have been properly removed

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_PASSED=0
TESTS_FAILED=0

# Function to log test results
log_test() {
    local test_name=$1
    local result=$2
    local message=$3
    
    if [ "$result" = "pass" ]; then
        echo -e "${GREEN}✅ ${test_name}: PASSED${NC}"
        [ -n "$message" ] && echo "   $message"
        TESTS_PASSED=$((TESTS_PASSED + 1))
    else
        echo -e "${RED}❌ ${test_name}: FAILED${NC}"
        [ -n "$message" ] && echo "   $message"
        TESTS_FAILED=$((TESTS_FAILED + 1))
    fi
}

echo "========================================="
echo "RR-124 Validation Tests"
echo "========================================="
echo ""

# Test 1: Check for freshness API references in code
echo "Test 1: Freshness API References Removed"
echo "-----------------------------------------"

# Search for any remaining freshness references in production code only
# Excluding test files, test scripts, and documentation
FRESHNESS_REFS=$(grep -r "FRESHNESS_URL\|/api/health/freshness" \
    --include="*.sh" \
    --include="*.js" \
    --include="*.ts" \
    --include="*.tsx" \
    --exclude-dir=node_modules \
    --exclude-dir=.next \
    --exclude-dir=dist \
    --exclude-dir=build \
    --exclude-dir=logs \
    --exclude-dir=src/__tests__ \
    --exclude-dir=docs \
    --exclude="test-*.sh" \
    --exclude="test-*.js" \
    --exclude="verify-*.sh" \
    --exclude="*test*.ts" \
    --exclude="*test*.tsx" \
    --exclude="*spec*.ts" \
    /Users/shayon/DevProjects/rss-news-reader/src 2>/dev/null || true)

# Also check scripts directory separately (excluding test scripts)
SCRIPT_REFS=$(grep -r "FRESHNESS_URL\|/api/health/freshness" \
    --include="*.sh" \
    --exclude="test-*.sh" \
    --exclude="verify-*.sh" \
    /Users/shayon/DevProjects/rss-news-reader/scripts 2>/dev/null | grep -v "^[[:space:]]*#" || true)

if [ -z "$FRESHNESS_REFS" ] && [ -z "$SCRIPT_REFS" ]; then
    log_test "No freshness API references in production code" "pass"
else
    ALL_REFS="$FRESHNESS_REFS$SCRIPT_REFS"
    log_test "No freshness API references in production code" "fail" "Found references:\n$ALL_REFS"
fi

# Test 2: Check timezone display implementation
echo ""
echo "Test 2: Timezone Display Fixed"
echo "-------------------------------"

# Check if formatDistanceToNow is imported and used
TIMEZONE_FIX=$(grep -l "formatDistanceToNow" /Users/shayon/DevProjects/rss-news-reader/src/components/feeds/simple-feed-sidebar.tsx 2>/dev/null || echo "")

if [ -n "$TIMEZONE_FIX" ]; then
    log_test "Timezone display uses relative time" "pass"
else
    log_test "Timezone display uses relative time" "fail" "formatDistanceToNow not found in simple-feed-sidebar.tsx"
fi

# Test 3: Check auto-refresh implementation
echo ""
echo "Test 3: Fetch Stats Auto-Refresh"
echo "---------------------------------"

# Check if auto-refresh state exists
AUTO_REFRESH=$(grep -l "autoRefresh\|setAutoRefresh" /Users/shayon/DevProjects/rss-news-reader/src/app/fetch-stats/page.tsx 2>/dev/null || echo "")

if [ -n "$AUTO_REFRESH" ]; then
    log_test "Auto-refresh implemented" "pass"
else
    log_test "Auto-refresh implemented" "fail" "autoRefresh state not found in fetch-stats page"
fi

# Test 4: Check monitoring scripts cleanup
echo ""
echo "Test 4: Monitoring Scripts Cleanup"
echo "-----------------------------------"

# Check if FRESHNESS_URL is removed from ecosystem.config.js
ECOSYSTEM_FRESHNESS=$(grep "FRESHNESS_URL" /Users/shayon/DevProjects/rss-news-reader/ecosystem.config.js 2>/dev/null || echo "")

if [ -z "$ECOSYSTEM_FRESHNESS" ]; then
    log_test "ecosystem.config.js cleaned" "pass"
else
    log_test "ecosystem.config.js cleaned" "fail" "FRESHNESS_URL still present"
fi

# Test 5: Check sync thresholds updated
echo ""
echo "Test 5: Sync Thresholds Updated"
echo "--------------------------------"

# Check if thresholds are set to 4 hours
THRESHOLD_CHECK=$(grep "SYNC_SUCCESS_HOURS=4" /Users/shayon/DevProjects/rss-news-reader/scripts/sync-health-monitor.sh 2>/dev/null || echo "")

if [ -n "$THRESHOLD_CHECK" ]; then
    log_test "Sync thresholds updated to 4 hours" "pass"
else
    log_test "Sync thresholds updated to 4 hours" "fail" "Threshold not set to 4 hours"
fi

# Test 6: Check Kuma integration script
echo ""
echo "Test 6: Kuma Integration Script"
echo "--------------------------------"

if [ -f "/Users/shayon/DevProjects/rss-news-reader/scripts/push-to-kuma.sh" ]; then
    # Check if script uses correct status values
    KUMA_STATUS=$(grep 'status=up\|status=down\|kuma_status="up"\|kuma_status="down"' /Users/shayon/DevProjects/rss-news-reader/scripts/push-to-kuma.sh || echo "")
    if [ -n "$KUMA_STATUS" ]; then
        log_test "Kuma script uses correct status values" "pass" "Uses 'up'/'down' strings"
    else
        log_test "Kuma script uses correct status values" "fail" "Should use 'up'/'down' not numeric"
    fi
else
    log_test "Kuma integration script exists" "fail" "Script not found"
fi

# Test 7: Check last sync API endpoint
echo ""
echo "Test 7: Last Sync API Endpoint"
echo "-------------------------------"

if [ -f "/Users/shayon/DevProjects/rss-news-reader/src/app/api/sync/last-sync/route.ts" ]; then
    # Test if endpoint is accessible
    SYNC_API_RESPONSE=$(curl -s http://localhost:3000/reader/api/sync/last-sync 2>/dev/null || echo "")
    if echo "$SYNC_API_RESPONSE" | grep -q "lastSyncTime\|source"; then
        log_test "Last sync API endpoint works" "pass" "Returns sync time and source"
    else
        log_test "Last sync API endpoint works" "fail" "Endpoint not returning expected data"
    fi
else
    log_test "Last sync API endpoint exists" "fail" "route.ts not found"
fi

# Test 8: Check sync store loads last sync time
echo ""
echo "Test 8: Sync Store Initialization"
echo "----------------------------------"

LOAD_SYNC_TIME=$(grep "loadLastSyncTime" /Users/shayon/DevProjects/rss-news-reader/src/lib/stores/sync-store.ts 2>/dev/null || echo "")
if [ -n "$LOAD_SYNC_TIME" ]; then
    log_test "Sync store has loadLastSyncTime method" "pass"
else
    log_test "Sync store has loadLastSyncTime method" "fail" "Method not found"
fi

# Test 9: Check sidebar calls loadLastSyncTime on mount
echo ""
echo "Test 9: Sidebar Initialization"
echo "-------------------------------"

SIDEBAR_LOAD=$(grep "loadLastSyncTime()" /Users/shayon/DevProjects/rss-news-reader/src/components/feeds/simple-feed-sidebar.tsx 2>/dev/null || echo "")
if [ -n "$SIDEBAR_LOAD" ]; then
    log_test "Sidebar loads last sync on mount" "pass"
else
    log_test "Sidebar loads last sync on mount" "fail" "loadLastSyncTime() call not found"
fi

# Test 10: Type checking
echo ""
echo "Test 10: TypeScript Type Check"
echo "-------------------------------"

cd /Users/shayon/DevProjects/rss-news-reader
npm run type-check > /tmp/typecheck-output.txt 2>&1

if [ $? -eq 0 ]; then
    log_test "TypeScript type check" "pass"
else
    log_test "TypeScript type check" "fail" "Type errors found - check /tmp/typecheck-output.txt"
fi

# Test 11: Linting
echo ""
echo "Test 11: ESLint Check"
echo "---------------------"

npm run lint > /tmp/lint-output.txt 2>&1

if [ $? -eq 0 ]; then
    log_test "ESLint check" "pass"
else
    log_test "ESLint check" "fail" "Lint errors found - check /tmp/lint-output.txt"
fi

# Test 12: Build validation
echo ""
echo "Test 12: Build Validation"
echo "-------------------------"

# Quick build test (not full build)
npm run build --dry-run > /tmp/build-check.txt 2>&1

if [ $? -eq 0 ]; then
    log_test "Build configuration valid" "pass"
else
    log_test "Build configuration valid" "fail" "Build configuration issues - check /tmp/build-check.txt"
fi

# Summary
echo ""
echo "========================================="
echo "Test Summary"
echo "========================================="
echo -e "${GREEN}Passed: $TESTS_PASSED${NC}"
echo -e "${RED}Failed: $TESTS_FAILED${NC}"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed! RR-124 implementation is complete.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed. Please review and fix the issues.${NC}"
    exit 1
fi