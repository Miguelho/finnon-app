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
  v_current_month_start date := date_trunc('month', v_now)::date;
BEGIN
  IF NOT is_contributor_or_above(p_account_id) THEN
    RAISE EXCEPTION 'Not allowed to close months for this account';
  END IF;

  v_period := date_trunc('month', p_period)::date;

  IF v_period >= v_current_month_start THEN
    RAISE EXCEPTION 'Month can only be closed after it has ended';
  END IF;

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
