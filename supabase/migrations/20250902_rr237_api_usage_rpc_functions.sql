-- RR-237: Create RPC functions for atomic API usage tracking
-- Replaces direct table updates to eliminate race conditions

-- Function 1: Atomic increment for API usage counting
CREATE OR REPLACE FUNCTION increment_api_usage(
  p_service VARCHAR,
  p_date DATE DEFAULT CURRENT_DATE,
  p_increment INTEGER DEFAULT 1
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- Use UPSERT for atomic operation
  INSERT INTO api_usage (
    service, 
    date, 
    count,
    zone1_usage,
    zone2_usage,
    zone1_limit,
    zone2_limit,
    reset_after,
    created_at
  )
  VALUES (
    p_service, 
    p_date, 
    p_increment,
    0,  -- default zone1_usage
    0,  -- default zone2_usage
    5000,  -- default zone1_limit
    100,   -- default zone2_limit
    0,     -- default reset_after
    NOW()
  )
  ON CONFLICT (service, date) 
  DO UPDATE SET 
    count = api_usage.count + p_increment,
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  -- Return the complete record as JSON
  RETURN row_to_json(v_result);
END;
$$;

-- Function 2: Update zone tracking with partial updates
CREATE OR REPLACE FUNCTION update_api_usage_zones(
  p_service VARCHAR,
  p_date DATE DEFAULT CURRENT_DATE,
  p_zone1_usage INTEGER DEFAULT NULL,
  p_zone2_usage INTEGER DEFAULT NULL,
  p_zone1_limit INTEGER DEFAULT NULL,
  p_zone2_limit INTEGER DEFAULT NULL,
  p_reset_after INTEGER DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_result RECORD;
BEGIN
  -- UPSERT with conditional updates based on provided parameters
  INSERT INTO api_usage (
    service, 
    date,
    count,
    zone1_usage,
    zone2_usage,
    zone1_limit,
    zone2_limit,
    reset_after,
    created_at
  )
  VALUES (
    p_service, 
    p_date,
    0,  -- default count
    COALESCE(p_zone1_usage, 0),
    COALESCE(p_zone2_usage, 0),
    COALESCE(p_zone1_limit, 5000),
    COALESCE(p_zone2_limit, 100),
    COALESCE(p_reset_after, 0),
    NOW()
  )
  ON CONFLICT (service, date) 
  DO UPDATE SET 
    zone1_usage = COALESCE(p_zone1_usage, api_usage.zone1_usage),
    zone2_usage = COALESCE(p_zone2_usage, api_usage.zone2_usage),
    zone1_limit = COALESCE(p_zone1_limit, api_usage.zone1_limit),
    zone2_limit = COALESCE(p_zone2_limit, api_usage.zone2_limit),
    reset_after = COALESCE(p_reset_after, api_usage.reset_after),
    updated_at = NOW()
  RETURNING * INTO v_result;
  
  -- Return the complete record as JSON
  RETURN row_to_json(v_result);
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION increment_api_usage IS 'RR-237: Atomically increment API usage count for a service/date combination';
COMMENT ON FUNCTION update_api_usage_zones IS 'RR-237: Update zone tracking information with partial updates supported';