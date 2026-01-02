-- =========================================================
-- 9. OBLIGATIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) <= 255),
  amount_minor bigint NOT NULL CHECK (amount_minor >= 0),
  amount_base_minor bigint,
  currency char(3) NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid')),
  paid_at date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE obligations IS 'Single due-date obligations';

CREATE INDEX IF NOT EXISTS idx_obligations_account_id ON obligations(account_id);
CREATE INDEX IF NOT EXISTS idx_obligations_due_date ON obligations(due_date);

-- =========================================================
-- RLS: OBLIGATIONS
-- =========================================================

ALTER TABLE obligations ENABLE ROW LEVEL SECURITY;
ALTER TABLE obligations FORCE ROW LEVEL SECURITY;

-- Users can view obligations of accounts where they are members
CREATE POLICY obligations_select_policy ON obligations
  FOR SELECT
  USING (is_account_member(account_id));

-- Contributors and admins can create obligations
CREATE POLICY obligations_insert_policy ON obligations
  FOR INSERT
  WITH CHECK (
    is_contributor_or_above(account_id)
    AND created_by = (select auth.uid())
  );

-- Contributors and admins can update obligations
CREATE POLICY obligations_update_policy ON obligations
  FOR UPDATE
  USING (is_contributor_or_above(account_id))
  WITH CHECK (is_contributor_or_above(account_id));

-- Contributors and admins can delete obligations
CREATE POLICY obligations_delete_policy ON obligations
  FOR DELETE
  USING (is_contributor_or_above(account_id));
