# Finnon — Arquitectura funcional (Marca + Home v2)

## 0) Contexto y problema
La Home actual es funcional pero no “enamora”:
- Jerarquía tipográfica inconsistente (pesos random, cifras destacadas sin criterio).
- Identidad débil (logo placeholder sin sistema de marca).
- Home muy “data-first” en el bloque de Balance: mucho aire y poco significado.
- Secciones “This month / Upcoming obligations / Next X days” aparecen como bloques sueltos.
- Web y móvil no se sienten el mismo producto (patrones y navegación cambian de forma perceptible).

Este rediseño prioriza: **entender el mes en curso** (tiempo + dinero inseparables) y reducir fricción mental :contentReference[oaicite:2]{index=2}

---

## 1) Principios de diseño (no negociables)
1) **Continuidad visual**: evitar overlays dramáticos; paneles como extensión natural del contenido. :contentReference[oaicite:3]{index=3} :contentReference[oaicite:4]{index=4}  
2) **Jerarquía silenciosa**: manda el espacio y el tamaño, no el color. :contentReference[oaicite:5]{index=5}  
3) **Color = estado/acción/impacto (no decoración)** y siempre con tokens. :contentReference[oaicite:6]{index=6}  
4) **Home responde en segundos**: comprometido, próximo hito, qué queda pendiente. :contentReference[oaicite:7]{index=7}  
5) **Móvil y web idénticos en UX**: mismo flujo, mismo vocabulario, misma estructura mental; cambia el layout (panel lateral vs bottom sheet). :contentReference[oaicite:8]{index=8}

---

## 2) Sistema de marca (mínimo, con peso)
### 2.1 Logotipo (v1)
**Objetivo**: que el cuadrado negro deje de ser “placeholder” y pase a ser un símbolo reconocible y escalable.

Propuesta: **Finnon Mark** (derivado del cuadrado)
- Base: cuadrado sólido (la “pieza estable”).
- Dentro: un recorte sutil (corner cut / notch) que sugiere “marca en el calendario” o “página doblada”.
- Variante micro (favicon/app icon): solo el cuadrado con notch.
- Variante completa: icon + wordmark “Finnon”.

Reglas:
- No gradients decorativos.
- Alto contraste y geometría simple (funciona en 16px y en 64px).
- El icono vive siempre en el mismo plano (no sombras “flotantes”).

### 2.2 Tipografía y jerarquía (v1)
**Objetivo**: acabar con pesos “random”.

Definir una escala fija (ejemplo, adaptable a tu stack):
- **Display / Balance**: 32–36, weight 700 (solo 1 cifra protagonista por pantalla).
- **Section title (H2)**: 18–20, weight 650.
- **Card title (H3)**: 16–17, weight 600.
- **Body**: 14–15, weight 450–500.
- **Meta** (fechas, labels): 12–13, weight 450, color text.secondary/muted.

Regla clave:
- **Negrita solo para**: (a) cifra principal del bloque, (b) total en un resumen, (c) CTA label si hace falta.
- Todo lo demás: regular/medium.

### 2.3 Color (v1 + un añadido mínimo)
Se usan tokens existentes como fuente de verdad :contentReference[oaicite:9]{index=9}  
- Acciones: `color.action.primary`
- Fondo/superficies: `color.bg.*`
- Texto: `color.text.*`

**Estados en calendario (requisito)**:
- Obligación pagada: **azul “positivo”** (usar `color.action.primary` para mantener coherencia y evitar un “verde ansiedad”).  
- Obligación pendiente: necesitas **amarillo**. En los tokens v1 no existe; para no romper el sistema, añadir **un único token semántico**:
  - `color.state.warning` (Light: ámbar suave; Dark: ámbar desaturado).
  - Uso exclusivo: estados “pendiente/atención”, no CTAs.

> Guardrail: no introducir más colores. Un warning bien definido no rompe la filosofía; la refuerza (estado, no decoración). :contentReference[oaicite:10]{index=10}

---

## 3) Home v2 — Nuevo “centro” visual: Month Map (calendario + flujo)
### 3.1 Estructura de la pantalla (misma IA en web/móvil)
**Header**
- Izquierda: Finnon Mark + “Finnon” (click lleva a “/”). (ya lo pedías en prompts previos)
- Centro: selector de cuenta/moneda.
- Derecha: settings.

**Hero principal (Month Map)**
1) **Balance + Flow** (mini bloque integrado)
2) **Calendario interactivo del mes** (núcleo)
3) **Resumen del mes** (Committed / Pending / Paid) *como “leyenda + totales”, no como tres cards sueltas*
4) **Accesos suaves**: “Ver todo” obligaciones / “Ver transacciones”.

**Debajo**
- **Actividad reciente** se mantiene con el mismo estilo actual (lista limpia).

---

## 4) Balance: de “dato” a “significado”
### 4.1 Representación “In/Out” (sin pie charts)
Objetivo: que el usuario lea *dirección* y *magnitud* sin pensar.

Componente: **Cash Flow Arrows**
- Dos flechas horizontales enfrentadas:
  - Flecha izquierda → centro: **Ingresos**
  - Centro → derecha: **Gastos**
- Grosor/longitud proporcional (escala relativa en el periodo visible: mes o próximos X días).
- En el centro, la cifra protagonista: **Balance neto** (única cifra en display).

Detalles:
- Labels en `text.secondary`, cifras en `text.primary`.
- Si balance negativo: usar `color.state.negative` SOLO para la cifra neta (no para todo el bloque). :contentReference[oaicite:11]{index=11}

---

## 5) Calendario interactivo (Month Map)
### 5.1 Qué representa
Un calendario mensual que marca 4 tipos de movimientos:
1) Ingresos puntuales
2) Gastos puntuales
3) Recurrentes (income/expense)
4) Obligaciones (paid/pending)

### 5.2 Encodings visuales (simples, legibles)
Cada día puede mostrar “chips/dots” (máx 3 visibles + overflow):
- **Dot shape** por tipo:
  - Puntual: ● (dot)
  - Recurrente: ◐ (semi-dot / ring)
  - Obligación: ■ (square dot)
- **Color**:
  - Income: neutro + “tinte” positivo muy leve (no verde chillón)
  - Expense: neutro + negativo contenido
  - Obligación pagada: `color.action.primary` (azul)
  - Obligación pendiente: `color.state.warning` (ámbar suave)

Regla de legibilidad:
- Si hay demasiados eventos: mostrar “+N” en muted.

### 5.3 Interacción (UX idéntica, layout adaptado)
**Click/tap en un día**
- Abre “Day Detail Panel”
- No overlay oscuro (continuidad). :contentReference[oaicite:12]{index=12} :contentReference[oaicite:13]{index=13}

**Móvil (app + web móvil)**
- Day Detail Panel = **bottom sheet**
- Snap points: 40% (resumen) → 80% (detalle completo)
- Cierre: swipe down + botón close discreto.

**Web escritorio**
- Day Detail Panel = **panel lateral derecho** persistente
- El calendario permanece visible (no “modaliza” la experiencia).

### 5.4 Contenido del Day Detail Panel
Orden (siempre igual):
1) Resumen del día:
   - Net (pequeño)
   - Income total / Expense total
2) Obligaciones del día (si existen):
   - Estado (pagada/pendiente) y CTA contextual
3) Recurrentes que caen ese día (si aplica)
4) Transacciones puntuales
5) “Acciones” (v1): Añadir transacción / Añadir obligación (si existe en tu IA actual)

**CTAs**
- Un CTA primario máximo por panel (evitar ruido).
- Acciones secundarias como texto/botón ghost.

---

## 6) Integración de “This Month + Obligations + Next X days”
Se fusionan dentro del Month Map:
- **Committed / Pending / Paid** pasan a ser:
  - Totales del mes (small KPI row) + leyenda de calendario.
- **Upcoming obligations**:
  - Se reflejan en el calendario como eventos “obligation”.
  - “Ver todo” abre lista filtrada (misma que ahora).
- **Next X days (7/14/30)**:
  - Control de rango que cambia:
    - (a) la escala del Flow Arrows
    - (b) un “highlight” sutil en el calendario (ej: sombreado de la franja de días futuros)
  - Por defecto 7 días.

---

## 7) Preparado para futuras features (sin rediseñar)
Tu calendario tiene que aceptar “capas” futuras sin romperse:
- “Impuestos pagados hoy”
- “Ganado hoy”
- “Escenarios” (ej: comprar coche) = capa simulada

Arquitectura UX:
- Añadir un selector “Capas” (píldora discreta) dentro del panel del día o en el header del calendario.
- Cada capa añade indicadores, pero respeta el límite visual (máx 1 indicador adicional por día).

---

## 8) Estados vacíos y tono
- Mes sin eventos: “Aún no hay movimientos este mes.” (calmo, sin drama) :contentReference[oaicite:14]{index=14}  
- Día sin eventos: “Nada programado este día.”
- Si todo pagado: microcopy tipo “Este mes está bajo control.” :contentReference[oaicite:15]{index=15}

---

## 9) Definition of Done (diseño)
- Tipografía: escala aplicada y consistente (no pesos aleatorios).
- Marca: Finnon Mark definido (icon + reglas).
- Home: Month Map reemplaza la suma de cards sueltas.
- Interacción: tap día abre detalle (bottom sheet móvil / panel lateral web) sin overlay.
- Estados: obligación pagada (azul), pendiente (ámbar warning).
- Actividad reciente: conserva estilo actual.
- UX web/móvil: mismo flujo, misma estructura, distinto layout. :contentReference[oaicite:16]{index=16}
