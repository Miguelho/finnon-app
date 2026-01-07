# Prompt para agente de código — Finnon (Web + Mobile)

## Contexto (no reinterpretar)
- Stack actual: monorepo con `apps/web` (Next.js), `apps/mobile` (Expo/React Native), `packages/shared`.
- Finnon prioriza continuidad visual, jerarquía por espacio/tamaño, y color solo para estado/impacto (nada “dramático”). :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}
- Los colores deben venir de **tokens semánticos compartidos**, no valores hardcodeados. :contentReference[oaicite:2]{index=2}

---

## Objetivo
Alinear UX web/móvil y pulir flows críticos:
1) Reorganizar navegación móvil (Cuenta dentro de Ajustes).
2) Mejorar pantalla de detalle de cuenta en móvil (safe area + back).
3) Rehacer “Añadir movimiento” como FAB (móvil) y añadir botón filtros equivalente en web.
4) Unificar tokens positivos/negativos web↔mobile desde `shared`.
5) Añadir detalles/cambio de cuenta en web y mejorar switching de cuenta en ambas plataformas.
6) Completar obligaciones ⇒ generar movimiento automáticamente.
7) Cambiar el default route post-login para ir a selección de cuenta (con opción crear nueva).
8) Invitados por email **sin expiración**.
9) Manejar problemas de conectividad de red con notificaciones y recordatorios suaves.
10) Transiciones de cambio de cuenta fluidas y sin interrupciones.

---

## Guardrails (estrictos)
- No introducir overlays dramáticos ni “modales teatrales”; continuidad visual primero. :contentReference[oaicite:3]{index=3} :contentReference[oaicite:4]{index=4}
- No inventar colores nuevos: usar/consumir tokens existentes. :contentReference[oaicite:5]{index=5}
- Reutilizar lógica/copy en `packages/shared` cuando aplique (sobre todo: tokens, helpers de cuenta activa, creación del movimiento al completar obligación, mensajes de errores).
- Cambios mínimos necesarios: no refactors masivos de navegación.

---

## Definition of Done (DoD)
### Mobile
- [ ] La “pestaña Cuenta” desaparece del tab bar. La información de cuenta se accede desde **Ajustes** (misma info que en web).
- [ ] Pantalla “Detalle de cuenta” respeta **safe area** y no se solapa con UI nativa; incluye botón “Atrás” visible.
- [ ] En “Movimientos”, se elimina el botón inline de añadir y se crea un **FAB** bottom-right.
- [ ] En la cabecera/row superior de Movimientos: **filtro por mes a la izquierda** y **botón de añadir (FAB / trigger) a la derecha** (manteniendo el FAB como acción principal).
- [ ] Manejo de conectividad: si offline / timeout / fetch fail ⇒ toast/banner no intrusivo + CTA “Reintentar”.

### Web
- [ ] Añadir botón **Filtros** con el mismo patrón que móvil (misma intención y copy).
- [ ] En menú “Cuenta” (o sección equivalente), añadir:
  - “Cuenta Activa” → muestra detalles de cuenta.
  - “Cambiar cuenta” → acceso a selector de cuenta.
- [ ] Unificar colores verde/rojo con tokens compartidos (sin cambiar el valor actual de mobile; web se adapta a shared).

### Web y Mobile (común)
- [ ] Completar una obligación crea un movimiento reflejado en “Movimientos” (sin duplicados).
- [ ] Post-login default route: ir a **Selección de cuenta**; esa pantalla incluye CTA para **Crear cuenta nueva**.
- [ ] Usuario invitado por email **no expira** (sin `expires_at` aplicable o no se bloquea por expiración).
- [ ] Cambio entre cuentas: transición suave (loading state sutil, sin saltos, sin pantallas en blanco), datos consistentes.

---

## Tareas detalladas

### 1) Mobile — Mover “Cuenta” dentro de “Ajustes”
- Actualizar tab navigation:
  - Eliminar tab “Cuenta”.
  - En tab “Ajustes”, crear una sección “Cuenta” con:
    - Detalle de cuenta (misma info que web: nombre, moneda base, miembros/roles si aplica, etc.).
    - Acciones relacionadas (ver detalle, cambiar cuenta).
- Reutilizar componentes/queries existentes si ya hay “account details” en web; si no existe en shared, crear **modelo y adaptadores** mínimos compartidos.

**Aceptación**
- Se accede a toda la info de cuenta desde Ajustes.
- No hay duplicación de lógica de “cuenta activa” entre web y mobile (centralizar en `shared` si existe patrón).

---

### 2) Mobile — Detalle de cuenta: safe area + back
- Asegurar `SafeAreaView` / `useSafeAreaInsets()` en la pantalla de detalle.
- Evitar que el contenido quede por debajo del header nativo.
- Añadir botón “Atrás”:
  - Preferible usando navegación nativa (header back) si expo-router/react-navigation lo soporta.
  - Si hay header custom, incluir botón back visible y accesible.

**Aceptación**
- En iOS/Android (incluyendo notch), no se pisa la UI del sistema.
- Volver atrás funciona siempre.

---

### 3) Mobile — Movimientos: convertir “Añadir” en FAB + ajustar layout superior
- Eliminar botón inline actual.
- Crear FAB:
  - Posición: esquina inferior derecha.
  - Estilo: sobrio, sin colores chillones; usar `color.action.primary` para fondo y `color.bg.primary`/`color.text.primary` según contraste (desde tokens). :contentReference[oaicite:6]{index=6}
  - Sombra/elevación ligera (sin exagerar; “herramienta doméstica”). :contentReference[oaicite:7]{index=7}
- En el header row de Movimientos:
  - Filtro por mes a la izquierda.
  - Un control a la derecha que sea coherente con el FAB (por ejemplo, icono “+” que hace scroll/focus al FAB o abre el mismo sheet/panel; pero el FAB sigue siendo la acción principal).

**Aceptación**
- FAB presente y clickable.
- No tapa listas ni contenido importante (respetar safe area bottom).

---

### 4) Web — Botón “Filtros” como en móvil
- Añadir botón “Filtros” (misma intención y copy).
- El comportamiento debe ser consistente con el patrón del producto:
  - Panel lateral inline (no modal dramático) o sección expandible sobria. :contentReference[oaicite:8]{index=8}
- Mantener jerarquía por layout/espaciado; no por color.

**Aceptación**
- Existe control claro de filtros y no rompe layout.

---

### 5) Tokens compartidos: verde/rojo web↔mobile (preservar mobile)
- Revisar dónde web usa verde/rojo hardcoded o tokens propios.
- Alinear a tokens semánticos:
  - `color.state.positive`
  - `color.state.negative`
- Fuente de verdad: `packages/shared` (theme/tokens).
- **No cambiar valores actuales en mobile**: si hay divergencia, ajustar web para consumir los tokens compartidos que ya representan el comportamiento mobile. :contentReference[oaicite:9]{index=9}

**Aceptación**
- Ningún verde/rojo hardcoded en web para estados (usa tokens).
- Mobile no cambia visualmente.

---

### 6) Web — Detalles de la cuenta + Cambiar cuenta en menú
- En el área “Cuenta”:
  - Sub-sección “Cuenta Activa”: muestra detalles (nombre, moneda, miembros básicos, etc.).
  - Sub-sección “Cambiar cuenta”: abre selector.
- Reusar el mismo “AccountSwitcher” conceptual en web y mobile (misma lógica, diferentes layouts).

**Aceptación**
- Navegación clara: no hay que “adivinar” dónde está la cuenta activa.
- Selector accesible en 1–2 clicks.

---

### 7) Web & Mobile — Completar obligación ⇒ crear movimiento
**Regla de negocio**
- Cuando una obligación pasa a “completada/pagada”, se crea automáticamente una transacción (movimiento) asociada:
  - Ideal: `transaction.obligation_id` (si existe) o metadata equivalente.
  - Debe ser **idempotente**: completar dos veces no crea duplicados.

**Implementación sugerida (elige la más segura con tu arquitectura actual)**
- Opción A (preferida): acción en servidor / RPC que:
  1) Marca obligación como completada.
  2) Upsert de transacción vinculada por `obligation_id` (unique constraint).
- Opción B: trigger DB (si ya hay infraestructura para ello) con constraint de unicidad.

**Aceptación**
- Al completar obligación, el movimiento aparece en “Movimientos” sin refrescos raros.
- Si se desmarca/revierte, definir comportamiento:
  - v1 simple: no borrar automáticamente el movimiento; mostrar aviso o mantener consistencia mínima.
  - Documentar decisión en código.

---

### 8) Web & Mobile — Default route: Selección de cuenta (con crear nueva)
- Hoy: redirige a onboarding por defecto.
- Nuevo flow post-login:
  - Si el usuario tiene 0 cuentas: ir a **Selección de cuenta** en estado vacío con CTA “Crear cuenta nueva” (esto reemplaza el onboarding como landing).
  - Si tiene 1+: ir a selección (o auto-seleccionar la última usada y permitir cambiar; decide según estructura actual, pero la pantalla debe existir y ser accesible).
- Persistir `activeAccountId` (web localStorage / mobile secure store) y validarlo en arranque.

**Aceptación**
- Nunca te “manda” a onboarding si ya tienes cuentas.
- Puedes crear cuenta nueva desde selección.

---

### 9) Web & Mobile — Invitado por email sin expiración
- Identificar flujo “invitar por email” y dónde se aplica expiración.
- Cambiar modelo/regla:
  - Si la invitación es por email (o el miembro ya existe como `account_member`), no hay expiración que bloquee el acceso.
  - Si se mantiene tabla de invites: `expires_at` puede ser `NULL` o ignorado para este tipo; asegurar lógica y UI coherentes.

**Aceptación**
- Un invitado por email no pierde acceso por fecha.
- No rompe seguridad (RLS sigue mandando).

---

### 10) Web & Mobile — Network connectivity: graceful handling
- Añadir capa común:
  - Detectar offline:
    - Mobile: `@react-native-community/netinfo` (o equivalente).
    - Web: `navigator.onLine` + listeners `online/offline`.
  - En errores de red (fetch/supabase):
    - Mostrar banner/toast sobrio: “Sin conexión. Revisa tu red y vuelve a intentar.”
    - CTA: “Reintentar”.
    - Evitar loops agresivos; usar backoff suave.

**Aceptación**
- Los fallos de red no rompen pantallas (sin crashes).
- El usuario entiende qué pasa y cómo salir.

---

### 11) Web & Mobile — Mejorar UX al cambiar entre cuentas
- Objetivo: cero “pantalla en blanco” y cero jumps.
- Propuesta:
  - Mantener UI estable y mostrar loading state local (skeleton suave o shimmer mínimo).
  - Prefetch datos de la cuenta destino cuando se abre el selector.
  - Cancelar requests anteriores al cambiar (si tu stack lo permite).
  - Animación corta, funcional, sin rebotes. :contentReference[oaicite:10]{index=10}

**Aceptación**
- Cambiar cuenta se siente continuo.
- No hay parpadeos ni estados inconsistentes (por ejemplo, transacciones de otra cuenta mezcladas).

---

## Entregables
- PR 1: Navegación móvil + safe area + back en detalle cuenta.
- PR 2: FAB en Movimientos (mobile) + botón filtros (web).
- PR 3: Tokens positivos/negativos unificados en `shared` y consumidos por web.
- PR 4: Cuenta Activa + Cambiar cuenta (web) + selector compartido (lógica en shared).
- PR 5: Completar obligación crea movimiento (idempotente) + UI refleja el cambio.
- PR 6: Default route a selección de cuenta + crear cuenta nueva desde ahí.
- PR 7: Invitados por email sin expiración.
- PR 8: Network handling + UX switching cuentas pulido.

---

## Notas finales para implementación
- Si hay copy nuevo (mensajes de red, labels de “Cuenta Activa”, “Cambiar cuenta”, etc.), centralizar en `packages/shared` (sin acoplar a librerías i18n; exportar strings/keys).
- Añadir tests mínimos donde sea crítico (idempotencia obligación→movimiento, selector cuenta).
