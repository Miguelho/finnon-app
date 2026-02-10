# Tarea: Añadir gestión de categorías en pantalla "Cuenta activa" + pulir aspecto visual

## Contexto

La pantalla "Cuenta activa" (ajustes de cuenta) existe en web y móvil. Actualmente muestra:
- Sección "Detalles de la cuenta" con nombre de cuenta, moneda base y lista de participantes con sus roles.
- En móvil, además incluye la acción "Cerrar sesión".

Se necesitan dos cosas:
1. **Añadir una sección de gestión de categorías** debajo de la sección de participantes.
2. **Pulir el aspecto visual y el copy** de toda la pantalla para que transmita profesionalidad.

---

## 1. Sección de categorías

### Ubicación
- Nueva sección debajo de "Participantes", dentro de la misma card/contenedor.
- Separada visualmente por un divider horizontal, igual que la separación que ya existe en móvil antes de "Cerrar sesión".

### Contenido
- Header: **"Categorías"** con subtítulo **"Organiza tus movimientos por tipo de gasto o ingreso"**.
- Contador entre paréntesis con el número de categorías existentes, ej: `Categorías (8)`.
- Lista de categorías existentes en la cuenta, cada una mostrando: icono, nombre y tipo (Gasto/Ingreso).
- Cada categoría es clickable/tappable y abre el formulario de edición de categoría (reutilizar el componente de "Nueva categoría" que ya existe, en modo edición).
- Al final de la lista de categorías, añadir un enlace de texto secundario (no botón primario): **"+ Añadir categoría"**, que abre el formulario existente de "Nueva categoría" en modo creación. Debe ser visualmente discreto (texto con color accent, sin fondo ni borde) para no competir con el botón principal de "+ Añadir" en la navbar.

### Comportamiento
- La lista se obtiene filtrando las categorías de la cuenta activa.
- Al pulsar una categoría se abre el formulario existente de categoría precargado con los datos (nombre, tipo, icono), permitiendo editar y guardar cambios.
- Considerar añadir opción de eliminar categoría dentro del formulario de edición (si no existe ya), con confirmación previa.

---

## 2. Pulir aspecto visual y copy

### Copy — cambios específicos

| Actual | Nuevo |
|---|---|
| Título: "Cuenta activa" | "Configuración de la cuenta" |
| Subtítulo: "Ver detalles y participantes de la cuenta activa" | "Gestiona los detalles, participantes y categorías de tu cuenta" |
| Sección: "Detalles de la cuenta" | "Detalles de la cuenta" (sin cambio) |
| Sub-sección: "Participantes y contexto de la cuenta" | Eliminar — es redundante con el subtítulo de la página |
| Label "CUENTA" encima del nombre | Eliminar — el nombre de la cuenta es autoevidente en contexto |
| "Moneda base: EUR" | "Moneda: EUR" |
| Label "PARTICIPANTES (N)" | "Miembros (N)" |
| Móvil — "Cerrar sesión" / "Salir de tu cuenta en este dispositivo" | "Cerrar sesión" / "Cierra sesión en este dispositivo" (imperativo, más directo) |

### Visual — ajustes

- **Jerarquía tipográfica:** El título de página ("Configuración de la cuenta") debe tener peso claro como h1. Las secciones internas (Miembros, Categorías) usan un tamaño menor pero con peso semibold para marcar separación.
- **Espaciado:** Revisar que haya padding consistente entre secciones. Actualmente en web la card tiene mucho espacio vacío debajo de la lista de participantes.
- **Participantes:** Cada fila de participante debe tener altura consistente. El badge de rol (Admin/Viewer) debe usar el mismo estilo visual en web y móvil — actualmente web usa texto plano y móvil usa un badge con fondo. Unificar hacia el estilo badge.
- **Aplicar cambios en ambas plataformas** (web y móvil) manteniendo coherencia visual.

---

## Archivos relevantes

Buscar en el proyecto los siguientes patrones para localizar los archivos afectados:
- Pantalla de "Cuenta activa" → buscar `Cuenta activa` o `ActiveAccount` o `AccountSettings` en los archivos de pantallas/pages.
- Componente de formulario de categoría → buscar `Nueva categoría` o `CategoryForm` o `CreateCategory`.
- Modelo/tipo de categoría → buscar la interfaz TypeScript de `Category` en `@poleursus/shared`.

---

## Criterios de aceptación

- [ ] La pantalla "Cuenta activa" muestra la sección de categorías con la lista completa de categorías de la cuenta.
- [ ] Al pulsar una categoría se abre el formulario existente precargado en modo edición.
- [ ] El copy actualizado se aplica tanto en web como en móvil.
- [ ] Los badges de rol de participantes tienen estilo visual unificado entre plataformas.
- [ ] No se ha añadido ningún botón primario de "Crear categoría" en esta pantalla, pero sí existe un enlace de texto secundario "+" al final de la lista que abre el formulario de creación.
- [ ] La pantalla no tiene regresiones visuales en el resto de secciones.
