-- RR-143: Author Data Monitoring and Performance Optimization
-- Created: 2025-01-06
-- Purpose: Set up monitoring views and indexes for author data integrity

-- 1. Create index for author searches (if not exists)
CREATE INDEX IF NOT EXISTS idx_articles_author ON articles(author);

-- 2. Create index for author analysis queries
CREATE INDEX IF NOT EXISTS idx_articles_author_not_null ON articles(author) 
WHERE author IS NOT NULL;

-- 3. Create monitoring view for author statistics
CREATE OR REPLACE VIEW author_statistics AS
SELECT 
    COUNT(*) as total_articles,
    COUNT(author) as articles_with_author,
    COUNT(*) - COUNT(author) as articles_without_author,
    ROUND(COUNT(author)::numeric * 100.0 / NULLIF(COUNT(*), 0), 2) as author_coverage_percentage,
    COUNT(DISTINCT author) as unique_authors,
    COUNT(CASE WHEN LENGTH(author) > 100 THEN 1 END) as long_author_names,
    COUNT(CASE WHEN author = '' THEN 1 END) as empty_string_authors
FROM articles;

-- 4. Create view for author data quality monitoring
CREATE OR REPLACE VIEW author_quality_report AS
WITH author_stats AS (
    SELECT 
        author,
        COUNT(*) as article_count,
        LENGTH(author) as author_length,
        CASE 
            WHEN author ~ '^[A-Za-z\s\-\.]+$' THEN 'standard'
            WHEN author ~ '[&,]' THEN 'multi_author'
            WHEN author ~ '[0-9]' THEN 'contains_numbers'
            WHEN author ~ '[^A-Za-z0-9\s\-\.,&]' THEN 'special_chars'
            ELSE 'other'
        END as author_type
    FROM articles
    WHERE author IS NOT NULL
    GROUP BY author
)
SELECT 
    author_type,
    COUNT(*) as author_count,
    SUM(article_count) as total_articles,
    AVG(author_length)::numeric(10,2) as avg_length,
    MAX(author_length) as max_length,
    MIN(author_length) as min_length
FROM author_stats
GROUP BY author_type
ORDER BY total_articles DESC;

-- 5. Create view for sync health monitoring
CREATE OR REPLACE VIEW sync_author_health AS
WITH recent_syncs AS (
    SELECT 
        DATE(updated_at) as sync_date,
        COUNT(*) as total_synced,
        COUNT(author) as with_author,
        COUNT(*) - COUNT(author) as without_author
    FROM articles
    WHERE updated_at >= CURRENT_DATE - INTERVAL '7 days'
    GROUP BY DATE(updated_at)
)
SELECT 
    sync_date,
    total_synced,
    with_author,
    without_author,
    ROUND(with_author::numeric * 100.0 / NULLIF(total_synced, 0), 2) as author_capture_rate
FROM recent_syncs
ORDER BY sync_date DESC;

-- 6. Create function to check for author data anomalies
CREATE OR REPLACE FUNCTION check_author_anomalies()
RETURNS TABLE(
    check_name TEXT,
    issue_count INTEGER,
    severity TEXT,
    details TEXT
) AS $$
BEGIN
    -- Check for empty strings
    RETURN QUERY
    SELECT 
        'Empty String Authors'::TEXT,
        COUNT(*)::INTEGER,
        CASE WHEN COUNT(*) > 0 THEN 'WARNING' ELSE 'OK' END::TEXT,
        CASE WHEN COUNT(*) > 0 
            THEN 'Found ' || COUNT(*) || ' articles with empty string authors'
            ELSE 'No empty string authors found'
        END::TEXT
    FROM articles
    WHERE author = '';

    -- Check for very long authors
    RETURN QUERY
    SELECT 
        'Excessively Long Authors'::TEXT,
        COUNT(*)::INTEGER,
        CASE WHEN COUNT(*) > 0 THEN 'INFO' ELSE 'OK' END::TEXT,
        CASE WHEN COUNT(*) > 0 
            THEN 'Found ' || COUNT(*) || ' articles with authors > 100 chars'
            ELSE 'All author names within reasonable length'
        END::TEXT
    FROM articles
    WHERE LENGTH(author) > 100;

    -- Check for potential placeholder authors
    RETURN QUERY
    SELECT 
        'Placeholder Authors'::TEXT,
        COUNT(*)::INTEGER,
        CASE WHEN COUNT(*) > 0 THEN 'INFO' ELSE 'OK' END::TEXT,
        CASE WHEN COUNT(*) > 0 
            THEN 'Found ' || COUNT(*) || ' articles with generic author names'
            ELSE 'No obvious placeholder authors detected'
        END::TEXT
    FROM articles
    WHERE LOWER(author) IN ('admin', 'administrator', 'rss', 'feed', 'unknown', 'webmaster', 'noreply', 'editor');

    -- Check for encoding issues
    RETURN QUERY
    SELECT 
        'Encoding Issues'::TEXT,
        COUNT(*)::INTEGER,
        CASE WHEN COUNT(*) > 0 THEN 'ERROR' ELSE 'OK' END::TEXT,
        CASE WHEN COUNT(*) > 0 
            THEN 'Found ' || COUNT(*) || ' articles with potential encoding issues'
            ELSE 'No encoding issues detected'
        END::TEXT
    FROM articles
    WHERE author ~ '[�]' OR author ~ '[\x00-\x08\x0B\x0C\x0E-\x1F]';

    -- Check for sync timestamp issues
    RETURN QUERY
    SELECT 
        'Missing Sync Timestamps'::TEXT,
        COUNT(*)::INTEGER,
        CASE WHEN COUNT(*) > 100 THEN 'WARNING' 
             WHEN COUNT(*) > 0 THEN 'INFO' 
             ELSE 'OK' 
        END::TEXT,
        CASE WHEN COUNT(*) > 0 
            THEN 'Found ' || COUNT(*) || ' articles without sync timestamps'
            ELSE 'All articles have sync timestamps'
        END::TEXT
    FROM articles
    WHERE last_sync_update IS NULL;
END;
$$ LANGUAGE plpgsql;

-- 7. Create materialized view for feed-level author statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS feed_author_stats AS
SELECT 
    f.id as feed_id,
    f.title as feed_title,
    COUNT(a.id) as total_articles,
    COUNT(a.author) as articles_with_author,
    ROUND(COUNT(a.author)::numeric * 100.0 / NULLIF(COUNT(a.id), 0), 2) as author_coverage,
    COUNT(DISTINCT a.author) as unique_authors,
    STRING_AGG(DISTINCT a.author, ', ' ORDER BY a.author) FILTER (WHERE a.author IS NOT NULL) as sample_authors
FROM feeds f
LEFT JOIN articles a ON f.id = a.feed_id
GROUP BY f.id, f.title
ORDER BY author_coverage DESC;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_feed_author_stats_coverage ON feed_author_stats(author_coverage);

-- 8. Create function to refresh monitoring data
CREATE OR REPLACE FUNCTION refresh_author_monitoring()
RETURNS TEXT AS $$
BEGIN
    -- Refresh the materialized view
    REFRESH MATERIALIZED VIEW CONCURRENTLY feed_author_stats;
    
    -- Return summary
    RETURN 'Author monitoring data refreshed successfully at ' || NOW()::TEXT;
END;
$$ LANGUAGE plpgsql;

-- 9. Add comment documentation
COMMENT ON VIEW author_statistics IS 'Real-time statistics for author data coverage and quality';
COMMENT ON VIEW author_quality_report IS 'Detailed analysis of author data patterns and types';
COMMENT ON VIEW sync_author_health IS 'Monitor author capture rate across recent sync operations';
COMMENT ON FUNCTION check_author_anomalies() IS 'Comprehensive check for author data quality issues';
COMMENT ON MATERIALIZED VIEW feed_author_stats IS 'Per-feed author coverage statistics (refresh with refresh_author_monitoring())';

-- 10. Grant appropriate permissions
GRANT SELECT ON author_statistics TO authenticated;
GRANT SELECT ON author_quality_report TO authenticated;
GRANT SELECT ON sync_author_health TO authenticated;
GRANT SELECT ON feed_author_stats TO authenticated;
GRANT EXECUTE ON FUNCTION check_author_anomalies() TO authenticated;
GRANT EXECUTE ON FUNCTION refresh_author_monitoring() TO authenticated;