-- =========================================================
-- 29. CONTRIBUTION BALANCE (paid_by + split metadata)
-- =========================================================

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_by uuid;

UPDATE public.transactions
SET paid_by = created_by
WHERE paid_by IS NULL;

ALTER TABLE public.transactions
  ALTER COLUMN paid_by SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_paid_by_fkey'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_paid_by_fkey
      FOREIGN KEY (paid_by) REFERENCES auth.users (id);
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_transactions_paid_by
  ON public.transactions USING btree (paid_by);

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS split_type text NOT NULL DEFAULT 'equal';

UPDATE public.transactions
SET split_type = 'equal'
WHERE split_type IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_split_type_check'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_split_type_check
      CHECK (
        split_type = ANY (ARRAY['equal'::text, 'personal'::text, 'custom'::text])
      );
  END IF;
END
$$;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS split_details jsonb NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_split_details_check'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_split_details_check
      CHECK ((split_type <> 'custom') OR (split_details IS NOT NULL));
  END IF;
END
$$;

COMMENT ON COLUMN public.transactions.paid_by IS
  'User that actually paid the transaction amount.';

COMMENT ON COLUMN public.transactions.split_type IS
  'How expense responsibility is split: equal | personal | custom.';

COMMENT ON COLUMN public.transactions.split_details IS
  'Custom split payload: [{user_id, share_minor}] when split_type=custom.';
