# finnon — Roadmap v1 + Prompts para agente de código

## Stack decidido (mínimo ops + free para despegar)
- **Web + backend**: Next.js en **Vercel (free)**
- **DB SQL + Auth + Storage**: **Supabase (free tier)** con Postgres + RLS
- **Mobile**: Expo / React Native (online-first)
- **PDF bonito**: endpoint serverless en Next.js usando **@react-pdf/renderer**
- **Invitados sin autenticar (v1)**: invite link + “guest session”
- **Cancelación de suscripciones**: directorio de links (catálogo)

---

## Roadmap v1 (orden por impacto / dependencia)

### Fase 0 — Bootstrap (1–2 días)
1) Monorepo (web + mobile + shared)  
2) CI mínimo (lint/typecheck) y variables de entorno  
3) UI base “lean” (tokens, tipografía, layout)

### Fase 1 — Datos + seguridad (1–2 días)
4) Esquema Postgres (accounts, members, categories, transactions, attachments, invites, subscriptions_catalog)  
5) **RLS** y policies: nadie toca datos fuera de su `account_id`  
6) Seed mínimo (categorías + catálogo de suscripciones)

### Fase 2 — Auth + onboarding (1–2 días)
7) Login (email OTP / magic link)  
8) Crear cuenta (account) + seleccionar moneda base  
9) Selección de cuenta (si el usuario tiene varias)

### Fase 3 — Core money manager (3–5 días)
10) CRUD de categorías  
11) CRUD de transacciones (income/expense), listado, filtros  
12) Resumen mensual simple (total income/expense, balance)

### Fase 4 — Compartir cuenta + invitados (3–5 días)
13) Invites: generar link, roles (viewer/contributor/admin)  
14) Join flow (autenticado o guest) + permisos  
15) Auditoría mínima: `created_by`, timestamps

### Fase 5 — Fotos en gastos (2–3 días)
16) Subida a Supabase Storage + tabla `attachments`  
17) UI: añadir/ver fotos en transacción

### Fase 6 — Suscripciones + directorio (1–2 días)
18) Pantalla “Suscripciones” con iconografía  
19) “Cancelar” abre link del directorio (por país)

### Fase 7 — Export PDF bonito (2–4 días)
20) Endpoint `/api/export/pdf?accountId&month=YYYY-MM`  
21) Plantilla PDF clean (tabla, totales, categorías, portada ligera)  
22) Descargar/compartir (web descarga; móvil share sheet)

> Nota: alertas/límites/recordatorios los dejaría como v1.1. Esta v1 ya te pone en el aire rápido y ordenado.

---

# Prompts pasteables para tu agente de código

## Prompt 01 — Crear monorepo finnon (Next + Expo + shared)
**Objetivo:** Crear un monorepo con `apps/web` (Next.js) y `apps/mobile` (Expo) y `packages/shared` (tipos + zod).  
**Stack:** TypeScript, pnpm, turborepo.  
**Entregables:**
- Estructura de carpetas + config de workspace
- Scripts: `dev`, `lint`, `typecheck`, `test` (aunque sea placeholder)
- `packages/shared`: `zod` schemas para `Transaction`, `Category`, `Account`
**Criterios de aceptación:**
- `pnpm dev` levanta web y mobile
- `pnpm typecheck` pasa sin errores

---

## Prompt 02 — Integración Supabase en web + mobile (sin lógica de negocio aún)
**Objetivo:** Añadir clientes de Supabase para web y móvil, con manejo seguro de env vars.  
**Restricciones:**
- `SUPABASE_URL` y `SUPABASE_ANON_KEY` en ambos.
- `SUPABASE_SERVICE_ROLE_KEY` **solo** en server (web).
**Entregables:**
- `apps/web/src/lib/supabaseClient.ts` (browser) y `apps/web/src/lib/supabaseServer.ts` (server)
- `apps/mobile/src/lib/supabase.ts`
- Ejemplo mínimo: “ping” que lea `healthcheck` o haga `auth.getSession()`
**Aceptación:**
- Compila en web y móvil
- No expone service role al cliente

---

## Prompt 03 — Esquema SQL v1 (accounts, members, categories, transactions, attachments, invites, subscriptions)
**Objetivo:** Generar migración SQL para Supabase con tablas y claves.  
**Tablas mínimas:**
- `accounts(id, name, base_currency, owner_user_id, created_at)`
- `account_members(account_id, user_id, role, created_at)`
- `categories(id, account_id, name, icon_id, type, created_at)`
- `transactions(id, account_id, type, amount, currency, amount_base, category_id, date, merchant, notes, created_by, created_at)`
- `attachments(id, transaction_id, account_id, storage_path, mime, size, created_at)`
- `invites(id, account_id, token_hash, role, expires_at, created_at, created_by)`
- `subscriptions_catalog(id, name, icon_id, country, cancel_url, tags jsonb)`
**Entregables:**
- Un archivo `supabase/migrations/001_init.sql`
- Índices recomendados (por `account_id`, `date`, `category_id`)
**Aceptación:**
- SQL ejecuta sin errores
- Foreign keys consistentes
** Notas arquitecto **
- Adición de entornos local y producción
- Utilizar entorno local con Docker para base de datos Supabase

---

## Prompt 04 — RLS completo (seguridad por account_id)
**Objetivo:** Activar RLS y policies para que un usuario solo vea/escriba datos de cuentas donde sea miembro.  
**Reglas:**
- `account_members` decide acceso.
- `transactions/categories/attachments/invites` restringidas por `account_id`.
**Entregables:**
- `supabase/migrations/002_rls.sql`
- Policies para SELECT/INSERT/UPDATE/DELETE donde aplique.
**Aceptación:**
- Con usuario A no puedes leer datos de cuenta B (aunque adivines IDs)
- Inserts requieren membresía

---

## Prompt 05 — Web: auth + onboarding + crear cuenta
**Objetivo:** Implementar login (OTP email) y un onboarding para crear la primera cuenta con moneda base.  
**Entregables:**
- Rutas Next: `/login`, `/onboarding`
- Flow:
  1) login -> session
  2) si no hay `accounts` del usuario -> onboarding
  3) crear `accounts` + `account_members` role=admin
**Aceptación:**
- Usuario nuevo entra y crea cuenta en < 1 min
- Usuario existente va a dashboard

---

## Prompt 06 — Mobile: auth + onboarding equivalente (Expo)
**Objetivo:** Replicar login + onboarding en móvil, con navegación simple.  
**Entregables:**
- Pantallas: Login, Onboarding, Home
- Persistencia de sesión
**Aceptación:**
- Login funcional
- Si no hay cuenta, onboarding obligatorio

---

## Prompt 07 — CRUD categorías (web + mobile) con iconografía “lean”
**Objetivo:** Crear UI y lógica para crear/editar/borrar categorías por cuenta, con selector de icono (`icon_id`).  
**Entregables:**
- `categories` list + create/edit modal
- Componente selector de iconos (lista fija en `shared`)
**Aceptación:**
- CRUD completo
- Solo categorías de la cuenta activa

---

## Prompt 08 — CRUD transacciones (web + mobile) + listados + filtros
**Objetivo:** Registrar ingresos/gastos, listarlos y filtrar por mes/categoría.  
**Requisitos UI:**
- Minimalista: totales arriba, lista clara, colores mínimos
**Entregables:**
- Formulario: amount, date, category, merchant, notes, currency
- Lista por fecha, con “month picker”
- Resumen mensual: income/expense/balance
**Aceptación:**
- Crear transacción y verla reflejada al instante
- Filtro por mes correcto

---

## Prompt 09 — Invites + guest join (Supabase Anonymous Auth) + accept en servidor (Next.js) + RLS
**Objetivo:** Implementar compartir cuenta con link de invitación y permitir acceso sin “registro tradicional”.  
**Diseño propuesto (mínimo fricción):**
- Endpoint server `/api/invites/create` (requiere sesión) → genera token, guarda `token_hash`.
- Ruta `/join?token=...`:
  - Si hay sesión: añade a `account_members`.
  - Si NO hay sesión: crear “guest session”.
**Implementación guest (elige 1 automáticamente y documenta fallback):**
1) Preferida: usar auth anónimo de Supabase (si disponible en SDK) y tratarlo como user real.
2) Fallback: endpoint server crea un usuario “guest” (service role), lo asocia y devuelve un “one-time session token” para usar en el cliente.
**Entregables:**
- DB + lógica para invites (hash + expiración)
- UI en ajustes de cuenta: “Invitar” y roles
- Join flow web + mobile
**Aceptación:**
- Invitado sin cuenta puede entrar y crear gasto si rol contributor
- Revocar invite invalida link


### Objetivo
Implementar compartir cuenta con link de invitación y permitir acceso sin registro tradicional:
- Si el usuario está logueado: acepta invite y se une a la cuenta.
- Si NO está logueado: se crea sesión **anónima** con Supabase Auth y luego acepta invite.
- El alta en la cuenta SIEMPRE ocurre en servidor (Next API route) para validar token y controlar uso.

### Decisiones cerradas (NO proponer alternativas)
- Usar **Supabase Anonymous Auth** para invitados sin login.
- La aceptación del invite se hace en endpoint server **POST /api/invites/accept**.
- Seguridad y permisos por **RLS** + `account_members` (una única fuente de verdad).
- El token del invite se guarda **hasheado** (nunca en claro).

---

## Datos / DB

### Tabla `invites` (si ya existe, ajustar)
Campos mínimos:
- `id uuid pk default gen_random_uuid()`
- `account_id uuid not null references accounts(id) on delete cascade`
- `token_hash text not null unique`
- `role text not null check (role in ('viewer','contributor','admin'))`
- `expires_at timestamptz not null`
- `revoked_at timestamptz null`
- `max_uses int null` (si null = ilimitado)
- `uses_count int not null default 0`
- `created_by uuid not null` (auth uid del creador)
- `created_at timestamptz not null default now()`

Índices:
- `invites(account_id)`
- `invites(token_hash)`

### Tabla `account_members`
Asegurar constraint:
- `unique(account_id, user_id)`

Campos mínimos:
- `account_id uuid`
- `user_id uuid` (auth uid)
- `role text check (role in ('viewer','contributor','admin'))`
- `created_at timestamptz default now()`

---

## RLS (principio)
- `account_members` decide acceso.
- Policies deben permitir:
  - SELECT en `transactions/categories/attachments` solo si existe row en `account_members` para `auth.uid()`.
  - INSERT/UPDATE/DELETE: según rol (mínimo: contributor puede insertar transacciones; admin gestiona invites y members).

### Nota importante
El endpoint server usará `SUPABASE_SERVICE_ROLE_KEY` SOLO para operaciones de aceptación del invite y creación del invite (si aplica). El cliente nunca toca service role.

---

## API Endpoints

### 1) POST /api/invites/create  (requiere sesión)
Request:
- `{ accountId: string, role: 'viewer'|'contributor'|'admin', expiresInHours: number, maxUses?: number|null }`

Server:
- Verifica que `auth.uid()` sea `admin` de la cuenta.
- Genera token aleatorio seguro (32+ bytes).
- Guarda `token_hash = sha256(token)` (o bcrypt, pero sha256 vale si el token es fuerte).
- Devuelve:
  - `{ inviteUrl: "https://<host>/join?token=...", expiresAt, role }`

### 2) POST /api/invites/accept  (requiere sesión; puede ser anónima)
Request:
- `{ token: string }`

Server steps (obligatorio hacerlo transaccional):
1) Obtener `userId = auth.uid()` desde la sesión del request.
2) `tokenHash = sha256(token)`
3) En una transacción:
   - `SELECT * FROM invites WHERE token_hash = tokenHash FOR UPDATE`
   - Validar:
     - existe
     - `revoked_at IS NULL`
     - `expires_at > now()`
     - si `max_uses` no null: `uses_count < max_uses`
   - Upsert miembro:
     - `INSERT INTO account_members(account_id, user_id, role) VALUES (...)`
     - `ON CONFLICT (account_id, user_id) DO UPDATE SET role = EXCLUDED.role` (o mantener rol más alto si ya existe)
   - Incrementar `uses_count = uses_count + 1`
4) Responder:
   - `{ accountId, role }`

Errores:
- 404/400 si token inválido
- 410 si expirado o revocado
- 429/409 si maxUses alcanzado

---

## Client flow (Web + Mobile)

### Ruta /join?token=...
1) Leer token de querystring.
2) `const { data: { session } } = await supabase.auth.getSession()`
3) Si NO hay sesión:
   - `await supabase.auth.signInAnonymously()`
4) Llamar:
   - `POST /api/invites/accept` con `{ token }`
5) Guardar `activeAccountId` en storage (web localStorage / mobile secure-store)
6) Navegar a dashboard / home

### UI mínima
- Pantalla join con estados:
  - loading
  - success (redirige)
  - error (mensaje simple + botón reintentar)

---

## Permisos por rol (v1 mínimo)
- viewer:
  - SELECT todo de su cuenta
- contributor:
  - viewer + INSERT en `transactions` + INSERT en `attachments`
  - UPDATE/DELETE solo de transacciones propias (opcional v1) o permitir update total (más simple, menos granular)
- admin:
  - contributor + gestionar `invites` + gestionar `account_members`

> Para simplificar v1: permitir a contributor UPDATE/DELETE de cualquier transacción de la cuenta. Guardar `created_by` igual para auditoría. Si luego quieres granularidad, se ajusta RLS.

---

## Criterios de aceptación
- Usuario sin login abre un invite link y entra (sesión anónima).
- Puede ver datos de la cuenta (si rol viewer) o crear gastos (si contributor).
- Usuario fuera de la cuenta no puede leer nada (RLS).
- Token:
  - no se guarda en claro en DB
  - expira y puede revocarse
  - respeta `max_uses` si se configura

---

## Prompt 10 — Adjuntar fotos a gastos (Supabase Storage)
**Objetivo:** Permitir subir 1..N fotos a una transacción y mostrarlas.  
**Entregables:**
- Bucket `attachments`
- Subida desde móvil (image picker) y web (file input)
- Guardar metadata en tabla `attachments`
- Vista: carrusel/miniaturas
**Aceptación:**
- Subes foto y se ve
- Permisos respetan `account_id`

---

## Prompt 11 — Suscripciones: pantalla + directorio de cancelación
**Objetivo:** Crear un “catálogo de suscripciones” con iconos y link de cancelación.  
**Entregables:**
- Vista “Suscripciones” con buscador
- Item: icono, nombre, botón “Cancelar” abre `cancel_url`
- Datos desde `subscriptions_catalog` (seed mínimo ES + genérico)
**Aceptación:**
- UX rápida, sin ruido
- Links abren correctamente

---

## Prompt 12 — Exportación PDF “bonita” (serverless Next) + descarga/compartir
**Objetivo:** Generar PDF mensual por cuenta con diseño limpio.  
**Requisitos:**
- Portada ligera: “finnon”, mes, cuenta
- Totales (income/expense/balance)
- Tabla de transacciones + mini resumen por categorías
**Implementación:**
- Endpoint: `/api/export/pdf?accountId&month=YYYY-MM`
- Generación con `@react-pdf/renderer`
**Entregables:**
- PDF render estable (sin fuentes raras)
- Web: botón descarga
- Mobile: botón compartir (share sheet)
**Aceptación:**
- PDF consistente y “presentable”
- Respeta permisos (solo miembros)

---

## Prompt 13 — Pulido v1: navegación, cuenta activa, estados vacíos, errores
**Objetivo:** Quitar asperezas y hacer que se sienta producto.  
**Entregables:**
- Selector de cuenta activa (si hay varias)
- Estados vacíos (sin transacciones, sin categorías)
- Manejo de errores (toasts) + loading states
**Aceptación:**
- No hay pantallas “rotas”
- Flujo completo v1 usable de principio a fin

---
## Prompt 14 — Lógica de monedas y precisión (amount_minor → amount_base_minor) + FX inmutable

### Objetivo
Implementar una lógica robusta y simple (v1 escalable) para manejar importes multi-moneda:
- Guardar importes como **enteros en unidad mínima** (minor units) para evitar errores de coma flotante.
- Calcular y persistir `amount_base_minor` (moneda base de la cuenta) al crear/editar transacciones.
- Guardar y fijar el `fx_rate` aplicado (inmutabilidad del histórico).
- Soportar monedas con diferentes decimales (EUR=2, JPY=0, KWD=3, etc.).

### Decisiones cerradas (NO discutir)
- No usar floats/doubles en ningún lado.
- Representación de dinero en DB: `BIGINT` minor units.
- Convención FX: **1 unidad de `currency` = fx_rate unidades de `base_currency`**.
- Redondeo al convertir: **HALF_UP** (aplicar redondeo UNA sola vez al final).
- Persistir `fx_rate`, `fx_date`, `amount_base_minor` en la transacción. No recalcular automáticamente.

---

## Cambios DB (Supabase Postgres)

### 1) Tabla currency_meta
Crear tabla:
- `currency_meta(code char(3) primary key, minor_units smallint not null)`

Seed mínimo (incluir al menos):
- EUR 2
- USD 2
- GBP 2
- JPY 0
- CHF 2
- PLN 2
- KWD 3
- BHD 3

### 2) Ajustar tabla transactions
Asegurar estos campos (crear o migrar):
- `amount_minor bigint not null`
- `currency char(3) not null`
- `amount_base_minor bigint not null`
- `fx_rate numeric(18,10) not null default 1`
- `fx_date date not null`

Notas:
- Mantener `amount`/`amount_base` legacy solo si ya existían; si no, eliminarlos.
- Index recomendado: `(account_id, date)` y `(account_id, category_id, date)`.

---

## Funciones / utilidades core

### A) Función SQL: minor_units(code)
Crear función SQL estable:
- `get_minor_units(p_code char(3)) returns smallint`
- Lee de `currency_meta` y si no existe: fallback a 2 (solo v1), pero loggear/monitorizar.

### B) Función SQL: compute_amount_base_minor(...)
Crear función SQL:
Inputs:
- `p_amount_minor bigint`
- `p_currency char(3)`
- `p_base_currency char(3)`
- `p_fx_rate numeric(18,10)`  -- convención: 1 currency = fx_rate base_currency

Output:
- `bigint` amount_base_minor

Pseudocálculo:
1) `mu = get_minor_units(p_currency)`
2) `mu_base = get_minor_units(p_base_currency)`
3) `amount_major = p_amount_minor / (10^mu)` como numeric
4) `amount_base_major = amount_major * p_fx_rate`
5) `amount_base_minor = round(amount_base_major * (10^mu_base))`
6) return cast bigint

Regla:
- Redondeo HALF_UP, aplicar SOLO en el paso 5.

---

## Lógica de aplicación (TypeScript)

### C) Utils shared (packages/shared)
Crear utilidades:
1) `parseMoneyToMinor(input: string, currency: string, currencyMeta: Record<string, number>): bigint`
   - Aceptar entradas tipo "12", "12.3", "12,30" (manejo de coma/punto)
   - Validar máximo `minor_units` decimales según moneda
   - Convertir a bigint minor units
2) `formatMinorToMoney(amountMinor: bigint, currency: string, currencyMeta: Record<string, number>): string`
   - Mostrar con decimales correctos (JPY sin decimales)
3) `computeAmountBaseMinor(params)` en TS (misma lógica que SQL) para previsualización en UI.
   - La **fuente de verdad** final es el cálculo en server/DB, pero en UI se usa para preview.

---

## API / Server (Next.js)

### D) Resolución del fx_rate en v1
Implementar función server:
- `resolveFxRate(currency, baseCurrency, date): { fx_rate, fx_date }`

Reglas v1:
- Si `currency == baseCurrency`: `fx_rate=1`, `fx_date = date`
- Si no hay rates aún: usar fallback **manual**:
  - si el request trae `fx_rate` explícito, aceptarlo (validar >0)
  - si no trae, devolver error 400 con mensaje "FX rate required for currency conversion in v1"

(Dejar hook para v1.1: tabla fx_rates + cron import)

### E) Crear/editar transacción
En el endpoint o action de upsert transaction:
1) Obtener `base_currency` de la cuenta
2) Determinar `fx_rate` y `fx_date` (reglas v1)
3) Calcular `amount_base_minor` (usando función SQL o TS server)
4) Insert/Update en `transactions` persistiendo:
   - `amount_minor`, `currency`, `fx_rate`, `fx_date`, `amount_base_minor`

Inmutabilidad:
- Si se edita una transacción:
  - Recalcular `amount_base_minor` SOLO si cambian `amount_minor`, `currency`, `date`, o `fx_rate`.
  - Nunca recalcular por cambios externos de tablas de FX.

---

## UI (Web + Mobile)

### F) Form de transacción (multi-moneda)
- Campo amount (string)
- Selector currency (default base_currency)
- Si currency != base_currency:
  - mostrar campo opcional "FX rate" (v1) + helper text: "1 <currency> = X <base_currency>"
  - mostrar preview de `amount_base_minor` en moneda base usando util TS
- Guardar siempre `amount_minor` (con parse util) y si currency != base -> enviar `fx_rate` (v1)

---

## Criterios de aceptación
- No existe ningún uso de `number` para dinero en lógica persistente (solo para UI temporal, preferible evitar).
- Se puede guardar un gasto en EUR y otro en JPY y los totales cuadran en `amount_base_minor`.
- Para currency == base_currency: `fx_rate=1` y `amount_base_minor == amount_minor` (ajustado a minor units).
- Para currency != base_currency: requiere `fx_rate` en v1; calcula base minor con redondeo HALF_UP.
- Las sumas por mes/categoría se hacen sobre `amount_base_minor` (exactitud).

---

## Entregables
- Migración SQL (currency_meta + ajuste transactions + funciones)
- Utilidades TS en `packages/shared`
- Ajustes en server upsert transaction
- Ajustes UI form (web + mobile) para multi-moneda v1 con `fx_rate` manual
- Tests unitarios mínimos para parse/format/compute con casos:
  - EUR: "12.30" → 1230
  - JPY: "1200" → 1200
  - KWD: "1.234" → 1234 (minor_units=3)
  - Conversión: 1 USD (100) con fx 0.91 a EUR → 91 (según rounding)

## Prompt 15 — Entitlements (Pro/Free) + límites (sin pagos reales)
**Objetivo:** Implementar un sistema centralizado de “capacidades” para el usuario/cuenta, sin integrar pagos aún.

**Definiciones:**
- `Plan = 'free' | 'pro'`
- `Entitlements` (mínimo):
  - `plan: Plan`
  - `pdfExport: { enabled: boolean; monthlyLimit: number | null; watermark: boolean }`
  - `invites: { maxActiveInvites: number | null }`
  - `attachments: { maxPerTransaction: number | null }` (opcional)

**Regla v1:**
- `plan` es siempre `'free'` (hardcoded o flag interno).

**Arquitectura:**
- `packages/shared/entitlements.ts`
  - `getEntitlements({ plan }): Entitlements`
  - constantes de límites (free/pro)

**Criterios de aceptación:**
- Única fuente de verdad para límites.
- Web y móvil consumen la misma lógica, sin duplicación.

---

## Prompt 16 — Paywall / Upgrade screen (fake door) + waitlist
**Objetivo:** Crear pantalla “Pro” presentable y un flujo fake door sin cobro real.

**Requisitos UI:**
- Beneficios claros (PDF ilimitado + compartir cuenta)
- CTA: “Únete a la lista” (email opcional) / “Quiero Pro”
- Al intentar una feature Pro: modal/pantalla con fake door

**Datos (Supabase):**
Crear tabla `waitlist`:
- `id uuid pk`
- `email text null`
- `user_id uuid null`
- `feature text not null` (ej: `pdf_export` | `invites`)
- `platform text not null` (`web`|`android`)
- `created_at timestamptz default now()`

**Backend:**
- Endpoint `POST /api/waitlist` que inserta en `waitlist`.

**Comportamiento:**
- Si el usuario intenta exportar PDF Pro o exceder invites:
  - abrir fake door
  - insertar row en `waitlist` con `feature` correspondiente

**Criterios de aceptación:**
- Fake door se muestra al bloquear features.
- Se guarda intención en `waitlist` con `feature` y `platform`.

---

## Prompt 17 — Eventos mínimos de monetización (sin analytics externo)
**Objetivo:** Registrar eventos clave para validar monetización sin integrar herramientas externas.

**Eventos a capturar:**
- `paywall_viewed`
- `paywall_cta_clicked`
- `feature_blocked` (pdf_export / invites)
- `export_pdf_attempted`
- `invite_create_attempted`

**Datos (Supabase):**
Crear tabla `events`:
- `id uuid pk`
- `event_name text not null`
- `user_id uuid null`
- `account_id uuid null`
- `feature text null`
- `platform text not null`
- `metadata jsonb null`
- `created_at timestamptz default now()`

**Backend:**
- Endpoint `POST /api/events` (o inserción directa si RLS lo permite).

**Client:**
- Helper `trackEvent(name, payload)` para web + mobile.

**Criterios de aceptación:**
- Abrir pantalla Pro genera `paywall_viewed`.
- Cada fake door genera `feature_blocked` con `feature`.

---

## Prompt 18 — Gating real de PDF (free limitado / pro ilimitado) sin pagos
**Objetivo:** Aplicar entitlements a exportación PDF, sin integrar pagos.

**Reglas v1:**
- `plan=free`
- Free:
  - `monthlyLimit = 1`
  - `watermark = true`
- Pro (simulado):
  - `monthlyLimit = null`
  - `watermark = false`

**Datos (Supabase):**
Crear tabla `exports`:
- `id uuid pk`
- `user_id uuid null`
- `account_id uuid not null`
- `month text not null` (formato `YYYY-MM`)
- `created_at timestamptz default now()`

**Backend (Next serverless):**
En `/api/export/pdf`:
1) Determinar `month` (YYYY-MM) por query o por `date` actual.
2) Consultar entitlements.
3) Contar exports del mes en `exports` (por `account_id` y/o `user_id`).
4) Si free y supera límite:
   - responder `403` con `{ code:'PRO_REQUIRED', feature:'pdf_export' }`
5) Si permitido:
   - generar PDF
   - insertar row en `exports`
   - si `watermark=true`: añadir marca “finnon — Free”

**UI:**
- Si respuesta `PRO_REQUIRED`: abrir fake door (Prompt 16) y registrar evento (Prompt 17).

**Criterios de aceptación:**
- Free permite 1 export/mes.
- Segunda export abre fake door.
- El primer PDF tiene marca de agua.

---

## Prompt 19 — Gating real de invites (free: 1 invitado)
**Objetivo:** Limitar invites/miembros en free y activar fake door al exceder.

**Regla v1 (elige UNA y aplica consistentemente):**
- Opción A: `maxActiveInvites = 1`
- Opción B: `maxMembers = 2` (incluyendo owner)

**Implementación recomendada (simple y robusta):**
Gating en servidor en `POST /api/invites/create`:
1) Consultar entitlements.
2) Contar `account_members` o invites activos según regla elegida.
3) Si free y excede:
   - responder `{ code:'PRO_REQUIRED', feature:'invites' }`

**UI:**
- Si `PRO_REQUIRED`: abrir fake door y registrar evento.

**Criterios de aceptación:**
- En free no puedes crear 2º invite (o superar N miembros).
- Se registra `feature_blocked` y se ofrece waitlist.

---

## Prompt 20 — Copy de pantalla Pro (lean y confiable)
**Objetivo:** Redactar copy minimalista para pantalla Pro de finnon (sin agresividad).

**Requisitos:**
- Máximo 3 bullets.
- CTA claro.
- Nota breve: “Estás en Free”.

**Criterios de aceptación:**
- Cabe en pantalla móvil sin scroll excesivo.
- Suena sobrio, no “marketing agresivo”.