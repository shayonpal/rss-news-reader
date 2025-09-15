# OAuth Development Strategy for Inoreader Single Callback Limitation

## The Challenge

**Inoreader Free Tier Limitation**: Only allows **one registered app** with **one callback URL**
**Development Conflict**: Can't have separate development and production callback URLs simultaneously

## Current State Analysis

### **Existing Inoreader App Configuration** (Likely)

```
App Name: RSS News Reader (or similar)
Callback URL: http://localhost:3000/auth/callback (or Mac Mini URL)
Client ID: [your-client-id]
Client Secret: [your-client-secret]
```

### **Target Production Configuration**

```
App Name: RSS News Reader
Callback URL: https://reader.uberfolks.in/api/auth/inoreader/callback
Client ID: [same-client-id]
Client Secret: [same-client-secret]
```

## Solution Options

### **Option A: Mock OAuth for Development (Recommended) ⭐**

**How it works**:

- Development uses mock tokens and user data
- Production uses real Inoreader OAuth
- Single callback URL stays stable in production

**Implementation**:

```typescript
// Development mock system
export async function handleAuth() {
  if (process.env.NODE_ENV === 'development') {
    return mockInoreaderAuth();
  }
  return realInoreaderAuth();
}

async function mockInoreaderAuth() {
  const mockTokens = {
    access_token: 'dev-mock-token-' + Date.now(),
    refresh_token: 'dev-mock-refresh-' + Date.now(),
    expires_in: 3600,
    created_at: Date.now()
  };

  const mockUser = {
    userId: 'dev-user-001',
    userName: 'Development User',
    userEmail: 'dev@example.com'
  };

  // Create real Supabase session with mock data
  const { data, error } = await supabase.auth.signUp({
    email: mockUser.userEmail,
    password: 'dev-password-123'
  });

  // Store mock tokens in user preferences
  await storeMockTokensForUser(data.user.id, mockTokens);

  return { user: mockUser, tokens: mockTokens };
}

// Development login page
export default function DevLoginPage() {
  const handleDevLogin = async () => {
    await mockInoreaderAuth();
    router.push('/dashboard');
  };

  return (
    <div>
      <h1>Development Login</h1>
      <button onClick={handleDevLogin}>
        Login with Mock Inoreader Account
      </button>
      <p>Mock tokens will be used for development</p>
    </div>
  );
}
```

**Benefits**:

- ✅ **Zero callback conflicts** - production URL never changes
- ✅ **Fast development** - no OAuth roundtrips needed
- ✅ **Reliable testing** - no external API dependencies
- ✅ **Real session testing** - uses actual Supabase Auth
- ✅ **Production stability** - OAuth always works in production

**Drawbacks**:

- ❌ **Can't test real OAuth** during development
- ❌ **Mock data** may not match real Inoreader response format

### **Option B: Dynamic Callback URL Management**

**How it works**:

- Manually update Inoreader app callback URL when switching environments
- Use Inoreader Developer Console to change callback URL as needed

**Implementation**:

```bash
# Development workflow
1. Change Inoreader callback to: https://dev-tunnel.ngrok.io/api/auth/inoreader/callback
2. Run ngrok tunnel: ngrok http 3000
3. Develop and test OAuth flow
4. Change callback back to: https://reader.uberfolks.in/api/auth/inoreader/callback

# Production deployment
1. Ensure callback URL is production: https://reader.uberfolks.in/api/auth/inoreader/callback
2. Deploy to CloudFlare
3. Test production OAuth
```

**Benefits**:

- ✅ **Real OAuth testing** during development
- ✅ **Actual Inoreader data** and response formats
- ✅ **Full end-to-end testing** possible

**Drawbacks**:

- ❌ **Manual URL switching** required for each dev session
- ❌ **Easy to forget** and break production
- ❌ **Requires tunnel** (ngrok) for development
- ❌ **Team development issues** if multiple developers

### **Option C: Staging Environment Bridge**

**How it works**:

- Use CloudFlare for both development and production environments
- Single callback handles routing to appropriate environment

**Implementation**:

```typescript
// Single callback URL: https://reader.uberfolks.in/api/auth/inoreader/callback
// State parameter determines environment routing

export async function handleOAuthCallback(request) {
  const { code, state } = getCallbackParams(request);

  // Environment detection via state parameter
  if (state.startsWith("dev-")) {
    // Development completion - redirect to local
    const tokens = await exchangeCodeForTokens(code);
    await storeDevTokens(tokens);
    return redirect("http://localhost:3000/dashboard?dev=true");
  } else {
    // Production completion - normal flow
    const tokens = await exchangeCodeForTokens(code);
    const user = await createProductionUser(tokens);
    return redirect("https://reader.uberfolks.in/dashboard");
  }
}
```

**Benefits**:

- ✅ **Real OAuth** in both environments
- ✅ **Single callback URL** maintained
- ✅ **Environment flexibility**

**Drawbacks**:

- ❌ **Complex state management**
- ❌ **Still requires tunneling** for localhost redirect
- ❌ **Confusing debugging** when things go wrong

## **Recommendation: Option A (Mock OAuth for Development)**

### **Why Mock OAuth is Best**:

1. **Simplicity**: No callback URL juggling or tunnel requirements
2. **Reliability**: Development never depends on external OAuth service
3. **Speed**: Instant login during development without OAuth roundtrips
4. **Production Stability**: Real OAuth callback URL never changes
5. **Team Friendly**: Multiple developers can work without conflicts

### **Implementation Strategy**:

```typescript
// Create mock data that matches real Inoreader format
const MOCK_INOREADER_RESPONSE = {
  userInfo: {
    userId: "1000000001",
    userName: "dev@example.com",
    userProfileId: "1000000001",
    userEmail: "dev@example.com",
  },
  subscriptions: [
    // Mock feed subscriptions for development
  ],
  tokens: {
    access_token: "dev-token-123",
    refresh_token: "dev-refresh-456",
    expires_in: 3600,
  },
};
```

### **Production OAuth Flow**:

1. **Callback URL**: `https://reader.uberfolks.in/api/auth/inoreader/callback`
2. **Update Inoreader App**: Set callback to production URL once
3. **Never change again**: Stable production OAuth

**This solves the single callback limitation while maintaining simple development workflow. Does this approach work for your development needs?**
