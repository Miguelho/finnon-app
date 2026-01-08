Fix Header fijo en Home (Mobile)
Contexto

En la pantalla Home de la aplicación móvil (Expo / React Native), la barra superior (header/top bar) se está desplazando cuando el usuario hace scroll. Esto rompe el patrón esperado: la barra superior debe permanecer fija y el contenido debe scrollear “por debajo”.

Objetivo

Asegurar que en Home (mobile):

El header quede sticky/fijo.

Solo el contenido principal (lista/sections) haga scroll.

Se respete el safe area superior en iOS y Android.

Problema actual (síntomas)

El header está dentro del mismo contenedor que scrollea (p.ej. ScrollView, FlatList o Animated.ScrollView) y por eso “viaja” con el contenido.

En algunos casos, el padding/top o el wrapper del safe area está aplicado al contenedor scrolleable en lugar de al layout general.

Alcance

Solo corregir el layout/estructura del Home para separar header y contenido scrolleable.

No cambiar copy, estilos de marca, lógica de negocio ni navegación salvo lo imprescindible.

Plan de implementación (pasos)
1) Identificar el Home screen y su estructura

Localizar el screen/component de Home en apps/mobile.

Confirmar si el header actual:

es un componente propio (custom header),

o un header de navegación (React Navigation / expo-router stack header),

o un “pseudo header” dentro del JSX del screen.

2) Solución preferida A (si el header es parte del layout del screen)

Separar el header del contenedor con scroll:

Estructura recomendada:

SafeAreaView (o SafeAreaProvider + SafeAreaView)

Header (fixed, no scroll)

ScrollView/FlatList (solo contenido)

Asegurar que:

el contenedor scrolleable tenga contentContainerStyle con padding inferior/espaciado si hace falta,

el header tenga altura estable,

el contenido tenga flex: 1.

3) Solución alternativa B (si el header debería ser “nativo” del navigator)

Si usáis expo-router con Stack:

Mover el header a Stack.Screen options={{ header: ... }} o headerShown: true

Dejar el Home como contenido scrolleable sin incluir header dentro del ScrollView.

Mantener consistencia de estilo (sin inventar nuevos tokens).

4) Safe Area: no negociable

El header debe respetar el área segura superior:

Usar react-native-safe-area-context (ya está en deps).

Aplicar insets al header, no al ScrollView entero (o, si se aplica al wrapper general, asegurar que el header sigue fijo).

5) Si se usa FlatList

Si el “header” actual se implementó con ListHeaderComponent, eso hace que scrollee.

Sustituir ese patrón por:

header fuera de la lista,

o un “stickyHeaderIndices” solo si tiene sentido (pero preferimos header fuera para evitar rarezas).

Guardrails (no romper nada)

No introducir overlays, sombras agresivas ni dramatismo visual (mantener sobrio). 

design-principles

No hardcodear colores: usar tokens semánticos existentes. 

color-guide

No alterar comportamiento de otras pantallas.

No duplicar lógica de business/copy: solo layout.

Criterios de aceptación (DoD)

En Home (mobile), al hacer scroll, la barra superior no se mueve.

El contenido scrollea de forma fluida y no queda oculto bajo el header.

Se respeta safe area superior (iOS notch / Android status bar).

No se introducen regresiones visuales (spacing raro, saltos al cambiar de modo, etc.).

Entregables

PR con el refactor del layout del Home (y si aplica, configuración del header en navigator).

Breve nota en el PR explicando cuál era la causa (header dentro del contenedor scrolleable) y cómo se corrigió.