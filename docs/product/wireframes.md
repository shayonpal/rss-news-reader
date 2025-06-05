# Wireframes - Shayon's News

## Overview

These wireframes illustrate the key screens and layouts for the RSS Reader PWA, inspired by Reeder 5's clean aesthetic. The design emphasizes typography, whitespace, and content-first approach.

## Mobile Wireframes (Primary Target)

### 1. Article List View (Default Home)

```
┌─────────────────────────────────────┐
│ ≡  All Articles          (152) 🔄   │  <- Header
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
│ │ focus on enterprise integration  │ │     (100-120 words)
│ │ and ethical AI principles. The   │ │
│ │ company plans to invest $10B...  │ │
│ └─────────────────────────────────┘ │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ Google Pixel 9 Review           │ │
│ │ 9to5Mac • 5 hours ago      ○   │ │  <- ○ = Read
│ │ ─────────────────────────────── │ │
│ │ The Pixel 9 brings meaningful   │ │
│ │ improvements to Google's flag... │ │
│ └─────────────────────────────────┘ │
│                                     │
│              ↓ Pull to refresh       │
└─────────────────────────────────────┘

Legend:
≡  = Menu/Feed List
🔄 = Manual Sync
•  = Unread article
○  = Read article
⚡ = Has AI summary / Tap to generate summary
```

### Summary Interaction States

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
│ Article Title Here          ⟳  │  <- Spinning animation
│ Source • Time ago               │
│ ─────────────────────────────── │
│ Generating summary...           │  <- Loading state
└─────────────────────────────────┘

Has Summary (List View):
┌─────────────────────────────────┐
│ Article Title Here      ⚡ 🔄  │  <- ⚡ = has summary
│ Source • Time ago               │     🔄 = re-generate
│ ─────────────────────────────── │
│ 🤖 Microsoft announces major... │  <- Full summary shown
│ shift in AI development with... │
│ focus on enterprise and...      │
└─────────────────────────────────┘

Summary Error (List View):
┌─────────────────────────────────┐
│ Article Title Here      ⚡ ⚠️  │  <- ⚠️ = error, tap ⚡ to retry
│ Source • Time ago               │
│ ─────────────────────────────── │
│ Summary generation failed.      │
│ Tap ⚡ to try again.            │
└─────────────────────────────────┘
```

### 2. Feed List (Slide-out Drawer)

```
┌─────────────────────────────────────┐
│ ╳  Feeds               Settings ⚙   │
├─────────────────────────────────────┤
│                                     │
│ 📰 All Articles               (152) │  <- Total unread
│ ─────────────────────────────────── │
│                                     │
│ 📁 Tech                        (89) │  <- Folder
│   ├─ The Verge                (23) │
│   ├─ TechCrunch               (18) │
│   ├─ 9to5Mac                  (12) │
│   └─ Ars Technica             (36) │
│                                     │
│ 📁 News                        (42) │
│   ├─ Reuters                  (15) │
│   ├─ BBC                      (18) │
│   └─ The Guardian              (9) │
│                                     │
│ 📁 Blogs                       (21) │  <- Collapsed folder
│                                     │
│ ─────────────────────────────────── │
│ Last sync: 2 hours ago             │
│                                     │
└─────────────────────────────────────┘

Interaction:
- Tap folder to expand/collapse
- Tap feed to filter article list
- Swipe right to close drawer
```

### 3. Article Detail View

```
┌─────────────────────────────────────┐
│ ←                          ⚡  •••  │  <- Back, Summarize, More
├─────────────────────────────────────┤
│                                     │
│   Apple's October Event Announced   │  <- Large title
│                                     │
│   The Verge                         │
│   By Jane Smith • Oct 5, 2024      │  <- Metadata
│   ─────────────────────────────────│
│                                     │
│   Apple has officially announced    │
│   their October event, scheduled    │
│   for October 23rd at 10 AM PST.   │  <- Clean typography
│   The event, titled "Fast Forward" │     Good line height
│   is expected to showcase new...   │     Readable width
│                                     │
│   [Embedded image]                  │  <- Rich media inline
│                                     │
│   The company has been working on   │
│   several new products including    │
│   updated MacBook Pros with the     │
│   latest M3 chips, new iPads...    │
│                                     │
│   [Embedded tweet]                  │
│                                     │
│   Industry analysts expect this     │
│   event to be particularly focused  │
│   on professional users with...     │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 📄 Partial content detected      │ │  <- When needed
│ │ [Fetch Full Article]            │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

Bottom swipe indicators:
← Previous Article | Next Article →
```

### 4. Article with AI Summary

```
┌─────────────────────────────────────┐
│ ←                          🔄  •••  │  <- Re-summarize option
├─────────────────────────────────────┤
│                                     │
│   Microsoft's New AI Strategy       │
│                                     │
│   TechCrunch                        │
│   By John Doe • Oct 5, 2024        │
│   ─────────────────────────────────│
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ 🤖 AI Summary                   │ │  <- Highlighted box
│ │                                 │ │
│ │ Microsoft announces a major     │ │
│ │ strategic shift in AI develop-  │ │
│ │ ment, focusing on enterprise    │ │
│ │ integration and ethical AI      │ │
│ │ principles. The company plans   │ │
│ │ to invest $10 billion over the  │ │
│ │ next three years, partnering    │ │
│ │ with OpenAI while developing    │ │
│ │ proprietary models. Key focus   │ │
│ │ areas include healthcare,       │ │
│ │ education, and climate change.  │ │
│ │                                 │ │
│ │ 115 words • Generated 2 min ago │ │
│ └─────────────────────────────────┘ │
│                                     │
│   ─────────────────────────────────│
│                                     │
│   Full Article:                     │
│                                     │
│   Microsoft made waves in the tech  │
│   industry today with their...      │
│                                     │
└─────────────────────────────────────┘
```

### 5. Settings View

```
┌─────────────────────────────────────┐
│ ←  Settings                         │
├─────────────────────────────────────┤
│                                     │
│ ACCOUNT                             │
│ ┌─────────────────────────────────┐ │
│ │ Inoreader                       │ │
│ │ shayon@example.com             │ │
│ │ Connected ✓                     │ │
│ └─────────────────────────────────┘ │
│                                     │
│ APPEARANCE                          │
│ ┌─────────────────────────────────┐ │
│ │ Theme                           │ │
│ │ ○ Auto  ● Dark  ○ Light       │ │
│ └─────────────────────────────────┘ │
│                                     │
│ SYNC                                │
│ ┌─────────────────────────────────┐ │
│ │ Auto-sync                       │ │
│ │ Every 6 hours              [✓] │ │
│ │                                 │ │
│ │ Last sync: Oct 5, 10:23 AM     │ │
│ │ Next sync: Oct 5, 4:23 PM      │ │
│ │                                 │ │
│ │ [Sync Now]                      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ DATA                                │
│ ┌─────────────────────────────────┐ │
│ │ Storage                         │ │
│ │ 487 articles cached (78 MB)     │ │
│ │                                 │ │
│ │ API Usage →                     │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

### 6. API Usage Dashboard

```
┌─────────────────────────────────────┐
│ ←  API Usage                        │
├─────────────────────────────────────┤
│                                     │
│ TODAY                               │
│ ┌─────────────────────────────────┐ │
│ │ Inoreader API                   │ │
│ │ ████████░░░░░░░░  42/100       │ │
│ │                                 │ │
│ │ AI Summaries                    │ │
│ │ 23 summaries generated          │ │
│ │ ~$0.12 estimated cost           │ │
│ └─────────────────────────────────┘ │
│                                     │
│ LAST 7 DAYS                         │
│ ┌─────────────────────────────────┐ │
│ │     API Calls                   │ │
│ │ 100 ┃                           │ │
│ │  80 ┃   ╱╲                      │ │
│ │  60 ┃  ╱  ╲    ╱╲              │ │
│ │  40 ┃ ╱    ╲__╱  ╲             │ │
│ │  20 ┃╱            ╲            │ │
│ │   0 ┗━━━━━━━━━━━━━━━━          │ │
│ │     M  T  W  T  F  S  S        │ │
│ └─────────────────────────────────┘ │
│                                     │
│ MONTHLY SUMMARY                     │
│ ┌─────────────────────────────────┐ │
│ │ Total API calls: 1,247          │ │
│ │ Total summaries: 312            │ │
│ │ Estimated cost: $1.56           │ │
│ └─────────────────────────────────┘ │
│                                     │
└─────────────────────────────────────┘
```

## Tablet/iPad Wireframes

### 7. Split View Layout (Landscape)

```
┌─────────────────────────────────────────────────────────────┐
│ ≡ All Articles (152)                              🔄  ⚙    │
├────────────────────┬────────────────────────────────────────┤
│                    │                                        │
│ FEEDS              │  Apple's October Event Announced       │
│                    │                                        │
│ 📰 All      (152)  │  The Verge                            │
│ ─────────────────  │  By Jane Smith • Oct 5, 2024          │
│ 📁 Tech      (89)  │  ──────────────────────────────────── │
│   The Verge  (23)  │                                        │
│   TechCrunch (18)  │  Apple has officially announced their  │
│   9to5Mac    (12)  │  October event, scheduled for October  │
│   Ars Tech   (36)  │  23rd at 10 AM PST. The event titled  │
│                    │  "Fast Forward" is expected to...      │
│ 📁 News      (42)  │                                        │
│   Reuters    (15)  │  [Embedded image - full width]         │
│   BBC        (18)  │                                        │
│   Guardian    (9)  │  The company has been working on       │
│                    │  several new products including        │
│ 📁 Blogs     (21)  │  updated MacBook Pros with the latest  │
│                    │  M3 chips, new iPads with OLED...     │
│                    │                                        │
├────────────────────┼────────────────────────────────────────┤
│                    │                                        │
│ • Microsoft's...⚡ │  Article continues here...             │
│ • Google Pixel...  │                                        │
│ ○ iPhone 15 Pro... │                                        │
│ • Tesla Model...   │                                        │
│ • OpenAI GPT-5...⚡│                                        │
│                    │                                        │
└────────────────────┴────────────────────────────────────────┘

Three-column layout:
- Fixed feed list (200px)
- Article list (350px)
- Article content (remaining space)
```

## Responsive Breakpoints

### Phone (< 640px)

- Single column
- Bottom navigation
- Slide-out feed drawer
- Full-width article view

### Tablet Portrait (640px - 1024px)

- Two column: Article list + Article view
- Slide-out feed drawer
- Wider article reading width

### Tablet Landscape / Desktop (> 1024px)

- Three column layout
- Persistent feed list
- Optimal reading width (max 720px)
- More whitespace

## Interaction Patterns

### Touch Targets

```
┌─────────────────────────────────────┐
│ [TAP HERE TO OPEN ARTICLE-------]   │  <- Tappable area
│ Article Title Here          ⚡ [TAP] │  <- ⚡ is separate tap target
│ Source • Time ago                   │  <- Not tappable
│ ─────────────────────────────────── │
│ Summary or preview text here...     │  <- Not tappable
└─────────────────────────────────────┘
```

### Touch Gestures

- **Swipe right**: Open feed drawer (mobile)
- **Swipe left**: Close feed drawer
- **Pull down**: Refresh article list
- **Horizontal swipe**: Navigate articles (detail view)
- **Tap ⚡ icon**: Generate/regenerate summary (list view)
- **Long press**: Future - quick actions

### Summary Generation from List View

1. **Articles without summary**: Show ⚡ icon on the right - tap to generate
2. **Generating state**: ⚡ changes to spinning ⟳ icon
3. **Articles with summary**: Show both ⚡ (indicates has summary) and 🔄 (regenerate)
4. **Failed generation**: Show ⚡ with ⚠️ - tap ⚡ to retry
5. **Offline state**: ⚡ icon is disabled/grayed out

### Toast Notifications

```
Success Toast:
┌─────────────────────────────────────┐
│ ✅ Summary generated successfully   │  <- Auto-dismiss after 3s
└─────────────────────────────────────┘

Error Toast:
┌─────────────────────────────────────┐
│ ❌ Summary generation failed   [✗]  │  <- Dismissible
└─────────────────────────────────────┘
```

### Loading States

```
┌─────────────────────────────────────┐
│ ≡  All Articles          ⟳ Syncing  │  <- Rotating icon
├─────────────────────────────────────┤
│                                     │
│         ░░░░░░░░░░░░░░░            │  <- Skeleton screens
│         ░░░░░░░░░░                 │     while loading
│         ░░░░░░░░░░░░░░░░░░░░       │
│                                     │
│         ░░░░░░░░░░░░░░░            │
│         ░░░░░░░░░░                 │
│         ░░░░░░░░░░░░░░░░░░░░       │
│                                     │
└─────────────────────────────────────┘
```

### Offline State

```
┌─────────────────────────────────────┐
│ ≡  All Articles (152)    🔄 ⚙       │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔌 Offline - Showing cached      │ │  <- Subtle banner
│ └─────────────────────────────────┘ │
│                                     │
│ [Regular article list continues]    │
│                                     │
└─────────────────────────────────────┘
```

### Empty States

```
┌─────────────────────────────────────┐
│ ≡  All Articles              🔄  ⚙  │
├─────────────────────────────────────┤
│                                     │
│                                     │
│          📰                         │
│                                     │
│     No articles to display          │
│                                     │
│     Pull down to refresh or         │
│     check your feed settings        │
│                                     │
│         [Go to Settings]            │
│                                     │
│                                     │
└─────────────────────────────────────┘
```

## Visual Design Principles

### Typography Scale

- Article Title: 20px bold
- Source/Meta: 14px regular (muted)
- Body Text: 16px regular
- Summary Text: 15px regular
- UI Labels: 14px medium

### Spacing System

- Base unit: 4px
- Card padding: 16px
- Between cards: 8px
- Section spacing: 24px
- Line height: 1.5 for body text

### Color Palette (Dark Mode)

- Background: #000000
- Card Background: #1C1C1E
- Text Primary: #FFFFFF
- Text Secondary: #8E8E93
- Accent (unread): #007AFF
- Summary Background: #2C2C2E

### Color Palette (Light Mode)

- Background: #F2F2F7
- Card Background: #FFFFFF
- Text Primary: #000000
- Text Secondary: #6C6C70
- Accent (unread): #007AFF
- Summary Background: #F2F2F7

## Component Library

### Article Card States

```
Default (Unread):
┌─────────────────────────────────┐
│ Title in Bold               •   │
│ Source • Time ago               │
│ ─────────────────────────────── │
│ Preview text or summary...      │
└─────────────────────────────────┘

Read:
┌─────────────────────────────────┐
│ Title in Regular            ○   │  <- Muted colors
│ Source • Time ago               │
│ ─────────────────────────────── │
│ Preview text or summary...      │
└─────────────────────────────────┘

With Summary:
┌─────────────────────────────────┐
│ Title in Bold           ⚡  •   │  <- Lightning icon
│ Source • Time ago               │
│ ─────────────────────────────── │
│ 🤖 Full AI summary text here    │  <- Different background
└─────────────────────────────────┘
```

### Button Styles

```
Primary Action:
[━━━━━━━━━━━━━━━━━]  <- Filled, rounded

Secondary Action:
[                ]  <- Outlined, rounded

Text Button:
 Fetch Full Article  <- No border, accent color
```

### Icons (Lucide React)

- ≡ Menu
- 🔄 RefreshCw
- ⚙️ Settings
- ← ChevronLeft
- → ChevronRight
- ⚡ Zap
- 🤖 Bot
- 📁 Folder
- 📰 Newspaper
- • Circle (filled)
- ○ Circle (outline)

## Accessibility Considerations

- Minimum touch targets: 44x44px
- Color contrast: WCAG AA compliant
- Focus indicators on all interactive elements
- Screen reader labels on all icons
- Semantic HTML structure
- Keyboard navigation support (future)

## Performance Indicators

### Skeleton Screens

Show content structure while loading:

- Gray boxes for text
- Maintain layout structure
- Animate with subtle pulse

### Progressive Loading

1. Show cached content immediately
2. Load article list
3. Fetch images lazily
4. Generate summaries on demand

### Optimistic UI

- Mark read immediately (sync later)
- Show summary generation started
- Update counts instantly

## PWA Specific Elements

### Install Prompt

```
┌─────────────────────────────────────┐
│                                     │
│    Add Shayon's News to Home       │
│                                     │
│    📱 Install this app for:        │
│    • Offline reading               │
│    • Faster launches               │
│    • Home screen access            │
│                                     │
│    [Install]    [Not Now]          │
│                                     │
└─────────────────────────────────────┘
```

### App Icon

- Monochrome newspaper icon
- Works on light/dark backgrounds
- Follows iOS/Android guidelines
- Multiple sizes for different devices

## Error States and Messages

### Summary Generation Errors

```
1. Network Error (Offline)
┌─────────────────────────────────────┐
│ Article Title Here          ⚡      │  <- ⚡ grayed out
│ Source • Time ago                   │
│ ─────────────────────────────────── │
│ Article preview text...             │
└─────────────────────────────────────┘
Toast: "🔌 No connection. Summary generation requires internet."

2. API Rate Limit Exceeded
┌─────────────────────────────────────┐
│ Article Title Here      ⚡ ⚠️      │
│ Source • Time ago                   │
│ ─────────────────────────────────── │
│ Summary limit reached for today     │
└─────────────────────────────────────┘
Toast: "🚫 Daily AI limit reached. Try again tomorrow."

3. API Timeout
┌─────────────────────────────────────┐
│ Article Title Here      ⚡ ⚠️      │
│ Source • Time ago                   │
│ ─────────────────────────────────── │
│ Request timed out. Tap ⚡ to retry │
└─────────────────────────────────────┘
Toast: "⏱️ Request timed out. Please try again."

4. Content Too Long
┌─────────────────────────────────────┐
│ Article Title Here      ⚡ ⚠️      │
│ Source • Time ago                   │
│ ─────────────────────────────────── │
│ Article too long to summarize      │
└─────────────────────────────────────┘
Toast: "📝 Article exceeds AI token limit."

5. Generic API Error
┌─────────────────────────────────────┐
│ Article Title Here      ⚡ ⚠️      │
│ Source • Time ago                   │
│ ─────────────────────────────────── │
│ Something went wrong. Try again.   │
└─────────────────────────────────────┘
Toast: "❌ Summary generation failed. Please try again."
```

### Sync Errors

```
1. Inoreader Authentication Error
┌─────────────────────────────────────┐
│ ≡  All Articles          ⚠️  ⚙️    │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔑 Inoreader authentication    │ │
│ │ expired. Please reconnect.      │ │
│ │                                 │ │
│ │ [Go to Settings]                │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

2. Inoreader API Rate Limit
┌─────────────────────────────────────┐
│ ≡  All Articles          🅿️  ⚙️    │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🚫 API limit reached (95/100)  │ │
│ │ Next sync available at 12:00 AM │ │
│ └─────────────────────────────────┘ │
Toast: "🚫 Inoreader API limit reached. Try again tomorrow."

3. Network Error During Sync
┌─────────────────────────────────────┐
│ ≡  All Articles          ❌  🔄    │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ 🔌 Sync failed. Check your     │ │
│ │ internet connection.            │ │
│ └─────────────────────────────────┘ │
Toast: "🔌 Connection lost. Sync failed."

4. Partial Sync Success
Toast: "⚠️ Sync completed with errors. 82 of 100 articles fetched."
```

### Content Fetching Errors

```
1. Fetch Full Content - Network Error
┌─────────────────────────────────────┐
│ ←                          ⚡  •••  │
├─────────────────────────────────────┤
│ Article content...                  │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ❌ Failed to fetch full content │ │
│ │ Check your connection           │ │
│ │ [Retry]                         │ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘

2. Fetch Full Content - Parsing Failed
┌─────────────────────────────────────┐
│ ←                          ⚡  •••  │
├─────────────────────────────────────┤
│ ┌─────────────────────────────────┐ │
│ │ ⚠️ Could not parse article      │ │
│ │ [View Original]                 │ │  <- Opens in browser
│ └─────────────────────────────────┘ │
│                                     │
│ [Original partial content shown]    │
└─────────────────────────────────────┘
```

### Error Message Reference

| Error Type             | User Message                                           | Technical Log                                 |
| ---------------------- | ------------------------------------------------------ | --------------------------------------------- |
| **Summary Generation** |                                                        |                                               |
| Network Offline        | "No connection. Summary generation requires internet." | `SUMMARY_ERROR: Network unavailable`          |
| API Rate Limit         | "Daily AI limit reached. Try again tomorrow."          | `SUMMARY_ERROR: Rate limit exceeded (429)`    |
| Timeout                | "Request timed out. Please try again."                 | `SUMMARY_ERROR: Request timeout (30s)`        |
| Content Too Long       | "Article exceeds AI token limit."                      | `SUMMARY_ERROR: Token limit exceeded (>100k)` |
| Generic Error          | "Summary generation failed. Please try again."         | `SUMMARY_ERROR: ${error.message}`             |
| **Sync Errors**        |                                                        |                                               |
| Auth Expired           | "Inoreader authentication expired. Please reconnect."  | `SYNC_ERROR: Auth token expired (401)`        |
| API Rate Limit         | "Inoreader API limit reached. Try again tomorrow."     | `SYNC_ERROR: Rate limit (100/100)`            |
| Network Error          | "Connection lost. Sync failed."                        | `SYNC_ERROR: Network unavailable`             |
| Partial Success        | "Sync completed with errors. X of Y articles fetched." | `SYNC_WARNING: Partial sync (X/Y)`            |
| **Content Errors**     |                                                        |                                               |
| Fetch Failed           | "Failed to fetch full content"                         | `CONTENT_ERROR: Fetch failed ${url}`          |
| Parse Failed           | "Could not parse article"                              | `CONTENT_ERROR: Readability parse failed`     |
| URL Invalid            | "Invalid article URL"                                  | `CONTENT_ERROR: Invalid URL format`           |
