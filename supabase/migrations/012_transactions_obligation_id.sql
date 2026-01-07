-- =========================================================
-- 12. TRANSACTIONS: LINK OBLIGATIONS
-- =========================================================

ALTER TABLE transactions
  ADD COLUMN IF NOT EXISTS obligation_id uuid REFERENCES obligations(id) ON DELETE SET NULL;

COMMENT ON COLUMN transactions.obligation_id IS 'Optional link to an obligation that generated this transaction';

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_obligation_id
  ON transactions(obligation_id);
