-- =========================================================
-- 33. Hucha project model (goal deprecation phase 1)
-- =========================================================

-- 1) projects: add hucha flag and relax target constraints for hucha rows.
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS is_hucha boolean NOT NULL DEFAULT false;

ALTER TABLE public.projects
  ALTER COLUMN target_amount_base_minor DROP NOT NULL;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_target_amount_base_minor_check;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_target_amount_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_target_amount_check
  CHECK (
    (is_hucha = true AND target_amount_base_minor IS NULL)
    OR (is_hucha = false AND target_amount_base_minor > 0)
  );

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_hucha_priority_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_hucha_priority_check
  CHECK (
    (is_hucha = false)
    OR (priority = 2147483647)
  );

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_hucha_status_check;

ALTER TABLE public.projects
  ADD CONSTRAINT projects_hucha_status_check
  CHECK (
    (is_hucha = false)
    OR (status <> ALL (ARRAY['completed'::text, 'cancelled'::text]))
  );

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_hucha_per_account
  ON public.projects(account_id)
  WHERE is_hucha = true;

-- 2) Enforce immutable hucha semantics.
CREATE OR REPLACE FUNCTION public.enforce_hucha_project_rules()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_hucha = true THEN
    NEW.name := COALESCE(NULLIF(NEW.name, ''), 'Hucha');
    NEW.emoji := COALESCE(NULLIF(NEW.emoji, ''), '🐷');
    NEW.target_amount_base_minor := NULL;
    NEW.monthly_commitment_base_minor := NULL;
    NEW.priority := 2147483647;

    IF NEW.status = 'completed' OR NEW.status = 'cancelled' THEN
      RAISE EXCEPTION 'Hucha project cannot be completed or cancelled';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_enforce_hucha_project_rules ON public.projects;
CREATE TRIGGER trg_enforce_hucha_project_rules
  BEFORE INSERT OR UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_hucha_project_rules();

CREATE OR REPLACE FUNCTION public.prevent_hucha_delete()
RETURNS trigger AS $$
BEGIN
  IF OLD.is_hucha = true THEN
    RAISE EXCEPTION 'Cannot delete hucha project';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_hucha_delete ON public.projects;
CREATE TRIGGER trg_prevent_hucha_delete
  BEFORE DELETE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_hucha_delete();

-- 3) Auto-create Hucha after account creation.
CREATE OR REPLACE FUNCTION public.create_hucha_for_account()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.projects (
    account_id,
    name,
    emoji,
    is_hucha,
    target_amount_base_minor,
    monthly_commitment_base_minor,
    priority,
    status,
    created_by
  )
  VALUES (
    NEW.id,
    'Hucha',
    '🐷',
    true,
    NULL,
    NULL,
    2147483647,
    'active',
    NEW.owner_user_id
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_create_hucha_on_account ON public.accounts;
CREATE TRIGGER trg_create_hucha_on_account
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_hucha_for_account();

-- 4) Backfill hucha for existing accounts.
INSERT INTO public.projects (
  account_id,
  name,
  emoji,
  is_hucha,
  target_amount_base_minor,
  monthly_commitment_base_minor,
  priority,
  status,
  created_by
)
SELECT
  a.id,
  'Hucha',
  '🐷',
  true,
  NULL,
  NULL,
  2147483647,
  'active',
  a.owner_user_id
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1
  FROM public.projects p
  WHERE p.account_id = a.id
    AND p.is_hucha = true
);

-- 5) Historical migration: completed financial_goals -> hucha contributions.
INSERT INTO public.project_contributions (
  project_id,
  account_id,
  user_id,
  period,
  committed_amount_base_minor,
  actual_amount_base_minor,
  source,
  confirmed,
  confirmed_at,
  created_at,
  updated_at
)
SELECT
  p.id AS project_id,
  fg.account_id,
  fg.created_by AS user_id,
  (fg.month || '-01')::date AS period,
  0 AS committed_amount_base_minor,
  COALESCE(fg.final_saved_minor, fg.target_amount_base_minor, 0) AS actual_amount_base_minor,
  'automatic' AS source,
  true AS confirmed,
  COALESCE(fg.closed_at, fg.completed_at::timestamptz, fg.updated_at, now()) AS confirmed_at,
  fg.created_at,
  fg.updated_at
FROM public.financial_goals fg
JOIN public.projects p
  ON p.account_id = fg.account_id
 AND p.is_hucha = true
WHERE fg.completed = true
  AND NOT EXISTS (
    SELECT 1
    FROM public.project_contributions pc
    WHERE pc.project_id = p.id
      AND pc.period = (fg.month || '-01')::date
  );
