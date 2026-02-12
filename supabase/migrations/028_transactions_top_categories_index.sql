-- finnon — Index to speed up get_top_categories RPC

CREATE INDEX IF NOT EXISTS idx_tx_account_type_category_notnull
  ON public.transactions (account_id, type, category_id)
  WHERE category_id IS NOT NULL;
