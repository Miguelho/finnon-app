# Codex Prompt — Mejora visual del selector de proyectos (incremental)

## Contexto
Ya está implementada la feature de aportaciones extra a proyectos desde el formulario de movimientos. El selector de proyecto existe y funciona como un dropdown estándar con la opción "Sin proyecto" y la lista de proyectos activos.

## Único cambio requerido

**Reemplazar el dropdown nativo por un componente custom** que refleje la identidad visual de cada proyecto.

### Diseño del item

- **Fondo:** color del proyecto
- **Texto:** adaptado por luminosidad del fondo
  - Fórmula: `0.299*R + 0.587*G + 0.114*B`
  - Si luminosidad > 128 → texto `#1C1E21`
  - Si luminosidad ≤ 128 → texto `#FAFAF8`
- **Contenido:** `[emoji] Nombre del proyecto`
- **Opción vacía** ("Sin proyecto"): sin color de fondo, estilo neutro

### El item seleccionado (campo cerrado)
Debe reflejar el mismo tratamiento visual — fondo del color del proyecto, emoji y nombre visibles. No volver al estilo neutro una vez seleccionado.

### Plataformas
Tanto **web (Next.js)** como **mobile (React Native/Expo)** requieren componente custom — los selectores nativos no soportan este nivel de personalización visual.

## Lo que NO cambia
- Lógica de asignación (`project_id` en la transacción)
- Condición de visibilidad (solo en gastos)
- Orden de la lista (proyectos activos ordenados por nombre)
- Posición en el formulario (después de Notas, antes de Guardar)
