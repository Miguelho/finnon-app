# Plan: display_name — recogida, avatar, edicion en ajustes

## Context
La app de finanzas compartidas necesita identificar visualmente a cada miembro. Actualmente `getAvatarInitials` usa el email, produciendo iniciales identicas ("RE") para los demo (review@, review2@). Los usuarios por email no tienen `display_name`, sin forma de dirigirse a ellos por nombre ni diferenciarlos. Se necesita: (1) recoger el nombre al primer acceso, (2) editarlo en ajustes, (3) usarlo en avatares.

---

## Parte A: Pantalla de nombre al primer acceso

### A1. Check en el flujo auth
Tras login, antes de mostrar la app o el onboarding, comprobar `profiles.display_name`. Si es null → redirigir a `name-setup`.

- **Mobile:** `apps/mobile/app/(auth)/_layout.tsx`
- **Web:** `apps/web/src/app/(auth)/layout.tsx` (o equivalente)

### A2. Pantalla NameSetup (mobile)
**Nuevo:** `apps/mobile/app/(auth)/name-setup.tsx`
- Titulo: "¿Como te llamas?" / Input + boton Continuar
- Guardar: `supabase.auth.updateUser({ data: { display_name: name, full_name: name } })`
  - El trigger `handle_user_update` sincroniza a `profiles.display_name`
  - Se setea `full_name` tambien para que el COALESCE del trigger lo pille siempre
- Despues: navegar al flujo normal (onboarding o home)

### A3. Pantalla NameSetup (web)
**Nuevo:** `apps/web/src/app/(auth)/name-setup/page.tsx` — misma logica con Tailwind

### A4. i18n
**Archivos:** `packages/shared/src/copy/locales/{es,en}.ts`
```
nameSetup.title / nameSetup.subtitle / nameSetup.label / nameSetup.placeholder / nameSetup.continue
```

---

## Parte B: Edicion del nombre en ajustes

### B1. Mobile: `apps/mobile/app/(auth)/settings/user-details.tsx`
- Añadir `display_name` a `ProfileRow` y query `.select()`
- Añadir `displayName` a `ProfileState`
- Campo de texto editable en seccion avatar (debajo del email)
- Guardar: `supabase.auth.updateUser({ data: { display_name, full_name } })`

### B2. Web: `apps/web/src/components/settings/user-profile-screen.tsx`
- Mismos cambios

### B3. i18n
```
settings.userProfile.displayName.label / .placeholder / .hint
settings.userProfile.errors.saveDisplayName
```

---

## Parte C: Avatar initials con display_name

### C1. Funcion core: `packages/shared/src/domain/settings/user-profile.ts`
- Añadir parametro opcional `displayName?: string | null` a `getAvatarInitials`
- 2+ palabras → primera + ultima inicial ("AG")
- 1 palabra → primeros 2 chars ("AN")
- Fallback → email (logica actual)

### C2. UserAvatar (mobile): `apps/mobile/src/components/UserAvatar.tsx`
- Añadir prop `displayName`, pasar a `getAvatarInitials(email, displayName)`

### C3. UserAvatar (web): `apps/web/src/components/user-avatar.tsx`
- Mismos cambios

### C4. AppHeaderAvatar: `apps/mobile/src/components/navigation/AppHeaderAvatar.tsx`
- Añadir `display_name` a query y pasar como prop a UserAvatar

### C5. Inline avatars en user-details (mobile + web)
- Pasar `displayName` a `getAvatarInitials()` en avatar principal e invitadores
- Añadir `display_name` a query de `InviterProfile`

---

## Parte D: Seed — emails y colores

**Archivo:** `apps/web/scripts/seed-demo-accounts.ts`

- Emails: `ana@`, `carlos@`, `alex@`, `jamie@` (en vez de review)
- Colores: Ana=blue, Carlos=coral, Alex=green, Jamie=purple
- Añadir `ensureProfileAvatarColor(userId, color)` que haga update en `profiles.avatar_color`

---

## Archivos (13 total)
| # | Archivo | Accion |
|---|---------|--------|
| 1 | `packages/shared/src/copy/locales/es.ts` | i18n keys |
| 2 | `packages/shared/src/copy/locales/en.ts` | i18n keys |
| 3 | `packages/shared/src/domain/settings/user-profile.ts` | `getAvatarInitials` |
| 4 | `apps/mobile/app/(auth)/name-setup.tsx` | **NUEVO** |
| 5 | `apps/mobile/app/(auth)/_layout.tsx` | check display_name |
| 6 | `apps/mobile/src/components/UserAvatar.tsx` | add prop |
| 7 | `apps/mobile/src/components/navigation/AppHeaderAvatar.tsx` | fetch+pass |
| 8 | `apps/mobile/app/(auth)/settings/user-details.tsx` | edit name |
| 9 | `apps/web/src/app/(auth)/name-setup/page.tsx` | **NUEVO** |
| 10 | `apps/web/src/app/(auth)/layout.tsx` | check display_name |
| 11 | `apps/web/src/components/user-avatar.tsx` | add prop |
| 12 | `apps/web/src/components/settings/user-profile-screen.tsx` | edit name |
| 13 | `apps/web/scripts/seed-demo-accounts.ts` | emails+colores |

## Verificacion
1. `npx tsx scripts/seed-demo-accounts.ts` → 4 usuarios con emails de nombre
2. Login nuevo sin nombre → pantalla "¿Como te llamas?"
3. Rellenar → redirige a onboarding/home
4. Avatares: AG, CG, AS, JS
5. Ajustes: campo nombre editable → avatar se actualiza
6. Aceptar invitacion sin nombre → pantalla nombre antes de entrar
