# CloudFlare Migration Summary

## Complete Migration Strategy

Transform RSS News Reader from Tailscale-only Mac Mini hosting to public CloudFlare Pages + Workers hosting with shared production OAuth for comprehensive development testing.

## Key Decisions Made

### **Hosting Strategy**

- **Target**: CloudFlare Pages + Workers on `reader.uberfolks.ca`
- **Cost**: $0/month (within free tier for 5-10 users)
- **Deployment**: Auto-deploy from GitHub main branch
- **Benefits**: Professional hosting, global CDN, 99.9% uptime, zero maintenance

### **Base Path Migration**

- **Remove**: `/reader` prefix from all routes (Next.js basePath removal)
- **Target**: Clean subdomain hosting on root paths
- **Impact**: Update all route references, environment variables, API calls

### **OAuth Development Strategy**

- **Approach**: Shared production OAuth for both development and production
- **Callback URL**: Single stable URL `https://reader.uberfolks.ca/api/auth/inoreader/callback`
- **Database**: Shared Supabase instance for real feature testing
- **Benefits**: Real sync testing, actual API integration, full feature validation

## Implementation Timeline

### **Total Duration: 3 days**

**Day 1: Base Path Migration**

- Remove `/reader` prefix from codebase
- Update Next.js configuration
- Update environment variables
- Test locally without base path

**Day 2: CloudFlare Deployment**

- Configure wrangler.toml
- Set up DNS for reader.uberfolks.ca
- Deploy to CloudFlare with auto-deploy setup
- Configure environment variables and secrets

**Day 3: OAuth Integration**

- Update Inoreader app callback URL
- Test production OAuth flow
- Validate shared database development workflow
- Complete end-to-end testing

## Development Workflow Impact

### **Before (Tailscale)**

```bash
npm run dev → http://localhost:3000/reader (Tailscale required)
# Mock/limited testing
pm2 restart → Manual deployment
```

### **After (CloudFlare)**

```bash
npm run dev → http://localhost:3000 (public OAuth)
# Real feature testing with production data
git push → Auto-deployment to CloudFlare
```

## Required Updates

### **Codebase Changes**

- Remove all `/reader` path references
- Update Next.js basePath configuration
- Update environment variables for new domain
- Update API endpoint references

### **Infrastructure Changes**

- CloudFlare Pages + Workers deployment
- DNS configuration for reader.uberfolks.ca
- GitHub auto-deploy integration
- Inoreader OAuth callback URL update

### **Environment Variables**

```bash
# New values
NEXT_PUBLIC_APP_URL=https://reader.uberfolks.ca
INOREADER_REDIRECT_URI=https://reader.uberfolks.ca/api/auth/inoreader/callback

# Removed
NEXT_PUBLIC_BASE_PATH=/reader
```

## Benefits Summary

### **Technical Benefits**

- Professional hosting infrastructure
- Global CDN performance
- Automatic scaling capability
- Zero server maintenance

### **Development Benefits**

- Real OAuth and sync testing
- Shared production database access
- Auto-deployment from GitHub
- Comprehensive feature validation

### **Cost Benefits**

- $0/month hosting (free tier)
- No Mac Mini electricity costs
- No home network dependency
- Professional infrastructure at zero cost

This migration solves both the immediate OAuth callback challenge and provides a professional hosting foundation for the multi-user conversion.
