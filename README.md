# Shayon's News - RSS Reader PWA

A Progressive Web Application (PWA) RSS reader with AI-powered article summarization, inspired by Reeder 5's clean design aesthetic.

## Features

- **Progressive Web App**: Install on mobile and desktop devices
- **AI-Powered Summaries**: Generate article summaries using Claude API
- **Offline-First**: Read articles without internet connection
- **Clean Design**: Minimalist interface inspired by Reeder 5
- **Inoreader Integration**: Sync with existing Inoreader subscriptions
- **Dark/Light Mode**: Automatic theme switching
- **Mobile-First**: Optimized for touch interactions

## Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS v3+ with Typography plugin
- **State Management**: Zustand
- **Data Storage**: IndexedDB with Dexie.js
- **UI Components**: Radix UI primitives + custom components
- **PWA**: Service Worker with Workbox
- **Testing**: Vitest, React Testing Library, Playwright

## Development Setup

### Prerequisites

- Node.js 18.17 or higher
- npm 9.0 or higher
- Git

### Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/shayonpal/rss-news-reader.git
   cd rss-news-reader
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Set up environment variables**

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your API credentials:

   - Inoreader API credentials (Client ID, Client Secret, Redirect URI)
   - Anthropic API key for Claude

4. **Start development server**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

### Development Commands

```bash
# Development
npm run dev              # Start development server
npm run dev:debug        # Start with Node.js debugger
npm run dev:turbo        # Start with Turbo mode

# Quality Checks
npm run type-check       # TypeScript compilation check
npm run lint            # ESLint code quality check
npm run format:check    # Prettier formatting check
npm run pre-commit      # Run all quality checks

# Testing
npm run test            # Run all tests
npm run test:unit       # Unit tests only
npm run test:integration # Integration tests only
npm run test:e2e        # End-to-end tests
npm run test:watch      # Tests in watch mode

# Build & Deploy
npm run build           # Production build
npm run start           # Start production server
npm run analyze         # Bundle size analysis
npm run clean           # Clean build artifacts
```

For detailed setup instructions, see [docs/development-setup.md](docs/development-setup.md).

## Project Structure

```
src/
├── app/                 # Next.js App Router
│   ├── api/            # API routes (Inoreader proxy, Claude integration)
│   └── globals.css     # Global styles
├── components/         # Reusable UI components
│   ├── ui/            # Base UI components
│   ├── articles/      # Article-related components
│   └── feeds/         # Feed-related components
├── lib/               # Utility libraries
│   ├── api/          # API service layer
│   ├── db/           # Database utilities
│   ├── stores/       # Zustand stores
│   └── utils/        # Helper functions
├── types/             # TypeScript type definitions
├── hooks/             # Custom React hooks
└── constants/         # App constants
```

## Current Development Status

**Phase**: PWA Foundation Complete - Ready for API Integration

### Completed ✅

- ✅ **Development Environment**: Fully configured with quality gates
- ✅ **Project Infrastructure**: GitHub Projects, automation workflows  
- ✅ **Foundation**: Next.js 14 + TypeScript setup
- ✅ **Issue #5**: Initial App Setup - Full PWA functionality implemented
  - ✅ **Issue #9**: PWA Manifest and Service Worker
  - ✅ **Issue #10**: PWA Icons and Assets  
  - ✅ **Issue #12**: App Layout and Navigation
  - ✅ **Issue #11**: Offline Caching Strategy

### Current Features

- **Installable PWA**: Users can install on mobile and desktop
- **Responsive Design**: Mobile-first layout with sidebar navigation
- **Theme System**: Light/dark/system theme support with smooth transitions
- **Offline Functionality**: Service worker with intelligent caching strategies
- **Network Awareness**: Visual indicators for connection status
- **Sync Management**: Queue system for offline actions with retry logic

### Next Steps

- **Issue #6**: Inoreader OAuth Authentication
- **Issue #7**: Initial Data Storage and IndexedDB setup
- **Epic 2**: Core Reading Features (Article fetching, reading interface)

## Documentation

- **[Development Setup](docs/development-setup.md)**: Complete development environment guide
- **[Development Strategy](docs/development-strategy.md)**: GitHub workflow and project management
- **[Product Requirements](docs/product/PRD.md)**: Detailed product specifications
- **[User Stories](docs/product/user-stories.md)**: All user stories with acceptance criteria
- **[Technical Architecture](docs/tech/)**: Implementation decisions and architecture

## API Integration

### Inoreader API

- OAuth 2.0 authentication
- Feed subscription management
- Article synchronization
- Rate limiting: 100 calls/day

### Claude API (Anthropic)

- AI-powered article summarization
- Model: claude-3-5-sonnet-latest
- Summary length: 100-120 words

## Contributing

1. Check [GitHub Issues](https://github.com/shayonpal/rss-news-reader/issues) for open tasks
2. View [Project Board](https://github.com/users/shayonpal/projects/7) for current sprint
3. Follow development workflow in [docs/development-strategy.md](docs/development-strategy.md)
4. Run quality gates before committing: `npm run pre-commit`

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Support

- **GitHub Issues**: [Report bugs or request features](https://github.com/shayonpal/rss-news-reader/issues)
- **Project Board**: [Track development progress](https://github.com/users/shayonpal/projects/7)
- **Documentation**: See `/docs` folder for detailed guides
