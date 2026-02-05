-- 023_goal_saving_mode.sql

-- 1.1 Función estable para normalizar merchant (v1 simple)
create or replace function public.normalize_merchant(p_merchant text)
returns text
language sql
immutable
as $$
  select lower(trim(coalesce(p_merchant, '')))
$$;

-- 1.2 Añadir columna generada (si no existe)
alter table public.transactions
add column if not exists merchant_norm text
generated always as (public.normalize_merchant(merchant)) stored;

-- 1.3 Índices recomendados para queries
create index if not exists idx_transactions_account_date
  on public.transactions (account_id, date);

create index if not exists idx_transactions_account_type_date
  on public.transactions (account_id, type, date);

create index if not exists idx_transactions_account_merchantnorm_date
  on public.transactions (account_id, merchant_norm, date)
  where merchant_norm <> '';

create index if not exists idx_transactions_account_category_date
  on public.transactions (account_id, category_id, date);

-- 2.1 accounts.settings (jsonb) si no existe
alter table public.accounts
add column if not exists settings jsonb not null default '{}'::jsonb;

-- 2.2 Helper: leer lista de categorías ajustables (flex) desde settings
create or replace function public.get_flex_category_ids(p_account_id uuid)
returns uuid[]
language sql
stable
as $$
  select coalesce(
    array(
      select (jsonb_array_elements_text(a.settings->'goal'->'flex_category_ids'))::uuid
    ),
    '{}'::uuid[]
  )
  from public.accounts a
  where a.id = p_account_id
$$;

-- 3) Resumen de ahorro del mes (real: date <= today)
create or replace function public.get_month_saving_summary(
  p_account_id uuid,
  p_month_start date,
  p_month_end date,
  p_today date
)
returns table (
  income_minor bigint,
  expense_minor bigint,
  saved_minor bigint
)
language sql
stable
as $$
  with base as (
    select *
    from public.transactions t
    where t.account_id = p_account_id
      and t.date >= p_month_start
      and t.date < p_month_end
      and t.date <= p_today
  ),
  inc as (
    select coalesce(sum(amount_base_minor),0)::bigint as v
    from base where type = 'income'
  ),
  exp as (
    select coalesce(sum(amount_base_minor),0)::bigint as v
    from base where type = 'expense'
  )
  select inc.v as income_minor,
         exp.v as expense_minor,
         (inc.v - exp.v)::bigint as saved_minor
  from inc, exp;
$$;

-- 4) RPC: candidatos a ahorro por secciones
create or replace function public.get_savings_candidates(
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
  v_income bigint;
  v_expense bigint;
  v_saved bigint;
  v_gap bigint;
  v_days_elapsed int;
  v_days_in_month int;
  v_remaining_days int;
  v_expected bigint;
  v_delta bigint;
  v_required_daily bigint;
begin
  -- summary
  select income_minor, expense_minor, saved_minor
    into v_income, v_expense, v_saved
  from public.get_month_saving_summary(p_account_id, p_month_start, p_month_end, p_today);

  v_gap := p_target_minor - v_saved;
  if v_gap < 0 then v_gap := 0; end if;

  v_days_elapsed := (p_today - p_month_start) + 1;
  if v_days_elapsed < 1 then v_days_elapsed := 1; end if;

  v_days_in_month := (p_month_end - p_month_start);
  if v_days_in_month < 1 then v_days_in_month := 30; end if;

  v_remaining_days := (p_month_end - p_today);
  if v_remaining_days < 0 then v_remaining_days := 0; end if;

  -- esperado proporcional (redondeo)
  v_expected := round((p_target_minor::numeric * v_days_elapsed::numeric) / v_days_in_month::numeric)::bigint;
  v_delta := v_saved - v_expected;

  if v_remaining_days = 0 then
    v_required_daily := 0;
  else
    v_required_daily := ceil((v_gap::numeric) / v_remaining_days::numeric)::bigint;
  end if;

  -- Base de gastos reales del mes
  return jsonb_build_object(
    'summary', jsonb_build_object(
      'incomeMinor', v_income,
      'expenseMinor', v_expense,
      'savedMinor', v_saved,
      'targetMinor', p_target_minor,
      'gapToGoalMinor', v_gap,
      'expectedSavedByTodayMinor', v_expected,
      'deltaVsExpectedMinor', v_delta,
      'requiredDailyFromTodayMinor', v_required_daily,
      'monthStart', p_month_start,
      'monthEnd', p_month_end,
      'today', p_today
    ),
    'sections', public.build_savings_sections(
      p_account_id, p_month_start, p_month_end, p_today,
      p_target_minor, v_saved,
      p_hist_months, p_score_min, p_high_impact_top_n, p_high_impact_gap_pct,
      p_repeated_min_count, p_spike_ratio
    )
  );
end;
$$;

-- 4.1 Helper function build_savings_sections
create or replace function public.build_savings_sections(
  p_account_id uuid,
  p_month_start date,
  p_month_end date,
  p_today date,
  p_target_minor bigint,
  p_saved_minor bigint,
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
    -- high impact vs gap (y fallback por top N)
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
    ]::text[], null) as reason_codes
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
    'reasonCodes', s.reason_codes
  ) order by s.gap_contribution_pct desc, s.amount_base_minor desc) as items
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
    'reasonCodes', s.reason_codes
  ) order by s.save_score desc, s.amount_base_minor desc, s.date desc) as items
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
