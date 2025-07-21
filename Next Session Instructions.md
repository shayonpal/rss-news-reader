# Next Session Instructions

**Last Updated:** Monday, July 21, 2025 at 3:30 PM

## Latest Session - July 21, 2025 (3:00 PM - 3:30 PM)
- **Duration:** ~30 minutes
- **Main focus:** Performance troubleshooting, security advisory review, and mobile fixes
- **Issues addressed:** Mobile responsiveness, 404 errors, performance optimization

## Current State
- **Branch:** main
- **Status:** Clean (all changes pushed)
- **Latest commit:** 57017cc
- **Critical Issues:** RLS disabled on all tables (security vulnerability)

## Completed This Session
- ✅ Fixed mobile responsiveness with slide-out sidebar
- ✅ Resolved 404 errors by disabling legacy health checks
- ✅ Fixed article navigation and star button persistence
- ✅ Identified N+1 query problem causing 6.4s load time
- ✅ Implemented performance optimization for unread counts
- ✅ Created Epic 8 for security and performance fixes
- ✅ Updated documentation with Supabase advisory warnings

## 🚨 CRITICAL SECURITY ISSUES - IMMEDIATE ACTION REQUIRED

### Security Vulnerabilities (from Supabase Advisory 2025-07-21)
1. **🔴 Row Level Security DISABLED on ALL tables**
   - Anyone with Supabase anon key can read/modify all data
   - Migration file ready: `20240123_enable_rls_security.sql`
   
2. **🟡 Function security vulnerability**
   - `update_updated_at_column` has mutable search_path
   - Migration file ready: `20240124_fix_function_security.sql`

### Performance Issues Identified
1. **Timezone queries:** 45.4% of execution time
2. **Schema introspection:** 10.2% of execution time  
3. **Feed loading:** Was 6.4s, optimized to <1s (pending migration)
4. **Upsert operations:** 28-52ms per article

## Next Priority - Phase 0: CRITICAL SECURITY (Before anything else!)

### 1. **Apply Security Migrations**
```bash
# Run these migrations IMMEDIATELY on Supabase
supabase/migrations/20240123_enable_rls_security.sql
supabase/migrations/20240124_fix_function_security.sql
supabase/migrations/20240122_create_unread_counts_function.sql
```

### 2. **Test After RLS Enable**
- Verify client can still read feeds/articles
- Verify client can update read/starred status
- Test unauthorized access is blocked
- Ensure server (service role) still works

### 3. **Complete US-102** (Server Sync - Remaining)
- Implement automatic daily cron job
- Add sync error logging to database
- Implement read state sync back to Inoreader

## After Security Fixes - Continue with Features

### 4. **US-301 & US-302: AI Summarization** ✅ COMPLETED
- Server endpoints working perfectly
- Summary UI fully integrated in article list and detail views
- Shimmer loading states implemented
- Re-summarize functionality working

### 5. **Complete US-203** (Remaining tasks)
- Add "Fetch Full Content" button to article view
- Display extracted content when available
- Server endpoint ready at `/api/articles/:id/fetch-content`

## Commands to Run Next Session
```bash
# Start development
cd /Users/shayon/DevProjects/rss-news-reader
git pull origin main
npm run dev:network

# Test performance improvements
open http://100.96.166.53:3000/reader/test-performance

# Check Supabase dashboard for security status
# Verify RLS is enabled on all tables after migrations
```

## Performance Test Results (Mobile)
- **Supabase connection:** 315ms
- **Simple query:** 254ms (5 feeds)
- **Count query:** 189ms (287 unread)
- **Feed hierarchy load:** 6.4s → Should be <1s after migration

## Important Reminders
- **🔴 SECURITY FIRST:** Do not deploy to production until RLS is enabled
- **Service Role Key:** Keep server-side only, never expose to client
- **Anon Key:** Only for client read operations with RLS protection
- **Performance:** Run the unread counts migration for 10x speed improvement

## Technical Architecture
- **Server:** Handles all external APIs (Inoreader, Claude)
- **Client:** Pure presentation layer, reads from Supabase only
- **Security:** Tailscale network + RLS policies
- **Data Flow:** Inoreader → Server → Supabase → Client

---

## Critical Path:
1. Apply security migrations
2. Test RLS thoroughly  
3. Apply performance migration
4. Then continue with feature development