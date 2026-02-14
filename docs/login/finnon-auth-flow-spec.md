# Spec: Flujo unificado de autenticación — Finnon Web

## Contexto del problema

El flujo actual de signup con magic link falla cuando el usuario inicia el proceso en un navegador (ej: Safari) y abre el enlace del email en otro (ej: Chrome). PKCE no puede validar el `code_verifier` entre navegadores distintos, lo que deja al usuario en estado zombie: creado en Supabase Auth pero sin `account_members` (onboarding incompleto). Además, si el usuario zombie intenta registrarse de nuevo, `signUp` devuelve error porque el email ya existe, y no puede completar el proceso.

## Objetivo

Reemplazar el flujo actual (pantallas separadas de login/signup) por un **flujo unificado** donde:

1. OTP por código es el método principal en web.
2. Magic link queda como opción secundaria.
3. Los usuarios zombie pueden recuperarse de forma transparente.

---

## Flujo de usuario (web)

### Pantalla única de acceso

- Un solo formulario con campo de email y botón **"Continuar"** (CTA neutro, ni "Registrarse" ni "Iniciar sesión").
- Debajo del botón principal, enlace secundario: **"O envíame un enlace al correo"** (activa el flujo magic link).
- Idioma: respetar la configuración bilingüe existente (ES/EN).

### Flujo principal (OTP código)

```
1. Usuario introduce email → pulsa "Continuar"
2. Cliente llama a supabase.auth.signInWithOtp({ email })
   (shouldCreateUser es true por defecto: crea el usuario si no existe)
3. Mostrar pantalla de introducción de código OTP
4. Usuario introduce código
5. Cliente llama a supabase.auth.verifyOtp({ email, token, type: 'email' })
6. Sesión creada → middleware existente decide:
   - Si tiene account_members → Home
   - Si no tiene → Onboarding (usuario nuevo o zombie)
```

**Nota**: No se usa `signUp` en ningún momento. `signInWithOtp` unifica registro y login en una sola llamada. La distinción entre usuario nuevo y recurrente se determina por la existencia de `account_members`, lógica que el middleware ya implementa.

### Flujo secundario (magic link)

```
1. Usuario pulsa "O envíame un enlace al correo"
2. Cliente llama a supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })
   Nota: signInWithOtp funciona tanto para usuarios nuevos como existentes.
3. Mostrar pantalla de confirmación: "Te hemos enviado un enlace. Revisa tu correo."
4. El enlace abre /auth/confirm → /auth/callback como en el flujo actual.
5. Si PKCE falla (otro navegador): el callback muestra mensaje de error con opción
   de volver a la pantalla de acceso para usar código OTP.
```

---

## Backend

No se requiere nuevo endpoint. El flujo se resuelve enteramente desde el cliente con `signInWithOtp`, que funciona tanto para usuarios nuevos como existentes.

El middleware existente se encarga de la redirección post-autenticación según el estado del usuario (con o sin `account_members`).

---

## Cambios en el input de código OTP

### Atributo `autocomplete="one-time-code"`

Añadir al input del código OTP en web para que iOS Safari y otros navegadores sugieran autocompletar desde el email/SMS:

```tsx
<input
  type="text"
  inputMode="numeric"
  pattern="[0-9]*"
  maxLength={8}
  autoComplete="one-time-code"
  // ... resto de props
/>
```

Si el componente actual usa múltiples inputs (uno por dígito), el atributo `autoComplete="one-time-code"` va en el **primer** input del grupo, o idealmente se usa un input único oculto con `autoComplete="one-time-code"` que distribuye los caracteres visualmente.

---

## Cambios en el callback de error (PKCE fallido)

### Archivo: `/auth/callback/route.ts`

Cuando `exchangeCodeForSession` falla, en vez de redirigir a login genérico:

```typescript
if (codeError) {
  // Redirigir con parámetro que indique fallo de PKCE
  return NextResponse.redirect(
    new URL("/login?error=pkce_failed", request.url)
  );
}
```

En la pantalla de login, si `searchParams.error === "pkce_failed"`:
- Mostrar mensaje: **"El enlace se abrió en un navegador diferente. Introduce tu email para recibir un código de verificación."**
- Pre-rellenar el email si está disponible en los query params del callback.

---

## Cambios en mobile (Expo)

### Deep links para magic link

Ya tienes `scheme: "finnon"` configurado. Para que los magic links del email abran la app directamente en vez del navegador:

1. **iOS — Universal Links**: servir `/.well-known/apple-app-site-association` en `finnon.app`:
   ```json
   {
     "applinks": {
       "apps": [],
       "details": [
         {
           "appID": "<TEAM_ID>.<BUNDLE_ID>",
           "paths": ["/auth/confirm*", "/auth/callback*"]
         }
       ]
     }
   }
   ```

2. **Android — App Links**: servir `/.well-known/assetlinks.json` en `finnon.app`:
   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "<PACKAGE_NAME>",
         "sha256_cert_fingerprints": ["<SHA256_FINGERPRINT>"]
       }
     }
   ]
   ```

3. Verificar que `app.config.js` incluya los `intentFilters` para Android y `associatedDomains` para iOS apuntando a `finnon.app`.

4. En el `emailRedirectTo` del magic link móvil, usar la URL de `finnon.app` (no `finnon://`), para que Universal Links / App Links la intercepten.

**Nota**: El flujo OTP por código en mobile no necesita cambios — ya funciona correctamente porque el usuario introduce el código en la misma app.

---

## Archivos a modificar (estimación)

| Archivo | Cambio |
|---------|--------|
| Pantalla de login web (nueva o refactorizada) | Flujo unificado: email → `signInWithOtp` → código OTP → verifyOtp |
| `/auth/callback/route.ts` | Detectar error PKCE y redirigir con `?error=pkce_failed` |
| Componente de input OTP | Añadir `autoComplete="one-time-code"` y `inputMode="numeric"` |
| `apps/web/public/.well-known/apple-app-site-association` | **Nuevo**: configuración Universal Links |
| `apps/web/public/.well-known/assetlinks.json` | **Nuevo**: configuración App Links |
| `app.config.js` (Expo) | Añadir `associatedDomains` y `intentFilters` si no están |

---

## Lo que NO cambia

- **Middleware**: la lógica de "user sin account_members → onboarding" sigue igual.
- **Onboarding**: sin cambios, recibe al usuario autenticado como siempre.
- **AuthContext mobile**: el flujo OTP ya funciona, solo se beneficia de los deep links para magic link.
- **Flujo de /auth/confirm → /auth/callback**: sigue existiendo para magic links, no se elimina.

---

## Criterios de aceptación

- [ ] Un usuario nuevo puede acceder introduciendo email + código OTP con una sola llamada (`signInWithOtp`).
- [ ] Un usuario zombie (existe en Auth, sin account_members) puede introducir su email, recibir código OTP y completar onboarding.
- [ ] Un usuario existente completo puede introducir su email, recibir código OTP y llegar al home.
- [ ] El input de código OTP soporta autocompletado en iOS Safari.
- [ ] Si un magic link se abre en otro navegador, el callback redirige a login con mensaje claro y opción de usar código.
- [ ] `signInWithOtp` no revela al usuario si el email está registrado o no (mismo comportamiento visual en ambos casos).
- [ ] Los deep links en iOS y Android abren la app Finnon al pulsar el magic link desde el email.
