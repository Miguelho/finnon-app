# Prompt para agente de código — Añadir opción “Cerrar sesión” en el menú (Web + Mobile)

## Contexto
- App Finnon con Supabase Auth.
- Código compartido (workspace `@poleursus/shared`) + Web (Next.js) + Mobile (Expo + expo-router).
- Queremos añadir una opción de **deslogear/cerrar sesión** accesible desde el **menú** como una opción más.

## Objetivo
- Añadir un item de menú **“Cerrar sesión”** que cierre la sesión de Supabase, limpie estado local y redirija a la pantalla de login/onboarding correspondiente.

## No-objetivos
- No cambiar el flujo de autenticación (magic link, PKCE, etc.).
- No rehacer la navegación ni el onboarding; solo redirigir al punto correcto tras signOut.

---

## UX / UI Spec
### Copy
- Label: **“Cerrar sesión”**
- Confirm (recomendado):
  - Título: “¿Cerrar sesión?”
  - Texto: “Tendrás que volver a iniciar sesión para acceder a tus cuentas.”
  - Botones: “Cancelar” (default) / “Cerrar sesión” (destructivo)

### Estilo
- Mostrar “Cerrar sesión” como acción **destructiva sutil**:
  - Texto/ícono con token de estado negativo (ej. `color.state.negative`)
  - Sin fondo rojo sólido, sin icono agresivo.
- Ubicación:
  - En **Settings / Cuenta** al final de la lista/sección, separado por divisor.

---

## Implementación (pasos)

### 1) Añadir helper compartido de sign-out (recomendado)
**En `@poleursus/shared`:**
- Crear `auth/signOut.ts` (o donde ya estén helpers de auth) que exponga:
  - `signOutAndReset({ onReset, onNavigate })`
  - Internamente:
    - `await supabase.auth.signOut()`
    - `await clearLocalSessionArtifacts()` (si aplica)
    - Llama a `onReset()` para limpiar stores/caches
    - Llama a `onNavigate()` para redirigir

**clearLocalSessionArtifacts()**
- Mobile: limpiar claves de `AsyncStorage` relacionadas con sesión/cuenta activa si existen (por ejemplo `activeAccountId`, filtros persistidos, caches propios).
- Web: limpiar `localStorage`/`cookies` *solo* si guardáis cosas de sesión ahí (sin romper “remember me” si existe).
- Ojo: Supabase maneja su storage; aquí limpiamos **estado de app** (cuenta activa, filtros, caché UI).

> Si ya existe un patrón de “reset app state” o “logout” en algún sitio, reutilízalo.

---

### 2) Web (Next.js): añadir item de menú “Cerrar sesión”
- Ubicarlo donde esté el menú de usuario / settings / account.
- Añadir un `MenuItem` o `DropdownItem` “Cerrar sesión”.
- Al click:
  1) Mostrar confirm (AlertDialog / Modal)
  2) Si confirma:
     - Deshabilitar botón mientras está en progreso
     - Ejecutar `signOutAndReset(...)`
     - Redirigir a `/login` o ruta de onboarding (según vuestro routing actual)
  3) Si falla:
     - Mostrar toast: “No se pudo cerrar sesión. Inténtalo de nuevo.”

**Navegación**
- Si usáis App Router: `useRouter().push("/login")` o equivalente.
- Asegurar que no queda el usuario “en una página protegida” cacheada.

---

### 3) Mobile (Expo + expo-router): añadir item en Settings
- En pantalla Settings (o menú equivalente), añadir opción “Cerrar sesión” abajo.
- Confirm:
  - Preferencia: modal/bottom sheet ligero (según patrón actual).
- Al confirmar:
  - Ejecutar `signOutAndReset(...)`
  - Redirigir a ruta de auth: `/(auth)/login` (o la que tengáis)
- Mostrar loading y manejar error con toast.

**Nota navegación**
- Con expo-router, usar `router.replace("/(auth)/login")` para evitar volver atrás a pantallas autenticadas.

---

### 4) Reset de estado (clave)
Implementar un `resetAppState()` (si no existe), llamado durante logout:
- Stores (Zustand/Redux/etc.):
  - `activeAccountId = null`
  - `selectedMonth = default`
  - `filters = default`
  - `participants cache` / `categories cache` si están en memoria
- Caches:
  - Si usáis React Query / TanStack Query: `queryClient.clear()` o invalidaciones relevantes
- UI:
  - Cerrar menú / cerrar dialogs al completar
- Seguridad:
  - Evitar dejar datos en memoria tras logout.

---

## Edge cases
- SignOut llamado sin sesión activa: debe ser idempotente (no crashea).
- Logout mientras hay requests en vuelo: cancelar/ignorar resultados posteriores (evitar que repinten datos tras logout).
- Error de red: informar con toast y permitir reintento.

---

## Definition of Done
- [ ] Web: existe opción “Cerrar sesión” en el menú (Settings/Cuenta) con confirmación.
- [ ] Mobile: existe opción “Cerrar sesión” en Settings con confirmación.
- [ ] `supabase.auth.signOut()` se ejecuta correctamente.
- [ ] Se limpia el estado local (cuenta activa, filtros, caches) y no quedan datos visibles tras logout.
- [ ] Redirige correctamente a login/onboarding (sin poder volver atrás a pantallas protegidas).
- [ ] Manejo de errores con toast y estado de loading (botón deshabilitado).
- [ ] Tests mínimos:
  - [ ] Unit test del helper `signOutAndReset` (mock de supabase)
  - [ ] Smoke test manual: login → navegar a pantallas con datos → logout → volver a entrar → no se ven datos antiguos.

---

## QA manual (checklist rápido)
1) Logueado con cuenta con datos → abrir menú → Cerrar sesión → confirmar
2) Ver que aterriza en login/onboarding
3) Botón back no vuelve a screens autenticadas
4) Re-login → comprobar que filtros/cuenta activa vuelven a defaults (no estado “fantasma”)
5) Simular error (offline) → toast + no rompe la app
