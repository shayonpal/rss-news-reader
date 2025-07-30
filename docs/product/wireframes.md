# Wireframes - Shayon's News RSS Reader PWA

**Last Updated:** January 22, 2025  
**Status:** Updated to reflect current implementation

## Overview

These wireframes document the actual implemented UI of the RSS Reader PWA, based on the server-client architecture where all Inoreader API communication happens server-side. The design maintains a clean, minimalist aesthetic while focusing on core functionality.

## Current Architecture Context

- **Server-Client Model**: Server handles all Inoreader API, Client reads from Supabase
- **No Authentication**: Access controlled via Tailscale network only
- **Data Flow**: Inoreader → Server → Supabase → Client
- **Access URL**: http://100.96.166.53:3000/reader (dev) or http://100.96.166.53/reader (production)

## Mobile Wireframes (Primary Target)

### 1. Article List View (Default Home) - IMPLEMENTED ✅

```
┌─────────────────────────────────────┐
│ ≡  All Articles          (152) 🔄   │  <- Header with sync
├─────────────────────────────────────┤
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Apple's October Event Announced  │ │
│ │ The Verge • 2 hours ago     ⚡  │ │  <- ⚡ Tap to summarize
│ │ ─────────────────────────────── │ │
│ │ Apple has officially announced   │ │
│ │ their October event focusing on  │ │  <- 4 lines max
│ │ new Macs and iPads. The event   │ │     or full summary
│ │ will be held virtually on...    │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Microsoft's New AI Strategy  ⚡  │ │  <- ⚡ = Has summary
│ │ TechCrunch • 3 hours ago    •   │ │  <- • = Unread
│ │ ─────────────────────────────── │ │
│ │ Microsoft announces major shift  │ │
│ │ in AI development approach with  │ │  <- Full AI summary
│ │ focus on enterprise integration  │ │     (150-175 words)
│ │ and ethical AI principles. The   │ │     with paragraphs
│ │ company plans to invest $10B...  │ │
│ │                                 │ │
│ │ The new strategy positions...   │ │  <- Multiple paragraphs
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Google Pixel 9 Review           │ │
│ │ 9to5Mac • 5 hours ago      ○   │ │  <- ○ = Read (grayed)
│ │ ─────────────────────────────── │ │
│ │ The Pixel 9 brings meaningful   │ │
│ │ improvements to Google's flag... │ │
│ └─────────────────────────────────┘ │
│                                     │
│              ↓ Infinite scroll      │
└─────────────────────────────────────┘

Features Implemented:
- Pull-to-refresh gesture
- Infinite scroll with loading indicator
- Summary generation from list view
- Read/unread visual states
- Star/unstar functionality
- Scroll position preservation
```

### Summary States in List View - IMPLEMENTED ✅

```
No Summary (List View):
┌─────────────────────────────────┐
│ Article Title Here          ⚡  │  <- Tap ⚡ to generate
│ Source • Time ago               │
│ ─────────────────────────────── │
│ First few lines of article...   │
└─────────────────────────────────┘

Generating Summary (List View):
┌─────────────────────────────────┐
│ Article Title Here              │
│ Source • Time ago               │
│ ─────────────────────────────── │
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │  <- Shimmer animation
│ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│ ░░░░░░░░░░░░░░░░░░░░░░        │
└─────────────────────────────────┘

Has Summary (List View):
┌─────────────────────────────────┐
│ Article Title Here          ⚡  │  <- ⚡ indicates has summary
│ Source • Time ago               │
│ ─────────────────────────────── │
│ Microsoft announces major...    │  <- Full summary shown
│ shift in AI development with... │     with proper paragraphs
│ focus on enterprise and...      │
│                                │
│ The new strategy includes...    │  <- Multiple paragraphs
└─────────────────────────────────┘
```

### 2. Feed Sidebar - IMPLEMENTED ✅

```
┌─────────────────────────────────────┐
│  Feeds                              │
│  152 unread articles          Sync  │  <- Header with count
├─────────────────────────────────────┤
│                                     │
│ 📰 All Articles               (152) │  <- Total unread
│ ─────────────────────────────────── │
│                                     │
│ The Verge                      (23) │  <- Individual feeds
│ TechCrunch                     (18) │     (flat list, no folders)
│ 9to5Mac                        (12) │
│ Ars Technica                   (36) │
│ Reuters                        (15) │
│ BBC                            (18) │
│ The Guardian                    (9) │
│ Hacker News                    (21) │
│                                     │
│ ─────────────────────────────────── │
│ Last sync: 10:23 AM                 │
│ 8 feeds total                       │
│ API usage: 42/100 calls today       │  <- Rate limit warning
│                                     │
└─────────────────────────────────────┘

Current Implementation Notes:
- Simple flat feed list (no folder hierarchy yet)
- Sync button shows progress percentage
- Rate limit warnings at 80% (yellow) and 95% (red)
- Real-time sync progress indication
```

### Sync States - IMPLEMENTED ✅

```
Initial Sync (Empty State):
┌─────────────────────────────────────┐
│  Feeds                              │
│  0 unread articles            Sync  │
├─────────────────────────────────────┤
│                                     │
│          ⟳ (spinning)               │
│     Syncing your feeds...           │
│                                     │
│     ████████░░░░░░░░░░             │
│           42%                       │
│                                     │
└─────────────────────────────────────┘

Sync in Progress (With Feeds):
┌─────────────────────────────────────┐
│  Feeds                              │
│  152 unread articles        [42%]   │  <- Progress in button
├─────────────────────────────────────┤
│ [Feed list continues normally]      │
└─────────────────────────────────────┘

Sync Error:
┌─────────────────────────────────────┐
│  Feeds                              │
│  0 unread articles            Sync  │
├─────────────────────────────────────┤
│                                     │
│     Failed to sync feeds            │
│     Rate limit exceeded             │
│                                     │
│        [Retry]                      │
│                                     │
└─────────────────────────────────────┘
```

### 3. Article Detail View - IMPLEMENTED ✅

```
┌─────────────────────────────────────┐
│ ←                    ⭐ 🔗 ↗️ ⚡    │  <- Action buttons
├─────────────────────────────────────┤
│                                     │
│   Apple's October Event Announced   │  <- Large title
│                                     │
│   The Verge                         │
│   By Jane Smith • 2 hours ago      │  <- Metadata
│   ─────────────────────────────────│
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🤖 AI Summary              [∨] │ │  <- Collapsible
│ │                                 │ │
│ │ Apple's October event will      │ │
│ │ showcase new M3 MacBook Pros    │ │
│ │ and updated iPads. The event    │ │
│ │ focuses on professional users   │ │
│ │ with significant performance    │ │
│ │ improvements expected...        │ │
│ └─────────────────────────────────┘ │
│                                     │
│   ─────────────────────────────────│
│                                     │
│   Apple has officially announced    │
│   their October event, scheduled    │
│   for October 23rd at 10 AM PST.   │  <- Clean typography
│   The event, titled "Fast Forward"  │     Good line height
│   is expected to showcase new...   │     Readable width
│                                     │
│   [Embedded image]                  │  <- Rich media inline
│                                     │
│   The company has been working on   │
│   several new products including    │
│   updated MacBook Pros with the     │
│   latest M3 chips, new iPads...    │
│                                     │
├─────────────────────────────────────┤
│ ← Previous Article | Next Article → │  <- Navigation footer
└─────────────────────────────────────┘

Action Buttons:
← = Back to list
⭐ = Star/unstar (fills when starred)
🔗 = Share (native share or copy link)
↗️ = Open original article
⚡ = Generate/regenerate summary
```

### 4. Summary Display Component - IMPLEMENTED ✅

```
Article View (Collapsible Summary):
┌─────────────────────────────────────┐
│ 🤖 AI Summary                   ∨  │  <- Gray background
│                                     │     Click header to toggle
│ Apple announces October event       │
│ focusing on new M3 MacBook Pros    │
│ and updated iPads with OLED        │
│ displays. The event targets        │
│ professional users with major      │
│ performance improvements.          │
│                                     │
│ Key announcements expected to      │  <- Paragraph breaks
│ include 14" and 16" MacBook Pros  │     preserved
│ with M3 Pro/Max chips offering     │
│ 40% faster performance...          │
└─────────────────────────────────────┘

Collapsed State:
┌─────────────────────────────────────┐
│ 🤖 AI Summary                   ›  │  <- Click to expand
└─────────────────────────────────────┘
```

## Features Not Yet Implemented

### 1. Feed Organization (TODO-014)

```
Future: Two-Tab Interface
┌─────────────────────────────────────┐
│ [Feeds]  Tags              Settings │  <- Tab navigation
├─────────────────────────────────────┤
│ 📁 Tech                        (89) │  <- Folder hierarchy
│   ├─ The Verge                (23) │
│   ├─ TechCrunch               (18) │
│   └─ Ars Technica             (48) │
│                                     │
│ 📁 News                        (42) │
│   ├─ Reuters                  (15) │
│   └─ BBC                      (27) │
└─────────────────────────────────────┘
```

### 2. Full Content Fetching (TODO-008)

```
Future: Fetch Full Content Button
┌─────────────────────────────────────┐
│ [Article content...]                │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📄 Partial content detected      │ │
│ │ [Fetch Full Article]            │ │  <- Server endpoint ready
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

### 3. Read Status Filter (TODO-014)

```
Future: Read Status Filter
┌─────────────────────────────────────┐
│ ≡  All Articles  [Unread only ▼]   │  <- Dropdown filter
├─────────────────────────────────────┤
│ Options:                            │
│ • Unread only (default)             │
│ • Read only                         │
│ • All articles                      │
└─────────────────────────────────────┘
```

### 4. Settings View (TODO-015)

```
Future: Settings Page
┌─────────────────────────────────────┐
│ ←  Settings                         │
├─────────────────────────────────────┤
│                                     │
│ APPEARANCE                          │
│ ┌─────────────────────────────────┐ │
│ │ Theme                           │ │
│ │ ○ Auto  ● Dark  ○ Light       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ SYNC                                │
│ ┌─────────────────────────────────┐ │
│ │ Last sync: Oct 5, 10:23 AM     │ │
│ │ Articles synced: 168            │ │
│ │ API calls today: 42/100         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

## Tablet/Desktop Layouts - BASIC SUPPORT

Currently, the app uses responsive design but doesn't have tablet-specific layouts. The mobile layout scales up with wider content areas.

### Future: Split View Layout (Tablet)

```
┌────────────────────┬────────────────────────────────────────┐
│ FEEDS              │  Article List                          │
│                    ├────────────────────────────────────────┤
│ 📰 All      (152)  │  Apple's October Event...         ⚡  │
│ ─────────────────  │  The Verge • 2 hours ago              │
│ The Verge    (23)  │  ──────────────────────────────────── │
│ TechCrunch   (18)  │  Apple has officially announced...     │
│ 9to5Mac      (12)  │                                        │
│                    │  Microsoft's AI Strategy...        ⚡  │
│                    │  TechCrunch • 3 hours ago             │
└────────────────────┴────────────────────────────────────────┘
```

## Visual Design Implementation

### Typography (Implemented)

- Article Title: text-base sm:text-lg (16-18px)
- Source/Meta: text-xs sm:text-sm (12-14px)
- Body Text: text-sm (14px)
- Summary Text: text-sm (14px)

### Spacing System (Implemented)

- Base unit: 4px (Tailwind spacing)
- Card padding: p-4 sm:p-6 (16-24px)
- Between cards: divide-y (1px border)
- Line height: leading-relaxed for summaries

### Color System (Implemented)

Using Tailwind CSS with dark mode support:

- Background: bg-background (white/dark)
- Text: text-foreground/text-muted-foreground
- Borders: border/divide-border
- Interactive: hover:bg-muted/50
- Accent: text-primary (for counts/badges)

## Component States

### Article Card States (Implemented)

```
Unread Article:
- Bold title (font-semibold)
- Full opacity
- Unread indicator (implicit)

Read Article:
- Normal title (font-normal)
- Reduced opacity (opacity-70)
- Muted text color

With Summary:
- Lightning icon (⚡) shown
- Full summary text displayed
- Proper paragraph formatting

Loading Summary:
- Shimmer animation
- Skeleton placeholder
```

### Interactive Elements (Implemented)

- **Touch Targets**: Minimum 44x44px (enforced)
- **Hover States**: hover:bg-muted/50
- **Active States**: Via IOSButton component for iOS
- **Loading States**: Spinner animations and progress bars
- **Error States**: Clear error messages with retry options

## Performance Optimizations (Implemented)

### Progressive Loading

1. ✅ Skeleton screens while loading
2. ✅ Infinite scroll for articles
3. ✅ On-demand summary generation
4. ✅ Scroll position preservation

### UI Optimizations

1. ✅ Optimistic UI for read/star actions
2. ✅ Debounced search/filter operations
3. ✅ Efficient re-renders with Zustand
4. ✅ Lazy loading for article content

## Error Handling (Implemented)

### Summary Generation Errors

- Network offline: Button disabled
- Rate limit: Clear error message
- Generation failed: Retry option available

### Sync Errors

- Rate limit warnings at 80% and 95%
- Failed sync with retry button
- Clear error messages

## Accessibility Features (Implemented)

- ✅ Semantic HTML structure
- ✅ ARIA labels on interactive elements
- ✅ Keyboard navigation support (J/K keys)
- ✅ Focus indicators on all buttons
- ✅ Screen reader compatible

## PWA Features (Partial)

### Implemented

- ✅ Service worker registration
- ✅ Basic offline detection
- ✅ Web app manifest

### Not Yet Implemented

- ❌ Install prompts
- ❌ App icons for all platforms
- ❌ Splash screens
- ❌ Update notifications

## Production Deployment Status

Currently running in development mode. Production deployment (TODO-011) will include:

- Caddy reverse proxy at /reader path
- PM2 process management
- Tailscale network security
- Final URL: http://100.96.166.53/reader
