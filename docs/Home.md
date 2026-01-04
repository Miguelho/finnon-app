# Prompt para agente de código — Alinear Home (Mobile ↔ Web) + Hero unificado

## Contexto
Necesitamos que **la pantalla Home en móvil tenga el mismo contenido y jerarquía que en web**, usando el mismo lenguaje visual y la misma lógica de negocio, con adaptaciones responsivas (no dos productos distintos).

La Home debe reforzar la promesa de Finnon: **entender el mes en curso de un vistazo** (qué está comprometido, qué queda pendiente y qué ya está pagado). :contentReference[oaicite:0]{index=0}  
El diseño debe ser **silencioso**, sin marcos/overlays dramáticos, y con jerarquía basada en espacio/tipografía, no en color. :contentReference[oaicite:1]{index=1}  
Usar **tokens de color semánticos** (nunca hex sueltos). :contentReference[oaicite:2]{index=2}

---

## Objetivo
Implementar una Home consistente en **apps/web** y **apps/mobile** con:

### A) Hero Component (arriba del todo)
1. **Estado global actual de la cuenta** (resumen alto nivel: balance/posición actual, según lo que ya exista en el producto).
2. **Estado del mes actual**: *comprometido / pendiente / pagado*.
3. **Próximas obligaciones**:
   - En web: permitir **marcar como pagado** igual que se hace en móvil (misma acción, misma lógica de negocio).
4. **Pagos/Ingresos próximos X días**:
   - X configurable.
   - Por defecto **1 semana (7 días)**.

### B) Debajo del Hero
5. **Actividad reciente** (lista de transacciones/eventos recientes), manteniendo el mismo orden y estilo entre web y móvil.

---

## Guardarraíles (NO negociables)
- **Reutilización real**: lógica de negocio y modelos en `packages/shared` (no duplicar cálculos por plataforma).
- **Diseño continuo**: evitar “marcos”, cards excesivamente elevadas, o dramatismo visual. Prioridad: continuidad. 
- **Color**: solo tokens semánticos definidos. Nada de colores “decorativos”. :contentReference[oaicite:4]{index=4}
- **Jerarquía** por layout/espaciado; el color solo para estado/acción. :contentReference[oaicite:5]{index=5}
- **Cambios mínimos** fuera de Home: no rehacer navegación ni rutas si no hace falta.
- **Paridad funcional**: cualquier acción existente en móvil para obligaciones debe existir en web (y viceversa si aplica).

---

## Non-goals (para evitar scope creep)
- No introducir nuevos gráficos complejos ni dashboards.
- No rediseñar todo “Transactions” o “Settings”.
- No inventar nuevas entidades si ya existen (usar `Obligation` / `RecurringItem` / `Transaction` según el código actual).

---

## Implementación — Plan de trabajo (pasos)
### 1) Definir un “Home ViewModel” compartido
Crear en `packages/shared/home/` (o carpeta equivalente) una capa **pura** (sin React) que calcule los bloques del Hero:

- `getAccountGlobalState(...)`
- `getMonthlyState(...)` → `{ committed, pending, paid }`
- `getUpcomingObligations(...)`
- `getUpcomingCashflowWindow(...)` → ingresos/gastos próximos X días
- `getRecentActivity(...)`

Requisitos:
- Entradas: datos crudos (obligations, transactions, account, “today”).
- Salidas: DTO listo para UI (strings formateables, cantidades minor/base si ya lo usáis).
- Sin dependencia de librerías de i18n ni UI.

### 2) Unificar el componente “Hero”
Crear un componente compartido de estructura (presentacional) o, si el stack no lo permite 1:1:
- Mantener **la misma estructura de secciones** y el mismo “ViewModel contract”.
- Implementar `Hero` en web y en móvil consumiendo el mismo viewmodel.

**Estructura del Hero (orden fijo):**
1. Header/summary: “Estado global de cuenta”
2. “Este mes”: comprometido / pendiente / pagado
3. “Próximas obligaciones” + CTA de “Marcar pagado”
4. “Próximos X días” + selector X (default 7)

### 3) Acción “Marcar obligación como pagada” en Web
- Localizar la acción actual en móvil (endpoint/hook/mutation).
- Extraer a `packages/shared`:
  - `markObligationPaid(obligationId, paidAt?)`
  - o la función/mutation equivalente, sin acoplarla a UI.
- En `apps/web`, añadir el botón/CTA en cada obligación (mismo comportamiento que en móvil):
  - Estado loading
  - Optimistic update si ya existe patrón
  - Refetch/invalidación coherente con la librería de datos que uséis

### 4) Selector X días (próximos pagos/ingresos)
- Default: 7 días.
- UI minimal:
  - Control simple (p.ej. “7 / 14 / 30” o stepper) + opción “Personalizado” si ya hay patrón.
- Guardar preferencia:
  - Si ya existe storage por usuario, usarlo.
  - Si no, mantener local (state) por ahora.

### 5) Actividad reciente (debajo del Hero)
- Reutilizar el componente/lista existente (si existe en web) y llevarlo a móvil (o al revés),
  manteniendo:
  - mismo orden (más reciente primero)
  - mismo estilo (sin botones chillones, sin emojis si ya se eliminaron en otros sitios)
  - navegación/acción al tocar un item si ya existe en la app

---

## UI / Estilo (consistencia)
- Layout: fondo estable, sin overlays. :contentReference[oaicite:6]{index=6}
- Tokens:
  - backgrounds: `color.bg.primary / secondary / surface`
  - texto: `color.text.primary / secondary / muted`
  - acción: `color.action.primary`
  - estado: `color.state.positive / negative / neutral` (solo si el estado lo exige)
  :contentReference[oaicite:7]{index=7}
- Jerarquía:
  - Un único “headline” del Hero (no repetir totales 3 veces).
  - Secciones separadas por espaciado y divisores sutiles (estado neutral).

---

## Criterios de aceptación (DoD)
1. **Home móvil y web muestran el mismo orden de contenido**: Hero arriba + Actividad reciente debajo.
2. Hero incluye:
   - Estado global de cuenta
   - Estado del mes (comprometido/pendiente/pagado)
   - Próximas obligaciones
   - Próximos X días (default 7, configurable)
3. En **web** se puede **marcar como pagada** una obligación desde “Próximas obligaciones”, igual que en móvil.
4. Lógica de cálculo (mes actual, próximos X días) vive en **`packages/shared`** sin acoplarse a UI/i18n.
5. No hay hex sueltos: **solo tokens**. :contentReference[oaicite:8]{index=8}
6. No se introducen marcos/overlays dramáticos; la Home se siente “plano continuo”. 

---

## Entregables
- `packages/shared/home/*` (viewmodel + utilidades)
- `apps/web`:
  - actualización Home + CTA “pagar” en obligaciones
- `apps/mobile`:
  - actualización Home para igualar estructura de web
- Tests unitarios del viewmodel (al menos):
  - cálculo mensual committed/pending/paid
  - ventana próximos X días con X=7 y X=14

---

## Checklist final
- [ ] Móvil y web: mismo contenido, misma jerarquía.
- [ ] Acción “pagar obligación” disponible en web y consistente con móvil.
- [ ] Tokens de color aplicados correctamente.
- [ ] Sin cambios colaterales fuera de Home.
- [ ] ViewModel compartido testeado.
