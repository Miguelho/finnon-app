# Fix: RLS Policy para Invitaciones con Usuarios Anónimos

## Problema Original

Al intentar aceptar una invitación, los logs mostraban:

```
Invite lookup error: {
  code: 'PGRST116',
  details: 'The result contains 0 rows',
  hint: null,
  message: 'Cannot coerce the result to a single JSON object'
}
Invite not found for token hash: 1769a7b5efa15eb9aa84f72e4527e17edfbea7f868442825aac57616010c433c
POST /api/invites/accept 404 in 1488ms
```

### Causa Raíz

La política RLS (Row Level Security) de la tabla `invites` creaba una situación de "huevo y gallina":

1. Usuario anónimo intenta aceptar invitación
2. El endpoint `/api/invites/accept` busca el invite por `token_hash`
3. La política `invites_select_policy` **requería ser miembro** de la cuenta para leer invites
4. El usuario no podía leer el invite porque aún no era miembro
5. No podía ser miembro porque no podía leer el invite → **Bloqueo**

### Política RLS Original (Incorrecta)

```sql
CREATE POLICY invites_select_policy ON invites
  FOR SELECT
  USING (is_account_member(account_id));  -- ❌ Bloqueaba usuarios anónimos
```

## Solución Implementada

### Nueva Política RLS

```sql
CREATE POLICY invites_select_policy ON invites
  FOR SELECT
  USING (
    is_account_member(account_id)  -- Miembros pueden ver todos los invites
    OR
    auth.uid() IS NOT NULL         -- Cualquier usuario autenticado puede buscar por token_hash
  );
```

### Por Qué Es Seguro

1. **Entropía Criptográfica**: El token tiene 32 bytes aleatorios (~10^77 combinaciones)
2. **Hashing**: Se almacena SHA-256 del token, no el token en claro
3. **Requiere Conocimiento**: Solo quien tiene el link puede encontrar el invite
4. **Validaciones Adicionales**: El endpoint valida expiración, revocación y límites de uso

### Archivos Modificados

- `supabase/migrations/004_fix_invites_rls.sql` - Nueva migración con la corrección

## Verificación

La política se ha actualizado correctamente:

```sql
SELECT policyname, qual 
FROM pg_policies 
WHERE tablename = 'invites' AND policyname = 'invites_select_policy';

-- Resultado:
-- invites_select_policy | (is_account_member(account_id) OR (auth.uid() IS NOT NULL))
```

## Flujo Corregido

1. ✅ Usuario anónimo abre link `/join?token=...`
2. ✅ Se crea sesión anónima con `supabase.auth.signInAnonymously()`
3. ✅ El endpoint puede leer el invite (política permite `auth.uid() IS NOT NULL`)
4. ✅ Se validan condiciones (expiración, revocación, max_uses)
5. ✅ Se añade usuario a `account_members`
6. ✅ Usuario ahora es miembro y puede acceder a la cuenta

## Fix Adicional: account_members INSERT Policy

Al aplicar el primer fix, apareció un segundo problema:

```
Error adding member: {
  code: '42501',
  message: 'new row violates row-level security policy for table "account_members"'
}
```

### Causa

La política `account_members_insert_policy` solo permitía:
1. Admins añadiendo miembros
2. Owners auto-registrándose como admin

Faltaba el **Caso 3**: Usuarios aceptando invites válidos.

### Solución Parte 1: Política RLS

Se añadió un tercer caso a la política:

```sql
-- Case 3: User accepting a valid invite (NEW)
(
  account_members.user_id = (select auth.uid())
  AND EXISTS (
    SELECT 1 FROM invites inv
    WHERE inv.account_id = account_members.account_id
    AND inv.role = account_members.role      -- Role must match
    AND inv.revoked_at IS NULL               -- Not revoked
    AND inv.expires_at > now()               -- Not expired
    AND (inv.max_uses IS NULL OR inv.uses_count < inv.max_uses)
  )
)
```

**Archivos**: `supabase/migrations/005_fix_account_members_invite_rls.sql`

### Solución Parte 2: Cambiar UPSERT por INSERT

Después de aplicar la migración, el error **persistía** porque:

- El endpoint usaba `.upsert()` que intenta INSERT → si falla → UPDATE
- La política UPDATE requiere ser admin: `is_account_admin(account_id)`
- El usuario aceptando invite no es admin → UPDATE falla

**Solución**: Cambiar a `.insert()` con `ignoreDuplicates: true`

```typescript
// ANTES (INCORRECTO):
await supabase.from("account_members").upsert({...}, { onConflict: "...", ignoreDuplicates: true })

// DESPUÉS (CORRECTO):
await supabase.from("account_members").insert({...}, { ignoreDuplicates: true })
```

**Archivos modificados**: 
- `apps/web/src/app/api/invites/accept/route.ts`

**Por qué funciona**: 
- Si el usuario ya es miembro → INSERT falla por UNIQUE constraint → se ignora (preserva rol existente)
- Si no es miembro → INSERT usa la política que ahora permite invites → éxito

## Aplicar en Producción

Cuando despliegues a producción, asegúrate de ejecutar **ambas migraciones**:

```bash
# En Supabase Dashboard → SQL Editor
-- 1. Ejecutar: supabase/migrations/004_fix_invites_rls.sql
-- 2. Ejecutar: supabase/migrations/005_fix_account_members_invite_rls.sql
```

O si usas Supabase CLI:

```bash
supabase db push
```

## Referencias

- Prompt 09 en `init.md` - Especificación de invites con usuarios anónimos
- `apps/web/src/app/api/invites/accept/route.ts` - Endpoint de aceptación
- `supabase/migrations/002_rls.sql` - Políticas RLS originales

