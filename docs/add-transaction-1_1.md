# Prompt para Agente de Código — Opción 4: Sugerencia contextual “Obligación” (sin ocupar espacio premium)

## Contexto
Aplicación de personal finance management (Finnon). En el formulario **Añadir movimiento**, existe el concepto **Obligación** (pago pendiente o programado). Queremos evitar que este ajuste “premium” aparezca siempre ocupando una card completa.

## Objetivo
Mostrar **Obligación** de forma **contextual** solo cuando tiene sentido:
- Si el usuario selecciona una **fecha futura**, sugerir convertir el movimiento en **Obligación**.
- Mantener el formulario limpio cuando no aplica.

## Alcance
- Web (Next.js + shadcn/ui) y Mobile (Expo React Native) si aplica el mismo formulario.
- Solo UX/UI + estado + persistencia mínima.
- No rediseñar todo el formulario.

---

## UX: Comportamiento principal (Opción 4)

### Trigger
Cuando el usuario establezca `movementDate` en una fecha **> hoy** (en zona horaria local del usuario) Y `isObligation === false`:
- Mostrar una **sugerencia no intrusiva** (banner/inline callout) justo debajo del bloque de **Fecha**.

### Componente de sugerencia
**Texto (copy exacto):**
> `Esta fecha es futura. ¿Quieres guardarlo como obligación?`

**Acciones:**
- Primaria (botón): `Marcar como obligación`
- Secundaria (link/button ghost): `Ahora no`

### Al pulsar “Marcar como obligación”
- Set `isObligation = true`
- Set `obligationType = "PROGRAMADA"`
- Set `scheduledDate = movementDate` (mismo valor)
- Ocultar la sugerencia inmediatamente
- (Opcional) Mostrar un chip/resumen cerca de Fecha: `Obligación: Programada · {fecha}` con acción `Editar` (si ya existe edición; si no, omitir)

### Al pulsar “Ahora no”
- Ocultar sugerencia
- Guardar flag de “dismiss” para no molestar (ver Persistencia)

---

## Persistencia / Anti-spam
Implementar un mecanismo simple para no mostrar la sugerencia repetidamente:

- Estado local por sesión del formulario:
  - `dismissedFutureObligationSuggestion: boolean`
- Reglas:
  - Si el usuario pulsa “Ahora no” → `dismissedFutureObligationSuggestion = true`
  - Mientras esté en el mismo formulario, **no volver a mostrar** aunque cambie la fecha futura.
  - Si el usuario cambia fecha a NO futura → no mostrar (obvio).
  - Si el usuario vuelve a elegir una fecha futura:
    - Si `dismissedFutureObligationSuggestion` es `true`, no mostrar.
- Reset:
  - Al salir/cerrar formulario o al guardar movimiento → reset flags.

**Opcional (mejor UX):** persistir por usuario (localStorage/AsyncStorage) durante 24h para no repetir la sugerencia en cada alta, pero **solo si es trivial**.

---

## Reglas de negocio (mínimas)
- Si `movementDate` es futura y el usuario decide obligación → por defecto es **PROGRAMADA**.
- Si `movementDate` no es futura → no sugerir nada.
- Si `isObligation === true` → no mostrar sugerencia nunca.
- Zona horaria: usar fecha local; comparar por “día” (no por timestamp estricto) para evitar edge cases a medianoche.

---

## Implementación UI (Web)
- Crear componente `FutureObligationSuggestion`
  - Props:
    - `visible: boolean`
    - `onAccept()`
    - `onDismiss()`
  - Estilo:
    - compacto, borde suave, fondo sutil (no un card grande)
    - botones pequeños (primary + ghost)
- Ubicación: debajo del bloque de Fecha, antes de “Cantidad” o donde tenga más sentido en tu layout actual.
- Accesibilidad:
    - botones con labels claros
    - foco correcto si se renderiza tras seleccionar fecha (no robar foco del datepicker)

---

## Implementación UI (Mobile)
- Componente equivalente con `View` + `Pressable`
- Mantener altura baja y padding consistente con el resto de secciones.
- Evitar overlays; debe ser inline.

---

## Estado / Tipos sugeridos
```ts
type ObligationType = "PENDIENTE" | "PROGRAMADA";

type MovementDraft = {
  movementDate: Date;
  isObligation: boolean;
  obligationType?: ObligationType;
  scheduledDate?: Date;
  dismissedFutureObligationSuggestion?: boolean;
};
