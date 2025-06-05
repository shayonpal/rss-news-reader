# ADR-008: Single User Architecture

## Status

Accepted

## Context

The RSS Reader is being built initially for personal use, which raises the question of whether to design for single-user or multi-user from the start.

Considerations:

- Current need: Personal RSS reader for one user
- Future possibility: Open source release where others self-host
- Development complexity vs future flexibility
- Authentication and data isolation requirements
- Performance implications
- Storage and API quota management

## Decision

Design the application as single-user for v1, with careful abstraction points that allow for future multi-user capability without major rewrites. Each deployment instance serves one user.

## Consequences

### Positive

- **Simpler development**: No user management, permissions, or data isolation
- **Better performance**: No per-user filtering or access checks
- **Easier state management**: Single global state without user context
- **Simpler deployment**: No database needed for user management
- **Clear mental model**: One deployment = one user
- **Privacy focused**: User data never mixed

### Negative

- **No sharing**: Can't share articles or folders between users
- **No collaboration**: No multi-user features possible
- **Multiple deployments**: Each user needs their own instance
- **Future refactoring**: Adding multi-user later requires work

### Neutral

- **Self-hosting norm**: Common pattern for privacy-focused apps
- **Resource usage**: Each instance uses full resources
- **Update management**: Each instance updated separately

## Alternatives Considered

### Alternative 1: Multi-User from Start

- **Description**: Build full multi-user support in v1
- **Pros**: Future-proof, enables collaboration, single deployment
- **Cons**: 3-4x development time, complex architecture, YAGNI
- **Reason for rejection**: Massive overengineering for personal project

### Alternative 2: Hardcoded Single User

- **Description**: Deeply embed single-user assumption everywhere
- **Pros**: Slightly simpler code, no abstractions needed
- **Cons**: Very difficult to add multi-user later
- **Reason for rejection**: Want to keep future options open

### Alternative 3: Local Storage Only

- **Description**: Use only browser storage, no server state
- **Pros**: Ultimate simplicity, perfect privacy
- **Cons**: Can't sync between devices, limited by browser
- **Reason for rejection**: Need cross-device access

### Alternative 4: Firebase/Supabase Auth

- **Description**: Use hosted auth service for user management
- **Pros**: Easy multi-user, professional auth
- **Cons**: External dependency, costs, privacy concerns
- **Reason for rejection**: Against self-hosted philosophy

## Implementation Notes

### Current Single-User Design

```typescript
// No user context needed
export const articleStore = create((set) => ({
  articles: [],
  addArticle: (article) =>
    set((state) => ({
      articles: [...state.articles, article],
    })),
}));

// API calls don't need user ID
async function fetchArticles() {
  return await api.get("/articles");
}

// Settings are global
const settings = {
  theme: "dark",
  syncInterval: 6,
  apiKeys: {
    inoreader: process.env.INOREADER_KEY,
    claude: process.env.CLAUDE_KEY,
  },
};
```

### Abstraction Points for Future

```typescript
// UserContext (currently returns static user)
interface UserContext {
  getCurrentUser(): User;
  isAuthenticated(): boolean;
}

class SingleUserContext implements UserContext {
  getCurrentUser() {
    return { id: "default", name: "User" };
  }

  isAuthenticated() {
    return true; // Always authenticated in single-user
  }
}

// Future: MultiUserContext with real auth

// Data access pattern
class ArticleRepository {
  // Current: no user filtering
  async getAll(): Promise<Article[]> {
    return db.articles.toArray();
  }

  // Future: easy to add user filtering
  // async getAll(userId: string): Promise<Article[]> {
  //   return db.articles.where('userId').equals(userId).toArray()
  // }
}
```

### Database Schema Preparation

```typescript
// Current schema (single-user)
interface Article {
  id: string;
  title: string;
  content: string;
  // No userId field
}

// Future schema (multi-user ready)
interface Article {
  id: string;
  title: string;
  content: string;
  userId?: string; // Optional for compatibility
}

// Migration would add userId field with default value
```

### API Design

```typescript
// Current: No auth needed
app.get("/api/articles", async (req, res) => {
  const articles = await getArticles();
  res.json(articles);
});

// Future: Easy to add auth middleware
app.get("/api/articles", authenticate, async (req, res) => {
  const articles = await getArticles(req.user.id);
  res.json(articles);
});
```

### Configuration Pattern

```typescript
// Environment-based configuration
const config = {
  singleUserMode: true, // Feature flag
  auth: {
    enabled: false,
    provider: null
  }
}

// Components check mode
function App() {
  if (config.singleUserMode) {
    return <MainApp />
  } else {
    return <AuthenticatedApp />
  }
}
```

### Storage Considerations

- IndexedDB: No user partitioning needed
- API quotas: Single user consumes all quotas
- Cache: Global cache for all content
- Settings: Stored globally, not per-user

## Migration Path to Multi-User

If multi-user is needed later:

1. **Add authentication layer**

   - Implement auth provider
   - Add login/logout UI
   - Secure API endpoints

2. **Partition data by user**

   - Add userId to all entities
   - Update queries to filter by user
   - Migrate existing data to default user

3. **Update state management**

   - Add user context to stores
   - Scope all operations by user
   - Clear state on logout

4. **Handle quotas per user**
   - Track API usage per user
   - Implement per-user limits
   - Add usage dashboard per user

## References

- [Single vs Multi-Tenant Architecture](https://docs.microsoft.com/en-us/azure/architecture/guide/multitenant/overview)
- [Self-Hosted Software Patterns](https://github.com/awesome-selfhosted/awesome-selfhosted)
- [Privacy-First Architecture](https://www.privacyguides.org/)
