-- =========================================================
-- 37. RESERVE CONTAINERS + MONTH FUNDING PLANS + MONTH CLOSES
-- =========================================================

-- 1) Reserve containers (generic reserves, starting with one hucha per account)
CREATE TABLE IF NOT EXISTS public.reserve_containers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  slug text NOT NULL CHECK (char_length(slug) >= 1 AND char_length(slug) <= 64),
  kind text NOT NULL CHECK (kind = ANY (ARRAY['hucha'::text])),
  name text NOT NULL CHECK (char_length(name) >= 1 AND char_length(name) <= 120),
  emoji text NOT NULL DEFAULT '🐷' CHECK (char_length(emoji) >= 1 AND char_length(emoji) <= 16),
  color text,
  status text NOT NULL DEFAULT 'active' CHECK (status = ANY (ARRAY['active'::text])),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserve_containers_account_slug_key UNIQUE (account_id, slug),
  CONSTRAINT reserve_containers_account_kind_key UNIQUE (account_id, kind)
);

COMMENT ON TABLE public.reserve_containers IS
  'Generic reserve containers. In v1 each account gets one hucha.';

COMMENT ON COLUMN public.reserve_containers.kind IS
  'Container type. Currently only hucha.';

CREATE INDEX IF NOT EXISTS idx_reserve_containers_account_id
  ON public.reserve_containers USING btree (account_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_reserve_containers_id_account_id
  ON public.reserve_containers USING btree (id, account_id);

ALTER TABLE public.reserve_containers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_containers FORCE ROW LEVEL SECURITY;

CREATE POLICY reserve_containers_select_policy ON public.reserve_containers
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY reserve_containers_insert_policy ON public.reserve_containers
  FOR INSERT
  WITH CHECK (
    is_contributor_or_above(account_id)
    AND created_by = (select auth.uid())
  );

CREATE POLICY reserve_containers_update_policy ON public.reserve_containers
  FOR UPDATE
  USING (is_contributor_or_above(account_id))
  WITH CHECK (is_contributor_or_above(account_id));

CREATE POLICY reserve_containers_delete_policy ON public.reserve_containers
  FOR DELETE
  USING (is_contributor_or_above(account_id));

-- 2) Month funding plans (month-open editable intentions for projects)
CREATE TABLE IF NOT EXISTS public.monthly_project_funding_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period date NOT NULL,
  project_id uuid NOT NULL,
  planned_amount_base_minor bigint NOT NULL CHECK (planned_amount_base_minor > 0),
  created_by uuid NOT NULL,
  updated_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT monthly_project_funding_plans_project_account_fkey
    FOREIGN KEY (project_id, account_id)
    REFERENCES public.projects(id, account_id)
    ON DELETE CASCADE,
  CONSTRAINT monthly_project_funding_plans_period_month_start_check
    CHECK (period = date_trunc('month', period)::date),
  CONSTRAINT monthly_project_funding_plans_unique_account_period_project
    UNIQUE (account_id, period, project_id)
);

COMMENT ON TABLE public.monthly_project_funding_plans IS
  'Editable monthly funding plans for active financial projects. Not yet consolidated.';

CREATE INDEX IF NOT EXISTS idx_monthly_project_funding_plans_account_period
  ON public.monthly_project_funding_plans USING btree (account_id, period DESC);

ALTER TABLE public.monthly_project_funding_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_project_funding_plans FORCE ROW LEVEL SECURITY;

CREATE POLICY monthly_project_funding_plans_select_policy
  ON public.monthly_project_funding_plans
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY monthly_project_funding_plans_insert_policy
  ON public.monthly_project_funding_plans
  FOR INSERT
  WITH CHECK (
    is_contributor_or_above(account_id)
    AND created_by = (select auth.uid())
    AND updated_by = (select auth.uid())
  );

CREATE POLICY monthly_project_funding_plans_update_policy
  ON public.monthly_project_funding_plans
  FOR UPDATE
  USING (is_contributor_or_above(account_id))
  WITH CHECK (is_contributor_or_above(account_id));

CREATE POLICY monthly_project_funding_plans_delete_policy
  ON public.monthly_project_funding_plans
  FOR DELETE
  USING (is_contributor_or_above(account_id));

-- 3) Month close snapshots + allocations
CREATE TABLE IF NOT EXISTS public.month_closes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  period date NOT NULL,
  actual_saved_base_minor bigint NOT NULL,
  allocated_to_projects_base_minor bigint NOT NULL DEFAULT 0 CHECK (allocated_to_projects_base_minor >= 0),
  allocated_to_reserves_base_minor bigint NOT NULL DEFAULT 0 CHECK (allocated_to_reserves_base_minor >= 0),
  closed_by uuid NOT NULL,
  closed_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT month_closes_period_month_start_check
    CHECK (period = date_trunc('month', period)::date),
  CONSTRAINT month_closes_unique_account_period
    UNIQUE (account_id, period)
);

COMMENT ON TABLE public.month_closes IS
  'Immutable month close snapshots. This is the main consolidation point.';

CREATE INDEX IF NOT EXISTS idx_month_closes_account_period
  ON public.month_closes USING btree (account_id, period DESC);

ALTER TABLE public.month_closes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.month_closes FORCE ROW LEVEL SECURITY;

CREATE POLICY month_closes_select_policy ON public.month_closes
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY month_closes_insert_policy ON public.month_closes
  FOR INSERT
  WITH CHECK (
    is_contributor_or_above(account_id)
    AND closed_by = (select auth.uid())
  );

CREATE POLICY month_closes_update_policy ON public.month_closes
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY month_closes_delete_policy ON public.month_closes
  FOR DELETE
  USING (false);

CREATE TABLE IF NOT EXISTS public.month_close_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month_close_id uuid NOT NULL REFERENCES public.month_closes(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  destination_type text NOT NULL CHECK (
    destination_type = ANY (ARRAY['project'::text, 'reserve_container'::text])
  ),
  project_id uuid,
  reserve_container_id uuid,
  amount_base_minor bigint NOT NULL CHECK (amount_base_minor > 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT month_close_allocations_project_account_fkey
    FOREIGN KEY (project_id, account_id)
    REFERENCES public.projects(id, account_id)
    ON DELETE CASCADE,
  CONSTRAINT month_close_allocations_reserve_account_fkey
    FOREIGN KEY (reserve_container_id, account_id)
    REFERENCES public.reserve_containers(id, account_id)
    ON DELETE CASCADE,
  CONSTRAINT month_close_allocations_destination_check
    CHECK (
      (
        destination_type = 'project'
        AND project_id IS NOT NULL
        AND reserve_container_id IS NULL
      )
      OR (
        destination_type = 'reserve_container'
        AND reserve_container_id IS NOT NULL
        AND project_id IS NULL
      )
    )
);

COMMENT ON TABLE public.month_close_allocations IS
  'Per-destination allocations produced by a month close.';

CREATE INDEX IF NOT EXISTS idx_month_close_allocations_close_id
  ON public.month_close_allocations USING btree (month_close_id);

CREATE INDEX IF NOT EXISTS idx_month_close_allocations_account_id
  ON public.month_close_allocations USING btree (account_id);

CREATE INDEX IF NOT EXISTS idx_month_close_allocations_project_id
  ON public.month_close_allocations USING btree (project_id);

CREATE INDEX IF NOT EXISTS idx_month_close_allocations_reserve_container_id
  ON public.month_close_allocations USING btree (reserve_container_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_month_close_allocations_close_project_unique
  ON public.month_close_allocations USING btree (month_close_id, project_id)
  WHERE project_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_month_close_allocations_close_reserve_unique
  ON public.month_close_allocations USING btree (month_close_id, reserve_container_id)
  WHERE reserve_container_id IS NOT NULL;

ALTER TABLE public.month_close_allocations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.month_close_allocations FORCE ROW LEVEL SECURITY;

CREATE POLICY month_close_allocations_select_policy ON public.month_close_allocations
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY month_close_allocations_insert_policy ON public.month_close_allocations
  FOR INSERT
  WITH CHECK (is_contributor_or_above(account_id));

CREATE POLICY month_close_allocations_update_policy ON public.month_close_allocations
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY month_close_allocations_delete_policy ON public.month_close_allocations
  FOR DELETE
  USING (false);

-- 4) Explicit reserve -> project transfers
CREATE TABLE IF NOT EXISTS public.reserve_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  source_reserve_container_id uuid NOT NULL,
  destination_project_id uuid NOT NULL,
  amount_base_minor bigint NOT NULL CHECK (amount_base_minor > 0),
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT reserve_transfers_source_account_fkey
    FOREIGN KEY (source_reserve_container_id, account_id)
    REFERENCES public.reserve_containers(id, account_id)
    ON DELETE CASCADE,
  CONSTRAINT reserve_transfers_destination_account_fkey
    FOREIGN KEY (destination_project_id, account_id)
    REFERENCES public.projects(id, account_id)
    ON DELETE CASCADE
);

COMMENT ON TABLE public.reserve_transfers IS
  'Explicit reserve-to-project transfers. In v1 this powers hucha -> project.';

CREATE INDEX IF NOT EXISTS idx_reserve_transfers_account_id
  ON public.reserve_transfers USING btree (account_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reserve_transfers_source_id
  ON public.reserve_transfers USING btree (source_reserve_container_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reserve_transfers_destination_id
  ON public.reserve_transfers USING btree (destination_project_id, created_at DESC);

ALTER TABLE public.reserve_transfers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_transfers FORCE ROW LEVEL SECURITY;

CREATE POLICY reserve_transfers_select_policy ON public.reserve_transfers
  FOR SELECT
  USING (is_account_member(account_id));

CREATE POLICY reserve_transfers_insert_policy ON public.reserve_transfers
  FOR INSERT
  WITH CHECK (
    is_contributor_or_above(account_id)
    AND created_by = (select auth.uid())
  );

CREATE POLICY reserve_transfers_update_policy ON public.reserve_transfers
  FOR UPDATE
  USING (false)
  WITH CHECK (false);

CREATE POLICY reserve_transfers_delete_policy ON public.reserve_transfers
  FOR DELETE
  USING (false);

-- 5) Helper functions
CREATE OR REPLACE FUNCTION public.ensure_hucha_reserve_container(
  p_account_id uuid,
  p_created_by uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
  v_reserve_id uuid;
  v_created_by uuid;
BEGIN
  SELECT rc.id
  INTO v_reserve_id
  FROM public.reserve_containers rc
  WHERE rc.account_id = p_account_id
    AND rc.kind = 'hucha'
  LIMIT 1;

  IF v_reserve_id IS NOT NULL THEN
    RETURN v_reserve_id;
  END IF;

  SELECT COALESCE(
    p_created_by,
    a.owner_user_id
  )
  INTO v_created_by
  FROM public.accounts a
  WHERE a.id = p_account_id;

  INSERT INTO public.reserve_containers (
    account_id,
    slug,
    kind,
    name,
    emoji,
    color,
    status,
    created_by
  )
  VALUES (
    p_account_id,
    'hucha',
    'hucha',
    'Hucha',
    '🐷',
    '#6DC9A0',
    'active',
    v_created_by
  )
  ON CONFLICT (account_id, kind) DO UPDATE
  SET updated_at = now()
  RETURNING id INTO v_reserve_id;

  RETURN v_reserve_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.create_default_reserve_containers_for_account()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM public.ensure_hucha_reserve_container(NEW.id, NEW.owner_user_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_create_hucha_on_account ON public.accounts;
DROP TRIGGER IF EXISTS trg_create_default_reserve_containers_on_account ON public.accounts;

CREATE TRIGGER trg_create_default_reserve_containers_on_account
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_default_reserve_containers_for_account();

CREATE OR REPLACE FUNCTION public.get_month_saved_amount_minor(
  p_account_id uuid,
  p_period date
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN t.type = 'income' THEN t.amount_base_minor
      ELSE -t.amount_base_minor
    END
  ), 0)
  FROM public.transactions t
  WHERE t.account_id = p_account_id
    AND t.date >= date_trunc('month', p_period)::date
    AND t.date < (date_trunc('month', p_period)::date + interval '1 month');
$$;

CREATE OR REPLACE FUNCTION public.get_reserve_container_balance_minor(
  p_reserve_container_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  WITH reserve_in AS (
    SELECT COALESCE(SUM(mca.amount_base_minor), 0) AS total_in
    FROM public.month_close_allocations mca
    WHERE mca.reserve_container_id = p_reserve_container_id
  ),
  reserve_out AS (
    SELECT COALESCE(SUM(rt.amount_base_minor), 0) AS total_out
    FROM public.reserve_transfers rt
    WHERE rt.source_reserve_container_id = p_reserve_container_id
  )
  SELECT reserve_in.total_in - reserve_out.total_out
  FROM reserve_in, reserve_out;
$$;

CREATE OR REPLACE FUNCTION public.get_project_funded_reserved_minor(
  p_project_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  WITH close_funding AS (
    SELECT COALESCE(SUM(mca.amount_base_minor), 0) AS total_close_minor
    FROM public.month_close_allocations mca
    WHERE mca.project_id = p_project_id
  ),
  reserve_transfer_funding AS (
    SELECT COALESCE(SUM(rt.amount_base_minor), 0) AS total_transfer_minor
    FROM public.reserve_transfers rt
    WHERE rt.destination_project_id = p_project_id
  )
  SELECT close_funding.total_close_minor + reserve_transfer_funding.total_transfer_minor
  FROM close_funding, reserve_transfer_funding;
$$;

CREATE OR REPLACE FUNCTION public.get_savings_month_state(
  p_account_id uuid,
  p_period date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
STABLE
AS $$
DECLARE
  v_period date;
  v_saved_minor bigint;
  v_planned_minor bigint;
  v_available_minor bigint;
  v_is_closed boolean;
  v_close public.month_closes%ROWTYPE;
BEGIN
  IF NOT is_account_member(p_account_id) THEN
    RETURN NULL;
  END IF;

  v_period := date_trunc('month', p_period)::date;
  v_saved_minor := public.get_month_saved_amount_minor(p_account_id, v_period);

  SELECT COALESCE(SUM(planned_amount_base_minor), 0)
  INTO v_planned_minor
  FROM public.monthly_project_funding_plans
  WHERE account_id = p_account_id
    AND period = v_period;

  SELECT *
  INTO v_close
  FROM public.month_closes
  WHERE account_id = p_account_id
    AND period = v_period;

  v_is_closed := v_close.id IS NOT NULL;
  v_available_minor := GREATEST(v_saved_minor, 0) - v_planned_minor;

  RETURN jsonb_build_object(
    'period', to_char(v_period, 'YYYY-MM-DD'),
    'generated_saved_base_minor', v_saved_minor,
    'planned_to_projects_base_minor', v_planned_minor,
    'available_to_plan_minor', GREATEST(v_available_minor, 0),
    'needs_rebalance', v_planned_minor > GREATEST(v_saved_minor, 0),
    'is_closed', v_is_closed,
    'closed_at', CASE WHEN v_is_closed THEN v_close.closed_at ELSE NULL END,
    'allocated_to_projects_base_minor', CASE
      WHEN v_is_closed THEN v_close.allocated_to_projects_base_minor
      ELSE NULL
    END,
    'allocated_to_reserves_base_minor', CASE
      WHEN v_is_closed THEN v_close.allocated_to_reserves_base_minor
      ELSE NULL
    END,
    'plans', (
      SELECT COALESCE(jsonb_agg(
        jsonb_build_object(
          'project_id', mpfp.project_id,
          'planned_amount_base_minor', mpfp.planned_amount_base_minor
        )
        ORDER BY mpfp.project_id
      ), '[]'::jsonb)
      FROM public.monthly_project_funding_plans mpfp
      WHERE mpfp.account_id = p_account_id
        AND mpfp.period = v_period
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.upsert_monthly_project_funding_plan(
  p_account_id uuid,
  p_period date,
  p_project_id uuid,
  p_amount_base_minor bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_period date;
  v_saved_minor bigint;
  v_positive_saved_minor bigint;
  v_other_plans_minor bigint;
  v_target_minor bigint;
  v_now timestamptz := now();
BEGIN
  IF NOT is_contributor_or_above(p_account_id) THEN
    RAISE EXCEPTION 'Not allowed to edit savings plans for this account';
  END IF;

  v_period := date_trunc('month', p_period)::date;

  IF EXISTS (
    SELECT 1
    FROM public.month_closes mc
    WHERE mc.account_id = p_account_id
      AND mc.period = v_period
  ) THEN
    RAISE EXCEPTION 'Month is already closed';
  END IF;

  SELECT p.target_amount_base_minor
  INTO v_target_minor
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.account_id = p_account_id
    AND p.status = 'active';

  IF v_target_minor IS NULL THEN
    RAISE EXCEPTION 'Project is not eligible for monthly funding';
  END IF;

  IF p_amount_base_minor IS NULL OR p_amount_base_minor <= 0 THEN
    DELETE FROM public.monthly_project_funding_plans
    WHERE account_id = p_account_id
      AND period = v_period
      AND project_id = p_project_id;

    RETURN public.get_savings_month_state(p_account_id, v_period);
  END IF;

  v_saved_minor := public.get_month_saved_amount_minor(p_account_id, v_period);
  v_positive_saved_minor := GREATEST(v_saved_minor, 0);

  SELECT COALESCE(SUM(mpfp.planned_amount_base_minor), 0)
  INTO v_other_plans_minor
  FROM public.monthly_project_funding_plans mpfp
  WHERE mpfp.account_id = p_account_id
    AND mpfp.period = v_period
    AND mpfp.project_id <> p_project_id;

  IF v_other_plans_minor + p_amount_base_minor > v_positive_saved_minor THEN
    RAISE EXCEPTION 'Plan exceeds currently available savings';
  END IF;

  INSERT INTO public.monthly_project_funding_plans (
    account_id,
    period,
    project_id,
    planned_amount_base_minor,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  VALUES (
    p_account_id,
    v_period,
    p_project_id,
    p_amount_base_minor,
    auth.uid(),
    auth.uid(),
    v_now,
    v_now
  )
  ON CONFLICT (account_id, period, project_id)
  DO UPDATE
  SET planned_amount_base_minor = EXCLUDED.planned_amount_base_minor,
      updated_by = auth.uid(),
      updated_at = v_now;

  RETURN public.get_savings_month_state(p_account_id, v_period);
END;
$$;

CREATE OR REPLACE FUNCTION public.replace_monthly_project_funding_plans(
  p_account_id uuid,
  p_period date,
  p_plans jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_period date;
  v_saved_minor bigint;
  v_positive_saved_minor bigint;
  v_total_planned_minor bigint;
  v_now timestamptz := now();
BEGIN
  IF NOT is_contributor_or_above(p_account_id) THEN
    RAISE EXCEPTION 'Not allowed to edit savings plans for this account';
  END IF;

  v_period := date_trunc('month', p_period)::date;

  IF EXISTS (
    SELECT 1
    FROM public.month_closes mc
    WHERE mc.account_id = p_account_id
      AND mc.period = v_period
  ) THEN
    RAISE EXCEPTION 'Month is already closed';
  END IF;

  IF p_plans IS NULL OR jsonb_typeof(p_plans) <> 'array' THEN
    RAISE EXCEPTION 'Plans payload must be a JSON array';
  END IF;

  WITH input_rows AS (
    SELECT
      (row->>'project_id')::uuid AS project_id,
      GREATEST(COALESCE((row->>'planned_amount_base_minor')::bigint, 0), 0) AS planned_amount_base_minor
    FROM jsonb_array_elements(p_plans) row
  ),
  normalized AS (
    SELECT
      project_id,
      SUM(planned_amount_base_minor) AS planned_amount_base_minor
    FROM input_rows
    WHERE project_id IS NOT NULL
    GROUP BY project_id
  )
  SELECT COALESCE(SUM(planned_amount_base_minor), 0)
  INTO v_total_planned_minor
  FROM normalized;

  v_saved_minor := public.get_month_saved_amount_minor(p_account_id, v_period);
  v_positive_saved_minor := GREATEST(v_saved_minor, 0);

  IF v_total_planned_minor > v_positive_saved_minor THEN
    RAISE EXCEPTION 'Plans exceed currently available savings';
  END IF;

  IF EXISTS (
    WITH input_rows AS (
      SELECT
        (row->>'project_id')::uuid AS project_id,
        GREATEST(COALESCE((row->>'planned_amount_base_minor')::bigint, 0), 0) AS planned_amount_base_minor
      FROM jsonb_array_elements(p_plans) row
    ),
    normalized AS (
      SELECT
        project_id,
        SUM(planned_amount_base_minor) AS planned_amount_base_minor
      FROM input_rows
      WHERE project_id IS NOT NULL
      GROUP BY project_id
    )
    SELECT 1
    FROM normalized n
    LEFT JOIN public.projects p
      ON p.id = n.project_id
     AND p.account_id = p_account_id
     AND p.status = 'active'
    WHERE n.planned_amount_base_minor > 0
      AND (p.id IS NULL OR p.target_amount_base_minor IS NULL)
  ) THEN
    RAISE EXCEPTION 'Plans can only target active financial projects';
  END IF;

  WITH input_rows AS (
    SELECT
      (row->>'project_id')::uuid AS project_id,
      GREATEST(COALESCE((row->>'planned_amount_base_minor')::bigint, 0), 0) AS planned_amount_base_minor
    FROM jsonb_array_elements(p_plans) row
  ),
  normalized AS (
    SELECT
      project_id,
      SUM(planned_amount_base_minor) AS planned_amount_base_minor
    FROM input_rows
    WHERE project_id IS NOT NULL
    GROUP BY project_id
  )
  DELETE FROM public.monthly_project_funding_plans mpfp
  WHERE mpfp.account_id = p_account_id
    AND mpfp.period = v_period
    AND NOT EXISTS (
      SELECT 1
      FROM normalized n
      WHERE n.project_id = mpfp.project_id
        AND n.planned_amount_base_minor > 0
    );

  WITH input_rows AS (
    SELECT
      (row->>'project_id')::uuid AS project_id,
      GREATEST(COALESCE((row->>'planned_amount_base_minor')::bigint, 0), 0) AS planned_amount_base_minor
    FROM jsonb_array_elements(p_plans) row
  ),
  normalized AS (
    SELECT
      project_id,
      SUM(planned_amount_base_minor) AS planned_amount_base_minor
    FROM input_rows
    WHERE project_id IS NOT NULL
    GROUP BY project_id
  )
  INSERT INTO public.monthly_project_funding_plans (
    account_id,
    period,
    project_id,
    planned_amount_base_minor,
    created_by,
    updated_by,
    created_at,
    updated_at
  )
  SELECT
    p_account_id,
    v_period,
    n.project_id,
    n.planned_amount_base_minor,
    auth.uid(),
    auth.uid(),
    v_now,
    v_now
  FROM normalized n
  WHERE n.planned_amount_base_minor > 0
  ON CONFLICT (account_id, period, project_id)
  DO UPDATE
  SET planned_amount_base_minor = EXCLUDED.planned_amount_base_minor,
      updated_by = auth.uid(),
      updated_at = v_now;

  RETURN public.get_savings_month_state(p_account_id, v_period);
END;
$$;

CREATE OR REPLACE FUNCTION public.close_savings_month(
  p_account_id uuid,
  p_period date
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_period date;
  v_saved_minor bigint;
  v_positive_saved_minor bigint;
  v_planned_minor bigint;
  v_projects_minor bigint;
  v_reserves_minor bigint;
  v_month_close_id uuid;
  v_hucha_id uuid;
  v_now timestamptz := now();
BEGIN
  IF NOT is_contributor_or_above(p_account_id) THEN
    RAISE EXCEPTION 'Not allowed to close months for this account';
  END IF;

  v_period := date_trunc('month', p_period)::date;

  IF EXISTS (
    SELECT 1
    FROM public.month_closes mc
    WHERE mc.account_id = p_account_id
      AND mc.period = v_period
  ) THEN
    RAISE EXCEPTION 'Month is already closed';
  END IF;

  v_saved_minor := public.get_month_saved_amount_minor(p_account_id, v_period);
  v_positive_saved_minor := GREATEST(v_saved_minor, 0);

  SELECT COALESCE(SUM(mpfp.planned_amount_base_minor), 0)
  INTO v_planned_minor
  FROM public.monthly_project_funding_plans mpfp
  WHERE mpfp.account_id = p_account_id
    AND mpfp.period = v_period;

  IF v_planned_minor > v_positive_saved_minor THEN
    RAISE EXCEPTION 'Month requires rebalance before closing';
  END IF;

  v_projects_minor := v_planned_minor;
  v_reserves_minor := v_positive_saved_minor - v_planned_minor;

  INSERT INTO public.month_closes (
    account_id,
    period,
    actual_saved_base_minor,
    allocated_to_projects_base_minor,
    allocated_to_reserves_base_minor,
    closed_by,
    closed_at,
    created_at
  )
  VALUES (
    p_account_id,
    v_period,
    v_saved_minor,
    v_projects_minor,
    v_reserves_minor,
    auth.uid(),
    v_now,
    v_now
  )
  RETURNING id INTO v_month_close_id;

  INSERT INTO public.month_close_allocations (
    month_close_id,
    account_id,
    destination_type,
    project_id,
    reserve_container_id,
    amount_base_minor,
    created_at
  )
  SELECT
    v_month_close_id,
    p_account_id,
    'project',
    mpfp.project_id,
    NULL,
    mpfp.planned_amount_base_minor,
    v_now
  FROM public.monthly_project_funding_plans mpfp
  WHERE mpfp.account_id = p_account_id
    AND mpfp.period = v_period
    AND mpfp.planned_amount_base_minor > 0;

  IF v_reserves_minor > 0 THEN
    v_hucha_id := public.ensure_hucha_reserve_container(p_account_id, auth.uid());

    INSERT INTO public.month_close_allocations (
      month_close_id,
      account_id,
      destination_type,
      project_id,
      reserve_container_id,
      amount_base_minor,
      created_at
    )
    VALUES (
      v_month_close_id,
      p_account_id,
      'reserve_container',
      NULL,
      v_hucha_id,
      v_reserves_minor,
      v_now
    );
  END IF;

  RETURN public.get_savings_month_state(p_account_id, v_period);
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_reserve_to_project(
  p_account_id uuid,
  p_source_reserve_container_id uuid,
  p_destination_project_id uuid,
  p_amount_base_minor bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_reserve_balance_minor bigint;
  v_project_target_minor bigint;
  v_project_funded_minor bigint;
  v_project_remaining_minor bigint;
  v_transfer_id uuid;
BEGIN
  IF NOT is_contributor_or_above(p_account_id) THEN
    RAISE EXCEPTION 'Not allowed to transfer reserves for this account';
  END IF;

  IF p_amount_base_minor IS NULL OR p_amount_base_minor <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.reserve_containers rc
    WHERE rc.id = p_source_reserve_container_id
      AND rc.account_id = p_account_id
      AND rc.status = 'active'
  ) THEN
    RAISE EXCEPTION 'Reserve container is not available';
  END IF;

  SELECT p.target_amount_base_minor
  INTO v_project_target_minor
  FROM public.projects p
  WHERE p.id = p_destination_project_id
    AND p.account_id = p_account_id
    AND p.status = 'active';

  IF v_project_target_minor IS NULL THEN
    RAISE EXCEPTION 'Destination project is not eligible';
  END IF;

  v_reserve_balance_minor :=
    public.get_reserve_container_balance_minor(p_source_reserve_container_id);

  IF p_amount_base_minor > v_reserve_balance_minor THEN
    RAISE EXCEPTION 'Reserve balance is insufficient';
  END IF;

  v_project_funded_minor :=
    public.get_project_funded_reserved_minor(p_destination_project_id);
  v_project_remaining_minor :=
    GREATEST(v_project_target_minor - v_project_funded_minor, 0);

  IF p_amount_base_minor > v_project_remaining_minor THEN
    RAISE EXCEPTION 'Transfer would overfund the project';
  END IF;

  INSERT INTO public.reserve_transfers (
    account_id,
    source_reserve_container_id,
    destination_project_id,
    amount_base_minor,
    created_by,
    created_at
  )
  VALUES (
    p_account_id,
    p_source_reserve_container_id,
    p_destination_project_id,
    p_amount_base_minor,
    auth.uid(),
    now()
  )
  RETURNING id INTO v_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'source_reserve_container_id', p_source_reserve_container_id,
    'destination_project_id', p_destination_project_id,
    'amount_base_minor', p_amount_base_minor
  );
END;
$$;

-- 6) Backfill reserve containers for existing accounts
INSERT INTO public.reserve_containers (
  account_id,
  slug,
  kind,
  name,
  emoji,
  color,
  status,
  created_by
)
SELECT
  a.id,
  'hucha',
  'hucha',
  'Hucha',
  '🐷',
  '#6DC9A0',
  'active',
  a.owner_user_id
FROM public.accounts a
WHERE NOT EXISTS (
  SELECT 1
  FROM public.reserve_containers rc
  WHERE rc.account_id = a.id
    AND rc.kind = 'hucha'
);

-- 7) Backfill month closes from confirmed legacy project_contributions
INSERT INTO public.month_closes (
  account_id,
  period,
  actual_saved_base_minor,
  allocated_to_projects_base_minor,
  allocated_to_reserves_base_minor,
  closed_by,
  closed_at,
  created_at
)
SELECT
  legacy.account_id,
  legacy.period,
  legacy.projects_minor + legacy.reserves_minor,
  legacy.projects_minor,
  legacy.reserves_minor,
  COALESCE(legacy.closed_by, a.owner_user_id),
  legacy.closed_at,
  legacy.closed_at
FROM (
  SELECT
    pc.account_id,
    pc.period,
    SUM(
      CASE
        WHEN p.target_amount_base_minor IS NOT NULL THEN pc.actual_amount_base_minor
        ELSE 0
      END
    ) AS projects_minor,
    SUM(
      CASE
        WHEN p.target_amount_base_minor IS NULL THEN pc.actual_amount_base_minor
        ELSE 0
      END
    ) AS reserves_minor,
    MAX(COALESCE(pc.confirmed_at, pc.created_at, now())) AS closed_at,
    (
      ARRAY_AGG(
        pc.user_id
        ORDER BY COALESCE(pc.confirmed_at, pc.created_at, now()) DESC
      ) FILTER (WHERE pc.user_id IS NOT NULL)
    )[1] AS closed_by
  FROM public.project_contributions pc
  JOIN public.projects p
    ON p.id = pc.project_id
   AND p.account_id = pc.account_id
  WHERE pc.confirmed = true
    AND pc.actual_amount_base_minor > 0
  GROUP BY pc.account_id, pc.period
) legacy
JOIN public.accounts a
  ON a.id = legacy.account_id
WHERE NOT EXISTS (
  SELECT 1
  FROM public.month_closes mc
  WHERE mc.account_id = legacy.account_id
    AND mc.period = legacy.period
);

INSERT INTO public.month_close_allocations (
  month_close_id,
  account_id,
  destination_type,
  project_id,
  reserve_container_id,
  amount_base_minor,
  created_at
)
SELECT
  mc.id,
  pc.account_id,
  CASE
    WHEN p.target_amount_base_minor IS NULL THEN 'reserve_container'
    ELSE 'project'
  END,
  CASE
    WHEN p.target_amount_base_minor IS NULL THEN NULL
    ELSE p.id
  END,
  CASE
    WHEN p.target_amount_base_minor IS NULL THEN rc.id
    ELSE NULL
  END,
  pc.actual_amount_base_minor,
  COALESCE(pc.confirmed_at, pc.created_at, mc.closed_at, now())
FROM public.project_contributions pc
JOIN public.projects p
  ON p.id = pc.project_id
 AND p.account_id = pc.account_id
JOIN public.month_closes mc
  ON mc.account_id = pc.account_id
 AND mc.period = pc.period
LEFT JOIN public.reserve_containers rc
  ON rc.account_id = pc.account_id
 AND rc.kind = 'hucha'
WHERE pc.confirmed = true
  AND pc.actual_amount_base_minor > 0
  AND NOT EXISTS (
    SELECT 1
    FROM public.month_close_allocations existing
    WHERE existing.month_close_id = mc.id
      AND (
        (p.target_amount_base_minor IS NOT NULL AND existing.project_id = p.id)
        OR (
          p.target_amount_base_minor IS NULL
          AND existing.reserve_container_id = rc.id
        )
      )
  );
