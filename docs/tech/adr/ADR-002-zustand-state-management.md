# ADR-002: Use Zustand for State Management

## Status
Accepted

## Context
The RSS Reader application needs client-side state management for:
- Article data and metadata
- Feed hierarchy and organization
- User preferences and settings
- Sync status and queue management
- API usage tracking
- Offline action queuing

Requirements:
- Simple API with minimal boilerplate
- TypeScript support
- Persistence capabilities
- Good performance
- DevTools integration
- Small bundle size
- Easy testing

## Decision
We will use Zustand as our primary state management solution instead of more complex alternatives like Redux or MobX.

## Consequences

### Positive
- **Minimal boilerplate**: Direct state updates without actions/reducers
- **Tiny bundle size**: Only 2.5KB gzipped
- **Built-in persistence**: Middleware for localStorage/IndexedDB persistence
- **TypeScript friendly**: Excellent type inference
- **DevTools support**: Works with Redux DevTools
- **Simple async**: No special handling needed for async operations
- **No providers**: No need to wrap app in providers
- **Easy testing**: Simple to mock stores in tests

### Negative
- **Less structure**: No enforced patterns like Redux
- **Smaller ecosystem**: Fewer middleware and tools available
- **Less familiar**: Team may be more familiar with Redux
- **Debugging**: Less sophisticated time-travel debugging

### Neutral
- **Different mental model**: Direct mutations vs immutable updates
- **Learning curve**: Simpler than Redux but still needs learning

## Alternatives Considered

### Alternative 1: Redux Toolkit
- **Description**: Modern Redux with reduced boilerplate
- **Pros**: Mature ecosystem, extensive DevTools, time-travel debugging, enforced patterns
- **Cons**: More boilerplate, larger bundle size (10KB+), steeper learning curve
- **Reason for rejection**: Overkill for our needs, too much complexity for single developer

### Alternative 2: Context API + useReducer
- **Description**: React's built-in state management
- **Pros**: No external dependencies, familiar React patterns
- **Cons**: Performance issues with frequent updates, no built-in persistence, verbose
- **Reason for rejection**: Poor performance with large article lists, no persistence support

### Alternative 3: MobX
- **Description**: Reactive state management with observables
- **Pros**: Powerful reactivity, good performance, less boilerplate than Redux
- **Cons**: Larger bundle size, different programming paradigm, decorator syntax
- **Reason for rejection**: Unnecessary complexity, unfamiliar reactive paradigm

### Alternative 4: Valtio
- **Description**: Proxy-based state management
- **Pros**: Even simpler API, proxy-based reactivity
- **Cons**: Less mature, smaller community, potential proxy compatibility issues
- **Reason for rejection**: Less proven in production, smaller ecosystem

## Implementation Notes

### Store Structure
```typescript
// stores/useArticleStore.ts
interface ArticleState {
  articles: Map<string, Article>
  isLoading: boolean
  error: string | null
  
  // Actions
  addArticles: (articles: Article[]) => void
  markAsRead: (articleId: string) => void
  clearOldArticles: () => void
}

export const useArticleStore = create<ArticleState>()(
  persist(
    (set, get) => ({
      articles: new Map(),
      isLoading: false,
      error: null,
      
      addArticles: (newArticles) => set(state => {
        const updated = new Map(state.articles)
        newArticles.forEach(article => {
          updated.set(article.id, article)
        })
        return { articles: updated }
      }),
      
      markAsRead: async (articleId) => {
        // Optimistic update
        set(state => {
          const article = state.articles.get(articleId)
          if (article) {
            article.isRead = true
          }
          return state
        })
        
        // Queue for sync
        await queueAction({ type: 'MARK_READ', articleId })
      },
      
      clearOldArticles: () => set(state => {
        const sorted = Array.from(state.articles.values())
          .sort((a, b) => b.publishedAt - a.publishedAt)
          .slice(0, 500)
        
        const updated = new Map()
        sorted.forEach(article => updated.set(article.id, article))
        
        return { articles: updated }
      })
    }),
    {
      name: 'article-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ 
        // Only persist essential data
        articles: Array.from(state.articles.entries()).slice(0, 50) 
      })
    }
  )
)
```

### Usage in Components
```typescript
// components/ArticleList.tsx
export function ArticleList() {
  const articles = useArticleStore(state => state.articles)
  const markAsRead = useArticleStore(state => state.markAsRead)
  
  return (
    <div>
      {Array.from(articles.values()).map(article => (
        <ArticleCard 
          key={article.id}
          article={article}
          onRead={() => markAsRead(article.id)}
        />
      ))}
    </div>
  )
}
```

### Testing
```typescript
// tests/stores/article-store.test.ts
const createTestStore = () => {
  const store = create<ArticleState>()((set) => ({
    articles: new Map(),
    isLoading: false,
    error: null,
    addArticles: jest.fn(),
    markAsRead: jest.fn(),
    clearOldArticles: jest.fn()
  }))
  return store
}
```

## Migration Strategy
Since this is a new project, no migration is needed. For future reference:
1. Create Zustand stores alongside existing state
2. Gradually move components to use Zustand
3. Remove old state management once complete

## References
- [Zustand Documentation](https://github.com/pmndrs/zustand)
- [Zustand Persist Middleware](https://github.com/pmndrs/zustand#persist-middleware)
- [Zustand TypeScript Guide](https://github.com/pmndrs/zustand#typescript-usage)
- [React State Management Comparison](https://www.robinwieruch.de/react-state-management/)