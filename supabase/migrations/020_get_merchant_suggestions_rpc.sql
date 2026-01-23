-- finnon — Merchant suggestions RPC function
-- Returns top merchants by frequency and recency for autocomplete in Add Transaction form

-- Index for efficient merchant lookups (partial - only non-null merchants)
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_suggestions
  ON transactions (account_id, date DESC, merchant)
  WHERE merchant IS NOT NULL AND TRIM(merchant) != '';

-- Function to get merchant suggestions with frequency and recency scoring
CREATE OR REPLACE FUNCTION get_merchant_suggestions(
  p_account_id uuid,
  p_limit int DEFAULT 10,
  p_days_window int DEFAULT 90
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER  -- Respects caller's RLS permissions
STABLE
AS $$
DECLARE
  v_result jsonb;
  v_cutoff_date date;
BEGIN
  -- Early exit if user is not a member
  IF NOT is_account_member(p_account_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Calculate cutoff date
  v_cutoff_date := CURRENT_DATE - p_days_window;

  -- Aggregate merchants with frequency and recency scoring
  -- Score = frequency_count + (1 / days_since_last_use)
  -- This balances frequent usage with recent activity
  WITH recent_transactions AS (
    SELECT
      -- Normalize: trim, collapse spaces, lowercase
      LOWER(TRIM(REGEXP_REPLACE(merchant, '\s+', ' ', 'g'))) AS normalized_merchant,
      merchant AS original_merchant,
      date
    FROM transactions
    WHERE account_id = p_account_id
      AND merchant IS NOT NULL
      AND TRIM(merchant) != ''
      AND date >= v_cutoff_date
    ORDER BY date DESC
    LIMIT 200  -- Cap to avoid scanning too many rows
  ),
  merchant_stats AS (
    SELECT
      normalized_merchant,
      -- Keep the most recent original form for display
      (ARRAY_AGG(original_merchant ORDER BY date DESC))[1] AS display_merchant,
      COUNT(*) AS frequency,
      MAX(date) AS last_used,
      -- Score: frequency weighted + recency bonus (more recent = higher bonus)
      COUNT(*)::float + (1.0 / GREATEST(1, CURRENT_DATE - MAX(date))) AS score
    FROM recent_transactions
    GROUP BY normalized_merchant
  )
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'merchant', display_merchant,
        'normalized', normalized_merchant,
        'frequency', frequency,
        'lastUsed', last_used
      )
      ORDER BY score DESC
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM (
    SELECT * FROM merchant_stats
    ORDER BY score DESC
    LIMIT p_limit
  ) limited;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_merchant_suggestions IS
  'Returns top N merchants by frequency and recency for autocomplete suggestions.
   Uses 90-day window (default) with max 200 transactions scan.
   Normalizes merchants (trim, collapse spaces, lowercase) to deduplicate variations.
   Uses SECURITY INVOKER to respect RLS.';
