Prompt para agente de código — Mobile: Avatar en NavBar + Drawer de Ajustes (reemplaza pantalla Configuración)
Contexto

App móvil Finnon (Expo / React Native). Queremos que toda la app muestre un avatar del usuario en la barra superior y que al pulsarlo se abra un panel deslizable desde la izquierda (drawer) con las opciones de Ajustes. La pantalla “Configuración” deja de existir como pantalla separada: su contenido pasa a ser el drawer.

Objetivo

Añadir avatar del usuario como acción principal en la barra superior global (header).

Implementar drawer lateral izquierdo (panel deslizante) con el contenido de Ajustes.

Eliminar/reemplazar la navegación a “Configuración” como pantalla: ahora se accede solo por el drawer.

Mantener estética Finnon: sin overlay dramático, animación sutil, jerarquía por espacio, no por color 



 



.

Alcance
Entra

Drawer left accesible desde cualquier pantalla principal (tabs/stack).

Header con avatar (botón) alineado a la izquierda.

Contenido de Ajustes migrado al drawer:

Perfil (email + avatar)

Cuenta activa / selector de cuenta (si aplica)

Preferencias (moneda/idioma si existen)

Acceso a acciones tipo “Cerrar sesión”

Links internos que ya existan (legal, about, etc.)

Fuera

Cambios de backend.

Rework grande del diseño de Ajustes (solo migración + adaptación).

Gestos “ocultos” complejos: el drawer se abre por tap en avatar y opcional swipe desde borde (si es trivial y no rompe UX).

Requisitos UX/UI (no negociables)

Sin overlay oscuro sobre el contenido principal (preferencia explícita). Si la librería mete overlay por defecto, desactivarlo o dejarlo imperceptible (alpha mínimo) 



 



.

Drawer debe sentirse como “extensión” del plano, no modal.

Animación: corta, suave, sin rebotes 



.

Ancho: contenido, aprox 78–84% del viewport (no full screen).

Colores: usar tokens semánticos (background/text/dividers), nunca valores directos 



.

Implementación técnica
1) Navegación: introducir Drawer como raíz

Si usas expo-router:

Crear/ajustar un layout raíz que envuelva el stack/tabs en un Drawer Navigator (React Navigation Drawer).

El drawer será solo para Ajustes (un único drawer screen o un contenido custom).

Recomendación: Drawer con drawerContent custom para renderizar la UI de Ajustes (más control, menos “pantalla”).

drawerType: “front” o “slide” (elige el que mejor evite overlays y se sienta natural).

overlayColor: transparente o casi transparente (según permita la lib).

2) Header global con avatar

En el navigator principal (Stack/Tabs), añadir headerLeft con botón de avatar.

Al pulsar:

navigation.openDrawer()

Avatar

Si existe avatar real, usarlo.

Si no existe:

Mostrar círculo con letra inicial (primera letra del email, uppercase).

Fondo con token de action/secondary o surface según tema (sin inventar colores) 



.

Tamaño recomendado: 28–32 px, hitSlop generoso.

3) Migración del contenido de Configuración al drawer

Si existe pantalla Settings:

Reutilizar sus componentes internos (listas/secciones) dentro del drawerContent.

Eliminar la ruta/pantalla de navegación “Settings” de tabs/stack (o dejarla inaccesible).

Actualizar cualquier link/botón “Ir a Configuración” para abrir drawer en su lugar.

4) Estructura UI del drawer (mínimo)

Header del drawer:

Avatar + email

(opcional) nombre si existe

Secciones en lista, estilo “tile” sobrio, separadores con color.state.neutral (o equivalente) 



.

Elementos:

“Cuenta”

“Categorías” (si esto ya existe como sección)

“Preferencias”

“Cerrar sesión” (acción destructiva visualmente contenida; sin rojo chillón)

Cierre:

Swipe para cerrar + botón discreto (X) opcional arriba a la derecha dentro del drawer (no agresivo).

5) Estado y datos

Fuente de datos:

user desde tu store/context actual (Supabase session, etc.).

activeAccount desde el selector que ya uses.

Asegurar que el drawer reacciona a:

cambio de cuenta activa

cambio de sesión (logout → vuelve al login)

Detalles de estilos (tokens)

Fondo drawer: color.bg.surface

Fondo app: color.bg.primary

Texto: color.text.primary / color.text.secondary

Separadores: color.state.neutral

Estados activos (si hay selección): color.action.secondary

No usar overlays decorativos ni transparencias “estéticas” 



 



.

Archivos esperados (orientativo)

apps/mobile/app/_layout.tsx (o el layout raíz equivalente): envolver con Drawer

apps/mobile/components/navigation/AppHeaderAvatar.tsx

apps/mobile/components/settings/SettingsDrawerContent.tsx (nuevo)

Ajustes en tabs/stack actuales para:

quitar “Settings” de rutas visibles

añadir headerLeft

Criterios de aceptación

En cualquier pantalla principal, se ve el avatar en el header.

Tap en avatar abre drawer desde la izquierda.

Drawer contiene las opciones de Ajustes (las que antes estaban en Configuración).

No existe navegación “normal” a una pantalla de Configuración (tabs/menú/ruta).

No hay overlay oscuro dramático; la transición es sobria 



 



.

No hay colores hardcodeados; todo usa tokens 



.

Android + iOS: gestos y área táctil correctos; no rompe safe areas.

Tests / QA rápido

Abrir/cerrar drawer repetidamente no degrada FPS ni rompe animación.

Rotación (si la app la soporta) mantiene ancho razonable.

Usuario sin avatar → inicial correcta.

Logout desde drawer → redirige a login y drawer se cierra.

Deep links internos (si existen) no se rompen al cambiar la navegación raíz.