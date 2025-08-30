-- Test to see if unread articles have tag associations
SELECT 
  'Total unread articles' as description,
  COUNT(*) as count
FROM articles a
WHERE a.user_id = (SELECT id FROM users WHERE inoreader_id = 'shayon' LIMIT 1)
  AND a.is_read = false

UNION ALL

SELECT 
  'Unread articles WITH tags' as description,
  COUNT(DISTINCT a.id) as count
FROM articles a
INNER JOIN article_tags at ON a.id = at.article_id
WHERE a.user_id = (SELECT id FROM users WHERE inoreader_id = 'shayon' LIMIT 1)
  AND a.is_read = false

UNION ALL

SELECT 
  'Total tags' as description,
  COUNT(*) as count
FROM tags t
WHERE t.user_id = (SELECT id FROM users WHERE inoreader_id = 'shayon' LIMIT 1)

UNION ALL

SELECT 
  'Tags with unread articles' as description,
  COUNT(DISTINCT t.id) as count
FROM tags t
INNER JOIN article_tags at ON t.id = at.tag_id
INNER JOIN articles a ON at.article_id = a.id
WHERE t.user_id = (SELECT id FROM users WHERE inoreader_id = 'shayon' LIMIT 1)
  AND a.is_read = false;