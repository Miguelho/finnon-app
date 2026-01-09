# Prompt (Product Lead + Tech Lead) — Home “Este mes” + Shared module (Web + Mobile)

## Contexto
Finnon es una app de finanzas personales cuyo valor principal es que el usuario entienda el mes en segundos:
- Comprometido / pendiente / pagado
- Próxima obligación
- Próximos 7 días
- Actividad reciente
y tenga una acción inmediata para registrar algo.

Hoy Home (web y mobile) se percibe como “panel/estado” (bienvenido, email, moneda base, rol, selector de cuentas grande, tarjetas de módulos, “próximamente”) y en mobile hay glitches visibles (wrap “Transaccion es”, placeholders “a”, pluralización).

Objetivo: Home debe ser “Este mes” (la vista del producto) y reutilizar estilo + lógica de negocio entre web y móvil usando el módulo `shared`.

---

## Objetivos (prioridad alta)
1) Home responde en <10s “cómo voy este mes y qué viene ahora”.
2) CTA principal siempre disponible: “Añadir”.
3) Quitar contenido meta del Home (sesión/email/debug) -> mover a Ajustes/Cuenta.
4) Eliminar “Próximamente” del flujo core (sustituir por estados vacíos útiles).
5) Continuidad visual: usar bottom sheet/panel lateral SIN overlay oscuro dramático.
6) Reutilizar lógica y estilo mediante `shared` (selectors, hooks, componentes base y tokens).

---

## Arquitectura: Reutilización Web/Mobile con `shared`

### A) `shared` debe contener
1) **Dominio / lógica de negocio** (no UI específica):
- Tipos: Account, Transaction, Obligation, MonthlySummary, UpcomingItem, etc.
- Selectores: `selectActiveAccount`, `selectMonthlySummary(month)`, `selectUpcoming(nextDays)`, `selectRecentTransactions(limit)`
- Funciones puras:
  - `getMonthKey(date)`, `formatCurrency(amount, currency, locale)`
  - `computeMonthlySummary(obligations, transactions, monthRange)`
  - `getUpcomingItems(obligations, reminders, range)`
- Validaciones y utilidades de copy: pluralización (“1 participante”, “2 participantes”).

2) **Hooks compartidos** (agnósticos de plataforma):
- `useActiveAccount()`
- `useHomeViewModel({ month, nextDays, limit })` -> devuelve data ya preparada para UI (view-model) + estados.
  - `monthlyHero`
  - `upcoming`
  - `recentActivity`
  - `isGuestReadOnly`
  - `emptyStates` (mensajes/CTAs)
  - `actions` (handlers abstractos: onAddExpense, onAddIncome, onAddObligation, onSwitchAccount)

3) **Design tokens compartidos** (no CSS, no RN styles directos):
- Espaciados, radii, typography scale, sombras (semántico: `surface`, `surfaceElevated`, `textPrimary`, `textSecondary`, `actionPrimary`).
- Estos tokens deben mapearse en cada plataforma:
  - Web: Tailwind/CSS vars
  - Mobile: StyleSheet/theme object

4) **Componentes UI “headless” / base (opcional)**
Si tienes ya un patrón de componentes compartidos:
- `Card`, `SectionHeader`, `ListRow`, `Badge`, `Button` (sin dependencia de DOM/RN; si no es viable, al menos compartir props + estados + tokens).

> Regla: nada en `shared` debe importar `react-native` ni `next/*` ni APIs del navegador.

### B) `web` y `mobile` deben contener
- Composición de pantalla (layout), navegación, wrappers de UI (RN components / HTML), y presentación final.
- Adaptadores si hace falta para UI:
  - `web/ui/*` y `mobile/ui/*` mapean tokens a estilos reales.

---

## Rework de Home: Especificación de UI (común)
Home debe componerse en este orden (ambas plataformas):

### 1) Header minimalista
- Izquierda: **AccountSelectorChip**: “{accountName} · {currency} ▾”
- Derecha: icono de perfil/ajustes (y dentro “Salir”).
- No mostrar “home” como título redundante (mobile).
- “Salir” NO debe ser botón protagonista.

### 2) Bloque Hero: “Este mes”
Componente: `MonthlySummaryHero`
Muestra:
- Comprometido (obligaciones del mes) o 0
- Pendiente/Pagado (si existe), si no existe: Pendiente/Registrado (elige uno consistente)
- Próxima obligación: nombre + fecha + importe (si existe)
Estados vacíos:
- Sin obligaciones: “Aún no hay obligaciones este mes.” + CTA “Crear primera obligación”
- Sin actividad: “Aún no has registrado movimientos.” + CTA “Añadir gasto”

### 3) “Próximos 7 días”
Componente: `UpcomingList`
- Mostrar 3–5 items
- CTA: “Ver todo”
Estado vacío:
- “Nada programado en los próximos 7 días.”

### 4) “Actividad reciente”
Componente: `RecentActivityList`
- Últimas 3–10 transacciones
- CTA secundario: “Ver transacciones”
Estado vacío:
- “Aún no hay actividad.”

### 5) Acción principal: Add
Componente: `AddAction`
- Mobile: FAB “+”
- Web: botón primario “+ Añadir” (y opcional FAB en esquinas)
Acción abre:
- Mobile: Bottom sheet
- Web: Panel lateral
SIN overlay oscuro (máxima continuidad).
Opciones:
- Añadir gasto
- Añadir ingreso
- Añadir obligación (si aplica)

### 6) Selector de cuenta
- El selector completo de cuentas NO debe ser un bloque enorme en Home.
- Al tocar el chip: abrir sheet/panel con lista y selección.
- Mostrar participantes como secundario (“5 personas”), con pluralización correcta.

### 7) Invitado (solo lectura)
- NO usar banner gigante arriba.
- Usar:
  - Badge “Solo lectura” junto al nombre de cuenta o en el hero.
  - Texto auxiliar discreto: “Ves esta cuenta como invitado.”
  - CTA secundario: “Crear cuenta para editar”
- En modo invitado, deshabilitar acciones de edición y mostrar tooltips/toasts suaves.

---

## Eliminar sensación “demo”
- PROHIBIDO mostrar “Próximamente” en Home.
- Si algo no está listo, se oculta o se mueve a “Más”/Ajustes.
- Los estados vacíos deben parecer producto real, no error.

---

## Calidad UI (fixes obligatorios)
Mobile:
- Corregir wrap “Transacciones” (no partir palabras).
- Eliminar placeholders “a”.
- Arreglar pluralización “1 participante”.
- Reducir altura del bloque de cuentas (convertirlo a chip + sheet).
Web:
- Quitar bloque “Bienvenido”/debug y banner dominante de invitado.
- Introducir hero “Este mes” arriba del todo.

---

## Entregables (orden recomendado)
1) `shared/domain`:
   - tipos + computeMonthlySummary + getUpcomingItems + pluralization helpers
2) `shared/hooks`:
   - `useHomeViewModel()`
3) `shared/theme`:
   - tokens semánticos + mapping interface
4) UI:
   - Mobile: nueva pantalla Home con composición final + AddSheet + AccountSwitcherSheet
   - Web: nueva Home con MonthlyHero + AddSidePanel + AccountSwitcherPanel
5) Estados vacíos + copy final (sin tecnicismos, tono calmado)
6) Tests:
   - unit tests para `computeMonthlySummary`, `getUpcomingItems`, pluralización
   - snapshot/visual tests si tienes infra (opcional)

---

## Criterios de aceptación (Definition of Done)
- Home en web y mobile muestra “Este mes” arriba y responde al estado mensual en <10s.
- Existe CTA “Añadir” siempre visible y coherente entre plataformas.
- No hay contenido de sesión/email/“bienvenido” en Home.
- No existe “Próximamente” en Home.
- Cambiar de cuenta es un gesto rápido (chip -> sheet/panel), sin scroll innecesario.
- Modo invitado se entiende sin sentirse “capado” (badge discreto + CTA secundaria).
- No hay glitches tipográficos (wraps, placeholders, pluralización).
- Lógica del Home (summary/upcoming/recent) se calcula en `shared` y se consume igual en web y mobile.

## Notas de estilo
- Estética silenciosa, limpia, sin overlays oscuros.
- Color solo para acción/estado, no decorativo.
- Animaciones suaves y cortas, sin rebote.



Repo: monorepo con `./apps` y `./packages/shared`.

Tarea: Implementar el rework de Home “Este mes” en web y mobile reutilizando lógica y estilo en `packages/shared`.

1) Crear en `packages/shared/src`:
- `domain/types.ts` (Account, Transaction, Obligation, Participant, UserRole)
- `home/`:
  - `home.compute.ts` (computeMonthlySummary, getUpcomingItems, getRecentActivity)
  - `home.viewmodel.ts` (buildHomeViewModel que devuelve datos listos para UI + empty states + permissions)
- `theme/tokens.ts` (tokens semánticos: spacing/radii/typography/color roles, sin CSS ni RN StyleSheet)
- `copy/home.ts` (microcopy de estados vacíos + pluralización "participante(s)")

2) En `apps/mobile`:
- Rehacer Home para que arriba esté el hero “Este mes” + chip de cuenta + badge “Solo lectura” discreto.
- Selector de cuenta: chip -> bottom sheet (sin overlay oscuro).
- Acción primaria: FAB “+ Añadir” -> bottom sheet con Añadir gasto/ingreso/obligación.
- Eliminar del Home: email, moneda base, “bienvenido”, debug.
- Arreglar glitches: no partir “Transacciones”, eliminar placeholders “a”, pluralización correcta.

3) En `apps/web`:
- Misma estructura conceptual que mobile:
  - Hero “Este mes”
  - Próximos 7 días
  - Actividad reciente
  - Chip cuenta -> panel (sin overlay oscuro)
  - “+ Añadir” -> panel lateral
- Quitar banners dominantes (invitado) y cualquier “Próximamente” del Home.

4) Regla: el cálculo de summary/upcoming/recent y permisos sale de `packages/shared` (no duplicar lógica).
5) Definition of Done:
- Home responde estado mensual en <10s incluso sin datos (empty states útiles).
- No hay “Próximamente” en Home.
- Cambiar cuenta es rápido (chip->sheet/panel).
- Modo invitado se entiende con badge discreto y acciones deshabilitadas.
