# Prompt para agente de código — Formulario “Añadir movimiento” (Web + Mobile)

## Contexto
Estamos en Finnon (Next.js web + Expo/React Native móvil). Queremos que el formulario de añadir movimiento sea rápido, claro y con continuidad visual (sin overlays dramáticos), con animaciones sutiles y jerarquía por espacio/tamaño, no por color. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}

## Objetivo
Implementar un **formulario de 3 pasos** para crear un movimiento (ingreso o gasto) en modo **paneles deslizables tipo carrusel**, con **breadcrumb** (estilo stepper) y un **toggle** para alternar entre:
- **Modo “Paneles” (carousel)**: 3 pantallas.
- **Modo “Lista”**: todos los campos en una sola pantalla (misma validación / misma lógica).

Debe existir primero una elección clara: **Ingreso / Gasto**. Tras elegir, se entra al flujo 3 pasos.

## Flujo (3 pasos)
### Paso 1 — Nombre + Fecha + Cantidad
- **Nombre**: campo de texto libre con mucha presencia visual (tamaño/espacio).
- **Fecha**: quick options:
  - chips: **Hoy**, **Ayer**, **Mañana**
  - + icono calendario para abrir selector completo
- **Cantidad**:
  - teclado numérico (móvil) / input numérico (web)
  - soporte decimal **por idioma**:
    - `.` para inglés
    - `,` para español
  - aceptar también el “otro separador” si el usuario lo escribe, pero **normalizar** internamente.
  - NO usar float para persistencia: convertir a minor units (bigint) si ya existe esa utilidad en shared. (Si aún no existe, crea `parseMoneyToMinor` en `packages/shared`).

CTA: “Siguiente” (deshabilitado si inválido).

### Paso 2 — Categoría + Comercio
- UI por campo:
  - label con **icono** + texto (p.ej. “Categoría”, “Comercio”)
- **Categoría**:
  - mostrar **chips** con top categorías más usadas por el usuario en la cuenta, filtradas por `type` (income/expense).
  - botón “Ver todas” → abre selector completo (sheet/panel integrado, sin overlay dramático).
- **Comercio**:
  - input con **predicción/sugerencias** (chips o lista compacta).
  - La predicción debe basarse en historial de comercios del usuario en la cuenta, idealmente ponderada por:
    1) categoría seleccionada
    2) matches por prefijo de texto
    3) frecuencia/recencia
  - Si no hay historial: no inventar; solo dejar input libre.

CTA: “Siguiente”.

### Paso 3 — Notas + Fotos
- **Notas**: textarea “molona” pero sobria (auto-grow, placeholder útil, contador suave opcional).
- **Fotos**:
  - UI con grid/miniaturas + botón “Añadir foto”
  - Web: file input (multi)
  - Mobile: image picker (multi si posible)
  - Guardar attachments como parte del movimiento (o post-creación si el backend lo requiere; pero la UX debe sentirse de una sola acción).

CTA: “Guardar movimiento”.

## UX / UI (no negociable)
- Mantener continuidad visual: evitar overlays oscuros, blur, dramatismos. :contentReference[oaicite:2]{index=2} :contentReference[oaicite:3]{index=3}
- Animaciones sutiles, funcionales, sin rebotes. :contentReference[oaicite:4]{index=4}
- Jerarquía por **espaciado y tipografía**, no por color. :contentReference[oaicite:5]{index=5}
- Colores: usar **tokens semánticos**, nunca hex directos. :contentReference[oaicite:6]{index=6}
  - CTAs: `color.action.primary`
  - Disabled: `color.action.disabled`
  - Errores: `color.state.negative`
  - Superficies: `color.bg.surface`, etc.

## Componentes a implementar
1) `AddTransactionEntry` (selector inicial ingreso/gasto)
2) `AddTransactionForm`
   - Estado compartido entre pasos (draft)
   - Validación incremental (Paso 1/2/3)
3) `TransactionStepperBreadcrumb`
   - 3 items: “Detalles”, “Categoría”, “Notas”
   - estado: done / active / pending
4) `TransactionCarousel`
   - Mobile: pager/swipe controlado + botones Siguiente/Atrás (no gestos ocultos obligatorios)
   - Web: paneles con CSS scroll-snap o animación; navegación con chevrons discretos
5) `CategoryChips` (top 3 + “Ver todas”)
6) `MerchantPredictor`
   - endpoint/selector que devuelve sugerencias (top N)
7) `NotesAndPhotos`
   - attachments grid + add/remove

## Persistencia de preferencia (toggle Lista vs Paneles)
- Añadir setting `addTransactionFormMode: 'panels' | 'list'`
- Persistir:
  - Web: localStorage (por usuario si hay userId)
  - Mobile: AsyncStorage / SecureStore (lo que ya uséis)
- Default recomendado: `panels`

## i18n / locales (importe)
- Detectar locale (web: `navigator.language`; mobile: `expo-localization` o equivalente).
- Reglas:
  - Mostrar separador decimal acorde al locale (ES `,`, EN `.`).
  - Permitir input con ambos (`.` y `,`), pero normalizar al parse.
  - Limitar decimales según moneda si ya tenéis `currency_meta/minor_units`. Si no, asumir 2 decimales (v1).

## Validación (mínimo)
- Nombre: requerido, trim, min 1
- Fecha: requerida
- Cantidad: requerida, > 0, parseable
- Categoría: requerida
- Comercio: opcional
- Notas: opcional
- Fotos: 0..N (definir límite si ya hay entitlements; si no, ilimitado v1)

## Integración datos
- Crear movimiento con:
  - `type: 'income'|'expense'`
  - `name`
  - `date`
  - `amount_minor` (+ currency si aplica)
  - `category_id`
  - `merchant` (string)
  - `notes` (string)
- Attachments:
  - subir a storage y guardar metadata en `attachments` asociada a `transaction_id`

## Estados y errores
- Loading claro en “Guardar”
- Errores inline por campo (sobrios) + toast opcional
- Si falla subida de fotos:
  - guardar transacción igual (si ya creada) y reintentar attachments, pero comunicarlo sin drama

## Definition of Done (DoD)
- [ ] Funciona en Web y Mobile con el mismo flujo y copy
- [ ] Toggle Lista/Paneles persiste y se respeta al reabrir
- [ ] Breadcrumb/stepper siempre refleja el paso actual
- [ ] Input de cantidad acepta `,` y `.` y guarda correctamente (sin floats)
- [ ] Quick date chips (Hoy/Ayer/Mañana) + selector calendario
- [ ] Chips de categorías top 3 por tipo (income/expense)
- [ ] Predicción de comercio devuelve sugerencias reales del historial (si existe)
- [ ] Notas y fotos: añadir/eliminar y ver miniaturas
- [ ] Sin overlays dramáticos; animaciones sutiles; colores solo por tokens :contentReference[oaicite:7]{index=7} :contentReference[oaicite:8]{index=8}
- [ ] Tests mínimos:
  - parse importe ES/EN
  - validación por pasos
  - merchant predictor (ranking básico)

## Notas de implementación (para elegir tú la mejor opción)
- Mantén un único “draft state” (react-hook-form / zod) compartido entre pasos.
- En modo Lista, reutiliza los mismos subcomponentes (Paso1/Paso2/Paso3) apilados.
- Evita duplicar lógica: solo cambia el layout/navegación.


Selector inicial

Título: Añadir movimiento

Subtítulo: ¿Qué quieres registrar?

Botones:

Ingreso

Gasto

Breadcrumb (3 pasos)

Detalles

Categoría

Notas

Estados:

Activo: Detalles

Completado: ✓ Detalles

Pendiente: Categoría / Notas

Paso 1 — Detalles (Nombre + Fecha + Cantidad)
Nombre

Label: Nombre

Placeholder: Ej. “Cena en La Tagliatella”, “Nómina”, “Gasolina”

Ayuda (opcional, sutil): Pon algo que te ayude a reconocerlo luego.

Error:

“Escribe un nombre.”

Fecha

Label: Fecha

Chips rápidos: Hoy · Ayer · Mañana

Acción calendario: “Elegir fecha”

Texto seleccionado: “lun, 26 ene 2026” (formato local)

Error:

“Elige una fecha.”

Cantidad

Label: Cantidad

Placeholder: 0,00 (ES) / 0.00 (EN)

Microtexto (opcional): Puedes escribir con coma o punto.

Errores:

“Escribe una cantidad.”

“La cantidad debe ser mayor que 0.”

“Formato no válido.”

Botones

Primario: Siguiente

Secundario (si aplica): Cancelar

Paso 2 — Categoría + Comercio
Categoría

Label: Categoría

Chips top: (3 más usadas)

Acción: Ver todas

Vacío (si no hay top): “Elige una categoría para seguir.”

Errores:

“Elige una categoría.”

Comercio

Label: Comercio

Placeholder: Ej. “Mercadona”, “Amazon”, “Renfe”

Sugerencias (título pequeño): Sugeridos

Acción opcional: “No poner comercio”

Microtexto (cuando hay categoría elegida):

“Según tu historial…”

(sin esa frase si no hay datos, cero invents)

Botones

Primario: Siguiente

Secundario: Atrás

Paso 3 — Notas + Fotos
Notas

Label: Notas

Placeholder: “Apunta lo que quieras: motivo, quién pagó, detalles…”

Microacción (opcional): “Añadir nota rápida” (abre mini lista: “Reembolso”, “Trabajo”, “Viaje”, “Regalo”)

Fotos

Label: Fotos

Botón: Añadir foto

Estado vacío: “Añade un ticket o una foto si te viene bien.”

Acciones en miniatura: Ver · Quitar

Botones

Primario: Guardar movimiento

Secundario: Atrás

Loading:

“Guardando…”
Éxito (toast):

“Movimiento guardado.”
Error genérico (toast):

“No se ha podido guardar. Inténtalo otra vez.”

Error fotos (si transacción ya se guardó pero fallan adjuntos):

“Movimiento guardado, pero las fotos no se han subido.”

Toggle modo formulario (Lista vs Paneles)

Label: Modo de formulario

Opciones:

Paneles (recomendado)

Lista

Microtexto: “Elige cómo te resulta más cómodo.”