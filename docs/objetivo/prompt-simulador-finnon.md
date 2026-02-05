# Prompt: Implementar Simulador de Ahorro en Finnon

## Contexto

Finnon es una app de finanzas personales con dos clientes: web (Next.js) y móvil (React Native). Comparten un paquete `@poleursus/shared` con lógica de negocio en TypeScript.

La pantalla "Objetivo" muestra el progreso hacia una meta de ahorro mensual. Actualmente tiene una sección "Claves" que queremos reemplazar por un **simulador de ahorro contextual**.

## Qué debe hacer el simulador

Permitir al usuario "desactivar" temporalmente gastos recurrentes/pendientes para ver cómo afectaría a su fecha de cumplimiento del objetivo. Es un sandbox: no modifica datos reales, solo simula.

### Comportamiento según estado del objetivo

El objetivo tiene tres estados (`MonthStatus`): `adelantado`, `en_riesgo`, `retrasado`.

**Estado `retrasado`:**
- Simulador expandido por defecto
- Card con fondo rojo suave y borde
- Título: "Simulador de ahorro"
- Subtítulo: "Ajusta gastos para llegar a tu objetivo"
- Lista de recurrentes visible

**Estado `en_riesgo`:**
- Simulador visible pero colapsado por defecto
- Card con fondo amarillo suave y borde
- Subtítulo: "¿Quieres asegurar tu objetivo?"
- Click en header expande/colapsa

**Estado `adelantado`:**
- Solo un enlace discreto: "Explorar escenarios de ahorro"
- Click expande el simulador completo
- Sin colores de alerta, tono neutro

### Interacción del simulador

1. Mostrar lista de transacciones pendientes (gastos con fecha futura en el mes)
2. Cada ítem tiene:
   - Icono de categoría
   - Nombre (merchant o categoría)
   - Importe mensual
   - Impacto: "X días antes" (viene de `delayDays`)
   - Toggle on/off
3. Panel superior muestra impacto agregado:
   - "Cumples X días antes" (suma de `delayDays` de desactivados)
   - "Ahorras €X al mes" (suma de `amountBaseMinor` de desactivados)
4. Si no hay gastos desactivados: "Selecciona gastos a desactivar"

### Cálculo (100% cliente)

Los datos vienen del endpoint de savings candidates que ya existe. Cada `SavingsCandidateTx` tiene:
- `id: string`
- `amountBaseMinor: bigint`
- `delayDays: number | null`
- `merchant: string | null`
- `categoryId: string | null`

El cálculo es una suma simple:
```typescript
const totalDelayDays = disabledTxIds
  .map(id => transactions.find(tx => tx.id === id)?.delayDays ?? 0)
  .reduce((sum, days) => sum + days, 0);

const totalSavedMinor = disabledTxIds
  .map(id => transactions.find(tx => tx.id === id)?.amountBaseMinor ?? 0n)
  .reduce((sum, amount) => sum + amount, 0n);
```

## Arquitectura existente

### Tipos relevantes (de @poleursus/shared)

```typescript
type MonthStatus = "adelantado" | "en_riesgo" | "retrasado";

type CompletionStatus = "completed_today" | "completion_date" | "not_achievable";

type SavingsCandidateTx = {
  id: string;
  date: string;
  amountBaseMinor: bigint;
  currency: string;
  merchant: string | null;
  merchantNorm?: string | null;
  categoryId?: string | null;
  delayDays?: number | null;
  reasonCodes: SavingsReasonCode[];
};

type SavingsSummary = {
  // ... campos existentes
  monthStatus?: MonthStatus;
  completionStatus?: CompletionStatus;
  estimatedCompletionDate?: string | null;
};

type GoalProgressV2 = {
  targetMinor: bigint;
  savedTotalMinor: bigint;
  remainingMinor: bigint;
  progressRatio: number;
  completionStatus: CompletionStatus;
  estimatedCompletionDate: string | null;
  monthStatus: MonthStatus;
  // ...
};
```

### Funciones existentes a reutilizar

```typescript
// De goal-v2.compute.ts
computeGoalProgressV2(summary: SavingsSummary | null): GoalProgressV2 | null
getHeroText({ completionStatus, estimatedCompletionDate, copy }): string
getMonthStatusText({ monthStatus, copy }): string
getDelayDaysText({ delayDays, copy }): string | null
getDayFromDate(dateStr: string | null): number | null
```

### Estado (Zustand)

La app usa Zustand. El simulador necesita estado local para los toggles (qué transacciones están "desactivadas" en la simulación). Esto NO debe persistirse, es solo UI temporal.

## Qué implementar

### 1. Lógica shared (en @poleursus/shared)

Crear `simulator.compute.ts`:

```typescript
export type SimulatorInput = {
  transactions: SavingsCandidateTx[];
  disabledIds: Set<string>;
};

export type SimulatorResult = {
  totalDelayDays: number;
  totalSavedMinor: bigint;
  disabledCount: number;
};

export const computeSimulatorImpact = (input: SimulatorInput): SimulatorResult => {
  // Implementar suma de delayDays y amountBaseMinor de transacciones desactivadas
};

export type SimulatorDisplayText = {
  impactDays: (days: number) => string;
  impactSavings: (amount: string) => string;
  emptyState: string;
};

export const getSimulatorImpactText = (
  result: SimulatorResult,
  copy: SimulatorDisplayText,
  formatMoney: (value: bigint) => string
): { title: string; subtitle: string } => {
  // Generar textos para el panel de impacto
};
```

Exportar desde `index.ts`.

### 2. Componente Web (Next.js)

Crear componente `GoalSimulator` que:
- Reciba `monthStatus`, `transactions: SavingsCandidateTx[]`
- Maneje estado local de `disabledIds: Set<string>`
- Renderice según el estado (expandido/colapsado/link)
- Use las funciones de cálculo del shared

Estilos: usar el sistema de estilos existente del proyecto. Seguir el wireframe adjunto para estructura visual.

### 3. Componente React Native

Mismo comportamiento que web, adaptado a React Native:
- Usar componentes nativos (View, Text, Pressable, Switch)
- Animaciones con Animated o Reanimated si ya lo usan
- Seguir patrones existentes del proyecto

## Wireframe de referencia

Adjunto archivo `finnon-objetivo-wireframe.html` que muestra:
- Los tres estados visuales (adelantado, en_riesgo, retrasado)
- La interacción de los toggles
- El panel de impacto agregado
- La transición entre estados

## Consideraciones

1. **No llamar al backend** para recalcular. Todo es suma en cliente.
2. **delayDays puede ser null** - tratarlo como 0
3. **bigint para importes** - mantener consistencia con el resto del código
4. **El simulador reemplaza "Claves"** - eliminar esa sección
5. **Formateo de moneda** - reutilizar formatters existentes del proyecto
6. **i18n** - usar el sistema de copys existente, no hardcodear textos

## Archivos adjuntos

- `finnon-objetivo-wireframe.html` - Wireframe interactivo
- Código actual del módulo goal en shared (para contexto)

## Eliminar Modo Ahorro

El "modo ahorro" actual es un flujo que lleva al usuario de la pantalla Objetivo a la pantalla Movimientos con un filtro especial que muestra gastos de alto impacto. Este flujo se elimina porque:

1. Rompe el contexto del usuario (lo saca de Objetivo)
2. Muestra gastos fijos no accionables (hipoteca, coche)
3. No permite simular, solo informa
4. El simulador nuevo hace todo esto mejor sin salir de Objetivo

### Qué eliminar

1. **Botón "Ver modo ahorro"** en la pantalla Objetivo
2. **Estado/filtro "modo ahorro"** en la pantalla Movimientos
3. **Sección "Más impacto en tu objetivo"** en Movimientos (la que aparece en modo ahorro)
4. **Lógica relacionada** en stores/hooks que manejen el estado de modo ahorro
5. **Copys/traducciones** relacionadas con modo ahorro

### Qué mantener

- El endpoint de savings candidates (`SavingsCandidateTx`) - lo usa el simulador
- La lógica de cálculo de `delayDays` - la usa el simulador
- Los tipos `SavingsReasonCode`, `SavingsCandidateTx`, etc. - se reutilizan

### Archivos probablemente afectados

- Pantalla Objetivo (web y mobile): quitar botón
- Pantalla Movimientos (web y mobile): quitar lógica de modo ahorro
- Store de movimientos: quitar estado de modo ahorro
- Navegación: quitar rutas/params relacionados

Buscar en el código referencias a:
- `saving-mode`, `savingMode`, `saving_mode`
- `modoAhorro`, `modo-ahorro`, `modo_ahorro`
- Textos como "Ver modo ahorro", "Salir del modo ahorro"

## Entregables

1. `simulator.compute.ts` en shared con lógica y tipos
2. Actualizar `index.ts` del shared para exportar lo nuevo
3. Componente `GoalSimulator` para web
4. Componente `GoalSimulator` para React Native
5. Integración en la pantalla Objetivo existente (reemplazar Claves)
6. Eliminar modo ahorro de Objetivo (web y mobile)
7. Eliminar modo ahorro de Movimientos (web y mobile)
8. Limpiar stores/hooks relacionados con modo ahorro
