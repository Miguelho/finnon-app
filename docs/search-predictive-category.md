Predicción de comercio al añadir un movimiento (Web + Mobile)

## Contexto
Finnon reduce fricción mental al registrar movimientos. En el formulario **Añadir movimiento**, el campo **Comercio** se repite con frecuencia (Mercadona, Amazon, etc.). Queremos acelerar la entrada y reducir variaciones (“Mercadona”, “mercadona”, “MERCADONA”…), sin dramatismos de UI.

Principios a respetar:
- Diseño silencioso, continuidad visual, sin overlays innecesarios. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1}
- Usar **tokens** de color existentes; no inventar colores ni valores hardcodeados. :contentReference[oaicite:2]{index=2}
- Evitar lenguaje “IA”. Es autocompletado predictivo, punto. :contentReference[oaicite:3]{index=3}

---

## Historia de usuario
**Como** miembro de una cuenta con permisos para crear movimientos,  
**quiero** recibir sugerencias de **comercio** al añadir un movimiento, basadas en el histórico de comercios de la cuenta,  
**para** completar el movimiento más rápido y con menos errores de escritura.

---

## Objetivo (Outcome)
- Reducir tiempo de completar “Comercio”
- Reducir duplicados por variación de escritura
- Mantener UX “cotidiana”: sugerir sin interrumpir

---

## Alcance v1 (cerrado)
- Sugerencias SOLO con datos de la **cuenta activa**.
- Ranking simple (frecuencia + recencia).
- Filtrado por texto mientras el usuario escribe.
- Seleccionar sugerencia rellena el input.
- Sin “estado vacío” visible: si no hay sugerencias, no se muestra nada.

No incluye v1:
- Predicción con ML / embeddings / proveedores externos
- Deducción automática por categoría o importe (se puede plantear en v1.1)
- Unificación “inteligente” agresiva de comercios (solo normalización ligera)

---

## UX / UI (Web + Mobile)

### Ubicación
Formulario: **Añadir movimiento** → campo **Comercio**.

### Comportamiento
- Al **focus** del campo: mostrar lista de sugerencias si existen.
- Al **teclear**: filtrar sugerencias por coincidencia (prefijo o contains).
- Al **tap/click** en sugerencia: set value en el input y cerrar lista.
- Al **blur**: cerrar la lista.

### Visual (reglas)
- Sin overlay, sin blur, sin “modal vibe”. Continuidad del plano. :contentReference[oaicite:4]{index=4} :contentReference[oaicite:5]{index=5}
- Jerarquía por espaciado y tipografía, no por color. :contentReference[oaicite:6]{index=6}
- Colores: usar tokens semánticos (ver sección tokens). :contentReference[oaicite:7]{index=7}
- Animaciones: sutiles, sin rebote. :contentReference[oaicite:8]{index=8}

### Microcopy
- Placeholder input: `Ej: Mercadona`
- No mostrar textos tipo “No hay sugerencias”.

---

## Reglas de predicción (v1)

### Normalización (para deduplicar suave)
Aplicar al construir el índice de comercios:
- `trim()`
- colapsar espacios múltiples a uno
- case-insensitive (comparación en lower)
- opcional v1: quitar tildes (si ya existe helper; si no, omitir)

Guardar / mostrar:
- Mostrar la versión “más común” o la última usada (la que elijas, pero consistente).
- Internamente usar la clave normalizada para agrupar.

### Ranking (score)
Score conceptual por comercio:
- `score = w_freq * freq + w_recency * recencyBoost`
- Donde:
  - `freq`: número de apariciones en ventana
  - `recencyBoost`: boost si aparece recientemente (ej: últimos 30 días)
- No hace falta exponer pesos; solo que el orden se note “correcto”.

### Ventana de datos
Elegir una opción y documentarla en código:
- Opción A: últimos **90 días**
- Opción B: últimos **200 movimientos**
(Preferible la que sea más barata con índices actuales.)

---

## Datos y consultas

### Fuente de verdad
`transactions.merchant` (o campo equivalente) filtrado por `account_id`.

### Recomendación técnica (para rendimiento)
Crear una query/endpoint que devuelva agregados:
- `merchant_display`
- `merchant_key` (normalizado)
- `count`
- `last_used_at`

Ejemplo (conceptual):
- Agrupar por `merchant_key`
- `count(*)`
- `max(date)` o `max(created_at)` como `last_used_at`

### Cache
- Cache en cliente por `account_id` (memoria + invalidación simple):
  - refresh al abrir el form
  - o refresh si se crea un movimiento con un merchant nuevo

---

## API / Contratos (sugerido)

### Endpoint
`GET /api/accounts/:accountId/merchants/suggestions?query=<text>&limit=8`

Response:
```ts
type MerchantSuggestion = {
  merchant: string;        // display
  merchantKey: string;     // normalized key
  count: number;
  lastUsedAt: string;      // ISO
}
Notas:

query opcional: si viene vacío, devuelve top N

Siempre filtrar por accountId y validar membership (RLS / server auth)

Componentes UI (entregables)
Shared (si aplica)
MerchantAutocomplete (props: value, onChange, onSelect, accountId)

Web
Integración en el formulario “Añadir movimiento”

Dropdown ligero bajo input (misma anchura)

Mobile (Expo / RN)
Lista bajo el input o panel integrado (no modal agresivo)

Tap para seleccionar

Tokens (obligatorio)
Usar tokens existentes, sin valores directos: 
color-guide


Fondo superficies: color.bg.surface / color.bg.secondary

Texto: color.text.primary / color.text.secondary / color.text.muted

Divisores: color.state.neutral

Foco/selección suave: color.action.secondary

CTA (si hubiera): color.action.primary

Edge cases
Cuenta sin comercios: no render de dropdown.

Comercios muy largos: ellipsis visual, valor completo al seleccionar.

Duplicados obvios (“Amazon”, “amazon”): agrupados por normalización.

Comercios parecidos pero distintos: se muestran ambos (v1).

Usuario escribe un comercio nuevo: se permite guardar; entrará en sugerencias tras guardarlo.

Seguridad
Acceso únicamente a comercios de la cuenta activa.

Validar en server que el usuario pertenece a la cuenta (RLS + comprobación).

No exponer información de otras cuentas.

Definition of Done (DoD)
 Autocomplete funcional en Web y Mobile

 Sugerencias ordenadas por relevancia (freq + recencia)

 Filtrado por texto introducido

 Selección rellena el campo y cierra lista

 Sin overlay/modal dramático; continuidad visual

 Sin colores hardcodeados; solo tokens

 Tests mínimos (normalización + ranking + filtrado)

 Performance: no bloquear UI; cache o prefetch razonable

 No aparece la palabra “IA” en UI/copy

Tests (mínimos)
Normalización:

" Mercadona " -> "mercadona"

"Repsol Express" -> "repsol express"

Ranking:

más frecuente arriba si recencia similar

si frecuencia similar, más reciente arriba

Filtrado:

query "mer" incluye "Mercadona"

query "ama" incluye "Amazon"

Notas para implementación (prioridades)
Implementar agregación/endpoint (o query directa si ya hay capa data)

Componente UI reusable (web/mobile con adaptaciones)

Cache por cuenta

Pulido de estados y animaciones sutiles