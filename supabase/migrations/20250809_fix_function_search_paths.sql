-- Migration: Fix function search_path vulnerabilities
-- Issue: RR-147
-- Date: 2025-08-09
-- Description: Add explicit search_path to 10 functions to prevent privilege escalation attacks

-- These functions were identified by Supabase security advisor as having mutable search_path
-- which could allow attackers to hijack function execution through schema manipulation.
-- Setting search_path = public ensures functions only access objects in the public schema.

-- 1. associate_articles_with_folder_tags
ALTER FUNCTION public.associate_articles_with_folder_tags() 
SET search_path = public;

-- 2. check_author_anomalies
ALTER FUNCTION public.check_author_anomalies()
SET search_path = public;

-- 3. cleanup_old_deleted_articles
ALTER FUNCTION public.cleanup_old_deleted_articles()
SET search_path = public;

-- 4. cleanup_old_parsed_content
ALTER FUNCTION public.cleanup_old_parsed_content()
SET search_path = public;

-- 5. cleanup_orphaned_tags
ALTER FUNCTION public.cleanup_orphaned_tags()
SET search_path = public;

-- 6. count_all_articles
ALTER FUNCTION public.count_all_articles()
SET search_path = public;

-- 7. count_articles_since
ALTER FUNCTION public.count_articles_since(p_user_id uuid, p_since timestamptz)
SET search_path = public;

-- 8. detect_partial_feeds
ALTER FUNCTION public.detect_partial_feeds()
SET search_path = public;

-- 9. refresh_author_monitoring
ALTER FUNCTION public.refresh_author_monitoring()
SET search_path = public;

-- 10. update_tag_counts
ALTER FUNCTION public.update_tag_counts()
SET search_path = public;

-- Verification query (run manually to confirm all functions have search_path set):
-- SELECT 
--     n.nspname AS schema_name,
--     p.proname AS function_name,
--     pg_get_function_identity_arguments(p.oid) AS arguments,
--     p.prosecdef AS is_security_definer,
--     p.proconfig AS configuration
-- FROM pg_proc p
-- JOIN pg_namespace n ON p.pronamespace = n.oid
-- WHERE n.nspname = 'public'
--     AND p.prokind = 'f'
--     AND (p.proconfig IS NULL OR NOT 'search_path=public' = ANY(p.proconfig))
-- ORDER BY p.proname;