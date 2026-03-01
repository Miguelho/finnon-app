# Finnon — Paleta de Colores de Proyectos: Especificación Técnica

## Contexto

Los proyectos de ahorro usan actualmente el color naranja/ámbar de la paleta de categorías de gasto, lo cual transmite "alerta" en vez de "meta positiva". Este cambio introduce una paleta fría/optimista exclusiva para proyectos, separada de la paleta de categorías.

**Principio:** Proyectos (metas) = tonos fríos (azules, verdes, lavandas) → aspiración, calma. Categorías (gastos) = tonos cálidos → actividad, gasto. La Hucha tiene color fijo mint.

---

## 1. Paleta de Proyectos

8 colores predefinidos. Se asignan automáticamente por orden de creación del proyecto. El usuario puede cambiar el color desde la edición del proyecto.

| Índice | Nombre | Hex |
|--------|--------|-----|
| 0 | Sky Blue | `#5B9FE4` |
| 1 | Mint | `#6DC9A0` |
| 2 | Lavender | `#9B85D6` |
| 3 | Teal | `#52B3B3` |
| 4 | Soft Blue | `#7AB8E0` |
| 5 | Seafoam | `#82C9C0` |
| 6 | Soft Purple | `#B094E0` |
| 7 | Emerald | `#5ECBA1` |

**Hucha: color FIJO `#6DC9A0` (mint).** No usa esta paleta. No es editable. Es el color de "ingreso/ahorro positivo" en todo Finnon.

---

## 2. Migración de Base de Datos

Añadir campo `color` a la tabla de proyectos (si no existe):

```sql
ALTER TABLE projects ADD COLUMN color VARCHAR(7) DEFAULT NULL;
```

- La Hucha NO tiene campo color — siempre renderiza con `#6DC9A0` hardcoded.
- Si `color` es NULL en un proyecto existente: asignar automáticamente al renderizar.

---

## 3. Lógica de Asignación

```typescript
const PROJECT_PALETTE = [
  '#5B9FE4', '#6DC9A0', '#9B85D6', '#52B3B3',
  '#7AB8E0', '#82C9C0', '#B094E0', '#5ECBA1',
];

function assignProjectColor(existingProjects: Project[]): string {
  const usedColors = new Set(existingProjects.map(p => p.color).filter(Boolean));
  const available = PROJECT_PALETTE.find(c => !usedColors.has(c));
  return available || PROJECT_PALETTE[existingProjects.length % PROJECT_PALETTE.length];
}
```

- Al crear un proyecto: llamar a `assignProjectColor()` con los proyectos existentes del usuario.
- Primer proyecto → `#5B9FE4` (Sky Blue) por defecto.
- Si todas están usadas (9+ proyectos): reciclar desde el índice 0.

---

## 4. Dónde Aplica el Color del Proyecto

| Componente | Elemento | Color |
|------------|----------|-------|
| Home → Projects Row | Stroke del anillo SVG de progreso | `project.color` |
| Home → Projects Row | Porcentaje/label del proyecto | `project.color` |
| Home → Projects Row | Glow al completar (drop-shadow) | `project.color` |
| Home → Projects Row | Badge ✓ de completado | Siempre `#6DC9A0` (mint) |
| Pestaña Proyectos | Anillo/barra de progreso del proyecto | `project.color` |
| Pestaña Proyectos | Barra superior del card (si existe) | `project.color` |
| Hucha (todos los sitios) | Texto del importe, barra, icono | Siempre `#6DC9A0` (mint) |

**Nota sobre el glow de completado:** Cuando un proyecto llega al 100%, el anillo emite `filter: drop-shadow(0 0 5px {project.color})`. El badge ✓ siempre es mint — refuerza "meta alcanzada = ahorro positivo".

---

## 5. UI de Edición de Color

En la pantalla de edición del proyecto, añadir selector de color:

- Mostrar los 8 colores predefinidos como círculos seleccionables.
- El color activo tiene un anillo de selección (border 2px blanco al 50% de opacidad).
- Opcionalmente: permitir color custom (input hex). Esto es secondary — no bloquea el lanzamiento.
- La Hucha NO tiene esta opción — no se puede editar su color.

---

## 6. Archivo de Referencia Visual

| Archivo | Contenido |
|---------|-----------|
| `finnon-project-palette.html` | Preview de los 8 colores, anillos renderizados sobre Grafito y Océano, comparación con paleta de categorías |

---

## 7. Checklist

- [ ] Migración: añadir campo `color` a tabla `projects`
- [ ] Constante `PROJECT_PALETTE` en capa compartida del monorepo
- [ ] Función `assignProjectColor()` en capa compartida
- [ ] Al crear proyecto: asignar color automáticamente
- [ ] Proyectos existentes sin color: asignar al renderizar (no migrar datos retroactivamente)
- [ ] Actualizar anillo SVG en Home → Projects Row para usar `project.color`
- [ ] Actualizar pestaña Proyectos para usar `project.color`
- [ ] Hucha siempre renderiza con `#6DC9A0`, sin campo color editable
- [ ] Glow de completado usa `project.color`, badge ✓ usa `#6DC9A0`
- [ ] UI de edición de color en configuración del proyecto (8 predefinidos)
- [ ] Test en ambos temas (Grafito + Océano)
- [ ] Test en web + app
