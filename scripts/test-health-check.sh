#!/bin/bash

# Simple test health check - find what's actually broken
# For RR-246: Pragmatic test management for a 2-5 user app

set -euo pipefail

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "======================================"
echo "Test Suite Health Check"
echo "======================================"
echo ""

# Count test files (excluding archives)
TOTAL_TEST_FILES=$(ls -R src/__tests__ 2>/dev/null | grep "\.ts$" | wc -l | xargs)
ARCHIVED_FILES=$(ls -R tests/archive 2>/dev/null | grep "\.ts$" | wc -l | xargs)

echo "📊 Test File Count:"
echo "  Active tests: $TOTAL_TEST_FILES files"
echo "  Archived: $ARCHIVED_FILES files (not executed)"
echo ""

# Quick test run with timeout
echo "🏃 Running quick test check (30s timeout)..."
echo ""

# Run tests and capture results
if timeout 30 npm run test:unit -- --run --reporter=verbose 2>&1 | tee /tmp/test-results.log | grep -E "✓|×|Test Files" | tail -20; then
    TEST_EXIT_CODE=0
else
    TEST_EXIT_CODE=$?
fi

echo ""
echo "======================================"
echo "📋 Summary"
echo "======================================"

# Parse results
if [ -f /tmp/test-results.log ]; then
    PASSED=$(grep -c "✓" /tmp/test-results.log 2>/dev/null || echo "0")
    FAILED=$(grep -c "×" /tmp/test-results.log 2>/dev/null || echo "0")
    
    echo -e "${GREEN}✓ Passed:${NC} $PASSED tests"
    echo -e "${RED}× Failed:${NC} $FAILED tests"
    
    if [ "$FAILED" -gt 0 ]; then
        echo ""
        echo "Failed tests:"
        grep "×" /tmp/test-results.log | head -10
    fi
    
    # Check for timeout
    if grep -q "Test Files" /tmp/test-results.log; then
        echo -e "\n${GREEN}✓ Tests completed within timeout${NC}"
    else
        echo -e "\n${YELLOW}⚠ Tests didn't complete in 30s (might be hanging)${NC}"
    fi
fi

echo ""
echo "======================================"
echo "💡 Recommendations"
echo "======================================"

if [ "$FAILED" -gt 20 ]; then
    echo "• Many tests failing - consider fixing or removing broken tests"
    echo "• Run: grep '×' /tmp/test-results.log to see all failures"
elif [ "$FAILED" -gt 0 ]; then
    echo "• A few tests failing - fix or remove these specific tests"
fi

if [ "$TOTAL_TEST_FILES" -gt 200 ]; then
    echo "• Consider consolidating similar tests (currently $TOTAL_TEST_FILES files)"
fi

echo "• To run only unit tests: npm run test:unit"
echo "• To run with watch: npm run test:watch"
echo ""

# Cleanup
rm -f /tmp/test-results.log

exit $TEST_EXIT_CODE