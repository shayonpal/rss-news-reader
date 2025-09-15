# CloudFlare Workers + Pages Deployment Workflow

## CLI-Based Deployment Process

### **Prerequisites**

- ✅ Wrangler CLI installed (already done)
- ✅ Personal domain `uberfolks.in` owned
- ✅ CloudFlare account with domain management
- ✅ Experience managing one other site with Wrangler

### **Project Configuration**

#### **1. Wrangler Configuration**

```toml
# wrangler.toml
name = "rss-reader"
main = "src/index.js"
compatibility_date = "2024-01-01"
node_compat = true

# Cron triggers for sync jobs
[triggers]
crons = ["0 2,6,10,14,18,22 * * *"]

# Custom domain
[[routes]]
pattern = "reader.uberfolks.in/*"
zone_name = "uberfolks.in"

[vars]
NEXT_PUBLIC_SUPABASE_URL = "your-supabase-url"
NEXT_PUBLIC_APP_URL = "https://reader.uberfolks.in"
INOREADER_REDIRECT_URI = "https://reader.uberfolks.in/api/auth/inoreader/callback"

# Secrets (set via CLI)
# SUPABASE_SERVICE_ROLE_KEY
# INOREADER_CLIENT_SECRET
# TOKEN_ENCRYPTION_KEY
```

#### **2. Next.js Configuration Updates**

```javascript
// next.config.js
module.exports = {
  // Remove basePath since using subdomain
  // basePath: '/reader', // ← Remove this

  // Add CloudFlare adapter
  experimental: {
    runtime: "experimental-edge",
  },

  // Environment variables
  env: {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  },
};
```

### **Deployment Commands**

#### **Initial Setup**

```bash
# 1. Set secrets via CLI (one-time)
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put INOREADER_CLIENT_SECRET
wrangler secret put TOKEN_ENCRYPTION_KEY
wrangler secret put ANTHROPIC_API_KEY

# 2. Configure domain DNS (one-time)
# Via CloudFlare dashboard: DNS → Add A record
# reader.uberfolks.in → CloudFlare Worker IP

# 3. Initial deployment
wrangler deploy
```

#### **Regular Deployment Workflow**

```bash
# Development cycle
npm run dev              # Local development
npm run build           # Test build locally
npm run type-check      # Validate TypeScript
npm run test           # Run test suite

# Deploy to production
wrangler deploy        # Deploy Workers + Pages
wrangler tail          # Monitor deployment logs

# Check deployment
curl https://reader.uberfolks.in/api/health
```

#### **Environment Management**

```bash
# View current variables
wrangler secret list

# Update secrets
wrangler secret put SUPABASE_SERVICE_ROLE_KEY

# View deployment logs
wrangler tail --format=pretty

# Check cron job status
wrangler cron trigger --cron="0 2,6,10,14,18,22 * * *"
```

## Base Path Migration Strategy

### **Current Routes (with /reader prefix)**

```typescript
// Current internal routes
/reader                    → Homepage
/reader/settings          → Settings page
/reader/api/health        → Health API
/reader/api/sync          → Sync API
```

### **Target Routes (no prefix needed)**

```typescript
// New subdomain routes
/                         → Homepage
/settings                 → Settings page
/api/health              → Health API
/api/sync                → Sync API
```

### **Code Changes Required**

```typescript
// 1. Update Next.js configuration
// Remove basePath: '/reader'

// 2. Update internal route references
// Before: router.push('/reader/settings')
// After:  router.push('/settings')

// 3. Update API route files
// Before: /reader/api/health/route.ts
// After:  /api/health/route.ts

// 4. Update environment variables
// Before: NEXT_PUBLIC_APP_URL=http://100.96.166.53:3000
// After:  NEXT_PUBLIC_APP_URL=https://reader.uberfolks.in
```

## OAuth Development Workflow Challenge

### **The Inoreader Single Callback Limitation**

- **Free Tier**: Only 1 registered app = 1 callback URL possible
- **Current**: Probably localhost or Mac Mini URL
- **Production**: Must be `https://reader.uberfolks.in/api/auth/inoreader/callback`

### **Development Solution Options**

#### **Option A: Mock OAuth for Development (Recommended)**

```typescript
// Mock Inoreader OAuth during development
if (process.env.NODE_ENV === "development") {
  // Use mock tokens and user data
  const mockTokens = {
    access_token: "dev-token-123",
    refresh_token: "dev-refresh-456",
    expires_in: 3600,
  };

  const mockUser = {
    userId: "dev-user-001",
    userName: "Dev User",
    userEmail: "dev@example.com",
  };

  // Skip real OAuth, create session with mock data
  return createMockSession(mockUser, mockTokens);
}
```

#### **Option B: Dynamic Callback URL Switching**

```bash
# Update Inoreader app callback URL based on environment
# Development: Update to ngrok/tunnel URL when developing
# Production: Update to https://reader.uberfolks.in/api/auth/inoreader/callback

# Manual process via Inoreader developer console
```

#### **Option C: Shared Staging Environment**

```bash
# Use CloudFlare for both development and production
# Development: reader-dev.uberfolks.in
# Production: reader.uberfolks.in
# Single callback: https://reader-dev.uberfolks.in/api/auth/inoreader/callback
# Route to appropriate environment based on state parameter
```

## Deployment Timeline

### **Phase 1: Base Path Migration (1 day)**

- Remove `/reader` prefix from all routes
- Update Next.js configuration
- Test locally without base path
- Update environment variables

### **Phase 2: CloudFlare Configuration (1 day)**

- Configure `wrangler.toml`
- Set up DNS for `reader.uberfolks.in`
- Deploy to CloudFlare and test basic functionality
- Configure environment variables and secrets

### **Phase 3: OAuth Integration (1 day)**

- Update Inoreader app callback URL to production
- Implement OAuth callback handler in Workers
- Test OAuth flow end-to-end
- Implement development OAuth solution (mock or tunneling)

### **Phase 4: Multi-User Implementation (3-5 days)**

- Continue with planned multi-user authentication
- Enhanced cron system in Workers
- Data isolation with RLS policies
- Testing with invite-only access

## Monitoring & Operations

### **CloudFlare Dashboard**

- **Analytics**: Request volume, error rates, response times
- **Logs**: Real-time Worker execution logs
- **Cron Jobs**: Scheduled trigger history and status
- **Domain**: SSL status and DNS configuration

### **CLI Monitoring**

```bash
# Real-time logs
wrangler tail --format=pretty

# Cron job testing
wrangler cron trigger --cron="0 2,6,10,14,18,22 * * *"

# Deployment status
wrangler whoami
wrangler dev --test-scheduled  # Test cron locally
```

### **Cost Analysis**

- **Monthly Cost**: $0 (within free tier limits)
- **Domain Cost**: $0 (using existing uberfolks.in)
- **Comparison**: Saves Mac Mini electricity + reduces home network dependency
- **Scaling**: Automatic, stays free until 100k+ requests/day

## Development Environment Strategy

### **Recommended: Mock OAuth for Development**

**Benefits**:

- ✅ **Simple local development** - no callback URL changes needed
- ✅ **Fast iteration** - no real OAuth roundtrips
- ✅ **Reliable testing** - no external API dependencies
- ✅ **Production callback** remains stable

**Implementation**:

```typescript
// Development mock
const DEV_USER = {
  inoreader_user_id: "dev-user-001",
  email: "dev@example.com",
  name: "Development User",
};

// Skip OAuth in development
if (process.env.NODE_ENV === "development") {
  return createDevSession(DEV_USER);
}
```

**Production OAuth Testing**:

- Use staging deployment on CloudFlare for OAuth testing
- Keep production callback URL stable
- Test real OAuth flow on `reader.uberfolks.in` staging

## Next Steps

1. **Create wrangler.toml configuration**
2. **Plan base path removal from codebase**
3. **Set up DNS for reader.uberfolks.in subdomain**
4. **Choose OAuth development strategy**
5. **Create deployment scripts and documentation**

## Questions to Resolve

1. **OAuth Development**: Mock tokens vs dynamic callback switching vs staging environment?
2. **Base Path Migration**: Gradual migration vs one-time cut-over?
3. **Environment Strategy**: Single prod environment vs dev/staging/prod?
4. **Monitoring**: CloudFlare analytics sufficient vs additional monitoring?
