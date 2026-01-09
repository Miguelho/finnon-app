# Finnon — UX & Marketing Plan (v1)

Este documento define los principios de **experiencia de usuario (UX)** y **posicionamiento de producto** de Finnon.  
No describe funcionalidades técnicas ni decisiones de arquitectura: su función es **guiar decisiones de diseño, copy y priorización** para que el producto mantenga coherencia y foco.

---

## 1. Propósito del producto

Finnon existe para reducir fricción mental alrededor del dinero compartido.

El objetivo principal no es analizar el pasado, sino **entender el mes en curso**:
- qué dinero está comprometido
- cuándo ocurre
- con quién se comparte la responsabilidad

Si una decisión de UX, copy o feature no ayuda a entender mejor el mes actual, se considera secundaria.

---

## 2. Posicionamiento

### Qué es Finnon
Un gestor de finanzas personales centrado en **obligaciones mensuales compartidas**, diseñado para ofrecer claridad inmediata.

### Qué no es
- No es una app de inversión
- No es una app de presupuestos complejos
- No es una herramienta de análisis financiero avanzado
- No es una hoja de cálculo camuflada

### Promesa central
> Ver de un vistazo qué te obliga este mes, en tiempo y dinero.

---

## 3. Principios UX (reglas no negociables)

### 3.1 Claridad antes que exhaustividad
- Mostrar menos información bien contextualizada es preferible a mostrarlo todo.
- Evitar dashboards densos o gráficos sin impacto directo en la toma de decisiones.

### 3.2 Tiempo y dinero son inseparables
- Cada gasto u obligación debe tener:
  - referencia temporal clara
  - impacto monetario visible
- Listas de gastos sin contexto temporal pierden valor.

### 3.3 Compartir es un caso normal
- Compartir cuentas no es una funcionalidad avanzada.
- El lenguaje evita términos técnicos (“usuarios”, “permisos”) y prioriza conceptos humanos (“compartir”, “ver lo mismo”).

### 3.4 Diseño silencioso
- Los colores solo se usan para estados relevantes.
- Nada debe competir innecesariamente por atención.
- La interfaz no debe sentirse protagonista.

---

## 4. Flujos UX clave

### 4.1 Primer uso (onboarding)

**Objetivo:** demostrar valor antes de explicar.

Flujo mínimo recomendado:
1. Crear cuenta
2. Elegir moneda base
3. Añadir 2–3 obligaciones típicas del mes
4. Mostrar la vista mensual ya funcional

El usuario debe entender la utilidad de Finnon en menos de un minuto.

---

### 4.2 Vista principal (core view)

La vista principal debe responder en segundos:
- Cuánto dinero está comprometido este mes
- Cuál es la próxima obligación relevante
- Qué parte ya está pagada y qué parte está pendiente

Esta vista es:
- la pantalla principal de la app
- la base de las capturas de la store
- la referencia visual de la landing

Si esta vista falla, el producto falla.

---

### 4.3 Compartir cuenta

El acto de compartir se presenta como algo natural, no como configuración avanzada.

Ejemplo de tono:
> Compartir esta cuenta hace que todos veamos lo mismo.

El objetivo es reducir fricción y evitar discusiones causadas por falta de visibilidad.

---

## 5. Lenguaje y tono

### Características del tono
- Sobrio
- Directo
- Tranquilizador
- Sin urgencia artificial ni promesas exageradas

### Evitar explícitamente
- “Optimiza”
- “Maximiza”
- “Control total”
- “IA”
- “Productividad financiera”

### Ejemplos de microcopy
- Estado vacío:
  > Aún no hay obligaciones este mes.
- Mes sin pendientes:
  > Este mes está bajo control.
- Compartir cuenta:
  > Invita a alguien que también viva este mes contigo.

---

## 6. Mensaje externo (marketing)

### Mensaje principal (landing / store)

**Headline**
> Tus obligaciones del mes, claras y compartidas.

**Subheadline**
> Un gestor de finanzas pensado para ver, no para pelearte con números.

### Beneficios (máximo tres)
- Entiendes lo que realmente importa este mes
- Compartes la información sin fricción
- Evitas discusiones causadas por falta de visibilidad

---

## 7. Crecimiento natural

El crecimiento de Finnon está integrado en su uso normal:

1. Un usuario crea una cuenta
2. Añade obligaciones reales
3. Comparte la cuenta con otra persona
4. El invitado entra porque lo necesita
5. Ambos siguen usando Finnon

No se fuerza un sistema de referidos en v1.  
Compartir ya es marketing.

---

## 8. Métricas de validación temprana

En la fase inicial, solo importan estas métricas:

- Porcentaje de usuarios que:
  - crean una cuenta
  - añaden al menos dos obligaciones
  - comparten la cuenta

Si estas acciones no ocurren, el problema es de UX o mensaje, no de tecnología.

---

## 9. Relación con la arquitectura técnica

Este documento:
- no define nuevas funcionalidades
- no contradice decisiones técnicas
- actúa como filtro de prioridades

Cualquier feature que complique la claridad mensual debe posponerse.

---

## 10. Estado del documento

Este documento es vivo.  
Debe revisarse cuando:
- se añadan nuevas funcionalidades core
- se introduzca monetización
- se detecte fricción sistemática en usuarios reales

