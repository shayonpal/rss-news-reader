-- Test query to see if we get tags with unread articles
SELECT 
  at.tag_id,
  t.name as tag_name,
  COUNT(DISTINCT a.id) as unread_count
FROM articles a
INNER JOIN article_tags at ON a.id = at.article_id
INNER JOIN tags t ON at.tag_id = t.id
WHERE a.user_id = (SELECT id FROM users WHERE inoreader_id = 'shayon' LIMIT 1)
  AND a.is_read = false
GROUP BY at.tag_id, t.name
ORDER BY t.name;