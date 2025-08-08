-- RR-154: Fix HTML entities in existing article titles and content
-- This migration processes 308 existing articles to decode HTML entities
-- Entities like &rsquo;, &amp;, &lsquo;, &quot;, &#8217;, &ndash; will be decoded

-- First, add a function to safely decode HTML entities
CREATE OR REPLACE FUNCTION decode_html_entities(input_text text) 
RETURNS text 
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
    IF input_text IS NULL OR input_text = '' THEN
        RETURN input_text;
    END IF;

    -- Don't decode URLs (basic check for URLs)
    IF input_text ~ '^(https?|feed|tag)://.*' THEN
        RETURN input_text;
    END IF;

    -- Replace common HTML entities with their Unicode equivalents
    RETURN replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(replace(
        input_text,
        '&rsquo;', chr(8217)    -- Right single quotation mark '
    ), '&lsquo;', chr(8216)     -- Left single quotation mark '
    ), '&ldquo;', chr(8220)     -- Left double quotation mark "
    ), '&rdquo;', chr(8221)     -- Right double quotation mark "
    ), '&ndash;', chr(8211)     -- En dash –
    ), '&mdash;', chr(8212)     -- Em dash —
    ), '&amp;', '&'             -- Ampersand &
    ), '&quot;', '"'            -- Quotation mark "
    ), '&lt;', '<'              -- Less than <
    ), '&gt;', '>'              -- Greater than >
    ), '&#8217;', chr(8217)     -- Numeric: Right single quotation mark
    ), '&#8220;', chr(8220)     -- Numeric: Left double quotation mark
    ), '&#8221;', chr(8221));   -- Numeric: Right double quotation mark
END;
$$;

-- Create a temporary table to track migration progress
CREATE TEMPORARY TABLE html_entity_migration_progress (
    step text,
    affected_count integer,
    processed_count integer,
    start_time timestamp,
    end_time timestamp,
    status text
);

-- Start migration tracking
INSERT INTO html_entity_migration_progress (step, start_time, status)
VALUES ('migration_start', NOW(), 'started');

-- Track articles with HTML entities in titles
INSERT INTO html_entity_migration_progress (step, affected_count, start_time, status)
SELECT 
    'title_analysis', 
    COUNT(*),
    NOW(),
    'analyzing'
FROM articles 
WHERE title ~ '&[a-zA-Z]+;|&#[0-9]+;';

-- Track articles with HTML entities in content  
INSERT INTO html_entity_migration_progress (step, affected_count, start_time, status)
SELECT 
    'content_analysis', 
    COUNT(*),
    NOW(),
    'analyzing'
FROM articles 
WHERE content ~ '&[a-zA-Z]+;|&#[0-9]+;';

-- Update article titles with HTML entities (batch processing)
-- Process in batches of 50 to avoid long-running transactions
DO $$
DECLARE
    batch_size INTEGER := 50;
    total_updated INTEGER := 0;
    batch_count INTEGER;
    article_ids UUID[];
BEGIN
    -- Get all article IDs with HTML entities in titles
    SELECT array_agg(id) INTO article_ids 
    FROM articles 
    WHERE title ~ '&[a-zA-Z]+;|&#[0-9]+;'
    ORDER BY created_at;

    IF array_length(article_ids, 1) IS NOT NULL THEN
        -- Process in batches
        FOR i IN 1..array_length(article_ids, 1) BY batch_size LOOP
            -- Update current batch
            UPDATE articles 
            SET title = decode_html_entities(title),
                updated_at = NOW()
            WHERE id = ANY(article_ids[i:least(i + batch_size - 1, array_length(article_ids, 1))]);
            
            GET DIAGNOSTICS batch_count = ROW_COUNT;
            total_updated := total_updated + batch_count;
            
            -- Add small delay between batches
            PERFORM pg_sleep(0.1);
        END LOOP;
    END IF;

    -- Update progress tracking
    UPDATE html_entity_migration_progress 
    SET processed_count = total_updated, 
        end_time = NOW(), 
        status = 'completed'
    WHERE step = 'title_analysis';
    
    RAISE NOTICE 'Updated % article titles with HTML entity decoding', total_updated;
END $$;

-- Update article content with HTML entities (batch processing)
DO $$
DECLARE
    batch_size INTEGER := 50;
    total_updated INTEGER := 0;
    batch_count INTEGER;
    article_ids UUID[];
BEGIN
    -- Get all article IDs with HTML entities in content
    SELECT array_agg(id) INTO article_ids 
    FROM articles 
    WHERE content ~ '&[a-zA-Z]+;|&#[0-9]+;'
    ORDER BY created_at;

    IF array_length(article_ids, 1) IS NOT NULL THEN
        -- Process in batches
        FOR i IN 1..array_length(article_ids, 1) BY batch_size LOOP
            -- Update current batch
            UPDATE articles 
            SET content = decode_html_entities(content),
                updated_at = NOW()
            WHERE id = ANY(article_ids[i:least(i + batch_size - 1, array_length(article_ids, 1))]);
            
            GET DIAGNOSTICS batch_count = ROW_COUNT;
            total_updated := total_updated + batch_count;
            
            -- Add small delay between batches  
            PERFORM pg_sleep(0.1);
        END LOOP;
    END IF;

    -- Update progress tracking
    UPDATE html_entity_migration_progress 
    SET processed_count = total_updated, 
        end_time = NOW(), 
        status = 'completed'
    WHERE step = 'content_analysis';
    
    RAISE NOTICE 'Updated % article contents with HTML entity decoding', total_updated;
END $$;

-- Verification: Check for remaining HTML entities
INSERT INTO html_entity_migration_progress (step, affected_count, start_time, status)
SELECT 
    'verification_titles', 
    COUNT(*),
    NOW(),
    CASE WHEN COUNT(*) = 0 THEN 'success' ELSE 'remaining_entities' END
FROM articles 
WHERE title ~ '&[a-zA-Z]+;|&#[0-9]+;';

INSERT INTO html_entity_migration_progress (step, affected_count, start_time, status)
SELECT 
    'verification_content', 
    COUNT(*),
    NOW(),
    CASE WHEN COUNT(*) = 0 THEN 'success' ELSE 'remaining_entities' END
FROM articles 
WHERE content ~ '&[a-zA-Z]+;|&#[0-9]+;';

-- Store migration completion status in sync_metadata
INSERT INTO sync_metadata (key, value, updated_at)
VALUES (
    'html_entity_migration_completed', 
    json_build_object(
        'completed_at', NOW(),
        'migration_version', '20250807_fix_html_entities_in_articles',
        'status', 'completed'
    )::text,
    NOW()
) ON CONFLICT (key) DO UPDATE SET 
    value = EXCLUDED.value,
    updated_at = EXCLUDED.updated_at;

-- Final completion marker
INSERT INTO html_entity_migration_progress (step, start_time, status)
VALUES ('migration_complete', NOW(), 'completed');

-- Display final migration summary
SELECT 
    step,
    affected_count,
    processed_count,
    status,
    EXTRACT(EPOCH FROM (COALESCE(end_time, NOW()) - start_time)) as duration_seconds
FROM html_entity_migration_progress
ORDER BY start_time;

-- Clean up the temporary function (it was only needed for migration)
DROP FUNCTION decode_html_entities(text);

-- Add comment to articles table documenting the migration
COMMENT ON COLUMN articles.title IS 'Article title with HTML entities decoded (RR-154 migration applied 2025-08-07)';
COMMENT ON COLUMN articles.content IS 'Article content with HTML entities decoded (RR-154 migration applied 2025-08-07)';

-- Migration complete notification
\echo 'RR-154: HTML entity decoding migration completed successfully'