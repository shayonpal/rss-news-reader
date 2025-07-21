-- Fix for concurrent refresh of feed_stats materialized view
-- The materialized view needs a unique index to support REFRESH MATERIALIZED VIEW CONCURRENTLY

-- Create unique index on feed_id (which should be unique in the view)
CREATE UNIQUE INDEX IF NOT EXISTS idx_feed_stats_feed_id ON feed_stats (feed_id);

-- Now the refresh_feed_stats() function will work properly with CONCURRENTLY option