#!/bin/bash
# Script to test RR-119 health endpoints behavior

echo "=== Testing RR-119 Health Endpoints ==="
echo ""

BASE_URL="http://localhost:3000/reader/api/health"

# Test each endpoint
echo "1. Testing /api/health/app endpoint:"
echo "Response:"
curl -s "${BASE_URL}/app" | jq '.'
echo ""

echo "2. Testing /api/health/db endpoint:"
echo "Response:"
curl -s "${BASE_URL}/db" | jq '.'
echo ""

echo "3. Testing /api/health/cron endpoint:"
echo "Response:"
curl -s "${BASE_URL}/cron" | jq '.'
echo ""

echo "4. Testing /api/health/freshness endpoint:"
echo "Response:"
curl -s "${BASE_URL}/freshness" | jq '.'
echo ""

# Verify key fields
echo "=== Verification Summary ==="
echo ""

echo "Checking environment field presence:"
curl -s "${BASE_URL}/app" | jq -r '.environment // "MISSING"' | xargs -I {} echo "- /api/health/app: {}"
curl -s "${BASE_URL}/db" | jq -r '.environment // "MISSING"' | xargs -I {} echo "- /api/health/db: {}"
curl -s "${BASE_URL}/cron" | jq -r '.environment // "MISSING"' | xargs -I {} echo "- /api/health/cron: {}"
curl -s "${BASE_URL}/freshness" | jq -r '.environment // "MISSING"' | xargs -I {} echo "- /api/health/freshness: {}"
echo ""

echo "Checking status codes (all should be 200):"
curl -s -o /dev/null -w "- /api/health/app: %{http_code}\n" "${BASE_URL}/app"
curl -s -o /dev/null -w "- /api/health/db: %{http_code}\n" "${BASE_URL}/db"
curl -s -o /dev/null -w "- /api/health/cron: %{http_code}\n" "${BASE_URL}/cron"
curl -s -o /dev/null -w "- /api/health/freshness: %{http_code}\n" "${BASE_URL}/freshness"
echo ""

echo "Test complete!"