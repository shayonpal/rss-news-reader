# CloudFlare Pages + Workers Migration Strategy

## Overview

Migrate RSS News Reader from Tailscale-only Mac Mini hosting to public CloudFlare Pages + Workers hosting to enable Inoreader OAuth callbacks and external user access while maintaining security through invite-only access control.

## Target Architecture

### **Current Setup**

- **URL**: `http://100.96.166.53:3000/reader` (Tailscale-only)
- **Hosting**: Mac Mini with PM2 process management
- **Access**: Tailscale network required
- **Base Path**: `/reader` prefix required for all routes

### **Target Setup**

- **URL**: `https://reader.uberfolks.ca` (public with invite-only access)
- **Hosting**: CloudFlare Pages (frontend) + Workers (API/cron)
- **Access**: Public domain with invite code system
- **Base Path**: Root domain (no `/reader` prefix needed)

## Base Path Migration Challenge

### **Current Route Structure**

```typescript
// All routes currently require /reader prefix
http://100.96.166.53:3000/reader          → Homepage
http://100.96.166.53:3000/reader/settings → Settings
http://100.96.166.53:3000/reader/api/health → API
```

### **Target Route Structure**

```typescript
// New subdomain eliminates need for /reader prefix
https://reader.uberfolks.ca          → Homepage
https://reader.uberfolks.ca/settings → Settings
https://reader.uberfolks.ca/api/health → API
```

### **Migration Strategy**

1. **Update all internal route references** to remove `/reader` prefix
2. **Update Next.js basePath configuration** to use root (`/`) instead of `/reader`
3. **Update API route handlers** to expect root-based paths
4. **Update frontend navigation** and link components
5. **Update environment variables** for new base URL

## CloudFlare Deployment Strategy

### **Deployment Approach: CLI-Based (Preferred)**

Since you already have Wrangler installed and manage another site:

```bash
# 1. Configure wrangler.toml for RSS Reader
# 2. Deploy via CLI commands
# 3. Manage environment variables via CLI
# 4. Handle domain/DNS configuration via CloudFlare dashboard
```

### **Architecture: Pages + Workers**

- **CloudFlare Pages**: Frontend (Next.js static generation + SSR)
- **CloudFlare Workers**: API routes + background cron jobs
- **Domain**: `reader.uberfolks.ca` subdomain of existing domain

## Inoreader OAuth Development Challenge

### **The Problem**

- **Inoreader Free Tier**: Only allows **one registered app** with one callback URL
- **Current Callback**: Probably points to your Mac Mini or localhost
- **Development Conflict**: Can't have separate dev and prod callbacks

### **Solution Options**

#### **Option A: Single Callback with Environment Detection**

```typescript
// Use production callback for both dev and prod
INOREADER_REDIRECT_URI =
  "https://reader.uberfolks.ca/api/auth/inoreader/callback";

// Callback endpoint handles environment routing
export default async function handler(request) {
  const { code, state } = await request.json();

  // Check if this is development request (via state parameter)
  if (state.includes("dev-")) {
    // Handle development OAuth completion
    // Store tokens for local development
    return redirect("http://localhost:3000/dashboard");
  } else {
    // Handle production OAuth completion
    // Store tokens for production user
    return redirect("https://reader.uberfolks.ca/dashboard");
  }
}
```

#### **Option B: Tunneled Development**

```bash
# Use ngrok or CloudFlare tunnel for development
ngrok http 3000 --subdomain=rss-dev-temp

# Development callback: https://rss-dev-temp.ngrok.io/api/auth/inoreader/callback
# Production callback: https://reader.uberfolks.ca/api/auth/inoreader/callback
# Update Inoreader app callback URL when switching between dev/prod
```

#### **Option C: Shared Development Environment**

```bash
# Use CloudFlare for both development and production
# Development: reader-dev.uberfolks.in
# Production: reader.uberfolks.ca
# Both use same Inoreader app with wildcard callback: *.uberfolks.in
```

#### **Option D: Mock Development (Recommended)**

```typescript
// Use mock OAuth for development, real OAuth for production
if (process.env.NODE_ENV === "development") {
  // Mock Inoreader OAuth with test tokens
  mockOAuthFlow();
} else {
  // Real Inoreader OAuth
  realOAuthFlow();
}
```

## CloudFlare vs Tunnel Comparison

| Aspect                        | CloudFlare Tunnel       | CloudFlare Workers + Pages |
| ----------------------------- | ----------------------- | -------------------------- |
| **Monthly Cost**              | $0                      | $0 (within free tier)      |
| **Migration Effort**          | Minimal (1-2 hours)     | Medium (1-2 days)          |
| **Infrastructure Dependency** | Mac Mini required       | Zero dependencies          |
| **Base Path Changes**         | None needed             | Remove `/reader` prefix    |
| **Reliability**               | Home internet dependent | 99.9%+ uptime SLA          |
| **Performance**               | Single location         | Global CDN                 |
| **Maintenance**               | Mac Mini management     | Zero maintenance           |
| **Scaling**                   | Manual server upgrades  | Automatic scaling          |
| **Development Environment**   | Keep localhost          | Need workaround for OAuth  |
| **Monitoring**                | PM2 logs                | CloudFlare analytics       |

## Recommendations

### **For OAuth Development Challenge:**

**Use Option D (Mock Development)** because:

- Preserves simple local development workflow
- No callback URL conflicts
- Real OAuth testing can happen on staging/production
- Most development doesn't require actual Inoreader data

### **For Hosting Strategy:**

**CloudFlare Workers + Pages** because:

- Professional hosting at $0 cost
- Eliminates Mac Mini dependency and maintenance
- Better performance and reliability
- Solves OAuth callback problem cleanly
- Future-proof for user growth

### **Implementation Priority:**

1. **First**: Implement CloudFlare hosting migration
2. **Second**: Implement multi-user authentication
3. **Combined benefit**: Solves OAuth callback AND multi-user challenges together

## Next Steps

1. **Document base path migration** (`/reader` → `/` removal)
2. **Plan OAuth development workflow** (mock vs tunneling)
3. **Create deployment scripts** for Wrangler CLI
4. **Update Linear project** with CloudFlare hosting strategy
5. **Plan migration timeline** and testing approach

**Which OAuth development approach (A, B, C, or D) feels most practical for your development workflow?**
