#!/bin/bash

# rollback-last-build.sh - Emergency rollback script for RSS News Reader
# Addresses TODO-039b Phase 3c: Create rollback script for failed builds

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo "RSS News Reader - Emergency Rollback Script"
echo "==========================================="

# Find the most recent backup
LATEST_BACKUP=$(find "$PROJECT_ROOT" -name ".next-backup-*" -type d | sort -r | head -n 1)

if [[ -z "$LATEST_BACKUP" ]]; then
    echo -e "${RED}✗${NC} No backup found to rollback to"
    echo ""
    echo "Available options:"
    echo "  1. Rebuild from source: npm run build"
    echo "  2. Check git history: git log --oneline"
    echo "  3. Reset to last working commit"
    echo ""
    exit 1
fi

echo -e "${BLUE}ℹ${NC} Latest backup found: $(basename "$LATEST_BACKUP")"
echo ""

# Show current status
echo "Current Status:"
echo "==============="
if [[ -d "$PROJECT_ROOT/.next" ]]; then
    CURRENT_SIZE=$(du -sh "$PROJECT_ROOT/.next" | cut -f1)
    echo -e "${YELLOW}Current build:${NC} $CURRENT_SIZE"
else
    echo -e "${RED}Current build:${NC} Missing or corrupted"
fi

BACKUP_SIZE=$(du -sh "$LATEST_BACKUP" | cut -f1)
BACKUP_DATE=$(basename "$LATEST_BACKUP" | sed 's/.next-backup-//' | sed 's/\(.....\)\(..\)\(..\)-\(..\)\(..\)\(..\)/\1-\2-\3 \4:\5:\6/')
echo -e "${GREEN}Backup available:${NC} $BACKUP_SIZE (from $BACKUP_DATE)"

echo ""

# Confirmation prompt
read -p "Do you want to rollback to this backup? [y/N]: " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo "Step 1: Stopping PM2 services..."
echo "================================"

# Stop the production service
if pm2 stop rss-reader-prod 2>/dev/null; then
    echo -e "${GREEN}✓${NC} Stopped rss-reader-prod"
else
    echo -e "${YELLOW}⚠${NC} rss-reader-prod was not running"
fi

echo ""
echo "Step 2: Creating emergency backup of current state..."
echo "====================================================="

# Backup current state before rollback
EMERGENCY_BACKUP="$PROJECT_ROOT/.next-emergency-$(date +%Y%m%d-%H%M%S)"
if [[ -d "$PROJECT_ROOT/.next" ]]; then
    mv "$PROJECT_ROOT/.next" "$EMERGENCY_BACKUP"
    echo -e "${GREEN}✓${NC} Current state backed up to: $(basename "$EMERGENCY_BACKUP")"
else
    echo -e "${BLUE}ℹ${NC} No current build to backup"
fi

echo ""
echo "Step 3: Restoring from backup..."
echo "================================"

# Restore from backup
if cp -r "$LATEST_BACKUP" "$PROJECT_ROOT/.next"; then
    echo -e "${GREEN}✓${NC} Successfully restored from backup"
else
    echo -e "${RED}✗${NC} Failed to restore from backup"
    
    # Attempt to restore emergency backup
    if [[ -d "$EMERGENCY_BACKUP" ]]; then
        echo "Restoring emergency backup..."
        mv "$EMERGENCY_BACKUP" "$PROJECT_ROOT/.next"
        echo -e "${YELLOW}⚠${NC} Restored to previous state"
    fi
    
    exit 1
fi

echo ""
echo "Step 4: Validating rolled-back build..."
echo "======================================="

# Quick validation of the rollback
VALIDATION_SCRIPT="$SCRIPT_DIR/validate-build.sh"
if [[ -f "$VALIDATION_SCRIPT" && -x "$VALIDATION_SCRIPT" ]]; then
    echo "Running build validation on rollback..."
    
    if "$VALIDATION_SCRIPT" quick; then
        echo -e "${GREEN}✓${NC} Rollback validation passed"
    else
        echo -e "${RED}✗${NC} Rollback validation failed"
        echo "The backup may also be corrupted. Consider rebuilding from source."
    fi
else
    echo -e "${YELLOW}⚠${NC} Validation script not available"
fi

echo ""
echo "Step 5: Restarting PM2 services..."
echo "=================================="

# Restart PM2 service
if pm2 restart rss-reader-prod; then
    echo -e "${GREEN}✓${NC} PM2 service restarted successfully"
else
    echo -e "${RED}✗${NC} PM2 restart failed"
    echo "Manual intervention required. Check PM2 logs: pm2 logs rss-reader-prod"
    exit 1
fi

# Wait for service to start
sleep 5

echo ""
echo "Step 6: Post-rollback health check..."
echo "====================================="

# Health check
if curl -s --max-time 10 "http://100.96.166.53:3147/api/health/app?ping=true" >/dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Service is responding to health checks"
else
    echo -e "${RED}✗${NC} Service is not responding to health checks"
    echo "Check PM2 logs: pm2 logs rss-reader-prod"
fi

echo ""
echo "Rollback Summary:"
echo "================="
echo -e "${GREEN}✓${NC} Rolled back to: $BACKUP_DATE"
echo -e "${BLUE}ℹ${NC} Emergency backup: $(basename "$EMERGENCY_BACKUP")"
echo -e "${BLUE}ℹ${NC} Original backup: $(basename "$LATEST_BACKUP")"

echo ""
echo "Next Steps:"
echo "==========="
echo "1. Verify the application is working: http://100.96.166.53:3147/reader"
echo "2. Check PM2 status: pm2 list"
echo "3. Monitor logs: pm2 logs rss-reader-prod"
echo "4. Investigate the original issue before rebuilding"
echo ""

# Clean up old emergency backups (keep last 2)
find "$PROJECT_ROOT" -name ".next-emergency-*" -type d | sort -r | tail -n +3 | xargs rm -rf 2>/dev/null || true

echo -e "${GREEN}Rollback completed successfully!${NC}"