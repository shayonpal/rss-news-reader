-- RR-266: Remove redundant index on ai_models.model_id
-- The UNIQUE constraint already creates an index automatically
-- This removes the manually created duplicate index to reduce storage overhead

DROP INDEX IF EXISTS idx_ai_models_model_id;

-- Note: The UNIQUE constraint index (ai_models_model_id_key) remains and provides
-- all necessary performance benefits for queries on the model_id column