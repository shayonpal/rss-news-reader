#!/bin/bash

# Test all health endpoints for RSS News Reader
# This script verifies that all health endpoints are accessible and returning expected data

set -euo pipefail

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "Testing RSS News Reader Health Endpoints"
echo "========================================"

# Function to test an endpoint
test_endpoint() {
    local name=$1
    local url=$2
    local expected_service=$3
    
    echo -n "Testing $name... "
    
    # Make the request and capture response and status code
    response=$(curl -s -w "\n%{http_code}" "$url" 2>/dev/null || echo "CURL_ERROR")
    
    if [[ "$response" == "CURL_ERROR" ]]; then
        echo -e "${RED}✗ Failed${NC} - Could not connect"
        return 1
    fi
    
    # Split response and status code
    http_code=$(echo "$response" | tail -n1)
    # Get all lines except the last one
    json_response=$(echo "$response" | sed '$d')
    
    # Check if we got a valid response
    if [[ -z "$json_response" ]]; then
        echo -e "${RED}✗ Failed${NC} - Empty response"
        return 1
    fi
    
    # Parse JSON and check service name
    service=$(echo "$json_response" | jq -r '.service' 2>/dev/null || echo "PARSE_ERROR")
    status=$(echo "$json_response" | jq -r '.status' 2>/dev/null || echo "PARSE_ERROR")
    
    if [[ "$service" == "PARSE_ERROR" ]]; then
        echo -e "${RED}✗ Failed${NC} - Invalid JSON response"
        return 1
    fi
    
    # Handle old format (production not rebuilt yet)
    if [[ "$service" == "null" ]] || [[ "$service" == "" ]]; then
        # Check for old format
        overall=$(echo "$json_response" | jq -r '.overall' 2>/dev/null || echo "")
        if [[ -n "$overall" ]]; then
            echo -e "${YELLOW}⚠ Old Format${NC} - Needs rebuild (Status: $overall)"
            return 0
        else
            echo -e "${RED}✗ Failed${NC} - No service field found"
            return 1
        fi
    fi
    
    if [[ "$service" != "$expected_service" ]]; then
        echo -e "${RED}✗ Failed${NC} - Wrong service: $service (expected $expected_service)"
        return 1
    fi
    
    # Check HTTP status code
    if [[ "$http_code" == "200" ]]; then
        if [[ "$status" == "healthy" ]]; then
            echo -e "${GREEN}✓ Healthy${NC} (HTTP $http_code)"
        elif [[ "$status" == "degraded" ]]; then
            echo -e "${YELLOW}⚠ Degraded${NC} (HTTP $http_code)"
        else
            echo -e "${YELLOW}⚠ Status: $status${NC} (HTTP $http_code)"
        fi
    elif [[ "$http_code" == "503" ]]; then
        echo -e "${RED}✗ Unhealthy${NC} (HTTP $http_code) - Status: $status"
    else
        echo -e "${RED}✗ Failed${NC} - Unexpected HTTP status: $http_code"
        return 1
    fi
    
    # Show additional details
    if command -v jq &> /dev/null; then
        echo "  └─ Uptime: $(echo "$json_response" | jq -r '.uptime') seconds"
        echo "  └─ Error Count: $(echo "$json_response" | jq -r '.errorCount')"
        
        # Show dependencies if present
        deps=$(echo "$json_response" | jq -r '.dependencies | to_entries[] | "  └─ \(.key): \(.value)"' 2>/dev/null)
        if [[ -n "$deps" ]]; then
            echo "$deps"
        fi
    fi
    
    echo ""
    return 0
}

# Test all endpoints
echo "Development Environment:"
echo "-----------------------"
test_endpoint "Dev App Health" "http://localhost:3000/reader/api/health/app" "rss-reader-app"

echo "Production Environment:"
echo "----------------------"
test_endpoint "App Health" "http://localhost:3000/reader/api/health/app" "rss-reader-app"
test_endpoint "Cron Service Health" "http://localhost:3000/reader/api/health/cron" "rss-sync-cron"

echo "Sync Server:"
echo "-----------"
test_endpoint "Bi-directional Sync" "http://localhost:3001/server/health" "rss-sync-server"

echo "Summary"
echo "======="
echo "Configure these endpoints in Uptime Kuma following the guide at:"
echo "docs/monitoring/server-health-endpoints.md"