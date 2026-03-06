-- finnon — link expense transactions to projects as extra contributions

ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS project_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_project_id_fkey'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_project_id_fkey
      FOREIGN KEY (project_id)
      REFERENCES public.projects(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'transactions_project_expense_check'
      AND conrelid = 'public.transactions'::regclass
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_project_expense_check
      CHECK (project_id IS NULL OR type = 'expense');
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_project_id
  ON public.transactions USING btree (project_id);

COMMENT ON COLUMN public.transactions.project_id IS
  'Optional linked project for expense transactions. Null means the movement is not assigned to any project.';
