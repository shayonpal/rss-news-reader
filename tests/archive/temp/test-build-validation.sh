#!/bin/bash

# Comprehensive test suite for build validation script
# Tests all critical scenarios including the production issue that was encountered

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$(dirname "$SCRIPT_DIR")")"
VALIDATION_SCRIPT="$PROJECT_ROOT/scripts/validate-build.sh"
TEST_BUILD_DIR="$PROJECT_ROOT/.next-test-backup"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Test result tracking
declare -a TEST_RESULTS

log_test() {
    local test_name="$1"
    local status="$2"
    local message="$3"
    
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if [[ "$status" == "PASS" ]]; then
        echo -e "${GREEN}✓${NC} $test_name: $message"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        TEST_RESULTS+=("PASS|$test_name|$message")
    else
        echo -e "${RED}✗${NC} $test_name: $message"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        TEST_RESULTS+=("FAIL|$test_name|$message")
    fi
}

# Backup current build if exists
backup_current_build() {
    if [[ -d "$PROJECT_ROOT/.next" ]]; then
        echo "Backing up current build..."
        rm -rf "$TEST_BUILD_DIR"
        cp -r "$PROJECT_ROOT/.next" "$TEST_BUILD_DIR"
        echo -e "${GREEN}✓${NC} Current build backed up"
    fi
}

# Restore original build
restore_original_build() {
    if [[ -d "$TEST_BUILD_DIR" ]]; then
        echo "Restoring original build..."
        rm -rf "$PROJECT_ROOT/.next"
        cp -r "$TEST_BUILD_DIR" "$PROJECT_ROOT/.next"
        rm -rf "$TEST_BUILD_DIR"
        echo -e "${GREEN}✓${NC} Original build restored"
    fi
}

# Test 1: Missing prerender-manifest.json
test_missing_prerender_manifest() {
    echo -e "\n${BLUE}Test 1: Missing prerender-manifest.json${NC}"
    
    # The file is already missing in current build, so test directly
    if "$VALIDATION_SCRIPT" basic 2>&1 | grep -q "Missing build artifact: .next/prerender-manifest.json\|Prerender manifest missing"; then
        log_test "missing_prerender_manifest" "PASS" "Correctly detected missing prerender-manifest.json"
    else
        log_test "missing_prerender_manifest" "FAIL" "Failed to detect missing prerender-manifest.json"
    fi
}

# Test 2: Corrupted vendor chunks (missing Supabase)
test_missing_vendor_chunks() {
    echo -e "\n${BLUE}Test 2: Missing Supabase vendor chunks${NC}"
    
    # Create mock react-loadable-manifest without Supabase
    if [[ -f "$PROJECT_ROOT/.next/react-loadable-manifest.json" ]]; then
        cp "$PROJECT_ROOT/.next/react-loadable-manifest.json" "$PROJECT_ROOT/.next/react-loadable-manifest.json.bak"
        echo '{"test": "no-supabase"}' > "$PROJECT_ROOT/.next/react-loadable-manifest.json"
    fi
    
    # Run validation
    if "$VALIDATION_SCRIPT" basic 2>&1 | grep -q "Missing Supabase dependencies in loadable manifest"; then
        log_test "missing_vendor_chunks" "PASS" "Correctly detected missing Supabase vendor chunks"
    else
        log_test "missing_vendor_chunks" "FAIL" "Failed to detect missing Supabase vendor chunks"
    fi
    
    # Restore file
    if [[ -f "$PROJECT_ROOT/.next/react-loadable-manifest.json.bak" ]]; then
        mv "$PROJECT_ROOT/.next/react-loadable-manifest.json.bak" "$PROJECT_ROOT/.next/react-loadable-manifest.json"
    fi
}

# Test 3: Invalid JSON in manifest files
test_invalid_json_manifest() {
    echo -e "\n${BLUE}Test 3: Invalid JSON in prerender manifest${NC}"
    
    # Create prerender manifest with invalid JSON
    echo '{invalid json}' > "$PROJECT_ROOT/.next/prerender-manifest.json"
    
    # Run validation
    if "$VALIDATION_SCRIPT" basic 2>&1 | grep -q "Prerender manifest has invalid JSON structure"; then
        log_test "invalid_json_manifest" "PASS" "Correctly detected invalid JSON in prerender manifest"
    else
        log_test "invalid_json_manifest" "FAIL" "Failed to detect invalid JSON in prerender manifest"
    fi
    
    # Remove the test file
    rm -f "$PROJECT_ROOT/.next/prerender-manifest.json"
}

# Test 4: Missing critical fields in prerender manifest
test_missing_manifest_fields() {
    echo -e "\n${BLUE}Test 4: Missing critical fields in prerender manifest${NC}"
    
    # Create manifest without required fields
    echo '{"test": "incomplete"}' > "$PROJECT_ROOT/.next/prerender-manifest.json"
    
    # Run validation
    local output=$(cd "$PROJECT_ROOT" && "$VALIDATION_SCRIPT" basic 2>&1)
    if echo "$output" | grep -q "Prerender manifest missing version field" || echo "$output" | grep -q "Prerender manifest missing routes field"; then
        log_test "missing_manifest_fields" "PASS" "Correctly detected missing manifest fields"
    else
        log_test "missing_manifest_fields" "FAIL" "Failed to detect missing manifest fields"
    fi
    
    # Remove the test file
    rm -f "$PROJECT_ROOT/.next/prerender-manifest.json"
}

# Test 5: Validation exit codes
test_validation_exit_codes() {
    echo -e "\n${BLUE}Test 5: Validation exit codes${NC}"
    
    # Test failed validation (current build is already invalid)
    if ! "$VALIDATION_SCRIPT" basic >/dev/null 2>&1; then
        log_test "exit_code_failure" "PASS" "Validation returns non-zero on failure"
    else
        log_test "exit_code_failure" "FAIL" "Validation returns 0 on invalid build"
    fi
    
    # For success test, we would need a valid build
    log_test "exit_code_success" "SKIP" "Cannot test success exit code without valid build"
}

# Test 6: Recovery recommendations
test_recovery_recommendations() {
    echo -e "\n${BLUE}Test 6: Recovery recommendations${NC}"
    
    # The current build already has issues, check recommendations
    local output=$(cd "$PROJECT_ROOT" && "$VALIDATION_SCRIPT" basic 2>&1)
    
    if echo "$output" | grep -q "rm -rf .next && npm run build"; then
        log_test "recovery_recommendations" "PASS" "Provides clean rebuild recommendation"
    else
        log_test "recovery_recommendations" "FAIL" "Missing clean rebuild recommendation"
    fi
}

# Test 7: PM2 integration
test_pm2_integration() {
    echo -e "\n${BLUE}Test 7: PM2 pre-start hook integration${NC}"
    
    # Test the PM2 pre-start validation script directly
    if [[ -f "$PROJECT_ROOT/scripts/pm2-pre-start-validation.sh" ]]; then
        # Test with production app name (should fail with current invalid build)
        if ! "$PROJECT_ROOT/scripts/pm2-pre-start-validation.sh" rss-reader-prod >/dev/null 2>&1; then
            log_test "pm2_integration_prod" "PASS" "PM2 pre-start hook correctly prevents invalid build start"
        else
            log_test "pm2_integration_prod" "FAIL" "PM2 pre-start hook allowed invalid build to start"
        fi
        
        # Test with dev app name (should skip validation)
        if "$PROJECT_ROOT/scripts/pm2-pre-start-validation.sh" rss-reader-dev 2>&1 | grep -q "no validation required"; then
            log_test "pm2_integration_dev" "PASS" "PM2 pre-start hook skips dev validation"
        else
            log_test "pm2_integration_dev" "FAIL" "PM2 pre-start hook incorrectly validates dev"
        fi
    else
        log_test "pm2_integration" "FAIL" "PM2 pre-start validation script not found"
    fi
}

# Test 8: Performance check
test_validation_performance() {
    echo -e "\n${BLUE}Test 8: Validation performance${NC}"
    
    # Time the basic validation
    local start_time=$(date +%s)
    "$VALIDATION_SCRIPT" basic >/dev/null 2>&1
    local end_time=$(date +%s)
    local duration_s=$((end_time - start_time))
    
    if [[ $duration_s -lt 3 ]]; then
        log_test "validation_performance" "PASS" "Basic validation completes in ${duration_s}s (< 3s)"
    else
        log_test "validation_performance" "FAIL" "Basic validation too slow: ${duration_s}s (> 3s)"
    fi
}

# Test 9: Partial build corruption
test_partial_corruption() {
    echo -e "\n${BLUE}Test 9: Partial build corruption handling${NC}"
    
    # Remove just the static chunks directory
    if [[ -d "$PROJECT_ROOT/.next/static/chunks" ]]; then
        mv "$PROJECT_ROOT/.next/static/chunks" "$PROJECT_ROOT/.next/static/chunks.bak"
    fi
    
    # Run validation
    if "$VALIDATION_SCRIPT" basic 2>&1 | grep -q "Vendor chunks directory missing"; then
        log_test "partial_corruption" "PASS" "Correctly detected missing vendor chunks directory"
    else
        log_test "partial_corruption" "FAIL" "Failed to detect missing vendor chunks directory"
    fi
    
    # Restore directory
    if [[ -d "$PROJECT_ROOT/.next/static/chunks.bak" ]]; then
        mv "$PROJECT_ROOT/.next/static/chunks.bak" "$PROJECT_ROOT/.next/static/chunks"
    fi
}

# Test 10: Logging and reporting
test_logging_functionality() {
    echo -e "\n${BLUE}Test 10: Logging and structured reporting${NC}"
    
    # Clear logs
    rm -f "$PROJECT_ROOT/logs/build-validation.log"
    rm -f "$PROJECT_ROOT/logs/validation-summary.jsonl"
    
    # Run validation
    "$VALIDATION_SCRIPT" basic >/dev/null 2>&1
    
    # Check if logs were created
    if [[ -f "$PROJECT_ROOT/logs/build-validation.log" ]]; then
        log_test "logging_basic" "PASS" "Validation log file created"
    else
        log_test "logging_basic" "FAIL" "Validation log file not created"
    fi
    
    # Check structured summary log
    if [[ -f "$PROJECT_ROOT/logs/validation-summary.jsonl" ]]; then
        # Verify it's valid JSONL
        if tail -1 "$PROJECT_ROOT/logs/validation-summary.jsonl" | jq . >/dev/null 2>&1; then
            log_test "logging_structured" "PASS" "Structured summary log is valid JSONL"
        else
            log_test "logging_structured" "FAIL" "Structured summary log has invalid JSON"
        fi
    else
        log_test "logging_structured" "FAIL" "Structured summary log not created"
    fi
}

# Main test execution
main() {
    echo "RSS News Reader - Build Validation Test Suite"
    echo "============================================="
    echo ""
    
    # Check if validation script exists
    if [[ ! -f "$VALIDATION_SCRIPT" ]] || [[ ! -x "$VALIDATION_SCRIPT" ]]; then
        echo -e "${RED}Error: Validation script not found or not executable${NC}"
        echo "Expected at: $VALIDATION_SCRIPT"
        exit 1
    fi
    
    # Check if we have a build to test with
    if [[ ! -d "$PROJECT_ROOT/.next" ]]; then
        echo -e "${YELLOW}Warning: No build found. Some tests will be skipped.${NC}"
        echo "Run 'npm run build' first for comprehensive testing."
        echo ""
    fi
    
    # Backup current build
    backup_current_build
    
    # Run all tests
    test_missing_prerender_manifest
    test_missing_vendor_chunks
    test_invalid_json_manifest
    test_missing_manifest_fields
    test_validation_exit_codes
    test_recovery_recommendations
    test_pm2_integration
    test_validation_performance
    test_partial_corruption
    test_logging_functionality
    
    # Generate test report
    echo ""
    echo "=================================="
    echo "    TEST SUITE SUMMARY"
    echo "=================================="
    echo "Total tests: $TOTAL_TESTS"
    echo -e "${GREEN}Passed: $PASSED_TESTS${NC}"
    echo -e "${RED}Failed: $FAILED_TESTS${NC}"
    echo ""
    
    if [[ $FAILED_TESTS -eq 0 ]]; then
        echo -e "${GREEN}✓ ALL TESTS PASSED${NC}"
    else
        echo -e "${RED}✗ SOME TESTS FAILED${NC}"
        echo ""
        echo "Failed tests:"
        for result in "${TEST_RESULTS[@]}"; do
            IFS='|' read -r status name message <<< "$result"
            if [[ "$status" == "FAIL" ]]; then
                echo "  - $name: $message"
            fi
        done
    fi
    
    # Restore original build
    echo ""
    restore_original_build
    
    # Exit with appropriate code
    [[ $FAILED_TESTS -eq 0 ]] && exit 0 || exit 1
}

# Execute main
main "$@"
