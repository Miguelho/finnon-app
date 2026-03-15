# Codex Prompt — Savings: círculo animado hucha + total planificado

## Contexto

Estás trabajando en **Finnon**, app de finanzas para parejas. Stack: Next.js (web) + React Native/Expo (mobile), monorepo pnpm, `@poleursus/shared`.

Este prompt tiene dos partes independientes. Puedes implementarlas en cualquier orden.

---

## Parte 1 — Extraer HuchaLiquidCanvas como componente reutilizable

### Por qué

La animación del círculo líquido de la hucha vive inline en `projects-client.tsx`. Savings también necesita usarla. En lugar de duplicar el código, extráela a un componente compartido.

### Web

**Crear:** `apps/web/src/components/hucha/hucha-liquid-canvas.tsx`

Extraer de `projects-client.tsx` la lógica del canvas animado (`HuchaLiquidCanvas` o como esté nombrado inline) a este nuevo componente. La interfaz del componente debe ser:

```tsx
type HuchaLiquidCanvasProps = {
  /** Valor actual en minor units */
  valueMinor: bigint;
  /** Valor máximo de referencia en minor units (para calcular el nivel de relleno) */
  maxMinor: bigint;
  /** Tamaño en px del canvas cuadrado. Default: 88 */
  size?: number;
  /** Clase CSS adicional para el contenedor */
  className?: string;
};

export function HuchaLiquidCanvas({ valueMinor, maxMinor, size = 88, className }: HuchaLiquidCanvasProps)
```

El nivel de relleno se calcula internamente:
```ts
const levelTarget = maxMinor > 0n
  ? Math.min(0.92, Number(valueMinor) / Number(maxMinor))
  : 0.5
```

El componente gestiona su propio `useRef<HTMLCanvasElement>` y `requestAnimationFrame`. Cleanup en el return del `useEffect`.

**Algoritmo de dibujo** (igual que el existente en projects-client.tsx — no cambiar la lógica, solo moverla):
- Radio: `size * 0.41`
- Track: `strokeStyle rgba(255,255,255,0.07)`, `lineWidth size * 0.068`
- Relleno de abajo hacia arriba con gradiente `#4ECDC4CC → #26A69AEE`
- Onda sinusoidal en la superficie: 25 puntos, amplitud 2.5px, `waveOffset += 0.028` por frame
- Lerp del nivel: `levelCurrent += (levelTarget - levelCurrent) * 0.04`
- Anillo exterior: `rgba(78,205,196,0.35)`, lineWidth 1.8

El componente renderiza solo el `<canvas>` con `position: absolute, inset: 0`. El contenedor relativo y el texto superpuesto son responsabilidad del padre.

**Actualizar `projects-client.tsx`:** reemplazar el canvas inline por `<HuchaLiquidCanvas>` usando las mismas props que antes.

---

### Mobile

**Crear:** `apps/mobile/src/components/HuchaLiquidCanvas.tsx`

Si la animación ya existe inline en la pantalla de proyectos mobile, extraerla igual. Si no existe (la pantalla de proyectos mobile aún no tiene el círculo animado), crear el componente desde cero con la misma lógica que el web.

Props idénticas a web, adaptadas a React Native:

```tsx
type HuchaLiquidCanvasProps = {
  valueMinor: bigint;
  maxMinor: bigint;
  size?: number;
  style?: ViewStyle;
};
```

Implementación con `react-native-svg`:
- `<Svg>` con `<Defs><LinearGradient>` para el gradiente verde
- `<Circle>` de track (fondo)
- `<ClipPath><Circle>` para recortar el relleno
- `<Rect>` animada con `Animated.Value` para la altura del relleno (de abajo hacia arriba)
- La onda puede omitirse en mobile — usar el borde superior del rect como línea plana
- Anillo exterior: `<Circle>` con `stroke="rgba(78,205,196,0.35)"`
- Animación del nivel con `Animated.timing` o loop con `requestAnimationFrame` vía `useEffect`

Si `react-native-svg` no está disponible en el proyecto, usar una `View` con `overflow: hidden`, `borderRadius` circular y una `Animated.View` interior con fondo degradado para simular el relleno.

---

## Parte 2 — Cambios en savings-client.tsx y savings.tsx (mobile)

### 2a. Reemplazar el bloque de hucha por el círculo animado

**Web — `apps/web/src/app/savings/savings-client.tsx`**

Localizar el bloque que muestra el saldo de la hucha (actualmente un card/tarjeta estática con el importe). Reemplazarlo por:

```tsx
<div className="flex flex-col items-center gap-1.5">
  {/* Contenedor relativo para superponer texto sobre el canvas */}
  <div className="relative" style={{ width: 88, height: 88 }}>
    <HuchaLiquidCanvas
      valueMinor={huchaStats.accumulatedMinor}
      maxMinor={huchaStats.bestMonth?.amountMinor ?? huchaStats.accumulatedMinor}
      size={88}
    />
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <span
        className="text-[12px] font-bold tabular-nums leading-none"
        style={{ color: '#fff', textShadow: '0 1px 4px rgba(0,0,0,0.25)' }}
      >
        {formatMoneyWithSymbol(huchaStats.accumulatedMinor, baseCurrency, currencySymbol)}
      </span>
    </div>
  </div>
  <span className="text-[9px] font-semibold uppercase tracking-widest text-muted-foreground">
    Hucha {/* TODO: i18n */}
  </span>
</div>
```

Si `huchaStats` no existe en el componente de savings, derivarlo con `getReserveContainerStats` (ya importado en otros componentes) o usar directamente `huchaReserveBalance` / el campo equivalente que ya esté calculado en ese componente. No añadir queries nuevas a Supabase — usar los datos que ya llegan como props.

**Mobile — `apps/mobile/app/(auth)/(tabs)/projects/savings.tsx`**

Mismo cambio, adaptado a React Native:

```tsx
<View style={{ alignItems: 'center', gap: 6 }}>
  <View style={{ position: 'relative', width: 88, height: 88 }}>
    <HuchaLiquidCanvas
      valueMinor={huchaStats.accumulatedMinor}
      maxMinor={huchaStats.bestMonth?.amountMinor ?? huchaStats.accumulatedMinor}
      size={88}
    />
    <View style={StyleSheet.absoluteFillObject /* centrar texto */} pointerEvents="none">
      {/* Texto centrado */}
      <Text style={{ color: '#fff', fontSize: 12, fontFamily: 'DMSans-Bold',
        fontVariant: ['tabular-nums'], textShadowColor: 'rgba(0,0,0,0.25)',
        textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 }}>
        {formatMoneyWithSymbol(huchaStats.accumulatedMinor, baseCurrency, currencySymbol)}
      </Text>
    </View>
  </View>
  <Text style={{ fontSize: 9, fontFamily: 'DMSans-SemiBold',
    textTransform: 'uppercase', letterSpacing: 1.2, color: userTokens.textSecondary }}>
    Hucha {/* TODO: i18n */}
  </Text>
</View>
```

---

### 2b. Total planificado a proyectos

**Web — `apps/web/src/app/savings/savings-client.tsx`**

Al final de la lista de proyectos (justo antes del cierre del contenedor de la lista, o como última fila separada por un divisor), añadir:

```tsx
<div className="flex items-center justify-between px-1 pt-2 mt-1 border-t border-border">
  <span className="text-[11px] text-muted-foreground font-medium">
    {locale === 'en' ? 'Planned to projects' : 'Planificado a proyectos'} {/* TODO: i18n */}
  </span>
  <span className="text-[13px] font-bold tabular-nums" style={{ color: '#5B8DFF' }}>
    {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
    <span className="text-[11px] font-normal text-muted-foreground ml-0.5">/mes</span>
  </span>
</div>
```

Usar `parsedPlans.totalMinor` que ya existe en el componente — no importar `getMonthlyProjectCommitmentTotal`.

**Mobile — `apps/mobile/app/(auth)/(tabs)/projects/savings.tsx`**

Mismo cambio con `StyleSheet`:

```tsx
<View style={{
  flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
  paddingTop: 8, marginTop: 4,
  borderTopWidth: 1, borderTopColor: userTokens.border,
}}>
  <Text style={{ fontSize: 11, color: userTokens.textSecondary, fontFamily: 'DMSans-Medium' }}>
    {locale === 'en' ? 'Planned to projects' : 'Planificado a proyectos'} {/* TODO: i18n */}
  </Text>
  <Text style={{ fontSize: 13, fontFamily: 'DMSans-Bold',
    fontVariant: ['tabular-nums'], color: '#5B8DFF' }}>
    {formatMoneyWithSymbol(parsedPlans.totalMinor, baseCurrency, currencySymbol)}
    <Text style={{ fontSize: 11, fontFamily: 'DMSans-Regular',
      color: userTokens.textSecondary }}> /mes</Text>
  </Text>
</View>
```

---

## Notas de implementación

- **No modificar** queries a Supabase ni lógica de `@poleursus/shared`
- **No añadir** dependencias npm nuevas salvo que sean necesarias para el canvas mobile
- El `useEffect` del canvas debe devolver cleanup: `return () => cancelAnimationFrame(rafId)`
- En Next.js, el canvas no puede renderizarse en SSR — añadir guard `if (typeof window === 'undefined') return` dentro del `useEffect`
- `Number(bigint)` es seguro para los valores monetarios de Finnon — no hay riesgo de pérdida de precisión en los rangos habituales
- Los strings nuevos sin clave i18n llevan comentario `// TODO: i18n`
- **Mobile:** no usar clases Tailwind — `StyleSheet.create` para todos los estilos
