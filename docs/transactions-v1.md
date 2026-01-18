# PROMPT (Agente de Código) — Finnon Feature: Edición de Recurrentes + Acceso desde Transacciones

## Contexto
En Finnon ya existe el **motor de movimientos recurrentes** (creación/ejecución/generación).  
Esta tarea se centra en:
1) **Añadir acceso desde la UI de Transacciones** a una nueva sección/pantalla **Recurrentes**.  
2) Implementar **edición de un recurrente** (importe, fechas, nombre) con regla: **solo afecta a ocurrencias futuras** (“a posteriori”), sin modificar lo ya ocurrido.

---

## Objetivo
- Desde **Transacciones** el usuario puede entrar a **Recurrentes** en 1 acción clara.
- En **Recurrentes**, se lista lo recurrente con **la misma estética que `transaction-tile`**.
- En el menú de cada tile, opción **Editar**:
  - Editar **nombre**, **importe**, **fechas**.
  - Los cambios solo aplican **a partir de una fecha efectiva** (por defecto: hoy).
  - Nada de “re-escribir el pasado”: no tocar transacciones ya generadas/ocurridas.

---

## Alcance (IN / OUT)

### IN
- UI: enlace/entry-point desde Transacciones → Recurrentes.
- UI: pantalla/section Recurrentes (lista).
- UI: flujo de edición (formulario) accesible desde menú del tile.
- Backend/DB: persistir la edición “solo hacia adelante” de forma transaccional (versionado / effective dates).
- RLS/policies consistentes con el resto de Finnon.

### OUT
- Cambios al motor de recurrentes (NO tocar, solo integrar).
- Reglas avanzadas de recurrencia (ya resuelto por el motor existente).

---

## UX/UI (reglas)
- **Estética idéntica a `transaction-tile`**: reutilizar componente base y patrón de menú (⋯).
- Jerarquía por **espaciado y tipografía**; color solo para estados esenciales.
- Formularios consistentes con “editar transacción” (si existe): mismos inputs, layout y validaciones.

---

## Navegación / Entry Point desde Transacciones
Implementar un acceso visible y sobrio desde la sección/pantalla de Transacciones.

### Requisito
- 1 tap/click desde Transacciones → Recurrentes.

### Opciones (elige la que sea más coherente con tu UI actual)
- **Web**: link/botón “Recurrentes” en el header de Transacciones (cerca de filtros/mes).
- **Mobile**: acción visible en la barra superior (icono + texto) o dentro del menú de acciones de Transacciones, pero sin esconderlo demasiado.

### Copy
- Label: `Recurrentes`

---

## Pantalla/Sección: Recurrentes
### UI
- Título: `Recurrentes`
- Estado vacío: “Aún no hay recurrentes.”
- Lista: cada item es un **tile estilo `transaction-tile`**.

### Contenido recomendado del tile (sin inventar un nuevo diseño)
- `name`
- `amount` formateado como transacción (mismo componente de dinero)
- Sub-línea: info de recurrencia (p.ej. “Mensual · Próxima: 05 Feb” si el motor lo expone)
- Badge pequeño: “Recurrente” (opcional)

### Acciones del tile (menú ⋯)
- `Editar`
- (Opcional si ya existe en tu sistema) `Pausar/Reanudar`
- (Opcional) `Finalizar`

---

## Flujo de Edición (core)
### Entradas editables
- **Nombre** (string)
- **Importe** (amount_minor / decimal según tu sistema)
- **Fechas**:
  - Mínimo: `start_date` / `next_run` / campo equivalente del motor
  - Si tu modelo lo permite: `end_date`
  - Si la “fecha” en tu sistema significa otra cosa (p.ej. “día del mes”), mapearlo al campo correcto del motor.

### Regla “solo hacia adelante”
- Añadir campo `Aplicar desde` (`effective_from`) en UI:
  - Default: **hoy**
  - Permitir elegir fecha futura
- Microcopy fijo debajo del campo:
  - “Los cambios se aplican solo a partir de esta fecha.”

### Guardado
- CTA principal: `Guardar cambios`
- Secundario: `Cancelar`

### Validaciones mínimas
- Importe > 0
- `start_date <= end_date` si aplica
- `effective_from` no puede ser anterior a (hoy - política que defináis); recomendado v1:
  - permitir **hoy o futuro** para evitar ambigüedad
- Campos requeridos: name, amount, start_date (si tu motor lo requiere)

---

## Backend / DB — Implementación recomendada (sin tocar el motor)
> El motor ya existe. Lo que necesitamos es **representar cambios efectivos a partir de una fecha**.

### Requisito técnico
La operación de edición debe ser **transaccional** y soportar auditoría:
- Lo “antiguo” queda cerrado.
- Se crea una versión nueva que aplica desde `effective_from`.

### Opción A (preferida): versionado por filas (effective_from/effective_to)
Si ya tenéis tabla de recurrings, ampliarla; si no, crear tabla de versiones asociada al recurrente.

**Modelo conceptual**
- `recurring_parent` (identidad del recurrente)
- `recurring_versions` (versiones con vigencia)
  - `effective_from date not null`
  - `effective_to date null`
  - campos editables (name, amount, start/end, etc.)

**Algoritmo PATCH (editar)**
1) Validar que el usuario puede editar (RLS + membership account).
2) Obtener versión vigente (effective_to is null).
3) Calcular `effective_from` (input, default hoy).
4) Cerrar versión actual: `effective_to = effective_from - 1 day`.
5) Insertar nueva versión con los campos modificados y `effective_to = null`.
6) Retornar nueva versión.

> Importante: **no modificar transacciones existentes** ya generadas.  
> Si tenéis “pre-generadas futuras”, v1 recomendado: no borrarlas automáticamente; dejarlas como están y que el motor aplique los cambios a nuevas generaciones a partir de la fecha efectiva.

### Opción B: “override schedule” (si tu motor ya lo soporta)
Si el motor tiene concepto de “change requests / overrides / patch effective from”, usar su API interna.
- Asegurar persistencia equivalente y trazabilidad.

---

## API / Server Actions (mínimo)
- `GET /recurrings` (lista para UI)
  - devuelve recurrings vigentes + metadata útil (p.ej. próxima ocurrencia si el motor lo ofrece)
- `PATCH /recurrings/:id` (edición hacia adelante)
  - input: `{ name?, amount_minor?, start_date?, end_date?, effective_from }`

**Nota**
- Hacer la edición en server (Next route handler / server action) para garantizar la transacción.

---

## RLS / Seguridad
- Misma política que otras entidades: acceso por `account_id` y membership.
- Editar: solo roles permitidos (owner/editor).

---

## Definition of Done (DoD)
- Desde Transacciones existe acceso directo a Recurrentes.
- Recurrentes se ve como una lista de `transaction-tile` (sin rediseño).
- Menú ⋯ incluye “Editar”.
- Editar permite cambiar nombre/importe/fechas + “Aplicar desde”.
- Al guardar: solo afecta a futuro (versionado / effective dates); pasado intacto.
- Tests:
  - backend: editar crea nueva versión y cierra la anterior
  - UI: navegación + edición básica ok

---

## Tareas concretas (checklist para el agente)
1) Añadir entry-point Transacciones → Recurrentes (web + mobile si aplica).
2) Crear pantalla Recurrentes con lista (reutilizar transaction-tile).
3) Menú ⋯ del tile: implementar “Editar”.
4) Crear formulario de edición con “Aplicar desde”.
5) Implementar endpoint/server action PATCH transaccional (versionado).
6) Ajustar RLS/policies/migraciones necesarias.
7) Tests básicos (unit/integration/e2e según stack).

---

## Suposiciones (si algo no está definido en el repo)
- La “fecha” editable se interpreta como `start_date`/`end_date` del recurrente (o el equivalente directo del motor).
- `effective_from` por defecto es “hoy” en la zona horaria del usuario.
- No se reescriben transacciones ya ocurridas ni se “recalcula” el pasado.

