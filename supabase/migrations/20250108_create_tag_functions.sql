-- Function to update tag article counts
CREATE OR REPLACE FUNCTION update_tag_counts()
RETURNS void AS $$
BEGIN
  UPDATE tags t
  SET article_count = (
    SELECT COUNT(DISTINCT at.article_id)
    FROM article_tags at
    WHERE at.tag_id = t.id
  );
END;
$$ LANGUAGE plpgsql;

-- Function to clean up orphaned tags (tags with no articles)
CREATE OR REPLACE FUNCTION cleanup_orphaned_tags()
RETURNS void AS $$
BEGIN
  DELETE FROM tags
  WHERE id NOT IN (
    SELECT DISTINCT tag_id FROM article_tags
  );
END;
$$ LANGUAGE plpgsql;