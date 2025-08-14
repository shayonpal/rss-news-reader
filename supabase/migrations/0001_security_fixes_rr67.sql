-- Migration: Security Fixes for RR-67
-- Purpose: Fix SECURITY DEFINER views and add search_path to functions
-- Target: 11 security vulnerabilities (4 views + 7 functions)
-- Expected Result: 0 ERROR level issues, ~46% reduction in warnings

-- ============================================================================
-- SECTION 1: FIX SECURITY DEFINER VIEWS (4 views)
-- ============================================================================

-- Drop existing views that have SECURITY DEFINER
DROP VIEW IF EXISTS public.sync_queue_stats CASCADE;
DROP VIEW IF EXISTS public.author_quality_report CASCADE;
DROP VIEW IF EXISTS public.author_statistics CASCADE;
DROP VIEW IF EXISTS public.sync_author_health CASCADE;

-- Recreate views WITHOUT SECURITY DEFINER (will use SECURITY INVOKER by default)

-- 1. sync_queue_stats: Sync monitoring view
CREATE VIEW public.sync_queue_stats WITH (security_invoker = true) AS
SELECT count(*) AS total_pending,
    count(*) FILTER (WHERE (sync_attempts = 0)) AS never_attempted,
    count(*) FILTER (WHERE ((sync_attempts > 0) AND (sync_attempts < 3))) AS retry_pending,
    count(*) FILTER (WHERE (sync_attempts >= 3)) AS failed,
    count(DISTINCT action_type) AS action_types
FROM sync_queue;

-- 2. author_quality_report: Author coverage analysis
CREATE VIEW public.author_quality_report WITH (security_invoker = true) AS
WITH author_stats AS (
    SELECT articles.author,
        count(*) AS article_count,
        length((articles.author)::text) AS author_length,
            CASE
                WHEN ((articles.author)::text ~ '^[A-Za-z\\s\\-\\.]+$'::text) THEN 'standard'::text
                WHEN ((articles.author)::text ~ '[&,]'::text) THEN 'multi_author'::text
                WHEN ((articles.author)::text ~ '[0-9]'::text) THEN 'contains_numbers'::text
                WHEN ((articles.author)::text ~ '[^A-Za-z0-9\\s\\-\\.,&]'::text) THEN 'special_chars'::text
                ELSE 'other'::text
            END AS author_type
       FROM articles
      WHERE (articles.author IS NOT NULL)
      GROUP BY articles.author
    )
SELECT author_type,
    count(*) AS author_count,
    sum(article_count) AS total_articles,
    (avg(author_length))::numeric(10,2) AS avg_length,
    max(author_length) AS max_length,
    min(author_length) AS min_length
FROM author_stats
GROUP BY author_type
ORDER BY (sum(article_count)) DESC;

-- 3. author_statistics: Author metrics view
CREATE VIEW public.author_statistics WITH (security_invoker = true) AS
SELECT count(*) AS total_articles,
    count(author) AS articles_with_author,
    (count(*) - count(author)) AS articles_without_author,
    round((((count(author))::numeric * 100.0) / (NULLIF(count(*), 0))::numeric), 2) AS author_coverage_percentage,
    count(DISTINCT author) AS unique_authors,
    count(
        CASE
            WHEN (length((author)::text) > 100) THEN 1
            ELSE NULL::integer
        END) AS long_author_names,
    count(
        CASE
            WHEN ((author)::text = ''::text) THEN 1
            ELSE NULL::integer
        END) AS empty_string_authors
FROM articles;

-- 4. sync_author_health: Sync health monitoring
CREATE VIEW public.sync_author_health WITH (security_invoker = true) AS
WITH recent_syncs AS (
    SELECT date(articles.updated_at) AS sync_date,
        count(*) AS total_synced,
        count(articles.author) AS with_author,
        (count(*) - count(articles.author)) AS without_author
       FROM articles
      WHERE (articles.updated_at >= (CURRENT_DATE - '7 days'::interval))
      GROUP BY (date(articles.updated_at))
    )
SELECT sync_date,
    total_synced,
    with_author,
    without_author,
    round((((with_author)::numeric * 100.0) / (NULLIF(total_synced, 0))::numeric), 2) AS author_capture_rate
FROM recent_syncs
ORDER BY sync_date DESC;

-- ============================================================================
-- SECTION 2: ADD search_path TO CRITICAL FUNCTIONS (7 functions)
-- ============================================================================

-- 1. get_unread_counts_by_feed: Core unread count functionality
ALTER FUNCTION public.get_unread_counts_by_feed(uuid) SET search_path = public;

-- 2. get_articles_optimized: Main article fetching
ALTER FUNCTION public.get_articles_optimized(uuid, uuid, boolean, integer, integer) SET search_path = public;

-- 3. refresh_feed_stats: Post-sync statistics update
ALTER FUNCTION public.refresh_feed_stats() SET search_path = public;

-- 4. add_to_sync_queue: Bi-directional sync operations
ALTER FUNCTION public.add_to_sync_queue(uuid, text, text) SET search_path = public;

-- 5. update_updated_at_column: Timestamp trigger
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;

-- 6. increment_api_usage: API call tracking (both overloaded versions)
ALTER FUNCTION public.increment_api_usage(character varying, date, integer) SET search_path = public;
ALTER FUNCTION public.increment_api_usage(date, integer, character varying) SET search_path = public;

-- 7. clean_old_sync_queue_entries: Queue maintenance
ALTER FUNCTION public.clean_old_sync_queue_entries() SET search_path = public;

-- ============================================================================
-- SECTION 3: VALIDATION QUERIES (for testing)
-- ============================================================================

-- Verify no views have SECURITY DEFINER
-- Expected: 0 rows
/*
SELECT COUNT(*) as security_definer_views
FROM pg_views 
WHERE schemaname = 'public'
AND viewname IN ('sync_queue_stats', 'author_quality_report', 'author_statistics', 'sync_author_health')
AND definition ILIKE '%SECURITY DEFINER%';
*/

-- Verify all functions have search_path
-- Expected: 8 rows (7 functions, but increment_api_usage has 2 versions)
/*
SELECT COUNT(*) as functions_with_search_path
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname IN (
    'get_unread_counts_by_feed',
    'get_articles_optimized',
    'refresh_feed_stats',
    'add_to_sync_queue',
    'update_updated_at_column',
    'increment_api_usage',
    'clean_old_sync_queue_entries'
)
AND p.proconfig::text LIKE '%search_path=public%';
*/

-- Migration complete!
-- Run security advisors to verify:
-- - ERROR count should be 0
-- - Total warnings should be reduced from 24 to ~13 (46% improvement)