# Guía de Desarrollo - Finnon

Esta guía explica cómo trabajar con múltiples entornos (local y producción) para evitar mezclar datos de prueba con datos reales.

---

## 🏗️ Arquitectura Multi-Entorno

```
┌─────────────────────────────────────────────┐
│ DESARROLLO LOCAL                            │
│ ├─ Supabase Local (Docker)                  │
│ │  └─ PostgreSQL local en localhost:54322   │
│ │  └─ API: http://127.0.0.1:54321           │
│ │  └─ Studio: http://127.0.0.1:54323        │
│ │  └─ Datos de prueba LOCALES               │
│ │  └─ NO consume Supabase free tier         │
│ │                                            │
│ └─ Archivos .env.local (apuntan a local)    │
└─────────────────────────────────────────────┘
                    ↓
                  Deploy
                    ↓
┌─────────────────────────────────────────────┐
│ PRODUCCIÓN                                  │
│ ├─ Supabase Cloud                           │
│ │  └─ https://xtgopkwiwwvvivvkacbf.supabase.co │
│ │  └─ Datos REALES de usuarios              │
│ │                                            │
│ └─ Archivos .env.production                 │
└─────────────────────────────────────────────┘
```

---

## 📋 Requisitos Previos

1. **Docker Desktop** instalado y corriendo
   - Descargar: https://www.docker.com/products/docker-desktop
   - En WSL2 debe estar configurado para usar el backend de WSL2

2. **pnpm** instalado globalmente
   ```bash
   npm install -g pnpm
   ```

---

## 🚀 Inicio Rápido

### 1. Arrancar Desarrollo Local

```bash
# Iniciar Supabase local (PostgreSQL + API + Studio en Docker)
pnpm supabase:start

# En otra terminal, arrancar las apps
pnpm dev
```

### 2. Abrir Supabase Studio

```bash
# Abrir Studio local en el navegador
pnpm supabase:studio

# O manualmente en: http://127.0.0.1:54323
```

### 3. Ver Estado de Supabase

```bash
pnpm supabase:status
```

---

## 🔄 Gestión de Entornos

### Archivos de Variables de Entorno

Cada app (web y mobile) tiene 3 archivos `.env`:

```
apps/web/
├─ .env.local        # Activo actualmente (git ignored)
├─ .env.development  # Template para desarrollo local
└─ .env.production   # Template para producción

apps/mobile/
├─ .env.local        # Activo actualmente (git ignored)
├─ .env.development  # Template para desarrollo local
└─ .env.production   # Template para producción
```

### Cambiar Entre Entornos

**Opción 1: Usar Scripts (Recomendado)**

```bash
# Cambiar a desarrollo local
pnpm env:use-local

# Cambiar a producción
pnpm env:use-prod
```

**Opción 2: Manual**

```bash
# Para desarrollo local
cp apps/web/.env.development apps/web/.env.local
cp apps/mobile/.env.development apps/mobile/.env.local

# Para producción
cp apps/web/.env.production apps/web/.env.local
cp apps/mobile/.env.production apps/mobile/.env.local
```

**⚠️ IMPORTANTE**: Reinicia los servidores de desarrollo después de cambiar `.env.local`

---

## 🗄️ Gestión de Base de Datos

### Migraciones

Las migraciones están en `supabase/migrations/` y se ejecutan automáticamente al:
- Iniciar Supabase local (`pnpm supabase:start`)
- Hacer push a producción

```bash
# Aplicar migraciones al DB local
pnpm db:push:local

# Resetear DB local (⚠️ BORRA TODOS LOS DATOS LOCALES)
pnpm db:reset:local
```

### Crear Nueva Migración

```bash
# Genera un archivo de migración vacío
npx supabase migration new nombre_de_la_migracion

# Editar: supabase/migrations/YYYYMMDDHHMMSS_nombre_de_la_migracion.sql
```

### Aplicar Migraciones a Producción

```bash
# ⚠️ SOLO HACER DESPUÉS DE PROBAR EN LOCAL
npx supabase db push --db-url postgresql://postgres:[PASSWORD]@db.[PROJECT_REF].supabase.co:5432/postgres
```

---

## 🔧 Comandos Útiles

### Supabase Local

```bash
# Iniciar Supabase local
pnpm supabase:start

# Detener Supabase local
pnpm supabase:stop

# Ver estado (URLs, credentials)
pnpm supabase:status

# Abrir Studio (UI de administración)
pnpm supabase:studio
```

### Base de Datos

```bash
# Aplicar migraciones pendientes al DB local
pnpm db:push:local

# Resetear DB local (⚠️ destructivo)
pnpm db:reset:local
```

### Desarrollo

```bash
# Arrancar web + mobile en modo desarrollo
pnpm dev

# Typecheck
pnpm typecheck

# Lint
pnpm lint
```

---

## 📊 Datos de Prueba

### Crear Datos de Prueba Locales

1. Abrir Studio local: http://127.0.0.1:54323
2. Ir a "Table Editor"
3. Crear manualmente datos de prueba

**O usar seed SQL:**

```bash
# Crear archivo supabase/seed.sql
npx supabase db reset  # Resetea y aplica seed automáticamente
```

---

## 🔐 Credenciales

### Desarrollo Local (Default)

```env
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU
```

**Estas credenciales son públicas y solo funcionan en local.**

### Producción

Las credenciales de producción están en `.env.production` (NO commitear a git).

Para obtener las credenciales de producción:
1. Ir a https://app.supabase.com/project/xtgopkwiwwvvivvkacbf/settings/api
2. Copiar `URL`, `anon` key, y `service_role` key

---

## ⚠️ Reglas de Seguridad

### ✅ HACER

- Desarrollar SIEMPRE en local (Supabase local)
- Probar migraciones en local ANTES de aplicarlas a producción
- Usar `.env.development` para desarrollo
- Usar `.env.production` solo para deployment a producción

### ❌ NO HACER

- **NUNCA** escribir datos de prueba en producción
- **NUNCA** commitear archivos `.env.local` o `.env.production`
- **NUNCA** compartir las credenciales de `service_role` públicamente
- **NUNCA** ejecutar `db:reset` apuntando a producción

---

## 🐛 Troubleshooting

### "Cannot connect to Docker daemon"

**Problema**: Docker Desktop no está corriendo.

**Solución**:
1. Iniciar Docker Desktop
2. Esperar a que muestre "Engine running"
3. Ejecutar `pnpm supabase:start` de nuevo

### "Port 54321 is already in use"

**Problema**: Supabase local ya está corriendo o puerto ocupado.

**Solución**:
```bash
# Detener Supabase
pnpm supabase:stop

# Reiniciar
pnpm supabase:start
```

### "Migration failed"

**Problema**: Error en SQL de migración.

**Solución**:
1. Revisar el archivo de migración en `supabase/migrations/`
2. Probar el SQL manualmente en Studio local
3. Corregir errores de sintaxis o foreign keys
4. Resetear DB local y volver a aplicar: `pnpm db:reset:local`

### Las apps no se conectan a Supabase local

**Problema**: `.env.local` no está configurado correctamente.

**Solución**:
```bash
# Cambiar a desarrollo local
pnpm env:use-local

# Reiniciar los servidores
pnpm dev
```

---

## 📚 Recursos

- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [Supabase Local Development](https://supabase.com/docs/guides/local-development)
- [Next.js Environment Variables](https://nextjs.org/docs/basic-features/environment-variables)
- [Expo Environment Variables](https://docs.expo.dev/guides/environment-variables/)

---

## 🎯 Workflow Recomendado

### Para Desarrollar Features

1. Asegurarte de estar en modo local:
   ```bash
   pnpm env:use-local
   pnpm supabase:start
   ```

2. Desarrollar y probar:
   ```bash
   pnpm dev
   ```

3. Crear migraciones si cambias schema:
   ```bash
   npx supabase migration new add_nueva_feature
   # Editar el archivo generado
   pnpm db:push:local
   ```

4. Cuando esté listo para producción:
   - Hacer commit de las migraciones
   - Aplicar migraciones a producción
   - Deploy de las apps

### Para Probar en Producción

1. Cambiar a modo producción:
   ```bash
   pnpm env:use-prod
   ```

2. Reiniciar apps:
   ```bash
   pnpm dev
   ```

3. **⚠️ IMPORTANTE**: Volver a modo local después de probar:
   ```bash
   pnpm env:use-local
   ```
