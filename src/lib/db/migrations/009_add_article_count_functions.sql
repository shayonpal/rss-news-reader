-- Add RPC functions for counting articles
-- These are used by the health/freshness endpoint

-- Function to count articles since a given timestamp
CREATE OR REPLACE FUNCTION count_articles_since(since_time TIMESTAMPTZ)
RETURNS TABLE(count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*)::BIGINT
  FROM articles
  WHERE published_at >= since_time;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function to count all articles
CREATE OR REPLACE FUNCTION count_all_articles()
RETURNS TABLE(count BIGINT) AS $$
BEGIN
  RETURN QUERY
  SELECT COUNT(*)::BIGINT
  FROM articles;
END;
$$ LANGUAGE plpgsql STABLE;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION count_articles_since(TIMESTAMPTZ) TO authenticated;
GRANT EXECUTE ON FUNCTION count_all_articles() TO authenticated;
GRANT EXECUTE ON FUNCTION count_articles_since(TIMESTAMPTZ) TO anon;
GRANT EXECUTE ON FUNCTION count_all_articles() TO anon;