-- Create a function to get unread counts per feed efficiently
CREATE OR REPLACE FUNCTION get_unread_counts_by_feed(p_user_id UUID)
RETURNS TABLE(feed_id UUID, unread_count BIGINT)
LANGUAGE sql
STABLE
AS $$
  SELECT 
    feed_id,
    COUNT(*)::BIGINT as unread_count
  FROM articles
  WHERE 
    user_id = p_user_id 
    AND is_read = false
    AND feed_id IS NOT NULL
  GROUP BY feed_id;
$$;

-- Add an index to speed up unread count queries
CREATE INDEX IF NOT EXISTS idx_articles_unread_counts 
ON articles(user_id, is_read, feed_id) 
WHERE is_read = false;