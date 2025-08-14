-- Migration: Secure materialized views from API access
-- Issue: RR-147 (Additional security fix)
-- Date: 2025-08-09
-- Description: Remove API access to materialized views that expose user data

-- These materialized views are accessible via Supabase Data API without authentication,
-- exposing user data and reading patterns. They should only be accessible internally.

-- 1. Revoke SELECT permissions from public roles (anon and authenticated)
-- This prevents the views from being accessed via the Data API
REVOKE SELECT ON public.feed_stats FROM anon, authenticated;
REVOKE SELECT ON public.feed_author_stats FROM anon, authenticated;

-- 2. Keep SELECT permission for service_role
-- This allows internal functions and the sync service to still use these views
-- Service role is only used server-side, not exposed to clients
GRANT SELECT ON public.feed_stats TO service_role;
GRANT SELECT ON public.feed_author_stats TO service_role;

-- Note: We cannot enable RLS on materialized views in PostgreSQL
-- The command "ALTER MATERIALIZED VIEW ... ENABLE ROW LEVEL SECURITY" is not supported
-- Instead, we control access through role-based permissions

-- 3. Add comments documenting the security configuration
COMMENT ON MATERIALIZED VIEW public.feed_stats IS 
    'Performance optimization view for feed statistics. ACCESS RESTRICTED: Only accessible via service_role for internal sync operations. Not exposed via Data API.';

COMMENT ON MATERIALIZED VIEW public.feed_author_stats IS 
    'Author coverage analysis view. ACCESS RESTRICTED: Only accessible via service_role for internal analytics. Not exposed via Data API. Consider removing if unused.';

-- Verification query (run manually to confirm permissions):
-- SELECT 
--     schemaname,
--     tablename,
--     tableowner,
--     has_table_privilege('anon', schemaname||'.'||tablename, 'SELECT') as anon_select,
--     has_table_privilege('authenticated', schemaname||'.'||tablename, 'SELECT') as auth_select,
--     has_table_privilege('service_role', schemaname||'.'||tablename, 'SELECT') as service_select
-- FROM pg_tables 
-- WHERE tablename IN ('feed_stats', 'feed_author_stats')
-- UNION ALL
-- SELECT 
--     schemaname,
--     matviewname as tablename,
--     matviewowner as tableowner,
--     has_table_privilege('anon', schemaname||'.'||matviewname, 'SELECT') as anon_select,
--     has_table_privilege('authenticated', schemaname||'.'||matviewname, 'SELECT') as auth_select,
--     has_table_privilege('service_role', schemaname||'.'||matviewname, 'SELECT') as service_select
-- FROM pg_matviews 
-- WHERE matviewname IN ('feed_stats', 'feed_author_stats');