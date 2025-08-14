-- RR-175: Optimize RLS policies with subqueries for better performance
-- This migration optimizes existing RLS policies by:
-- 1. Creating a function to cache user lookups
-- 2. Using EXISTS clauses instead of IN for better query planning
-- 3. Reducing redundant user table lookups

-- Create a function to get the single user ID efficiently
CREATE OR REPLACE FUNCTION get_single_user_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT id FROM users WHERE inoreader_id = 'shayon' LIMIT 1;
$$;

-- Create an index for faster user lookups if not exists
CREATE INDEX IF NOT EXISTS idx_users_inoreader_id ON users(inoreader_id);

-- Drop existing policies to replace with optimized versions
DROP POLICY IF EXISTS "Single user read feeds" ON public.feeds;
DROP POLICY IF EXISTS "Single user read folders" ON public.folders;
DROP POLICY IF EXISTS "Single user read articles" ON public.articles;
DROP POLICY IF EXISTS "Single user update articles" ON public.articles;
DROP POLICY IF EXISTS "Single user read api usage" ON public.api_usage;
DROP POLICY IF EXISTS "Single user read sync metadata" ON public.sync_metadata;

-- Recreate policies with optimized subqueries using EXISTS
-- Feeds table - optimized with EXISTS
CREATE POLICY "Single user read feeds" ON public.feeds
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = feeds.user_id 
    AND users.inoreader_id = 'shayon'
  ));

-- Folders table - optimized with EXISTS
CREATE POLICY "Single user read folders" ON public.folders
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = folders.user_id 
    AND users.inoreader_id = 'shayon'
  ));

-- Articles table - optimized with JOIN through feeds
CREATE POLICY "Single user read articles" ON public.articles
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM feeds 
    JOIN users ON users.id = feeds.user_id
    WHERE feeds.id = articles.feed_id 
    AND users.inoreader_id = 'shayon'
  ));

CREATE POLICY "Single user update articles" ON public.articles
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM feeds 
    JOIN users ON users.id = feeds.user_id
    WHERE feeds.id = articles.feed_id 
    AND users.inoreader_id = 'shayon'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM feeds 
    JOIN users ON users.id = feeds.user_id
    WHERE feeds.id = articles.feed_id 
    AND users.inoreader_id = 'shayon'
  ));

-- API Usage table - simplified since it doesn't have user_id
-- First check if api_usage has a user_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'api_usage' 
        AND column_name = 'user_id'
    ) THEN
        EXECUTE 'CREATE POLICY "Single user read api usage" ON public.api_usage
            FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = api_usage.user_id 
                AND users.inoreader_id = ''shayon''
            ))';
    ELSE
        -- If no user_id column, allow all reads (single user app)
        EXECUTE 'CREATE POLICY "Single user read api usage" ON public.api_usage
            FOR SELECT
            USING (true)';
    END IF;
END $$;

-- Sync Metadata table - simplified since it uses key-value pairs
-- Check if sync_metadata has a user_id column
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'sync_metadata' 
        AND column_name = 'user_id'
    ) THEN
        EXECUTE 'CREATE POLICY "Single user read sync metadata" ON public.sync_metadata
            FOR SELECT
            USING (EXISTS (
                SELECT 1 FROM users 
                WHERE users.id = sync_metadata.user_id 
                AND users.inoreader_id = ''shayon''
            ))';
    ELSE
        -- If no user_id column, allow all reads (single user app)
        EXECUTE 'CREATE POLICY "Single user read sync metadata" ON public.sync_metadata
            FOR SELECT
            USING (true)';
    END IF;
END $$;

-- Optimize tags table policies if they exist
DROP POLICY IF EXISTS "Single user read tags" ON tags;
DROP POLICY IF EXISTS "Single user insert tags" ON tags;
DROP POLICY IF EXISTS "Single user update tags" ON tags;
DROP POLICY IF EXISTS "Single user delete tags" ON tags;

-- Recreate tags policies with EXISTS
CREATE POLICY "Single user read tags" ON tags
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = tags.user_id 
        AND users.inoreader_id = 'shayon'
    ));

CREATE POLICY "Single user insert tags" ON tags
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = tags.user_id 
        AND users.inoreader_id = 'shayon'
    ));

CREATE POLICY "Single user update tags" ON tags
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = tags.user_id 
        AND users.inoreader_id = 'shayon'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = tags.user_id 
        AND users.inoreader_id = 'shayon'
    ));

CREATE POLICY "Single user delete tags" ON tags
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM users 
        WHERE users.id = tags.user_id 
        AND users.inoreader_id = 'shayon'
    ));

-- Optimize article_tags policies
DROP POLICY IF EXISTS "Single user read article_tags" ON article_tags;
DROP POLICY IF EXISTS "Single user insert article_tags" ON article_tags;
DROP POLICY IF EXISTS "Single user update article_tags" ON article_tags;
DROP POLICY IF EXISTS "Single user delete article_tags" ON article_tags;

-- Recreate article_tags policies with optimized EXISTS
CREATE POLICY "Single user read article_tags" ON article_tags
    FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM articles a
        JOIN feeds f ON f.id = a.feed_id
        JOIN users u ON u.id = f.user_id
        WHERE a.id = article_tags.article_id
        AND u.inoreader_id = 'shayon'
    ));

CREATE POLICY "Single user insert article_tags" ON article_tags
    FOR INSERT
    WITH CHECK (EXISTS (
        SELECT 1 FROM articles a
        JOIN feeds f ON f.id = a.feed_id
        JOIN users u ON u.id = f.user_id
        WHERE a.id = article_tags.article_id
        AND u.inoreader_id = 'shayon'
    ));

CREATE POLICY "Single user update article_tags" ON article_tags
    FOR UPDATE
    USING (EXISTS (
        SELECT 1 FROM articles a
        JOIN feeds f ON f.id = a.feed_id
        JOIN users u ON u.id = f.user_id
        WHERE a.id = article_tags.article_id
        AND u.inoreader_id = 'shayon'
    ))
    WITH CHECK (EXISTS (
        SELECT 1 FROM articles a
        JOIN feeds f ON f.id = a.feed_id
        JOIN users u ON u.id = f.user_id
        WHERE a.id = article_tags.article_id
        AND u.inoreader_id = 'shayon'
    ));

CREATE POLICY "Single user delete article_tags" ON article_tags
    FOR DELETE
    USING (EXISTS (
        SELECT 1 FROM articles a
        JOIN feeds f ON f.id = a.feed_id
        JOIN users u ON u.id = f.user_id
        WHERE a.id = article_tags.article_id
        AND u.inoreader_id = 'shayon'
    ));