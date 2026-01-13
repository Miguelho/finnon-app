-- finnon v1 — Financial goals
-- Stores monthly savings goals per account

CREATE TABLE IF NOT EXISTS financial_goals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  month text NOT NULL,
  type text NOT NULL CHECK (type IN ('save')),
  target_amount_base_minor bigint NOT NULL CHECK (target_amount_base_minor > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, month, type)
);

COMMENT ON TABLE financial_goals IS 'Monthly savings goals per account';
COMMENT ON COLUMN financial_goals.month IS 'Month key in YYYY-MM format';
COMMENT ON COLUMN financial_goals.target_amount_base_minor IS 'Target amount in account base currency minor units';

CREATE INDEX IF NOT EXISTS idx_financial_goals_account_month
  ON financial_goals(account_id, month);

ALTER TABLE financial_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_goals FORCE ROW LEVEL SECURITY;

CREATE POLICY financial_goals_select_policy ON financial_goals
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY financial_goals_insert_policy ON financial_goals
  FOR INSERT
  WITH CHECK (
    is_account_member(account_id)
    AND created_by = (select auth.uid())
  );

CREATE POLICY financial_goals_update_policy ON financial_goals
  FOR UPDATE
  USING (is_account_member(account_id))
  WITH CHECK (is_account_member(account_id));

CREATE POLICY financial_goals_delete_policy ON financial_goals
  FOR DELETE
  USING (is_account_member(account_id));
