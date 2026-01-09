# Prompt para agente de código — Feature: pestaña Account / Cuenta (web + móvil)

## Contexto
Proyecto fintech “Finnon” en monorepo (apps/web Next.js, apps/mobile Expo React Native, packages/shared). Stack TypeScript, Supabase. La UX debe ser coherente web–móvil: misma información y jerarquía, adaptada al layout (web con más aire; móvil con navegación nativa y sheets). Evitar overlays/modales “dramáticos”: preferir continuidad visual.

## Objetivo de la feature
Implementar/rehacer la pestaña **Account / Cuenta** con:
- Detalles de la cuenta (nombre centrado)
- Moneda
- Participantes con avatar (fallback inicial + color estable)
- Resumen financiero: balance total, ingresos totales, gastos totales
- Sección categorías:
  - Acceso a gestión/lista de categorías
  - Desglose por categoría (totales)
- **Selector de cuenta** pequeño y estático abajo a la derecha (patrón consistente con el resto de pantallas)

## Guardarraíles (importante)
1. **No overlays**: si hay bottom sheet en móvil, que sea “sin backdrop” o con backdrop mínimo y NO modal oscuro.
2. **Tokens y diseño**: no hardcodear colores. Usar tokens semánticos (positive/negative solo para el valor numérico, no para pintar tarjetas completas).
3. **Cambios mínimos necesarios**: no refactor masivo; solo lo necesario para cumplir DoD.
4. **Rendimiento**: evitar penalizar UI. Preferir 1 fetch “resumen” (RPC/endpoint) frente a N queries dispersas.

---

## Alcance funcional (web + móvil)

### A) Header / navegación
**Móvil**
- Navigation bar nativa con título: `Account`
- Contenido scrolleable debajo, respetando safe-area

**Web**
- Página `Account` (ruta existente o crear `/account`)
- Mantener layout consistente con Transactions (ancho uniforme), sin “panel estrecho” diferente

### B) Detalles de la cuenta
- Nombre de cuenta **centrado** (headline)
- Subtexto: moneda base (ej: `EUR · Moneda base`)
- (Opcional) ID corto o “Cuenta activa” si aporta claridad (no obligatorio)

### C) Participantes + avatar
- Lista de participantes de la cuenta (members)
- Cada participante muestra:
  - Avatar:
    - Si existe `avatarUrl` -> imagen
    - Si no -> inicial (primera letra del email/nombre)
    - Fondo con color estable (derivado de hash de userId/email) para minimizar colisiones
  - Nombre/email
  - (Opcional) rol

> Nota: NO hace falta crear editor de avatar ahora. Dejar preparado el modelo (campo) y fallback robusto.

### D) Resumen financiero (totales)
Mostrar 3 KPIs:
- **Balance total**
- **Ingresos totales**
- **Gastos totales**

Formato:
- Importes formateados con util compartida (`formatMoney`) y moneda de la cuenta
- Colores:
  - Balance: neutro
  - Ingresos: `color.state.positive` SOLO en el número
  - Gastos: `color.state.negative` SOLO en el número

### E) Sección Categorías
1) “Categorías” (gestión)
- Botón/row: “Ver categorías”
- Si existe contador, mostrarlo (ej: `12 categorías`)

2) “Detalle por categoría”
- Lista con:
  - icono de categoría (si existe) o placeholder
  - nombre
  - total agregado
  - (Opcional) % del total (si es fácil)

Interacción:
- Tap/click sobre categoría -> navegar a vista de transacciones filtradas por esa categoría (si ya existe la pantalla/filtro). Si no existe, dejarlo como TODO no bloqueante.

### F) Selector de cuenta (abajo derecha, estático)
- Componente “AccountSwitcherButton” flotante, pequeño, persistente.
- Posición: abajo-derecha con margen que respete tab bar + safe area.
- Al pulsar:
  - Web: panel lateral “ligero” integrado (sin overlay)
  - Móvil: bottom sheet (sin overlay/backdrop fuerte)
- Contenido:
  - Cuenta activa (nombre + moneda)
  - Lista de cuentas disponibles
  - Opción “Crear cuenta” (si el flujo ya existe)

---

## Datos / rendimiento (importante)

### Recomendación (preferida): 1 RPC para resumen de cuenta
Implementar una función Postgres en Supabase (via migration) para devolver un payload único:
`get_account_summary(account_id uuid) -> json`

Debe incluir:
- account: { id, name, base_currency }
- participants: [{ user_id, email, display_name, avatar_url? }]
- totals: { income_total, expense_total, balance_total }
- category_breakdown: [{ category_id, name, icon?, total }]

Notas:
- La función debe respetar seguridad (RLS). Preferir `SECURITY INVOKER` y queries filtradas por `account_id`.
- Si el proyecto ya usa migrations, añadir archivo nuevo. Si no, documentar el SQL y dónde ejecutarlo.

### Índices (si aplica y existen migrations)
Añadir índices para acelerar agregados:
- transactions(account_id, date)
- transactions(account_id, category_id, date)
- transactions(account_id, type, date) (si type=income/expense)

> Si ya existen, no duplicar.

### Alternativa (si NO quieres tocar DB ahora)
Hacer 3 queries desde cliente:
1) account details + participants
2) totals income/expense
3) breakdown group by category
Y cachear en memoria (query key por `accountId`).

---

## Implementación UI (sugerida)

### Shared (packages/shared)
- `copy/account.ts`: textos compartidos (“Account”, “Moneda base”, “Participantes”, “Balance total”, etc.)
- `utils/money.ts`: formateo consistente
- `ui/Avatar.tsx`: avatar con fallback (inicial + color hash estable)
- `ui/Section.tsx` o reutilizar el componente de sección existente

### Mobile (apps/mobile)
- Screen/tab: `AccountScreen`
- Layout:
  - `ScrollView`
  - Secciones en orden: AccountDetails → Participants → Totals → Categories
- `AccountSwitcherButton` posicionado absolute bottom-right
- Bottom sheet para selector de cuenta SIN overlay fuerte

### Web (apps/web)
- Ruta `/account` o la existente
- Reutilizar los mismos componentes shared si el proyecto los comparte; si no, duplicar mínimo respetando tokens.
- Alinear anchura/espaciado con Transactions (uniformidad)

---

## Definition of Done (DoD)
1. Móvil: pestaña Account con nav title “Account” y safe-area OK.
2. Nombre centrado + moneda visible.
3. Participantes con avatar (imagen o inicial + color estable).
4. Totales: balance/ingresos/gastos con formato correcto y tokens (positive/negative solo en el número).
5. Sección categorías: acceso a “Ver categorías” + lista de desglose por categoría.
6. Selector de cuenta pequeño abajo derecha:
   - visible en Account
   - abre selector (web panel / móvil bottom sheet)
7. Fetch eficiente: preferible 1 RPC; si no, queries cacheadas sin lag visible.
8. Sin overlays oscuros tipo modal; experiencia “plano continuo”.

---

## Casos a comprobar (manual QA)
- iPhone con notch + Android: el botón flotante no tapa tab bar ni contenido
- Cuenta con 0 transacciones: mostrar 0s y estados vacíos sin romper UI
- Muchas categorías: lista scrollea fluida
- Participantes sin avatar: fallback consistente (misma persona -> mismo color)
- Cambio de cuenta en selector actualiza pantalla y recomputa resumen

---

## Entregable final
- PR con cambios en shared + mobile + web
- (Si aplica) migration SQL con RPC + índices
- Breve nota en README / changelog interno explicando el RPC y el payload
