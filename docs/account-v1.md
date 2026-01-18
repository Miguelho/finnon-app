Prompt — Pantalla “Cuenta”: Hero + Info + Participantes como avatares + Panels (Web/Mobile)
Contexto

Estamos en Finnon. La pantalla Cuenta debe sentirse como una “herramienta doméstica”: clara, estable y sin dramatismos visuales. Evitar overlays oscuros/translúcidos; la continuidad visual es prioritaria. La jerarquía se construye con espacio y tipografía, no con color. 

Objetivo

Eliminar la sección “Participantes” como bloque (ocupa espacio de valor).

Diseñar e implementar una Hero Section útil y atractiva.

Replantear la sección superior (ahora muestra “Admin”, id parcial, “EUR - Moneda base”, etc.) para que:

La info “técnica” quede accesible desde un botón Info (icono “i” en círculo) que abre un tooltip (sin overlay dramático).

Los participantes se muestren como avatares en línea justo después del nombre de la cuenta.

Al hacer click/tap en un avatar, se abre su detalle:

Mobile: panel deslizante desde abajo (bottom sheet).

Web: panel desde la derecha (side panel).

Reglas de diseño (NO negociar)

Sin overlays dramáticos (sin fondo oscurecido/blur “cinemático”). Si hace falta tap-blocking, usar lo mínimo y coherente con Finnon, pero preferir sin overlay. 

Animaciones sutiles, sin rebotes. 

Colores: usar tokens (nunca hex directo). 

UX / UI Spec
A) Nueva Hero Section (Cuenta)

Estructura (arriba de todo):

Fila 1:

Nombre de la cuenta (centrado si encaja con el patrón existente de la app; si no, alineación estándar pero con jerarquía clara).

A la derecha del nombre: botón Info (icono i dentro de un círculo, tamaño pequeño, tactil/clickable).

Fila 2:

Avatares de participantes en línea (máximo 5 visibles).

Si hay más: último avatar como “+N”.

Fila 3 (opcional, si aporta valor real):

Micro-resumen “del mes” (ej: balance / ingresos / gastos) SOLO si ya existe esa info en la pantalla de cuenta o es barata de calcular. Si no existe, dejarlo fuera (no inventar features).

Eliminar por completo el bloque antiguo de “Participantes” (lista/section).

B) Botón Info (tooltip)

Al pulsar el botón Info:

Abrir un tooltip/popover anclado al botón (web) o un popover ligero (mobile).

Contenido (mínimo, escaneable):

Rol del usuario en la cuenta (ej: “Tu rol: Admin”)

Moneda base (ej: “Moneda base: EUR”)

ID corto de la cuenta (ej: “ID: 9f12a3”)

(Opcional) Fecha de creación si ya está disponible sin query extra cara.

El tooltip no debe parecer modal. Evitar capa oscura. Cerrar al:

click fuera (web),

tap fuera/back (mobile),

o botón “Cerrar” sutil si hace falta accesibilidad.

C) Avatares (fila de participantes)

Renderizar participantes como avatares compactos:

Avatar con inicial + color de fondo consistente (si ya existe tu lógica, reutilizarla).

Tappable/clickable → abre el panel de detalle.

Si hay +N:

Tap/click abre un panel “Participantes” (lista completa), usando el mismo patrón de panel (bottom sheet / side panel).

D) Panel de detalle de participante

Mobile (bottom sheet):

Panel desde abajo, altura adaptativa.

Sin overlay dramático; si el componente que uses añade overlay por defecto, configurarlo a la opción más sobria posible (o casi transparente) manteniendo la continuidad. 

Contenido:

Avatar grande + nombre/email

Rol en la cuenta

Acciones (si existen en producto): ej “Cambiar rol” / “Eliminar” SOLO si ya está contemplado; si no, read-only.

Web (side panel right):

Panel desde la derecha, ancho contenido (no dominar pantalla). 

Misma información y componentes que en mobile.

Implementación (técnica)
1) Componentes a crear/reutilizar

AccountHero

Props: account, currentUserRole, members[], onOpenInfo(), onOpenMember(memberId).

InfoPopover / AccountInfoTooltip

Debe funcionar en web y mobile (si hay wrappers distintos, mantener API común).

MemberAvatarsRow

Soporta maxVisible, +N.

MemberDetailPanel

Implementación adaptativa:

MobileMemberBottomSheet

WebMemberSidePanel

API común: open(memberId), close(), isOpen, member.

2) Datos

Reutilizar las queries actuales de cuenta y miembros (no crear endpoints nuevos si no hace falta).

Minimizar re-renders:

Memoizar lista de miembros.

Evitar recalcular colores/iniciales en cada render (cache).

3) Accesibilidad

Botón Info:

aria-label="Información de la cuenta" (web).

Avatares:

foco accesible (web),

hit area mínima en mobile.

Panel:

cierre visible (X sutil) + gesto/back.

4) Estilos / tokens

Fondo: color.bg.primary / color.bg.surface

Texto: color.text.primary / color.text.secondary

Divisores: color.state.neutral

Acción primaria (si hubiera CTA): color.action.primary

No usar hex directo. 


5) Animaciones

Transiciones cortas, suaves, sin bounce. 



Panel:

web: slide-in right

mobile: slide-up

Tooltip: fade/scale mínimo.

Criterios de aceptación (DoD)

 La pantalla Cuenta ya no muestra una sección “Participantes” como bloque.

 La parte superior es una Hero Section con:

 Nombre de cuenta + botón Info

 Fila de avatares

 Botón Info abre un tooltip con: rol, moneda base, id corto (y opcional fecha creación si ya existe).

 Click/tap en avatar abre:

 Mobile: bottom sheet

 Web: side panel right

 Sin overlays dramáticos; si existe overlay, es mínimo y no “secuentra” la pantalla. 

 Colores solo con tokens semánticos. 

 Animaciones sutiles, sin rebotes. 

 No introduce nuevas features de negocio (solo reorganización UI + paneles).

Notas de implementación (para el agente)

Si ya hay un patrón de “panel lateral” (web) y “bottom sheet” (mobile) usado en “Add transaction” u otras pantallas, reutilizar ese patrón exacto para mantener consistencia.

Si el tooltip/popover no existe cross-platform:

web: Radix Popover (si ya lo usáis)

mobile: popover ligero anclado o un mini-sheet (pero NO modal tradicional).

Priorizar que el “Info” y el detalle de miembros se sientan parte del mismo plano visual (continuidad). 

