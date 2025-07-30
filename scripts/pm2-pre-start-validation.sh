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

# Only validate production service starts
if [[ "${1:-}" == "rss-reader-prod" ]]; then
    echo "Validating production service before start..."
    
    # Check if build exists
    if [[ ! -d "$PROJECT_ROOT/.next" ]]; then
        echo -e "${RED}✗${NC} No build found - cannot start production service"
        echo "Run: npm run build or ./scripts/build-and-start-prod.sh"
        exit 1
    fi
    
    # Run quick validation
    VALIDATION_SCRIPT="$SCRIPT_DIR/validate-build.sh"
    if [[ -f "$VALIDATION_SCRIPT" && -x "$VALIDATION_SCRIPT" ]]; then
        echo "Running quick build validation..."
        
        if "$VALIDATION_SCRIPT" quick >/dev/null 2>&1; then
            echo -e "${GREEN}✓${NC} Build validation passed - allowing service start"
        else
            echo -e "${RED}✗${NC} Build validation failed - preventing service start"
            echo "Check validation logs: cat logs/build-validation.log"
            echo "Fix issues and rebuild before starting production service"
            exit 1
        fi
    else
        echo -e "${YELLOW}⚠${NC} Validation script not available - allowing start"
    fi
    
else
    echo "Service ${1:-unknown} - no validation required"
fi

echo -e "${GREEN}✓${NC} Pre-start validation completed"
exit 0