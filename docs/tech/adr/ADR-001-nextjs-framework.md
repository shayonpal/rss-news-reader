# ADR-001: Choose Next.js as Primary Framework

## Status

Accepted

## Context

We need to build a Progressive Web Application (PWA) that works seamlessly across devices, provides excellent performance, supports offline functionality, and can be developed efficiently by a single developer. The application needs server-side rendering for initial load performance, API routes for backend functionality, and strong PWA support.

Key requirements:

- PWA functionality with service workers
- Server-side rendering for performance
- API routes for Inoreader and Claude integration
- Strong TypeScript support
- Active ecosystem and community
- Good developer experience
- Production-ready optimizations

## Decision

We will use Next.js 14+ with the App Router as our primary application framework.

## Consequences

### Positive

- **Built-in PWA support**: Easy integration with next-pwa plugin
- **Excellent performance**: Automatic code splitting, image optimization, and static generation
- **API routes**: Built-in backend capabilities for API proxying and server-side operations
- **Strong TypeScript support**: First-class TypeScript integration
- **Active ecosystem**: Large community, extensive documentation, regular updates
- **Production optimizations**: Automatic optimizations for Core Web Vitals
- **Vercel integration**: Seamless deployment option (though we're self-hosting)
- **React Server Components**: Better performance with App Router

### Negative

- **Learning curve**: App Router is relatively new with different mental model
- **Bundle size**: Larger than some alternatives like SvelteKit
- **Opinionated structure**: Less flexibility in project organization
- **Build complexity**: More complex build process than simpler frameworks

### Neutral

- **React ecosystem lock-in**: Tied to React's ecosystem and patterns
- **Rapid evolution**: Framework evolves quickly, requiring keeping up with changes

## Alternatives Considered

### Alternative 1: SvelteKit

- **Description**: Modern framework with excellent performance and smaller bundle sizes
- **Pros**: Smaller bundles, simpler mental model, built-in stores, great performance
- **Cons**: Smaller ecosystem, less PWA tooling, fewer learning resources
- **Reason for rejection**: Less mature PWA support and smaller ecosystem would slow development

### Alternative 2: Nuxt.js (Vue)

- **Description**: Vue-based framework with similar features to Next.js
- **Pros**: Good PWA support, intuitive API, strong community
- **Cons**: Would require learning Vue ecosystem, less TypeScript adoption
- **Reason for rejection**: Less familiar with Vue ecosystem, prefer React's component model

### Alternative 3: Create React App

- **Description**: Simple React setup without SSR
- **Pros**: Simple to understand, direct React usage, full control
- **Cons**: No SSR, manual PWA setup, no built-in optimizations, no API routes
- **Reason for rejection**: Lacks many features we need out of the box, would require significant setup

### Alternative 4: Remix

- **Description**: Modern React framework focused on web standards
- **Pros**: Excellent routing, good performance, web standards focus
- **Cons**: Less mature PWA support, smaller ecosystem, different mental model
- **Reason for rejection**: PWA support is not as mature as Next.js

## Implementation Notes

### Setup

```bash
npx create-next-app@latest shayon-news --typescript --tailwind --app
cd shayon-news
npm install next-pwa
```

### PWA Configuration

```javascript
// next.config.js
const withPWA = require("next-pwa")({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development",
});

module.exports = withPWA({
  // Next.js config
});
```

### Project Structure

```
app/
├── (auth)/
│   └── auth/
├── api/
│   ├── inoreader/
│   └── summarize/
├── layout.tsx
├── page.tsx
└── globals.css
```

## References

- [Next.js Documentation](https://nextjs.org/docs)
- [Next.js App Router](https://nextjs.org/docs/app)
- [next-pwa Plugin](https://github.com/shadowwalker/next-pwa)
- [PWA with Next.js Guide](https://web.dev/progressive-web-apps/)
