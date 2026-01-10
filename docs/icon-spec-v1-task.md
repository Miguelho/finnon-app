# Prompt — Finnon: Icon Spec para menú “Añadir” (Web + Mobile) + Tokens shadcn/ui (Tailwind v4 CSS-first)

## Rol
Actúa como un **senior front-end / design engineer** con obsesión por consistencia visual cross-platform (Next.js + Tailwind v4, y React Native + Expo). Esta feature (“Añadir”) es **piedra angular**: debe sentirse **frictionless**, premium y coherente con el sistema de tokens shadcn/ui.

---

## Contexto actual
Tenemos un menú modal “Añadir” con 5 opciones:
1) Añadir gasto
2) Añadir ingreso
3) Añadir categoría
4) Añadir obligación (pago único)
5) Añadir recurrente

Queremos añadir **iconos monoline** consistentes en web y móvil y definir un **spec cerrado** (tamaños, estados, layout, tokens) para que el resultado sea idéntico en UX.

Stack:
- Web: Next.js + Tailwind v4 (CSS-first config) + shadcn/ui tokens
- Mobile: React Native + Expo
- Shared: `@poleursus/shared` (copy y lógica/tipos compartidos)

---

## Objetivos
1) **Consistencia total**: mismos iconos, mismas decisiones de diseño (tamaños, stroke, spacing).
2) **Frictionless**: legible al primer vistazo; área clicable generosa; sin ruido visual.
3) **“Molón” sin circo**: premium por aire, consistencia y micro-interacciones.
4) **Fuente de verdad** en `@poleursus/shared`: títulos, descripciones e icon mapping.

---

## Iconografía (canon)
Usar **Lucide** (outline/monoline). No mezclar packs.

### Mapping canónico (NO inventar otros iconos)
- Añadir gasto → `ArrowDownCircle`
- Añadir ingreso → `ArrowUpCircle`
- Añadir categoría → `Tag`
- Añadir obligación (pago único) → `CalendarClock` (fallback `CalendarCheck`)
- Añadir recurrente → `Repeat` (fallback `RefreshCw`)

### Reglas visuales
- Tamaño icono: `20` (h-5 w-5)
- `strokeWidth`: `2`
- Color por defecto: neutral (muted-foreground)
- En hover/pressed: sube a foreground (sin rojos/verdes permanentes)

---

## Layout del item (web y móvil)
Cada opción es un row-card:
[Badge 32x32 con icono]  [Título + descripción]  [sin chevron por defecto]

- Alto mínimo táctil: **56–64px**
- Padding card: **px-4 py-3** (~16px horizontal, ~12px vertical)
- Gap badge-text: **12px** (`gap-3`)
- Radio card: **12px** (`rounded-xl`)
- Borde: 1px suave
- Badge: **32x32**, radio 12px (`h-8 w-8 rounded-xl`)
- Tipos:
  - Title: 15px semibold
  - Description: 13px regular, muted-foreground

---

## Estados / Interacción
### Web (hover/focus/active)
- Default:
  - Card: `bg-background border-border`
  - Badge: `bg-muted`
  - Icon: `text-muted-foreground`
- Hover:
  - Card: `hover:bg-accent`
  - Badge: cambiar a `bg-background` para que se note (porque `muted` y `accent` pueden ser iguales en light)
  - Icon: `group-hover:text-foreground`
- Focus (teclado):
  - ring: `focus-visible:ring-2 focus-visible:ring-ring`
  - offset: `focus-visible:ring-offset-2 focus-visible:ring-offset-background`
- Active:
  - mantener background similar a hover (`active:bg-accent`) y ligera sensación de press sin bounce.

### Mobile (pressed)
- Default:
  - Card: bg surface (background) + border
  - Badge: muted
  - Icon: muted-foreground
- Pressed:
  - Card: ligera bajada de opacidad (ej 0.96) o cambio mínimo de fondo
  - Badge: accent (o bg.secondary equivalente)
  - Icon: foreground

---

## Sistema de tokens (shadcn/ui + Tailwind v4 CSS-first)
### globals.css existente
Ya existen variables en `:root` y `.dark` con formato HSL sin wrapper, y consumo con `hsl(var(--token))`.

### Tarea OBLIGATORIA: añadir @theme para clases semánticas
En `globals.css` (web), justo tras `@import "tailwindcss";`, crear/asegurar este bloque `@theme` para mapear tokens:

```css
@theme {
  --color-background: hsl(var(--background));
  --color-foreground: hsl(var(--foreground));

  --color-card: hsl(var(--card));
  --color-card-foreground: hsl(var(--card-foreground));

  --color-popover: hsl(var(--popover));
  --color-popover-foreground: hsl(var(--popover-foreground));

  --color-primary: hsl(var(--primary));
  --color-primary-foreground: hsl(var(--primary-foreground));

  --color-secondary: hsl(var(--secondary));
  --color-secondary-foreground: hsl(var(--secondary-foreground));

  --color-muted: hsl(var(--muted));
  --color-muted-foreground: hsl(var(--muted-foreground));

  --color-accent: hsl(var(--accent));
  --color-accent-foreground: hsl(var(--accent-foreground));

  --color-destructive: hsl(var(--destructive));
  --color-destructive-foreground: hsl(var(--destructive-foreground));

  --color-border: hsl(var(--border));
  --color-input: hsl(var(--input));
  --color-ring: hsl(var(--ring));

  --radius: var(--radius);
}
Resultado esperado: poder usar bg-background, text-muted-foreground, border-border, ring-ring, etc. en clases Tailwind.

Shared “source of truth” (NO UI components aquí)
Crear en @poleursus/shared un archivo:
/shared/src/ui/addMenu.ts

Debe exportar:

AddActionKey (union)

AddActionMeta (tipo)

ADD_ACTIONS (array ordenado)

getAddAction(key) helper

Ejemplo (respetar copy actual):

expense: “Añadir gasto” / “Registra un pago del día a día.”

income: “Añadir ingreso” / “Suma un ingreso a tu mes.”

category: “Añadir categoría” / “Crea o actualiza categorías compartidas.”

one_off_obligation: “Añadir obligación (pago único)” / “Un pago único con fecha de vencimiento.”

recurring: “Añadir recurrente” / “Una serie que crea ocurrencias; confirma cada una para registrar.”

Web implementation (Next.js)
Dependencia
Instalar:

lucide-react

Componente
Crear un componente AddMenuItem.tsx que reciba { meta, onClick } y renderice:

botón group

badge 32x32

icon lucide por nombre (meta.icon) con fallback HelpCircle

title/description

clases EXACTAS según tokens semánticos

Clases mínimas esperadas:

Card: group flex items-center gap-3 rounded-xl border border-border bg-background px-4 py-3 transition-colors duration-150 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background active:bg-accent

Badge: h-8 w-8 rounded-xl bg-muted flex items-center justify-center transition-colors duration-150 group-hover:bg-background

Icon: h-5 w-5 text-muted-foreground transition-colors duration-150 group-hover:text-foreground + strokeWidth={2}

Nota clave
Lucide usa currentColor; controlar color con clases text-*, no pasar color="".

Mobile implementation (Expo / React Native)
Dependencias
Instalar:

lucide-react-native
(Se apoya en react-native-svg, ya existente)

Componente
Crear AddMenuItem.native.tsx con Pressable:

usa meta.icon para resolver componente lucide

badge 32x32

pressed state cambia badge bg + icon color

title 15 semibold, description 13 muted

Los colores deben salir del sistema de tema/tokens de RN (si existe). Si no existe aún, crear un mapping mínimo equivalente a:

background, foreground, muted, mutedForeground, accent, border

Definition of Done
Misma lista y mapping de iconos en web y móvil desde @poleursus/shared.

strokeWidth=2 y size 20 fijo.

Badge 32x32 con transición/pressed visible.

Web: hover/focus ring correcto con tokens (ring-ring, ring-offset-background).

Mobile: pressed state perceptible pero sutil (sin bounce).

No hay colores hardcodeados fuera del sistema de tokens (web via @theme; móvil via theme object).

La UI final no cambia estructura del modal: solo mejora iconografía y consistencia visual (guardarraíl: mínimos cambios necesarios).

Entregables
PR con:

globals.css actualizado con @theme (si no existía)

@poleursus/shared/src/ui/addMenu.ts

Web: AddMenuItem.tsx + integración en el modal “Añadir”

Mobile: AddMenuItem.native.tsx + integración en el modal “Añadir”