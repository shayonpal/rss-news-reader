-- Fix security vulnerability in update_updated_at_column function
-- This addresses the mutable search_path warning from Supabase advisory 2025-07-21

-- Drop the existing function
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;

-- Recreate with explicit search_path to prevent SQL injection
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
SECURITY DEFINER
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Recreate all triggers that use this function
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_feeds_updated_at BEFORE UPDATE ON public.feeds
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_articles_updated_at BEFORE UPDATE ON public.articles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_api_usage_updated_at BEFORE UPDATE ON public.api_usage
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sync_metadata_updated_at BEFORE UPDATE ON public.sync_metadata
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();