# iOS 26 Liquid Glass Redesign - Key Decisions

## Date: January 2025

## Navigation Architecture
- **Bottom Tab Bar**: 4 tabs replacing hamburger menu
  - Articles (with dual filter system)
  - Feeds (with drill-down navigation)  
  - Stats
  - Settings
- **No Sidebar**: Simplified architecture for all platforms
- **All platforms**: Same UI for iPhone/iPad/Desktop

## Visual Design
- **Glass Morphism**: Adaptive light/dark modes
  - Heavy glass in light mode (blur-24px, 28% white)
  - Light glass in dark mode (blur-16px, 16% white)
- **Icons**: SF Symbols + Heroicons fallback
- **Animation**: CSS + minimal JS (spring cubic-bezier)
- **Tab Animation**: Icon morph (outline to filled) + micro-bounce
- **Interactions**: Pull-to-refresh, haptic feedback, empty states

## Component Updates
- **Listing Header**: Theme toggle + Filter dropdown (source selection)
- **Floating Filter Pill**: Read status filter (All/Unread/Read) appears on scroll
- **Article Header**: Glass pill with actions (star, summarize, fetch, more menu)
- **Article Navigation**: Swipe gestures replace prev/next buttons
- **Summary Section**: Glass morphism with expand-in-place animation
- **Read Articles**: Faded appearance (60% opacity)

## Implementation Order
1. D: Listing page header (smallest change)
2. A: Bottom tab navigation (biggest UX change)  
3. B: Glass morphism CSS system (foundation)
4. C: Article header redesign (visual impact)

## Technical Decisions
- **Performance**: Balance of native feel and speed
- **Breaking Changes**: Accept immediate switch to tabs
- **Dual Filter System**: 
  - Source filter in header dropdown (All/Folder/Feed)
  - Read status in floating pill (All/Unread/Read)
- **Feed Navigation**: Tap folder for articles, chevron to expand/collapse
- **Theme System**: Light/Dark/System modes with smooth transitions
- **More Menu**: iOS-style dropdown animation
- **Summary**: Auto-scroll to generated summary

## Next Documentation
1. glass-morphism-css-architecture.md (CSS foundation)
2. tab-navigation-component.md (component structure)
3. migration-plan.md (removal of old UI)
4. animation-system.md (interactions)