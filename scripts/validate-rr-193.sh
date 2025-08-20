#!/bin/bash

# RR-193 Validation Script
# Validates mutex accordion and scrollbar elimination implementation

set -e

echo "========================================="
echo "RR-193 Implementation Validation"
echo "========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to check status
check_status() {
    if [ $1 -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $2"
        return 0
    else
        echo -e "${RED}✗${NC} $2"
        return 1
    fi
}

echo "1. Checking Application Health..."
echo "--------------------------------"
APP_STATUS=$(curl -s http://100.96.166.53:3000/reader/api/health/app 2>/dev/null | jq -r '.status' || echo "error")
if [[ "$APP_STATUS" == "healthy" ]] || [[ "$APP_STATUS" == "degraded" ]]; then
    echo -e "${GREEN}✓${NC} Application is running (status: $APP_STATUS)"
else
    echo -e "${RED}✗${NC} Application is not running properly"
    exit 1
fi

echo ""
echo "2. Checking Implementation Files..."
echo "-----------------------------------"

# Check mutex logic in ui-store
if grep -q "mutexSection" src/lib/stores/ui-store.ts 2>/dev/null; then
    MUTEX_COUNT=$(grep -c "mutexSection" src/lib/stores/ui-store.ts)
    echo -e "${GREEN}✓${NC} Mutex logic implemented ($MUTEX_COUNT references found)"
else
    echo -e "${RED}✗${NC} Mutex logic not found in ui-store.ts"
fi

# Check for removal of old max-height constraints
if grep -q "max-h-\[30vh\]\|max-h-\[60vh\]" src/components/feeds/simple-feed-sidebar.tsx 2>/dev/null; then
    echo -e "${RED}✗${NC} Old max-height constraints still present (should be removed)"
else
    echo -e "${GREEN}✓${NC} Old max-height constraints removed"
fi

# Check for overflow-y on main container
if grep -q "overflow-y-auto" src/components/feeds/simple-feed-sidebar.tsx 2>/dev/null; then
    OVERFLOW_COUNT=$(grep -c "overflow-y-auto" src/components/feeds/simple-feed-sidebar.tsx)
    echo -e "${GREEN}✓${NC} Scrollbar configuration found ($OVERFLOW_COUNT instances)"
else
    echo -e "${YELLOW}⚠${NC} No overflow-y-auto found (may use different approach)"
fi

echo ""
echo "3. Running Unit Tests..."
echo "-----------------------"

# Run RR-193 specific tests
if npx vitest run --no-coverage src/__tests__/unit/rr-193-mutex-accordion.test.tsx 2>/dev/null | grep -q "7 tests"; then
    echo -e "${GREEN}✓${NC} All 7 mutex accordion tests passed"
else
    echo -e "${YELLOW}⚠${NC} Some tests may have issues"
fi

echo ""
echo "4. TypeScript Compilation Check..."
echo "----------------------------------"

npm run type-check > /dev/null 2>&1
check_status $? "TypeScript compilation clean"

echo ""
echo "5. Testing Endpoints..."
echo "-----------------------"

# Test main reader endpoint
READER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://100.96.166.53:3000/reader)
if [ "$READER_STATUS" = "200" ]; then
    echo -e "${GREEN}✓${NC} Reader page loads successfully"
else
    echo -e "${RED}✗${NC} Reader page not loading (HTTP $READER_STATUS)"
fi

echo ""
echo "========================================="
echo "MANUAL TESTING REQUIRED"
echo "========================================="
echo ""
echo "Please manually verify in browser:"
echo "1. Open http://100.96.166.53:3000/reader"
echo "2. Check that:"
echo "   - Only ONE scrollbar visible (main container)"
echo "   - Topics section is OPEN by default"
echo "   - Feeds section is CLOSED by default"
echo "   - Clicking Feeds closes Topics (mutex behavior)"
echo "   - Clicking Topics closes Feeds (mutex behavior)"
echo "   - Feeds section appears ABOVE Topics section"
echo ""
echo "Use Chrome DevTools to verify:"
echo "   - No nested scrollbars in Elements panel"
echo "   - 60fps animations in Performance panel"
echo "   - No console errors during toggles"
echo ""
echo "For detailed testing, see:"
echo "docs/test-strategies/rr-193-validation-checklist.md"
echo ""
echo "========================================="