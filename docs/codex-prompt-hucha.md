# Codex Prompt — Pantalla Hucha: rediseño visual

## Contexto

Estás trabajando en **Finnon**, app de finanzas para parejas. Stack: Next.js (web) + React Native/Expo (mobile), monorepo, `@poleursus/shared`, Supabase.

Este prompt es **incremental**: no toques las queries a Supabase, la lógica de `getReserveContainerStats`, `getReserveContainerBalanceMinor`, `getProjectReserveTransferTotalsMap`, `getReserveTransferDirection` ni ninguna función de `@poleursus/shared`. Solo modifica la capa visual.

Existe un mockup de referencia (`finnon-proyectos-v5.html`, sección `#sv-hucha`) que puedes consultar para ver el aspecto visual exacto.

---

## Archivos a modificar

### Web
- `apps/web/src/app/reserves/[reserveId]/reserve-detail-client.tsx`

### Mobile
- `apps/mobile/app/(auth)/(tabs)/projects/reserves/[reserveId].tsx`

---

## 1. Cambios estructurales

### 1a. Eliminar

- El `<Card>` de cabecera que muestra "Contenedor de reserva" como eyebrow, el emoji + nombre como `<h1>`, y la descripción — **elimínalo entero**
- El `<Card>` de "Mover a proyecto" con el `<Select>` / chips de proyecto y el `<Input>` de importe — **elimínalo entero**. La transferencia hucha → proyecto ahora se hace desde la pantalla de proyectos, no desde aquí

### 1b. El back link en web

Cambia el destino del link de volver:
```tsx
// Antes
href="/savings"

// Después
href="/projects"
```

Y el texto:
```tsx
// Antes
locale === "en" ? "Back to savings" : "Volver a ahorro"

// Después
locale === "en" ? "Back to projects" : "Volver a proyectos"  // TODO: i18n
```

---

## 2. Hero del círculo animado

Justo después del back link (web) o al inicio del `<ScrollView>` (mobile), añadir un bloque hero centrado:

```
[Círculo animado 160×160px]
"Acumulado"   ← label debajo del círculo, no dentro
[importe acumulado grande]
"Hucha"
"Destino automático del ahorro que no asignas."
```

### Implementación web

```tsx
<div className="flex flex-col items-center py-10 gap-3">
  {/* Círculo */}
  <div className="relative" style={{ width: 160, height: 160 }}>
    <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0 }} />
    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
      <span className="text-2xl font-bold tabular-nums" style={{ color: '#4ECDC4', letterSpacing: '-0.8px' }}>
        {formatMoneyWithSymbol(reserveBalanceMinor, baseCurrency, currencySymbol)}
      </span>
    </div>
  </div>
  {/* Label debajo */}
  <span className="text-[9px] uppercase tracking-widest text-muted-foreground">
    Acumulado {/* TODO: i18n */}
  </span>
  <h1 className="text-2xl font-bold tracking-tight">Hucha</h1> {/* TODO: i18n */}
  <p className="text-sm text-muted-foreground text-center">
    {locale === "en"
      ? "Automatic destination for unassigned savings."
      : "Destino automático del ahorro que no asignas."}
  </p>
</div>
```

### Animación del círculo (Canvas 2D)

Usar `useRef<HTMLCanvasElement>` y `requestAnimationFrame`. Iniciar en `useEffect`, limpiar en el cleanup.

**Parámetros:**
- Tamaño: 160×160px. Canvas físico: `160 * devicePixelRatio`
- Radio: `size * 0.41` = ~65.6px
- Grosor del track: `size * 0.068` = ~10.9px

**Algoritmo de dibujo (ejecutar en cada frame):**

```
1. clearRect(0, 0, S, S)

2. Track circle:
   ctx.arc(cx, cy, r, 0, Math.PI*2)
   strokeStyle = 'rgba(255,255,255,0.07)'   ← tema oscuro
   o 'rgba(0,0,0,0.06)'                      ← tema claro
   lineWidth = S * 0.068

3. ctx.save()
   ctx.arc(cx, cy, r-1, 0, Math.PI*2)
   ctx.clip()   ← todo lo siguiente queda recortado al círculo

4. Calcular nivel de relleno:
   fillTop = cy + r - levelCurrent * r * 2
   (levelCurrent = 0 → vacío, 1 → lleno)

5. Gradiente vertical dentro del clip:
   grad = createLinearGradient(cx, cy-r, cx, cy+r)
   grad.addColorStop(0, '#4ECDC4CC')
   grad.addColorStop(1, '#26A69AEE')
   fillRect(cx-r, fillTop, r*2+2, cy+r+2-fillTop)

6. Onda en la superficie (solo si 0.03 < levelCurrent < 0.97):
   25 puntos distribuidos horizontalmente
   y[i] = fillTop + sin((i/24) * π*4 + waveOffset) * 2.5
   strokeStyle = 'rgba(78,205,196,0.5)'
   lineWidth = 1.8

7. ctx.restore()  ← fin del clip

8. Anillo exterior:
   ctx.arc(cx, cy, r, 0, Math.PI*2)
   strokeStyle = 'rgba(78,205,196,0.35)'
   lineWidth = 1.8
```

**Loop:**
```ts
waveOffset += 0.028          // cada frame, en closure
levelCurrent += (levelTarget - levelCurrent) * 0.04  // lerp suave
```

**Cálculo de `levelTarget`:**
```ts
// Usar el mejor mes como referencia máxima.
// Si no hay historial, usar reserveBalanceMinor como máximo provisional.
const maxReference = reserveStats.bestMonth?.amountMinor ?? reserveBalanceMinor
const levelTarget = maxReference > 0n
  ? Math.min(0.92, Number(reserveBalanceMinor) / Number(maxReference))
  : 0.5
```

El `* 0.92` evita que el círculo aparezca completamente lleno salvo en el mejor mes real.

**React Native:** usar `react-native-canvas` o `expo-2d-context`. Si no están disponibles, implementar con `react-native-svg`:
- `<Circle>` de fondo (track)
- `<ClipPath>` con `<Rect>` de altura animada con `Animated.Value`
- `<Circle>` de relleno dentro del clip con gradiente `<LinearGradient>`
- La onda puede omitirse en mobile si complica la implementación

---

## 3. Grid de stats

Reemplaza los 4 `<Card>` / `summaryCard` actuales por un **grid 2×2** más compacto. En web usar `grid grid-cols-2 gap-2.5`, en mobile `gap: tokens.spacing.sm`.

Cada celda:
- Fondo: `bg-card` (web) / `userTokens.surface` (mobile)
- Borde: `border` / `userTokens.border`
- `border-radius`: `rounded-[14px]` (web) / `tokens.radii.lg` (mobile)
- Padding: `p-4` / `tokens.spacing.md`

Contenido de las 4 celdas, en orden:

| # | Label | Valor | Color valor |
|---|-------|-------|-------------|
| 1 | "Este mes" | `reserveStats.currentMonthContributionMinor` | `#4ECDC4` |
| 2 | "Media mensual" | `reserveStats.averageMinor` | `#4ECDC4` |
| 3 | "Mejor mes" | `reserveStats.bestMonth?.amountMinor` + sublabel con `bestMonth.period` | `#4ECDC4` |
| 4 | "Meses con aportación" | `reserveStats.monthsWithContribution` | foreground normal |

Tipografía:
- Label: `text-[11px] text-muted-foreground mb-1` / `fontSize: xs, textSecondary`
- Valor: `text-xl font-bold tabular-nums tracking-tight` / `fontSize: lg, fontFamily: DMSans-Bold`
- Sublabel (mejor mes): `text-[11px] text-muted-foreground mt-0.5` / `fontSize: xs, textSecondary`

Si `reserveStats.bestMonth` es null, mostrar `—` sin color verde.

---

## 4. Historial de aportes

### Cabecera de sección
```tsx
// Web
<p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground mb-3">
  Historial de aportes {/* TODO: i18n */}
</p>
```

### Lista

Reemplaza los `<Card>` individuales por una **lista agrupada visualmente**: filas adyacentes sin separación entre ellas, con los bordes externos redondeados solo en la primera y última fila. Igual que un `UITableView` de iOS agrupado.

**Web:**
```tsx
<div className="flex flex-col gap-[2px]">
  {activityRows.map((row, idx) => {
    const isFirst = idx === 0
    const isLast  = idx === activityRows.length - 1
    const isOnly  = activityRows.length === 1
    return (
      <div
        key={row.id}
        className="flex items-center justify-between px-4 py-3.5 bg-card"
        style={{
          borderRadius: isOnly
            ? 14
            : isFirst ? '14px 14px 10px 10px'
            : isLast  ? '10px 10px 14px 14px'
            : 10,
        }}
      >
        <div className="min-w-0">
          <p className="text-[13px] text-muted-foreground truncate">{row.label}</p>
        </div>
        <p className={`text-[14px] font-semibold tabular-nums ml-4 shrink-0 ${
          row.amountMinor >= 0n ? 'text-[#4ECDC4]' : 'text-foreground'
        }`}>
          {row.amountMinor >= 0n ? '+' : '-'}
          {formatMoneyWithSymbol(
            row.amountMinor >= 0n ? row.amountMinor : -row.amountMinor,
            baseCurrency,
            currencySymbol
          )}
        </p>
      </div>
    )
  })}
</div>
```

**Diferencias respecto al actual:**
- Sin borde individual por fila (`border` eliminado)
- Sin `row.secondary` ni fecha — solo `row.label` y el importe
- Color positivo: `#4ECDC4` en vez de `text-emerald-700`
- Color negativo: `text-foreground` en vez de `text-slate-900`
- `gap-[2px]` entre filas crea la separación visual mínima

**Mobile:** mismo concepto con `StyleSheet`, `borderRadius` condicional por índice.

---

## 5. Notas de implementación

- **No modificar** `activityRows`, `reserveStats`, `reserveBalanceMinor` ni ningún cálculo derivado
- **No eliminar** el estado `isSubmitting`, `error`, `message` — aunque se elimine el formulario de transferencia, pueden seguir siendo útiles para futuras acciones
- El canvas debe iniciarse en `useEffect(() => { ... return () => cancelAnimationFrame(rafId) }, [])` para evitar leaks
- En Next.js el canvas no puede renderizarse en SSR — asegurarse de que el componente es `'use client'` (ya lo es) y añadir guard `if (typeof window === 'undefined') return` dentro del `useEffect` si es necesario
- Todos los importes en minor units (BigInt). Para la animación del canvas convertir a número: `Number(minor)` — los valores son lo suficientemente pequeños para no perder precisión
- Los strings nuevos sin clave i18n llevan comentario `// TODO: i18n`
- **Mobile:** no usar clases Tailwind — usar `StyleSheet.create`. Colores hardcoded: `#4ECDC4` para valores positivos de hucha
