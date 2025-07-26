#!/bin/bash

# Script to safely backup .claude directory to dev branch only

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Starting .claude backup to dev branch...${NC}"

# Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check if there are any changes to .claude
if ! git status --porcelain .claude | grep -q .; then
    echo -e "${GREEN}No changes in .claude directory to backup.${NC}"
    exit 0
fi

# If we're on main, switch to dev
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo -e "${YELLOW}Currently on main branch. Switching to dev...${NC}"
    
    # Stash any changes first
    git stash push -m "Temp stash for .claude backup" .claude
    
    # Switch to dev
    git checkout dev
    
    # Apply the stash
    git stash pop
elif [ "$CURRENT_BRANCH" != "dev" ]; then
    echo -e "${RED}ERROR: Must be on either main or dev branch to run this script.${NC}"
    echo "Current branch: $CURRENT_BRANCH"
    exit 1
fi

# Now we're on dev branch, add and commit .claude
echo -e "${GREEN}Adding .claude directory changes...${NC}"
git add .claude/

# Generate commit message
TIMESTAMP=$(date "+%Y-%m-%d %H:%M:%S")
COMMIT_MSG="backup: .claude directory ($TIMESTAMP)"

echo -e "${GREEN}Committing with message: $COMMIT_MSG${NC}"
git commit -m "$COMMIT_MSG"

echo -e "${GREEN}✓ .claude directory backed up to dev branch successfully!${NC}"
echo -e "${YELLOW}Note: Changes are committed locally. Run 'git push origin dev' when ready.${NC}"

# If we switched from main, offer to switch back
if [ "$CURRENT_BRANCH" = "main" ]; then
    echo -e "${YELLOW}You were on main branch. Would you like to switch back? (y/n)${NC}"
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        git checkout main
        echo -e "${GREEN}Switched back to main branch.${NC}"
    fi
fi