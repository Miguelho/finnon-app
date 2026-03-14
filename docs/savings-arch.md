# Finnon — Savings Allocation Engine (Architecture Prompt)

## Objective

Implement a robust backend architecture for Finnon’s savings allocation engine.

The system must:

1. Separate:
   - monthly cashflow,
   - savings generated,
   - savings assigned to projects.
2. Guarantee that assigned savings never exceeds generated savings, except in explicit `overallocated` states caused by retroactive cashflow deterioration over already confirmed contributions.
3. Support:
   - manual contributions,
   - monthly contribution rules,
   - automatic rebalancing of flexible contributions.
4. Ensure deterministic behavior across:
   - web,
   - mobile,
   - concurrent edits,
   - retryable jobs.
5. Keep backend as source of truth.

The implementation must be mathematically coherent, auditable, and understandable in product UX.

---

## Product Semantics

### Monthly result

The monthly result is:

```text
resultado_mes = ingresos_mes - gastos_mes

This is not savings.

It represents what happened during the month.

Suggested UI label:

Resultado del mes

Savings generated

Savings generated is the positive part of the monthly result:

ahorro_generado = max(0, resultado_mes)

This represents the maximum amount that could be reserved this month.

Contributions

Project contributions represent internal reservation of savings, not movement of money between bank accounts.

There are two types:

confirmed

flexible

confirmed

Confirmed contributions are not automatically modified by the system.

Typical example:

manual contribution created by the user

flexible

Flexible contributions may be automatically reduced if cashflow worsens.

Typical examples:

monthly automatic contribution rules

future suggestion-based allocations

Savings assigned
ahorro_asignado_total =
  aportaciones_confirmadas +
  aportaciones_flexibles
Available savings
ahorro_disponible = max(0, ahorro_generado - ahorro_asignado_total)
Overallocation

If already confirmed contributions end up exceeding generated savings due to retroactive edits or new expenses, the month must enter an explicit overallocation state:

overallocated_minor = max(0, ahorro_asignado_total - ahorro_generado)

This must not be hidden.

Flexible contributions may be rebalanced automatically. Confirmed ones must not.

Core Business Rules
Rule 1

resultado_mes must never be called savings.

Rule 2

New contributions cannot consume more than currently available savings.

Rule 3

Manual contributions are confirmed by default.

Rule 4

Monthly rule contributions are flexible.

Rule 5

If flexible contributions exceed what is allowed, they must be rebalanced automatically.

Rule 6

Rebalancing must be deterministic and server-side.

Rule 7

Closed months are immutable by default.

Rule 8

If confirmed contributions exceed generated savings after transaction changes, the month must show an overallocated state. Do not auto-reduce confirmed contributions.

Rule 9

Monthly rule execution must be idempotent.

Rule 10

All month-affecting writes must happen inside a single transaction boundary.

Architecture Decisions
Backend as source of truth

Clients must not decide final effective contribution amounts.

Clients may:

create/update/delete transactions,

request manual contributions,

manage monthly rules,

close a month.

Backend must:

recalculate monthly state,

enforce constraints,

rebalance flexible contributions,

persist final effective values.

Command / Projection split

Implement a command-driven architecture.

Command side

create transaction

update transaction

delete transaction

create manual contribution

apply monthly rules for month

close month

Projection side

monthly financial state

project progress

adjustment status

available savings

overallocated state

Requested vs Effective

For rule-based and flexible contributions, persist both:

requested_amount_minor

effective_amount_minor

This is mandatory for:

auditability,

UX explanation,

debugging,

deterministic recalculation.

Database Schema
1. transactions
create table transactions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  user_id uuid not null,
  occurred_on date not null,
  month_key date not null,
  type text not null check (type in ('income', 'expense')),
  amount_minor bigint not null check (amount_minor > 0),
  currency_code text not null default 'EUR',
  project_id uuid null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz null
);

Notes:

month_key is the first day of the month, e.g. 2026-03-01

use soft delete to preserve auditability and allow recalculation

2. projects
create table projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  name text not null,
  target_minor bigint not null check (target_minor >= 0),
  is_archived boolean not null default false,
  priority smallint null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
3. monthly_contribution_rules
create table monthly_contribution_rules (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  project_id uuid not null references projects(id),
  requested_amount_minor bigint not null check (requested_amount_minor > 0),
  is_active boolean not null default true,
  starts_on date not null,
  ends_on date null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

This stores user intent.

4. project_contributions
create table project_contributions (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  project_id uuid not null references projects(id),
  month_key date not null,

  kind text not null check (kind in ('confirmed', 'flexible')),
  origin text not null check (origin in ('manual', 'monthly_rule', 'suggestion')),

  requested_amount_minor bigint not null check (requested_amount_minor >= 0),
  effective_amount_minor bigint not null check (effective_amount_minor >= 0),

  source_rule_id uuid null references monthly_contribution_rules(id),
  is_adjusted boolean not null default false,
  adjustment_reason text null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

Create idempotency protection for monthly rules:

create unique index uq_project_contributions_monthly_rule
on project_contributions(project_id, month_key, source_rule_id)
where source_rule_id is not null;

Do not enforce uniqueness for manual contributions.

5. monthly_financial_states
create table monthly_financial_states (
  household_id uuid not null,
  month_key date not null,

  incomes_minor bigint not null default 0,
  expenses_minor bigint not null default 0,
  result_minor bigint not null default 0,
  savings_generated_minor bigint not null default 0,

  confirmed_contributions_minor bigint not null default 0,
  flexible_contributions_minor bigint not null default 0,
  assigned_total_minor bigint not null default 0,

  available_savings_minor bigint not null default 0,
  overallocated_minor bigint not null default 0,

  is_closed boolean not null default false,
  closed_at timestamptz null,

  recalculated_at timestamptz not null default now(),

  primary key (household_id, month_key)
);
6. monthly_snapshots
create table monthly_snapshots (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null,
  month_key date not null,

  incomes_minor bigint not null,
  expenses_minor bigint not null,
  result_minor bigint not null,
  savings_generated_minor bigint not null,

  confirmed_contributions_minor bigint not null,
  flexible_contributions_minor bigint not null,
  assigned_total_minor bigint not null,
  available_savings_minor bigint not null,
  overallocated_minor bigint not null,

  snapshot_json jsonb not null,
  created_at timestamptz not null default now(),

  unique (household_id, month_key)
);
Derived Formulas
incomes_minor = sum(income transactions)
expenses_minor = sum(expense transactions)

result_minor = incomes_minor - expenses_minor

savings_generated_minor = max(0, result_minor)

confirmed_contributions_minor =
  sum(effective_amount_minor where kind = 'confirmed')

flexible_contributions_minor =
  sum(effective_amount_minor where kind = 'flexible')

assigned_total_minor =
  confirmed_contributions_minor + flexible_contributions_minor

available_savings_minor =
  max(0, savings_generated_minor - assigned_total_minor)

overallocated_minor =
  max(0, assigned_total_minor - savings_generated_minor)
Rebalance Algorithm
Goal

Flexible contributions must fit within the portion of savings not already consumed by confirmed contributions.

allowed_for_flexible =
  max(0, savings_generated_minor - confirmed_contributions_minor)

If:

flexible_contributions_minor <= allowed_for_flexible

do nothing.

If not, rebalance flexible contributions proportionally.

Proportional rebalance
ratio = allowed_for_flexible / current_flexible_total

For each flexible contribution except the last:

new_effective_amount = floor(old_effective_amount * ratio)

For the last one:

new_effective_amount = allowed_for_flexible - sum(previous_new_amounts)

Use a stable deterministic ordering:

created_at asc

id asc

Set:

is_adjusted = true

adjustment_reason = 'rebalance_after_cashflow_change'

Recommended RPC / Service Functions

Implement these as Supabase RPC functions, service-layer commands, or hybrid orchestration with SQL functions.

1. recalculate_month_financial_state(household_id, month_key)

Responsibilities:

aggregate transactions,

aggregate contributions,

compute derived values,

upsert monthly_financial_states.

2. rebalance_month_flexible_contributions(household_id, month_key)

Responsibilities:

lock month-related flexible contributions,

compute allowed flexible budget,

rebalance proportionally,

persist adjusted effective_amount_minor,

mark adjustment flags.

3. sync_month_after_transaction_change(household_id, month_key)

Responsibilities:

lock month

recalculate state

rebalance flexible contributions

recalculate final state

return updated projection

This is the main post-transaction reconciliation entrypoint.

4. create_manual_contribution(household_id, month_key, project_id, amount_minor)

Responsibilities:

lock month

recalculate latest state

validate amount_minor <= available_savings_minor

insert confirmed contribution

recalculate final state

return month projection

If invalid, reject and return maximum allowed amount.

5. apply_monthly_rules_for_month(household_id, month_key)

Responsibilities:

lock month

load active rules for that month

materialize missing flexible contributions idempotently

set:

requested_amount_minor = rule amount

effective_amount_minor = rule amount

rebalance flexible contributions

recalculate final state

return projection + applied rows

6. close_month(household_id, month_key)

Responsibilities:

lock month

ensure month is not already closed

rebalance one final time

recalculate final state

persist monthly_snapshots

mark month closed

optionally convert remaining flexible contributions to confirmed

Preferred behavior:

closed months are immutable,

convert final flexible contributions to confirmed historical values.

Concurrency Strategy
Month-level lock

All operations affecting a month must serialize on:

household_id

month_key

Use advisory locks or row-level locks.

Recommended approach:

advisory lock if monthly_financial_states row may not exist yet.

The goal is to prevent:

mobile/web race conditions,

transaction edits racing monthly rule execution,

duplicate rebalance flows.

Idempotency

Monthly rules must be idempotent.

Use:

unique index on (project_id, month_key, source_rule_id) where source_rule_id is not null

This is required so retries do not duplicate contributions.

Closed month protection

Writes affecting a closed month must be rejected unless explicit reopen flow exists.

Do not silently mutate a closed month.

Command Flows
Flow A — Transaction Created / Updated / Deleted

persist transaction mutation

identify affected household_id + month_key

call sync_month_after_transaction_change

return updated month projection

Flow B — Manual Contribution

call create_manual_contribution

backend validates against latest available savings

persist confirmed contribution if valid

return updated month projection

Flow C — Monthly Rules Execution

call apply_monthly_rules_for_month

materialize flexible contributions

rebalance if needed

return updated projection

Flow D — Month Close

call close_month

freeze final month state

persist snapshot

return final projection + snapshot summary

UI Projection Requirements
Home

Expose:

result_minor

assigned_total_minor

available_savings_minor

overallocated_minor

Suggested labels:

Resultado del mes

Reservado para objetivos

Disponible para asignar

If overallocated_minor > 0, show warning state.

Project Detail

Expose:

target amount

cumulative contributions

current month requested amount

current month effective amount

adjustment status

This is why requested vs effective must be persisted separately.

Adjustment Messaging

The API should support UX explanations such as:

requested monthly contribution: 100 €

effective contribution this month: 64 €

reason: savings decreased after recent expenses

At minimum expose:

requested_amount_minor

effective_amount_minor

is_adjusted

adjustment_reason

Acceptance Criteria

Implementation is accepted when all of the following are true:

Monthly result, generated savings, and assigned savings are modeled separately.

Backend is the source of truth for final contribution amounts.

Monthly rules create flexible contributions and are idempotent.

Flexible contributions are rebalanced proportionally and deterministically.

Manual contributions are validated against current available savings.

Confirmed contributions are never auto-reduced.

Retroactive transaction changes can produce explicit overallocated states.

Monthly state is recalculated consistently after any month-affecting mutation.

Closed months cannot be silently mutated.

UI can render clear month summaries and explain adjusted contributions.

Implementation Notes

Prefer integer minor units everywhere.

Keep rebalancing deterministic.

Do not let frontend compute authoritative effective values.

Do not mix project funding with transaction categorization.

Treat monthly_financial_states as a projection table, not the source of truth.

Persist snapshots for historical trust and future debugging.


Hay una grieta de diseño que no deberías ignorar: si las contribuciones manuales son `confirmed` y luego el usuario mete gastos retroactivos, vas a tener `overallocated`. Eso no es un bug; es una consecuencia lógica del modelo. Si tu agente de código intenta “arreglarlo” ocultándolo, te va a degradar la coherencia del producto.

Puedo darte ahora la siguiente capa práctica: un primer borrador de migraciones SQL + funciones RPC en Postgres/Supabase.