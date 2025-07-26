# Investigation Report: Articles Not Loading from Supabase

**Date**: Saturday, July 26, 2025 at 2:09 PM  
**Issue**: Articles not loading from Supabase on page load  
**Environments Affected**: Production and Development  
**Status**: Production fixed, Development still affected  

## Executive Summary

Investigated why the RSS News Reader PWA was showing "No feeds yet" despite having 69 feeds and 1,033 articles in the Supabase database. The root cause was environment variables not being properly included in the client-side JavaScript bundle during the Next.js build process.

## Problem Description

- Both production (http://100.96.166.53:3147/reader) and development (http://100.96.166.53:3000/reader) showed "No feeds yet"
- UI loaded correctly but no data was displayed
- Database confirmed to have data: 69 feeds, 1,033 articles for user 'shayon'

## Investigation Process

### 1. Initial Checks
- Verified PM2 processes were running
- Checked production app status - found it was erroring with missing build files
- Confirmed database connectivity via supabase-dba agent

### 2. Build Issues Discovered
- Production build was missing `_not-found/page.js` file
- BUILD_ID file was missing from .next directory
- Created temporary _error.tsx to fix build process

### 3. Environment Variable Investigation
- Found that ecosystem.config.js was using `process.env` variables which weren't available at PM2 start time
- Added `require('dotenv').config()` to ecosystem.config.js
- Discovered that NEXT_PUBLIC_* variables need to be available at build time, not runtime

### 4. Database Verification
Using supabase-dba agent confirmed:
- Database is accessible and responding correctly
- 3 users exist, main user 'shayon' has 69 feeds and 1,033 articles
- Row Level Security policies are correctly configured
- Supabase connection credentials are correct

## Root Cause Analysis

The issue stems from how Next.js handles environment variables:
1. `NEXT_PUBLIC_*` variables must be available at **build time** to be included in client-side bundles
2. PM2's runtime environment injection doesn't solve this problem
3. The Supabase client initialization was failing because these variables were undefined in the browser

## Solutions Implemented

### 1. Fixed ecosystem.config.js
```javascript
require('dotenv').config();  // Added this line

module.exports = {
  apps: [
    // ... app configurations
  ]
};
```

### 2. Created Build Script
Created `/scripts/build-and-start-prod.sh`:
```bash
#!/bin/bash
source .env
export NEXT_PUBLIC_SUPABASE_URL
export NEXT_PUBLIC_SUPABASE_ANON_KEY
export NEXT_PUBLIC_BASE_URL="http://100.96.166.53"

npm run build
pm2 restart rss-reader-prod
```

### 3. Rebuilt Production
- Ran the build script with proper environment variables
- Production app now working correctly

## Current Status

- **Production (3147)**: ✅ Working - Successfully loading articles after rebuild
- **Development (3000)**: ❌ Still failing - Environment variables not properly loaded

## Proposed Solutions

### For Development Environment
1. **Option 1**: Create a dev-specific build script similar to production
2. **Option 2**: Use `.env.development` file with proper variable loading
3. **Option 3**: Modify the dev server startup to ensure environment variables are loaded

### Long-term Improvements
1. **Environment Management**:
   - Consider using `.env.production` and `.env.development` files
   - Implement a pre-build script that validates all required environment variables
   
2. **Build Process**:
   - Add environment variable validation to the build process
   - Create a unified build script that handles both dev and prod environments
   
3. **Monitoring**:
   - Implement health checks that verify Supabase connectivity
   - Add startup logs that confirm environment variables are loaded
   
4. **Documentation**:
   - Document the environment variable requirements clearly
   - Add troubleshooting guide for common environment issues

## Files Modified

- `ecosystem.config.js` - Added dotenv loading
- `tsconfig.json` - Excluded docs folder from build  
- `/scripts/build-and-start-prod.sh` - Created new build script
- `src/app/_error.tsx` - Created temporarily then removed

## Lessons Learned

1. Next.js environment variable handling is different for client vs server code
2. PM2 environment injection happens at runtime, not build time
3. Always verify that NEXT_PUBLIC_* variables are available during the build process
4. Database connectivity doesn't guarantee client-side initialization success

## Next Steps

1. Fix development environment using one of the proposed solutions
2. Add environment variable validation to the build process
3. Update documentation with clear environment setup instructions
4. Consider implementing automated health checks for all critical services