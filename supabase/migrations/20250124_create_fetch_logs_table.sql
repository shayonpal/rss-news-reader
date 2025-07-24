-- Create fetch_logs table for tracking content extraction attempts
CREATE TABLE IF NOT EXISTS fetch_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  article_id UUID REFERENCES articles(id) ON DELETE CASCADE,
  feed_id UUID REFERENCES feeds(id) ON DELETE CASCADE,
  fetch_type TEXT NOT NULL CHECK (fetch_type IN ('manual', 'auto')),
  status TEXT NOT NULL CHECK (status IN ('attempt', 'success', 'failure')),
  error_reason TEXT,
  error_details JSONB,
  duration_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX idx_fetch_logs_article ON fetch_logs(article_id);
CREATE INDEX idx_fetch_logs_feed ON fetch_logs(feed_id);
CREATE INDEX idx_fetch_logs_status ON fetch_logs(status);
CREATE INDEX idx_fetch_logs_created ON fetch_logs(created_at DESC);

-- Index for rate limiting checks (auto-fetch within last 30 minutes)
CREATE INDEX idx_fetch_logs_auto_recent ON fetch_logs(created_at, fetch_type) 
WHERE fetch_type = 'auto' AND created_at > (NOW() - INTERVAL '30 minutes');

-- Add comment for clarity
COMMENT ON TABLE fetch_logs IS 'Tracks all full content extraction attempts for articles';
COMMENT ON COLUMN fetch_logs.fetch_type IS 'manual: user-triggered, auto: sync-triggered';
COMMENT ON COLUMN fetch_logs.status IS 'attempt: started, success: completed, failure: failed';
COMMENT ON COLUMN fetch_logs.error_reason IS 'Human-readable error category';
COMMENT ON COLUMN fetch_logs.error_details IS 'Full error details in JSON format';
COMMENT ON COLUMN fetch_logs.duration_ms IS 'Time taken for the fetch operation in milliseconds';