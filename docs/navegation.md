# Prompt para agente de código — Navegación global (Web + Móvil)

## Contexto
Quiero añadir un **menú de navegación** en **aplicación web y móvil**, alineado con la guía de estilos de la app.  
La app ya tiene un **botón “Añadir” (FAB) en la esquina inferior derecha**, así que **NO debe duplicarse** en la navegación (especialmente en web).

---

## Objetivo
1. Implementar navegación global consistente:
   - **Web:** barra superior (top navigation).
   - **Móvil:** barra inferior de tabs.
2. Mantener el estilo “lean”: continuidad visual, sin marcos, sin colorines, sin efectos pesados.
3. Respetar la estructura actual del proyecto (rutas/layouts). Cambios mínimos.

---

## Requisitos funcionales

### Web — Barra superior (Top Navigation)
- Añadir una **barra de navegación superior** visible en las pantallas principales (según el layout actual).
- Debe incluir:
  1) **Cuenta activa** (mostrar el nombre de la cuenta actual; si hay selector ya implementado, reutilizarlo; si no, mostrar solo el nombre).
  2) **Botón de acceso a Settings** (icon button + accesibilidad).
- **Eliminar/No incluir “Añadir”** en esta barra (porque ya existe el FAB inferior derecha).
- La barra debe sentirse integrada:
  - Sin sombra fuerte.
  - Separación con un **divisor sutil**.

### Móvil — Barra inferior de Tabs
- Añadir **tabs inferiores** con 3 opciones:
  - **Home**
  - **Account**
  - **Settings**
- La **tab activa** debe mostrar un **sombreado gris sutil** (no color de acción).
- No añadir tab de “Añadir”.

---

## UI / Estilo (no negociables)
- Usar **tokens semánticos** del design system (no hex directos).
- Jerarquía con espacio y tipografía (no con color).
- Evitar overlays y efectos “dramáticos”.

### Indicaciones de tokens (orientativas)
- **Sombreado activo (gris):** usar un token de fondo secundario (p.ej. `bg.secondary`).
- **Divisores/borders:** token neutral (p.ej. `border.neutral`).
- **Texto:** `text.primary` / `text.secondary`.

> Importante: el sombreado del tab activo en móvil debe ser gris, no “accent/action”.

---

## Requisitos de arquitectura / Reutilización
- Centralizar la definición de navegación (keys + labels + orden) en `shared` si existe el patrón:
  - Ejemplo: `packages/shared/navigation/*` o equivalente.
- El módulo `shared` debe ser **agnóstico** (no acoplado a librerías concretas de navegación).
  - Exportar config simple (keys/labels) y que cada app lo adapte a su router.
- Los copies “Home / Account / Settings” deben salir de la fuente compartida si ya existe un sistema de copy/i18n compartido (sin duplicar strings).

---

## Implementación (orientación técnica)

### Web
- Implementar un componente `TopNav` (o nombre equivalente) e integrarlo en el layout principal.
- Estructura sugerida:
  - Izquierda/centro: **Cuenta activa** (texto).
  - Derecha: **Settings** (icon button).
- Sticky solo si ya lo usas; no forzar.

### Móvil
- Implementar tabs con el mecanismo nativo del proyecto (p.ej. Expo Router Tabs si aplica).
- Estilo tab activo:
  - Fondo `bg.secondary` (gris sutil)
  - Padding contenido
  - Bordes redondeados suaves si encaja con el sistema
  - Sin animaciones llamativas

---

## Definition of Done (DoD)
1. **Web**:
   - Barra superior visible en las pantallas principales.
   - Muestra **Cuenta activa**.
   - Tiene botón de **Settings**.
   - **No existe “Añadir”** en la barra superior.
2. **Móvil**:
   - Tabs inferiores con **Home / Account / Settings**.
   - Tab activa con **sombreado gris** usando tokens (sin hex directos).
3. Estilo consistente con la guía:
   - Sin sombras fuertes, sin overlays innecesarios, sin colores fuera del sistema.
4. No hay regresiones:
   - El FAB de “Añadir” sigue existiendo y funcionando igual.
   - No se rompen rutas/layouts actuales.

---

## Guardarraíles
- No rediseñar pantallas existentes (solo integrar navegación).
- No añadir features nuevas (solo navegación).
- No introducir nuevos colores hardcodeados.
- Priorizar consistencia y sobriedad.
