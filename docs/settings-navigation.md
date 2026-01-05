# Prompt de código — Finnon: navegación + Settings + Movimientos (Web/Mobile)

## Contexto (no debatir)
Queremos que Finnon se sienta “inevitable”: continuidad visual, jerarquía por espacio/tamaño y color solo para acción/estado. Evitar dramatismo (overlays, efectos decorativos) y mantener consistencia de copy y tokens. :contentReference[oaicite:0]{index=0} :contentReference[oaicite:1]{index=1} :contentReference[oaicite:2]{index=2}

## Objetivo
Alinear navegación y acceso a Settings entre web y móvil, y consolidar el filtro mensual dentro de “Movimientos”, manteniendo **Ingresos / Gastos / Balance** como elementos principales del **HeroSection**.

---

## Guardarraíles (importante)
1. **No inventar colores**: usar únicamente tokens existentes (semánticos) y no hardcodear hex. :contentReference[oaicite:3]{index=3}  
2. Jerarquía por **espacio, tipografía y layout**, no por color. :contentReference[oaicite:4]{index=4}  
3. Copy compartido: cualquier texto nuevo o modificado debe vivir en `packages/shared` (sin acoplar a librerías i18n).  
4. Cambios mínimos: tocar lo necesario para cumplir DoD, sin refactors “por gusto”.

---

## Tareas

### A) Web
#### A.1 Reemplazar “ruedacita” por “Ajustes”
- Donde exista el icono de settings (rueda) en el header/nav, sustituirlo por un **botón de texto**: `Ajustes`.
- Debe ser click/tap target generoso (accesible), y el estilo debe seguir la jerarquía sobria del header (sin CTA llamativo).
- Mantener el mismo destino de navegación que tenía el icono (ruta/pantalla de settings actual).

**DoD Web**
- No queda ningún icono “rueda” para Settings en web en el header/nav principal.
- “Ajustes” es el affordance principal para entrar a Settings.

---

### B) Mobile (Expo / React Native)
#### B.1 Centrar opciones en la Tab Navigation Bar
- Ajustar estilos del tab bar para que los items se perciban **centrados y equilibrados** visualmente.
- Evitar “huecos raros” por safe-area / labels / tamaños de icono.
- No introducir animaciones expresivas.

#### B.2 Eliminar Settings de la Tab Bar
- La Tab Bar **ya no debe** tener pestaña de Settings.
- Settings solo se accede desde Home (ver B.3).

#### B.3 Acceso a Settings desde Home
- Añadir un acceso claro a Settings desde Home (elige uno):
  - Opción preferida: botón “Ajustes” en la parte superior (header de Home) alineado a la derecha.
  - Alternativa: item de lista dentro de Home (“Ajustes”) con icono discreto.
- Mantener el copy “Ajustes” para consistencia con web.

#### B.4 “Transacciones” como **action** de la Tab Bar (icono apropiado)
- Convertir “Transacciones/Movimientos” en una acción principal en el tab bar.
- Elegir un icono que comunique “movimientos/actividad” (p.ej. lista, flechas, historial, “receipt”, “list”, “activity”), coherente con el set de iconos actual.
- Esta acción debe navegar a la lista principal de Movimientos.

#### B.5 `Transactions/index` sin Tab Bar + Top bar limpia
- La pantalla `Transactions/index` (o equivalente de Movimientos) debe mostrarse **sin Tab Navigation Bar** (pantalla enfocada).
- La barra superior (header/top bar):
  - Debe ser **customizable** (para meter acciones como filtro/mes).
  - Debe mostrar únicamente el **título humano** de la pantalla (ej. “Movimientos”), NO `transactions/index` ni rutas.
- Mantener navegación de vuelta (back) estándar y consistente.

> Nota técnica (esperada): si hoy `Transactions/index` vive dentro del layout de Tabs, moverla a un Stack fuera de Tabs o usar configuración que oculte tabBar en esa ruta. Evitar hacks frágiles.

#### B.6 Unificar “filtro por mes” dentro de Movimientos (alinear con web)
- Integrar el filtro mensual como parte de la sección principal de “Movimientos”, no como un widget suelto.
- **Alinear copy con web** (mismo wording y estructura).
- Los filtros deben ser un **botón tipo FAB** que al pulsar permita:
  1) ir al mes anterior
  2) ir al mes siguiente
  3) elegir un mes concreto (month picker)
- El FAB debe ser sobrio (sin colores chillones): usar tokens de acción/foreground existentes y respetar modo claro/oscuro. :contentReference[oaicite:5]{index=5}  
- La interacción debe sentirse continua (sin overlays dramáticos). :contentReference[oaicite:6]{index=6} :contentReference[oaicite:7]{index=7}

#### B.7 Mantener Ingresos / Gastos / Balance como HeroSection
- Confirmar que en Home (o donde aplique) los tres bloques **Ingresos, Gastos, Balance** siguen siendo el “primer golpe de vista” (HeroSection).
- No moverlos a tabs ni esconderlos por cambios de navegación.

**DoD Mobile**
- Tab bar centrada visualmente.
- No existe tab de Settings.
- Settings accesible desde Home con “Ajustes”.
- Tab bar incluye acción de “Movimientos/Transacciones” con icono apropiado.
- Pantalla Movimientos aparece sin tab bar y con header limpio (“Movimientos”).
- Filtro mensual unificado en Movimientos y accesible vía FAB (prev/next/picker).
- HeroSection mantiene Ingresos/Gastos/Balance como elementos principales.

---

## Requisitos de copy (shared)
- Todo texto nuevo o modificado (“Ajustes”, “Movimientos”, labels del filtro mensual, tooltips si existen) debe definirse en `packages/shared` como constantes (y/o mapa de strings por idioma si ya existe), **sin depender** de una librería i18n concreta.
- Mobile/Web deben consumir ese copy desde shared.

---

## Estilo / UI tokens
- Usar tokens de color semánticos existentes (background/text/action/state). Prohibido hardcodear colores. :contentReference[oaicite:8]{index=8}
- Mantener “diseño silencioso”: nada de gradientes decorativos ni elevaciones excesivas.
- Jerarquía por spacing y tipografía, no por color. :contentReference[oaicite:9]{index=9}

---

## Plan de pruebas (mínimo)
1. Mobile:
   - Entrar a la app → ver tab bar centrada.
   - Desde Home → entrar a Ajustes.
   - Pulsar acción Movimientos → abre pantalla Movimientos sin tab bar.
   - En Movimientos → FAB abre opciones (anterior/siguiente/mes concreto) y el listado se actualiza correctamente.
2. Web:
   - Header/nav muestra “Ajustes” (texto) y navega a Settings.
3. Dark/Light:
   - Contraste correcto y coherente con tokens.

---

## Entregables esperados
- PR con cambios web + mobile (y shared para copy).
- Sin regresiones de navegación.
- Sin estilos inline con hex/rgb: solo tokens.


# Prompt de código — Finnon: navegación + Settings + Movimientos (Web/Mobile) + Detalles de cuenta (Web)

## Contexto (no debatir)
Queremos una experiencia coherente entre web y móvil: jerarquía por espacio/tipografía, color solo para acción/estado, y copy compartido vía `packages/shared`.

## Objetivo
Alinear navegación y acceso a Settings entre web y móvil, consolidar el filtro mensual dentro de “Movimientos”, mantener **Ingresos / Gastos / Balance** como elementos principales del **HeroSection**, y añadir **detalles de la cuenta** en la versión web.

---

## Guardarraíles (importante)
1. No hardcodear colores (nada de hex/rgb): usar tokens semánticos existentes.
2. Jerarquía por spacing y tipografía, no por color.
3. Copy compartido: cualquier texto nuevo o modificado vive en `packages/shared` (sin acoplar a librerías i18n).
4. Cambios mínimos: tocar lo necesario para cumplir DoD.

---

## Tareas

### A) Web
#### A.1 Reemplazar “ruedacita” por “Ajustes”
- Sustituir el icono de settings (rueda) por un **botón de texto**: `Ajustes`.
- Mantener el mismo destino de navegación que tenía el icono.

**DoD**
- No queda ningún icono “rueda” para Settings en el header/nav principal.
- “Ajustes” navega a Settings.

#### A.2 Mostrar detalles de la cuenta (nuevo)
- Añadir una sección “Detalles de la cuenta” en web con información útil, sobria y escaneable.
- Ubicación recomendada:
  - Preferente: dentro de **Ajustes** (settings web), arriba del todo.
  - Alternativa: en **Home** como bloque secundario (no compite con el Hero).
- Contenido mínimo (si está disponible en el modelo actual):
  - Nombre de la cuenta (o display name)
  - ID de cuenta (formato corto/monospace, con botón “Copiar”)
  - Moneda base (si aplica)
  - Nº de participantes / miembros
  - Rol del usuario (owner/member) o un indicador equivalente
- Si algún dato no existe en backend/estado, mostrar solo lo disponible y evitar placeholders “vacíos”.
- Acciones permitidas:
  - Copiar ID
  - (Opcional) “Gestionar miembros” si ya existe pantalla/flujo; si no, no inventarlo.

**DoD**
- La sección se renderiza en web con datos reales cuando existen.
- No rompe layout responsive.
- No introduce dependencias nuevas innecesarias.

---

### B) Mobile (Expo / React Native)
#### B.1 Centrar opciones en la Tab Navigation Bar
- Ajustar estilos del tab bar para que los items se perciban centrados y equilibrados.

#### B.2 Eliminar Settings de la Tab Bar
- Quitar la pestaña Settings.

#### B.3 Acceso a Settings desde Home
- Añadir acceso claro a Settings desde Home:
  - Preferido: botón “Ajustes” en el header de Home (derecha).
  - Alternativa: item de lista dentro de Home.

#### B.4 “Transacciones” como action de la Tab Bar (icono apropiado)
- Hacer “Movimientos/Transacciones” una acción principal en la tab bar con un icono coherente (lista/actividad/recibo/historial).

#### B.5 `Transactions/index` sin Tab Bar + Top bar limpia
- `Transactions/index` (Movimientos) debe mostrarse **sin tab bar**.
- Header configurable y con título humano (“Movimientos”), no rutas.

#### B.6 Unificar “filtro por mes” dentro de Movimientos (alinear con web)
- Integrar el filtro mensual en la sección principal de Movimientos.
- Filtro como **FAB** que permite:
  1) mes anterior
  2) mes siguiente
  3) elegir mes concreto (month picker)
- Sin overlays dramáticos.

#### B.7 Mantener Ingresos / Gastos / Balance como HeroSection
- Confirmar que siguen siendo el primer bloque principal (no degradarlos por cambios de navegación).

---

## Requisitos de copy (shared)
- Todo texto nuevo/modificado (“Ajustes”, “Movimientos”, “Detalles de la cuenta”, “Copiar”, etc.) debe definirse en `packages/shared`.
- Web/Mobile consumen ese copy desde shared.

---

## Plan de pruebas (mínimo)
1. Web:
   - Header/nav muestra “Ajustes” y navega.
   - En Ajustes (o ubicación elegida) aparece “Detalles de la cuenta” con datos reales, y “Copiar ID” funciona.
2. Mobile:
   - Tab bar centrada.
   - No existe tab Settings.
   - Settings accesible desde Home.
   - Movimientos abre sin tab bar y el header es limpio.
   - FAB de mes permite anterior/siguiente/picker y actualiza listado.
3. Light/Dark:
   - Contraste correcto, sin hardcodes.

---

## Entregables esperados
- PR con cambios web + mobile + shared (copy).
- Sin regresiones de navegación.
- Sin colores hardcodeados.
