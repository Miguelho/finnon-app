-- finnon — Top categories RPC function
-- Returns top 3 most used categories for the Add Transaction form (v5 feature)

CREATE OR REPLACE FUNCTION get_top_categories(
  p_account_id uuid,
  p_tx_type text,
  p_limit int DEFAULT 3
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER  -- Respects caller's RLS permissions
STABLE
AS $$
DECLARE
  v_result jsonb;
  v_top_ids uuid[];
  v_top_count int;
BEGIN
  -- Validate tx_type
  IF p_tx_type NOT IN ('income', 'expense') THEN
    RAISE EXCEPTION 'Invalid transaction type: %', p_tx_type;
  END IF;

  -- Early exit if user is not a member
  IF NOT is_account_member(p_account_id) THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Step 1: Get top category IDs by transaction count
  SELECT ARRAY_AGG(sub.category_id ORDER BY sub.tx_count DESC, sub.category_id)
  INTO v_top_ids
  FROM (
    SELECT
      t.category_id,
      COUNT(*) AS tx_count
    FROM transactions t
    WHERE t.account_id = p_account_id
      AND t.type = p_tx_type
      AND t.category_id IS NOT NULL
    GROUP BY t.category_id
    ORDER BY tx_count DESC, t.category_id
    LIMIT p_limit
  ) sub;

  v_top_ids := COALESCE(v_top_ids, ARRAY[]::uuid[]);
  v_top_count := array_length(v_top_ids, 1);
  v_top_count := COALESCE(v_top_count, 0);

  -- Step 2: If we have fewer than p_limit, fill with recent categories of same type
  IF v_top_count < p_limit THEN
    SELECT ARRAY_CAT(v_top_ids, ARRAY_AGG(c.id ORDER BY c.created_at DESC))
    INTO v_top_ids
    FROM (
      SELECT c.id, c.created_at
      FROM categories c
      WHERE c.account_id = p_account_id
        AND c.type = p_tx_type
        AND (v_top_count = 0 OR c.id != ALL(v_top_ids))
      ORDER BY c.created_at DESC
      LIMIT (p_limit - v_top_count)
    ) c;
  END IF;

  v_top_ids := COALESCE(v_top_ids, ARRAY[]::uuid[]);

  -- Step 3: Fetch category details preserving order
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'icon_id', c.icon_id,
        'type', c.type
      )
      ORDER BY array_position(v_top_ids, c.id)
    ),
    '[]'::jsonb
  )
  INTO v_result
  FROM categories c
  WHERE c.id = ANY(v_top_ids);

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_top_categories IS
  'Returns top N most used categories by transaction count for a given account and transaction type. Falls back to recent categories if insufficient history. Uses SECURITY INVOKER to respect RLS.';
