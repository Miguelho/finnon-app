-- 024_goal_v2_estimated_completion.sql
-- Objetivos V2: Fecha estimada de cumplimiento y ahorro con pendientes

-- 1) Resumen de ahorro V2: incluye transacciones pendientes (date > today)
create or replace function public.get_month_saving_summary_v2(
  p_account_id uuid,
  p_month_start date,
  p_month_end date,
  p_today date
)
returns table (
  income_real_minor bigint,
  expense_real_minor bigint,
  income_pending_minor bigint,
  expense_pending_minor bigint,
  saved_real_minor bigint,
  saved_total_minor bigint
)
language sql
stable
as $$
  with
  -- Transacciones reales (hasta hoy)
  real_tx as (
    select *
    from public.transactions t
    where t.account_id = p_account_id
      and t.date >= p_month_start
      and t.date < p_month_end
      and t.date <= p_today
  ),
  -- Transacciones pendientes (futuras dentro del mes)
  pending_tx as (
    select *
    from public.transactions t
    where t.account_id = p_account_id
      and t.date >= p_month_start
      and t.date < p_month_end
      and t.date > p_today
  ),
  -- Ingresos y gastos reales
  real_income as (
    select coalesce(sum(amount_base_minor), 0)::bigint as v from real_tx where type = 'income'
  ),
  real_expense as (
    select coalesce(sum(amount_base_minor), 0)::bigint as v from real_tx where type = 'expense'
  ),
  -- Ingresos y gastos pendientes
  pending_income as (
    select coalesce(sum(amount_base_minor), 0)::bigint as v from pending_tx where type = 'income'
  ),
  pending_expense as (
    select coalesce(sum(amount_base_minor), 0)::bigint as v from pending_tx where type = 'expense'
  )
  select
    ri.v as income_real_minor,
    re.v as expense_real_minor,
    pi.v as income_pending_minor,
    pe.v as expense_pending_minor,
    (ri.v - re.v)::bigint as saved_real_minor,
    ((ri.v + pi.v) - (re.v + pe.v))::bigint as saved_total_minor
  from real_income ri, real_expense re, pending_income pi, pending_expense pe;
$$;


-- 2) Calcular fecha estimada de cumplimiento
-- Simula día a día desde hoy hasta fin de mes
create or replace function public.get_estimated_completion_date(
  p_account_id uuid,
  p_month_start date,
  p_month_end date,
  p_today date,
  p_target_minor bigint
)
returns table (
  completion_status text,
  completion_date date,
  saved_so_far_minor bigint,
  saved_total_minor bigint
)
language plpgsql
stable
as $$
declare
  v_saved_real bigint;
  v_saved_total bigint;
  v_running bigint;
  v_day date;
  v_delta bigint;
  v_found_date date := null;
begin
  -- Obtener ahorro real hasta hoy
  select s.saved_real_minor, s.saved_total_minor
    into v_saved_real, v_saved_total
  from public.get_month_saving_summary_v2(p_account_id, p_month_start, p_month_end, p_today) s;

  -- Caso 1: Ya cumplido hoy
  if v_saved_real >= p_target_minor then
    return query select
      'completed_today'::text,
      p_today,
      v_saved_real,
      v_saved_total;
    return;
  end if;

  -- Caso 2: Simular día a día
  v_running := v_saved_real;

  for v_day in
    select d::date
    from generate_series(p_today + 1, p_month_end - 1, interval '1 day') as d
  loop
    -- Calcular delta del día (ingresos - gastos pendientes de ese día)
    select coalesce(sum(
      case when t.type = 'income' then t.amount_base_minor
           when t.type = 'expense' then -t.amount_base_minor
           else 0
      end
    ), 0)::bigint
      into v_delta
    from public.transactions t
    where t.account_id = p_account_id
      and t.date = v_day;

    v_running := v_running + v_delta;

    if v_running >= p_target_minor then
      v_found_date := v_day;
      exit;
    end if;
  end loop;

  -- Retornar resultado
  if v_found_date is not null then
    return query select
      'completion_date'::text,
      v_found_date,
      v_saved_real,
      v_saved_total;
  else
    return query select
      'not_achievable'::text,
      null::date,
      v_saved_real,
      v_saved_total;
  end if;
end;
$$;


-- 3) Calcular estado del mes basado en ritmo
create or replace function public.get_month_status(
  p_saved_total_minor bigint,
  p_target_minor bigint,
  p_days_elapsed int,
  p_days_in_month int,
  p_completion_status text,
  p_completion_date date,
  p_month_end date
)
returns text
language plpgsql
immutable
as $$
declare
  v_expected_progress numeric;
  v_actual_progress numeric;
  v_days_to_completion int;
  v_expected_completion_day int;
begin
  -- Si ya cumpliste, estás adelantado
  if p_completion_status = 'completed_today' then
    return 'adelantado';
  end if;

  -- Si no llegas, estás retrasado
  if p_completion_status = 'not_achievable' then
    return 'retrasado';
  end if;

  -- Calcular si vas adelantado, justo o retrasado
  -- basado en cuándo cumplirías vs día proporcional esperado
  v_days_to_completion := p_completion_date - current_date;
  v_expected_completion_day := p_days_in_month; -- fin de mes como baseline

  -- Si cumples antes del 80% del mes, vas adelantado
  if p_completion_date <= (current_date + (p_days_in_month * 0.7)::int) then
    return 'adelantado';
  end if;

  -- Si cumples después del 90% del mes, vas en riesgo
  if p_completion_date >= (p_month_end - 3) then
    return 'en_riesgo';
  end if;

  return 'en_riesgo';
end;
$$;


-- 4) Calcular impacto en días de un gasto específico
create or replace function public.get_expense_delay_days(
  p_account_id uuid,
  p_month_start date,
  p_month_end date,
  p_today date,
  p_target_minor bigint,
  p_expense_id uuid
)
returns int
language plpgsql
stable
as $$
declare
  v_base_status text;
  v_base_date date;
  v_expense_amount bigint;
  v_expense_date date;
  v_new_status text;
  v_new_date date;
  v_delay_days int;
begin
  -- Obtener fecha base (con el gasto)
  select e.completion_status, e.completion_date
    into v_base_status, v_base_date
  from public.get_estimated_completion_date(
    p_account_id, p_month_start, p_month_end, p_today, p_target_minor
  ) e;

  -- Obtener monto y fecha del gasto
  select t.amount_base_minor, t.date
    into v_expense_amount, v_expense_date
  from public.transactions t
  where t.id = p_expense_id;

  if v_expense_amount is null then
    return null;
  end if;

  -- Calcular nueva fecha simulando sin el gasto
  -- Esto es equivalente a sumar el monto al ahorro (quitar el gasto)
  select e2.completion_status, e2.completion_date
    into v_new_status, v_new_date
  from public.get_estimated_completion_date(
    p_account_id, p_month_start, p_month_end, p_today,
    p_target_minor - v_expense_amount  -- target efectivo menor
  ) e2;

  -- Calcular diferencia en días
  if v_base_status = 'completed_today' then
    return 0; -- ya cumplido, el gasto no lo retrasa
  end if;

  if v_new_status = 'completed_today' and v_base_status != 'completed_today' then
    -- Sin el gasto ya estarías cumplido
    if v_base_date is not null then
      return (v_base_date - p_today)::int;
    else
      return 30; -- caso especial: te hace llegar vs no llegar
    end if;
  end if;

  if v_base_date is not null and v_new_date is not null then
    return (v_base_date - v_new_date)::int;
  end if;

  if v_base_status = 'not_achievable' and v_new_status = 'completion_date' then
    return 30; -- "te hace llegar este mes"
  end if;

  return 0;
end;
$$;


-- 5) RPC V2: candidatos a ahorro con métricas V2
create or replace function public.get_savings_candidates_v2(
  p_account_id uuid,
  p_month_start date,
  p_month_end date,
  p_today date,
  p_target_minor bigint,
  p_hist_months int default 3,
  p_score_min int default 4,
  p_high_impact_top_n int default 5,
  p_high_impact_gap_pct numeric default 0.10,
  p_repeated_min_count int default 3,
  p_spike_ratio numeric default 1.30
)
returns jsonb
language plpgsql
stable
as $$
declare
  v_income_real bigint;
  v_expense_real bigint;
  v_income_pending bigint;
  v_expense_pending bigint;
  v_saved_real bigint;
  v_saved_total bigint;
  v_completion_status text;
  v_completion_date date;
  v_month_status text;
  v_gap bigint;
  v_days_elapsed int;
  v_days_in_month int;
  v_remaining_days int;
  -- Legacy fields para compatibilidad
  v_expected bigint;
  v_delta bigint;
  v_required_daily bigint;
begin
  -- Obtener resumen V2
  select s.income_real_minor, s.expense_real_minor, s.income_pending_minor,
         s.expense_pending_minor, s.saved_real_minor, s.saved_total_minor
    into v_income_real, v_expense_real, v_income_pending,
         v_expense_pending, v_saved_real, v_saved_total
  from public.get_month_saving_summary_v2(p_account_id, p_month_start, p_month_end, p_today) s;

  -- Obtener fecha estimada
  select e.completion_status, e.completion_date
    into v_completion_status, v_completion_date
  from public.get_estimated_completion_date(
    p_account_id, p_month_start, p_month_end, p_today, p_target_minor
  ) e;

  -- Calcular días
  v_days_elapsed := (p_today - p_month_start) + 1;
  if v_days_elapsed < 1 then v_days_elapsed := 1; end if;

  v_days_in_month := (p_month_end - p_month_start);
  if v_days_in_month < 1 then v_days_in_month := 30; end if;

  v_remaining_days := (p_month_end - p_today);
  if v_remaining_days < 0 then v_remaining_days := 0; end if;

  -- Calcular estado del mes
  v_month_status := public.get_month_status(
    v_saved_total, p_target_minor, v_days_elapsed, v_days_in_month,
    v_completion_status, v_completion_date, p_month_end
  );

  -- Gap (usando saved_total que incluye pendientes)
  v_gap := p_target_minor - v_saved_total;
  if v_gap < 0 then v_gap := 0; end if;

  -- Legacy: esperado proporcional (para compatibilidad)
  v_expected := round((p_target_minor::numeric * v_days_elapsed::numeric) / v_days_in_month::numeric)::bigint;
  v_delta := v_saved_real - v_expected;

  if v_remaining_days = 0 then
    v_required_daily := 0;
  else
    v_required_daily := ceil((v_gap::numeric) / v_remaining_days::numeric)::bigint;
  end if;

  -- Construir respuesta con métricas V2 + legacy
  return jsonb_build_object(
    'summary', jsonb_build_object(
      -- Métricas V2 (nuevas)
      'incomeRealMinor', v_income_real,
      'expenseRealMinor', v_expense_real,
      'incomePendingMinor', v_income_pending,
      'expensePendingMinor', v_expense_pending,
      'savedRealMinor', v_saved_real,
      'savedTotalMinor', v_saved_total,
      'completionStatus', v_completion_status,
      'estimatedCompletionDate', v_completion_date,
      'monthStatus', v_month_status,
      -- Legacy (mantener para compatibilidad)
      'incomeMinor', v_income_real,
      'expenseMinor', v_expense_real,
      'savedMinor', v_saved_real,
      'targetMinor', p_target_minor,
      'gapToGoalMinor', v_gap,
      'expectedSavedByTodayMinor', v_expected,
      'deltaVsExpectedMinor', v_delta,
      'requiredDailyFromTodayMinor', v_required_daily,
      'monthStart', p_month_start,
      'monthEnd', p_month_end,
      'today', p_today
    ),
    'sections', public.build_savings_sections_v2(
      p_account_id, p_month_start, p_month_end, p_today,
      p_target_minor, v_saved_total, v_completion_status, v_completion_date,
      p_hist_months, p_score_min, p_high_impact_top_n, p_high_impact_gap_pct,
      p_repeated_min_count, p_spike_ratio
    )
  );
end;
$$;


-- 5.1 Helper: build_savings_sections_v2 (incluye delay_days)
create or replace function public.build_savings_sections_v2(
  p_account_id uuid,
  p_month_start date,
  p_month_end date,
  p_today date,
  p_target_minor bigint,
  p_saved_minor bigint,
  p_completion_status text,
  p_completion_date date,
  p_hist_months int,
  p_score_min int,
  p_high_impact_top_n int,
  p_high_impact_gap_pct numeric,
  p_repeated_min_count int,
  p_spike_ratio numeric
)
returns jsonb
language sql
stable
as $$
with
gap as (
  select greatest(1::bigint, (p_target_minor - p_saved_minor)) as gap_minor
),
month_tx as (
  select
    t.id,
    t.date,
    t.amount_base_minor,
    t.currency,
    t.merchant,
    t.merchant_norm,
    t.category_id
  from public.transactions t
  where t.account_id = p_account_id
    and t.type = 'expense'
    and t.date >= p_month_start
    and t.date < p_month_end
    and t.date <= p_today
),
month_total as (
  select coalesce(sum(amount_base_minor),0)::bigint as month_spend_minor
  from month_tx
),
repeat_merchant as (
  select merchant_norm, count(*)::int as m_cnt, sum(amount_base_minor)::bigint as m_sum
  from month_tx
  where merchant_norm <> ''
  group by 1
),
repeat_category as (
  select category_id, count(*)::int as c_cnt, sum(amount_base_minor)::bigint as c_sum
  from month_tx
  where merchant_norm = '' and category_id is not null
  group by 1
),
repeat_source as (
  select
    'merchant'::text as kind,
    r.merchant_norm as group_key,
    r.m_cnt as group_count,
    r.m_sum as group_sum,
    null::uuid as category_id
  from repeat_merchant r
  where r.m_cnt >= p_repeated_min_count

  union all

  select
    'category'::text as kind,
    ('__category__:' || c.category_id::text) as group_key,
    c.c_cnt as group_count,
    c.c_sum as group_sum,
    c.category_id
  from repeat_category c
  where c.c_cnt >= 5
    and not exists (
      select 1 from repeat_merchant r2 where r2.m_cnt >= p_repeated_min_count
    )
),
hist_3m as (
  select merchant_norm, count(*)::int as h_cnt
  from (
    select public.normalize_merchant(t.merchant) as merchant_norm
    from public.transactions t
    where t.account_id = p_account_id
      and t.type = 'expense'
      and t.date >= (p_month_start - make_interval(months => p_hist_months))
      and t.date < p_month_start
  ) s
  where merchant_norm <> ''
  group by 1
),
flex_cats as (
  select unnest(public.get_flex_category_ids(p_account_id)) as category_id
),
cat_month as (
  select category_id, sum(amount_base_minor)::bigint as month_cat_minor
  from month_tx
  group by 1
),
cat_hist as (
  select category_id, avg(month_sum)::numeric as avg_3m_cat_minor
  from (
    select date_trunc('month', t.date)::date as m, t.category_id, sum(t.amount_base_minor)::bigint as month_sum
    from public.transactions t
    where t.account_id = p_account_id
      and t.type = 'expense'
      and t.date >= (p_month_start - make_interval(months => p_hist_months))
      and t.date < p_month_start
    group by 1,2
  ) z
  group by 1
),
cat_delta as (
  select
    cm.category_id,
    cm.month_cat_minor,
    coalesce(ch.avg_3m_cat_minor,0) as avg_3m_cat_minor,
    case
      when coalesce(ch.avg_3m_cat_minor,0) > 0 then (cm.month_cat_minor::numeric / ch.avg_3m_cat_minor)
      else null
    end as ratio_vs_avg
  from cat_month cm
  left join cat_hist ch using(category_id)
),
scored as (
  select
    m.*,
    (coalesce(h.h_cnt,0)=0) as is_non_recurrent,
    (coalesce(r.m_cnt,0) >= p_repeated_min_count) as is_repeated,
    (m.category_id in (select category_id from flex_cats)) as is_flex_cat,
    (coalesce(cd.ratio_vs_avg,1) >= p_spike_ratio) as is_cat_spike,
    least(1::numeric, (m.amount_base_minor::numeric / (select gap_minor from gap))) as gap_contribution_pct
  from month_tx m
  left join repeat_merchant r using(merchant_norm)
  left join hist_3m h using(merchant_norm)
  left join cat_delta cd using(category_id)
),
scored2 as (
  select
    s.*,
    (
      (case when s.is_non_recurrent then 3 else 0 end) +
      (case when s.is_flex_cat then 2 else 0 end) +
      (case when s.is_repeated then 1 else 0 end) +
      (case when s.is_cat_spike then 2 else 0 end)
    )::int as save_score,
    array_remove(array[
      case when s.gap_contribution_pct >= p_high_impact_gap_pct then 'HIGH_IMPACT' end,
      case when s.is_flex_cat then 'FLEX_CATEGORY' end,
      case when s.is_non_recurrent then 'NON_RECURRENT' end,
      case when s.is_repeated then 'REPEATED_MERCHANT' end,
      case when s.is_cat_spike then 'CATEGORY_SPIKE' end
    ]::text[], null) as reason_codes,
    -- Calcular delay_days para cada transacción
    public.get_expense_delay_days(
      p_account_id, p_month_start, p_month_end, p_today, p_target_minor, s.id
    ) as delay_days
  from scored s
),
high_impact_ids as (
  select id
  from scored2
  order by gap_contribution_pct desc, amount_base_minor desc, date desc
  limit p_high_impact_top_n
),
high_impact as (
  select jsonb_agg(jsonb_build_object(
    'id', s.id,
    'date', s.date,
    'amountBaseMinor', s.amount_base_minor,
    'currency', s.currency,
    'merchant', s.merchant,
    'merchantNorm', s.merchant_norm,
    'categoryId', s.category_id,
    'gapContributionPct', s.gap_contribution_pct,
    'saveScore', s.save_score,
    'reasonCodes', s.reason_codes,
    'delayDays', s.delay_days
  ) order by s.delay_days desc nulls last, s.gap_contribution_pct desc, s.amount_base_minor desc) as items
  from scored2 s
  where s.id in (select id from high_impact_ids)
),
repeated as (
  select jsonb_agg(jsonb_build_object(
    'merchantNorm', rs.group_key,
    'count', rs.group_count,
    'sumBaseMinor', rs.group_sum,
    'topTx', (
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'date', t.date,
        'amountBaseMinor', t.amount_base_minor,
        'currency', t.currency,
        'merchant', t.merchant,
        'categoryId', t.category_id
      ) order by t.amount_base_minor desc)
      from (
        select *
        from month_tx t
        where (
          (rs.kind = 'merchant' and t.merchant_norm = rs.group_key)
          or (
            rs.kind = 'category'
            and t.category_id = rs.category_id
            and t.merchant_norm = ''
          )
        )
        order by t.amount_base_minor desc
        limit 3
      ) t
    ),
    'reasonCodes', jsonb_build_array('REPEATED_MERCHANT')
  ) order by rs.group_sum desc, rs.group_count desc) as items
  from repeat_source rs
),
unusual as (
  select jsonb_agg(jsonb_build_object(
    'id', s.id,
    'date', s.date,
    'amountBaseMinor', s.amount_base_minor,
    'currency', s.currency,
    'merchant', s.merchant,
    'merchantNorm', s.merchant_norm,
    'categoryId', s.category_id,
    'gapContributionPct', s.gap_contribution_pct,
    'saveScore', s.save_score,
    'reasonCodes', s.reason_codes,
    'delayDays', s.delay_days
  ) order by s.delay_days desc nulls last, s.save_score desc, s.amount_base_minor desc, s.date desc) as items
  from scored2 s
  where s.id not in (select id from high_impact_ids)
    and (s.is_non_recurrent or s.is_cat_spike)
    and s.save_score >= p_score_min
  limit 6
)
select jsonb_build_array(
  jsonb_build_object('kind','HIGH_IMPACT','items', coalesce((select items from high_impact), '[]'::jsonb)),
  jsonb_build_object('kind','REPEATED','items', coalesce((select items from repeated), '[]'::jsonb)),
  jsonb_build_object('kind','UNUSUAL','items', coalesce((select items from unusual), '[]'::jsonb))
);
$$;
