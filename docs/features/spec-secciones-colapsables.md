# Spec: Secciones colapsables en Tu Cuenta

## Referencia

Aplicar sobre el layout definido en `spec-balance-contribuciones.md`. Esta spec modifica el comportamiento de dos secciones: Evolución y Gastos/Ingresos por contribución.

---

## 1. Evolución colapsable

### 1.1 Ubicación

Fila 3, span 2 columnas, debajo de las cards de Ingresos/Gastos.

### 1.2 Estado colapsado (default)

Botón atractivo centrado que invita a expandir:

```
[📊 icono gráfico]  Ver evolución mensual    [chevron ▼]
```

- Ancho: 100% del grid (span 2 cols).
- Fondo: card con borde sutil (mismo estilo que el resto de cards).
- Contenido: icono de gráfico (usar icono existente de la app, tipo bar-chart o trending-up) + texto del título dinámico + chevron indicando expansión.
- Hover (web): fondo ligeramente más oscuro, cursor pointer.
- El título es dinámico según el período seleccionado: "Ver evolución semanal / mensual / trimestral / anual".

### 1.3 Estado expandido

Al hacer click, la card se expande con animación suave para mostrar el gráfico completo:

- Animación: height transition (300ms ease-out). No usar max-height hack — preferir auto height con CSS grid o JavaScript measurement.
- El botón pasa a ser el header de la sección expandida:

```
[📊]  Evolución mensual                    [Ambos] [Ingresos] [Gastos] [Neto]    [chevron ▲]
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              Gráfico de evolución                              │
│                         (mismo contenido que el spec principal)                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

- Los filtros (Ambos / Ingresos / Gastos / Neto) aparecen al expandir, alineados a la derecha del título.
- La leyenda de usuarios (cuando filtro es Ingresos o Gastos) aparece junto a los filtros.
- Click en el header o en el chevron colapsa de nuevo.
- Altura del gráfico: 200px web, 160px móvil.

### 1.4 Persistencia

El estado (colapsado/expandido) no se persiste entre sesiones. Default siempre colapsado.

---

## 2. Gastos/Ingresos por contribución — vista parcial

### 2.1 Estado parcial (default)

Mostrar solo las **2 primeras categorías** (ordenadas por mayor importe total descendente). Debajo, botón para expandir:

```
┌──────────────────────────────────────┐
│ GASTOS POR CONTRIBUCIÓN              │
│                                      │
│ 🏠 Hogar (1 mov)          €850,00   │
│    €850 · 100% [========]    —       │
│                                      │
│ 🛒 Alimentación (4 mov)   €316,00   │
│    €163 · 52% [=====|====] 48% €153 │
│                                      │
│  Ver 2 categorías más        ▼      │
└──────────────────────────────────────┘
```

- El texto del botón es dinámico: "Ver {N} categoría(s) más" / "See {N} more category(ies)".
- El botón está dentro de la card, al final del contenido visible.
- Estilo del botón: texto + chevron, sin fondo, color del link (blue). Centrado o alineado izquierda.
- Si hay 2 o menos categorías, no mostrar el botón (no hay nada que expandir).

### 2.2 Estado expandido

Al hacer click, las categorías restantes aparecen con animación inline:

- Animación: slide down (250ms ease-out), las nuevas categorías entran con fade + translate-y sutil.
- El botón cambia a "Ver menos ▲" / "See less ▲".
- Click en "Ver menos" colapsa de vuelta a las 2 primeras.

### 2.3 Aplica a ambas cards

Tanto "Gastos por contribución" como "Ingresos por contribución" tienen el mismo comportamiento. Cada una gestiona su estado de expansión de forma independiente.

### 2.4 Persistencia

No se persiste entre sesiones. Default siempre parcial (2 categorías).

---

## 3. Versión móvil

### 3.1 Evolución colapsable

Mismo comportamiento. El botón colapsado ocupa el ancho completo. Gráfico expandido a 160px de altura. Filtros scrollable horizontal. Leyenda de usuarios debajo del gráfico.

### 3.2 Categorías parciales

Mismo comportamiento (2 primeras visibles, expandir inline). Texto del botón en versión corta si es necesario: "Ver {N} más" / "See {N} more".

---

## 4. Internacionalización

| Key | ES | EN |
|-----|----|----|
| `account.view_evolution` | Ver evolución {period_adj} | View {period_adj} evolution |
| `account.evolution_adj_weekly` | semanal | weekly |
| `account.evolution_adj_monthly` | mensual | monthly |
| `account.evolution_adj_quarterly` | trimestral | quarterly |
| `account.evolution_adj_yearly` | anual | yearly |
| `account.view_more_categories` | Ver {n} categoría(s) más | See {n} more category(ies) |
| `account.view_less` | Ver menos | See less |

---

## 5. Criterios de aceptación

1. Evolución está colapsada por defecto mostrando un botón con icono de gráfico y título dinámico.
2. Click en el botón expande el gráfico con animación suave (300ms).
3. Los filtros (Ambos/Ingresos/Gastos/Neto) aparecen solo cuando está expandido.
4. Click en header/chevron colapsa la evolución.
5. Gastos por contribución muestra las 2 categorías de mayor importe por defecto.
6. Ingresos por contribución muestra las 2 categorías de mayor importe por defecto.
7. Botón "Ver N categorías más" aparece solo si hay más de 2 categorías.
8. Click en el botón expande inline con animación (250ms).
9. Botón cambia a "Ver menos" cuando está expandido.
10. Cada card (gastos/ingresos) gestiona su expansión de forma independiente.
11. Copys disponibles en ES y EN.
12. En móvil, mismo comportamiento adaptado a una columna.
13. Estado no se persiste entre sesiones.
