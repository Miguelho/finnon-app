Quiero que diseñes una evolución del modelo de dominio y del flujo UX de Finnon para soportar ahorro mensual visible, asignación durante el mes, cierre de mes, hucha y transferencias hucha → proyecto, sin convertir la app en una contabilidad completa ni romper el ritual emocional del cierre de mes.

Contexto funcional actual:

Finnon es una app de finanzas en pareja centrada en proyectos financieros compartidos.

El usuario registra transacciones manualmente.

El ahorro del mes se calcula como ingresos - gastos.

Al final de mes existe un ritual de cierre en el que el ahorro positivo se reparte entre proyectos y, si sobra, a la hucha.

La hucha hoy funciona como ahorro no dedicado a proyectos.

Los proyectos son el componente emocional del producto.

Las vistas agregadas de categorías y movimientos aportan el componente de realismo financiero.

Hoy no existe un ledger global fuerte de contenedores.

Hoy proyectos + hucha no está garantizado que coincida con el ahorro histórico acumulado.

Hoy el progreso de proyecto mezcla semánticas distintas: contribuciones mensuales y gastos etiquetados por transactions.project_id.

Problemas actuales a resolver:

El usuario no visualiza el ahorro desde el primer momento del mes; solo lo capitaliza de verdad en el cierre.

La hucha no puede transferirse a proyectos, lo que limita decisiones naturales del usuario.

El cierre de mes depende demasiado de que el usuario recuerde hacerlo.

El modelo actual mezcla:

flujo mensual real,

asignación de ahorro,

gasto vinculado a proyecto.

No quiero introducir todavía una contabilidad completa tipo ledger bancario general si no es estrictamente necesario.

No quiero perder el valor emocional del cierre de mes como ritual principal.

Objetivo de diseño:
Proponer un modelo mínimo pero sólido que permita:

mostrar el ahorro mensual acumulado en la home desde el primer momento,

permitir asignaciones durante el mes desde ese ahorro mensual a proyectos,

mantener el cierre de mes como momento de consolidación,

enviar sobrante a hucha en el cierre,

permitir transferencias explícitas de hucha a proyecto,

separar correctamente:

ahorro generado,

ahorro asignado,

gasto ejecutado del proyecto.

Principios que debes respetar:

Finnon no debe convertirse en una app contable compleja.

El sistema debe ser comprensible para el usuario medio.

El modelo debe favorecer la narrativa:
generamos ahorro → decidimos qué hacer con él → financiamos objetivos → entendemos por qué un mes fue mejor o peor.

El sistema debe tolerar asignaciones “planeadas” durante el mes y reconciliarlas al cierre.

Si el usuario sobreasigna durante el mes y luego el ahorro final real es menor, el cierre debe obligar a ajustar, no ocultar la incoherencia.

La hucha debe tratarse como contenedor de ahorro genérico, no exactamente igual que un proyecto, aunque internamente pueda reutilizar parte de la estructura.

Los gastos con project_id no deben confundirse automáticamente con aportaciones o progreso reservado del proyecto.

Quiero que me entregues:

Modelo de dominio propuesto

entidades

relaciones

significado de cada entidad

qué representa cada una en términos de negocio

Diseño de persistencia

tablas nuevas y cambios sobre las existentes

campos mínimos recomendados

constraints o invariantes importantes

qué se deriva por cálculo y qué se persiste

Reglas de negocio

cómo se calcula el ahorro mensual

cómo se calcula el “pendiente de asignar”

cómo funcionan las asignaciones durante el mes

cómo funciona el cierre de mes

qué pasa si hay sobreasignación

cómo funciona la transferencia hucha → proyecto

cómo se calcula el progreso del proyecto

cómo se muestran por separado “reservado para el proyecto” y “gastado en el proyecto”

Flujo UX

cambios en la home

diseño conceptual del módulo “ahorro del mes”

CTA para asignar durante el mes

CTA para cierre de mes

flujo de cierre con escenarios normales y de sobreasignación

flujo para mover dinero de hucha a proyecto

cómo preservar el ritual emocional del cierre

Plan de migración incremental

qué se puede introducir primero sin romper la app

cómo convivir temporalmente con el modelo actual

qué deuda técnica aceptarías en una primera fase

qué partes dejarías para una segunda fase

Riesgos y decisiones abiertas

zonas ambiguas del modelo

trade-offs entre simplicidad y rigor

puntos donde habría que decidir producto antes de implementar

Quiero que seas crítico con el modelo actual y no asumas invariantes que hoy no existen.
Si consideras que hace falta introducir un mini-ledger de asignaciones internas, propón el diseño mínimo posible, no una solución sobredimensionada.
No quiero código todavía. Quiero diseño de dominio, reglas y arquitectura funcional.