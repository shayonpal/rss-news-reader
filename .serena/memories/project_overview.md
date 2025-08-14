# RSS News Reader Project Overview

## Purpose

RSS News Reader is a self-hosted Progressive Web App (PWA) designed to provide a clean, authentication-free reading experience for RSS feeds. It acts as a proxy for Inoreader API, syncing articles to a local Supabase database for fast, offline-capable access.

## Key Features

- Server-client architecture with complete separation of concerns
- Server handles all Inoreader API communication (OAuth, syncing)
- Client reads exclusively from Supabase (PostgreSQL) database
- Bi-directional sync for read/unread and star status
- AI-powered article summaries using Claude API
- Full content extraction with Mozilla Readability
- Automatic sync 6x daily (2, 6, 10 AM and 2, 6, 10 PM Toronto time)
- Access controlled via Tailscale VPN (100.96.166.53)
- iOS PWA optimized with liquid glass design

## Architecture

- **Data Flow**: Inoreader API → Server → Supabase → Client
- **Access**: Tailscale VPN only, no client authentication
- **Base Path**: `/reader` (required for all routes)
- **Sync**: 24-30 API calls daily with 6x scheduled sync
- **Storage**: OAuth tokens encrypted at `~/.rss-reader/tokens.json`

## Development Environment

- Platform: macOS (Darwin)
- Node.js: v20+
- Package Manager: npm
- Process Manager: PM2
- Testing: Vitest (unit/integration), Playwright (E2E)
- Database: Supabase (PostgreSQL with Row Level Security)
