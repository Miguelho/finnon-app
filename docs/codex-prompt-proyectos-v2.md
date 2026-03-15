# Codex Prompt — Pantalla Proyectos: rediseño visual + flujo hucha↔proyecto

## Contexto

Estás trabajando en **Finnon**, app de finanzas para parejas. Stack: Next.js (web) + React Native/Expo (mobile), monorepo, `@poleursus/shared`, Supabase.

Este prompt es **incremental**: no toques queries a Supabase ni lógica de `@poleursus/shared`. Solo modifica la capa visual e interacción.

Existe un mockup de referencia en `finnon-proyectos-v5.html` que puedes consultar para ver el comportamiento exacto. Las secciones críticas son el bloque hucha, las cards de proyectos y las animaciones.

---

## Archivos a modificar

### Web
- `apps/web/src/app/projects/projects-client.tsx`

### Mobile
- `apps/mobile/app/(auth)/(tabs)/projects/index.tsx`

---

## 1. Layout general

La pantalla tiene tres bloques verticales en este orden:

1. **Bloque Hucha** — clickable, navega a `/reserves/[huchaId]`
2. **Scroll horizontal de cards de proyecto** — con card de "Nuevo proyecto" al final
3. **Card de Compromiso mensual total** — link a `/savings`

No hay hero azul ni columnas. Todo es fondo del tema (`bg-background` / `bg-card`).

---

## 2. Bloque Hucha

### Estructura
```
[Círculo animado]   [Descripción + stats]   [ChevronRight]
[  "Hucha"      ]
```

- El círculo (88px) y la etiqueta "Hucha" debajo forman una columna izquierda (`flex-col items-center gap-1.5`)
- La etiqueta "Hucha" va **debajo** del círculo, no dentro. Estilo: `text-[9px] uppercase tracking-widest text-muted-foreground`
- El bloque entero es un `<Link href="/reserves/[huchaId]">` con `ChevronRight` a la derecha
- Cuando hay un proyecto seleccionado, el borde del bloque cambia a `border-[rgba(78,205,196,0.3)]` — clase condicional

### Animación del círculo (Canvas 2D — ver sección 5)

---

## 3. Cards de proyectos (scroll horizontal)

```
display: flex
overflow-x: auto
scroll-snap-type: x mandatory
gap: 12px
```

Cada card (`min-w-[190px] max-w-[210px]`, `scroll-snap-align: start`) contiene en orden:

```
[zona del anillo + flechas]
[nombre]
[funded / goal]
[% en color del proyecto]
[fecha estimada — dos líneas]
[panel de transferencia — oculto por defecto]
```

La última card es el botón "Nuevo proyecto" (borde discontinuo, misma altura mínima).

### Al seleccionar una card

1. **Fade out** (`opacity: 0`, `transition: opacity 180ms`)
2. Mover la card al **primer lugar** del scroll con `insertBefore` / reordenación de estado
3. `scrollTo({ left: 0, behavior: 'smooth' })`
4. **Fade in** (`opacity: 1`)
5. Tras 180ms más: añadir clase `selected`, mostrar panel de transferencia, mostrar flechas

Al seleccionar otra card, desseleccionar la anterior primero (mismo proceso).

**Web (Next.js):** mantener el orden de proyectos en estado local `useState<Project[]>`. Al seleccionar, mover el proyecto al índice 0 del array y hacer scroll al inicio del contenedor.

**Mobile:** mismo comportamiento con `FlatList` horizontal y `scrollToOffset({ offset: 0 })`.

---

## 4. Zona del anillo + flechas

Cuando la card **no está seleccionada**: solo el anillo de progreso con emoji en el centro, centrado horizontalmente.

Cuando la card **está seleccionada**: aparecen dos botones de flecha a ambos lados del anillo, en el mismo plano horizontal:

```
[↑ btn]  [anillo + emoji]  [↓ btn]
```

- Botón izquierdo `↑` — "Devolver a hucha" (`ret`)
- Botón derecho `↓` — "Añadir desde hucha" (`add`)
- Ambos: `border rounded-full w-[30px] h-[30px]`, color `text-muted-foreground` por defecto
- Al activar modo `add`: `bg-[rgba(78,205,196,0.12)] border-[rgba(78,205,196,0.45)] text-[#4ECDC4]`
- Al activar modo `ret`: `bg-[rgba(116,198,157,0.12)] border-[rgba(116,198,157,0.45)] text-[#74C69D]`
- Tocar la misma flecha activa de nuevo: desactiva el modo y cierra el input

---

## 5. Panel de transferencia (dentro de la card)

Aparece pegado al fondo de la card con `border-top`, fondo ligeramente más oscuro. Contiene:

1. **Hint** — texto pequeño que cambia según el modo:
   - `add`: "Disponible en hucha: €X" (X = `huchaStats.accumulatedMinor`)
   - `ret`: "Financiado en proyecto: €X" (X = `heroProgress.fundedReservedMinor`)
2. **Input numérico** con prefijo `€` — sin borde completo, solo línea inferior, o estilo minimalista
3. **Botón confirmar** — círculo con checkmark, desactivado (`opacity: 0.35`) hasta que haya importe válido
4. **"Cancelar"** — texto pequeño debajo

### Validación del importe
- Modo `add`: máximo = `huchaStats.accumulatedMinor`
- Modo `ret`: máximo = `heroProgress.fundedReservedMinor`
- No puede ser ≤ 0

### Al confirmar
- Modo `add`: llamar a `transfer_reserve_to_project(reserveId, projectId, amount)` — RPC de Supabase ya existente
- Modo `ret`: llamar a la nueva RPC `transfer_project_to_reserve(projectId, reserveId, amount)` — modelo de datos ya implementado
- Tras confirmar: cerrar panel, deseleccionar card, invalidar cache con `emitMutation('projects', 'update')`

---

## 6. Animación del círculo de la hucha (Canvas 2D)

Implementar con `useRef` para el canvas y `requestAnimationFrame` para el loop.

### Parámetros
- Tamaño en pantalla de proyectos: **88×88px** (canvas físico: `88 * devicePixelRatio`)
- Tamaño en pantalla de hucha: **160×160px**
- Radio del círculo: `size * 0.41`
- Grosor del track: `size * 0.068`

### Dibujo por frame
```
1. clearRect
2. Track circle: arc completo, strokeStyle rgba(255,255,255,0.07)
3. Clip al interior del círculo (arc r-1, ctx.clip())
4. Calcular fillTop = cy + r - ratio * r * 2  →  relleno desde abajo
5. Gradiente vertical: #4ECDC4CC (arriba) → #26A69AEE (abajo)
6. fillRect desde fillTop hasta cy+r
7. Onda en la superficie del relleno (solo si 0.03 < ratio < 0.97):
   - 25 puntos distribuidos horizontalmente
   - y = fillTop + sin((i/24) * π*4 + waveOffset) * 2.5
   - strokeStyle rgba(78,205,196,0.5), lineWidth 1.8
8. Restore clip
9. Anillo exterior: arc, strokeStyle rgba(78,205,196,0.35), lineWidth 1.8
```

### Loop
```js
waveOffset += 0.028  // cada frame
levelCurrent += (levelTarget - levelCurrent) * 0.04  // lerp suave
```

- `levelTarget` = `huchaStats.accumulatedMinor / maxReferenceMinor * 0.72`
  - `maxReferenceMinor`: usar el máximo histórico de la hucha como referencia, o un valor fijo de referencia si no está disponible. El `* 0.72` es para que nunca esté al 100% a menos que esté realmente llena.
- Cuando el usuario escribe en el input de transferencia, actualizar `levelTarget` en tiempo real como preview:
  - Modo `add`: `levelTarget = (accumulated - inputAmount) / max * 0.72`
  - Modo `ret`: `levelTarget = (accumulated + inputAmount) / max * 0.72`
- Al cancelar o confirmar, restaurar `levelTarget` al valor real

**React Native:** usar `react-native-canvas` o `expo-2d-context`. Si no están disponibles, implementar con `react-native-svg`: un `<Circle>` de fondo + un `<Path>` de relleno semicircular animado con `Animated.Value` para la altura. La onda puede omitirse en mobile si la librería no lo soporta fácilmente.

---

## 7. Animación de flujo hucha → proyecto (partículas)

Cuando hay un proyecto seleccionado y un modo activo, mostrar partículas animadas entre el bloque hucha y la card seleccionada.

### En web (posición absoluta / fixed)

El bloque hucha tiene `position: relative`. En su borde inferior izquierdo (alineado con el centro del círculo, `left: 44px`) hay dos elementos:

```
.flow-line   — línea vertical de 2px, altura 0 → 28px con transition 0.45s
.flow-pts    — contenedor de 3 puntos, aparece con opacity 0 → 1
```

Cada punto (`.dot`):
- `width: 4px, height: 4px, border-radius: 50%, background: #4ECDC4`
- Animación CSS `floatDot 1.5s ease-in-out infinite`:
  ```css
  @keyframes floatDot {
    0%   { transform: translateY(0);   opacity: 0; }
    15%  { opacity: 1; }
    85%  { opacity: 1; }
    100% { transform: translateY(24px); opacity: 0; }
  }
  ```
- Delays: `0s`, `0.5s`, `1s`

**Dirección:**
- Modo `add` (hucha → proyecto): animación normal (puntos bajan)
- Modo `ret` (proyecto → hucha): `animationDirection: reverse` en los puntos (puntos suben)

Cuando no hay modo activo pero sí proyecto seleccionado: mostrar la línea pero sin partículas (`flow-pts` oculto).

**React Native:** usar `Animated.Value` con `Animated.loop` + `Animated.sequence` para los puntos. Tres `Animated.View` con `translateY` de 0 a 24 y opacidad. Dirección invertida: interpolar de 24 a 0.

---

## 8. Notas de implementación

- **No modificar** queries a Supabase, `computeProjectProgress`, `getProjectColor`, `buildProjectColorMap`, `getReserveContainerStats`
- **No añadir** dependencias npm nuevas salvo que sean necesarias para canvas en mobile
- El canvas del círculo debe iniciarse en `useEffect` con cleanup del `requestAnimationFrame`
- En Next.js, el canvas no puede renderizarse en SSR — usar `'use client'` y guard `typeof window !== 'undefined'`
- Todos los importes en minor units (BigInt). Convertir a número para la animación: `Number(minor) / 100`
- Los strings nuevos sin clave i18n llevan comentario `// TODO: i18n`
- **Mobile**: no usar clases Tailwind — usar `StyleSheet.create`
