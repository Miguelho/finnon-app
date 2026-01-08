# Prompt para agente de código — Avatares de usuario + avatar en Transactions

## Contexto
En Finnon (web + mobile) queremos reforzar el uso multiusuario (cuentas compartidas) mostrando **quién crea cada movimiento**.
Además, cada usuario podrá tener **avatar**; si no hay avatar, se mostrará un fallback con **inicial del email** y **fondo por token**.

## Objetivo
1) Permitir que el usuario **suba/cambie/elimine** su avatar desde Settings (web y mobile).
2) En la página/pantalla de **Transactions**, mostrar el **avatar del usuario que creó** cada movimiento (o fallback).

---

## Alcance (MVP)
- Avatar circular pequeño (24–28px) en cada row de transacción.
- Fallback determinista: letra inicial del email + fondo de color (usando solo tokens).
- Guardado de avatar en Storage (bucket) + referencia en tabla `profiles` (o similar).
- RLS: miembros de una misma cuenta pueden leer `profiles` de los demás miembros.

Fuera de alcance (por ahora):
- Edición avanzada (crop editor complejo), animaciones pesadas, badges, estados online, etc.

---

## Diseño de datos (Supabase)
### 1) Tabla `profiles`
Crear (si no existe) o extender:

- `user_id uuid primary key references auth.users(id) on delete cascade`
- `email text` (si no lo guardas ya en otro sitio)
- `display_name text null` (opcional)
- `avatar_path text null` (path en Storage, NO URL)
- `updated_at timestamptz not null default now()`

Índices:
- PK en `user_id` ya cubre la mayoría.
- (Opcional) index en `email` si lo usas para búsquedas.

Trigger:
- Actualizar `updated_at` en UPDATE.

### 2) Storage bucket `avatars`
- Bucket: `avatars`
- Path estándar: `avatars/{user_id}/avatar.(jpg|png|webp)`
- Al subir, sobreescribir el archivo previo (para no acumular basura).

Policies Storage:
- Lectura: permitir a miembros de la misma cuenta leer los avatares (ver RLS más abajo).
- Escritura: permitir solo al propietario (`auth.uid() == user_id` en el path).

> Si las policies de Storage se complican, MVP alternativo:
> - Hacer los avatares “read public” del bucket y fiarlo a que el path sea no adivinable.
> - Pero preferimos **no** hacerlo público si podemos evitarlo.

### 3) RLS: lectura de perfiles entre miembros
Necesitamos que si A y B comparten `account_id`, ambos puedan leer el perfil del otro.

Asumiendo tabla `account_members(account_id, user_id, ...)`:
Policy en `profiles` (SELECT):
- Permitir SELECT si:
  - `profiles.user_id = auth.uid()` (propio) OR
  - existe una `account_members am1` para `auth.uid()` y `account_members am2` para `profiles.user_id` con el mismo `account_id`.

Pseudo-SQL:
```sql
exists (
  select 1
  from account_members am1
  join account_members am2 on am1.account_id = am2.account_id
  where am1.user_id = auth.uid()
    and am2.user_id = profiles.user_id
)
Policy en profiles (UPDATE/INSERT):

Solo profiles.user_id = auth.uid().

Backend / Shared
4) Shared: Avatar fallback
Crear un util en el módulo shared, algo tipo:

getAvatarInitial(email: string): string

getAvatarColorToken(seed: string): TokenName

Seed: user_id si existe, si no email

Debe ser determinista: mismo usuario => mismo color

Importante: DEVOLVER un token (no hex). Ej: bg.secondary, surface, etc.

5) Shared: DTO para transacciones con created_by
Verificar que transactions tiene created_by (uuid).

Si falta: migración para añadir columna y rellenar con auth.uid() al crear.

Asegurar que el endpoint / query que lista transacciones devuelve created_by.

Web (Next.js)
6) Settings → Perfil (avatar)
Añadir sección “Avatar” en Settings:

Mostrar avatar actual / fallback

Botón: “Cambiar avatar”

Botón secundario (si hay avatar): “Eliminar”

Subida:

File picker

Validaciones: tamaño máx (p.ej. 2–5MB), mime (jpeg/png/webp)

Subir a Storage avatars/{user_id}/avatar.jpg

Actualizar profiles.avatar_path con el path

7) Transactions: mostrar avatar creador
En cada row:

Resolver created_by

Cargar perfil creador (batch)

Evitar N+1:

Obtener created_by únicos del listado

Query profiles con in(user_id, [...])

Map en memoria userId -> profile

UI:

Avatar circle 24–28px

Si hover disponible: tooltip “Creado por {display_name || email}”

Mobile (Expo / React Native)
8) Settings → Perfil (avatar)
Mismo layout y copy que web (strings en shared).

Selector:

Usar image picker (expo-image-picker o equivalente ya presente)

Subida a Storage igual que web

Eliminar avatar:

Borrar archivo en Storage (si existe)

Poner avatar_path = null

9) Transactions: avatar creador
Igual que web: batch fetch profiles y map.

Cache:

Memoizar en estado global simple o cache local por sesión para no reconsultar cada scroll.

Componente Avatar (shared UI si aplica)
Crear un componente reutilizable UserAvatar (o equivalente) que acepte:

email?: string

userId?: string

avatarUrl?: string (ya resuelto) o avatarPath?: string (para construir URL firmada/descarga)

size?: number

label?: string para accesibilidad

Comportamiento:

Si avatarUrl carga: mostrar imagen

Si falla o no existe: mostrar fallback con inicial + color token

Detalles técnicos clave
Construcción de URL de avatar:

Si usas Supabase Storage:

O getPublicUrl (si bucket público)

O createSignedUrl (si privado) con TTL razonable (p.ej. 1h) y cachearlo.

“Eliminar avatar” debe reflejarse inmediatamente en UI:

Optimistic update: UI pasa a fallback al momento; si falla, revertir.

Seguridad:

RLS en profiles y policies en Storage revisadas.

Rendimiento:

Batch profiles + memoization.

Evitar recalcular hash/token en cada render (memo).

Criterios de aceptación (DoD)
 Settings web: el usuario puede subir/cambiar/eliminar avatar.

 Settings mobile: el usuario puede subir/cambiar/eliminar avatar.

 Fallback: si no hay avatar, se muestra la inicial del email en mayúscula con fondo por token (determinista).

 Transactions web: cada movimiento muestra avatar del creador (o fallback).

 Transactions mobile: cada movimiento muestra avatar del creador (o fallback).

 Cuentas compartidas: miembros pueden ver avatares entre ellos (RLS OK).

 No hay N+1 queries: perfiles se resuelven en batch.

 Fallo de carga de imagen => fallback sin romper layout.

Guardrails
No meter colores hardcode: usar tokens.

No aumentar ruido visual: avatar pequeño, no compite con el importe.

No meter features extra (badges, gradients, animaciones pesadas).

Mantener UX web y mobile equivalente (solo cambia layout, no funcionalidad).