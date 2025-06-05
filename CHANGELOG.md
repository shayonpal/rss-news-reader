# Changelog

All notable changes to Shayon's News RSS Reader PWA will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- N/A

### Changed

- N/A

### Deprecated

- N/A

### Removed

- N/A

### Fixed

- N/A

### Security

- N/A

## [0.3.0] - 2025-01-06

### Added

- **Complete Inoreader OAuth 2.0 Authentication System** (Issue #6: US-002)
  - **OAuth API Routes** (Issue #13)
    - Authorization endpoint with secure state parameter generation
    - Callback route for authorization code exchange
    - Token refresh endpoint for automatic renewal
    - Logout route to clear authentication
    - Status endpoint for auth state checking
  - **Secure Token Storage** (Issue #14)
    - HttpOnly cookies for access and refresh tokens
    - Proper security flags (Secure, SameSite, Path)
    - Token expiration tracking
    - CSRF protection implementation
  - **Authentication State Management** (Issue #15)
    - Zustand store for auth state with persistence
    - Automatic token refresh before expiration
    - User profile data management
    - Loading and error state handling
  - **Authentication UI Components** (Issue #16)
    - Login button with loading states
    - Logout functionality
    - User profile dropdown with avatar
    - Authentication status indicator in header
  - **Protected Routes** (Issue #17)
    - AuthGuard component for route protection
    - Graceful loading states during auth check
    - Fallback UI for unauthenticated users
    - HOC wrapper for page-level protection
  - **API Service Layer** (Issue #18)
    - Axios client with request/response interceptors
    - Automatic token refresh on 401 errors
    - Type-safe Inoreader API methods
    - Error handling and retry logic
  - **Rate Limiting** (Issue #19)
    - 100 calls/day tracking for Inoreader API
    - Usage statistics and warnings
    - Daily reset at midnight UTC
    - Persistent usage tracking

### Technical Implementation

- **Security**: OAuth 2.0 flow with state validation, httpOnly cookies, CSRF protection
- **UI Components**: Radix UI primitives for dropdown and avatar
- **HTTP Client**: Axios with automatic retry and token refresh
- **Dependencies**: Added axios, @radix-ui/react-dropdown-menu, @radix-ui/react-avatar

### User Experience

- **Seamless Authentication**: One-click Inoreader connection
- **Persistent Sessions**: Auth state survives browser refresh
- **Auto Token Refresh**: No manual re-authentication needed
- **Clear Status**: User profile visible when authenticated
- **Protected Content**: Main app requires authentication

### Next Milestone

- IndexedDB data storage implementation (Issue #7)
- Article fetching and display (Epic 2)

## [0.2.0] - 2025-01-06

### Added

- **Complete PWA Foundation** (Issue #5: US-001 Initial App Setup)
  - **PWA Manifest & Service Worker** (Issue #9)
    - Progressive Web App manifest with proper configuration
    - Service worker with Workbox integration for caching strategies
    - Offline-first architecture with multiple cache layers
    - PWA installability on mobile and desktop devices
  - **PWA Icons & Assets** (Issue #10)
    - High-quality RSS icon with orange gradient design
    - Complete icon set: 192x192, 512x512, favicons, Apple touch icons
    - Theme color integration (#FF6B35) across manifest and metadata
  - **App Layout & Navigation** (Issue #12)
    - Responsive header with hamburger menu and sync controls
    - Slide-out navigation sidebar with feed list
    - Complete theme system (light/dark/system) with smooth transitions
    - Mobile-first responsive design with touch-friendly interactions
    - Clean article list layout following Reeder 5 design principles
  - **Offline Caching Strategy** (Issue #11)
    - Multi-layered caching: static assets, API responses, images
    - Network status detection and visual indicators
    - Offline action queue with retry logic for sync operations
    - Cache management utilities with size tracking
    - Graceful offline fallbacks

### Technical Implementation

- **State Management**: Zustand stores for UI, sync, and theme state
- **Caching**: Workbox with Cache First, Network First, and Stale While Revalidate strategies
- **Performance**: 87.1 kB total bundle size, optimized for fast loading
- **Build Quality**: TypeScript strict mode, ESLint compliance, production build success
- **Mobile Support**: Responsive design with proper viewport configuration

### User Experience

- **Installation**: PWA can be installed on home screen across platforms
- **Offline Reading**: Full functionality without internet connection
- **Theme Switching**: Seamless light/dark mode with system preference support
- **Visual Feedback**: Clear indicators for read/unread articles, sync status, and network state
- **Touch Interactions**: Mobile-optimized navigation and touch targets

### Performance Metrics

- **First Load**: ~87 kB compressed JavaScript bundle
- **Static Generation**: All pages pre-rendered for optimal performance
- **Caching**: Intelligent resource caching for offline functionality
- **Loading**: Target <2s initial load, <0.5s navigation

## [0.1.0] - 2025-01-06

### Added

- **Development Environment** (Issue #2)
  - Environment variables template with Inoreader OAuth setup (3 values)
  - Enhanced npm scripts for development workflow
  - Pre-commit quality gates (type-check, lint, format)
  - Development setup documentation
  - Clean, format, and debug scripts
- **Project Infrastructure** (Issue #1)

  - GitHub Project board with custom fields and automation
  - Issue templates and labels system
  - Automated project workflow for issue management
  - Milestone planning for 12-week development cycle

- **Next.js Foundation** (Issue #8)
  - Next.js 14 with App Router configuration
  - TypeScript 5+ with strict mode
  - Tailwind CSS v3+ with Typography plugin
  - ESLint and Prettier configuration
  - Basic project structure and dependencies

### Technical Details

- **Quality Gates**: All builds pass type-check, lint, and format validation
- **Development Scripts**:
  - `npm run dev:debug` - Development with Node.js debugger
  - `npm run dev:turbo` - Development with Turbo mode
  - `npm run pre-commit` - Complete quality check pipeline
  - `npm run clean` - Clean build artifacts and cache
- **Documentation**: Comprehensive setup guide in `docs/development-setup.md`

### Environment

- Node.js 18.17+ required
- Environment variables: Inoreader Client ID/Secret, Anthropic API key
- Development port: 3000 (configurable)

### Next Milestone

Epic 1: Foundation & Authentication - PWA implementation starting with Issue #5 (US-001: Initial App Setup)
