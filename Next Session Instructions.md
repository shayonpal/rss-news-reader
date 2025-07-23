# Next Session Instructions

**Last Updated:** Thursday, January 23, 2025 at 9:45 PM

## Latest Session - January 23, 2025 (Evening)
- **Duration:** ~3 hours (6:45 PM - 9:45 PM)
- **Main focus:** Full content extraction foundation (TODO-007a, 007b)
- **Issues worked:** TODO-007 subtasks

## Current State
- **Branch:** dev
- **Uncommitted changes:** None (all pushed)
- **Work in progress:** TODO-007c ready to implement

## Completed This Session
- ✅ TODO-007a: Database schema for full content extraction
  - Added is_partial_content column to feeds table
  - Created fetch_logs table with tracking fields
  - Marked BBC, Forbes Tech, Wawa News as partial feeds
- ✅ TODO-007b: Article header UI reorganization
  - Moved Share/Open Original to More dropdown
  - Fixed IOSButton compatibility with Radix UI
  - Ready for Fetch Full Content button

## Next Priority
1. **TODO-007c: Manual Fetch Content Implementation** (High priority)
   - Add Fetch Full Content button in header placeholder
   - Add centered button at article bottom
   - Implement loading states and progress bar
   - Create fetch-content-button.tsx component
   - Handle errors with inline messages

2. **TODO-007d: Feed Partial Content Toggle** (Medium priority)
   - Add "Always fetch for this feed" toggle
   - Create API endpoint for toggling
   - Update feed preferences in database

3. **TODO-007e: Article List Content Priority** (Medium priority)
   - Implement display priority: AI summary → Full → RSS
   - Update article-list-item.tsx

## Important Context
- **Workflow established:** Follow the 8-step process documented
- **UI decisions made:** 
  - Bottom button: centered, inline placement
  - Errors: inline with AlertCircle icon
  - No toast system - using existing patterns
- **Technical notes:**
  - IOSButton now uses forwardRef for dropdown compatibility
  - fetch_type column added to distinguish manual/auto fetches
- **Testing URLs:**
  - Dev: http://100.96.166.53:3000/reader
  - Prod: http://100.96.166.53:3147/reader

## Commands to Run Next Session
```bash
# Continue where left off
cd /Users/shayon/DevProjects/rss-news-reader
git status
npm run dev

# View article detail to test (example)
open http://100.96.166.53:3000/reader/article/[article-id]
```

## Internal TODO Tracking
Current TodoWrite state for TODO-007:
1. ✅ 007-context: Understand requirements
2. ✅ 007a-schema: Database updates
3. ✅ 007b-header: Header reorganization
4. 🔄 007c-manual: Manual fetch button (NEXT)
5. ⏳ 007d-toggle: Feed partial toggle
6. ⏳ 007e-list: Article list priority
7. ⏳ 007f-auto: Auto-fetch service
8. ⏳ 007g-logging: Fetch logging

## Architecture Summary
- Server handles all Inoreader API calls
- Supabase stores article data including full_content
- Client fetches from server endpoint /api/articles/[id]/fetch-content
- Mozilla Readability extracts clean content
- Original RSS content preserved in separate field