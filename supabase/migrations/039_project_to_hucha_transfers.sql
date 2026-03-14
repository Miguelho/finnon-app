ALTER TABLE public.reserve_transfers
  ADD COLUMN IF NOT EXISTS direction text;

UPDATE public.reserve_transfers
SET direction = 'reserve_to_project'
WHERE direction IS NULL;

ALTER TABLE public.reserve_transfers
  ALTER COLUMN direction SET DEFAULT 'reserve_to_project';

ALTER TABLE public.reserve_transfers
  ALTER COLUMN direction SET NOT NULL;

ALTER TABLE public.reserve_transfers
  DROP CONSTRAINT IF EXISTS reserve_transfers_direction_check;

ALTER TABLE public.reserve_transfers
  ADD CONSTRAINT reserve_transfers_direction_check
  CHECK (direction IN ('reserve_to_project', 'project_to_reserve'));

COMMENT ON TABLE public.reserve_transfers IS
  'Explicit transfers between the hucha reserve and projects. Supports both directions.';

COMMENT ON COLUMN public.reserve_transfers.direction IS
  'reserve_to_project moves money from the reserve to the project; project_to_reserve returns it to the reserve.';

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
  reserve_transfer_delta AS (
    SELECT COALESCE(SUM(
      CASE
        WHEN rt.direction = 'project_to_reserve' THEN rt.amount_base_minor
        ELSE -rt.amount_base_minor
      END
    ), 0) AS total_delta
    FROM public.reserve_transfers rt
    WHERE rt.source_reserve_container_id = p_reserve_container_id
  )
  SELECT reserve_in.total_in + reserve_transfer_delta.total_delta
  FROM reserve_in, reserve_transfer_delta;
$$;

CREATE OR REPLACE FUNCTION public.get_project_net_reserve_transfer_minor(
  p_project_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(
    CASE
      WHEN rt.direction = 'project_to_reserve' THEN -rt.amount_base_minor
      ELSE rt.amount_base_minor
    END
  ), 0)
  FROM public.reserve_transfers rt
  WHERE rt.destination_project_id = p_project_id;
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
    SELECT public.get_project_net_reserve_transfer_minor(p_project_id) AS total_transfer_minor
  )
  SELECT close_funding.total_close_minor + reserve_transfer_funding.total_transfer_minor
  FROM close_funding, reserve_transfer_funding;
$$;

CREATE OR REPLACE FUNCTION public.get_project_spent_minor(
  p_project_id uuid
)
RETURNS bigint
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(SUM(t.amount_base_minor), 0)
  FROM public.transactions t
  WHERE t.project_id = p_project_id
    AND t.type = 'expense';
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
    direction,
    created_by,
    created_at
  )
  VALUES (
    p_account_id,
    p_source_reserve_container_id,
    p_destination_project_id,
    p_amount_base_minor,
    'reserve_to_project',
    auth.uid(),
    now()
  )
  RETURNING id INTO v_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'source_reserve_container_id', p_source_reserve_container_id,
    'destination_project_id', p_destination_project_id,
    'amount_base_minor', p_amount_base_minor,
    'direction', 'reserve_to_project'
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.transfer_project_to_hucha(
  p_account_id uuid,
  p_project_id uuid,
  p_amount_base_minor bigint
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
AS $$
DECLARE
  v_hucha_reserve_id uuid;
  v_project_target_minor bigint;
  v_project_funded_minor bigint;
  v_project_spent_minor bigint;
  v_project_available_reserved_minor bigint;
  v_project_net_reserve_minor bigint;
  v_transfer_id uuid;
BEGIN
  IF NOT is_contributor_or_above(p_account_id) THEN
    RAISE EXCEPTION 'Not allowed to transfer reserves for this account';
  END IF;

  IF p_amount_base_minor IS NULL OR p_amount_base_minor <= 0 THEN
    RAISE EXCEPTION 'Transfer amount must be greater than zero';
  END IF;

  SELECT p.target_amount_base_minor
  INTO v_project_target_minor
  FROM public.projects p
  WHERE p.id = p_project_id
    AND p.account_id = p_account_id
    AND p.status = 'active'
    AND COALESCE(p.is_hucha, false) = false;

  IF v_project_target_minor IS NULL THEN
    RAISE EXCEPTION 'Project is not eligible';
  END IF;

  v_hucha_reserve_id := public.ensure_hucha_reserve_container(p_account_id, auth.uid());
  v_project_net_reserve_minor := public.get_project_net_reserve_transfer_minor(p_project_id);

  IF p_amount_base_minor > v_project_net_reserve_minor THEN
    RAISE EXCEPTION 'Project has no reserve-funded balance available to return';
  END IF;

  v_project_funded_minor := public.get_project_funded_reserved_minor(p_project_id);
  v_project_spent_minor := public.get_project_spent_minor(p_project_id);
  v_project_available_reserved_minor :=
    GREATEST(v_project_funded_minor - v_project_spent_minor, 0);

  IF p_amount_base_minor > v_project_available_reserved_minor THEN
    RAISE EXCEPTION 'Project reserved balance is insufficient';
  END IF;

  INSERT INTO public.reserve_transfers (
    account_id,
    source_reserve_container_id,
    destination_project_id,
    amount_base_minor,
    direction,
    created_by,
    created_at
  )
  VALUES (
    p_account_id,
    v_hucha_reserve_id,
    p_project_id,
    p_amount_base_minor,
    'project_to_reserve',
    auth.uid(),
    now()
  )
  RETURNING id INTO v_transfer_id;

  RETURN jsonb_build_object(
    'transfer_id', v_transfer_id,
    'reserve_container_id', v_hucha_reserve_id,
    'project_id', p_project_id,
    'amount_base_minor', p_amount_base_minor,
    'direction', 'project_to_reserve'
  );
END;
$$;
