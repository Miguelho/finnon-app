# Validación de RLS (Row Level Security)

Esta guía te ayudará a validar que las políticas de seguridad RLS funcionan correctamente en finnon.

## ⚠️ **Nota importante sobre testing local**

El usuario `postgres` en Supabase local tiene el privilegio `BYPASSRLS` activado, lo que significa que **ignora todas las políticas RLS**. Esto es por diseño para permitir operaciones administrativas.

**En producción**, los usuarios autenticados a través de Supabase Auth **NO tienen BYPASSRLS**, por lo que RLS funcionará correctamente.

Para validar que RLS está configurado correctamente:
1. ✅ Verificar que RLS está habilitado en las tablas
2. ✅ Verificar que las políticas están creadas
3. ✅ Verificar que las funciones helper funcionan
4. ✅ Probar con usuarios reales en Supabase Studio (ver sección manual)
5. ✅ Probar desde la aplicación cuando implementes Auth (Prompts 5-6)

## 📋 Preparación

### 1. Asegúrate de tener Supabase local corriendo

```bash
# Iniciar Supabase local
pnpm supabase:start

# Verificar estado
pnpm supabase:status
```

### 2. Aplicar las migraciones

```bash
# Resetear DB y aplicar todas las migraciones (incluye 001_init.sql y 002_rls.sql)
pnpm db:reset:local
```

Esto aplicará automáticamente:
- ✅ `001_init.sql` - Esquema de tablas
- ✅ `002_rls.sql` - Políticas RLS

---

## 🧪 Método 1: Validación automatizada (Recomendado)

### Paso 1: Cargar datos de prueba

```bash
# Conectarse a la DB local y ejecutar el seed
npx supabase db reset --db-url "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
```

Esto creará:
- 👤 **4 usuarios de prueba**:
  - Alice (admin de Account A)
  - Bob (contributor de Account A)
  - Charlie (viewer de Account A, admin de Account B)
  - David (sin acceso a ninguna cuenta)

- 🏦 **2 cuentas**:
  - Account A (Alice Family Budget) - EUR
  - Account B (Charlie Personal) - USD

- 📊 **Datos de prueba**:
  - 5 categorías
  - 5 transacciones
  - 1 invite
  - 3 suscripciones en catálogo

### Paso 2: Ejecutar tests de validación

```bash
# Ejecutar el script de validación
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -f supabase/validate-rls.sql
```

**Resultado esperado:**
```
============================================
TEST SUMMARY
============================================
Total tests: 15
Passed: 15 (100.0 %)
Failed: 0
============================================

✓ ALL TESTS PASSED! RLS is working correctly.
```

### ¿Qué valida este script?

El script automático prueba **15 escenarios críticos**:

#### Accounts
- ✅ Alice (admin) puede ver Account A
- ✅ Alice NO puede ver Account B (no es miembro)
- ✅ David (outsider) no puede ver ninguna cuenta
- ✅ Charlie puede ver ambas cuentas (es miembro de ambas)

#### Transactions
- ✅ Bob (contributor) puede ver transacciones de Account A
- ✅ Bob NO puede ver transacciones de Account B
- ✅ Charlie (viewer) NO puede insertar transacciones
- ✅ Bob (contributor) SÍ puede insertar transacciones

#### Categories
- ✅ Charlie (viewer) puede ver categorías
- ✅ Charlie (viewer) NO puede crear categorías
- ✅ Bob (contributor) SÍ puede crear categorías

#### Account Members
- ✅ Bob (contributor) puede ver miembros
- ✅ Bob (contributor) NO puede añadir miembros
- ✅ Alice (admin) SÍ puede añadir miembros

#### Invites
- ✅ Bob (contributor) puede ver invites
- ✅ Bob (contributor) NO puede crear invites
- ✅ Alice (admin) SÍ puede crear invites

#### Subscriptions Catalog
- ✅ David (outsider) puede ver catálogo (público)

---

## 🖱️ Método 2: Validación manual en Supabase Studio

### Paso 1: Abrir Supabase Studio

```bash
pnpm supabase:studio
```

O visita: http://127.0.0.1:54323

### Paso 2: Cargar datos de prueba (si no lo hiciste ya)

1. Ve a **SQL Editor**
2. Abre `supabase/seed.sql`
3. Ejecuta el script

### Paso 3: Probar políticas manualmente

#### 3.1 Ver datos como Alice (admin de Account A)

En SQL Editor, ejecuta:

```sql
-- Establecer usuario como Alice
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}'::text, false);

-- Alice DEBE ver Account A
SELECT * FROM accounts;
-- Resultado esperado: 1 fila (Account A)

-- Alice DEBE ver 3 transacciones de Account A
SELECT * FROM transactions;
-- Resultado esperado: 3 filas

-- Alice puede crear un invite
INSERT INTO invites (account_id, token_hash, role, expires_at, created_by)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'manual-test-hash', 'viewer', now() + interval '7 days', '11111111-1111-1111-1111-111111111111');
-- Resultado esperado: Éxito
```

#### 3.2 Ver datos como Charlie (viewer de Account A)

```sql
-- Establecer usuario como Charlie
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333"}'::text, false);

-- Charlie DEBE ver Account A y Account B
SELECT * FROM accounts;
-- Resultado esperado: 2 filas

-- Charlie puede ver transacciones de Account A
SELECT * FROM transactions WHERE account_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
-- Resultado esperado: 3 filas

-- Charlie NO puede crear transacciones en Account A (viewer)
INSERT INTO transactions (account_id, type, amount_minor, currency, amount_base_minor, category_id, date, created_by)
VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'expense', 1000, 'EUR', 1000, 'c1111111-1111-1111-1111-111111111111', '2025-01-20', '33333333-3333-3333-3333-333333333333');
-- Resultado esperado: ERROR (política RLS lo bloquea)
```

#### 3.3 Ver datos como David (outsider)

```sql
-- Establecer usuario como David
SELECT set_config('request.jwt.claims', '{"sub": "44444444-4444-4444-4444-444444444444"}'::text, false);

-- David NO debe ver ninguna cuenta
SELECT * FROM accounts;
-- Resultado esperado: 0 filas

-- David NO debe ver ninguna transacción
SELECT * FROM transactions;
-- Resultado esperado: 0 filas

-- David SÍ puede ver el catálogo de suscripciones (público)
SELECT * FROM subscriptions_catalog;
-- Resultado esperado: 3 filas (Netflix, Spotify, Amazon Prime)
```

---

## 🔍 Verificación de helper functions

Puedes probar las funciones helper directamente:

```sql
-- Como Alice, verificar que es admin de Account A
SELECT set_config('request.jwt.claims', '{"sub": "11111111-1111-1111-1111-111111111111"}'::text, false);
SELECT is_account_admin('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Resultado esperado: true

-- Como Bob, verificar que es contributor
SELECT set_config('request.jwt.claims', '{"sub": "22222222-2222-2222-2222-222222222222"}'::text, false);
SELECT get_account_role('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Resultado esperado: 'contributor'

SELECT is_contributor_or_above('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Resultado esperado: true

-- Como Charlie (viewer), verificar que NO es contributor
SELECT set_config('request.jwt.claims', '{"sub": "33333333-3333-3333-3333-333333333333"}'::text, false);
SELECT is_contributor_or_above('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa');
-- Resultado esperado: false
```

---

## 🎯 Checklist de validación

### Seguridad básica
- [ ] Usuario sin membresía no puede ver datos de ninguna cuenta
- [ ] Usuario solo ve cuentas donde es miembro
- [ ] No hay "data leakage" entre cuentas

### Permisos por rol - Viewer
- [ ] Puede ver datos (SELECT)
- [ ] NO puede crear/editar/borrar nada

### Permisos por rol - Contributor
- [ ] Puede ver datos (SELECT)
- [ ] Puede crear/editar/borrar: transactions, categories, attachments
- [ ] NO puede gestionar: members, invites

### Permisos por rol - Admin
- [ ] Puede hacer todo lo de contributor
- [ ] Puede gestionar members
- [ ] Puede gestionar invites
- [ ] Puede editar/borrar account

### Datos públicos
- [ ] Subscriptions catalog es accesible para todos los usuarios autenticados

---

## ⚠️ Solución de problemas

### Los tests fallan con "relation does not exist"

**Causa:** Migraciones no aplicadas.

**Solución:**
```bash
pnpm db:reset:local
```

### Los tests fallan con "permission denied"

**Causa:** RLS activado pero policies no creadas.

**Solución:**
Verifica que `002_rls.sql` se aplicó correctamente:
```bash
psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -c "\d+ accounts"
# Debe mostrar "Row security: ENABLED"
```

### No puedo insertar usuarios en auth.users

**Causa:** Solo funciona en Supabase local.

**Solución:**
Asegúrate de estar usando la DB local (puerto 54322), no producción.

---

## 📊 Próximos pasos

Una vez validado RLS:

1. ✅ **Prompt 4 completado** - RLS funcionando
2. ➡️ **Prompt 5-6** - Auth + onboarding (web + mobile)
3. ➡️ **Prompt 7-8** - CRUD categorías + transacciones

---

## 📝 Credenciales de prueba

Para testing manual desde la UI (cuando implementes auth):

| Usuario | Email | Password | Rol en Account A | Rol en Account B |
|---------|-------|----------|------------------|------------------|
| Alice | alice@finnon-test.local | password123 | admin | - |
| Bob | bob@finnon-test.local | password123 | contributor | - |
| Charlie | charlie@finnon-test.local | password123 | viewer | admin |
| David | david@finnon-test.local | password123 | - | - |

**Nota:** Estos usuarios solo existen en tu entorno local. NO usar en producción.
