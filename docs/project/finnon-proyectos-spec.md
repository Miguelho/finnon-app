# Finnon — Especificación de Producto: Proyectos

**Versión:** 1.0  
**Fecha:** 22 de febrero de 2026  
**Autor:** Miguel (Poleursus)  
**Estado:** Diseño validado, pendiente de desarrollo

---

## 1. Contexto y problema

En parejas donde uno gestiona las finanzas y el otro no, se produce una asimetría de información: el "gestor" tiene contexto completo sobre ingresos, gastos y capacidad de ahorro, mientras que el "compañero" opera con información parcial y tiende a decisiones excesivamente conservadoras ("no podemos permitirnos el viaje") por desconocimiento, no por realidad financiera.

La pestaña actual de **Objetivo** en Finnon resuelve parcialmente este problema: muestra si el usuario está cumpliendo un objetivo de ahorro mensual. Sin embargo, carece de propósito emocional — el usuario ve "€1417 de €500" pero no sabe *para qué* está ahorrando. No hay destino.

**Proyectos** resuelve esto conectando el ahorro con sueños concretos: vacaciones, un coche, una reforma, un portátil. Hace visible lo invisible para ambos perfiles de usuario.

---

## 2. Relación entre Proyectos y Objetivos

### Modelo mental

- **Objetivo** = termómetro mensual. Responde a: "¿estoy ahorrando lo que dije que ahorraría este mes?" Es operacional, mira al presente.
- **Proyecto** = brújula. Responde a: "¿hacia dónde va mi ahorro y cuándo llego?" Es aspiracional, mira al futuro.

### Cómo se conectan

Un Proyecto genera un objetivo de ahorro mensual a través de su simulador. La pantalla de Objetivo muestra la **suma de todos los compromisos de proyectos activos** más cualquier objetivo manual que el usuario defina sin proyecto asociado.

El Objetivo puede nacer de dos sitios:

1. **De un Proyecto** (con propósito): "Necesito ahorrar €350/mes para llegar a Eurodisney en 12 meses."
2. **Del usuario directamente** (sin propósito, tal como funciona ahora): "Quiero ahorrar €500/mes."

Ambas pantallas conviven en la navegación como pestañas separadas. No se reemplazan.

---

## 3. Funcionalidad: Proyectos

### 3.1 Vista de lista

La pantalla principal muestra todos los proyectos activos del usuario. Cada tarjeta de proyecto incluye:

- Emoji + nombre del proyecto
- Barra o anillo de progreso (ahorrado vs. objetivo total)
- Porcentaje completado
- Cantidad ahorrada de cantidad objetivo (ej: "€1.850 de €6.000")
- Fecha estimada de consecución (si tiene plan de ahorro activo)
- Indicador si no tiene plan de ahorro configurado

En la parte superior de la lista se muestra el **compromiso mensual total**: la suma de los compromisos mensuales de todos los proyectos activos. Esto permite al usuario ver de un vistazo cuánto de su capacidad de ahorro está comprometida.

Los proyectos son **compartidos entre los usuarios de la cuenta** (pareja/compañeros de piso). No hay proyectos individuales en esta primera versión.

Los proyectos tienen un **orden de prioridad** definido por el usuario (ver sección 5: Lógica de reparto).

### 3.2 Crear un proyecto

Datos necesarios para crear un proyecto:

- **Nombre** (texto libre): "Eurodisney", "Portátil nuevo", "Reforma cocina"
- **Emoji** (selector): representación visual rápida
- **Objetivo financiero** (cantidad en €): cuánto dinero necesita el proyecto
- **Prioridad** (posición relativa): orden respecto a otros proyectos activos

El proyecto se crea sin plan de ahorro. El usuario puede configurar uno a través del simulador.

### 3.3 Detalle de proyecto

Al entrar en un proyecto, el usuario ve:

**Cabecera:** emoji, nombre, fecha de creación.

**Bloque hero:** objetivo total, barra de progreso con hitos (25%, 50%, 75%, 100%), cantidad ahorrada y cantidad restante.

**Dos pestañas:**

- **Simulador** (sección 4)
- **Historial** (sección 6)

**CTA principal:** "Fijar €X/mes como objetivo" — el botón que conecta el simulador con la pestaña Objetivo.

---

## 4. Funcionalidad: Simulador (dos capas)

El simulador está diseñado para servir a dos perfiles de usuario distintos desde la misma pantalla:

### Capa 1: Slider simple (experiencia por defecto)

Visible siempre al entrar en el simulador. Un slider que permite al usuario ajustar la cantidad mensual que quiere destinar al proyecto.

- **Rango:** €0 a un máximo razonable (ej: €1.500, configurable)
- **Incrementos:** €25
- **Resultado inmediato:** al mover el slider, se actualiza en tiempo real la fecha estimada de consecución y el tiempo restante

El resultado hero es siempre la **fecha estimada**, no el número. "Con €350/mes llegas en 1 año y 2 meses — abril 2027." La fecha es lo que conecta emocionalmente.

**Para quién es:** el usuario no-analítico (el "compañero"). Mueve el slider, ve la fecha cambiar, entiende el impacto sin necesitar contexto financiero previo. Experiencia top-down: "parto de mi sueño y descubro cuánto esfuerzo necesito."

### Capa 2: Desglose de gastos (colapsado por defecto)

Sección expandible debajo del slider titulada "¿Qué gastos puedo recortar?". Al expandir, muestra la lista de gastos recurrentes del usuario con toggles para desactivar cada uno.

- Los gastos desactivados se suman al ahorro mensual del slider
- El resultado hero se actualiza en tiempo real combinando ambas fuentes
- Se muestra un indicador de cuánto se libera de los gastos desactivados

**Para quién es:** el usuario analítico (el "gestor"). Desactiva gastos concretos y ve el impacto preciso. Experiencia bottom-up: "parto de mis gastos reales y descubro cuánto puedo liberar."

### Fórmula de cálculo

```
ahorro_efectivo_mensual = slider_value + suma(gastos_desactivados)
meses_restantes = (objetivo_total - cantidad_ahorrada) / ahorro_efectivo_mensual
fecha_estimada = hoy + meses_restantes
```

### CTA: Fijar objetivo

Al pulsar "Fijar €X/mes como objetivo", el compromiso mensual del proyecto se guarda y se refleja en la pestaña Objetivo como parte del compromiso total.

Si el usuario modifica el simulador más adelante y pulsa de nuevo, se actualiza el compromiso.

---

## 5. Lógica de reparto y prioridad

### Contexto

Cuando el usuario tiene múltiples proyectos activos, el sistema necesita determinar cuánto del ahorro real de cada mes se asigna a cada proyecto.

### Método: proporcional al compromiso con prioridad

El reparto base es **proporcional al compromiso mensual** de cada proyecto:

**Ejemplo con superávit:**
- Eurodisney: compromiso €350/mes (63.6%)
- Portátil: compromiso €200/mes (36.4%)
- Ahorro real del mes: €800
- Reparto base: Eurodisney €509, Portátil €291
- Los €250 de excedente (€800 - €550 comprometidos) quedan pendientes de decisión del usuario

**Ejemplo con déficit:**
- Mismos compromisos: €350 + €200 = €550 total
- Ahorro real del mes: €400 (déficit de €150)
- Con prioridad, se alimenta primero el proyecto prioritario:
  - Si Eurodisney es prioridad 1: recibe sus €350 completos, Portátil recibe €50
  - Si ambos son prioridad equivalente: reparto proporcional — Eurodisney €254, Portátil €146

### Excedente

Si el ahorro del mes supera el compromiso total, el usuario decide en la notificación de fin de mes qué hacer con el excedente:

- **Repartir entre proyectos** (proporcional o a elección)
- **No hacer nada** (el excedente no se asigna a ningún proyecto)

---

## 6. Notificación de fin de mes

### Flujo

1. A final de mes, el sistema calcula el ahorro real del mes (balance registrado)
2. Calcula el reparto proporcional con prioridad entre proyectos activos
3. Envía una **notificación** al usuario (push notification, por implementar)
4. El usuario abre una pantalla de confirmación que muestra:
   - Ahorro real del mes
   - Reparto sugerido por proyecto
   - Si hay excedente: opción de repartirlo o dejarlo sin asignar
   - Si hay déficit: indicación de qué proyectos se han visto afectados y cómo
5. El usuario **confirma o ajusta** manualmente el reparto
6. Al confirmar, las aportaciones se registran en el historial de cada proyecto

### Reglas

- El sistema **nunca asigna automáticamente sin confirmación**. Siempre sugiere y espera validación.
- Si el usuario no confirma, el mes queda pendiente (con indicador visual en la app).
- La notificación es el "ritual de fin de mes" — un momento para que la pareja revise junta su progreso.

---

## 7. Historial de proyecto

### Qué muestra

El historial de cada proyecto combina dos dimensiones:

**A) Aportaciones reales (registro de contribuciones):**
- Cada mes confirmado genera un registro: fecha, cantidad aportada, quién aportó (en contexto de pareja)
- Muestra la progresión acumulada hacia el objetivo

**B) Cumplimiento del compromiso (tracking de disciplina):**
- Cada mes se compara la aportación real con el compromiso mensual del proyecto
- Indicador visual: mes cumplido (verde), mes con déficit (naranja/rojo), mes sin plan (gris)
- Permite responder: "¿vamos en camino o nos estamos desviando?"

### Visualización sugerida

Una línea temporal mes a mes que muestre:

- Barra o punto por mes con la aportación real
- Línea de referencia con el compromiso mensual
- Acumulado progresivo hacia el objetivo total
- Indicador de quién aportó (para contexto de pareja)

---

## 8. Modelo de datos (conceptual)

### Tabla: projects

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| account_id | uuid | FK a la cuenta compartida |
| name | text | Nombre del proyecto |
| emoji | text | Emoji representativo |
| target_amount | numeric | Objetivo financiero en € |
| monthly_commitment | numeric | Compromiso mensual derivado del simulador (nullable) |
| priority | integer | Orden de prioridad (1 = más importante) |
| status | enum | active, completed, paused, cancelled |
| created_at | timestamp | Fecha de creación |
| updated_at | timestamp | Última modificación |

### Tabla: project_contributions

| Campo | Tipo | Descripción |
|-------|------|-------------|
| id | uuid | PK |
| project_id | uuid | FK al proyecto |
| user_id | uuid | FK al usuario que aportó / confirmó |
| period | date | Mes al que corresponde (primer día del mes) |
| committed_amount | numeric | Lo que se debía aportar según compromiso |
| actual_amount | numeric | Lo que realmente se aportó |
| source | enum | automatic (reparto del sistema), manual (ajuste del usuario) |
| confirmed | boolean | Si el usuario confirmó el reparto |
| confirmed_at | timestamp | Cuándo se confirmó |
| created_at | timestamp | Fecha de creación |

### Campos derivados (client-side, no almacenar)

- `total_saved`: SUM(actual_amount) de project_contributions WHERE confirmed = true
- `remaining`: target_amount - total_saved
- `months_left`: remaining / monthly_commitment
- `estimated_date`: NOW + months_left
- `progress_percentage`: total_saved / target_amount

---

## 9. Impacto en la pantalla Objetivo existente

La pantalla de Objetivo actual no cambia en su mecánica. Los cambios son:

1. **El objetivo mensual puede incluir compromisos de proyectos.** Si el usuario tiene €350/mes para Eurodisney y €200/mes para el portátil, la pantalla Objetivo debería reflejar al menos €550/mes como objetivo (más cualquier objetivo manual adicional).

2. **Indicador de composición.** Opcionalmente, mostrar de dónde viene el objetivo: "€550 de proyectos + €0 manual = €550/mes". Esto conecta las dos pantallas y da propósito al número.

3. **El simulador de ahorro existente en Objetivo** (el de toggles de gastos recurrentes) puede coexistir con el simulador de Proyectos. Son contextos distintos: uno es "cuánto puedo ahorrar en general" y otro es "cuánto necesito para este sueño concreto."

---

## 10. Navegación

```
Finnon
├── Inicio
├── Movimientos
├── Proyectos        ← NUEVO
│   ├── Lista de proyectos
│   └── Detalle de proyecto
│       ├── Simulador (slider + gastos)
│       └── Historial
├── Objetivo         ← EXISTENTE (sin cambios mayores)
└── Tu Cuenta
```

---

## 11. Fases de implementación sugeridas

### Fase 1: MVP — Crear y simular

- Vista de lista de proyectos
- Crear proyecto (nombre, emoji, objetivo, prioridad)
- Detalle con bloque hero (progreso, ahorrado, restante)
- Simulador capa 1: slider con fecha estimada
- CTA para fijar compromiso mensual
- Reflejar compromiso total en pantalla Objetivo

### Fase 2: Simulador completo

- Simulador capa 2: desglose de gastos recurrentes (expandible)
- Combinación de slider + gastos desactivados en el cálculo

### Fase 3: Reparto y notificaciones

- Lógica de reparto proporcional con prioridad
- Pantalla de confirmación de fin de mes
- Notificación push (infraestructura por definir)
- Gestión de excedente y déficit

### Fase 4: Historial

- Registro de aportaciones confirmadas
- Vista de historial por proyecto
- Indicadores de cumplimiento mensual
- Visualización de progresión acumulada

---

## 12. Wireframe de referencia

Se ha creado un artifact interactivo en React (archivo: `proyectos-wireframe.jsx`) que incluye:

- Vista de lista con tarjetas de proyecto, anillo de progreso y compromiso total
- Vista de detalle con bloque hero, barra de progreso con hitos
- Simulador con slider (capa 1) y desglose de gastos colapsable (capa 2)
- CTA de fijar objetivo
- Placeholder de historial
- Navegación con la pestaña Proyectos integrada junto a Objetivo

El wireframe usa la paleta de colores de Finnon (#5B8DFF primario, #4AEAB1 acento, fondo oscuro #1A1A1A) y tipografía DM Sans.

---

## 13. Preguntas abiertas para futuras iteraciones

1. **Proyectos completados:** ¿qué pasa cuando se alcanza el objetivo? ¿Se archiva? ¿Se celebra? (Oportunidad de gamificación)
2. **Proyectos individuales:** en esta versión todos son compartidos. ¿Se añaden proyectos personales dentro de una cuenta de pareja en el futuro?
3. **Reordenar prioridades:** ¿cómo se gestiona la UI de reordenación? ¿Drag and drop en la lista?
4. **Integración con rendimientos:** ¿los intereses de cuentas remuneradas pueden alimentar automáticamente un proyecto?
5. **Notificaciones entre usuarios:** ¿se notifica a ambos miembros de la pareja o solo al que gestiona?
