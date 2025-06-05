# ADR-007: PWA Over Native Mobile App

## Status

Accepted

## Context

We need to provide a mobile-friendly RSS reader that works on both iOS and Android devices. The options are:

- Progressive Web Application (PWA)
- Native iOS app (Swift/SwiftUI)
- Native Android app (Kotlin)
- Cross-platform native (React Native, Flutter)
- Hybrid app (Ionic, Capacitor)

Requirements:

- Work offline
- Install on home screen
- Push notifications (future)
- Access from multiple devices
- Single codebase to maintain
- Quick development timeline
- No app store requirements

## Decision

Build a Progressive Web Application (PWA) using Next.js with mobile-first responsive design.

## Consequences

### Positive

- **Single codebase**: One codebase for all platforms (iOS, Android, desktop)
- **No app store**: No review process, instant updates
- **Web standards**: Uses standard web technologies
- **Instant updates**: Users always get latest version
- **Lower development cost**: No need for platform-specific expertise
- **URL sharing**: Can share links to specific articles
- **SEO friendly**: Content is indexable (if made public)
- **Desktop support**: Same app works on desktop browsers

### Negative

- **iOS limitations**: Limited PWA support on iOS (no push notifications)
- **App store presence**: No visibility in app stores
- **Native features**: Limited access to some native APIs
- **Performance**: Slightly worse than native (acceptable for RSS reader)
- **Offline limitations**: Service worker limitations on iOS

### Neutral

- **User education**: Some users unfamiliar with PWA installation
- **Browser dependency**: Features depend on browser support
- **Update control**: Can't control when users update

## Alternatives Considered

### Alternative 1: Native iOS App

- **Description**: Swift/SwiftUI app for iPhone/iPad
- **Pros**: Best iOS performance, full native features, app store presence
- **Cons**: iOS only, app review process, need Mac for development, separate codebase
- **Reason for rejection**: Want cross-platform, avoid app store complexity

### Alternative 2: React Native

- **Description**: Cross-platform native using React
- **Pros**: Near-native performance, single codebase, familiar React
- **Cons**: Complex setup, platform-specific issues, larger bundle
- **Reason for rejection**: Unnecessary complexity for RSS reader

### Alternative 3: Flutter

- **Description**: Google's cross-platform framework
- **Pros**: Good performance, single codebase, hot reload
- **Cons**: Dart language, large runtime, less web support
- **Reason for rejection**: Unfamiliar technology, poor web support

### Alternative 4: Ionic/Capacitor

- **Description**: Hybrid app with web technologies
- **Pros**: Web technologies, access to native APIs
- **Cons**: Performance overhead, complex build process
- **Reason for rejection**: PWA provides similar benefits with less complexity

### Alternative 5: Separate Native Apps

- **Description**: Individual iOS and Android apps
- **Pros**: Best performance on each platform
- **Cons**: Multiple codebases, high maintenance, slow development
- **Reason for rejection**: Too much work for single developer

## Implementation Notes

### PWA Requirements

```json
// manifest.json
{
  "name": "Shayon's News - RSS Reader",
  "short_name": "Shayon's News",
  "description": "Clean, fast RSS reader with AI summaries",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#000000",
  "theme_color": "#000000",
  "orientation": "portrait",
  "icons": [
    {
      "src": "/icon-192.png",
      "sizes": "192x192",
      "type": "image/png",
      "purpose": "any maskable"
    },
    {
      "src": "/icon-512.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

### Service Worker Strategy

```javascript
// Workbox configuration
const runtimeCaching = [
  {
    urlPattern: /^https:\/\/api\.inoreader\.com/,
    handler: "NetworkFirst",
    options: {
      cacheName: "inoreader-api",
      expiration: {
        maxEntries: 50,
        maxAgeSeconds: 5 * 60, // 5 minutes
      },
    },
  },
  {
    urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/,
    handler: "CacheFirst",
    options: {
      cacheName: "images",
      expiration: {
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
      },
    },
  },
];
```

### Mobile-First Design

```css
/* Base mobile styles */
.article-card {
  padding: 16px;
  margin: 8px;
}

/* Tablet and up */
@media (min-width: 768px) {
  .article-card {
    padding: 24px;
    margin: 16px;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .article-list {
    display: grid;
    grid-template-columns: 300px 1fr;
  }
}
```

### iOS PWA Workarounds

```html
<!-- iOS specific tags -->
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />

<!-- Handle iOS standalone mode -->
<script>
  if (window.navigator.standalone) {
    // Handle links in standalone mode
    document.addEventListener("click", (e) => {
      if (e.target.tagName === "A" && e.target.href) {
        e.preventDefault();
        window.location = e.target.href;
      }
    });
  }
</script>
```

### Install Promotion

```typescript
let deferredPrompt: any;

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  deferredPrompt = e;
  showInstallButton();
});

function showInstallButton() {
  const button = document.getElementById("install-button");
  button.style.display = "block";
  button.addEventListener("click", installApp);
}

async function installApp() {
  deferredPrompt.prompt();
  const { outcome } = await deferredPrompt.userChoice;
  if (outcome === "accepted") {
    console.log("PWA installed");
  }
  deferredPrompt = null;
}
```

### Performance Optimizations

1. **App shell architecture**: Cache UI framework
2. **Lazy loading**: Load images and components as needed
3. **Code splitting**: Separate bundles for routes
4. **Preload critical resources**: Fonts, CSS
5. **Optimize for touch**: Larger tap targets

## Testing Strategy

- **Lighthouse PWA audit**: Score 100
- **Mobile device testing**: iOS Safari, Chrome Android
- **Offline testing**: Airplane mode functionality
- **Installation testing**: Add to home screen flow
- **Performance testing**: 3G network simulation

## Future Enhancements

- Web Push Notifications (when iOS supports)
- Background sync for automatic updates
- Web Share API for sharing articles
- File System Access API for import/export

## References

- [PWA Documentation](https://web.dev/progressive-web-apps/)
- [Next.js PWA Guide](https://github.com/shadowwalker/next-pwa)
- [iOS PWA Limitations](https://medium.com/@firt/progressive-web-apps-on-ios-are-here-d00430dee3a7)
- [Workbox Documentation](https://developers.google.com/web/tools/workbox)
