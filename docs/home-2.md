Propuesta de navegación en Web
1) Menú de navegación Web = tabs Mobile (mismas “secciones core”)

En el nav principal de web (sidebar o header, según tu layout actual):

Home / Dashboard (si existe hoy)

Transactions

Account

(Settings si ya lo tienes, ok, pero el foco aquí es igualar “Transactions” + “Account”)

Regla: mismo naming que mobile. Si en mobile pone “Account”, en web también (y no “Cuenta activa” o “Mi cuenta” como item principal). Luego dentro ya explicas.

IA y contenido de cada sección
Transactions (web)

Ruta: /transactions
Contenido: lo que ya tengas, pero ahora como “destino” obvio desde el nav.

Detalles UX clave:

Estado activo claro (sin colores chillones; usa tokens semánticos, no decorativos). 

color-guide

Mantén jerarquía por espacio + tipografía, no por color. 

design-principles

Si en web hoy hay botones tipo “Back to Dashboard”, deberían desaparecer si ya hay navegación persistente (se vuelve redundante y mete ruido).

Account (web)

Ruta: /account (o /accounts si la pantalla es “selector + gestión”, pero como base: /account)
Contenido mínimo recomendado (alineado con lo que vienes pidiendo):

Cuenta activa: nombre, moneda base, miembros, rol del usuario.

Cambiar cuenta (si aplica): selector simple.

(Opcional) accesos a: invites / miembros / categorías (si lo quieres como subsecciones).

Esto cuadra con tu idea previa de “ver categorías y transacciones relacionadas” pero sin mezclarlo todavía en el nav principal: primero alineamos estructura, luego iteramos. 

init

Comportamiento de UI (web)
Nav persistente

Desktop: sidebar o header fijo, pero estable (no debería “bailar” con scroll).

Mobile web: puedes colapsar a un menú compacto, pero manteniendo las mismas opciones.

Estado activo y jerarquía

Activo: fondo suave (color.action.secondary en light / equivalente en dark) + texto principal. Nada de subrayados llamativos o colores nuevos. 

color-guide

Nada de overlays dramáticos o efectos “modal” para navegación: continuidad visual siempre. 

ux-approach

 

design-principles

Definition of Done (DoD)

En web existe navegación principal con Transactions y Account visibles siempre.

Click en Transactions navega a /transactions y marca estado activo.

Click en Account navega a /account y marca estado activo.

Los nombres son idénticos a los de móvil (mismo copy).

No se introducen colores nuevos ni estilos “expresivos”; todo con tokens. 

color-guide

Se elimina cualquier “back button” redundante que exista solo por falta de nav persistente (si aplica).

Guardrails (para tu agente / para ti)

No rehacer layouts enteros: solo añadir la estructura de navegación y ajustar redundancias.

No convertir Account en “settings 2.0”: es cuenta + contexto (cuenta activa, cambiar cuenta, miembros).

La navegación debe sentirse “herramienta doméstica”: estable, obvia, sin dramatismo. 

design-principles