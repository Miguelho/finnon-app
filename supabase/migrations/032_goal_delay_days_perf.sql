-- Perf: avoid per-transaction calls to get_expense_delay_days() inside
-- build_savings_sections_v2. We compute the future projection once and derive
-- delay_days with a lightweight lateral lookup over <= 31 projected days.

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
base_projection as (
  select s.saved_real_minor
  from public.get_month_saving_summary_v2(
    p_account_id,
    p_month_start,
    p_month_end,
    p_today
  ) s
),
future_day_delta as (
  select
    t.date as day_date,
    coalesce(sum(
      case
        when t.type = 'income' then t.amount_base_minor
        when t.type = 'expense' then -t.amount_base_minor
        else 0
      end
    ), 0)::bigint as delta_minor
  from public.transactions t
  where t.account_id = p_account_id
    and t.date >= p_month_start
    and t.date < p_month_end
    and t.date > p_today
  group by 1
),
future_days as (
  select d::date as day_date
  from generate_series(
    p_today + 1,
    p_month_end - 1,
    interval '1 day'
  ) d
),
future_cumulative as (
  select
    fd.day_date,
    (
      bp.saved_real_minor
      + sum(coalesce(fdd.delta_minor, 0))
          over (
            order by fd.day_date
            rows between unbounded preceding and current row
          )
    )::bigint as projected_saved_minor
  from future_days fd
  left join future_day_delta fdd using(day_date)
  cross join base_projection bp
),
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
    t.category_id,
    t.recurring_item_id
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
repeat_recurring as (
  select recurring_item_id, count(*)::int as r_cnt, sum(amount_base_minor)::bigint as r_sum
  from month_tx
  where recurring_item_id is not null
  group by 1
),
repeat_source as (
  select
    'recurring'::text as kind,
    r.recurring_item_id::text as group_key,
    r.r_cnt as group_count,
    r.r_sum as group_sum,
    null::uuid as category_id
  from repeat_recurring r

  union all

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
    (coalesce(h.h_cnt,0)=0 and m.recurring_item_id is null) as is_non_recurrent,
    (
      (coalesce(r.m_cnt,0) >= p_repeated_min_count)
      or m.recurring_item_id is not null
    ) as is_repeated,
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
    case
      when s.amount_base_minor is null then null
      when p_completion_status = 'completed_today' then 0
      when bp.saved_real_minor >= (p_target_minor - s.amount_base_minor) then
        case
          when p_completion_date is not null then (p_completion_date - p_today)::int
          else 30
        end
      when p_completion_date is not null and np.new_completion_date is not null then
        (p_completion_date - np.new_completion_date)::int
      when p_completion_status = 'not_achievable' and np.new_completion_date is not null then
        30
      else 0
    end as delay_days
  from scored s
  cross join base_projection bp
  left join lateral (
    select min(fc.day_date) as new_completion_date
    from future_cumulative fc
    where fc.projected_saved_minor >= (p_target_minor - s.amount_base_minor)
  ) np on true
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
          (rs.kind = 'recurring' and t.recurring_item_id::text = rs.group_key)
          or (rs.kind = 'merchant' and t.merchant_norm = rs.group_key)
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

