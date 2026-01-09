# Flujo de Magic Link en Finnon

## Flujo principal

```
Usuario ’ /login ’ Email ’ Click link ’ /api/auth/verify ’ Home (/)
```

## 1. Solicitud del Magic Link

En `apps/web/src/app/login/page.tsx`, el usuario ingresa su email y se llama:

```typescript
supabase.auth.signInWithOtp({
  email,
  options: {
    emailRedirectTo: `${origin}/auth/confirm`,
    shouldCreateUser: true,
  },
});
```

## 2. Email enviado

Supabase usa el template `supabase/templates/magic_link.html` que genera un link:

```
http://[SiteURL]/api/auth/verify?token=[TOKEN]&type=magiclink&email=[EMAIL]
```

## 3. Verificación del token

El endpoint `apps/web/src/app/api/auth/verify/route.ts`:

1. Extrae `token`, `type`, `email` de los query params
2. Llama directamente a `http://127.0.0.1:54321/auth/v1/verify` (Supabase local)
3. Si es válido, establece cookies de sesión (`sb-{projectRef}-auth-token`)
4. Redirige al home (`/`)

## 4. Middleware de protección

`apps/web/src/middleware.ts` verifica en cada request:

- Si el usuario tiene sesión válida
- Si tiene membresías de cuenta asignadas
- Rutas públicas: `/login`, `/auth/callback`, `/auth/confirm`, `/join`

## Configuración relevante

En `supabase/config.toml`:

| Parámetro | Valor |
|-----------|-------|
| OTP expira en | 1 hora |
| Emails/hora máx | 2 |
| Verificaciones/5min | 30 |
| Site URL | `http://192.168.1.100:3000` |

## Alternativa: OTP manual

También existe `apps/web/src/app/login-otp/page.tsx` donde el usuario puede ingresar el código de 6 dígitos manualmente en lugar de hacer click en el link.

## Archivos clave

| Archivo | Propósito |
|---------|-----------|
| `apps/web/src/app/login/page.tsx` | Formulario para solicitar magic link |
| `apps/web/src/app/login-otp/page.tsx` | Alternativa: OTP manual de 6 dígitos |
| `apps/web/src/app/auth/confirm/page.tsx` | Verifica sesión después de magic link |
| `apps/web/src/app/api/auth/verify/route.ts` | Verifica token de magic link |
| `supabase/templates/magic_link.html` | Template HTML del email |
| `supabase/config.toml` | Configuración Supabase |
| `apps/web/src/middleware.ts` | Protección de rutas autenticadas |
