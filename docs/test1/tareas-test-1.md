# Finnon — Tareas del Test 1

## 1. Auth: Unificar a código OTP
- Eliminar flujo magic link en mobile (`login.tsx`) y web (`page.tsx`).
- Default a `code` en ambas plataformas.
- Fijar `OTP_LENGTH=6` (eliminar `OTP_MIN_LENGTH` y `OTP_MAX_LENGTH`).
- Personalizar subject del email de Supabase Auth: "Bienvenido a Finnon" (signup) vs "Conéctate a Finnon" (login).
- Limpiar código relacionado: `emailRedirectTo`, verificación por `token_hash` en `AuthContext.tsx` y `route.ts`.

## 2. Safari viewport
- Fix del ancho de página al abrir en Safari mobile — revisar meta viewport y elementos que desbordan.

## 3. Invitaciones desde onboarding
- Rehacer flujo de invitación sobre código OTP: el invitado recibe email, crea cuenta con código, acepta invitación.
- Eliminar dependencia de deep links y redirect URLs.
- Verificar que el flujo funciona end-to-end desde onboarding.

## 4. Roles UI
- Eliminar opciones de rol en selectores (dejar solo admin).
- Quitar chips de rol redundantes en la UI.
- Mantener estructura de roles en backend para uso futuro.

## 5. Movimientos — Selector de fecha
- Implementar selector de rango temporal: semana, mes, trimestre, año.

## 6. Índice transacciones
- Crear índice compuesto `(account_id, date)` en la tabla de transacciones.

## 7. Renombrar endpoint
- `/recurrentes` → `/transaction/recurrent`
- Actualizar todas las referencias en frontend (mobile y web).

## 8. Formulario recurrentes
- Añadir chips predictivos de categoría y merchant al formulario de movimientos recurrentes.
- Replicar lógica existente del formulario de movimientos normales.
