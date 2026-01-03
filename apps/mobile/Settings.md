Settings como menú (Mobile + Web) con copy en shared
Contexto

Existe ya una pantalla de Settings en mobile que muestra invitaciones, pero ahora debe convertirse en un menú.

Debe existir la misma pantalla/estructura en mobile y web (“app”), con mismo wording.

La lógica de negocio y el copy deben vivir en packages/shared.

shared NO puede acoplarse a una librería concreta de i18n (ni i18next, ni expo-localization, etc.). Debe exportar contenido neutro y tipado.

La UI debe seguir los principios de “diseño silencioso” y continuidad (sin dramatismos, jerarquía por espacio, no por color). 

design-principles

 

ux-approach

Usar tokens de color existentes, sin hardcodear hex. 

color-guide

Objetivo

Implementar una pantalla Settings (menú) en mobile y web, con dos secciones:

Detalles de usuario

Invitaciones

Alcance (Scope)

Settings menú (pantalla raíz)

Muestra un layout tipo “lista de items” con secciones.

Cada item navega a una subpantalla:

User details

Invitations

User details (subpantalla)

Muestra info básica del usuario logueado (ej.: email; opcional: nombre si existe).

Sin edición (v1). Solo lectura.

Invitations (subpantalla)

Reutiliza la pantalla/listado existente de invitaciones en mobile (si ya existe), pero con el estilo alineado al resto.

Añadir estados: loading / vacío / error, con copy compartido.

No objetivos (Non-goals)

No añadir features nuevas (editar perfil, cambiar contraseña, borrar cuenta, etc.).

No rediseñar navegación global.

No introducir nuevos tokens de color ni estilos “llamativos”. 

design-principles

 

color-guide

Requisitos de arquitectura (obligatorios)
1) Copy + wording en packages/shared

Crear un módulo de copy neutral, tipado y sin dependencia de i18n:

packages/shared/src/copy/index.ts

Exporta copy (objeto por locale) + tipos Locale, Copy.

Exporta helper t(locale, key) simple (lookup por path) o alternativa equivalente sin librerías.

Ejemplo de keys mínimas (puedes ajustar nombres, pero mantener estructura):

settings.title

settings.sections.user.title

settings.sections.user.items.details.title

settings.sections.user.items.details.description

settings.sections.invites.title

settings.sections.invites.items.list.title

settings.sections.invites.items.list.description

userDetails.title

userDetails.fields.email

invites.title

invites.empty.title

invites.empty.body

common.loading

common.error.generic

common.retry

Regla: En apps/mobile y apps/web está prohibido hardcodear strings de UI para Settings (salvo textos técnicos de logs).

2) Lógica de negocio compartida (sin acoplar a Supabase)

En packages/shared crear view-model mappers y tipos que no dependan del cliente de datos:

packages/shared/src/domain/settings/*

mapUserToUserDetailsVM(user): UserDetailsVM

mapInvitesToInvitesVM(invites): InviteItemVM[]

Utilidades de formato (fechas/estado) si aplica, pero sin depender de libs platform.

El acceso a datos (Supabase/HTTP) queda en apps/*, pero el shape final que consume la UI (VM) se arma con helpers de shared.

Requisitos UX/UI (obligatorios)

Menú sobrio, sin colores “de botones” ni emojis.

Jerarquía por espaciado y tipografía, no por color. 

design-principles

Nada de overlays dramáticos/modales innecesarios en Settings. 

ux-approach

Colores solo desde tokens (light/dark) ya definidos. 

color-guide

Patrón visual recomendado:

Pantalla con título.

Secciones con header discreto.

Items tipo “row”: icono (si existe set), label, sublabel, chevron.

Divisores usando color.state.neutral.

Implementación por plataforma
A) Mobile (Expo Router)

Rutas:

apps/mobile/app/(tabs)/settings/index.tsx → menú

apps/mobile/app/(tabs)/settings/user-details.tsx

apps/mobile/app/(tabs)/settings/invitations.tsx

Menú:

Renderizar 2 secciones: Usuario / Invitaciones.

Cada sección con 1 item (por ahora), pero dejar estructura escalable.

User details:

Leer usuario desde tu AuthContext/useAuth() existente.

Transformar a VM usando shared.

Mostrar campos con labels desde shared copy.

Invitations:

Reutilizar lógica de fetch existente.

Copys de empty/loading/error desde shared.

Convertir invitaciones a VM con shared.

B) Web (Next.js)

Rutas:

/settings → menú

/settings/user → user details

/settings/invitations → invitaciones

Misma estructura visual y mismo copy (desde shared).

Definition of Done (DoD)

 Existe menú de Settings en mobile y web con dos secciones: Detalles de usuario e Invitaciones.

 El wording de Settings (títulos, secciones, vacíos, errores) vive en packages/shared y se consume desde ambas apps.

 packages/shared no depende de ninguna librería i18n ni de Supabase.

 UI usa tokens de color (sin hex hardcode). 

color-guide

 Invitaciones mantiene funcionalidad existente y añade estados (loading/vacío/error) con copy compartido.

 No hay emojis, ni botones con colores saturados; look&feel silencioso y consistente. 

design-principles

 Typecheck y lint pasan.

Guardrails (importante)

No introducir nuevos colores/tokens. 

color-guide

No meter strings en UI: todo sale de shared.

No acoplar shared a expo-router, next/navigation, i18next, react-intl, etc.

Si falta un texto, se añade en shared con su key y fallback.

Mantener Settings como “herramienta doméstica”: cero dramatismo visual. 

design-principles

 

ux-approach

Entregables concretos

packages/shared:

src/copy/* (locales + tipos + helper t)

src/domain/settings/* (VM mappers + tipos)

apps/mobile:

Pantallas: settings menu + user-details + invitations

Uso de shared para copy y VM

apps/web:

Páginas: settings menu + user + invitations

Uso de shared para copy y VM

Tests mínimos (si tenéis infra):

unit tests para t() y mappers VM (opcional pero recomendado).