# Base Path Migration: /reader → Root Domain

## Migration Overview

Convert from `/reader` base path (required for Tailscale multi-app hosting) to root domain hosting on `reader.uberfolks.ca` subdomain.

## Current vs Target Routes

### **Current Structure (with /reader prefix)**

```
Base URL: http://100.96.166.53:3000
Base Path: /reader

Routes:
├── /reader                           → Homepage
├── /reader/settings                  → Settings page
├── /reader/api/health                → Health API
├── /reader/api/sync                  → Sync API
├── /reader/api/inoreader/*           → Inoreader API proxy
└── /reader/api/auth/inoreader/*      → OAuth endpoints
```

### **Target Structure (root domain)**

```
Base URL: https://reader.uberfolks.ca
Base Path: / (root)

Routes:
├── /                                 → Homepage
├── /settings                         → Settings page
├── /api/health                       → Health API
├── /api/sync                         → Sync API
├── /api/inoreader/*                  → Inoreader API proxy
└── /api/auth/inoreader/*             → OAuth endpoints
```

## Code Changes Required

### **1. Next.js Configuration**

```javascript
// next.config.js
module.exports = {
  // REMOVE: basePath: '/reader',

  // Keep existing config
  experimental: {
    runtime: "experimental-edge",
  },

  // Update for CloudFlare
  images: {
    unoptimized: true, // CloudFlare Pages requirement
  },
};
```

### **2. Environment Variables**

```bash
# Current
NEXT_PUBLIC_APP_URL=http://100.96.166.53:3000
NEXT_PUBLIC_BASE_PATH=/reader

# Target
NEXT_PUBLIC_APP_URL=https://reader.uberfolks.ca
# Remove NEXT_PUBLIC_BASE_PATH entirely
```

### **3. API Route File Structure**

```bash
# Current API routes
src/app/api/health/route.ts                    # Accessible via /reader/api/health
src/app/api/sync/route.ts                      # Accessible via /reader/api/sync

# No changes needed - routes automatically work at root
src/app/api/health/route.ts                    # Will be accessible via /api/health
src/app/api/sync/route.ts                      # Will be accessible via /api/sync
```

### **4. Frontend Route References**

```typescript
// Update all internal navigation
// Before:
router.push('/reader/settings');
<Link href="/reader/dashboard">Dashboard</Link>

// After:
router.push('/settings');
<Link href="/dashboard">Dashboard</Link>

// Search for patterns to update:
// - router.push('/reader/*')
// - href="/reader/*"
// - pathname.includes('/reader')
// - redirect('/reader/*')
```

### **5. API Endpoint References**

```typescript
// Update API calls in frontend
// Before:
fetch("/reader/api/health");
fetch("/reader/api/sync");

// After:
fetch("/api/health");
fetch("/api/sync");

// Search for patterns:
// - fetch('/reader/api/*')
// - '/reader/api/*' in strings
// - API endpoint constants
```

## Migration Process

### **Step 1: Code Audit**

```bash
# Find all /reader references
grep -r "/reader" src/ --include="*.ts" --include="*.tsx"

# Find router.push patterns
grep -r "router\.push.*reader" src/

# Find Link href patterns
grep -r "href.*reader" src/
```

### **Step 2: Environment Variable Updates**

```bash
# Update all environment files
.env.local
.env.production
.env.example

# Update PM2 ecosystem config
ecosystem.config.js

# Update test setup
src/test-setup-integration.ts
```

### **Step 3: Configuration Changes**

```bash
# Update Next.js config
next.config.js

# Update any build scripts
package.json scripts

# Update documentation
README.md
docs/deployment/*
```

### **Step 4: Testing Strategy**

```bash
# 1. Test locally without base path
npm run dev  # Should work on http://localhost:3000 (not /reader)

# 2. Test all routes work at root
curl http://localhost:3000/api/health
curl http://localhost:3000/settings

# 3. Test API functionality
npm run test:integration

# 4. Deploy to CloudFlare staging for testing
wrangler deploy --env=staging
```

## Files Requiring Updates

### **High Priority (Core Functionality)**

- `next.config.js` - Remove basePath
- `.env*` files - Update NEXT_PUBLIC_APP_URL
- `src/app/layout.tsx` - Any base path references
- `src/components/Navigation/*` - Link hrefs
- `src/lib/api/*` - API endpoint URLs

### **Medium Priority (Features)**

- All component files with `router.push('/reader/*')`
- API route handlers with redirect URLs
- Test files with endpoint references
- Documentation files

### **Low Priority (Documentation)**

- README.md - Update URLs
- Documentation files with old URLs
- Comment references to /reader paths

## Validation Checklist

### **Pre-Migration Testing**

- [ ] All current functionality works with base path
- [ ] Tests pass with current configuration
- [ ] PM2 services are stable

### **Post-Migration Testing**

- [ ] Homepage loads at root domain (not /reader)
- [ ] All internal navigation works without /reader prefix
- [ ] API endpoints accessible at /api/\* paths
- [ ] Settings page loads and saves preferences
- [ ] OAuth callback handles new URL structure
- [ ] Sync operations work with new domain
- [ ] Multi-device sessions work across domain change

## Rollback Plan

### **If Migration Fails**

```bash
# 1. Revert Next.js config changes
git checkout next.config.js

# 2. Restore environment variables
git checkout .env*

# 3. Redeploy to Mac Mini
pm2 restart all

# 4. Update DNS back to original if needed
```

### **Incremental Migration Option**

```bash
# Option: Support both paths temporarily
# Keep /reader paths working while adding root paths
# Allows gradual migration and testing

# Implementation: Add route aliases
```

This migration removes the `/reader` prefix requirement and prepares the application for clean subdomain hosting on `reader.uberfolks.ca`.
