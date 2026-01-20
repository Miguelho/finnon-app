Aplicación web de Finnon (Next.js). Queremos que toda la web muestre el avatar del usuario en la barra superior y que al hacer click se abra un panel deslizable desde la izquierda con las opciones de Ajustes. La pantalla/ruta de “Configuración / Settings” debe dejar de ser el punto de entrada principal: el acceso pasa a ser el panel lateral.

Nota: si por compatibilidad necesitas mantener /settings, que sea redirect o una pantalla mínima que diga “Abre el panel desde el avatar”.

Objetivo

Añadir avatar del usuario en el header global (visible en todas las páginas autenticadas).

Implementar panel lateral izquierdo (drawer/sheet) con contenido de Ajustes.

Sustituir “Settings” como pantalla navegable:

eliminar del menú

actualizar CTAs/enlaces “Ajustes” para abrir el panel

Mantener consistencia UI con el estilo actual (tiles, spacing, tokens).

Alcance
Entra

Header global: avatar clickable.

Drawer izquierdo con:

Perfil (email + avatar)

Selector de cuenta (si existe en web)

Preferencias (si existen)

Enlaces secundarios (legal/about)

“Cerrar sesión”

Comportamiento accesible: teclado, foco, ESC para cerrar.

Fuera

Cambios backend

Rediseño grande del contenido de ajustes (solo migración/encapsulado)

Requisitos UX/UI (clave)

El panel entra desde la izquierda con animación suave.

Overlay: mínimo (ideal: transparente o muy sutil). No queremos “modal dramático”.

Ancho panel: min(360px, 86vw) (aprox).

El avatar debe ser un botón real (<button>) con aria-label.

No hardcodear colores: usar tokens / variables CSS del sistema.

Implementación técnica (Next.js)
1) Ubicación del header global

Si usas App Router:

el header vive en app/(authed)/layout.tsx (o equivalente del grupo autenticado).

Si usas Pages Router:

el header vive en un Layout global que envuelve las páginas privadas.

El header debe poder acceder a:

user (email, avatar_url si existe)

activeAccount (si aplica)

logout()

2) Componente AvatarButton

Crear AvatarButton reutilizable:

Si avatar_url: render <img> circular con fallback.

Si no hay avatar: render círculo con inicial del email (uppercase).

Tamaño: 28–32 px.

onClick: abrir drawer.

Accesibilidad

aria-label="Abrir ajustes"

title="Ajustes"

Focus ring usando tokens actuales.

3) Drawer / Sheet lateral izquierdo

Implementar como “Sheet”/Drawer:

Si tenéis shadcn/ui: usar Sheet con side="left" (Radix Dialog debajo).

Si no: implementar con Radix Dialog + transición o un componente propio con:

overlay opcional muy sutil

focus trap

cerrar con ESC

click fuera cierra (si overlay existe, aunque sea transparente)

Comportamiento

Estado controlado desde el header (isOpen, setOpen).

Cerrar al navegar (si el panel tiene links internos).

Mantener el panel montado si quieres preservar estado; si no, desmontar al cerrar.

4) Contenido de Ajustes dentro del Drawer

Crear SettingsDrawerContent:

Sección “Perfil”

Avatar grande (48–56 px) + email

Sección “Cuenta”

componente selector de cuenta existente (si ya hay selector en otra parte)

Sección “Preferencias”

items existentes (moneda/idioma/tema si aplica)

Sección “Acciones”

“Cerrar sesión” (acción destructiva visualmente contenida; sin rojo chillón)

Sección “Legal / About”

links secundarios

Estilo

Reutilizar componentes de lista/tiles existentes:

transaction-tile estética: padding, bordes, hover sutil.

Separadores con token “neutral/muted”.

5) Sustituir pantalla/ruta Settings

Quitar “Settings/Configuración” del menú principal.

Buscar referencias:

botones “Ajustes”

enlaces en menús

shortcuts
y reemplazar por openSettingsDrawer().

Ruta /settings

Opción A (preferida): redirect('/transactions') (o landing de la app) y abrir drawer vía query param si quieres.

Opción B: pantalla mínima con botón “Abrir panel de ajustes”.

6) Estado global (opcional pero recomendado)

Para poder abrir el drawer desde cualquier parte:

Crear store (Zustand o context) uiStore:

isSettingsOpen

openSettings()

closeSettings()

Header consume store y renderiza SettingsDrawer.

Esto evita props drilling y permite que cualquier botón haga openSettings().

Archivos esperados (orientativo)

components/layout/AppHeader.tsx (o equivalente)

components/user/AvatarButton.tsx

components/settings/SettingsDrawer.tsx

components/settings/SettingsDrawerContent.tsx

app/(authed)/layout.tsx (o pages/_app.tsx + Layout)

Ajustes de rutas:

app/settings/page.tsx (redirige) o eliminación controlada

Criterios de aceptación (DoD)

En cualquier página autenticada se ve el avatar en el header.

Click en avatar abre panel desde la izquierda con animación suave.

El panel contiene las opciones de Ajustes previamente accesibles en Configuración.

Ya no existe una opción de navegación principal a “Configuración”.

Overlay (si existe) es mínimo y no “oscurece” la app de forma agresiva.

Accesible:

TAB recorre elementos dentro del panel

ESC cierra

foco vuelve al avatar al cerrar

No se rompen estilos (tokens) ni se hardcodean colores.

QA rápido

Desktop: abrir/cerrar varias veces, sin saltos de layout.

Mobile web: panel ocupa ~86vw y no tapa el gesto de back del navegador.

Usuario sin avatar: inicial correcta.

Logout desde panel: sesión fuera + redirección correcta + panel cerrado.

Navegar a /settings: no deja al usuario en un “callejón sin salida”.