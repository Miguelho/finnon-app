-- Migration: Goal History and Gamification
-- Adds fields to track completed goals and enables historical navigation

-- 1. Add columns to financial_goals for tracking completion
ALTER TABLE financial_goals ADD COLUMN IF NOT EXISTS final_saved_minor bigint;
ALTER TABLE financial_goals ADD COLUMN IF NOT EXISTS completed boolean;
ALTER TABLE financial_goals ADD COLUMN IF NOT EXISTS completed_at date;
ALTER TABLE financial_goals ADD COLUMN IF NOT EXISTS closed_at timestamptz;

COMMENT ON COLUMN financial_goals.final_saved_minor IS 'Final savings amount when month was closed';
COMMENT ON COLUMN financial_goals.completed IS 'true if goal was achieved, false if not, null if month not closed';
COMMENT ON COLUMN financial_goals.completed_at IS 'Date when goal was achieved (if completed=true)';
COMMENT ON COLUMN financial_goals.closed_at IS 'Timestamp when the month was closed';

-- 2. Function to close previous month goals (to be called by cron on day 1)
CREATE OR REPLACE FUNCTION close_previous_month_goals()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_previous_month text;
  v_month_start date;
  v_month_end date;
BEGIN
  -- Calculate previous month
  v_previous_month := to_char(now() - interval '1 month', 'YYYY-MM');
  v_month_start := date_trunc('month', now() - interval '1 month')::date;
  v_month_end := (date_trunc('month', now()) - interval '1 day')::date;

  -- Update all goals for previous month that haven't been closed
  UPDATE financial_goals g
  SET
    final_saved_minor = sub.saved_minor,
    completed = sub.saved_minor >= g.target_amount_base_minor,
    completed_at = CASE
      WHEN sub.saved_minor >= g.target_amount_base_minor THEN sub.completion_date
      ELSE NULL
    END,
    closed_at = now()
  FROM (
    SELECT
      fg.id as goal_id,
      COALESCE(SUM(
        CASE WHEN t.type = 'income' THEN t.amount_base_minor
             ELSE -t.amount_base_minor
        END
      ), 0) as saved_minor,
      -- Find the date when cumulative savings first reached target
      (
        SELECT MIN(day_date)
        FROM (
          SELECT
            t2.date as day_date,
            SUM(SUM(
              CASE WHEN t2.type = 'income' THEN t2.amount_base_minor
                   ELSE -t2.amount_base_minor
              END
            )) OVER (ORDER BY t2.date) as cumulative
          FROM transactions t2
          WHERE t2.account_id = fg.account_id
            AND t2.date >= v_month_start
            AND t2.date <= v_month_end
          GROUP BY t2.date
        ) daily_totals
        WHERE cumulative >= fg.target_amount_base_minor
      ) as completion_date
    FROM financial_goals fg
    LEFT JOIN transactions t ON t.account_id = fg.account_id
      AND t.date >= v_month_start
      AND t.date <= v_month_end
    WHERE fg.month = v_previous_month
      AND fg.closed_at IS NULL
    GROUP BY fg.id
  ) sub
  WHERE g.id = sub.goal_id;
END;
$$;

-- 3. RPC to get goal history for an account
CREATE OR REPLACE FUNCTION get_goal_history(
  p_account_id uuid,
  p_limit int DEFAULT 12
)
RETURNS TABLE (
  month text,
  target_minor bigint,
  final_saved_minor bigint,
  completed boolean,
  completed_at date,
  is_current boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    g.month,
    g.target_amount_base_minor::bigint,
    g.final_saved_minor,
    g.completed,
    g.completed_at,
    g.closed_at IS NULL as is_current
  FROM financial_goals g
  WHERE g.account_id = p_account_id
  ORDER BY g.month DESC
  LIMIT p_limit;
$$;

-- 4. RPC to get gamification stats for an account
CREATE OR REPLACE FUNCTION get_goal_gamification(
  p_account_id uuid
)
RETURNS TABLE (
  current_streak int,
  total_completed int,
  total_goals int,
  avg_saved_minor bigint,
  avg_completion_day int
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_streak int := 0;
  v_month text;
  v_completed boolean;
BEGIN
  -- Calculate current streak (consecutive completed months, most recent first)
  FOR v_month, v_completed IN
    SELECT g.month, g.completed
    FROM financial_goals g
    WHERE g.account_id = p_account_id
      AND g.closed_at IS NOT NULL
    ORDER BY g.month DESC
  LOOP
    IF v_completed THEN
      v_streak := v_streak + 1;
    ELSE
      EXIT; -- Streak broken
    END IF;
  END LOOP;

  RETURN QUERY
  SELECT
    v_streak,
    COUNT(*) FILTER (WHERE g.completed = true)::int,
    COUNT(*) FILTER (WHERE g.closed_at IS NOT NULL)::int,
    COALESCE(AVG(g.final_saved_minor) FILTER (WHERE g.closed_at IS NOT NULL), 0)::bigint,
    COALESCE(AVG(EXTRACT(DAY FROM g.completed_at)) FILTER (WHERE g.completed = true), NULL)::int
  FROM financial_goals g
  WHERE g.account_id = p_account_id;
END;
$$;

-- 5. RPC to get goal data for a specific month (for history navigation)
CREATE OR REPLACE FUNCTION get_goal_for_month(
  p_account_id uuid,
  p_month text
)
RETURNS TABLE (
  id uuid,
  month text,
  target_minor bigint,
  final_saved_minor bigint,
  completed boolean,
  completed_at date,
  is_closed boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    g.id,
    g.month,
    g.target_amount_base_minor::bigint,
    g.final_saved_minor,
    g.completed,
    g.completed_at,
    g.closed_at IS NOT NULL
  FROM financial_goals g
  WHERE g.account_id = p_account_id
    AND g.month = p_month
  LIMIT 1;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION close_previous_month_goals() TO authenticated;
GRANT EXECUTE ON FUNCTION get_goal_history(uuid, int) TO authenticated;
GRANT EXECUTE ON FUNCTION get_goal_gamification(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_goal_for_month(uuid, text) TO authenticated;
