#!/bin/bash

# Test script for RR-69: Remove Test Pages & Debug Endpoints
# This script runs all security tests to verify test endpoints are removed

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== RR-69 Security Test Suite ===${NC}"
echo "Testing removal of test pages and debug endpoints"
echo ""

# Function to run tests and check results
run_test_suite() {
    local test_name="$1"
    local test_command="$2"
    
    echo -e "${YELLOW}Running ${test_name}...${NC}"
    
    if eval "$test_command"; then
        echo -e "${GREEN}✓ ${test_name} passed${NC}"
        return 0
    else
        echo -e "${RED}✗ ${test_name} failed${NC}"
        return 1
    fi
}

# Track failures
FAILED_TESTS=0

# 1. Run unit tests for script validation
if run_test_suite "Script Validation Tests" "npm run test -- src/__tests__/scripts/validate-build.test.ts"; then
    echo "Build validation script checks passed"
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""

# 2. Run codebase security scan
if run_test_suite "Codebase Security Scan" "npm run test -- src/__tests__/security/codebase-scan.test.ts"; then
    echo "No test endpoint references found in codebase"
else
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""

# 3. Run integration tests (skip if no server running)
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/health/app | grep -q "200"; then
    if run_test_suite "Health Endpoint Integration Tests" "npm run test -- src/__tests__/integration/health-endpoints.test.ts"; then
        echo "Health endpoints working correctly"
    else
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
else
    echo -e "${YELLOW}Skipping integration tests (development server not running)${NC}"
fi

echo ""

# 4. Run E2E security tests with Playwright
echo -e "${BLUE}Running E2E Security Tests...${NC}"

# Check if production server is accessible
PROD_URL="http://100.96.166.53:3000/reader"
if curl -s -o /dev/null -w "%{http_code}" "$PROD_URL" | grep -q "200"; then
    echo "Production server accessible, running E2E tests..."
    
    if SKIP_SERVER=true npx playwright test --config=playwright.config.rr69.ts --project=production-security; then
        echo -e "${GREEN}✓ E2E Security tests passed${NC}"
    else
        echo -e "${RED}✗ E2E Security tests failed${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
    fi
else
    echo -e "${RED}Production server not accessible at $PROD_URL${NC}"
    echo -e "${YELLOW}Please ensure production server is running for full security validation${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
fi

echo ""

# 5. Manual verification checklist
echo -e "${BLUE}Manual Verification Checklist:${NC}"
echo "□ Verify no test-* files exist in src/app/"
echo "□ Verify no test-* or debug/ files exist in src/app/api/"
echo "□ Check that production build completes without errors"
echo "□ Verify service worker doesn't cache test endpoints"
echo "□ Confirm validate-build.sh uses production health endpoints"

echo ""

# Summary
if [[ $FAILED_TESTS -eq 0 ]]; then
    echo -e "${GREEN}=== All RR-69 Security Tests Passed ===${NC}"
    echo "Test endpoints have been successfully removed."
    exit 0
else
    echo -e "${RED}=== ${FAILED_TESTS} Test Suite(s) Failed ===${NC}"
    echo "Please fix the failing tests before deployment."
    exit 1
fi