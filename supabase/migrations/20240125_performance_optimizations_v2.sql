-- Performance Optimization Migration V2
-- Addresses timezone queries, schema introspection, and upsert performance
-- Updated to match actual schema structure

-- 1. Create indexes for upsert conflict columns to improve performance
-- These indexes will speed up the ON CONFLICT checks during bulk inserts

-- Index for articles.inoreader_id (already unique, but ensure it exists)
CREATE INDEX IF NOT EXISTS idx_articles_inoreader_id 
ON articles(inoreader_id);

-- Index for feeds.inoreader_id (already unique, but ensure it exists)  
CREATE INDEX IF NOT EXISTS idx_feeds_inoreader_id
ON feeds(inoreader_id);

-- Index for folders.inoreader_id
CREATE INDEX IF NOT EXISTS idx_folders_inoreader_id
ON folders(inoreader_id);

-- 2. Create composite indexes for common query patterns
-- These will help with filtering and sorting operations

-- Index for fetching articles by feed and date
CREATE INDEX IF NOT EXISTS idx_articles_feed_date
ON articles(feed_id, published_at DESC)
WHERE feed_id IS NOT NULL;

-- Index for read status queries (join through feeds table)
CREATE INDEX IF NOT EXISTS idx_articles_read_status
ON articles(is_read, published_at DESC);

-- Index for starred articles
CREATE INDEX IF NOT EXISTS idx_articles_starred
ON articles(is_starred, published_at DESC)
WHERE is_starred = true;

-- 3. Create a materialized view for feed statistics to reduce repeated calculations
-- This will cache feed counts and update periodically

CREATE MATERIALIZED VIEW IF NOT EXISTS feed_stats AS
SELECT 
  f.id as feed_id,
  f.user_id,
  COUNT(a.id) FILTER (WHERE a.is_read = false) as unread_count,
  COUNT(a.id) as total_count,
  MAX(a.published_at) as latest_article_date,
  NOW() as last_refreshed
FROM feeds f
LEFT JOIN articles a ON f.id = a.feed_id
GROUP BY f.id, f.user_id;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_feed_stats_user_feed 
ON feed_stats(user_id, feed_id);

-- 4. Create a function to refresh feed stats (can be called after sync)
CREATE OR REPLACE FUNCTION refresh_feed_stats()
RETURNS void
LANGUAGE sql
AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY feed_stats;
$$;

-- 5. Optimize the update_updated_at_column function to avoid repeated lookups
-- Replace the existing function with a more efficient version
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Use CURRENT_TIMESTAMP instead of NOW() to avoid timezone lookups
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 6. Add a configuration table to cache system settings and reduce repeated queries
CREATE TABLE IF NOT EXISTS system_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Insert default timezone to avoid repeated pg_timezone_names queries
INSERT INTO system_config (key, value) 
VALUES ('timezone', '"UTC"'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- 7. Create a function to get articles with minimal timezone operations
-- Updated to work with current schema (no user_id on articles)
CREATE OR REPLACE FUNCTION get_articles_optimized(
  p_user_id UUID,
  p_feed_id UUID DEFAULT NULL,
  p_is_read BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE(
  id UUID,
  title TEXT,
  content TEXT,
  url TEXT,
  published_at TIMESTAMP WITH TIME ZONE,
  is_read BOOLEAN,
  is_starred BOOLEAN,
  feed_id UUID,
  inoreader_id TEXT
)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    a.id,
    a.title,
    a.content,
    a.url,
    a.published_at,
    a.is_read,
    a.is_starred,
    a.feed_id,
    a.inoreader_id
  FROM articles a
  JOIN feeds f ON a.feed_id = f.id
  WHERE 
    f.user_id = p_user_id
    AND (p_feed_id IS NULL OR a.feed_id = p_feed_id)
    AND (p_is_read IS NULL OR a.is_read = p_is_read)
  ORDER BY a.published_at DESC
  LIMIT p_limit
  OFFSET p_offset;
$$;

-- 8. Add database-level connection pooling recommendations as a comment
COMMENT ON DATABASE postgres IS 'Performance recommendations:
1. Enable connection pooling in Supabase dashboard
2. Set statement_timeout to 30s for web requests
3. Configure PostgREST to cache schema for 300s
4. Use prepared statements where possible
5. Monitor with pg_stat_statements extension';

-- 9. Create additional indexes for join performance
-- Index to speed up the join between articles and feeds
CREATE INDEX IF NOT EXISTS idx_feeds_user_id 
ON feeds(user_id);

-- 10. Analyze tables to update statistics after index creation
ANALYZE articles;
ANALYZE feeds;
ANALYZE folders;