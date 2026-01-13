# Prompt para agente de código — Nuevas categorías base (Mascotas, Ocio, Familia, Niños, Infancia)

## Contexto
Estamos migrando el sistema de categorías de emojis a iconos (Phosphor) y queremos ampliar el catálogo de categorías base para que el usuario pueda empezar sin fricción.

## Objetivo
Añadir 5 categorías base nuevas:
- Mascotas
- Ocio
- Familia
- Niños
- Infancia

Estas categorías deben aparecer tanto en web como en móvil, con icono Phosphor asignado y con buena integración con la función de sugerencia de icono por nombre.

---

## Guardarraíles
- Mantener consistencia web/móvil: misma lista, mismas claves, mismos textos.
- No introducir nuevos icon sets: usar el set Phosphor ya definido para categorías.
- No romper categorías existentes ni el flujo de crear/editar categorías.
- Si existe seed inicial por cuenta/usuario: respetar el patrón actual (idempotente).

---

## Implementación

### 1) Añadir categorías al seed / catálogo base
Localiza el mecanismo actual de “categorías por defecto” (seed, fixtures, onboarding, etc.) y añade estas entradas.

Cada entrada debe incluir:
- `name` (ES): `"Mascotas"`, `"Ocio"`, `"Familia"`, `"Niños"`, `"Infancia"`
- `iconKey` (CategoryIconKey)
- (si aplica) `type` / `kind` (expense/income) → por defecto **expense**
- (si aplica) `color` / `order` / `isDefault` según el esquema existente

**Asignación de iconos (propuesta)**
- Mascotas → `PawPrint`
- Ocio → `GameController` (alternativa: `FilmSlate` o `Ticket`)
- Familia → `UsersThree`
- Niños → `Baby` *(si no está en el set de 50, usa `UsersThree` o `Gift`)*
- Infancia → `Toy` *(si no está en el set de 50, usa `Gift` o `Balloon`)*

> Nota: si `Baby`, `Toy`, `Balloon` no están en el set canónico de 50, NO inventes.
> En ese caso:
> - O bien reasignas a iconos existentes (UsersThree/Gift),
> - o amplías el set canónico a 52–53 iconos **solo si es aceptable en el repo** y se mantiene coherencia.

### 2) Ampliar la función `suggestCategoryIcon(name)`
Actualizar el diccionario de keywords para que estas categorías se sugieran bien.

Añadir keywords ES/EN:
- Mascotas: `mascotas`, `mascota`, `perro`, `gato`, `veterinario`, `pet`, `dog`, `cat`, `vet` → `PawPrint`
- Ocio: `ocio`, `hobby`, `diversion`, `juegos`, `cine`, `teatro`, `concierto`, `fun`, `leisure` → `GameController` / `FilmSlate` / `Ticket` (elige una primaria consistente)
- Familia: `familia`, `family`, `hogar` (ojo con colisión con House), `pareja` → `UsersThree`
- Niños: `niños`, `ninos`, `hijo`, `hija`, `guarderia`, `colegio` (si ya va a education), `kids`, `child` → `Baby` o fallback definido
- Infancia: `infancia`, `childhood`, `juguetes`, `toy`, `cumple` → `Toy` o fallback definido

Requisito:
- La sugerencia debe devolver `primary` + `suggestions` con `confidence`.
- Si “Niños/Infancia” cae en fallback, debe devolver sugerencias razonables (UsersThree, Gift, BookOpen).

### 3) UI
- En el selector/galería de categorías, asegurar que estas 5 aparecen:
  - en la lista base (si se muestra)
  - en búsquedas por texto (si aplica)
  - con icono renderizado correctamente (regular vs fill al seleccionar)

### 4) Tests
- Añadir unit tests para `suggestCategoryIcon`:
  - `"Mascotas"` → PawPrint (high)
  - `"Veterinario"` → PawPrint (medium/high)
  - `"Ocio"` → GameController (high)
  - `"Familia"` → UsersThree (high)
  - `"Niños"` / `"Ninos"` → Baby o fallback (según implementación) con confidence adecuado
  - `"Infancia"` → Toy o fallback (según implementación)

---

## Definition of Done
- [ ] Las 5 categorías están en el seed/catálogo base y se crean correctamente en cuentas nuevas.
- [ ] En cuentas existentes, el seed es idempotente (no duplica).
- [ ] Cada categoría tiene `iconKey` válido dentro del set canónico.
- [ ] `suggestCategoryIcon` sugiere correctamente estas categorías (con tests).
- [ ] Web y móvil muestran las categorías con iconos y estado seleccionado filled.

---

## Entregables
- PR con:
  - actualización del seed/catálogo base
  - updates en `suggestCategoryIcon` +
