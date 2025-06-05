# Development Setup Guide

This guide will help you set up the development environment for the RSS News Reader application.

## Prerequisites

- **Node.js**: Version 18.17 or higher
- **npm**: Version 9.0 or higher (comes with Node.js)
- **Git**: For version control

## Environment Setup

### 1. Clone and Install

```bash
git clone <repository-url>
cd rss-news-reader
npm install
```

### 2. Environment Variables

1. Copy the environment template:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in your API credentials in `.env.local`:

   ```bash
   # Inoreader API Configuration
   NEXT_PUBLIC_INOREADER_CLIENT_ID=your_actual_client_id
   NEXT_PUBLIC_INOREADER_REDIRECT_URI=http://localhost:3000/api/auth/callback

   # Anthropic Claude API
   ANTHROPIC_API_KEY=your_actual_anthropic_api_key

   # Environment
   NODE_ENV=development
   ```

### 3. Verify Installation

Run the following commands to ensure everything is set up correctly:

```bash
npm run type-check    # Should pass without errors
npm run lint         # Should pass without errors
npm run format:check # Should pass without errors
npm run build        # Should compile successfully
```

## Development Commands

### Basic Commands

- `npm run dev` - Start development server (http://localhost:3000)
- `npm run build` - Build for production
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript compiler check

### Enhanced Development

- `npm run dev:debug` - Start dev server with Node.js debugger
- `npm run dev:turbo` - Start dev server with Turbo mode
- `npm run clean` - Clean build artifacts and cache
- `npm run format` - Format code with Prettier
- `npm run format:check` - Check code formatting
- `npm run pre-commit` - Run all quality checks

### Testing

- `npm run test` - Run all tests
- `npm run test:unit` - Run unit tests only
- `npm run test:integration` - Run integration tests only
- `npm run test:e2e` - Run end-to-end tests
- `npm run test:watch` - Run tests in watch mode

### Analysis

- `npm run analyze` - Analyze bundle size

## IDE Recommendations

### VS Code Extensions

- **TypeScript**: Built-in TypeScript support
- **ESLint**: Automatic linting
- **Prettier**: Code formatting
- **Tailwind CSS IntelliSense**: CSS class autocomplete
- **Auto Rename Tag**: HTML/JSX tag renaming

### Settings

The project includes a VS Code workspace file (`rss-news-reader.code-workspace`) with recommended settings.

## Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript 5+
- **Styling**: Tailwind CSS v3+
- **State Management**: Zustand
- **Database**: IndexedDB with Dexie.js
- **UI Components**: Radix UI primitives
- **Testing**: Vitest + React Testing Library + Playwright

## Development Workflow

1. **Quality Gates**: Before committing, run:

   ```bash
   npm run pre-commit
   ```

2. **Branch Naming**: Use descriptive branch names:

   ```bash
   git checkout -b feature/issue-[NUMBER]-brief-description
   ```

3. **Commit Messages**: Reference issue numbers for auto-close:

   ```bash
   git commit -m "Implement feature X

   - Add specific functionality
   - Include relevant details

   Fixes #[ISSUE_NUMBER]"
   ```

## Troubleshooting

### Common Issues

**Build Errors:**

- Ensure Node.js version is 18.17+
- Clear cache: `npm run clean`
- Reinstall dependencies: `rm -rf node_modules package-lock.json && npm install`

**TypeScript Errors:**

- Check `tsconfig.json` configuration
- Restart TypeScript server in your IDE

**Environment Variables:**

- Ensure `.env.local` exists and has all required variables
- Restart development server after changing environment variables

**Port Conflicts:**

- Default port is 3000. If occupied, Next.js will auto-increment
- Manually specify port: `npm run dev -- -p 3001`

### Getting Help

- Check the [GitHub Issues](https://github.com/shayonpal/rss-news-reader/issues)
- Review documentation in the `/docs` folder
- See project board: [RSS Reader Project](https://github.com/users/shayonpal/projects/7)

## Performance Targets

- **Initial Load**: < 2 seconds
- **Article Open**: < 0.5 seconds
- **60fps Scrolling**: Maintained during navigation
- **Offline Support**: Service Worker with caching strategy
