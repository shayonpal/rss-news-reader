#!/bin/bash

# Environment Variable Validation Script
# Purpose: Validate all required environment variables are present before build
# All variables are critical - any missing variable will fail validation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Validation status
VALIDATION_PASSED=true
MISSING_VARS=()

echo "=========================================="
echo "Environment Variable Validation"
echo "=========================================="
echo ""

# Load environment variables
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    # Use export to make variables available to this script
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
    echo -e "${GREEN}✓${NC} Environment file loaded: .env"
else
    echo -e "${RED}✗${NC} .env file not found!"
    exit 1
fi

echo ""
echo "Validating required environment variables..."
echo ""

# Define all required environment variables
# Client-side variables (NEXT_PUBLIC_*) - must be available at build time
CLIENT_VARS=(
    "NEXT_PUBLIC_SUPABASE_URL"
    "NEXT_PUBLIC_SUPABASE_ANON_KEY"
    "NEXT_PUBLIC_BASE_URL"
    "NEXT_PUBLIC_APP_URL"
    "NEXT_PUBLIC_INOREADER_CLIENT_ID"
    "NEXT_PUBLIC_INOREADER_REDIRECT_URI"
)

# Server-side variables - needed at runtime
SERVER_VARS=(
    "INOREADER_CLIENT_ID"
    "INOREADER_CLIENT_SECRET"
    "INOREADER_REDIRECT_URI"
    "ANTHROPIC_API_KEY"
    "CLAUDE_SUMMARIZATION_MODEL"
    "TOKEN_ENCRYPTION_KEY"
    "SUPABASE_SERVICE_ROLE_KEY"
    "SERVER_PORT"
    "RSS_READER_TOKENS_PATH"
    "SYNC_MAX_ARTICLES"
    "ARTICLES_RETENTION_LIMIT"
    "SUMMARY_WORD_COUNT"
    "SUMMARY_FOCUS"
    "SUMMARY_STYLE"
    "TEST_INOREADER_EMAIL"
    "TEST_INOREADER_PASSWORD"
    "NODE_ENV"
)

# Development specific variables (production retired per RR-92)
ENV_SPECIFIC_VARS=(
    "DEV_PORT"
    "DEV_NODE_ENV"
    "DEV_NEXT_PUBLIC_BASE_URL"
)

# Function to check if a variable is set and not empty
check_var() {
    local var_name=$1
    local var_category=$2
    
    if [[ -z "${!var_name:-}" ]]; then
        echo -e "${RED}✗${NC} Missing: $var_name [$var_category]"
        MISSING_VARS+=("$var_name")
        VALIDATION_PASSED=false
    else
        # For sensitive variables, show masked value
        if [[ "$var_name" == *"KEY"* ]] || [[ "$var_name" == *"SECRET"* ]] || [[ "$var_name" == *"PASSWORD"* ]]; then
            echo -e "${GREEN}✓${NC} Found: $var_name = ****** [$var_category]"
        else
            # For URLs and non-sensitive values, show partial value
            local value="${!var_name}"
            if [[ ${#value} -gt 50 ]]; then
                echo -e "${GREEN}✓${NC} Found: $var_name = ${value:0:47}... [$var_category]"
            else
                echo -e "${GREEN}✓${NC} Found: $var_name = $value [$var_category]"
            fi
        fi
    fi
}

# Check client-side variables
echo -e "${BLUE}Client-Side Variables (NEXT_PUBLIC_*)${NC}"
echo "These must be available at build time:"
echo ""
for var in "${CLIENT_VARS[@]}"; do
    check_var "$var" "Client"
done

echo ""
echo -e "${BLUE}Server-Side Variables${NC}"
echo "These are needed at runtime:"
echo ""
for var in "${SERVER_VARS[@]}"; do
    check_var "$var" "Server"
done

echo ""
echo -e "${BLUE}Environment-Specific Variables${NC}"
echo "These configure different environments:"
echo ""
for var in "${ENV_SPECIFIC_VARS[@]}"; do
    check_var "$var" "Config"
done

# Additional validation checks
echo ""
echo -e "${BLUE}Additional Validation Checks${NC}"
echo ""

# Check if URLs are valid format
if [[ -n "${NEXT_PUBLIC_SUPABASE_URL:-}" ]] && [[ ! "$NEXT_PUBLIC_SUPABASE_URL" =~ ^https?:// ]]; then
    echo -e "${RED}✗${NC} Invalid URL format: NEXT_PUBLIC_SUPABASE_URL"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}✓${NC} Valid URL format: NEXT_PUBLIC_SUPABASE_URL"
fi

if [[ -n "${NEXT_PUBLIC_BASE_URL:-}" ]] && [[ ! "$NEXT_PUBLIC_BASE_URL" =~ ^https?:// ]]; then
    echo -e "${RED}✗${NC} Invalid URL format: NEXT_PUBLIC_BASE_URL"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}✓${NC} Valid URL format: NEXT_PUBLIC_BASE_URL"
fi

# Check if NODE_ENV is valid
if [[ -n "${NODE_ENV:-}" ]] && [[ "$NODE_ENV" != "development" ]] && [[ "$NODE_ENV" != "production" ]] && [[ "$NODE_ENV" != "test" ]]; then
    echo -e "${RED}✗${NC} Invalid NODE_ENV value: $NODE_ENV (must be development, production, or test)"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}✓${NC} Valid NODE_ENV: ${NODE_ENV:-not set}"
fi

# Check if numeric values are valid
if [[ -n "${SYNC_MAX_ARTICLES:-}" ]] && ! [[ "$SYNC_MAX_ARTICLES" =~ ^[0-9]+$ ]]; then
    echo -e "${RED}✗${NC} Invalid numeric value: SYNC_MAX_ARTICLES = $SYNC_MAX_ARTICLES"
    VALIDATION_PASSED=false
else
    echo -e "${GREEN}✓${NC} Valid numeric: SYNC_MAX_ARTICLES"
fi

# Summary
echo ""
echo "=========================================="
echo "Validation Summary"
echo "=========================================="
echo ""

if [[ "$VALIDATION_PASSED" == true ]]; then
    echo -e "${GREEN}✓ All environment variables validated successfully!${NC}"
    echo ""
    echo "Build can proceed safely."
    exit 0
else
    echo -e "${RED}✗ Environment validation failed!${NC}"
    echo ""
    echo "Missing variables:"
    for var in "${MISSING_VARS[@]}"; do
        echo "  - $var"
    done
    echo ""
    echo "Please add all missing variables to your .env file"
    echo "Refer to .env.example for documentation"
    exit 1
fi