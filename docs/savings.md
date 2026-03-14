
# Finnon — Savings Allocation Engine

## Objective

Implement a coherent savings allocation model for Finnon that:

1. Separates **monthly cashflow** from **actual savings allocation**.
2. Ensures users **cannot allocate more savings than they have generated**.
3. Supports **manual contributions** and **monthly automatic contributions**.
4. Automatically **adjusts flexible contributions when savings decrease**.
5. Suggests allocating unused savings without automatically moving money.

The system must remain **mathematically consistent**, **predictable for users**, and **simple to explain in the UI**.

---

# Core Concepts

Finnon distinguishes three layers:

1. **Cashflow (what happened)**
2. **Savings generated (what could be saved)**
3. **Savings assigned (what the user reserved)**

These concepts must never be conflated.

---

# Domain Definitions

### Monthly Result

Net financial outcome of the month.

```
resultado_mes = ingresos_mes − gastos_mes
```

This is **not savings**.

UI label example:

> Resultado del mes

---

### Savings Generated

Savings capacity created by positive cashflow.

```
ahorro_generado = max(0, resultado_mes)
```

If the month is negative, no savings are generated.

---

### Confirmed Contributions

Contributions that are **fixed and cannot be adjusted automatically**.

Examples:

* manual user contributions
* contributions confirmed at monthly close

---

### Flexible Contributions

Adjustable contributions used by the system to enforce savings constraints.

Examples:

* monthly automatic contributions
* suggested allocations

Flexible contributions may be **automatically reduced**.

---

### Total Assigned Savings

```
ahorro_asignado_total =
    aportaciones_confirmadas +
    aportaciones_flexibles
```

---

### Available Savings

Savings that remain unallocated.

```
ahorro_disponible =
    ahorro_generado − ahorro_asignado_total
```

Constraint:

```
ahorro_disponible >= 0
```

---

# Global Business Rule

The system must guarantee:

```
aportaciones_confirmadas +
aportaciones_flexibles
<= ahorro_generado
```

If the constraint is violated, **flexible contributions must be reduced automatically**.

Confirmed contributions are never altered automatically.

---

# Contribution Types

Each contribution must include:

```
kind:
  - confirmed
  - flexible

origin:
  - manual
  - monthly_rule
  - suggestion
```

Recommended fields:

```
Contribution
-----------
id
project_id
month_id
amount_minor
original_amount_minor
kind
origin
is_adjusted
created_at
updated_at
```

---

# Contribution Adjustment Policy

When the system must reduce contributions, it applies:

### Proportional Reduction

Flexible contributions are scaled proportionally.

Example:

| Project | Flexible Contribution |
| ------- | --------------------- |
| A       | 200                   |
| B       | 100                   |

Total flexible = 300

Allowed = 240

Reduction ratio:

```
ratio = allowed / current_total
```

New contributions:

```
A = 200 * ratio
B = 100 * ratio
```

Rounding correction must be applied on the last contribution.

---

# Events

## Event: Transaction Created or Updated

Steps:

1. Recalculate monthly totals
2. Recalculate savings generated
3. Check constraint
4. Rebalance flexible contributions if necessary
5. Emit UI signals if adjustments occurred

---

## Event: Manual Contribution

User attempts to allocate savings manually.

Validation:

```
amount <= ahorro_disponible
```

If valid:

```
create contribution
kind = confirmed
origin = manual
```

If invalid:

```
reject contribution
show maximum possible amount
```

---

## Event: Monthly Contribution Rule

When a scheduled monthly rule fires:

1. Create a **flexible contribution**
2. Recalculate totals
3. Apply proportional reduction if necessary

---

## Event: Month Closing

When the user confirms monthly closing:

1. Convert all flexible contributions to confirmed
2. Persist monthly snapshot
3. Freeze values

---

# Core Formulas

```
ingresos_mes = Σ income transactions
gastos_mes = Σ expense transactions

resultado_mes = ingresos_mes − gastos_mes

ahorro_generado = max(0, resultado_mes)

aportaciones_confirmadas =
    Σ contributions where kind = confirmed

aportaciones_flexibles =
    Σ contributions where kind = flexible

ahorro_asignado_total =
    aportaciones_confirmadas +
    aportaciones_flexibles

ahorro_disponible =
    ahorro_generado − ahorro_asignado_total
```

---

# Pseudocode

## Month State

```python
class MonthState:

    incomes: int
    expenses: int
    contributions: List[Contribution]

    def result(self):
        return self.incomes - self.expenses

    def savings_generated(self):
        return max(0, self.result())

    def confirmed_total(self):
        return sum(
            c.amount for c in self.contributions
            if c.kind == "confirmed"
        )

    def flexible_total(self):
        return sum(
            c.amount for c in self.contributions
            if c.kind == "flexible"
        )

    def assigned_total(self):
        return self.confirmed_total() + self.flexible_total()

    def available_savings(self):
        return self.savings_generated() - self.assigned_total()
```

---

## Flexible Rebalancing

```python
def rebalance_flexible_contributions(state):

    confirmed = [c for c in state.contributions if c.kind == "confirmed"]
    flexible = [c for c in state.contributions if c.kind == "flexible"]

    allowed_for_flexible = max(
        0,
        state.savings_generated() - state.confirmed_total()
    )

    current_total = sum(c.amount for c in flexible)

    if current_total <= allowed_for_flexible:
        return confirmed + flexible

    ratio = allowed_for_flexible / current_total

    adjusted = []
    assigned = 0

    for i, c in enumerate(flexible):

        if i < len(flexible) - 1:
            new_amount = int(c.amount * ratio)
            assigned += new_amount
        else:
            new_amount = allowed_for_flexible - assigned

        adjusted.append(
            Contribution(
                project_id=c.project_id,
                amount=max(0, new_amount),
                kind="flexible",
                origin=c.origin,
                is_adjusted=True
            )
        )

    return confirmed + adjusted
```

---

# UX Messages

### Savings available

> Te han sobrado 120 € este mes. Puedes asignarlos a tus objetivos.

---

### Contributions adjusted

> Tus gastos recientes han reducido el ahorro disponible. Hemos ajustado algunas aportaciones flexibles.

---

### Contribution blocked

> No puedes reservar esa cantidad ahora mismo. Solo tienes X € disponibles para asignar.

---

# Data Model

## transactions

```
id
user_id
date
type
amount_minor
project_id optional
created_at
```

---

## project_contributions

```
id
project_id
month_id
amount_minor
original_amount_minor
kind
origin
is_adjusted
created_at
updated_at
```

---

## monthly_snapshots

```
month_id
incomes_minor
expenses_minor
result_minor
savings_generated_minor
assigned_total_minor
available_savings_minor
closed_at
```

---

# Definition of Done

The implementation is complete when:

1. Savings allocation never exceeds savings generated.
2. Flexible contributions automatically adjust when cashflow changes.
3. Manual contributions cannot exceed available savings.
4. Monthly contributions integrate with the flexible contribution pool.
5. All formulas match the definitions above.
6. The UI can clearly display:

* Resultado del mes
* Reservado para objetivos
* Disponible para asignar
