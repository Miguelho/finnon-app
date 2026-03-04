# Spec: Refactor "Quién pagó + Reparto" en Step1Details

## Contexto

`Step1Details` es el componente del paso 2 del formulario de añadir movimiento, renderizado por `AddTransactionForm` tanto en mobile (`AddTransactionForm.tsx` RN/Expo) como en web (`AddTransactionForm.tsx` Next.js). Ambas plataformas reciben los mismos props y comparten la lógica de estado a través de `@poleursus/shared`.

Este spec cubre únicamente los cambios dentro de `Step1Details` y sus subcomponentes. No tocar `AddTransactionForm`, `TransactionDraft`, ni la lógica de submit.

---

## Cambios requeridos

### 1. Unificar "Quién pagó" y "Reparto" en una sola sección visual

Actualmente son dos secciones separadas. Deben combinarse en un único bloque/card con un divider interno entre ambas subsecciones. El orden es:

1. Subsección "Quién pagó" (arriba)
2. Divider
3. Subsección "Reparto" (abajo)

---

### 2. Nuevo selector de pagador — `PaidBySelector`

Crear un componente nuevo `PaidBySelector` que reemplace el selector actual.

#### Tipos

```ts
type PayerSelection = 
  | { type: 'single'; userId: string }
  | { type: 'both' }
```

#### Props

```ts
interface PaidBySelectorProps {
  participants: FormParticipant[]   // exactamente 2 (admin/contributor)
  currentUserId: string | null      // usuario activo de la sesión
  value: string | null              // draft.paidByUserId actual
  onChange: (value: string | null, bothSelected: boolean) => void
}
```

#### Comportamiento

El componente muestra un track con dos opciones (una por participante) más un botón secundario "Los dos pagaron".

**Track principal — dos opciones lado a lado:**
- Cada opción muestra: avatar con iniciales + nombre del participante
- Una sola opción activa al mismo tiempo (salvo estado "ambos")
- Al activar una opción, la otra queda inactiva
- Color de fondo y borde del estado activo: color del avatar del participante seleccionado
  - El color de avatar de cada participante viene de `themeTokens` / sistema de colores existente en `@poleursus/shared`. Usar el mismo mecanismo que ya se usa para avatares en el resto de la app.

**Botón "Los dos pagaron":**
- Aparece debajo del track, alineado a la izquierda
- Muestra los dos avatares superpuestos (overlap) + texto "Los dos pagaron"
- Al activarse: ambas opciones del track se iluminan simultáneamente con su color respectivo; el botón queda marcado como activo
- Al activarse este estado, llama a `onChange(null, true)`
- Al seleccionar una opción individual desde estado "ambos", desactiva "Los dos pagaron" y llama a `onChange(userId, false)`

**Valor inicial:** por defecto seleccionar al `currentUserId`. Si no está en participants, seleccionar `participants[0]`.

#### Animaciones (ambas plataformas)

- Transición de color del fondo y borde al cambiar opción activa: `200ms ease`
- En mobile: usar `Animated.timing` o `useAnimatedStyle` (Reanimated si ya está en el proyecto)
- En web: CSS transition en el elemento

---

### 3. Nuevo selector de reparto — `SplitSelector`

Crear un componente nuevo `SplitSelector`.

#### Props

```ts
interface SplitSelectorProps {
  value: ContributionSplitType           // draft.splitType
  paidByBoth: boolean                    // si "Los dos pagaron" está activo
  participants: FormParticipant[]        // para el panel de Personalizado
  splitDetails: SplitDetail[] | null     // draft.splitDetails
  totalAmountMinor: number               // para calcular shares en Personalizado
  onChange: (
    splitType: ContributionSplitType,
    splitDetails?: SplitDetail[] | null
  ) => void
}
```

#### Tres opciones

Renderizar como un grid de 3 botones. Cada botón tiene: icono animado + etiqueta.

**Opción A — Partes iguales**
- Icono: dos barras horizontales de igual longitud (símbolo `=`)
- Animación al activar: las dos barras aparecen con slide desde el centro (`scaleX` de 0.3 → 1), con un offset de `60ms` entre la primera y la segunda
- Etiqueta: "Partes iguales"
- **Deshabilitada** cuando `paidByBoth === false` (un solo pagador no puede repartir en partes iguales)

**Opción B — Solo mío / Solo suyo**
- Icono: el carácter "1" con tipografía bold
- Animación al activar: scale `0.5 → 1` con spring/bounce (`200ms`)
- Etiqueta dinámica:
  - Si `paidByUserId === currentUserId` → "Solo mío"
  - Si `paidByUserId !== currentUserId` → "Solo de [nombre]" (usar `firstName` del participante pagador)
  - Si `paidByBoth === true` → ocultar / deshabilitar esta opción
- **Deshabilitada** cuando `paidByBoth === true`

**Opción C — Personalizado**
- Icono: tres barras verticales de alturas distintas (gráfico de barras desigual)
- Animación al activar: cada barra crece desde `0` hasta su altura final con spring, escalonadas `60ms` entre cada una
- Etiqueta: "Personalizado"
- Siempre disponible

#### Lógica de restricciones (tabla completa)

| Estado pagador | Partes iguales | Solo mío/suyo | Personalizado |
|---|---|---|---|
| Un solo pagador | ❌ deshabilitada | ✅ disponible | ✅ disponible |
| Ambos pagaron | ✅ disponible | ❌ deshabilitada | ✅ disponible |

Cuando se deshabilita la opción actualmente seleccionada, cambiar automáticamente a la opción disponible por defecto:
- Si se deshabilita "Solo mío/suyo" → activar "Partes iguales"
- Si se deshabilita "Partes iguales" → activar "Solo mío/suyo"

Mostrar un hint de texto debajo del grid explicando por qué está deshabilitada la opción correspondiente. El hint cambia según el estado:
- Un pagador: `"Partes iguales" requiere que ambos hayan pagado`
- Ambos pagaron: `"Solo mío/suyo" no aplica cuando ambos pagaron`

#### Panel expandible de Personalizado

Al seleccionar "Personalizado", expandir un panel debajo del grid (animación de altura: `max-height 0 → auto`, `300ms ease`).

El panel contiene un slider por participante:

```
[Avatar] [Nombre]   ─────●──────   70%
[Avatar] [Nombre]   ──●────────    30%
                              Total: 100% ✓
```

**Comportamiento de los sliders:**
- Mover un slider ajusta el otro automáticamente para mantener la suma en 100%
- Ambos sliders son independientes en UI pero vinculados en lógica (`sliderA = 100 - sliderB`)
- El indicador "Total" se muestra en verde si suma 100%, en rojo si no
- El color del thumb de cada slider corresponde al color del avatar del participante
- Al cambiar los valores, llamar a `onChange('custom', newSplitDetails)` donde `newSplitDetails` son los shares calculados a partir de los porcentajes × `totalAmountMinor`

**Cálculo de shareMinor:**
```ts
const shareMinor = Math.round((pct / 100) * totalAmountMinor)
// Ajustar el último participante para absorber el redondeo:
// shareB = totalAmountMinor - shareA
```

**Valor inicial del panel:** si ya existe `splitDetails` en el draft, cargar esos porcentajes. Si no, inicializar a 50/50.

---

### 4. Recuperar selector de divisa en el campo Cantidad

El campo de cantidad (`amount`) ha perdido el selector de divisa. Recuperarlo.

El selector debe aparecer junto al campo de importe, **sin** el badge/logo de Finnon (eliminar si existe). Implementación:

- Botón compacto que muestra el código de divisa actual (ej. `EUR`) + chevron
- Al pulsar, muestra un dropdown/sheet con las divisas disponibles
- Las divisas disponibles provienen de `CURRENCY_MINOR_UNITS` (ya disponible en `@poleursus/shared`)
- Al seleccionar, llama a `onFieldChange('currency', selectedCurrency)`
- El valor actual viene de `draft.currency`

---

## Archivos a modificar

```
# Mobile
apps/mobile/components/transactions/steps/Step1Details.tsx
apps/mobile/components/transactions/steps/PaidBySelector.tsx        ← nuevo
apps/mobile/components/transactions/steps/SplitSelector.tsx         ← nuevo

# Web
apps/web/components/transactions/steps/Step1Details.tsx
apps/web/components/transactions/steps/PaidBySelector.tsx           ← nuevo
apps/web/components/transactions/steps/SplitSelector.tsx            ← nuevo
```

No modificar:
- `AddTransactionForm.tsx` (mobile ni web)
- `@poleursus/shared` — no añadir ni cambiar tipos en el shared package
- `TransactionDraft` — el modelo de datos no cambia

---

## Contrato con AddTransactionForm (no cambia)

`Step1Details` ya recibe estos props que deben seguir funcionando igual:

```ts
splitParticipants: FormParticipant[]   // participantes activos (admin/contributor)
currentUserId: string | null
showSplitControls: boolean             // si false, no renderizar la sección de reparto
draft: TransactionDraft
errors: Record<string, string>
onFieldChange: <K extends keyof TransactionDraft>(field: K, value: TransactionDraft[K]) => void
```

Internamente, `Step1Details` debe:
- Mantener estado local `paidByBoth: boolean` (no existe en `TransactionDraft`)
- Cuando `paidByBoth` cambia a `true`: llamar a `onFieldChange('paidByUserId', null)` — el submit handler en `AddTransactionForm` ya gestiona este caso
- Cuando cambia a un usuario específico: llamar a `onFieldChange('paidByUserId', userId)`
- Delegar los cambios de `splitType` y `splitDetails` a través de `onFieldChange` como ya hace actualmente

---

## Referencia visual

Ver wireframe interactivo adjunto (`finnon-add-movimiento.html`) para comportamiento esperado de todos los estados, animaciones y restricciones.
