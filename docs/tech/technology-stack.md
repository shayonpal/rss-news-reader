# Technology Stack - Shayon's News

## Framework Selection

### Primary Framework: **Next.js 14+ (App Router)**

**Rationale:**
- Excellent PWA support with native Service Worker integration
- Server-side rendering capabilities for better SEO and performance
- Built-in optimizations (image optimization, code splitting)
- Strong TypeScript support
- Active ecosystem and community

**Key Features Utilized:**
- App Router for modern routing patterns
- Built-in PWA capabilities with `next-pwa` plugin
- API routes for Inoreader and Claude API integration
- Static generation for improved performance
- Built-in image optimization for article media

### Alternative Considerations:
- **SvelteKit**: Excellent performance, smaller bundle sizes
- **Nuxt.js**: Vue-based, good PWA support
- **Create React App**: Simpler but less feature-rich

## Styling & UI Framework

### CSS Framework: **Tailwind CSS v3+**

**Rationale:**
- Utility-first approach enables rapid prototyping
- Excellent responsive design support
- Small production bundle size with purging
- Consistent design system through configuration
- Strong typography plugin for readable article layouts

**Key Plugins:**
- `@tailwindcss/typography` for article content styling
- `@tailwindcss/forms` for clean form components
- Custom color palette for dark/light mode

### Component Library: **Radix UI Primitives + Custom Components**

**Benefits:**
- Accessible components by default
- Headless components allow custom styling
- WAI-ARIA compliant
- Keyboard navigation support

**Key Components:**
- Dialog for modals
- Dropdown Menu for actions
- Toggle for theme switching
- Slider for settings

## State Management

### Primary: **Zustand**

**Rationale:**
- Lightweight (2.5KB gzipped)
- Simple boilerplate-free API
- Great TypeScript support
- Built-in persistence middleware
- Excellent React DevTools integration

**Store Structure:**
```typescript
// Store slices
- articlesStore: Article CRUD operations
- feedsStore: Feed hierarchy and management
- syncStore: Sync state and configuration
- settingsStore: User preferences and theme
- apiStore: API usage tracking
```

### Alternative: **Context API + useReducer**
For simpler state requirements, could use React's built-in state management.

## Data Persistence & Offline Support

### Primary Storage: **IndexedDB with Dexie.js**

**Rationale:**
- Large storage capacity (hundreds of MB)
- Structured data with indexes for fast queries
- Automatic compression support
- Works offline by default
- Better performance than localStorage for large datasets

**Schema:**
```typescript
// Database tables
- articles: Full article content and metadata
- feeds: Feed configuration and hierarchy
- summaries: AI-generated summaries with caching
- syncState: Last sync times and conflict resolution
- apiUsage: API call tracking and rate limiting
```

### Secondary Storage: **localStorage**
For simple settings and temporary data.

### Service Worker: **Workbox**

**Features:**
- Automatic caching strategies
- Background sync for read/unread states
- Offline fallbacks
- Cache versioning and updates

## API Layer & HTTP Client

### HTTP Client: **Axios**

**Features:**
- Request/response interceptors for auth tokens
- Automatic request/response transformation
- Built-in timeout handling
- Request cancellation support
- Better error handling than fetch

**API Integration Architecture:**
```typescript
// API service layers
- inoreaderApi: All Inoreader endpoints
- claudeApi: AI summarization service
- contentFetcher: Full article content retrieval
- syncManager: Orchestrates all API calls
```

## Development & Build Tools

### Type Safety: **TypeScript 5+**

**Configuration:**
- Strict mode enabled
- Path mapping for clean imports
- API response type definitions
- Component prop type safety

### Code Quality: **ESLint + Prettier**

**Rules:**
- React best practices
- Accessibility rules
- Import organization
- Consistent formatting

### Testing Framework: **Vitest + React Testing Library**

**Test Types:**
- Unit tests for utilities and components
- Integration tests for API services
- E2E tests with Playwright

### Build Tools: **Vite (via Next.js)**

**Optimizations:**
- Tree shaking for smaller bundles
- Code splitting by route
- Dynamic imports for heavy components
- Bundle analysis tools

## PWA Configuration

### Manifest Configuration:
```json
{
  "name": "Shayon's News",
  "short_name": "SNews",
  "theme_color": "#000000",
  "background_color": "#000000",
  "display": "standalone",
  "orientation": "portrait",
  "scope": "/",
  "start_url": "/"
}
```

### Service Worker Strategy:
- **Cache First**: Static assets, fonts, icons
- **Network First**: API calls, dynamic content
- **Stale While Revalidate**: Article images
- **Background Sync**: Read/unread state changes

## Performance Optimization

### Bundle Optimization:
- Dynamic imports for heavy components
- Code splitting by route
- Tree shaking of unused dependencies
- Compression with gzip/brotli

### Image Optimization:
- Next.js Image component for automatic optimization
- WebP format with fallbacks
- Lazy loading for article images
- Responsive image sizing

### Caching Strategy:
- Service Worker caching for assets
- IndexedDB for application data
- Memory caching for API responses
- HTTP cache headers optimization

## Development Environment

### Package Manager: **npm**
Standard package manager, good lockfile support.

### Development Server:
- Next.js dev server with hot reloading
- HTTPS support for PWA testing
- Environment variable management

### Environment Configuration:
```
NEXT_PUBLIC_INOREADER_CLIENT_ID=
NEXT_PUBLIC_INOREADER_REDIRECT_URI=
ANTHROPIC_API_KEY=
NODE_ENV=development|production
```

## Production Deployment

### Hosting Platform: **Vercel**

**Benefits:**
- Seamless Next.js integration
- Automatic deployments from Git
- Edge network for global performance
- Built-in analytics and monitoring
- Automatic HTTPS certificates

### Alternative Platforms:
- **Netlify**: Good PWA support, edge functions
- **Railway**: Simple deployment with database options
- **Self-hosted**: Docker containers for full control

## API Security & Rate Limiting

### Authentication:
- OAuth 2.0 for Inoreader integration
- Secure token storage in httpOnly cookies
- Automatic token refresh handling

### Rate Limiting:
- Client-side API call tracking
- Exponential backoff for failed requests
- Queue management for bulk operations
- Usage analytics and warnings

## Monitoring & Analytics

### Error Tracking: **Sentry** (Optional)
- Real-time error monitoring
- Performance tracking
- User session replay
- Release tracking

### Analytics: **Vercel Analytics**
- Privacy-focused web analytics
- Core Web Vitals tracking
- No cookie tracking required

## Development Tools & Extensions

### VS Code Extensions:
- ES7+ React/Redux/React-Native snippets
- Tailwind CSS IntelliSense
- TypeScript Hero
- GitLens

### Browser Extensions:
- React Developer Tools
- Redux DevTools (for Zustand)
- Lighthouse for PWA auditing

## Recommended Folder Structure

```
src/
├── app/                    # Next.js app router
│   ├── (auth)/            # Auth layout group
│   ├── api/               # API routes
│   └── globals.css        # Global styles
├── components/            # Reusable UI components
│   ├── ui/               # Base UI components
│   ├── articles/         # Article-related components
│   └── feeds/            # Feed-related components
├── lib/                  # Utility libraries
│   ├── api/              # API service layer
│   ├── db/               # Database utilities
│   ├── stores/           # Zustand stores
│   └── utils/            # Helper functions
├── types/                # TypeScript type definitions
├── hooks/                # Custom React hooks
└── constants/            # App constants
```

## Key Dependencies

### Core Dependencies:
```json
{
  "next": "^14.0.0",
  "react": "^18.0.0",
  "typescript": "^5.0.0",
  "tailwindcss": "^3.0.0",
  "zustand": "^4.0.0",
  "dexie": "^3.0.0",
  "axios": "^1.0.0",
  "workbox-webpack-plugin": "^7.0.0",
  "@mozilla/readability": "^0.4.4",
  "jsdom": "^23.0.0",
  "dompurify": "^3.0.0",
  "@extractus/article-extractor": "^8.0.0"
}
```

### Development Dependencies:
```json
{
  "vitest": "^1.0.0",
  "@testing-library/react": "^14.0.0",
  "playwright": "^1.0.0",
  "eslint": "^8.0.0",
  "prettier": "^3.0.0"
}
```

## Critical Decision Points

### 1. **PWA vs Native App**
**Decision**: PWA for cross-platform compatibility and easier maintenance.
**Impact**: Faster development, broader reach, easier updates.

### 2. **Client-side vs Server-side Rendering**
**Decision**: Hybrid approach with SSR for initial load, client-side for interactions.
**Impact**: Better performance and SEO while maintaining offline capabilities.

### 3. **State Management Complexity**
**Decision**: Zustand for simplicity over Redux complexity.
**Impact**: Faster development, easier maintenance, smaller bundle size.

### 4. **Database Choice**
**Decision**: IndexedDB over localStorage for large data storage.
**Impact**: Better performance, larger storage capacity, structured queries.

### 5. **API Rate Limiting Strategy**
**Decision**: Client-side tracking with graceful degradation.
**Impact**: Better user experience, reduced server costs, clear usage feedback.

This technology stack balances modern development practices with practical constraints, ensuring the app can be built efficiently while providing excellent user experience and maintainability.