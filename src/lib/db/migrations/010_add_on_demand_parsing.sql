-- Migration: Add on-demand content parsing support for RR-148
-- Adds fields to track partial feeds and content parsing status

-- Add is_partial_feed flag to feeds table to identify feeds with incomplete content
ALTER TABLE feeds 
ADD COLUMN IF NOT EXISTS is_partial_feed BOOLEAN DEFAULT false;

-- Add parsed_at timestamp to articles table to track when full content was extracted
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS parsed_at TIMESTAMP WITH TIME ZONE;

-- Add parse_failed flag to articles table for tracking extraction failures
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS parse_failed BOOLEAN DEFAULT false;

-- Add parse_attempts counter to track retry attempts
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS parse_attempts INTEGER DEFAULT 0;

-- Add content_length to track original content size for partial feed detection
ALTER TABLE articles
ADD COLUMN IF NOT EXISTS content_length INTEGER;

-- Create index for efficient queries on partial feed articles
CREATE INDEX IF NOT EXISTS idx_articles_parsed_at ON articles(parsed_at);
CREATE INDEX IF NOT EXISTS idx_articles_parse_failed ON articles(parse_failed);
CREATE INDEX IF NOT EXISTS idx_feeds_is_partial ON feeds(is_partial_feed);

-- Add retention policy configuration to system_config
INSERT INTO system_config (key, value, description, updated_at)
VALUES 
  ('content_retention_days', '30', 'Number of days to retain parsed full content', NOW()),
  ('parse_timeout_seconds', '30', 'Maximum time allowed for content parsing', NOW()),
  ('max_concurrent_parses', '5', 'Maximum concurrent content parsing operations', NOW()),
  ('retry_delay_seconds', '2', 'Delay before retrying failed parse', NOW()),
  ('max_parse_attempts', '3', 'Maximum parse attempts before marking as failed', NOW())
ON CONFLICT (key) DO UPDATE 
SET value = EXCLUDED.value, 
    description = EXCLUDED.description,
    updated_at = NOW();

-- Function to detect partial feeds based on average content length
CREATE OR REPLACE FUNCTION detect_partial_feeds()
RETURNS void AS $$
BEGIN
  -- Mark feeds as partial if average content length is less than 500 chars
  -- or if more than 50% of articles have "Read more" indicators
  UPDATE feeds f
  SET is_partial_feed = true
  FROM (
    SELECT 
      feed_id,
      AVG(LENGTH(content)) as avg_content_length,
      SUM(CASE 
        WHEN content LIKE '%Read more%' 
          OR content LIKE '%Continue reading%' 
          OR content LIKE '%[...]%'
          OR LENGTH(content) < 500
        THEN 1 ELSE 0 
      END)::float / COUNT(*)::float as truncation_ratio
    FROM articles
    WHERE created_at > NOW() - INTERVAL '7 days'
    GROUP BY feed_id
    HAVING AVG(LENGTH(content)) < 500 OR 
           SUM(CASE 
             WHEN content LIKE '%Read more%' 
               OR content LIKE '%Continue reading%' 
               OR content LIKE '%[...]%'
               OR LENGTH(content) < 500
             THEN 1 ELSE 0 
           END)::float / COUNT(*)::float > 0.5
  ) partial_feeds
  WHERE f.id = partial_feeds.feed_id;
END;
$$ LANGUAGE plpgsql;

-- Function to clean up old parsed content based on retention policy
CREATE OR REPLACE FUNCTION cleanup_old_parsed_content()
RETURNS void AS $$
DECLARE
  retention_days INTEGER;
BEGIN
  -- Get retention policy from config
  SELECT value::INTEGER INTO retention_days
  FROM system_config
  WHERE key = 'content_retention_days';
  
  -- Default to 30 days if not configured
  IF retention_days IS NULL THEN
    retention_days := 30;
  END IF;
  
  -- Clear full_content for old, read articles (preserve starred)
  UPDATE articles
  SET full_content = NULL,
      parsed_at = NULL
  WHERE parsed_at < NOW() - INTERVAL '1 day' * retention_days
    AND is_read = true
    AND is_starred = false
    AND full_content IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Add comment to track migration
COMMENT ON COLUMN feeds.is_partial_feed IS 'Flag indicating if feed typically contains partial/truncated content requiring on-demand parsing';
COMMENT ON COLUMN articles.parsed_at IS 'Timestamp when full content was successfully extracted on-demand';
COMMENT ON COLUMN articles.parse_failed IS 'Flag indicating if content extraction failed after max attempts';
COMMENT ON COLUMN articles.parse_attempts IS 'Number of parse attempts made for this article';
COMMENT ON COLUMN articles.content_length IS 'Original content length for partial feed detection';