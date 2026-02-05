# Prompt: Simplificar Hero de Pantalla Objetivo

## Contexto

La pantalla "Objetivo" de Finnon muestra el progreso hacia una meta de ahorro mensual. El hero actual tiene demasiados elementos compitiendo por atención y confunde al usuario mezclando ahorro real con proyectado.

## Problema actual

El hero muestra:
- "Objetivo del mes" (label redundante)
- "A este ritmo, cumplirás el día 28" (mensaje principal)
- "Vas justo" (estado)
- Barra de progreso
- "Progreso" con icono de info
- "€3244.99 / €3000.00"
- "Restante: Objetivo alcanzado"
- Botón "Editar objetivo"

Problemas:
1. El dato principal (cuánto lleva ahorrado) está enterrado
2. Muestra €3244 cuando eso incluye ingresos futuros (nómina del día 28)
3. Dice "Objetivo alcanzado" pero también "cumplirás el día 28" → contradictorio
4. "Vas justo" es redundante si ya hay barra de progreso
5. Demasiados labels y elementos decorativos

## Solución

Simplificar a una jerarquía clara:
1. **Ahorro real** (solo movimientos ejecutados) → número grande, protagonista
2. **Objetivo** → contexto inline
3. **Barra de progreso** → basada en ahorro real
4. **Proyección** → chip secundario explicando cuándo y cuánto llegará con pendientes

## Diseño nuevo

```
┌─────────────────────────────────────┐
│                           [Editar]  │
│                                     │
│            €1.244,99                │  ← Grande, centrado (savedRealMinor)
│         de €3.000 este mes          │  ← Gris, contexto (targetMinor)
│                                     │
│   ████████████░░░░░░░░░░░░░░░░░░   │  ← Barra basada en real (41%)
│                                     │
│   ↑ Con tus ingresos del día 28,   │  ← Chip verde con proyección
│     llegarás a €3.244,99            │    (savedTotalMinor + fecha)
│                                     │
└─────────────────────────────────────┘
```

## Datos disponibles

De `SavingsSummary` (ya existe en el código):

```typescript
// Ahorro real (solo ejecutados)
savedRealMinor: bigint

// Ahorro total (real + pendientes)
savedTotalMinor: bigint

// Objetivo
targetMinor: bigint

// Fecha estimada de cumplimiento
estimatedCompletionDate: string | null  // "YYYY-MM-DD"

// Estado
completionStatus: "completed_today" | "completion_date" | "not_achievable"
monthStatus: "adelantado" | "en_riesgo" | "retrasado"
```

## Lógica de colores de la barra

Basada en el progreso REAL (no proyectado):

```typescript
const realProgressRatio = Number(savedRealMinor) / Number(targetMinor);

// Color basado en si el ahorro real ya cumple el objetivo
if (savedRealMinor >= targetMinor) {
  // Verde: objetivo cumplido con lo que tiene hoy
  return "positive"; 
} else if (completionStatus === "not_achievable") {
  // Rojo: no llegará ni con los pendientes
  return "negative";
} else {
  // Amarillo: pendiente, pero llegará con los ingresos futuros
  return "neutral";
}
```

## Lógica del chip de proyección

Solo mostrar si hay diferencia entre real y proyectado:

```typescript
const showProjection = savedTotalMinor > savedRealMinor && 
                       completionStatus !== "not_achievable";

// Texto del chip
if (completionStatus === "completed_today") {
  // Ya cumplido hoy, no mostrar proyección
  return null;
} else if (completionStatus === "completion_date" && estimatedCompletionDate) {
  const day = getDayFromDate(estimatedCompletionDate);
  return `Con tus ingresos del día ${day}, llegarás a ${formatMoney(savedTotalMinor)}`;
} else {
  return null;
}
```

## Qué implementar

### 1. Actualizar lógica en shared

En `goal-v2.compute.ts`, añadir función para calcular datos del hero:

```typescript
export type HeroDisplayData = {
  // Dato principal
  savedRealMinor: bigint;
  targetMinor: bigint;
  realProgressRatio: number;
  
  // Color de barra
  barStatus: "positive" | "neutral" | "negative";
  
  // Proyección (null si no aplica)
  projection: {
    amount: bigint;
    day: number;
  } | null;
};

export const computeHeroDisplay = (summary: SavingsSummary | null): HeroDisplayData | null => {
  // Implementar según lógica descrita
};
```

### 2. Actualizar componente Hero (web y mobile)

Cambiar la estructura del hero para:
- Mostrar `savedRealMinor` como número principal grande
- Calcular barra con `realProgressRatio`
- Mostrar chip de proyección condicionalmente

### 3. Eliminar elementos

Quitar del hero:
- Label "Objetivo del mes"
- Texto de estado "Vas justo" / "Vas por delante" / "Te estás desviando"
- Label "Progreso" con icono info
- Sección "Restante: X"
- Texto "Editar objetivo" → simplificar a "Editar"

### 4. Eliminar sección Claves

Quitar completamente la sección "Claves" con el carrusel. Es redundante con el simulador.

## Copys necesarios

```typescript
const heroTexts = {
  target: (amount: string) => `de ${amount} este mes`,
  projection: (day: number, amount: string) => 
    `Con tus ingresos del día ${day}, llegarás a ${amount}`,
  edit: "Editar",
};
```

## Wireframe de referencia

Adjunto archivo `finnon-hero-simplificado-2.html` con comparativa visual entre versión actual y nueva.

## Entregables

1. Función `computeHeroDisplay` en shared
2. Componente Hero actualizado para web (Next.js)
3. Componente Hero actualizado para mobile (React Native)
4. Eliminar sección "Claves" de ambas plataformas
5. Actualizar copys/traducciones
