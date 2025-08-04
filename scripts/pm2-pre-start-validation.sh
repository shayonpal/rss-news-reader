#!/bin/bash

# pm2-pre-start-validation.sh - PM2 pre-start validation hook
# Addresses TODO-039b Phase 3b: Update PM2 ecosystem config with validation

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "PM2 Pre-Start Validation Hook"
echo "=============================="

# Validate service starts
echo "Service ${1:-unknown} - performing basic validation..."

# Basic environment check
if [[ ! -f "$PROJECT_ROOT/.env" ]]; then
    echo -e "${RED}✗${NC} No .env file found"
    echo "Run: cp .env.example .env and configure"
    exit 1
fi

echo -e "${GREEN}✓${NC} Basic validation passed - allowing service start"

echo -e "${GREEN}✓${NC} Pre-start validation completed"
exit 0