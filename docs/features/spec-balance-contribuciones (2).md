# Spec: Balance de Contribuciones — Finnon

## Referencia visual

El wireframe `wireframe-tu-cuenta-v2.html` es la referencia de diseño para la versión web. Todas las decisiones de layout, componentes y jerarquía visual deben seguir ese wireframe.

---

## 1. Cambios en el modelo de datos

### 1.1 Nuevos campos en `transactions`

Se añaden 3 campos directamente en la tabla de transacciones. Si en el futuro el uso de `custom` splits es masivo, se puede migrar a una tabla `transaction_splits` separada de forma mecánica:
1. `personal` → 1 registro para `paid_by` con el 100% del importe
2. `equal` → N registros proporcionales entre los miembros activos
3. `custom` → N registros según `split_details`

#### Campo `paid_by`

```sql
alter table public.transactions 
  add column paid_by uuid null;

-- Migración: asignar created_by como paid_by para transacciones existentes
update public.transactions set paid_by = created_by where paid_by is null;

-- Después de la migración, hacer NOT NULL
alter table public.transactions 
  alter column paid_by set not null;

alter table public.transactions
  add constraint transactions_paid_by_fkey 
    foreign key (paid_by) references auth.users (id);

create index idx_transactions_paid_by on public.transactions using btree (paid_by);
```

**`paid_by`** = quién desembolsó el dinero (puede ser diferente de `created_by`, que es quien registró la transacción en la app).

#### Campo `split_type`

```sql
alter table public.transactions
  add column split_type text not null default 'equal'
  constraint transactions_split_type_check check (
    split_type = any (array['equal'::text, 'personal'::text, 'custom'::text])
  );
```

- `equal`: reparto a partes iguales entre todos los miembros activos (contributor/admin).
- `personal`: 100% para `paid_by`.
- `custom`: reparto explícito en `split_details`.

#### Campo `split_details`

```sql
alter table public.transactions
  add column split_details jsonb null
  constraint transactions_split_details_check check (
    (split_type != 'custom') or (split_details is not null)
  );
```

Formato de `split_details` (solo cuando `split_type = 'custom'`):
```json
[
  {"user_id": "uuid-ana", "share_minor": 7000},
  {"user_id": "uuid-carlos", "share_minor": 3000}
]
```

**Regla de integridad (validar en la capa de aplicación):** cuando `split_type = 'custom'`, la suma de `share_minor` DEBE igualar `amount_minor` de la transacción.

### 1.2 Migración de datos existentes

- `paid_by` → asignar `created_by` (default).
- `split_type` → `'equal'` para todas las existentes (default de la columna).
- `split_details` → `null` (no se necesita para `equal`).

No se requiere script complejo — los defaults hacen el trabajo. El balance histórico pre-migración será aproximado.

---

## 2. Sistema de colores por usuario

### 2.1 Regla de asignación

Cada miembro de la cuenta recibe un color derivado de su avatar. Este color se usa en todas las barras de contribución, segmentos de evolución y mini-avatares.

**No usar colores arbitrarios.** El color de cada usuario en las barras de contribución DEBE coincidir con el color de su avatar.

### 2.2 Colisión de colores

Si dos o más miembros tienen avatares con el mismo color base, generar una variante tonal para diferenciación:
- Primer usuario: color original del avatar.
- Segundo usuario con mismo color: variante más clara (lighten 20%) o más oscura (darken 20%).
- Tercer usuario (si aplica): variante complementaria.

Implementar como utility function:

```typescript
function resolveUserColors(members: AccountMember[]): Map<string, string> {
  const colorMap = new Map<string, string>();
  const usedColors: string[] = [];

  for (const member of members) {
    let color = member.avatarColor;
    if (usedColors.includes(color)) {
      color = adjustLightness(color, usedColors.filter(c => c === color).length * 20);
    }
    colorMap.set(member.userId, color);
    usedColors.push(member.avatarColor);
  }

  return colorMap;
}
```

### 2.3 Referencia visual

La barra de contribución de cada categoría, las mini-barras del resumen, y los segmentos del gráfico de evolución TODOS usan el mismo color resuelto para cada usuario. No hay paleta de colores separada para gráficos.

---

## 3. Internacionalización (i18n)

Todos los copys deben existir en inglés y español. Usar el sistema i18n existente de la app.

### 3.1 Copys

| Key | ES | EN |
|-----|----|----|
| `account.balance_total` | Balance total | Total balance |
| `account.income` | Ingresos | Income |
| `account.expenses` | Gastos | Expenses |
| `account.vs_prev_month` | vs mes anterior | vs previous month |
| `account.evolution_weekly` | Evolución semanal | Weekly evolution |
| `account.evolution_monthly` | Evolución mensual | Monthly evolution |
| `account.evolution_quarterly` | Evolución trimestral | Quarterly evolution |
| `account.evolution_yearly` | Evolución anual | Yearly evolution |
| `account.filter_both` | Ambos | Both |
| `account.filter_income` | Ingresos | Income |
| `account.filter_expenses` | Gastos | Expenses |
| `account.filter_net` | Neto | Net |
| `account.expenses_by_contribution` | Gastos por contribución | Expenses by contribution |
| `account.income_by_contribution` | Ingresos por contribución | Income by contribution |
| `account.contribution_banner` | {name} contribuyó en {amount} más que {other_name} este {period} | {name} contributed {amount} more than {other_name} this {period} |
| `account.contribution_banner_equal` | Las contribuciones están equilibradas este {period} | Contributions are balanced this {period} |
| `account.period_week` | semana | week |
| `account.period_month` | mes | month |
| `account.period_quarter` | trimestre | quarter |
| `account.period_year` | año | year |
| `account.n_movements` | {n} movimiento(s) | {n} movement(s) |
| `transaction.who_paid` | ¿Quién pagó? | Who paid? |
| `transaction.split` | Reparto | Split |
| `transaction.split_equal` | Partes iguales | Equal split |
| `transaction.split_personal` | Solo mío | Only mine |
| `transaction.split_custom` | Personalizado | Custom |
| `transaction.split_error` | El reparto no suma el total de la transacción | The split doesn't add up to the transaction total |

### 3.2 Contribution banner — lógica del mensaje

El banner debajo del balance total muestra un mensaje de refuerzo positivo:

```typescript
function getContributionBannerMessage(
  balances: BalanceResult[],
  period: string,
  t: TranslationFn
): { message: string; highlightUserId: string } | null {
  if (balances.length < 2) return null;
  
  const sorted = [...balances].sort((a, b) => b.totalPagado - a.totalPagado);
  const diff = sorted[0].totalPagado - sorted[1].totalPagado;
  
  if (diff < 100) {
    return { message: t('account.contribution_banner_equal', { period }), highlightUserId: '' };
  }
  
  return {
    message: t('account.contribution_banner', {
      name: sorted[0].userName,
      amount: formatCurrency(diff),
      other_name: sorted[1].userName,
      period
    }),
    highlightUserId: sorted[0].userId
  };
}
```

Para N > 2 usuarios: comparar el mayor contribuidor con el segundo mayor.

### 3.3 Título dinámico de evolución

El título del gráfico cambia según el período seleccionado:
- Semana → `account.evolution_weekly`
- Mes → `account.evolution_monthly`
- Trimestre → `account.evolution_quarterly`
- Año → `account.evolution_yearly`

---

## 4. Layout — Versión Web

Referencia: `wireframe-tu-cuenta-v2.html`

### 4.1 Estructura general

```
max-width: 1100px, centrado
grid: 2 columnas, gap 20px
```

### 4.2 Header de cuenta

```
[Avatar cuenta] Nombre cuenta     [Leyenda color] [Avatares superpuestos]
                Cuenta · DIVISA
```

- **Izquierda:** avatar de la cuenta (existente) + nombre + tipo/divisa.
- **Derecha:** leyenda de colores (dot + nombre corto) + avatares superpuestos (margin-left: -8px).
- Solo visible en cuentas con 2+ miembros.

### 4.3 Fila 1 — Selector de período (span 2 cols)

Centrado. Pills: Semana / Mes / Trimestre / Año.

### 4.4 Fila 2 — Balance total (span 2 cols)

- Card centrada con label + importe grande.
- **Banner de contribución** debajo: pill redondeado con mini-avatar del mayor contribuidor + mensaje de refuerzo positivo.
- Solo visible en cuentas con 2+ miembros.

### 4.5 Fila 3 — Col 1: Resumen Ingresos/Gastos

Dos sub-cards lado a lado:
- Label + dot de color
- Importe
- Delta vs período anterior
- **Mini barra de contribución** (border-top sutil):
  - Barra 8px con segmentos por usuario (colores de avatar).
  - Debajo: mini-avatares (16px, con iniciales) + importe de cada usuario.
- Solo visible en cuentas con 2+ miembros.

### 4.6 Fila 3 — Col 2: Evolución

- Título dinámico según período.
- **Filtros:** Ambos | Ingresos | Gastos | Neto
  - **Ambos:** dos barras por período (verde ingreso + rojo gasto), sin segmentación.
  - **Ingresos:** barra stacked segmentada por colores de usuario. Leyenda de usuarios visible junto a filtros.
  - **Gastos:** igual, segmentada por usuario. Leyenda visible.
  - **Neto:** barra única (verde positivo / rojo negativo), sin segmentación.
- Leyenda de usuarios aparece/desaparece dinámicamente según filtro activo.

### 4.7 Fila 4 — Col 1: Gastos por contribución

Card con título. Sin leyenda ni avatares repetidos (están en header).

Cada categoría:
```
Fila 1: [Icono] Nombre (n movimientos)         €Total (rojo)
Fila 2:     €X · NN% [====u1====|===u2===] MM% · €Y
```

- **Fila 1:** icono de categoría existente (NO cambiar iconografía) + nombre + conteo + total.
- **Fila 2:** indentada 48px.
  - Izquierda: importe + % del usuario 1.
  - Barra 10px con segmentos proporcionales (colores de avatar).
  - Derecha: % + importe del usuario 2.
  - Si 0%: mostrar "—".
- Separadas por border-bottom sutil. Ordenadas por mayor gasto descendente.

### 4.8 Fila 4 — Col 2: Ingresos por contribución

Idéntico a gastos pero totales en verde.

### 4.9 Cuentas individuales (1 miembro)

- Sin avatares/leyenda en header.
- Sin banner de contribución.
- Sin mini barras de contribución.
- Sin segmentación en evolución.
- Fila 4: "Gastos por categoría" / "Ingresos por categoría" sin barras de contribución.

---

## 5. Layout — Versión Móvil

### 5.1 Estructura general

```
width: 100%, padding horizontal 16px
stack vertical, gap 16px
```

### 5.2 Header de cuenta

```
[Avatar cuenta] Nombre cuenta     [Avatares superpuestos]
                Cuenta · DIVISA
```

Sin leyenda de texto — solo avatares superpuestos. Colores se entienden por contexto.

### 5.3 Selector de período

Scrollable horizontal si no caben. Mismas pills.

### 5.4 Balance total

- Card con balance centrado.
- Banner de contribución, font-size 11px, wrap a dos líneas si es necesario.

### 5.5 Resumen Ingresos/Gastos

Dos sub-cards lado a lado (flex row), padding reducido (14px).
- Mini barras de contribución con mini-avatares + importe (sin nombre).

### 5.6 Evolución

- Filtros scrollable horizontal.
- Altura del gráfico: 160px.
- Leyenda de usuarios DEBAJO del gráfico (no al lado de filtros) cuando filtro es Ingresos o Gastos.

### 5.7 Gastos / Ingresos por contribución

Apilados verticalmente (gastos primero, ingresos después).

Categorías con estructura simplificada:
```
Fila 1: [🏠] Hogar (1 mov)              €850,00
Fila 2: 100% [============u1============]    —
```

- Sin indentación de 48px (usar 0 o 12px).
- Labels: solo porcentaje (sin importe en los extremos de la barra). El importe ya está en fila 1.

---

## 6. Formulario de transacción

### 6.1 "¿Quién pagó?"

- Después del campo de importe.
- Selector con avatar + nombre de cada miembro.
- Default: usuario actual.
- Solo en cuentas con 2+ miembros (contributor/admin).

### 6.2 "Reparto"

- Debajo de "¿Quién pagó?"
- Segmented control: Partes iguales (default) | Solo mío | Personalizado.
- Personalizado: expande lista de miembros con campos de cantidad editables. Ajuste automático para sumar total.
- Validación: suma debe igualar importe; error inline si no cuadra.

### 6.3 Edición

- Editar `paid_by` y reparto permitido.
- Cambio de importe con `custom`: avisar revisión.
- Cambio de importe con `equal`: recálculo dinámico.

---

## 7. Lógica de cálculo

### 7.1 Función principal

```typescript
interface BalanceResult {
  userId: string;
  userName: string;
  avatarColor: string;
  totalPagado: number;
  totalResponsable: number;
  saldoNeto: number;
}

function calcularBalance(
  transactions: Transaction[],
  activeMembers: AccountMember[]
): BalanceResult[] {
  const memberIds = activeMembers
    .filter(m => m.role !== 'viewer')
    .map(m => m.userId);
    
  const balance = new Map<string, { pagado: number; responsable: number }>();

  for (const uid of memberIds) {
    balance.set(uid, { pagado: 0, responsable: 0 });
  }

  for (const tx of transactions) {
    const entry = balance.get(tx.paidBy);
    if (entry) entry.pagado += tx.amountBaseMinor;

    switch (tx.splitType) {
      case 'equal': {
        const share = Math.floor(tx.amountBaseMinor / memberIds.length);
        const remainder = tx.amountBaseMinor % memberIds.length;
        memberIds.forEach((uid, i) => {
          const b = balance.get(uid)!;
          b.responsable += share + (i < remainder ? 1 : 0);
        });
        break;
      }
      case 'personal': {
        const b = balance.get(tx.paidBy);
        if (b) b.responsable += tx.amountBaseMinor;
        break;
      }
      case 'custom': {
        for (const split of tx.splitDetails!) {
          const b = balance.get(split.userId);
          if (b) b.responsable += split.shareMinor;
        }
        break;
      }
    }
  }

  return memberIds.map(uid => {
    const b = balance.get(uid)!;
    const member = activeMembers.find(m => m.userId === uid)!;
    return {
      userId: uid,
      userName: member.displayName,
      avatarColor: member.avatarColor,
      totalPagado: b.pagado,
      totalResponsable: b.responsable,
      saldoNeto: b.pagado - b.responsable,
    };
  });
}
```

### 7.2 Por categoría

Misma lógica agrupando por `category_id` → `Map<categoryId, BalanceResult[]>`.

### 7.3 Evolución segmentada

Agrupar por período + `paid_by`. Barras stacked proporcionales al total pagado por usuario en cada período.

### 7.4 Multi-divisa

Usar `amount_base_minor` para todos los cálculos. Splits custom: almacenar en divisa de transacción, convertir con `fx_rate`.

---

## 8. Permisos y roles

| Acción | viewer | contributor | admin |
|--------|--------|-------------|-------|
| Ver balance/contribuciones | ✅ | ✅ | ✅ |
| Ver evolución segmentada | ✅ | ✅ | ✅ |
| Crear transacción con splits | ❌ | ✅ | ✅ |
| Editar paid_by/splits propios | ❌ | ✅ | ✅ |
| Editar paid_by/splits de otros | ❌ | ❌ | ✅ |

Viewers no participan en splits.

---

## 9. Impacto en funcionalidad existente

- **Creación:** añadir `paid_by`, `split_type`, `split_details`. Un solo INSERT.
- **Edición:** permitir editar reparto. Avisar si custom + cambio de importe.
- **Eliminación:** sin impacto adicional.
- **Recurrentes:** `split_type = 'equal'` por defecto. Config en recurring_items: fuera de scope v1.
- **Iconografía:** NO cambiar iconos existentes.

---

## 10. Scope

### En scope (v1):
- Campos `paid_by`, `split_type`, `split_details`
- UI reparto en formulario
- Layout "Tu Cuenta" rediseñado (web + móvil)
- Banner contribución con refuerzo positivo
- Mini barras contribución en resumen
- Evolución segmentada (filtros Ingresos/Gastos)
- Gastos e ingresos por contribución (componente unificado)
- Colores basados en avatar + resolución colisiones
- Copys EN + ES
- Migración datos existentes
- Comportamiento cuentas individuales

### Fuera de scope:
- Migración a tabla `transaction_splits`
- Reparto en recurring_items
- Botón "saldar deuda"
- Notificaciones de umbral
- Historial temporal del balance
- Export del balance

---

## 11. Criterios de aceptación

1. Crear transacción en cuenta compartida muestra "¿Quién pagó?" y opciones de reparto.
2. Default: `equal` entre miembros contributor/admin.
3. Opciones: `personal` y `custom` disponibles.
4. Custom: suma debe igualar importe; error inline si no.
5. Header "Tu Cuenta": avatares superpuestos + leyenda a la derecha (solo 2+ miembros).
6. Balance total: banner de refuerzo positivo con mini-avatar.
7. Resumen: mini barras contribución con mini-avatares (no nombres).
8. Evolución: Ingresos/Gastos → barras segmentadas + leyenda dinámica. Ambos/Neto → sin segmentación.
9. Título evolución dinámico según período.
10. Fila 4: gastos e ingresos por contribución unificados.
11. Colores = colores de avatar. Colisiones resueltas con variantes tonales.
12. Copys en ES y EN.
13. Móvil: columna única, labels simplificados (solo %), leyenda evolución debajo del gráfico.
14. Cuentas individuales: sin elementos colaborativos.
15. Migración: `paid_by = created_by`, `split_type = 'equal'`.
16. Iconografía sin cambios.
