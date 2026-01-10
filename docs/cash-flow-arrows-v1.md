# CashFlowArrows - Resumen de Componente

## Contexto

Este documento describe el componente `CashFlowArrows` que visualiza el flujo de efectivo (ingresos vs gastos) en la pantalla principal (Home) de Finnon. La intención es proporcionar contexto para explorar mejores alternativas de diseño.

---

## Descripción General

El componente muestra tres elementos principales en una disposición horizontal:

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   INGRESOS          BALANCE           GASTOS                │
│   ─────────→        +$1,200           ←─────────            │
│   +$5,000                             -$3,800               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Elementos Visuales Actuales

1. **Flecha de Ingresos (izquierda)**: Apunta hacia la derecha (→)
2. **Balance Neto (centro)**: Número grande con signo (+/-)
3. **Flecha de Gastos (derecha)**: Apunta hacia la izquierda (←)

---

## Comportamiento Dinámico

### Ancho Proporcional de Flechas

Las flechas tienen un ancho dinámico basado en la proporción relativa:

```
incomeWidth = (incomeValue / maxValue) * maxWidth
expenseWidth = (expenseValue / maxValue) * maxWidth
```

- **Mínimo**: 60px (web) / 16px (mobile)
- **Máximo**: 160px (web) / 120px (mobile)
- La flecha más grande siempre tendrá el ancho máximo
- La otra flecha se escala proporcionalmente

**Ejemplo:**
- Ingresos: $5,000 → ancho máximo (160px)
- Gastos: $2,500 → ancho proporcional (80px)

### Color del Balance

- **Positivo (≥0)**: Color de texto primario (gris oscuro)
- **Negativo (<0)**: Color de estado negativo (rojo)

---

## Estructura Visual Detallada

### Composición de las Flechas

Cada flecha se compone de:
1. **Línea**: `<span>` con height de 2px, border-radius redondeado
2. **Punta**: Triángulo CSS usando border-trick (6px × 8px)

```css
/* Punta derecha (ingresos) */
border-top: 4px solid transparent;
border-bottom: 4px solid transparent;
border-left: 6px solid [color];

/* Punta izquierda (gastos) */
border-top: 4px solid transparent;
border-bottom: 4px solid transparent;
border-right: 6px solid [color];
```

### Tipografía

| Elemento | Estilo | Descripción |
|----------|--------|-------------|
| Labels | `typography.meta` | "Ingresos", "Gastos", "Balance" |
| Montos | `typography.body` | "+$5,000", "-$3,800" |
| Balance | `typography.display` | Número grande central |

### Colores Actuales

- Flechas y líneas: `colors.text.secondary` (gris)
- Labels: `colors.text.secondary` (gris)
- Montos: `colors.text.primary` (oscuro)
- Balance negativo: `colors.state.negative` (rojo)

---

## Props del Componente

```typescript
type CashFlowArrowsProps = {
  incomeMinor: bigint;      // Monto de ingresos en centavos
  expenseMinor: bigint;     // Monto de gastos en centavos
  netMinor: bigint;         // Balance neto (income - expense)
  currency: string;         // Código de moneda (USD, MXN, etc.)
  currencySymbol: string;   // Símbolo ($, €, etc.)
  incomeLabel: string;      // Label localizado para ingresos
  expenseLabel: string;     // Label localizado para gastos
  balanceLabel: string;     // Label localizado para balance
};
```

---

## Ubicación en el Flujo de Datos

```
┌──────────────────────────────────────────────────────────┐
│                    Base de Datos                          │
│              (transactions, obligations)                  │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│               home.compute.ts                             │
│  - getAccountGlobalState(): suma ingresos/gastos         │
│  - getSummaryForDay(): resumen por día                   │
│  - getFlowForRange(): flujo para N días                  │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│               home.viewmodel.ts                           │
│  - buildHomeViewModel(): orquesta todos los cálculos     │
└─────────────────────────┬────────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                  CashFlowArrows                           │
│               (Componente Visual)                         │
└──────────────────────────────────────────────────────────┘
```

---

## Archivos Relacionados

| Archivo | Descripción |
|---------|-------------|
| `apps/mobile/src/components/home/CashFlowArrows.tsx` | Versión React Native |
| `apps/web/src/components/home/cash-flow-arrows.tsx` | Versión Web |
| `packages/shared/src/home/home.compute.ts` | Lógica de cálculo |
| `packages/shared/src/home/home.viewmodel.ts` | ViewModel |

---

## Observaciones para Rediseño

### Fortalezas Actuales
- Visualización clara de la relación ingresos/gastos
- Proporcionalidad visual del tamaño de flechas
- Indicador de color para balance negativo

### Áreas de Oportunidad
1. **Semántica visual**: Las flechas horizontales no tienen una dirección semántica clara (¿por qué ingresos va a la derecha?)
2. **Densidad de información**: Tres números + dos flechas pueden ser mucho para procesar
3. **Accesibilidad**: Depende únicamente del color para indicar estado negativo
4. **Metáfora**: Las flechas no comunican claramente "flujo de dinero"

### Preguntas para Explorar

1. ¿Qué metáfora visual representa mejor "dinero que entra" vs "dinero que sale"?
2. ¿El balance neto debería ser el elemento principal o secundario?
3. ¿Cómo podemos hacer que la proporción ingresos/gastos sea más intuitiva?
4. ¿Qué emociones queremos evocar con este componente?
5. ¿Cómo se comporta visualmente cuando los valores son extremos (mucho más ingresos que gastos, o viceversa)?

### Ideas Alternativas a Explorar

- **Barras verticales**: Como un mini bar chart
- **Círculo/Gauge**: Representación radial del balance
- **Animación de flujo**: Partículas o líneas animadas mostrando dirección
- **Contenedor/Recipiente**: Metáfora de "llenar" vs "vaciar"
- **Escala/Balance**: Balanza visual que se inclina según la diferencia

---

## Contexto de Uso

Este componente aparece en:
- **Home Screen (mobile)**: Parte superior, sobre el MonthMap
- **Home Hero (web)**: Sección principal del dashboard

Se complementa con:
- **MonthMap**: Calendario visual del mes con indicadores de actividad
- **DayDetailPanel**: Panel que muestra detalles del día seleccionado
