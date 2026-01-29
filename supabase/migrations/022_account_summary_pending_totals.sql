-- finnon — Account summary RPC function (pending totals)
-- Extends get_account_summary to include pending totals (future-dated transactions)

CREATE OR REPLACE FUNCTION get_account_summary(p_account_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF NOT is_account_member(p_account_id) THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'account', (
      SELECT jsonb_build_object(
        'id', a.id,
        'name', a.name,
        'base_currency', a.base_currency
      )
      FROM accounts a
      WHERE a.id = p_account_id
    ),
    'participants', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'user_id', am.user_id,
          'role', am.role,
          'email', p.email,
          'display_name', p.display_name,
          'avatar_path', p.avatar_path,
          'avatar_fallback_text', p.avatar_fallback_text,
          'avatar_fallback_bg_token', p.avatar_fallback_bg_token
        )
        ORDER BY
          CASE am.role
            WHEN 'admin' THEN 1
            WHEN 'contributor' THEN 2
            ELSE 3
          END,
          p.display_name NULLS LAST,
          p.email
      ), '[]'::jsonb)
      FROM account_members am
      LEFT JOIN profiles p ON p.user_id = am.user_id
      WHERE am.account_id = p_account_id
    ),
    'totals', (
      SELECT jsonb_build_object(
        'income_total', COALESCE(SUM(
          CASE WHEN t.type = 'income' THEN t.amount_base_minor ELSE 0 END
        ), 0),
        'expense_total', COALESCE(SUM(
          CASE WHEN t.type = 'expense' THEN t.amount_base_minor ELSE 0 END
        ), 0),
        'balance_total', COALESCE(SUM(
          CASE WHEN t.type = 'income' THEN t.amount_base_minor ELSE -t.amount_base_minor END
        ), 0),
        'income_pending_total', COALESCE(SUM(
          CASE
            WHEN t.type = 'income' AND t.date > current_date THEN t.amount_base_minor
            ELSE 0
          END
        ), 0),
        'expense_pending_total', COALESCE(SUM(
          CASE
            WHEN t.type = 'expense' AND t.date > current_date THEN t.amount_base_minor
            ELSE 0
          END
        ), 0),
        'balance_pending_total', COALESCE(SUM(
          CASE
            WHEN t.date > current_date AND t.type = 'income' THEN t.amount_base_minor
            WHEN t.date > current_date AND t.type = 'expense' THEN -t.amount_base_minor
            ELSE 0
          END
        ), 0)
      )
      FROM transactions t
      WHERE t.account_id = p_account_id
    ),
    'category_breakdown', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'category_id', sub.category_id,
          'name', sub.name,
          'icon_id', sub.icon_id,
          'type', sub.type,
          'total', sub.total
        )
        ORDER BY sub.total DESC
      ), '[]'::jsonb)
      FROM (
        SELECT
          c.id AS category_id,
          c.name,
          c.icon_id,
          c.type,
          COALESCE(SUM(t.amount_base_minor), 0) AS total
        FROM categories c
        LEFT JOIN transactions t ON t.category_id = c.id AND t.account_id = p_account_id
        WHERE c.account_id = p_account_id
        GROUP BY c.id, c.name, c.icon_id, c.type
        HAVING COALESCE(SUM(t.amount_base_minor), 0) > 0
      ) sub
    ),
    'categories_count', (
      SELECT COUNT(*)::int
      FROM categories
      WHERE account_id = p_account_id
    )
  ) INTO v_result;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION get_account_summary IS
  'Returns account summary including participants, totals (with pending), and category breakdown. Uses SECURITY INVOKER to respect RLS.';
