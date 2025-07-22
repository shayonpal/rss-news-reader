-- Fix the add_to_sync_queue function syntax error
CREATE OR REPLACE FUNCTION add_to_sync_queue(
  p_article_id UUID,
  p_inoreader_id TEXT,
  p_action_type TEXT
)
RETURNS UUID AS $$
DECLARE
  v_queue_id UUID;
BEGIN
  -- Check if there's already a pending action for this article
  -- For read/unread actions, remove any existing read/unread entries
  -- For star/unstar actions, remove any existing star/unstar entries
  IF p_action_type IN ('read', 'unread') THEN
    DELETE FROM sync_queue 
    WHERE article_id = p_article_id 
      AND action_type IN ('read', 'unread');
  ELSIF p_action_type IN ('star', 'unstar') THEN
    DELETE FROM sync_queue 
    WHERE article_id = p_article_id 
      AND action_type IN ('star', 'unstar');
  END IF;
  
  -- Insert new queue entry
  INSERT INTO sync_queue (article_id, inoreader_id, action_type, action_timestamp)
  VALUES (p_article_id, p_inoreader_id, p_action_type, NOW())
  RETURNING id INTO v_queue_id;
  
  RETURN v_queue_id;
END;
$$ LANGUAGE plpgsql;