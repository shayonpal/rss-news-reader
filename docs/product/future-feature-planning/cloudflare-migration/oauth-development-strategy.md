# OAuth Development Strategy: Shared Production OAuth

## The Challenge

**Inoreader Free Tier Limitation**: Only allows **one registered app** with **one callback URL**
**Development Requirements**: Need to test real OAuth, sync features, and API integration during development

## Solution: Shared Production OAuth for Development

### **How It Works**

- Both development and production use the same OAuth callback URL
- Both environments connect to the same Supabase database
- Development uses real OAuth tokens from production authentication
- Full feature testing with actual Inoreader API integration

## Architecture

### **Single OAuth Configuration**

```
App Name: RSS News Reader
Callback URL: https://reader.uberfolks.ca/api/auth/inoreader/callback
Client ID: [your-client-id]
Client Secret: [your-client-secret]
```

### **Shared Database Environment**

```bash
# Both development and production use same database
NEXT_PUBLIC_SUPABASE_URL=production-supabase-url
SUPABASE_SERVICE_ROLE_KEY=production-service-key

# OAuth always points to production callback
INOREADER_REDIRECT_URI=https://reader.uberfolks.ca/api/auth/inoreader/callback

# Different frontend URLs
# Development: http://localhost:3000
# Production: https://reader.uberfolks.ca
```

## Development Workflow

### **One-Time Authentication Setup**

```bash
# 1. Deploy production app to CloudFlare
wrangler deploy

# 2. Complete OAuth setup (one-time per developer)
visit: https://reader.uberfolks.ca/auth/login
complete: Inoreader OAuth flow
result: User account + tokens stored in Supabase

# 3. Local development now has access to real data
npm run dev → http://localhost:3000
# Uses same Supabase database
# Access to real OAuth tokens
# Can test all sync features
```

### **Daily Development Process**

```bash
# Start local development
npm run dev

# App connects to production Supabase
# Uses existing OAuth session/tokens
# Test real sync operations
# Test real feed data
# Test real API integration

# Deploy changes
git push origin main → CloudFlare auto-deploys
```

## Implementation Details

### **OAuth Callback Handling**

```typescript
// Production callback endpoint
// /api/auth/inoreader/callback/route.ts

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const error = searchParams.get("error");

  if (error) {
    return redirect("/auth/error?error=" + error);
  }

  if (!code) {
    return redirect("/auth/error?error=no_code");
  }

  try {
    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Create or update user in Supabase
    const user = await createOrUpdateUser(tokens);

    // Create Supabase auth session
    const session = await createSupabaseSession(user);

    // Redirect to dashboard (works for both localhost and production)
    return redirect("/dashboard");
  } catch (error) {
    console.error("OAuth callback error:", error);
    return redirect("/auth/error?error=callback_failed");
  }
}
```

### **Token Storage & Retrieval**

```typescript
// Store encrypted tokens per user
async function createOrUpdateUser(inoreaderTokens) {
  const userInfo = await getInoreaderUserInfo(inoreaderTokens.access_token);

  const { data, error } = await supabase.from("users").upsert({
    inoreader_user_id: userInfo.userId,
    email: userInfo.userEmail,
    name: userInfo.userName,
    preferences: {
      encryptedData: {
        apiKeys: {
          inoreader: encrypt(inoreaderTokens),
        },
      },
    },
  });

  return data;
}

// Retrieve tokens for sync operations
async function getTokensForUser(userId) {
  const { data } = await supabase
    .from("users")
    .select("preferences")
    .eq("id", userId)
    .single();

  const encryptedTokens = data.preferences.encryptedData.apiKeys.inoreader;
  return decrypt(encryptedTokens);
}
```

## Benefits of Shared OAuth Approach

### **Development Experience**

- ✅ **Real OAuth testing** - full end-to-end authentication flow
- ✅ **Real sync testing** - actual Inoreader API calls and responses
- ✅ **Real feed data** - test with actual RSS feeds from Inoreader
- ✅ **Real token management** - test refresh, expiration, error handling
- ✅ **Real rate limits** - test API limit behavior and retry logic

### **Production Stability**

- ✅ **Single callback URL** - never changes after initial setup
- ✅ **Shared database** - consistent data across environments
- ✅ **No environment switching** - OAuth setup once, works everywhere
- ✅ **Auto-deployment friendly** - no callback URL management needed

### **Feature Testing Capability**

- ✅ **Bi-directional sync** - test read/unread state synchronization
- ✅ **Manual sync** - test user-triggered sync operations
- ✅ **Automated sync** - test scheduled background sync
- ✅ **Error handling** - test real API failures and recovery
- ✅ **Token refresh** - test automatic token renewal

## Security Considerations

### **Shared Database Access**

- Development and production share same user data
- Developers have access to real user accounts during development
- Suitable for small, trusted team with invite-only users
- Production data used for development testing

### **OAuth Token Security**

- Tokens encrypted in database using same encryption key
- Development environment can access production OAuth tokens
- Acceptable risk for small, trusted development team
- Consider separate encryption keys if security concerns arise

## Configuration Steps

### **1. Update Inoreader App**

```bash
# Inoreader Developer Console
App Name: RSS News Reader
Callback URL: https://reader.uberfolks.ca/api/auth/inoreader/callback
# Set once, never change
```

### **2. Environment Variables**

```bash
# CloudFlare Pages (production)
NEXT_PUBLIC_SUPABASE_URL=production-url
SUPABASE_SERVICE_ROLE_KEY=production-key
INOREADER_CLIENT_SECRET=client-secret

# Local development (.env.local)
NEXT_PUBLIC_SUPABASE_URL=same-production-url
SUPABASE_SERVICE_ROLE_KEY=same-production-key
INOREADER_CLIENT_SECRET=same-client-secret
```

### **3. OAuth Flow Implementation**

```typescript
// Login component (works in both environments)
export default function LoginPage() {
  const handleLogin = () => {
    // Always redirect to production OAuth
    const authUrl = `https://www.inoreader.com/oauth2/auth?client_id=${CLIENT_ID}&redirect_uri=https://reader.uberfolks.ca/api/auth/inoreader/callback&response_type=code&scope=read write`;

    window.location.href = authUrl;
  };

  return (
    <button onClick={handleLogin}>
      Connect Inoreader Account
    </button>
  );
}
```

## Development Testing Workflow

### **Full Feature Testing**

```bash
# 1. Authenticate once (production OAuth)
visit: https://reader.uberfolks.ca/auth/login

# 2. Develop locally with real data
npm run dev
# Test real sync operations
# Test real feed fetching
# Test real token refresh
# Test real API rate limits

# 3. Deploy changes
git push origin main → CloudFlare auto-deploys
# Same tokens, same data, seamless transition
```

### **Sync Testing Capabilities**

- **Automated Sync**: Test 6x daily cron with real feeds
- **Manual Sync**: Test user-triggered sync with actual API calls
- **Bi-directional Sync**: Test read/unread state changes with Inoreader
- **Error Scenarios**: Test real API failures, rate limits, token expiration
- **Performance Testing**: Measure real sync times and API response times

This approach provides the most comprehensive testing environment while maintaining OAuth simplicity and auto-deployment compatibility.
