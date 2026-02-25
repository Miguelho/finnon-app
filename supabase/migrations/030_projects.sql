-- =========================================================
-- 30. PROJECTS + PROJECT CONTRIBUTIONS
-- =========================================================

CREATE TABLE IF NOT EXISTS public.projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 120),
  emoji text NOT NULL DEFAULT '🎯' CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 16),
  target_amount_base_minor bigint NOT NULL CHECK (target_amount_base_minor > 0),
  monthly_commitment_base_minor bigint CHECK (
    monthly_commitment_base_minor IS NULL
    OR monthly_commitment_base_minor >= 0
  ),
  priority integer NOT NULL DEFAULT 1 CHECK (priority >= 1),
  status text NOT NULL DEFAULT 'active' CHECK (
    status = ANY (ARRAY['active'::text, 'completed'::text, 'paused'::text, 'cancelled'::text])
  ),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.projects IS
  'Shared savings projects per account (vacation, laptop, etc).';
COMMENT ON COLUMN public.projects.target_amount_base_minor IS
  'Target amount in account base currency minor units.';
COMMENT ON COLUMN public.projects.monthly_commitment_base_minor IS
  'Monthly commitment set by the project simulator in account base currency minor units.';
COMMENT ON COLUMN public.projects.priority IS
  'User-defined order of importance. 1 = highest priority.';

CREATE INDEX IF NOT EXISTS idx_projects_account_id
  ON public.projects USING btree (account_id);

CREATE INDEX IF NOT EXISTS idx_projects_account_status_priority
  ON public.projects USING btree (account_id, status, priority);

CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_id_account_id
  ON public.projects USING btree (id, account_id);

CREATE TABLE IF NOT EXISTS public.project_contributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  period date NOT NULL,
  committed_amount_base_minor bigint NOT NULL DEFAULT 0 CHECK (committed_amount_base_minor >= 0),
  actual_amount_base_minor bigint NOT NULL DEFAULT 0 CHECK (actual_amount_base_minor >= 0),
  source text NOT NULL CHECK (
    source = ANY (ARRAY['automatic'::text, 'manual'::text])
  ),
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_contributions_project_account_fkey
    FOREIGN KEY (project_id, account_id)
    REFERENCES public.projects(id, account_id)
    ON DELETE CASCADE,
  CONSTRAINT project_contributions_period_month_start_check
    CHECK (period = date_trunc('month', period)::date),
  CONSTRAINT project_contributions_confirmed_at_check
    CHECK (
      (confirmed = false)
      OR (confirmed = true AND confirmed_at IS NOT NULL)
    )
);

COMMENT ON TABLE public.project_contributions IS
  'Monthly contributions assigned to each project.';
COMMENT ON COLUMN public.project_contributions.period IS
  'Month represented as the first day of the month (YYYY-MM-01).';

CREATE INDEX IF NOT EXISTS idx_project_contributions_account_id
  ON public.project_contributions USING btree (account_id);

CREATE INDEX IF NOT EXISTS idx_project_contributions_project_period
  ON public.project_contributions USING btree (project_id, period DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_project_contributions_project_period_user
  ON public.project_contributions USING btree (project_id, period, user_id);

ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects FORCE ROW LEVEL SECURITY;

ALTER TABLE public.project_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_contributions FORCE ROW LEVEL SECURITY;

CREATE POLICY projects_select_policy ON public.projects
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY projects_insert_policy ON public.projects
  FOR INSERT
  WITH CHECK (
    is_contributor_or_above(account_id)
    AND created_by = (select auth.uid())
  );

CREATE POLICY projects_update_policy ON public.projects
  FOR UPDATE
  USING (is_contributor_or_above(account_id))
  WITH CHECK (is_contributor_or_above(account_id));

CREATE POLICY projects_delete_policy ON public.projects
  FOR DELETE
  USING (is_contributor_or_above(account_id));

CREATE POLICY project_contributions_select_policy ON public.project_contributions
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY project_contributions_insert_policy ON public.project_contributions
  FOR INSERT
  WITH CHECK (
    is_contributor_or_above(account_id)
    AND user_id = (select auth.uid())
  );

CREATE POLICY project_contributions_update_policy ON public.project_contributions
  FOR UPDATE
  USING (is_contributor_or_above(account_id))
  WITH CHECK (is_contributor_or_above(account_id));

CREATE POLICY project_contributions_delete_policy ON public.project_contributions
  FOR DELETE
  USING (is_contributor_or_above(account_id));
