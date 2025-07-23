-- Add is_partial_content column to feeds table
ALTER TABLE feeds 
ADD COLUMN IF NOT EXISTS is_partial_content BOOLEAN DEFAULT FALSE;

-- Create fetch_logs table for tracking content extraction attempts
CREATE TABLE IF NOT EXISTS fetch_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    feed_id UUID NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
    timestamp TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    success BOOLEAN NOT NULL,
    error_reason TEXT,
    fetch_type TEXT NOT NULL CHECK (fetch_type IN ('manual', 'auto')),
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_fetch_logs_article_id ON fetch_logs(article_id);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_feed_id ON fetch_logs(feed_id);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_timestamp ON fetch_logs(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_fetch_logs_success ON fetch_logs(success);
CREATE INDEX IF NOT EXISTS idx_feeds_is_partial_content ON feeds(is_partial_content) WHERE is_partial_content = TRUE;

-- Add comment for documentation
COMMENT ON COLUMN feeds.is_partial_content IS 'Whether this feed provides partial content that should be auto-fetched';
COMMENT ON TABLE fetch_logs IS 'Logs all attempts to fetch full article content, both manual and automatic';