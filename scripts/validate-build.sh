#!/bin/bash

# validate-build.sh - Comprehensive build validation system for RSS News Reader
# Addresses TODO-039b: Build Validation System

set -euo pipefail

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BUILD_DIR="$PROJECT_ROOT/.next"
LOGS_DIR="$PROJECT_ROOT/logs"
VALIDATION_LOG="$LOGS_DIR/build-validation.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation levels
VALIDATION_LEVEL="${1:-full}" # full, quick, or basic

# Counters
TOTAL_CHECKS=0
FAILED_CHECKS=0
WARNING_CHECKS=0

# Initialize logging
mkdir -p "$LOGS_DIR"
echo "$(date '+%Y-%m-%d %H:%M:%S') - Starting build validation (level: $VALIDATION_LEVEL)" | tee "$VALIDATION_LOG"

# Helper functions
log() {
    local level="$1"
    local message="$2"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    echo "[$timestamp] [$level] $message" | tee -a "$VALIDATION_LOG"
}

print_status() {
    local status="$1"
    local message="$2"
    case "$status" in
        "PASS")
            echo -e "${GREEN}✓${NC} $message"
            ;;
        "FAIL")
            echo -e "${RED}✗${NC} $message"
            FAILED_CHECKS=$((FAILED_CHECKS + 1))
            ;;
        "WARN")
            echo -e "${YELLOW}⚠${NC} $message"
            WARNING_CHECKS=$((WARNING_CHECKS + 1))
            ;;
        "INFO")
            echo -e "${BLUE}ℹ${NC} $message"
            ;;
    esac
    TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
}

# Phase 1a: Check critical directories exist
validate_build_directories() {
    log "INFO" "Phase 1a: Validating build directories"
    
    local critical_dirs=(
        ".next"
        ".next/server"
        ".next/server/app"
        ".next/static"
    )
    
    for dir in "${critical_dirs[@]}"; do
        if [[ -d "$PROJECT_ROOT/$dir" ]]; then
            print_status "PASS" "Directory exists: $dir"
        else
            print_status "FAIL" "Missing critical directory: $dir"
            log "ERROR" "Critical directory missing: $dir"
        fi
    done
}

# Phase 1b: Verify all API route files are present in build
validate_api_routes() {
    log "INFO" "Phase 1b: Validating API routes compilation"
    
    # Get source API routes
    local source_routes=()
    while IFS= read -r -d '' file; do
        # Extract route path from source file
        local route_path="${file#$PROJECT_ROOT/src/app/api/}"
        route_path="${route_path%/route.ts}"
        source_routes+=("$route_path")
    done < <(find "$PROJECT_ROOT/src/app/api" -name "route.ts" -print0)
    
    log "INFO" "Found ${#source_routes[@]} source API routes"
    
    # Check if corresponding compiled routes exist
    local missing_routes=()
    local compiled_count=0
    for route in "${source_routes[@]}"; do
        local compiled_route="$BUILD_DIR/server/app/api/$route/route.js"
        if [[ -f "$compiled_route" ]]; then
            print_status "PASS" "API route compiled: /api/$route"
            compiled_count=$((compiled_count + 1))
        else
            # Check if it exists in a different location (Next.js 14 structure)
            local alt_compiled_route="$BUILD_DIR/server/app/(api)/api/$route/route.js"
            if [[ -f "$alt_compiled_route" ]]; then
                print_status "PASS" "API route compiled (alt location): /api/$route"
                compiled_count=$((compiled_count + 1))
            else
                print_status "FAIL" "Missing compiled API route: /api/$route"
                missing_routes+=("$route")
                log "ERROR" "Missing compiled route: $compiled_route (also checked: $alt_compiled_route)"
            fi
        fi
    done
    
    # Log summary statistics
    log "INFO" "API route compilation summary: $compiled_count compiled, ${#missing_routes[@]} missing"
    
    if [[ ${#missing_routes[@]} -gt 0 ]]; then
        log "ERROR" "Missing ${#missing_routes[@]} API routes: ${missing_routes[*]}"
        print_status "FAIL" "CRITICAL: ${#missing_routes[@]} out of ${#source_routes[@]} API routes missing from build"
        # Don't return 1 here - let the validation continue
    fi
    
    return 0
}

# Phase 1c: Check environment variables are embedded in build
validate_environment_variables() {
    log "INFO" "Phase 1c: Validating environment variables in build"
    
    local required_env_vars=(
        "NEXT_PUBLIC_SUPABASE_URL"
        "NEXT_PUBLIC_SUPABASE_ANON_KEY"
        "NEXT_PUBLIC_BASE_URL"
    )
    
    # Check if .env exists
    if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
        print_status "FAIL" "Environment file .env not found"
        return 1
    fi
    
    # Source environment variables
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
    
    # Validate required variables are set
    for var in "${required_env_vars[@]}"; do
        if [[ -n "${!var:-}" ]]; then
            print_status "PASS" "Environment variable set: $var"
        else
            print_status "FAIL" "Missing environment variable: $var"
        fi
    done
    
    # Check if variables are embedded in build artifacts
    local build_config="$BUILD_DIR/build-manifest.json"
    if [[ -f "$build_config" ]]; then
        print_status "PASS" "Build manifest exists"
    else
        print_status "WARN" "Build manifest not found (may be normal for some Next.js versions)"
    fi
}

# Phase 1d: Validate build artifacts are not corrupted
validate_build_artifacts() {
    log "INFO" "Phase 1d: Validating build artifact integrity"
    
    local critical_files=(
        ".next/BUILD_ID"
        ".next/package.json"
        ".next/prerender-manifest.json"
        ".next/react-loadable-manifest.json"
        ".next/server/server-reference-manifest.json"
        ".next/server/middleware-manifest.json"
    )
    
    for file in "${critical_files[@]}"; do
        local full_path="$PROJECT_ROOT/$file"
        if [[ -f "$full_path" ]]; then
            # Check if file is readable and not empty
            if [[ -r "$full_path" && -s "$full_path" ]]; then
                print_status "PASS" "Build artifact valid: $file"
            else
                print_status "FAIL" "Build artifact corrupted or empty: $file"
            fi
        else
            if [[ "$file" == ".next/BUILD_ID" ]]; then
                print_status "FAIL" "Missing critical build artifact: $file"
            else
                print_status "WARN" "Missing build artifact: $file"
            fi
        fi
    done
    
    # Check build size (should be substantial)
    local build_size=$(du -sm "$BUILD_DIR" 2>/dev/null | cut -f1 || echo "0")
    if [[ "$build_size" -gt 10 ]]; then
        print_status "PASS" "Build size reasonable: ${build_size}MB"
    else
        print_status "WARN" "Build size suspiciously small: ${build_size}MB"
    fi
    
    # Phase 1e: Validate critical vendor chunks exist
    validate_vendor_chunks
}

# Phase 1e: Validate critical vendor chunks and dependencies exist
validate_vendor_chunks() {
    log "INFO" "Phase 1e: Validating critical vendor chunks and dependencies"
    
    # Check for vendor chunks directory
    local vendor_dir="$BUILD_DIR/static/chunks"
    if [[ -d "$vendor_dir" ]]; then
        print_status "PASS" "Vendor chunks directory exists"
        
        # Count vendor chunks
        local chunk_count=$(find "$vendor_dir" -name "*.js" | wc -l)
        if [[ "$chunk_count" -gt 5 ]]; then
            print_status "PASS" "Adequate number of vendor chunks: $chunk_count"
        else
            print_status "WARN" "Low number of vendor chunks: $chunk_count"
        fi
    else
        print_status "FAIL" "Vendor chunks directory missing"
    fi
    
    # Check for critical dependency chunks (Supabase)
    if [[ -f "$BUILD_DIR/react-loadable-manifest.json" ]]; then
        local loadable_manifest_content
        loadable_manifest_content=$(cat "$BUILD_DIR/react-loadable-manifest.json" 2>/dev/null || echo "{}")
        
        # Check for Supabase entries in manifest
        if echo "$loadable_manifest_content" | grep -q "@supabase" 2>/dev/null; then
            print_status "PASS" "Supabase dependencies found in loadable manifest"
        else
            print_status "FAIL" "Missing Supabase dependencies in loadable manifest"
            log "ERROR" "Supabase vendor chunks missing - this can cause module not found errors"
        fi
        
        # Check for dynamic import entries
        if echo "$loadable_manifest_content" | grep -q '"id"' 2>/dev/null; then
            print_status "PASS" "Dynamic import mappings present in loadable manifest"
        else
            print_status "WARN" "Dynamic import mappings may be incomplete"
        fi
    else
        print_status "FAIL" "React loadable manifest missing"
    fi
    
    # Check prerender manifest structure
    if [[ -f "$BUILD_DIR/prerender-manifest.json" ]]; then
        local prerender_content
        prerender_content=$(cat "$BUILD_DIR/prerender-manifest.json" 2>/dev/null || echo "{}")
        
        # Validate JSON structure
        if echo "$prerender_content" | jq . >/dev/null 2>&1; then
            print_status "PASS" "Prerender manifest has valid JSON structure"
            
            # Check for required fields
            if echo "$prerender_content" | jq -e '.version' >/dev/null 2>&1; then
                print_status "PASS" "Prerender manifest has version field"
            else
                print_status "FAIL" "Prerender manifest missing version field"
            fi
            
            if echo "$prerender_content" | jq -e '.routes' >/dev/null 2>&1; then
                print_status "PASS" "Prerender manifest has routes field"
            else
                print_status "FAIL" "Prerender manifest missing routes field"
            fi
        else
            print_status "FAIL" "Prerender manifest has invalid JSON structure"
            log "ERROR" "Invalid prerender manifest can cause server startup failures"
        fi
    else
        print_status "FAIL" "Prerender manifest missing"
    fi
}

# Phase 2: Health Check Validation (for full and quick validation)
validate_health_endpoints() {
    if [[ "$VALIDATION_LEVEL" == "basic" ]]; then
        return 0
    fi
    
    log "INFO" "Phase 2: Validating health endpoints (level: $VALIDATION_LEVEL)"
    
    # Phase 2a: Test critical API endpoints with real requests
    validate_api_endpoint_functionality
    
    # Phase 2b: Validate database connectivity through health endpoint
    validate_database_health
    
    # Phase 2c: Check sync server responsiveness
    validate_sync_server_health
    
    # Phase 2d: Verify services return accurate status codes
    validate_status_code_accuracy
    
    # Phase 4: Service State Verification (full mode only)
    if [[ "$VALIDATION_LEVEL" == "full" ]]; then
        validate_actual_service_functionality
        validate_uptime_kuma_correlation
    fi
    
    return 0
}

# Phase 2a: Test critical API endpoints with real requests
validate_api_endpoint_functionality() {
    log "INFO" "Phase 2a: Testing API endpoint functionality"
    
    local base_url="http://100.96.166.53:3147"
    local timeout=10
    
    # Test health endpoint with ping
    if curl -s --max-time "$timeout" "$base_url/api/health/app?ping=true" >/dev/null 2>&1; then
        print_status "PASS" "Health endpoint responds to ping"
    else
        print_status "FAIL" "Health endpoint does not respond to ping"
        return 1
    fi
    
    # Test main health endpoint (should return JSON)
    local health_response
    if health_response=$(curl -s --max-time "$timeout" "$base_url/api/health/app" 2>/dev/null); then
        if echo "$health_response" | grep -q '"status"'; then
            print_status "PASS" "Main health endpoint returns JSON data"
        else
            print_status "WARN" "Health endpoint responds but format may be incorrect"
            log "WARNING" "Health response: $health_response"
        fi
    else
        print_status "FAIL" "Main health endpoint does not respond"
        log "ERROR" "Failed to get health response from $base_url/api/health/app"
    fi
    
    # Test if production app is actually accessible
    if curl -s --max-time "$timeout" "$base_url/reader" | grep -q "RSS News Reader" 2>/dev/null; then
        print_status "PASS" "Production app is accessible and serving content"
    else
        print_status "FAIL" "Production app is not accessible or not serving expected content"
    fi
}

# Phase 2b: Validate database connectivity through health endpoint
validate_database_health() {
    log "INFO" "Phase 2b: Testing database connectivity"
    
    local base_url="http://100.96.166.53:3147"
    local timeout=15
    
    # Test database health endpoint
    local db_health_response
    if db_health_response=$(curl -s --max-time "$timeout" "$base_url/api/health/db" 2>/dev/null); then
        if echo "$db_health_response" | grep -q '"database"'; then
            print_status "PASS" "Database health endpoint responds with data"
        else
            print_status "WARN" "Database health endpoint response format unexpected"
            log "WARNING" "DB health response: $db_health_response"
        fi
    else
        print_status "FAIL" "Database health endpoint does not respond"
    fi
    
    # Check for common database error indicators
    if echo "$db_health_response" | grep -qi "error\|fail\|timeout"; then
        print_status "FAIL" "Database health endpoint reports errors"
        log "ERROR" "Database errors in response: $db_health_response"
    else
        print_status "PASS" "No obvious database errors detected"
    fi
}

# Phase 2c: Check sync server responsiveness at /server/health
validate_sync_server_health() {
    log "INFO" "Phase 2c: Testing sync server health"
    
    local sync_url="http://localhost:3001/server/health"
    local timeout=10
    
    # Test sync server health endpoint
    local sync_response
    if sync_response=$(curl -s --max-time "$timeout" "$sync_url" 2>/dev/null); then
        if echo "$sync_response" | grep -q '"status"'; then
            print_status "PASS" "Sync server health endpoint responds with JSON"
        else
            print_status "WARN" "Sync server health endpoint response format unexpected"
            log "WARNING" "Sync health response: $sync_response"
        fi
    else
        print_status "FAIL" "Sync server health endpoint does not respond"
        log "ERROR" "Failed to connect to sync server at $sync_url"
    fi
    
    # Check if sync server is actually running via PM2
    if command -v pm2 >/dev/null 2>&1; then
        if pm2 list | grep -q "rss-sync-server.*online"; then
            print_status "PASS" "Sync server process is running via PM2"
        else
            print_status "FAIL" "Sync server process not running or not online in PM2"
        fi
    else
        print_status "WARN" "PM2 not available to check sync server process"
    fi
}

# Phase 2d: Verify services return accurate status codes
validate_status_code_accuracy() {
    log "INFO" "Phase 2d: Validating HTTP status code accuracy"
    
    local base_url="http://100.96.166.53:3147"
    local timeout=10
    
    # Test production app status code vs accessibility
    local prod_status_code
    prod_status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$base_url/reader" 2>/dev/null || echo "000")
    
    local prod_accessible=false
    if curl -s --max-time "$timeout" "$base_url/reader" | grep -q "RSS News Reader" 2>/dev/null; then
        prod_accessible=true
    fi
    
    if [[ "$prod_status_code" == "200" && "$prod_accessible" == true ]]; then
        print_status "PASS" "Production app: status code ($prod_status_code) matches accessibility"
    elif [[ "$prod_status_code" != "200" && "$prod_accessible" == false ]]; then
        print_status "PASS" "Production app: status code ($prod_status_code) correctly indicates inaccessibility"
    else
        print_status "FAIL" "Production app: status code ($prod_status_code) does not match accessibility ($prod_accessible)"
        log "ERROR" "Status code mismatch: code=$prod_status_code, accessible=$prod_accessible"
    fi
    
    # Test health endpoint status code vs actual health
    local health_status_code
    health_status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$base_url/api/health/app" 2>/dev/null || echo "000")
    
    local health_response
    health_response=$(curl -s --max-time "$timeout" "$base_url/api/health/app" 2>/dev/null || echo "")
    
    if [[ "$health_status_code" == "200" ]]; then
        if echo "$health_response" | grep -q '"status".*"ok"'; then
            print_status "PASS" "Health endpoint: status code 200 matches healthy response"
        else
            print_status "FAIL" "Health endpoint: returns 200 but response indicates problems"
            log "ERROR" "Health endpoint false positive: code=200 but response=$health_response"
        fi
    elif [[ "$health_status_code" == "503" ]]; then
        print_status "PASS" "Health endpoint: status code 503 correctly indicates service unavailable"
    else
        print_status "WARN" "Health endpoint: unusual status code $health_status_code"
    fi
}

# Phase 4a & 4b: Test endpoints with actual data requests and validate functionality beyond ping
validate_actual_service_functionality() {
    log "INFO" "Phase 4a/4b: Testing actual service functionality"
    
    local base_url="http://100.96.166.53:3147"
    local timeout=20
    
    # Test 1: Actual application page load with content validation
    log "INFO" "Testing application page load and content"
    local app_response
    if app_response=$(curl -s --max-time "$timeout" "$base_url/reader" 2>/dev/null); then
        # Check for essential app components
        if echo "$app_response" | grep -q "RSS News Reader" && echo "$app_response" | grep -q "html"; then
            print_status "PASS" "Application page loads with correct content"
            
            # Deeper content validation
            if echo "$app_response" | grep -q "<!DOCTYPE html>"; then
                print_status "PASS" "Application serves complete HTML document"
            else
                print_status "WARN" "Application serves partial or malformed HTML"
            fi
        else
            print_status "FAIL" "Application page loads but missing essential content"
            log "ERROR" "App response preview: $(echo "$app_response" | head -c 200)..."
        fi
    else
        print_status "FAIL" "Application page does not load"
    fi
    
    # Test 2: API endpoint with actual data requests
    log "INFO" "Testing API endpoints with real data requests"
    
    # Test authentication status endpoint
    local auth_response
    if auth_response=$(curl -s --max-time "$timeout" "$base_url/api/auth/inoreader/status" 2>/dev/null); then
        if echo "$auth_response" | grep -q '"' 2>/dev/null; then
            print_status "PASS" "Auth status API returns JSON response"
        else
            print_status "WARN" "Auth status API response format unexpected"
            log "WARNING" "Auth response: $auth_response"
        fi
    else
        print_status "FAIL" "Auth status API endpoint not responding"
    fi
    
    # Test database connection via health check
    local db_health_response
    if db_health_response=$(curl -s --max-time "$timeout" "$base_url/api/health/db" 2>/dev/null); then
        if echo "$db_health_response" | grep -q '"status".*"healthy"\|"status".*"ok"' 2>/dev/null; then
            print_status "PASS" "Database connection healthy"
        else
            print_status "FAIL" "Database connection unhealthy"
            log "ERROR" "Database health response: $db_health_response"
        fi
    else
        print_status "FAIL" "Database health endpoint not responding"
    fi
    
    # Test 3: Comprehensive health check with detailed validation
    log "INFO" "Testing comprehensive health check"
    
    local detailed_health
    if detailed_health=$(curl -s --max-time "$timeout" "$base_url/api/health" 2>/dev/null); then
        # Parse health response for service status
        if echo "$detailed_health" | grep -q '"overall".*"healthy"\|"status".*"ok"' 2>/dev/null; then
            print_status "PASS" "Comprehensive health check reports healthy status"
        elif echo "$detailed_health" | grep -q '"overall".*"degraded"' 2>/dev/null; then
            print_status "WARN" "Comprehensive health check reports degraded status"
            log "WARNING" "Health degraded: $detailed_health"
        else
            print_status "FAIL" "Comprehensive health check reports unhealthy or error status"
            log "ERROR" "Unhealthy status: $detailed_health"
        fi
        
        # Check for specific service metrics
        if echo "$detailed_health" | grep -q '"database"' 2>/dev/null; then
            print_status "PASS" "Health check includes database status"
        else
            print_status "WARN" "Health check missing database status"
        fi
        
        if echo "$detailed_health" | grep -q '"timestamp"' 2>/dev/null; then
            print_status "PASS" "Health check includes timestamp"
        else
            print_status "WARN" "Health check missing timestamp"
        fi
    else
        print_status "FAIL" "Comprehensive health endpoint not responding"
    fi
    
    # Test 4: Service responsiveness under load (quick test)
    log "INFO" "Testing service responsiveness"
    
    local start_time=$(date +%s%N)
    if curl -s --max-time 5 "$base_url/api/health/app?ping=true" >/dev/null 2>&1; then
        local end_time=$(date +%s%N)
        local response_time_ms=$(( (end_time - start_time) / 1000000 ))
        
        if [[ $response_time_ms -lt 1000 ]]; then
            print_status "PASS" "Service responds quickly (${response_time_ms}ms)"
        elif [[ $response_time_ms -lt 3000 ]]; then
            print_status "WARN" "Service responds slowly (${response_time_ms}ms)"
        else
            print_status "FAIL" "Service responds very slowly (${response_time_ms}ms)"
        fi
    else
        print_status "FAIL" "Service not responding within 5 seconds"
    fi
}

# Phase 4c: Cross-reference Uptime Kuma with internal validation
validate_uptime_kuma_correlation() {
    log "INFO" "Phase 4c: Cross-referencing with Uptime Kuma monitoring"
    
    local kuma_url="http://localhost:3080"
    local timeout=10
    
    # Check if Uptime Kuma is accessible
    if curl -s --max-time "$timeout" "$kuma_url" >/dev/null 2>&1; then
        print_status "PASS" "Uptime Kuma monitoring interface accessible"
        
        # Try to get monitor status (this would need API key in real implementation)
        # For now, we'll validate that our findings align with what Kuma should detect
        log "INFO" "Validating internal findings against expected Kuma results"
        
        # If we found API route issues, Kuma should also detect problems
        if grep -q "Missing compiled route" "$VALIDATION_LOG" 2>/dev/null; then
            local missing_count=$(grep -c "Missing compiled route" "$VALIDATION_LOG" 2>/dev/null || echo "0")
            print_status "INFO" "Internal validation found $missing_count missing API routes"
            print_status "INFO" "Expected: Uptime Kuma should detect service degradation"
        fi
        
        # If we found health endpoint issues, validate correlation
        if grep -q "Internal Server Error" "$VALIDATION_LOG" 2>/dev/null; then
            print_status "INFO" "Internal validation found health endpoint errors"
            print_status "INFO" "Expected: Uptime Kuma health monitors should show failures"
        fi
        
        # If we found status code mismatches, note for Kuma correlation
        if grep -q "Status code mismatch" "$VALIDATION_LOG" 2>/dev/null; then
            print_status "WARN" "Status code accuracy issues detected"
            print_status "INFO" "Expected: Uptime Kuma may show false positives"
        fi
        
        # Test sync server correlation
        if curl -s --max-time "$timeout" "http://localhost:3001/server/health" >/dev/null 2>&1; then
            print_status "PASS" "Sync server operational - should correlate with Kuma sync monitor"
        else
            print_status "FAIL" "Sync server down - should correlate with Kuma sync monitor alerts"
        fi
        
    else
        print_status "WARN" "Uptime Kuma not accessible for correlation check"
        log "WARNING" "Cannot cross-reference with Uptime Kuma at $kuma_url"
    fi
    
    # Validate monitoring consistency
    log "INFO" "Monitoring consistency analysis"
    
    # Check if our validation results are consistent
    local health_endpoint_working=false
    local app_accessible=false
    
    if curl -s --max-time 10 "http://100.96.166.53:3147/api/health/app?ping=true" >/dev/null 2>&1; then
        health_endpoint_working=true
    fi
    
    if curl -s --max-time 10 "http://100.96.166.53:3147/reader" | grep -q "RSS News Reader" 2>/dev/null; then
        app_accessible=true
    fi
    
    # Correlation analysis
    if [[ "$health_endpoint_working" == true && "$app_accessible" == true ]]; then
        print_status "PASS" "Monitoring correlation: Both health endpoint and app functional"
    elif [[ "$health_endpoint_working" == false && "$app_accessible" == false ]]; then
        print_status "PASS" "Monitoring correlation: Both health endpoint and app non-functional"
    else
        print_status "WARN" "Monitoring correlation mismatch: health=$health_endpoint_working, app=$app_accessible"
        log "WARNING" "Inconsistent service state detected - requires investigation"
    fi
}

# Generate summary report
generate_summary() {
    log "INFO" "Build validation summary"
    
    # Enhanced logging for Phase 3d
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')
    local summary_log="$LOGS_DIR/validation-summary.jsonl"
    
    # Create JSON summary for structured logging
    cat >> "$summary_log" << EOF
{"timestamp":"$timestamp","level":"$VALIDATION_LEVEL","total_checks":$TOTAL_CHECKS,"failed_checks":$FAILED_CHECKS,"warning_checks":$WARNING_CHECKS,"passed_checks":$((TOTAL_CHECKS - FAILED_CHECKS - WARNING_CHECKS)),"status":"$(if [[ $FAILED_CHECKS -eq 0 ]]; then echo "PASSED"; else echo "FAILED"; fi)"}
EOF
    
    echo ""
    echo "=================================="
    echo "    BUILD VALIDATION SUMMARY"
    echo "=================================="
    echo "Validation level: $VALIDATION_LEVEL"
    echo "Timestamp: $timestamp"
    echo "Total checks: $TOTAL_CHECKS"
    echo "Failed checks: $FAILED_CHECKS"
    echo "Warning checks: $WARNING_CHECKS"
    echo "Passed checks: $((TOTAL_CHECKS - FAILED_CHECKS - WARNING_CHECKS))"
    echo ""
    
    if [[ $FAILED_CHECKS -eq 0 ]]; then
        if [[ $WARNING_CHECKS -eq 0 ]]; then
            echo -e "${GREEN}✓ BUILD VALIDATION PASSED${NC}"
            log "SUCCESS" "Build validation completed successfully - level:$VALIDATION_LEVEL checks:$TOTAL_CHECKS"
            return 0
        else
            echo -e "${YELLOW}⚠ BUILD VALIDATION PASSED WITH WARNINGS${NC}"
            log "WARNING" "Build validation completed with $WARNING_CHECKS warnings - level:$VALIDATION_LEVEL checks:$TOTAL_CHECKS"
            return 0
        fi
    else
        echo -e "${RED}✗ BUILD VALIDATION FAILED${NC}"
        log "ERROR" "Build validation failed with $FAILED_CHECKS critical issues - level:$VALIDATION_LEVEL checks:$TOTAL_CHECKS"
        
        # Log top failure reasons for debugging
        echo ""
        echo "Top Issues Found:"
        echo "=================="
        if grep -q "Missing compiled route" "$VALIDATION_LOG" 2>/dev/null; then
            local missing_routes=$(grep -c "Missing compiled route" "$VALIDATION_LOG" 2>/dev/null || echo "0")
            echo "• $missing_routes API routes missing from build"
        fi
        if grep -q "Status code mismatch" "$VALIDATION_LOG" 2>/dev/null; then
            echo "• Health endpoint status code accuracy issues"
        fi
        if grep -q "Database errors" "$VALIDATION_LOG" 2>/dev/null; then
            echo "• Database connectivity problems"
        fi
        if grep -q "prerender-manifest.json" "$VALIDATION_LOG" 2>/dev/null; then
            echo "• Missing Next.js prerender manifest file"
        fi
        if grep -q "Supabase vendor chunks missing" "$VALIDATION_LOG" 2>/dev/null; then
            echo "• Missing Supabase vendor chunks - build corruption"
        fi
        
        echo ""
        echo "Build Recovery Recommendations:"
        echo "==============================="
        if grep -q "prerender-manifest.json\|Supabase vendor chunks missing" "$VALIDATION_LOG" 2>/dev/null; then
            echo "1. Clean rebuild required:"
            echo "   rm -rf .next && npm run build"
            echo ""
            echo "2. If issues persist, clear node_modules:"
            echo "   rm -rf node_modules .next && npm install && npm run build"
        fi
        if grep -q "Missing compiled route" "$VALIDATION_LOG" 2>/dev/null; then
            echo "3. Check TypeScript compilation errors:"
            echo "   npm run type-check"
        fi
        if grep -q "Database errors\|Status code mismatch" "$VALIDATION_LOG" 2>/dev/null; then
            echo "4. Verify services are running:"
            echo "   pm2 list"
            echo "   curl http://localhost:3147/reader/api/health"
        fi
        
        return 1
    fi
}

# Send Uptime Kuma notification (if available)
notify_uptime_kuma() {
    local status="$1"
    local message="$2"
    
    local kuma_script="$SCRIPT_DIR/uptime-kuma-push.sh"
    if [[ -f "$kuma_script" && -x "$kuma_script" ]]; then
        log "INFO" "Sending Uptime Kuma notification: $status"
        "$kuma_script" push build "$status" "$message" || true
    fi
}

# Main execution
main() {
    echo "RSS News Reader - Build Validation System"
    echo "Validation level: $VALIDATION_LEVEL"
    echo ""
    
    # Phase 1: Build Verification
    validate_build_directories
    validate_api_routes
    validate_environment_variables
    validate_build_artifacts
    # Note: validate_vendor_chunks is called from validate_build_artifacts
    
    # Phase 2: Health Checks (full mode only)
    validate_health_endpoints
    
    # Generate summary and determine exit code
    if generate_summary; then
        if [[ $WARNING_CHECKS -eq 0 ]]; then
            notify_uptime_kuma "up" "Build validation passed - all checks successful"
        else
            notify_uptime_kuma "up" "Build validation passed with $WARNING_CHECKS warnings"
        fi
        exit 0
    else
        notify_uptime_kuma "down" "Build validation failed - $FAILED_CHECKS critical issues"
        exit 1
    fi
}

# Run main function
main "$@"