#!/bin/bash

# Enhanced build script with validation (TODO-039b Phase 3a)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "RSS News Reader - Enhanced Build and Deploy Script"
echo "=================================================="

# Load environment variables
if [[ -f "$PROJECT_ROOT/.env" ]]; then
    # Load variables into current shell
    set -a
    source "$PROJECT_ROOT/.env"
    set +a
    echo -e "${GREEN}✓${NC} Environment variables loaded"
else
    echo -e "${RED}✗${NC} .env file not found"
    exit 1
fi

# Run environment validation
echo ""
echo "Validating environment variables..."
if "$SCRIPT_DIR/validate-env.sh"; then
    echo -e "${GREEN}✓${NC} Environment validation passed"
else
    echo -e "${RED}✗${NC} Environment validation failed"
    exit 1
fi

# Export all NEXT_PUBLIC_* variables for the build
# These must be available at build time for Next.js to embed them
export NEXT_PUBLIC_SUPABASE_URL
export NEXT_PUBLIC_SUPABASE_ANON_KEY
export NEXT_PUBLIC_BASE_URL="${NEXT_PUBLIC_BASE_URL:-http://100.96.166.53}"
export NEXT_PUBLIC_APP_URL="${NEXT_PUBLIC_APP_URL:-http://100.96.166.53:3147}"
export NEXT_PUBLIC_INOREADER_CLIENT_ID
export NEXT_PUBLIC_INOREADER_REDIRECT_URI

# Also export other critical variables
export NODE_ENV="${PROD_NODE_ENV:-production}"
export PORT="${PROD_PORT:-3147}"

echo ""
echo "Build-time environment variables exported:"
echo "  NEXT_PUBLIC_SUPABASE_URL: ${NEXT_PUBLIC_SUPABASE_URL:0:50}..."
echo "  NEXT_PUBLIC_BASE_URL: $NEXT_PUBLIC_BASE_URL"
echo "  NEXT_PUBLIC_APP_URL: $NEXT_PUBLIC_APP_URL"
echo "  NODE_ENV: $NODE_ENV"
echo "  PORT: $PORT"

echo ""
echo "Step 1: Building application..."
echo "==============================="
if npm run build; then
    echo -e "${GREEN}✓${NC} Build completed successfully"
else
    echo -e "${RED}✗${NC} Build failed"
    exit 1
fi

echo ""
echo "Step 2: Validating build..."
echo "==========================="

# Run build validation script
VALIDATION_SCRIPT="$SCRIPT_DIR/validate-build.sh"
if [[ -f "$VALIDATION_SCRIPT" && -x "$VALIDATION_SCRIPT" ]]; then
    echo "Running build validation (quick mode)..."
    
    if "$VALIDATION_SCRIPT" quick; then
        echo -e "${GREEN}✓${NC} Build validation passed"
    else
        echo -e "${RED}✗${NC} Build validation failed"
        echo ""
        echo "Build validation detected critical issues."
        echo "Production restart cancelled to prevent broken deployment."
        echo ""
        echo "To investigate:"
        echo "  1. Check validation logs: cat logs/build-validation.log"
        echo "  2. Run full validation: ./scripts/validate-build.sh full"
        echo "  3. Fix issues and rebuild"
        echo ""
        exit 1
    fi
else
    echo -e "${YELLOW}⚠${NC} Build validation script not found or not executable"
    echo "Proceeding without validation (not recommended)"
fi

echo ""
echo "Step 3: Restarting production server..."
echo "======================================="

# Create backup of current deployment (for rollback)
BACKUP_DIR="$PROJECT_ROOT/.next-backup-$(date +%Y%m%d-%H%M%S)"
if [[ -d "$PROJECT_ROOT/.next" ]]; then
    echo "Creating backup: $BACKUP_DIR"
    cp -r "$PROJECT_ROOT/.next" "$BACKUP_DIR"
    echo -e "${GREEN}✓${NC} Backup created for rollback capability"
fi

# Restart PM2 service
if pm2 restart rss-reader-prod; then
    echo -e "${GREEN}✓${NC} PM2 service restarted successfully"
else
    echo -e "${RED}✗${NC} PM2 restart failed"
    
    # Attempt rollback if backup exists
    if [[ -d "$BACKUP_DIR" ]]; then
        echo ""
        echo "Attempting automatic rollback..."
        rm -rf "$PROJECT_ROOT/.next"
        mv "$BACKUP_DIR" "$PROJECT_ROOT/.next"
        pm2 restart rss-reader-prod
        echo -e "${YELLOW}⚠${NC} Rolled back to previous version"
    fi
    
    exit 1
fi

echo ""
echo "Step 4: Post-deployment validation..."
echo "====================================="

# Wait for service to start
sleep 5

# Quick health check
if curl -s --max-time 10 "http://100.96.166.53:3147/api/health/app?ping=true" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Service is responding to health checks"
else
    echo -e "${RED}✗${NC} Service is not responding to health checks"
    echo "Check PM2 logs: pm2 logs rss-reader-prod"
fi

# Clean up old backups (keep last 3)
find "$PROJECT_ROOT" -name ".next-backup-*" -type d | sort -r | tail -n +4 | xargs rm -rf 2>/dev/null || true

echo ""
echo -e "${GREEN}Deployment completed successfully!${NC}"
echo "Monitor the service: pm2 monit"