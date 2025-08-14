-- RR-175: Remove unused content_length column from articles table
-- This column has only 4.8% utilization and is never queried, only set
-- Removing it improves performance by reducing table size and write overhead

ALTER TABLE articles 
DROP COLUMN IF EXISTS content_length;