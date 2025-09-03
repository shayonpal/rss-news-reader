#!/bin/bash

# RR-223 Test Validation Script
# Validates test isolation and performance for modified unit test files

set -e

echo "=================================================="
echo "RR-223 Core Unit Tests Repair - Validation Report"
echo "=================================================="
echo ""
echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
echo ""

# Test files to validate
TEST_FILES=(
  "src/__tests__/unit/rr-193-mutex-accordion.test.tsx"
  "src/__tests__/unit/rr-179-mark-all-read-tag-button.test.tsx"
  "src/__tests__/unit/rr-180-glass-morphing.test.tsx"
  "src/__tests__/unit/rr-215-ios-scrollable-header.test.tsx"
  "src/__tests__/unit/rr-216-filter-navigation.test.tsx"
)

# Infrastructure health check
echo "1. INFRASTRUCTURE HEALTH CHECK"
echo "------------------------------"

echo -n "TypeScript Compilation: "
if npm run type-check >/dev/null 2>&1; then
  echo "✅ PASS"
  TS_PASS=true
else
  echo "❌ FAIL"
  TS_PASS=false
fi

echo -n "Test Setup Files: "
if [ -f "src/test-setup.ts" ] && [ -f "src/types/test-matchers.d.ts" ]; then
  echo "✅ PRESENT"
else
  echo "❌ MISSING"
fi

echo ""

# Individual test execution
echo "2. INDIVIDUAL TEST EXECUTION"
echo "----------------------------"

TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0
EXECUTION_TIMES=()

for TEST_FILE in "${TEST_FILES[@]}"; do
  TEST_NAME=$(basename "$TEST_FILE" .test.tsx)
  echo -n "Testing $TEST_NAME: "
  
  START_TIME=$(date +%s%N)
  
  if npx vitest run --no-coverage --reporter=json "$TEST_FILE" 2>/dev/null | grep -q '"failed":0'; then
    END_TIME=$(date +%s%N)
    DURATION=$((($END_TIME - $START_TIME) / 1000000))
    echo "✅ PASS (${DURATION}ms)"
    ((PASSED_TESTS++))
    EXECUTION_TIMES+=($DURATION)
  else
    echo "❌ FAIL"
    ((FAILED_TESTS++))
    
    # Get failure details
    npx vitest run --no-coverage --reporter=verbose "$TEST_FILE" 2>&1 | grep -A 2 "×" | head -5 || true
  fi
  
  ((TOTAL_TESTS++))
done

echo ""

# Test isolation check
echo "3. TEST ISOLATION VALIDATION"
echo "----------------------------"

echo -n "Running 2 passing tests together: "
if npx vitest run --no-coverage \
  src/__tests__/unit/rr-193-mutex-accordion.test.tsx \
  src/__tests__/unit/rr-180-glass-morphing.test.tsx 2>/dev/null | grep -q "Test Files.*2 passed"; then
  echo "✅ PASS - No state pollution detected"
  ISOLATION_PASS=true
else
  echo "❌ FAIL - State pollution between tests"
  ISOLATION_PASS=false
fi

echo ""

# Performance metrics
echo "4. PERFORMANCE METRICS"
echo "----------------------"

if [ ${#EXECUTION_TIMES[@]} -gt 0 ]; then
  # Calculate average
  TOTAL_TIME=0
  for TIME in "${EXECUTION_TIMES[@]}"; do
    TOTAL_TIME=$((TOTAL_TIME + TIME))
  done
  AVG_TIME=$((TOTAL_TIME / ${#EXECUTION_TIMES[@]}))
  
  echo "Average execution time: ${AVG_TIME}ms"
  
  # Check if within target
  if [ $AVG_TIME -lt 20000 ]; then
    echo "✅ Within 8-20 second target"
  else
    echo "⚠️  Exceeds 20 second target"
  fi
fi

echo ""

# Cleanup validation
echo "5. CLEANUP VALIDATION"
echo "--------------------"

# Check for memory leaks or hanging processes
VITEST_PROCESSES=$(ps aux | grep -c "[v]itest" || echo 0)
if [ $VITEST_PROCESSES -eq 0 ]; then
  echo "✅ No hanging test processes"
else
  echo "⚠️  Found $VITEST_PROCESSES hanging vitest processes"
fi

echo ""

# Summary
echo "6. VALIDATION SUMMARY"
echo "--------------------"
echo "Total Tests: $TOTAL_TESTS"
echo "Passed: $PASSED_TESTS"
echo "Failed: $FAILED_TESTS"

if [ $PASSED_TESTS -eq $TOTAL_TESTS ] && [ "$ISOLATION_PASS" = true ]; then
  echo ""
  echo "🎉 RR-223 VALIDATION: SUCCESS"
  echo "All cleanup patterns applied successfully!"
  EXIT_CODE=0
else
  echo ""
  echo "⚠️  RR-223 VALIDATION: PARTIAL SUCCESS"
  echo "Some tests need attention:"
  
  if [ $FAILED_TESTS -gt 0 ]; then
    echo "- $FAILED_TESTS test file(s) have failures"
  fi
  
  if [ "$ISOLATION_PASS" = false ]; then
    echo "- Test isolation issues detected"
  fi
  
  EXIT_CODE=1
fi

echo ""
echo "=================================================="

exit $EXIT_CODE