Feature 21: Invitaciones in-app (sin links) + código corto
Contexto

Finnon tiene un flujo de invitación “clumsy” porque depende de abrir un enlace enviado desde web (y en móvil falla / obliga a salir de la app). Necesitamos un flujo donde el usuario invitado acepte la invitación desde dentro de la app y después pueda navegar libremente a la cuenta invitada desde el selector de cuentas.

Objetivo (Outcome)

El invitado no necesita abrir enlaces.

Las invitaciones aparecen dentro de Finnon (web y móvil).

Al aceptar, la cuenta aparece en el selector de cuentas y se puede entrar/salir libremente.

1) Alcance funcional
1.1 Flujo principal (Opción A): “Bandeja de invitaciones” in-app

Admin (web):

Desde Account/Settings > “Compartir cuenta”:

Input email

Selector rol: viewer | contributor | admin

Botón “Enviar invitación”

Se crea un registro de invitación en DB (invites) con:

account_id

invited_email

role

status = pending

expires_at (p.ej. +14 días)

created_by

Invitado (móvil + web):

Inicia sesión normal (email OTP/magic link existente).

En Home y/o en selector de cuentas: si hay invitaciones pendientes para user.email:

Mostrar una tarjeta discreta “Invitación pendiente”

Pantalla/Sheet “Invitaciones”:

Lista de invitaciones con: nombre cuenta, rol, quién invita, expiración

Acciones: “Aceptar” / “Rechazar”

Al aceptar:

Se crea/asegura membership en account_members

Se marca la invitación como accepted

Se refresca selector de cuentas y la cuenta aparece para navegar

1.2 Escape hatch (Opción B): “Tengo un código”

Admin (web):

Además del email, permitir “Generar código” (opcional) y copiarlo.

Invitado (móvil + web):

Botón “Unirme con código”:

Campo para pegar código (autopaste si está en clipboard si es fácil)

Validar y permitir aceptar

Nota: El código no sustituye al flujo A; es un fallback robusto.

2) Requisitos UX/UI (muy importante)
2.1 Filosofía visual

Nada de modales con overlay oscuro.

Si se usa panel/sheet: sin overlay (o como máximo fondo neutro color.bg.secondary).

Jerarquía con espacio y tipografía, no con color.

2.2 Tokens obligatorios (no hardcodear colores)

Usar tokens del doc /mnt/data/color-guide.md:

color.bg.primary, color.bg.secondary, color.bg.surface

color.text.primary, color.text.secondary, color.text.muted

color.action.primary, color.action.secondary, color.action.disabled

color.state.positive, color.state.negative, color.state.neutral

2.3 Ubicación del entry-point

En selector de cuentas: badge/row “Invitaciones (N)”.

En Home: tarjeta compacta si hay invitaciones.

2.4 Microcopy (tono humano, no técnico)

“Te han invitado a esta cuenta”

“Aceptar invitación”

“Rechazar”

“Caduca el …”

Evitar “permisos”, “usuarios”, “roles avanzados” (pero sí mostrar rol con palabras simples: “Solo ver”, “Puede añadir”, “Admin”)

3) Modelo de datos (Supabase)
3.1 Migración: invites (ampliar o crear)

Si ya existe invites, modificar. Si no, crear.

Campos:

id uuid primary key default gen_random_uuid()

account_id uuid not null references accounts(id) on delete cascade

invited_email text not null

role text not null check (role in ('viewer','contributor','admin'))

status text not null default 'pending' check (status in ('pending','accepted','rejected','revoked','expired'))

code text null (código corto legible) — solo si implementas Opción B

code_hash text null (hash del código, si decides no guardar code plano)

expires_at timestamptz not null

created_by uuid not null references auth.users(id)

created_at timestamptz not null default now()

responded_at timestamptz null

Índices:

idx_invites_account_id

idx_invites_invited_email_status (por invited_email + status)

idx_invites_code_hash (si aplica)

3.2 Membership

account_members(account_id, user_id, role, created_at)
Asegurar unique constraint (account_id, user_id).

4) Seguridad (RLS + endpoints)
4.1 RLS
Invites

SELECT:

Admins de la cuenta pueden ver todas las invitaciones de su cuenta.

El invitado puede ver invitaciones donde invited_email = auth.email() y status='pending'.

INSERT:

Solo admin de la cuenta puede crear invitaciones.

UPDATE:

Admin puede revoke.

Invitado puede cambiar status a accepted|rejected solo si invited_email = auth.email() y está pending.

Nadie puede cambiar account_id ni invited_email.

Si auth.email() no es viable en tu setup, entonces el accept/reject debe ir vía API server con validación fuerte.

4.2 Server actions / API (recomendado para aceptar/rechazar)

Implementar endpoints server-side (Next.js) para evitar edge-cases con RLS/email:

POST /api/invites/accept body: { inviteId }

POST /api/invites/reject body: { inviteId }

POST /api/invites/join-by-code body: { code } (opcional)

Validaciones en server:

Usuario autenticado

Invite existe, pending, no expirado

invite.invited_email == user.email

En accept: upsert membership (y rol de invite)

Update invite status + responded_at

5) UI — Web (Next.js)
5.1 Componentes

InvitesBadge (para menu/selector de cuentas)

InvitesList (pantalla o panel)

InviteCard (cuenta, rol humanizado, expira, acciones)

5.2 Pantallas

En “Cuenta/Account”: sección “Compartir” con formulario:

Email + rol + CTA “Enviar invitación”

Lista de invitaciones enviadas (pending/accepted) con acción “Revocar” para pending

5.3 Estados

Loading skeleton discreto

Empty state: “No hay invitaciones”

Error: texto contenido con color.state.negative, sin banners agresivos

6) UI — Móvil (Expo RN)
6.1 Entry-points

En Home: card compacta si hay pending invites

En selector de cuentas: row “Invitaciones (N)”

6.2 Navegación

Pantalla Invitations (stack normal) o bottom sheet sin overlay oscuro

Al aceptar/rechazar, volver al selector de cuentas o mantener lista con refresh

6.3 Unirme con código (opcional)

Pantalla simple con input + CTA

Mensajes de error discretos (“Código no válido o caducado”)

7) Shared package

Tipos Invite, InviteStatus, MemberRole

Helpers:

humanizeRole(role) => “Solo ver / Puede añadir / Admin”

isExpired(expiresAt)

8) Integración selector de cuentas (crítico)

Tras aceptar:

invalidar cache / refetch lista de cuentas

la cuenta invitada debe aparecer y poder seleccionarse

Si ya existe una “Cuenta Activa”, no forzar cambio automático (preferible mostrar toast suave: “Cuenta añadida al selector”).

9) Definición de Hecho (DoD)

 Un admin puede invitar por email desde web.

 El invitado ve la invitación dentro de Finnon (web y móvil) sin usar links.

 Aceptar crea membership y la cuenta aparece en selector.

 Rechazar oculta la invitación y queda auditado.

 Expiración gestionada (no permite aceptar si está expirada).

 RLS/validación impide aceptar invitaciones de otros emails.

 Tests mínimos:

unit: humanizeRole, isExpired

integration: accept invite -> membership created

 No se introducen colores hardcodeados; usar tokens del doc.

10) Entregables técnicos

Migración SQL supabase: invites + índices + constraints.

Policies RLS o endpoints server + service role (solo server) según tu arquitectura actual.

Web UI: formulario invitar + lista invitaciones + badge.

Mobile UI: bandeja invitaciones + entry-points.

Integración selector de cuentas: refresh tras aceptar.

Documentación breve en README: flujo + decisiones.