# Navegación y Auth (Web + App Móvil)

## Estructura de apps

### apps/web
```text
apps/web
├─ messages
├─ next-env.d.ts
├─ next.config.ts
├─ node_modules
├─ package.json
├─ postcss.config.mjs
├─ src
└─ tsconfig.json
```

### apps/mobile
```text
apps/mobile
├─ Settings.md
├─ app
├─ app.config.js
├─ app.json
├─ assets
├─ babel.config.js
├─ metro.config.js
├─ node_modules
├─ package.json
├─ src
└─ tsconfig.json
```

---

## Router / archivo de rutas

### Web (Next.js App Router)
Rutas base: `apps/web/src/app`

Archivos clave:
- `apps/web/src/app/layout.tsx`
- `apps/web/src/middleware.ts`

Rutas principales detectadas:
```text
apps/web/src/app
├─ page.tsx
├─ login/page.tsx
├─ login-otp/page.tsx
├─ auth/confirm/page.tsx
├─ auth/callback/route.ts
├─ join/page.tsx
├─ select-account/page.tsx
├─ onboarding/page.tsx
├─ invitations/page.tsx
├─ account/page.tsx
├─ goal/page.tsx
├─ transactions/page.tsx
├─ categories/page.tsx
├─ recurrentes/page.tsx
├─ settings/page.tsx
├─ settings/account/page.tsx
├─ settings/account-switch/page.tsx
├─ settings/user/page.tsx
├─ settings/language/page.tsx
├─ settings/invitations/page.tsx
└─ api
   ├─ active-account/route.ts
   └─ profiles/route.ts
```

### App móvil (Expo Router)
Layouts clave:
- `apps/mobile/app/_layout.tsx`
- `apps/mobile/app/(auth)/_layout.tsx`
- `apps/mobile/app/(auth)/(tabs)/_layout.tsx`

Rutas principales:
```text
apps/mobile/app
├─ _layout.tsx
├─ index.tsx
├─ join.tsx
└─ (auth)
   ├─ _layout.tsx
   ├─ login.tsx
   ├─ onboarding.tsx
   ├─ select-account.tsx
   ├─ invitations.tsx
   ├─ account/[id].tsx
   ├─ recurrentes/index.tsx
   ├─ recurrentes/[id].tsx
   ├─ obligations/[id].tsx
   ├─ obligations/create.tsx
   ├─ transactions/_layout.tsx
   ├─ transactions/index.tsx
   ├─ transactions/create.tsx
   ├─ transactions/[id].tsx
   ├─ settings
   │  ├─ index.tsx
   │  ├─ account.tsx
   │  ├─ user-details.tsx
   │  ├─ invitations.tsx
   │  └─ language.tsx
   └─ (tabs)
      ├─ _layout.tsx
      ├─ home
      │  ├─ _layout.tsx
      │  └─ index.tsx
      ├─ transactions
      │  ├─ _layout.tsx
      │  ├─ index.tsx
      │  ├─ create.tsx
      │  └─ [id].tsx
      ├─ goal
      │  ├─ _layout.tsx
      │  └─ index.tsx
      └─ account
         ├─ _layout.tsx
         ├─ index.tsx
         └─ categories
            ├─ index.tsx
            ├─ create.tsx
            └─ [id]/edit.tsx
```

---

## Flujo de auth (dónde se valida si el usuario es nuevo o ya tiene cuenta)

### Web
1. Middleware en `apps/web/src/middleware.ts` permite rutas públicas (`/login`, `/login-otp`, `/auth/callback`, `/auth/confirm`, `/join`).
1. Si la ruta no es pública y no hay usuario Supabase, redirige a `/login` con `redirect` query.
1. En `/login`, se envía OTP con redirect a `/auth/confirm`.
1. En `/login-otp`, se verifica OTP y al éxito navega a `/`.
1. `/auth/confirm` intercambia el `code` por sesión y redirige a `/`.
1. `/auth/callback` maneja el exchange server-side y setea cookies.
1. Ya autenticado, el middleware valida membresía de cuentas y, si no hay, redirige a `/select-account` (excepto `/select-account`, `/onboarding`, `/invitations`).
1. `/select-account` decide: si no hay cuentas, muestra CTA a `/onboarding`.
1. `/onboarding` crea cuenta y redirige a `/select-account`.
1. `/api/active-account` guarda la cuenta activa en cookie.
1. `/` (`apps/web/src/app/page.tsx`) vuelve a chequear:
1. Si no hay user → `/login`
1. Si no hay cuentas → `/select-account`
1. Si no hay cuenta activa → `/select-account`

### App móvil
1. `apps/mobile/app/index.tsx` es el gate:
1. Si no hay sesión → `/(auth)/login`
1. Si no hay cuentas → `/(auth)/select-account`
1. Si no hay `selectedAccountId` → `/(auth)/select-account`
1. Si todo OK → `/(auth)/(tabs)/home`
1. `apps/mobile/src/contexts/AuthContext.tsx` gestiona la sesión y `selectedAccountId` en AsyncStorage.
1. `/(auth)/select-account`:
1. Si no hay cuentas → CTA a `/(auth)/onboarding`
1. Si hay cuentas → selecciona una y guarda `selectedAccountId`
1. `/(auth)/onboarding` crea cuenta y vuelve al gate (`/`).
1. `apps/mobile/app/join.tsx` acepta invitación y setea `selectedAccountId`.

---

## Estructura de @poleursus/shared

Ubicación:
- `packages/shared`
- `packages/shared/src/index.ts`

Carpetas principales:
```text
packages/shared/src
├─ account
├─ add-transaction
├─ auth
├─ categories
├─ constants
├─ copy
├─ date
├─ domain
├─ goals
├─ home
├─ icons
├─ merchants
├─ navigation
├─ recurring
├─ schemas
├─ theme
├─ types
├─ ui
└─ utils
```

Exports destacados desde `packages/shared/src/index.ts`:
- Schemas: `account`, `category`, `transaction`, `invite`, `participant`, `recurring`
- Constantes: `currencies`
- Theme: `theme/tokens`, `theme/typography`
- Auth: `auth/signOut`
- UI: `ui/addMenu`, `ui/confirmation-modal`
- Navegación, goals, home, account, utils, icons, etc.
