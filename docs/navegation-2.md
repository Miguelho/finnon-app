# Prompt para agente de código — Header Finnon + Layout uniforme + Limpieza Transactions (Web)

## Contexto
Estoy ajustando la **navegación y consistencia visual** de la aplicación web.  
Ahora mismo hay inconsistencias entre páginas (ancho del contenido variable) y la pantalla de **Transactions** tiene elementos duplicados o fuera de patrón.

Quiero que el comportamiento sea **uniforme** y siga la disposición (layout) que ya tiene **Transactions**, pero sin botones redundantes.

---

## Objetivo
1. Mejorar el **header web** para que muestre marca (logo + “Finnon”) y navegue a `/`.
2. Hacer que **todas las páginas principales** (Home, Settings, Transactions) usen un **layout de contenido uniforme**, equivalente al de Transactions.
3. Limpiar la pantalla de **Transactions** eliminando botones que sobran y alineando el CTA con el patrón de Home (`/`).

---

## Requisitos funcionales (Web)

### 1) Header: marca + navegación a Home
- En el **header web**, añadir un bloque de marca a la **izquierda del todo**:
  - **Logo placeholder**: un **cuadrado negro** (hasta que exista logo real).
  - **Texto**: “Finnon”.
- Al hacer click en el bloque (logo o texto), debe navegar a la ruta `/`.
- Debe ser accesible:
  - Elemento clicable con `aria-label` tipo “Ir a inicio” o similar.
  - Área clicable razonable (no solo el texto).

**Guardarraíl:** No rediseñar el header entero: solo añadir la marca a la izquierda y mantener el resto de elementos existentes (ej. cuenta activa, settings) como están, salvo que haya colisiones de layout.

---

### 2) Layout uniforme de ancho de contenido (Home / Settings / Transactions)
**Problema actual:** el contenido cambia de ancho según la página (percepción de “2/3”, “1/3”, “4/5”).  
**Objetivo real:** conseguir que **todas** las páginas principales se vean con el **mismo ancho y estructura base** que la pantalla de **Transactions**.

#### Requisito
- Definir un **layout base compartido** (ej. `PageContainer`, `ContentLayout`, `AppShell`, etc.) que:
  - Controle **max-width**, **padding horizontal**, **centrado** y **disposición general**.
  - Sea reutilizable por Home, Settings y Transactions.
- Migrar Home y Settings para que usen ese layout, de forma que:
  - Su **ancho y alineación** coincidan con Transactions.
  - Se eliminen reglas ad-hoc (wrappers o containers específicos) que estrechen o cambien el ancho del contenido.

#### Cómo validar (sin números mágicos)
- No usar “1/3”, “2/3”, “4/5” hardcodeados.
- La validación es visual/estructural:
  - Misma “columna” central y mismos márgenes/padding que Transactions.
  - Si Transactions usa una grid/columna concreta, reutilizar esa misma base.

**Guardarraíl:** Cambios mínimos. Si Transactions ya tiene un contenedor “correcto”, extraerlo a un componente compartido y aplicar el mismo patrón en Home/Settings.

---

### 3) Transactions: eliminar “Back to Dashboard”
- En la pantalla de Transactions, eliminar el botón **“Back to Dashboard”**.
- La navegación de vuelta debe depender del header/top nav (o la navegación global), no de un CTA dentro de la página.

---

### 4) Transactions: eliminar “New Transaction” y usar el mismo botón que en `/`
- En Transactions, eliminar el botón **“New Transaction”** existente.
- Crear/usar exactamente el **mismo botón/CTA** que hay en la Home (`/`):
  - Reutilizar el **mismo componente** (no duplicar).
  - Reutilizar la misma lógica de negocio (handlers, navegación, apertura de modal/drawer, etc.).
  - Misma ubicación/estilo/behavior que en Home, adaptado al layout de Transactions si hace falta, pero sin inventar un nuevo patrón.

**Nota:** Si en Home el botón es un FAB (abajo a la derecha), entonces:
- En Transactions debe quedar el **mismo FAB**, no un botón distinto dentro del header del contenido.
- Si ya existe un componente `AddTransactionButton` / `FloatingAddButton` / etc., reutilizarlo.

---

## Definition of Done (DoD)
1. Header web muestra, a la izquierda del todo:
   - Cuadrado negro (placeholder de logo) + texto “Finnon”.
   - Click lleva a `/`.
2. Home, Settings y Transactions comparten el **mismo layout base** y se ven con **ancho consistente**, equivalente a Transactions.
3. En Transactions:
   - No existe el botón “Back to Dashboard”.
   - No existe el botón “New Transaction” antiguo.
   - Se muestra el **mismo** botón de añadir transacción que en `/`, reutilizando componente y lógica.
4. Sin regresiones:
   - Rutas intactas.
   - Navegación global sigue funcionando.
   - No se introducen estilos hardcodeados fuera del sistema de estilos/tokens.

---

## Guardarraíles
- No meter rediseños: solo consistencia y limpieza.
- No introducir valores “a ojo” (1/3, 2/3, 4/5). La solución debe basarse en un layout compartido.
- Reutilizar componentes existentes antes de crear nuevos.
- Evitar duplicación de lógica (especialmente el CTA de “New Transaction”).
