# Finnon — Home Screen Redesign: Especificación Técnica

## Contexto

Rediseño de la pantalla de inicio de Finnon. Este documento es la especificación para implementar los cambios en el monorepo (Next.js web + React Native/Expo app). Los wireframes HTML adjuntos son la referencia visual definitiva — no desviarse del estilo trabajado.

**Stack:** Next.js + Supabase + Expo (monorepo, TypeScript, Zustand)
**Plataformas:** Web y App (React Native) — experiencia unificada

---

## 1. Nuevo Layout de la Home

### Estructura (de arriba a abajo)

```
┌─────────────────────────────────────┐
│  Header (logo + avatar)             │
├─────────────────────────────────────┤
│  FILA 1: Balance (full width)       │  ← compacto, una línea
├─────────────────────────────────────┤
│  FILA 2: Proyectos/Ahorro (full w)  │  ← anillos de progreso + hucha
├─────────────────────────────────────┤
│  FILA 3: Calendario                 │  ← heatmap mensual O barras semanales
├─────────────────────────────────────┤
│  FILA 4: Transacciones del día      │
└─────────────────────────────────────┘
```

**Cambios respecto al diseño actual:**
- Balance ya NO comparte fila con Ahorro. Va solo, full width, compacto.
- Ahorro/Proyectos ocupa todo el ancho horizontal.
- El calendario se mantiene abajo pero rediseñado (heatmap + barras semanales).
- Se elimina el pill de neto (= €X) del calendario. Solo se muestran ingresos ↑ y gastos ↓.

---

## 2. Paletas de Color

Finnon tiene dos temas: Grafito y Océano. Todos los componentes deben funcionar en ambos.

### 2.1 Fondos y superficies (existentes, NO cambiar)

| Token | Grafito | Océano |
|-------|---------|--------|
| `background` | `#141413` | `#0E1A27` |
| `surface` | `#1C1C1B` | `#152334` |
| `surfaceAlt` | `#2A2A28` | `#1F3046` |
| `border` | `#31312F` | `#2A415E` |

### 2.2 Texto (usar existentes o ajustar a estos valores)

| Token | Grafito | Océano |
|-------|---------|--------|
| `textPrimary` | `#EDEBE8` | `#E2EAF2` |
| `textSecondary` | `#908D88` | `#7A90A8` |
| `textTertiary` | `#5E5C58` | `#4A6280` |

### 2.3 Heatmap del calendario (NUEVO)

Gradiente de intensidad de gasto. **Cada tema tiene su propia escala.**

| Nivel | Grafito (ámbar cálido) | Océano (coral) |
|-------|----------------------|----------------|
| `heat0` | `transparent` | `transparent` |
| `heat1` | `rgba(212, 148, 58, 0.10)` | `rgba(220, 140, 100, 0.10)` |
| `heat2` | `rgba(212, 140, 50, 0.20)` | `rgba(218, 125, 85, 0.22)` |
| `heat3` | `rgba(215, 130, 42, 0.34)` | `rgba(215, 110, 70, 0.36)` |
| `heat4` | `rgba(218, 118, 35, 0.52)` | `rgba(212, 95, 55, 0.54)` |
| `heat5` | `rgba(222, 105, 28, 0.70)` | `rgba(210, 80, 42, 0.72)` |

**Color del texto del número sobre el heatmap:**

| Nivel | Grafito | Océano |
|-------|---------|--------|
| heat1-2 | `textPrimary` (font-weight 400) | `textPrimary` (font-weight 400) |
| heat3 | `#F5E6D8` (400) | `#F0DDD0` (400) |
| heat4 | `#FFF4EA` (400) | `#FFF0E6` (400) |
| heat5 | `#FFFFFF` (500) | `#FFFFFF` (500) |

### 2.4 Ingresos y gastos

| Token | Valor (ambos temas) |
|-------|-------------------|
| `income` | `#6DC9A0` |
| `incomeBright` | `#8EDBB5` (para uso sobre heat4/heat5) |
| `incomeBg` | `rgba(109, 201, 160, 0.10)` |
| `expenseText` Grafito | `#E0956A` |
| `expenseText` Océano | `#E8A07A` |
| `expenseBg` Grafito | `rgba(224, 149, 106, 0.10)` |
| `expenseBg` Océano | `rgba(232, 160, 122, 0.10)` |

### 2.5 Paleta de categorías (NUEVO — híbrida)

8 colores predefinidos. Se asignan automáticamente por orden de creación de la categoría. El usuario puede cambiar el color desde la configuración de la categoría.

| Índice | Nombre por defecto | Hex | Uso sugerido |
|--------|-------------------|-----|--------------|
| 0 | Ámbar | `#D4943A` | Alimentación |
| 1 | Terracotta | `#CB6E55` | Transporte |
| 2 | Lavanda | `#9B85D6` | Suscripciones |
| 3 | Teal | `#52B3A3` | Suministros |
| 4 | Rosa | `#D47A95` | Ocio |
| 5 | Cielo | `#6AADDB` | Salud |
| 6 | Oliva dorado | `#B8A054` | Educación |
| 7 | Gris cálido | `#A0887A` | Otros |

**Implementación:**
- Añadir campo `color` (string, hex) a la tabla/modelo de categorías.
- Al crear una categoría, asignar el siguiente color libre de la paleta (circular: si hay 9 categorías, la 9ª vuelve al color 0).
- UI de edición de categoría: selector de color con los 8 predefinidos + opción de custom.
- Estos colores tienen contraste WCAG AA sobre ambos fondos oscuros (Grafito y Océano).

### 2.6 Today indicator

| Token | Grafito | Océano |
|-------|---------|--------|
| `todayRing` | `rgba(237, 235, 232, 0.45)` | `rgba(226, 234, 242, 0.40)` |
| `todayBg` (semanal) | `rgba(255, 255, 255, 0.06)` | `rgba(140, 180, 230, 0.08)` |
| `todayBorder` (semanal) | `rgba(255, 255, 255, 0.12)` | `rgba(140, 180, 230, 0.15)` |

### 2.7 Ring track (anillos de progreso)

| Token | Grafito | Océano |
|-------|---------|--------|
| `ringTrack` | `rgba(255, 255, 255, 0.06)` | `rgba(140, 180, 230, 0.08)` |

---

## 3. Componente: Balance Row

### Descripción
Full width, una sola línea. Muestra el balance global + desglose por cuentas (si >1 cuenta).

### Layout
```
┌────────────────────────────────────────────┐
│  BALANCE  €1.262,07       ● €800  ● €462  │
│  (label)  (amount)        (account dots)   │
└────────────────────────────────────────────┘
```

### Props
```typescript
interface BalanceRowProps {
  totalBalance: number;
  accounts: Array<{
    id: string;
    name: string;
    balance: number;
    color: string; // hex del color asignado a la cuenta
  }>;
}
```

### Reglas
- Si el usuario solo tiene **1 cuenta**: NO mostrar el desglose derecho. Solo label + amount.
- Si tiene **2+ cuentas**: mostrar dots con color + importe de cada cuenta, alineados a la derecha.
- Background: `surface`. Border: `borderSubtle` (rgba, no el border sólido).
- Border radius: 14px.
- Padding: 10px 14px.
- Label "BALANCE": 9-10px, uppercase, letter-spacing 0.6px, color `textTertiary`.
- Amount: font family Fraunces (serif), 20-22px, weight 400, color `textPrimary`. Decimales en `textSecondary`, size 13-14px.
- Account dots: 5px, border-radius 50%. Amount del account: 10-11px, weight 500.

---

## 4. Componente: Projects Row (Ahorro)

### Descripción
Full width. Muestra anillos de progreso de cada proyecto activo + hucha + total. Todo el componente es tappeable → navega a la pestaña Proyectos.

### Variantes

#### Variante A: Multi-proyecto (2+ proyectos)
```
┌──────────────────────────────────────────────────┐
│  [✈️ ring] [💻 ring]    AHORRO         Feb ›    │
│  Vacac.    Portátil      €1.582                  │
│                          🐷 Hucha: €1.112    ›   │
└──────────────────────────────────────────────────┘
```

#### Variante B: Hero (1 proyecto)
```
┌──────────────────────────────────────────────────┐
│  [✈️ big ring]  Vacaciones Japón              ›  │
│                 €150 de €150 · ¡Completado! 🎉   │
│  ─────────────────────────────────────────────── │
│  🐷 Hucha  €1.112           Total  €1.262       │
└──────────────────────────────────────────────────┘
```

### Props
```typescript
interface ProjectsRowProps {
  projects: Array<{
    id: string;
    name: string;
    emoji: string;
    currentAmount: number;
    goalAmount: number;
    color: string; // hex - color del anillo
  }>;
  huchaAmount: number;
  totalSavings: number;
  currentMonth: string; // "Feb 2026"
  onPress: () => void; // navegar a pestaña Proyectos
}
```

### Reglas del anillo SVG

```
Ring sizes:
- 1-2 proyectos: 42-44px
- 3-4 proyectos: 34-36px
- 5+ proyectos: colapsar a anillo agregado (futuro)

SVG circle params:
- stroke-width: 3.5
- stroke-linecap: round
- Track: color `ringTrack`
- Progress: color del proyecto
- Transform: rotate(-90deg) para que empiece desde arriba

Proyecto completado (pct >= 100%):
- filter: drop-shadow(0 0 5px var(--income)) en el progress stroke
- Badge ✓ en esquina inferior derecha: 14px, background `income`, color `bg`, border-radius 50%
```

### Estilos
- Background: `surface`. Border: `borderSubtle`. Border-radius: 14px.
- Padding: 12-14px.
- Label "AHORRO": 9-10px, uppercase, letter-spacing 0.6px, `textTertiary`.
- Total: Fraunces, 18-20px, weight 400, color `income` (verde mint).
- Hucha: 10px, `textSecondary`. 🐷 como icono. Amount en `textPrimary`, weight 500.
- Chevron ›: `textTertiary`, 16px, alineado a la derecha.
- Nombre del proyecto debajo del anillo: 8px, `textTertiary`, max-width 48px, text-overflow ellipsis.
- Hero variant: anillo 50px, nombre del proyecto 13px weight 500, progress text 11px.
- Hero bottom: border-top 1px `borderSubtle`, padding-top 10px.

---

## 5. Componente: Calendar — Vista Mensual (Heatmap)

### Descripción
Grid 7x5-6 del mes. El fondo de cada celda refleja la intensidad del gasto (heat0-heat5). Los días con ingreso muestran el número en verde.

### Cálculo del nivel de heat

```typescript
function getHeatLevel(dayExpense: number, monthDays: DayData[]): 0 | 1 | 2 | 3 | 4 | 5 {
  if (dayExpense === 0) return 0;
  
  const expenses = monthDays
    .filter(d => d.expense > 0)
    .map(d => d.expense);
  
  if (expenses.length === 0) return 0;
  
  const maxExpense = Math.max(...expenses);
  const ratio = dayExpense / maxExpense;
  
  if (ratio <= 0.15) return 1;
  if (ratio <= 0.30) return 2;
  if (ratio <= 0.50) return 3;
  if (ratio <= 0.75) return 4;
  return 5;
}
```

**Nota:** Los umbrales son relativos al mes. Un mes con gasto máximo de €50 y otro con máximo de €500 tendrán ambos heat5 en su día más alto. Esto es intencional — el heatmap muestra el patrón relativo, no valores absolutos.

### Layout de la celda

```
┌─────────┐
│         │  ← background: heatN color
│   14    │  ← número del día
│         │     - normal: textSecondary, weight 300
└─────────┘     - con ingreso: income/incomeBright, weight 500
                - hoy: inset box-shadow ring (todayRing), weight 500
```

### Reglas
- Grid: `grid-template-columns: repeat(7, 1fr)`, gap 3-4px.
- Celda: aspect-ratio 1, border-radius 7-8px. **SIN bordes de cuadrícula.**
- Número: 12-13px, centrado.
- Días fuera del mes: opacity 0.18.
- Hover/press: scale(1.1), box-shadow sutil. Mostrar tooltip con desglose gasto/ingreso/neto.
- Días con ingreso: `.num` color `income`. Si además heat4/heat5: usar `incomeBright` + text-shadow `0 0 8px rgba(109,201,160,0.25)`.
- Hoy: `box-shadow: inset 0 0 0 1.5px todayRing`. NO un círculo negro sólido.
- heat4/heat5: inner glow sutil `box-shadow: inset 0 0 10px rgba(200,120,40,0.06)`.

### Tooltip (hover/long-press)

```
┌─────────────────────┐
│ Gasto    −€127.00   │
│ Ingreso  +€15.00    │
│ ─────────────────── │
│ Neto     −€112.00   │
└─────────────────────┘
```

- Background: `surfaceAlt`. Border-radius: 10-12px.
- Shadow: `0 6px 20px rgba(0,0,0,0.4), 0 0 0 1px borderSubtle`.
- Flecha (triángulo CSS) apuntando hacia abajo.
- En mobile: activar con long-press o tap (no hover).

### Legend

```
Menos [░ ▒ ▓ ▓▓ ██] Más gasto        5 = ingreso
```

- Posición: debajo del grid, separado por border-top 1px `borderSubtle`.
- Labels "Menos" / "Más gasto": 9px, `textTertiary`.
- Bloques: 10px cuadrados, border-radius 3px, con los 6 niveles (heat0 usa rgba(255,255,255,0.04)).
- "5 = ingreso": el "5" en `income` bold 11px, el "= ingreso" en `textTertiary` 9px.

### Summary pills (SIN neto)

```
  [↑ €4.059]  [↓ €2.787]
```

- Solo dos pills. NO incluir pill de neto.
- Pill ingresos: background `incomeBg`, color `income`.
- Pill gastos: background `expenseBg`, color `expenseText`.
- Border-radius: 100px. Padding: 5px 10-12px. Font-size: 11px, weight 500.

### Weekday headers
- "L M X J V S D": 9px, `textTertiary`, letter-spacing 0.3px.

### Month navigation
- Toggle "Semana | Mes": background rgba(255,255,255,0.04), active tab background rgba(255,255,255,0.08).
- "‹ Febrero 2026 ›": 13px, weight 500. Flechas en `textTertiary`.

---

## 6. Componente: Calendar — Vista Semanal (Barras Apiladas)

### Descripción
7 columnas (L-D). Cada día muestra: label, número, barra apilada de categorías de gasto, barra de ingreso separada, y neto diario. Cuenta una **historia diferente** al mensual: no cuánto sino en qué.

### Layout por día

```
   LUN
    23
  ┌────┐
  │████│  ← Alimentación (cat color)
  │████│
  │▓▓▓▓│  ← Transporte (cat color)
  └────┘
  ┌────┐
  │░░░░│  ← Ingreso (mint, opacity 0.5)
  └────┘
  −€22
```

### Cálculo de alturas

```typescript
// Encontrar el máximo gasto diario de la semana para escalar
const maxDailyExpense = Math.max(
  ...weekDays.map(d => d.categories.reduce((sum, cat) => sum + cat.amount, 0))
);

const MAX_BAR_HEIGHT = 44; // px (o equivalente en RN)

// Altura de la barra apilada de un día
const dayTotal = day.categories.reduce((sum, cat) => sum + cat.amount, 0);
const stackHeight = (dayTotal / maxDailyExpense) * MAX_BAR_HEIGHT;

// Altura de cada segmento dentro del stack
const segmentHeight = (category.amount / dayTotal) * stackHeight; // en %

// Barra de ingreso (separada, debajo)
const incomeHeight = Math.max((day.income / maxDailyExpense) * MAX_BAR_HEIGHT, 3);
```

### Reglas
- Grid: `grid-template-columns: repeat(7, 1fr)`, gap 4-5px.
- Cada columna: flex column, centrado, padding 7px 0 8px, border-radius 14px.
- Label del día: 8-9px, uppercase, letter-spacing 0.5px, `textTertiary`.
- Número: 16px, weight 300, `textPrimary`. Si hay ingreso significativo (>€1): color `income`, weight 400.
- Barra apilada: width 100% (con padding 0 5px del container), border-radius 4px, overflow hidden. Gap entre segmentos: 1px.
- Segmentos: background = color de la categoría del gasto.
- Barra de ingreso: separada, debajo del stack. Background `income`, opacity 0.5, border-radius 3px, margin-top 2px.
- Min-height del container de barras: 48px (para que las columnas vacías se alineen).
- Neto diario: 8px, weight 500. Negativo = `expenseText`. Positivo = `income`. Cero = `textTertiary`, mostrar "—".
- Hoy: background `todayBg`, box-shadow inset `todayBorder`. Aplica a toda la columna.
- Hover: background rgba(255,255,255,0.03).

### Category legend

```
  ● Alimentación  ● Transporte  ● Suscripciones  ● Suministros  ● Ocio  ● Ingreso
```

- Debajo del grid, border-top 1px `borderSubtle`.
- Flex wrap, gap 3-4px horizontal, 8-10px vertical. Justify center.
- Dot: 5-6px, border-radius 2px. Label: 9px, `textTertiary`.
- Solo mostrar categorías que aparecen en la semana visible + siempre "Ingreso".

### Week navigation
- "‹ 23 feb – 1 mar ›": mismo estilo que el mensual.
- Toggle comparte el mismo componente que el mensual.

---

## 7. Modelo de Datos — Cambios Necesarios

### Tabla `categories`

Añadir campo:

```sql
ALTER TABLE categories ADD COLUMN color VARCHAR(7) DEFAULT NULL;
```

- Si `color` es NULL: asignar automáticamente al renderizar (ver lógica de asignación).
- En la creación de categoría: asignar el siguiente color de la paleta no usado por otra categoría del usuario.
- Si todas están usadas: reciclar desde el índice 0.

### Lógica de asignación de color

```typescript
const CATEGORY_PALETTE = [
  '#D4943A', '#CB6E55', '#9B85D6', '#52B3A3',
  '#D47A95', '#6AADDB', '#B8A054', '#A0887A',
];

function assignCategoryColor(existingCategories: Category[]): string {
  const usedColors = new Set(existingCategories.map(c => c.color).filter(Boolean));
  const available = CATEGORY_PALETTE.find(c => !usedColors.has(c));
  return available || CATEGORY_PALETTE[existingCategories.length % CATEGORY_PALETTE.length];
}
```

### Datos para el calendario

El calendario necesita los siguientes datos precalculados:

```typescript
interface CalendarDayData {
  date: string; // ISO date
  totalExpense: number;
  totalIncome: number;
  net: number;
  // Para vista semanal:
  expensesByCategory: Array<{
    categoryId: string;
    categoryName: string;
    categoryColor: string;
    amount: number;
  }>;
}
```

**Performance:** Calcular en el cliente (Zustand store) a partir de las transacciones del mes. No crear endpoint nuevo. El cálculo es `O(n)` sobre las transacciones del mes — trivial para uso personal.

---

## 8. Tipografía

| Elemento | Font | Size | Weight | Notas |
|----------|------|------|--------|-------|
| Balance amount | Fraunces (serif) | 20-22px | 400 | letter-spacing -0.5px |
| Balance decimals | Fraunces | 13-14px | 400 | color textSecondary |
| Savings total | Fraunces | 18-20px | 400 | color income |
| Calendar day number | DM Sans | 12-13px | 300-500 | varía según heat + income |
| Calendar nav month | DM Sans | 13px | 500 | |
| Labels (BALANCE, AHORRO) | DM Sans | 9-10px | 500 | uppercase, letter-spacing 0.6-0.8px |
| Legend text | DM Sans | 9px | 400 | |
| Pill text | DM Sans | 11px | 500 | |
| Weekly day label | DM Sans | 8-9px | 500 | uppercase |
| Weekly day number | DM Sans | 16px | 300 | |
| Weekly net | DM Sans | 8px | 500 | |

**Notas sobre fuentes:**
- Si Fraunces no está cargada en la app, usar la serif del sistema como fallback.
- DM Sans es la fuente principal de la app (ya debería estar cargada).

---

## 9. Responsive / Cross-Platform

### Web (Next.js)
- El phone frame del wireframe NO es parte de la implementación — es solo para presentación.
- El contenido se renderiza directamente en el viewport.
- Hover states activos (tooltip en hover sobre celdas del calendario).
- Las interacciones de tooltip pueden usar CSS `:hover` o un state manejado.

### App (React Native / Expo)
- Reemplazar CSS grid por `View` con `flexDirection: 'row'` y `flexWrap: 'wrap'`.
- Calendar grid: usar `FlatList` con `numColumns={7}` o flex layout manual.
- SVG rings: usar `react-native-svg` (probablemente ya instalado por los gráficos existentes).
- Tooltips: activar con `onLongPress` o `onPress`. Mostrar como overlay/modal posicionado relativamente a la celda.
- Asegurar que los colores rgba funcionen en RN (funcionan nativamente).
- border-radius, box-shadow → usar equivalentes de RN (`borderRadius`, `shadowColor/shadowOffset/shadowOpacity/shadowRadius` en iOS, `elevation` en Android).
- El inner glow (inset box-shadow) no existe en RN. Alternativa: usar un `LinearGradient` sutil como overlay o simplemente omitir — el heatmap funciona sin él.

### Shared logic
- Los cálculos de `getHeatLevel()`, `assignCategoryColor()`, y `CalendarDayData` deben vivir en la capa compartida del monorepo.
- El Zustand store debería exponer selectores para:
  - `getMonthCalendarData(year, month): CalendarDayData[]`
  - `getWeekCalendarData(startDate): CalendarDayData[]`

---

## 10. Interacciones

| Acción | Componente | Comportamiento |
|--------|-----------|----------------|
| Tap celda calendario | Monthly | Scrollear a las transacciones de ese día abajo |
| Long press celda | Monthly (mobile) | Mostrar tooltip con gasto/ingreso/neto |
| Hover celda | Monthly (web) | Mostrar tooltip |
| Tap columna día | Weekly | Scrollear a transacciones de ese día |
| Tap projects row | Projects | Navegar a pestaña Proyectos |
| Tap balance row | Balance | Navegar a pestaña Tu Cuenta |
| Toggle Semana/Mes | Calendar | Cambiar vista con transición suave |
| Flechas ‹ › | Calendar | Cambiar mes/semana |

---

## 11. Archivos de Referencia

Los siguientes wireframes HTML deben usarse como referencia visual. Abrirlos en el navegador para ver los colores, proporciones y estilos exactos.

| Archivo | Contenido |
|---------|-----------|
| `finnon-home-redesign.html` | **REFERENCIA PRINCIPAL.** Home completo con balance + projects + calendar. Toggles para Grafito/Océano, 1/2/4 proyectos, mensual/semanal. |
| `finnon-calendar-grafito-oceano.html` | Calendario mensual + semanal en ambas paletas, lado a lado. |
| `finnon-calendar-heatmap-dark.html` | Calendario mensual heatmap detallado con tooltips y anotaciones de diseño. |
| `finnon-calendar-weekly-dark.html` | Calendario semanal con barras apiladas y anotaciones. |
| `finnon-savings-widget-redesign.html` | Widget de proyectos con variantes 1/2/4 proyectos y anotaciones. |

---

## 12. Checklist de Implementación

- [ ] Añadir campo `color` a modelo de categorías + migración
- [ ] Implementar lógica de asignación automática de color
- [ ] UI de edición de color en configuración de categoría (8 predefinidos + custom)
- [ ] Componente `BalanceRow` (condicional: desglose solo si >1 cuenta)
- [ ] Componente `ProjectsRow` con variantes hero/multi
- [ ] SVG ring de progreso (compartido web/RN)
- [ ] Badge ✓ para proyectos completados + glow
- [ ] Componente `CalendarMonthly` con heatmap
- [ ] Función `getHeatLevel()` en capa compartida
- [ ] Tooltip de celda (hover web, long-press mobile)
- [ ] Legend del heatmap
- [ ] Componente `CalendarWeekly` con barras apiladas
- [ ] Legend de categorías para vista semanal
- [ ] Summary pills (solo ingresos + gastos, SIN neto)
- [ ] Selectores Zustand para datos de calendario
- [ ] Tokens de color del heatmap en ambos temas
- [ ] Tokens de color de categorías
- [ ] Adaptar home screen layout (nuevo orden de filas)
- [ ] Test en ambos temas (Grafito + Océano)
- [ ] Test en web + app
