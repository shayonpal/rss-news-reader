#!/bin/bash

# RR-5: Sync Status Display - Test Execution Script
# This script runs all tests for the RR-5 feature

set -e # Exit on error

echo "================================================"
echo "RR-5: Sync Status Display - Test Suite"
echo "================================================"
echo ""
echo "This script will run all 73 tests defined for RR-5:"
echo "- 28 Unit tests"
echo "- 12 Integration tests" 
echo "- 20 Component tests"
echo "- 13 E2E tests"
echo ""
echo "Starting test execution..."
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test result counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test suite
run_test_suite() {
    local TEST_NAME=$1
    local TEST_COMMAND=$2
    local EXPECTED_COUNT=$3
    
    echo "--------------------------------------------"
    echo "Running: $TEST_NAME"
    echo "Expected: $EXPECTED_COUNT tests"
    echo "--------------------------------------------"
    
    if eval "$TEST_COMMAND"; then
        echo -e "${GREEN}✓ $TEST_NAME passed${NC}"
        PASSED_TESTS=$((PASSED_TESTS + EXPECTED_COUNT))
    else
        echo -e "${RED}✗ $TEST_NAME failed${NC}"
        FAILED_TESTS=$((FAILED_TESTS + EXPECTED_COUNT))
    fi
    
    TOTAL_TESTS=$((TOTAL_TESTS + EXPECTED_COUNT))
    echo ""
}

# 1. Run Unit Tests (28 tests)
run_test_suite \
    "Unit Tests" \
    "npx vitest run --no-coverage src/__tests__/unit/rr-5-sync-status-display.test.ts" \
    28

# 2. Run Integration Tests (12 tests)
run_test_suite \
    "Integration Tests" \
    "NODE_ENV=test npx vitest run --config vitest.integration.config.ts src/__tests__/integration/rr-5-sync-status-integration.test.ts" \
    12

# 3. Run Component Tests (20 tests)
run_test_suite \
    "Component Tests" \
    "npx vitest run --no-coverage src/__tests__/components/rr-5-sidebar-display.test.tsx" \
    20

# 4. Run E2E Tests (13 tests)
# Check if server is running
if curl -s http://localhost:3000/reader/api/health/app > /dev/null 2>&1; then
    echo -e "${GREEN}Server is running, proceeding with E2E tests${NC}"
    run_test_suite \
        "E2E Tests" \
        "npx playwright test src/__tests__/e2e/rr-5-sync-status-e2e.spec.ts --reporter=list" \
        13
else
    echo -e "${YELLOW}⚠ Server not running, skipping E2E tests${NC}"
    echo "Start the server with: pm2 restart rss-reader-dev"
    echo ""
    TOTAL_TESTS=$((TOTAL_TESTS + 13))
    FAILED_TESTS=$((FAILED_TESTS + 13))
fi

# Summary Report
echo "================================================"
echo "                TEST SUMMARY                   "
echo "================================================"
echo ""
echo "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

# Calculate success rate
if [ $TOTAL_TESTS -gt 0 ]; then
    SUCCESS_RATE=$((PASSED_TESTS * 100 / TOTAL_TESTS))
    echo "Success Rate: $SUCCESS_RATE%"
    echo ""
    
    if [ $SUCCESS_RATE -eq 100 ]; then
        echo -e "${GREEN}✨ All tests passed! RR-5 is ready for implementation.${NC}"
        exit 0
    elif [ $SUCCESS_RATE -ge 80 ]; then
        echo -e "${YELLOW}⚠ Most tests passed, but some failures need attention.${NC}"
        exit 1
    else
        echo -e "${RED}❌ Significant test failures. Implementation needs work.${NC}"
        exit 1
    fi
else
    echo -e "${RED}❌ No tests were run.${NC}"
    exit 1
fi