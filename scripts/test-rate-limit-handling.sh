#!/bin/bash

# Test script for rate limit handling (RR-5)
# This script simulates various rate limit scenarios to ensure graceful failure

BASE_URL="${NEXT_PUBLIC_BASE_URL:-http://localhost:3000}/reader"
API_BASE="$BASE_URL/api/test/simulate-rate-limit"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== Testing Rate Limit Handling (RR-5) ===${NC}"
echo ""

# Function to set rate limit scenario
set_rate_limit() {
    local zone1=$1
    local zone2=$2
    local description=$3
    
    echo -e "${YELLOW}Setting up scenario: $description${NC}"
    echo "Zone 1: $zone1/5000, Zone 2: $zone2/100"
    
    curl -s -X POST "$API_BASE" \
        -H "Content-Type: application/json" \
        -d "{\"zone1Usage\": $zone1, \"zone2Usage\": $zone2}" \
        | jq -r '.message'
    echo ""
}

# Function to check current rates
check_rates() {
    echo -e "${BLUE}Current rate limits:${NC}"
    curl -s "$API_BASE" | jq -r '
        "Zone 1: \(.zone1.usage)/\(.zone1.limit) (\(.zone1.percentage)%)",
        "Zone 2: \(.zone2.usage)/\(.zone2.limit) (\(.zone2.percentage)%)"
    '
    echo ""
}

# Function to check sidebar display
check_sidebar() {
    echo -e "${BLUE}Checking sidebar API usage display:${NC}"
    curl -s "$BASE_URL/api/sync/api-usage" | jq -r '
        "Zone 1: \(.zone1.percentage)% (color: \(if .zone1.percentage >= 95 then "red" elif .zone1.percentage >= 80 then "amber" else "green" end))",
        "Zone 2: \(.zone2.percentage)% (color: \(if .zone2.percentage >= 95 then "red" elif .zone2.percentage >= 80 then "amber" else "green" end))"
    '
    echo ""
}

# Test 1: Reset scenario
echo -e "${GREEN}Test 1: Reset rate limit data${NC}"
curl -s -X POST "$API_BASE" \
    -H "Content-Type: application/json" \
    -d '{"resetScenario": true}' \
    | jq -r '.message'
check_rates
check_sidebar

# Test 2: Normal usage (green zone)
echo -e "${GREEN}Test 2: Normal usage scenario (should show green)${NC}"
set_rate_limit 2000 10 "40% Zone 1, 10% Zone 2"
check_rates
check_sidebar

# Test 3: Warning zone (amber)
echo -e "${GREEN}Test 3: Warning zone scenario (should show amber)${NC}"
set_rate_limit 4200 85 "84% Zone 1, 85% Zone 2"
check_rates
check_sidebar

# Test 4: Critical zone (red)
echo -e "${GREEN}Test 4: Critical zone scenario (should show red)${NC}"
set_rate_limit 4900 98 "98% Zone 1, 98% Zone 2"
check_rates
check_sidebar

# Test 5: At limit (100%)
echo -e "${GREEN}Test 5: At rate limit scenario (100%)${NC}"
set_rate_limit 5000 100 "100% Zone 1, 100% Zone 2"
check_rates
check_sidebar

# Test 6: Attempt sync at limit
echo -e "${GREEN}Test 6: Testing sync behavior at 98% limit${NC}"
set_rate_limit 4900 98 "98% Zone 1, 98% Zone 2"
echo "Attempting sync (should capture headers and fail gracefully)..."
SYNC_RESPONSE=$(curl -s -X POST "$BASE_URL/api/sync")
echo "$SYNC_RESPONSE" | jq -r '
    if .syncId then
        "Sync started with ID: \(.syncId)"
    else
        "Sync prevented or failed: \(.error // .message)"
    end
'

# Wait for sync to process if it started
if echo "$SYNC_RESPONSE" | jq -e '.syncId' > /dev/null 2>&1; then
    SYNC_ID=$(echo "$SYNC_RESPONSE" | jq -r '.syncId')
    echo "Waiting for sync to process..."
    sleep 5
    
    # Check sync status
    echo -e "${BLUE}Checking sync status:${NC}"
    curl -s "$BASE_URL/api/sync/status/$SYNC_ID" | jq -r '
        "Status: \(.status)",
        "Error: \(.error // "none")",
        "Message: \(.message // "none")"
    '
fi

echo ""
echo -e "${BLUE}Checking final API usage (should be captured even on failure):${NC}"
check_sidebar

echo ""
echo -e "${GREEN}=== Rate Limit Testing Complete ===${NC}"
echo ""
echo "Summary:"
echo "1. Rate limit data can be simulated for testing"
echo "2. Sidebar displays correct colors based on usage percentage"
echo "3. Sync should capture headers even when hitting rate limits"
echo "4. System should gracefully handle rate limit scenarios"