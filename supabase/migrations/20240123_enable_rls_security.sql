-- Enable Row Level Security on all public tables
-- This addresses critical security vulnerability identified in Supabase advisory 2025-07-21

-- Step 1: Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feeds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_metadata ENABLE ROW LEVEL SECURITY;

-- Step 2: Create RLS policies for single-user setup
-- Since this is a single-user app, we'll restrict all access to the single user (shayon)

-- Users table - allow read-only access for the single user
CREATE POLICY "Single user read access" ON public.users
  FOR SELECT
  USING (inoreader_id = 'shayon');

-- Feeds table - allow read access for feeds belonging to the single user
CREATE POLICY "Single user read feeds" ON public.feeds
  FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

-- Folders table - allow read access for folders belonging to the single user
CREATE POLICY "Single user read folders" ON public.folders
  FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

-- Articles table - allow read and update for articles belonging to the single user
CREATE POLICY "Single user read articles" ON public.articles
  FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

CREATE POLICY "Single user update articles" ON public.articles
  FOR UPDATE
  USING (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'))
  WITH CHECK (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

-- API Usage table - allow read access for the single user's API usage
CREATE POLICY "Single user read api usage" ON public.api_usage
  FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

-- Sync Metadata table - allow read access for the single user's sync data
CREATE POLICY "Single user read sync metadata" ON public.sync_metadata
  FOR SELECT
  USING (user_id IN (SELECT id FROM users WHERE inoreader_id = 'shayon'));

-- Step 3: Grant necessary permissions to the anon role (used by the client)
-- The anon role should only have SELECT permissions
GRANT SELECT ON public.users TO anon;
GRANT SELECT ON public.feeds TO anon;
GRANT SELECT ON public.folders TO anon;
GRANT SELECT, UPDATE ON public.articles TO anon;  -- Need UPDATE for marking read/unread
GRANT SELECT ON public.api_usage TO anon;
GRANT SELECT ON public.sync_metadata TO anon;

-- Step 4: Ensure service role (used by server) bypasses RLS
-- Service role already bypasses RLS by default in Supabase

-- Note: After applying this migration, test that:
-- 1. Client can still read all necessary data
-- 2. Client can update article read/starred status
-- 3. Server (using service role) can still perform all operations
-- 4. Unauthorized access (different user or no user) is blocked