# Arquitectura: Cache Centralizada Persistente (Mobile + Web)

## Resumen
Esta arquitectura unifica la carga/cache de datos financieros del cliente para mobile y web, con:
- cache en memoria + persistencia entre sesiones
- invalidacion inmediata tras mutaciones
- invalidacion dirigida por realtime
- wipe total de cache en logout

La cache cliente pasa a ser la fuente canonica para lectura en UI.

## Objetivo funcional
- Un solo modelo de cache para Home, Transactions/Movements, Goal y Projects.
- Render inmediato desde cache persistida cuando hay datos.
- Revalidacion en background cuando los datos estan stale.
- Coherencia post-mutacion (sin datos viejos visibles).
- Limpieza total por usuario en sign out.

## Modulos principales

### 1) Shared cache core
Ubicacion: `packages/shared/src/cache`

- `types.ts`
  - `CacheEnvelope<T>`
  - `CachePolicy`
  - `CacheStorageAdapter`
  - `CacheClient`
- `keys.ts`
  - key builders tipados: `transactionsRange`, `obligationsRange`, `recurrentsRange`, `categories`, `topCategories`, `merchantSuggestions`, `goalMonth`, `goalHistory`, `goalGamification`, `projects`, `projectContributions`, `accountSummary`
  - tags tipados: `transactions`, `obligations`, `recurrents`, `goal_*`, `projects`, etc.
- `policies.ts`
  - `CORE_5M` (stale 5m, expire 24h)
  - `META_24H` (stale 24h, expire 7d)
- `client.ts`
  - `createDataCacheClient`
  - `getOrLoad`, `prime`, `peek`, `invalidateByKeys`, `invalidateByTags`, `clearByUser`, `clearAll`, `subscribe`
  - hydration lazy desde storage
  - stale-while-revalidate
  - dedupe de in-flight loads
  - GC de expirados periodico por numero de escrituras
- `invalidation.ts`
  - mapping determinista `tabla/mutacion -> tags`
  - APIs: `getInvalidationTagsForMutation`, `getInvalidationTagsForTable`

Exportado via `packages/shared/src/index.ts`.

### 2) Adaptadores de persistencia

- Mobile (`AsyncStorage`)
  - `apps/mobile/src/cache/async-storage-adapter.ts`
  - client singleton: `apps/mobile/src/cache/client.ts`
- Web (`localStorage`)
  - `apps/web/src/cache/local-storage-adapter.ts`
  - client singleton: `apps/web/src/cache/client.ts`

Prefijo actual: `finnon:data-cache:v1:`

Se ejecuta limpieza de prefijos legacy `v0` en bootstrap del client por plataforma.

### 3) Providers globales y hooks

- Mobile
  - Provider: `apps/mobile/src/cache/DataCacheProvider.tsx`
  - Root wiring: `apps/mobile/app/_layout.tsx`
  - Hooks: `apps/mobile/src/cache/hooks.ts`
- Web
  - Provider: `apps/web/src/cache/WebDataCacheProvider.tsx`
  - Root wiring: `apps/web/src/app/layout.tsx`
  - Hooks: `apps/web/src/cache/hooks.ts`

Hooks de dominio:
- `useCachedTransactionsRange`
- `useCachedObligationsRange`
- `useCachedRecurringRange`
- `useCachedCategoriesAndSuggestions`
- `useCachedGoalData`
- `useCachedProjectsData`

## Flujo de lectura
1. Se intenta resolver desde memoria/hidratada.
2. Si `fresh` -> retorna cache.
3. Si `stale` y `staleWhileRevalidate=true` -> retorna cache y dispara refresh en background.
4. Si `miss/expired/force` -> va a red, persiste y retorna.

## Flujo de escritura e invalidacion
1. Mutacion exitosa (`insert/update/delete/upsert`).
2. `emitMutation(entity, action)` en provider.
3. Se mapean tags con `invalidation.ts`.
4. `invalidateByTags(tags)` borra entradas afectadas.
5. Pantallas activas vuelven a cargar via hooks/flow normal.

## Realtime
- Cada provider abre un canal por cuenta activa.
- Tablas escuchadas:
  - `transactions`
  - `obligations`
  - `recurring_items`
  - `categories`
  - `financial_goals`
  - `projects`
  - `project_contributions`
- En evento: tabla -> tags -> invalidacion debounced (350ms).

## Integracion de seguridad/sesion
- Cambio de usuario: `clearByUser(previousUserId)` en provider.
- Logout:
  - Mobile: `mobileDataCacheClient.clearAll()` en `AuthContext`.
  - Web: `webDataCacheClient.clearAll()` en flujos de sign out/delete account.
- No se reutiliza cache entre usuarios.

## Integracion en flujos (estado actual)

### Mobile
Migrado a cache central:
- `useMovements`
- `transactions/create`
- `transactions/[id]`
- `transaction/recurrent/[id]`
- `home/MonthViewModal`
- `AddTransactionModal`

`AddTransactionForm` ahora soporta `onMutationSuccess(entity, action)` para invalidacion central tras create (`transactions`/`obligations`).

### Web
Migrado a cache central:
- `transactions/movements-client` (se elimino cache local `periodDataCacheRef`)
- `home/month-view-panel` (se elimina `monthCache`, usa `prime + getOrLoad`)
- `home/add-action` (emite invalidaciones por mutacion)
- `goal/goal-client` (summary/history/gamification cacheados + invalidacion en upsert goal)
- `projects/projects-client`
- `projects/[projectId]/project-detail-client`
- `projects/month-close/month-close-client`
- `transaction/recurrent/recurrent-client`
- `add-action-data-cache` sobre client central

## Politicas de TTL
- Core financiero: `CORE_5M` (stale 5m, expire 24h)
- Metadata/suggestions: `META_24H` (stale 24h, expire 7d)

## Notas de implementacion
- El seed SSR de web se puede `prime`ar en cliente para evitar refetch inmediato.
- La invalidacion por tags evita refrescos globales innecesarios.
- `router.refresh()` se conserva en algunos puntos como fallback de navegacion/consistencia server-side.

## Limites actuales
- Faltan metricas de observabilidad (hits/miss/stale/invalidation timing).
- Falta suite formal de tests unit/integracion para cache core + matriz de invalidacion.
- `activeAccountId` en web se sincroniza por `storage` + polling para cubrir cambios same-tab.

## Proximos pasos sugeridos
1. Agregar instrumentacion (eventos de cache y latencias post-mutacion).
2. Completar tests:
   - keys y colisiones
   - TTL/stale/expire
   - mapping de invalidacion
   - clearByUser y clearAll
3. Auditar ultimos `router.refresh()` y reducirlos donde la cache ya garantice consistencia.

