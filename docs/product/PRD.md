# PRD - Shayon's News RSS Reader PWA

## Product Overview

### Product Name
**Shayon's News**

### Vision
A clean, fast, and intelligent RSS reader that respects the user's time by providing AI-powered summaries and seamless offline access. Built as a Progressive Web Application for cross-device compatibility.

### Core Value Proposition
- **Time-Efficient**: AI summaries let users quickly grasp article content
- **Always Available**: Offline-first design ensures content is always accessible
- **Distraction-Free**: Clean interface inspired by Reeder 5's minimalist design
- **Single Source of Truth**: Inoreader integration eliminates feed management overhead

### Target User
Initially built for personal use with plans to open-source under GPL for the wider community.

### Related Documentation
- [User Flow Diagrams](user-flow-diagrams.md) - Technical flows and system states
- [User Journeys](user-journeys.md) - Emotional journeys and use cases

## Core Features

### Feed Management
- Synchronize feeds exclusively through Inoreader account
- Preserve Inoreader's folder hierarchy
- Display unread counts at both feed and folder levels
- No manual feed management within the app

### Article Synchronization
- Automatic sync every 6 hours
- Manual sync option available
- Fetch up to 100 new articles per sync (max 20 per feed)
- Round-robin fetching to ensure all feeds get representation
- URL-based deduplication

### Content Processing
- Detect partial vs full content in feeds
- Manual "Fetch Full Content" button for partial articles
- Parse and clean content for optimal readability
- Preserve essential rich media (images, videos, embedded tweets)
- Display 4 lines of parsed content for articles without summaries

### AI Summarization
- On-demand summarization using Anthropic Claude 3.5 Sonnet
- 100-120 word summaries
- Re-summarize option for unsatisfactory summaries
- Cache all generated summaries
- Display full summary in list view when available

### User Interface
- Clean, minimalist design inspired by Reeder 5
- Dark/light mode based on system preference
- Typography-first approach for optimal readability
- Dense information display without feeling cramped
- Subtle, smooth transitions

### Offline Capabilities
- Cache last 50 article titles and metadata
- Store full content for viewed articles
- Graceful degradation when offline
- Clear offline status indicators

## Detailed Requirements

### Authentication & Setup
- OAuth integration with Inoreader
- No local authentication required
- Store Inoreader tokens securely
- Clear setup flow for first-time users

### Feed Synchronization Rules

#### Sync Frequency
- Automatic sync every 6 hours
- Manual sync available anytime
- Respect Inoreader API rate limits (100 calls/day for Zone 1)

#### Sync Process
1. Fetch subscription list
2. Fetch folder/tag structure
3. Get all new articles via stream API (batched)
4. Fetch unread counts
5. Update read/unread states bidirectionally

#### Sync Limits
- Maximum 100 new articles per sync across all feeds
- Maximum 20 new articles per individual feed
- Round-robin distribution when limits are reached
- Prioritize unread articles

#### API Efficiency
- Batch operations wherever possible
- Use stream endpoints to minimize API calls
- Target: ~5-6 API calls per complete sync
- Cache aggressively to reduce API usage

### Article Management

#### Storage
- Maintain maximum 500 articles
- Daily pruning at midnight (oldest first)
- Separate storage for:
  - Article metadata (always retained for last 500)
  - Article content (retained for viewed articles)
  - AI summaries (retained while article exists)

#### Display Rules
- List View:
  - Show AI summary if available (full text)
  - Otherwise show 4 lines of parsed content
  - Strip all HTML from snippets
  - Include source, author, date
- Article View:
  - Show parsed content by default if available
  - "Fetch Full Content" button for partial feeds
  - Display all rich media appropriately

#### Read/Unread Management
- Bidirectional sync with Inoreader
- Visual distinction between read/unread
- Batch updates every 30 minutes or on-demand
- Conflict resolution: most recent change wins

### Summary Generation

#### AI Configuration
- Model: Anthropic Claude 3.5 Sonnet (claude-3-5-sonnet-latest)
- Summary length: 100-120 words
- Include article metadata in prompt

#### Prompt Template
```
You are a news summarization assistant. Create a concise summary of the following article in 100-120 words. Focus on the key facts, main arguments, and important conclusions. Maintain objectivity and preserve the author's core message.

Article Details:
Title: [TITLE]
Author: [AUTHOR]
Published: [DATE]

Article Content:
[BODY]

Write a clear, informative summary that captures the essence of this article.
```

#### Summary Management
- Store summaries permanently with articles
- Update list view immediately after generation
- Allow re-summarization with same prompt
- Track API usage for monitoring

### Navigation & Information Architecture

#### Views
1. **Feed List** (Sidebar/Drawer)
   - Hierarchical folder structure
   - Collapsible folders
   - Unread counts per feed and folder
   - Visual indicators for sync status

2. **Article List** (Main View)
   - Newest first, no sorting options
   - Clear visual hierarchy
   - Read/unread distinction
   - Summary/snippet display

3. **Article Detail**
   - Full parsed content
   - Article metadata header
   - Summarize/Re-summarize button
   - Fetch Full Content button (for partial feeds)
   - Swipe navigation (previous/next article)

4. **Settings**
   - Inoreader connection status
   - Theme preference
   - Sync configuration
   - API usage statistics

5. **API Usage Monitor**
   - Daily API call count
   - AI summarization count
   - Historical usage graphs
   - Cost tracking

### Data Persistence

#### Local Storage Strategy
- Article metadata: Always keep last 500
- Article content: Keep for all viewed articles
- Summaries: Persist with articles
- Last 50 articles: Always cache title + metadata
- Sync state: Track last sync time and status

#### Offline Behavior
- Display all cached content
- Disable network-dependent features
- Show subtle offline indicator
- Queue read/unread changes for next sync

### Sync Conflict Resolution
- Track modification timestamps
- Most recent change wins
- Apply changes in order during sync
- No user intervention required

## User Interface Specifications

### Design Principles
1. **Typography First**: Large, readable fonts with clear hierarchy
2. **Minimal Chrome**: Focus on content, reduce UI elements
3. **Smart Whitespace**: Generous padding without wasting space
4. **Subtle Interactions**: Smooth transitions, no flashy animations
5. **Monochrome Base**: Grayscale palette with accent colors
6. **Information Density**: Fit more content without cramping

### Views & Layouts

#### Mobile Layout (Primary)
- Bottom navigation for main sections
- Swipe from left edge for feed list
- Full-width article list
- Edge-to-edge article reading

#### Tablet/Desktop Layout
- Persistent sidebar with feed list
- Multi-column article list (tablet landscape)
- Wider reading column with margins
- Keyboard navigation support (future)

### Visual Hierarchy
1. Article titles (largest, boldest)
2. Source and metadata (smaller, muted)
3. Summary/snippet text (readable, moderate size)
4. UI controls (small, unobtrusive)
5. Status indicators (subtle, contextual)

### Interaction Patterns
- Tap to read article
- Long-press for quick actions (future)
- Swipe between articles in detail view
- Pull-to-refresh in list view
- Smooth scrolling with momentum

### Responsive Behavior
- Single layout system that adapts
- Breakpoints at 640px, 768px, 1024px
- Font sizes scale with viewport
- Touch targets minimum 44x44px

## System Behaviors

### Sync Process & Limits

#### Automatic Sync
- Run every 6 hours
- Silent background operation
- Update UI incrementally
- Handle failures gracefully

#### Manual Sync
- User-triggered via pull-to-refresh or button
- Show progress indicator
- Display result summary (X new articles)
- Respect same limits as auto-sync

#### Rate Limit Management
- Track API calls per day
- Warn user at 80% usage
- Disable sync at 95% usage
- Reset counter at midnight UTC

### Error Handling

#### Network Errors
- Retry with exponential backoff
- Fall back to cached content
- Clear error messages
- Suggest offline mode

#### API Errors
- Handle rate limits gracefully
- Display Inoreader service status
- Provide manual retry option
- Log errors for debugging

#### Content Parsing Errors
- Show original content as fallback
- Log problematic feeds
- Allow manual refresh
- Skip malformed articles

### Offline Mode
- Automatic detection
- Disable sync buttons
- Enable read/unread queue
- Show cached content indicator
- Sync automatically when online

### Performance Targets
- Initial load: < 2 seconds
- Article list render: < 1 second
- Article open: < 0.5 seconds
- Summary generation: < 5 seconds
- Smooth 60fps scrolling

### API Usage Monitoring

#### Tracking
- Inoreader API calls by endpoint
- Anthropic API calls and tokens
- Daily, weekly, monthly views
- Cost calculation display

#### Logging
- Store last 30 days of logs
- Accessible via settings
- Export functionality (future)
- Debug mode for development

## Future Considerations

### Explicitly Out of Scope for v1
- Multiple user support
- Feed management within app
- Full-text search
- Bookmarking/favorites
- Note-taking/annotations
- Keyboard shortcuts
- Push notifications
- Email digests
- Custom AI providers
- OPML import/export
- Reading statistics
- Social sharing

### Architecture Decisions for Future Features
- Design with search index in mind
- Abstract AI provider interface
- Plan for user preference storage
- Consider real-time sync architecture
- Prepare for collaborative features

## Success Metrics

### Core Success Criteria
1. **Performance**: Page loads under 2 seconds consistently
2. **Reliability**: 99% successful sync rate
3. **Efficiency**: Stay under 50 API calls/day average
4. **Usability**: Read 50+ articles without friction
5. **AI Value**: 80% of summaries are helpful

### Quality Indicators
- Smooth offline/online transitions
- No data loss during syncs
- Accurate unread counts
- Consistent UI responsiveness
- Clear error recovery paths

## Development Milestones

### Milestone 1: Foundation (Week 1-2)
- Project setup and configuration
- Inoreader OAuth integration
- Basic data models and storage
- Simple article list view
- Manual sync functionality

### Milestone 2: Core Reading Experience (Week 3-4)
- Article detail view
- Folder/feed hierarchy display
- Read/unread status management
- Offline content caching
- Basic responsive design

### Milestone 3: Content Enhancement (Week 5-6)
- Partial content detection
- Full content fetching
- Content parsing and cleaning
- Rich media preservation
- Improved typography

### Milestone 4: AI Integration (Week 7-8)
- Anthropic API integration
- Summary generation flow
- Summary caching
- Re-summarize functionality
- API usage tracking

### Milestone 5: Polish & Optimization (Week 9-10)
- Dark/light mode
- Performance optimization
- Error handling improvements
- API usage dashboard
- PWA manifest and icons

### Milestone 6: Production Ready (Week 11-12)
- Deployment configuration
- Documentation
- Testing and bug fixes
- Performance monitoring
- Open source preparation

## Development Notes

### API Conservation During Development
- Use mock data whenever possible
- Cache API responses aggressively
- Implement "development mode" with stale data
- Share test accounts to minimize API usage
- Log all API calls for optimization

### Technology Recommendations
- **Framework**: Consider Next.js, Nuxt, or SvelteKit for SSR/PWA support
- **Styling**: Tailwind CSS + Typography plugin for Reeder-like aesthetics
- **Components**: Radix UI or Headless UI for accessibility
- **State**: Keep it simple - Context API or Zustand
- **Storage**: IndexedDB for offline support
- **PWA**: Workbox for service worker management

### Open Source Considerations
- Choose GPL license as specified
- Prepare documentation early
- Design for self-hosting
- Make API keys configurable
- Consider Docker deployment