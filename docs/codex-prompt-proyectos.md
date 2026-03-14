# Codex Prompt — Proyectos screen: visual refresh incremental

## Contexto
Estás trabajando en **Finnon**, una app de finanzas personales para parejas. Stack: Next.js (web) + React Native/Expo (mobile), monorepo, `@poleursus/shared` para tipos y lógica compartida, Supabase como backend. Todas las cifras se almacenan en **minor units** (BigInt).

Este prompt es **incremental**: no reescribas lógica existente ni queries a Supabase. Solo modifica la capa visual y de interacción según lo descrito.

Los tipos relevantes ya existen en `packages/shared/src/projects/types.ts`:
- `ProjectProgress.isCompleted: boolean`
- `ProjectProgress.monthsLeft: number | null`
- `ProjectProgress.estimatedCompletionDate: Date | null`
- `ProjectProgress.spentMinor: bigint`

---

## Archivos a modificar

### Web
- `apps/web/src/app/projects/projects-client.tsx`
- `apps/web/src/app/projects/[projectId]/project-detail-client.tsx`

### Mobile (mismos cambios, adaptados a React Native)
- `apps/mobile/app/(auth)/(tabs)/projects/index.tsx`
- `apps/mobile/app/(auth)/(tabs)/projects/[projectId].tsx`

---

## Paleta de colores de proyectos

Localiza la constante `PROJECT_PALETTE` en `@poleursus/shared` y reemplaza su contenido por:

```ts
export const PROJECT_PALETTE = [
  '#6DB8D4',
  '#74C69D',
  '#89B4D4',
  '#80C9B4',
  '#A8D8B0',
  '#7EC8E3',
];
```

No cambies la firma ni el nombre de la constante. No modifiques `HUCHA_PROJECT_COLOR`.

---

## 1. `projects-client.tsx` — Lista de proyectos

### 1a. Hucha: mismo peso visual que los proyectos

El bloque de la hucha (`huchaReserve`) actualmente ocupa un card hero de ancho completo en la parte superior de la pantalla. **Cámbialo** para que aparezca como primer elemento dentro del grid de proyectos activos, con el mismo tamaño y jerarquía visual que una fila de proyecto:

- Mismo contenedor `rounded-xl border p-4`
- Usa `HUCHA_PROJECT_COLOR` como color de acento
- Muestra: emoji (`huchaReserve.emoji || '🐷'`), nombre (`tGlobal("home.savings.hucha")`), saldo acumulado (`huchaStats.accumulatedMinor`) y la aportación del mes (`huchaStats.currentMonthContributionMinor`)
- **Sin** anillo de progreso (no es un proyecto con objetivo)
- Sigue siendo un `<Link href={`/reserves/${huchaReserve.id}`}>` con `ChevronRight`
- Elimina el bloque anterior de la hucha que estaba fuera del grid

### 1b. Copy de fecha estimada en cada fila de proyecto

En cada fila de proyecto, la fecha estimada actualmente muestra un texto inline en una línea. **Reemplázalo** por dos líneas:

```tsx
<p className="text-xs text-muted-foreground">
  Con este ritmo llegas en {formatDuration(progress.monthsLeft, tProjects)}
</p>
<p className="text-xs text-muted-foreground opacity-70">
  {formatEstimatedDate(progress.estimatedCompletionDate, locale)}
</p>
```

- Usa `progress.monthsLeft` y `progress.estimatedCompletionDate` ya calculados en el `.map()`
- Usa los helpers `formatDuration` y `formatEstimatedDate` ya existentes en el archivo
- Si `progress.monthsLeft === null` o `!progress.estimatedCompletionDate`, mantén el comportamiento actual: `<p className="text-xs text-amber-600">{tProjects("noPlan")}</p>`

---

## 2. `project-detail-client.tsx` — Detalle de proyecto

### 2a. Color picker: oculto por defecto, toggle al hacer click en el emoji

Actualmente el color picker está siempre visible en el card. **Cámbialo**:

1. Añade estado local: `const [isColorPickerOpen, setIsColorPickerOpen] = useState(false)`
2. El `<span className="text-4xl">` que muestra `project.emoji` pasa a ser:
```tsx
<span
  className="text-4xl cursor-pointer select-none"
  onClick={() => canEdit && setIsColorPickerOpen(prev => !prev)}
  title={canEdit ? "Cambiar color" : undefined}
>
  {project.emoji || '\u{1F3AF}'}
</span>
```
3. Envuelve el bloque del color picker (`PROJECT_PALETTE.map(...)`) en `{isColorPickerOpen && canEdit ? (...) : null}`
4. Cuando `handleSetColor` completa con éxito, añade: `setIsColorPickerOpen(false)`

### 2b. Copy de fecha estimada: dos líneas

En los **dos** lugares donde aparece la fecha estimada (bloque de stats del hero y bloque del simulador), reemplaza el texto actual por este patrón:

```tsx
// Cuando hay plan
<>
  <p className="text-sm font-semibold">
    Con este ritmo llegas en {formatDuration(progress.monthsLeft, tProjects)}
    {/* TODO: i18n */}
  </p>
  <p className="text-xs text-muted-foreground">
    {new Intl.DateTimeFormat(locale === 'en' ? 'en-US' : 'es-ES', {
      month: 'long', year: 'numeric'
    }).format(progress.estimatedCompletionDate)}
  </p>
</>

// Cuando no hay plan (guard existente, no cambiar)
<p className="...">
  {tProjects("noPlan")}
</p>
```

Aplica `heroProgress` en el bloque de stats y `simulatorProgress` en el bloque del simulador.

### 2c. Fecha de creación: copy actualizado

`createdAtLabel` ya existe y se calcula en el componente. Cambia únicamente el texto del párrafo:

```tsx
// Antes
{tProjects("createdAt", { date: createdAtLabel })}

// Después
{`Copyright en este proyecto desde ${createdAtLabel}`} {/* TODO: i18n */}
```

### 2d. Total de gastos asociados

Al final de la lista de `projectExpenses` (dentro del bloque `isSpendingOpen && projectExpenses.length > 0`), añade una fila de total. Usa `heroProgress.spentMinor` directamente (ya calculado, no recalcules):

```tsx
<div className="flex items-center justify-between rounded-md bg-muted/50 px-3 py-2 text-sm">
  <span className="text-muted-foreground">
    {locale === 'en' ? 'Total associated spending' : 'Total gastos asociados'} {/* TODO: i18n */}
  </span>
  <span className="font-semibold">
    {formatMoneyWithSymbol(heroProgress.spentMinor, baseCurrency, currencySymbol)}
  </span>
</div>
```

### 2e. Animación de completado

Cuando `heroProgress.isCompleted === true`:

1. Añade clases condicionales al `<Card>` principal:
```tsx
className={`transition-colors duration-700 ${heroProgress.isCompleted ? 'bg-emerald-50 dark:bg-emerald-950/20' : ''}`}
```

2. Justo después del `<h1>` con el nombre del proyecto, inserta:
```tsx
{heroProgress.isCompleted && (
  <span className="inline-flex items-center rounded-full bg-emerald-100 px-3 py-1 text-sm font-semibold text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300">
    🎉 ¡Proyecto completado! {/* TODO: i18n */}
  </span>
)}
```

---

## Notas de implementación

- **No modifiques** queries a Supabase, `computeProjectProgress`, `getProjectColor`, `buildProjectColorMap` ni ninguna función de `@poleursus/shared`
- **No añadas** dependencias npm nuevas
- **Mobile**: aplica los mismos cambios visuales con `StyleSheet` y componentes de React Native. El toggle del color picker usa estado local igual. No uses clases Tailwind en mobile
- Todos los valores monetarios se formatean con `formatMoneyWithSymbol(minor, baseCurrency, currencySymbol)` — nunca dividas por 100 manualmente
- Los strings nuevos llevan comentario `// TODO: i18n` para localizarlos fácilmente después
