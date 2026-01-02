-- =========================================================
-- 8. RECURRING ITEMS + TRANSACTIONS LINK
-- =========================================================

CREATE TABLE IF NOT EXISTS recurring_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  currency char(3) NOT NULL,
  category_id uuid REFERENCES categories(id) ON DELETE SET NULL,
  merchant text CHECK (merchant IS NULL OR char_length(merchant) <= 255),
  notes text,
  start_date date NOT NULL,
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'yearly')),
  interval int NOT NULL DEFAULT 1 CHECK (interval > 0),
  day_of_month int CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  end_date date,
  is_paused boolean NOT NULL DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE recurring_items IS 'Recurring income/expense series';

CREATE INDEX IF NOT EXISTS idx_recurring_items_account_id ON recurring_items(account_id);
CREATE INDEX IF NOT EXISTS idx_recurring_items_start_date ON recurring_items(start_date);

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS recurring_item_id uuid REFERENCES recurring_items(id),
  ADD COLUMN IF NOT EXISTS recurring_occurrence_date date;

ALTER TABLE transactions
  ADD CONSTRAINT transactions_recurring_occurrence_unique
  UNIQUE (account_id, recurring_item_id, recurring_occurrence_date);

CREATE INDEX IF NOT EXISTS idx_transactions_recurring_item_id
  ON transactions(recurring_item_id);

-- =========================================================
-- RLS: RECURRING ITEMS
-- =========================================================

ALTER TABLE recurring_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE recurring_items FORCE ROW LEVEL SECURITY;

-- Users can view recurring items of accounts where they are members
CREATE POLICY recurring_items_select_policy ON recurring_items
  FOR SELECT
  USING (is_account_member(account_id));

-- Contributors and admins can create recurring items
CREATE POLICY recurring_items_insert_policy ON recurring_items
  FOR INSERT
  WITH CHECK (
    is_contributor_or_above(account_id)
    AND created_by = (select auth.uid())
  );

-- Contributors and admins can update recurring items
CREATE POLICY recurring_items_update_policy ON recurring_items
  FOR UPDATE
  USING (is_contributor_or_above(account_id))
  WITH CHECK (is_contributor_or_above(account_id));

-- Contributors and admins can delete recurring items
CREATE POLICY recurring_items_delete_policy ON recurring_items
  FOR DELETE
  USING (is_contributor_or_above(account_id));
