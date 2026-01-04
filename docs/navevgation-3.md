Continuación Mobile (Navegación + Header + Participants)
Contexto

Estamos continuando la aplicación móvil (React Native / Expo) y debemos mantener el patrón de navegación definido:

Móvil: barra inferior de tabs con Home / Account / Settings, sin tab de “Añadir”.

Estilo “lean”: nada de colorines, jerarquía por espacio/tipografía, y usar tokens semánticos (no hex). 

navegation


Además, queremos reforzar marca “Finnon” y completar la funcionalidad de invitar usuarios registrados (participants).

Objetivo

Implementar iconos correctos en la tab bar (Home/Account/Settings) siguiendo el patrón actual.

Crear presets reutilizables para evitar overflow / colisión en la barra superior (header).

Completar el Participants endpoint para invitar usuarios registrados (no solo “invitados desconocidos”).

Añadir icono + Finnon en la pantalla Home (marca visible y consistente).

Alcance (tareas)
1) Iconos en Navigation Tabs (Mobile)

Requisito

Tabs: Home, Account, Settings.

Iconografía (puedes elegir la librería concreta, pero respeta el concepto):

Home: casita

Account: dos siluetas/personas

Settings: rueda/gear

Debe ser accesible:

accessibilityLabel por tab

estados activo/inactivo claros sin depender solo del color

Estilo

Tab activa con sombreado gris sutil (token de fondo secundario), sin usar color “action/accent”. 

navegation

No añadir tab de “Añadir” (ya existe FAB / entry-point en otro lugar si aplica). 

navegation

Arquitectura

Centraliza keys/labels/orden en shared si existe el patrón (config agnóstica del router). 

navegation

Los copies “Home / Account / Settings” deben salir de la fuente compartida si ya existe (sin duplicar strings). 

navegation

2) Presets para evitar overflow en barra superior (Header)

Problema

Algunos títulos / elementos del header pueden “reventar” por longitud o por colisión con botones left/right (overflow).

Solución requerida

Crear un módulo reutilizable tipo navigationPresets / screenOptionsPresets para Stack/Tabs que:

Establezca reglas de layout del header para evitar colisiones.

Trunque correctamente títulos largos (ellipsis).

Mantenga consistencia visual (tipografía/espaciado/tokens).

Criterios técnicos (orientativos, no dogmáticos)

Implementar un HeaderTitle propio (componente) con:

numberOfLines={1}, ellipsizeMode="tail",

ancho máximo razonable (ej: basado en useWindowDimensions() o estilos flex del contenedor).

Ajustar headerTitleContainerStyle para que el título no invada left/right.

Evitar “soluciones por pantalla”: tiene que ser un preset reutilizable.

Guardarraíl

No rediseñar navegación: solo resolver overflow manteniendo el look&feel actual.

3) Participants endpoint — Invitar usuarios registrados

Situación actual

Existe funcionalidad para “invitados desconocidos” (probablemente por email/nombre sin usuario real), pero falta el flujo para invitar a usuarios ya registrados.

Objetivo funcional

Permitir invitar a un usuario registrado a una cuenta (account) mediante un identificador razonable (normalmente email).

Debe convivir con el flujo actual de invitados “unknown”, sin romperlo.

Requisitos

Añadir/terminar el endpoint o use-case de “participants” para:

Buscar o resolver un usuario registrado (por ejemplo email -> user_id/profile_id según modelo actual).

Crear la invitación / relación con el account (participant/invite).

Manejar casos:

El usuario existe, ya está en la cuenta → no duplicar, devolver estado claro.

El usuario existe, invitación pendiente → no duplicar, devolver estado.

El usuario no existe → seguir permitiendo “unknown guest” si ese flujo está permitido, o devolver error claro si este endpoint es “solo registrados” (elige uno y documenta).

Respetar RLS/policies existentes: no abrir agujeros por “resolver emails”.

Entrega esperada

Lógica de negocio en shared si aplica (agnóstica de UI).

UI/flow móvil:

En el punto donde hoy se invita “unknown”, añadir opción clara para invitar usuario registrado (si ya existe ese modal/flow).

Mensajes de error/éxito usando copies compartidos (si ya está el sistema). 

navegation

4) Añadir icono + “Finnon” en Home (Mobile)

Requisito

En la pantalla Home, mostrar marca “Finnon” + un icono/logo.

Si no existe logo real, usar placeholder sobrio (p.ej. cuadrado simple o icono minimal).

Integración visual:

Sin marcos, sin sombras fuertes.

Alineado con el patrón general y tokens.

Dónde

Preferencia: integrar en el header de Home si el patrón lo permite (consistente con web).

Alternativa válida: bloque superior dentro del contenido de Home, siempre que no rompa jerarquía ni cree duplicación visual.

Definition of Done (DoD)

Tabs Mobile:

Home/Account/Settings con iconos adecuados (casa, dos personas, rueda).

Tab activa con sombreado gris usando tokens, sin colores hardcodeados. 

navegation

Header presets:

Existe un preset reutilizable aplicado a las pantallas principales.

Títulos largos no desbordan ni colisionan; se truncan con ellipsis.

Participants (registrados):

Se puede invitar a un usuario registrado (por email o identificador definido por el modelo actual).

Manejo correcto de duplicados/invitación pendiente/no existe.

No rompe el flujo actual de invitados desconocidos.

Home branding:

En Home aparece “Finnon” + icono/logo placeholder, integrado y sobrio.

Guardarraíles

Cambios mínimos: no re-arquitecturar navegación completa. 

navegation

No meter hex ni estilos “a ojo”: usar tokens semánticos.

No duplicar strings: usar shared para copies/config cuando exista el patrón. 

navegation

No añadir una tab “Añadir” (ya está fuera del patrón). 

navegation

Mantener consistencia con el enfoque de marca “Finnon” ya pedido en web (logo placeholder + texto). 

navegation-2

Notas de implementación (para guiarte, no obligatorio)

Antes de tocar nada: localizar dónde viven hoy:

definición de Tabs,

screenOptions de Stack/Router,

lógica de participants/invites (backend + shared + UI).

Prioriza reutilización: extrae lo mínimo (preset + HeaderTitle + config nav).