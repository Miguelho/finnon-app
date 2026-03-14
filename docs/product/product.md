# Producto Finnon

## Propósito

Este documento reúne la referencia canónica de producto para Finnon.
Su objetivo es alinear producto, diseño, copy y desarrollo en torno a:

- la narrativa principal del producto;
- los principios del modelo;
- el vocabulario oficial que debe usarse en interfaz y documentación.

## Visión

Finnon es una app de finanzas compartidas centrada en proyectos financieros.

La narrativa oficial del producto es:

`generamos ahorro -> decidimos su destino -> financiamos objetivos -> entendemos cómo va el mes`

Finnon no quiere comportarse como una contabilidad completa ni como un ledger bancario generalista.
El producto debe seguir siendo comprensible para una persona media y preservar el componente emocional del cierre de mes.

## Contexto funcional

- El usuario registra transacciones manualmente.
- El ahorro del mes se calcula como ingresos menos gastos.
- El cierre de mes consolida el ahorro positivo.
- Ese ahorro puede repartirse entre proyectos y, si sobra, ir a Hucha.
- Hucha funciona como ahorro no dedicado todavía a un proyecto concreto.
- Los proyectos son el elemento emocional y motivacional del producto.
- Las vistas de movimientos y categorías aportan el contexto financiero real.

## Principios de producto

- Finnon no es una contabilidad completa.
- Los términos de producto deben describir negocio, no decisiones técnicas heredadas.
- El usuario debe poder entender el sistema como una secuencia simple:
  ahorro generado, destino del ahorro, financiación de objetivos y ejecución de gasto.
- El cierre de mes sigue siendo el ritual principal de consolidación.
- El producto debe separar con claridad:
  ahorro generado,
  ahorro asignado,
  gasto ejecutado,
  reparto entre miembros.

## Glosario canónico

### 1. Ahorro del mes

Definición:
Ingresos del mes menos gastos del mes.

Qué representa:
La capacidad real generada por la cuenta en un periodo mensual.

Regla:
Es una métrica calculada, no un contenedor.

Copy recomendado:
`Ahorro del mes`

No usar como sinónimo de:
`Hucha`, `Proyecto`, `saldo total`, `patrimonio neto`

### 2. Ahorro sin asignar

Definición:
Parte del ahorro del mes que todavía no tiene destino dentro del flujo de ahorro.

Qué representa:
Lo que aún puede mandarse a proyectos o quedar pendiente hasta el cierre.

Regla:
Es una derivada del ahorro del mes y de las asignaciones vigentes.

Copy recomendado:
`Ahorro sin asignar`

### 3. Proyectos

Definición:
Objetivos financieros compartidos a los que se quiere destinar ahorro.

Qué representan:
Buckets virtuales de ahorro con propósito, prioridad y objetivo.

Regla:
Un proyecto no es una cuenta bancaria ni un saldo líquido independiente.

Copy recomendado:
`Proyectos`

Opcional en contexto explicativo:
`Objetivos de ahorro`

### 4. Financiación de proyecto

Definición:
Ahorro ya asignado o consolidado a un proyecto.

Qué representa:
La parte del ahorro que realmente pasa a financiar ese objetivo.

Regla:
En producto, este concepto sustituye a usos ambiguos de `contribución`.

Copy recomendado:
`Financiado`
`Financiación`
`Asignado al proyecto`

No usar:
`Contribución al proyecto`, salvo en contexto técnico legado

### 5. Hucha

Definición:
Reserva general de ahorro no dedicado todavía a un proyecto específico.

Qué representa:
Excedente acumulado disponible para conservar o transferir a proyectos.

Regla:
La Hucha es un contenedor de ahorro genérico.
No equivale a patrimonio neto.

Copy recomendado:
`Hucha`

Opcional en contexto explicativo:
`Reserva general`

### 6. Transferencia de Hucha a proyecto

Definición:
Movimiento explícito de ahorro acumulado en Hucha hacia un proyecto.

Qué representa:
Una decisión consciente de reutilizar ahorro no dedicado.

Copy recomendado:
`Mover desde Hucha`
`Transferir a proyecto`

### 7. Gasto asociado a proyecto

Definición:
Gasto etiquetado con un proyecto para reflejar ejecución o consumo relacionado con ese objetivo.

Qué representa:
Realidad de gasto vinculada al proyecto, no financiación del proyecto.

Regla:
No debe confundirse con ahorro asignado ni con progreso reservado.

Copy recomendado:
`Gasto asociado`
`Gastos del proyecto`

No usar:
`Aportación extra`

### 8. Balance entre miembros

Definición:
Resumen de quién pagó más o menos de lo que le correspondía dentro de la cuenta compartida.

Qué representa:
Equilibrio interno entre personas, no progreso de ahorro.

Regla:
Es un concepto de reparto entre miembros.
No debe llamarse `contribuciones` en copy de producto.

Copy recomendado:
`Balance entre miembros`

### 9. Movimientos recurrentes

Definición:
Series previstas de ingresos o gastos que se repiten en el tiempo.

Qué representan:
Actividad periódica esperada.

Regla:
`Recurrente` no significa necesariamente `gasto fijo`.

Copy recomendado:
`Movimientos recurrentes`

Si se necesita una subcategoría:
`Gastos fijos` = recurrentes de tipo gasto

## Términos prohibidos o restringidos

- `Contribuciones`
  Motivo: mezcla reparto entre miembros, financiación de proyectos y gasto asociado.
- `Patrimonio neto` para referirse a Hucha
  Motivo: es un concepto financiero más amplio que Finnon no modela hoy.
- `Aportaciones extra` para gastos de proyecto
  Motivo: sugiere financiación cuando en realidad se habla de gasto ejecutado.

## Reglas de naming

- Si el concepto habla de personas, usar `miembros`.
- Si el concepto habla del destino del ahorro, usar `proyecto`, `Hucha` o `sin asignar`.
- Si el concepto habla de ejecución real, usar `gasto`.
- Si el concepto habla de cálculo mensual, usar `ahorro del mes`.
- Si el término genera duda entre reparto, financiación y gasto, debe cambiarse.

## Resumen operativo

La secuencia oficial del producto es:

`Ahorro del mes -> Ahorro sin asignar -> Proyectos y/o Hucha -> Gasto asociado -> Balance entre miembros`

Si una pantalla, una variable de view model o un texto visible no encaja con esa secuencia, el naming debe revisarse.

## Relación con la documentación anterior

- `docs/product.md` puede mantenerse como documento histórico de exploración y diseño.
- Este archivo es la referencia canónica para lenguaje de producto.
