# Tarea: Crear página pública /privacy en la app Next.js (App Router)

## Contexto
Finnon es una app Next.js con App Router (`app/`) desplegada en Vercel. Usa `next-intl` para internacionalización sin prefijo de idioma en la URL (el idioma se detecta automáticamente). Necesito una página pública accesible en `finnon.app/privacy` que muestre la política de privacidad. Esta URL se usará en Google Play Store y dentro de la app móvil.

## Requisitos

### Ruta y estructura
- Crear la ruta `/privacy` dentro de la estructura existente de App Router, siguiendo el mismo patrón que usan las demás páginas del proyecto con `next-intl`.
- La página debe ser **pública** (no requiere autenticación). Verifica si hay algún middleware de autenticación o de `next-intl` que pueda bloquear o redirigir esta ruta, y exclúyela si es necesario.
- La página debe ser una **Server Component** con contenido estático (no necesita interactividad del cliente).

### Internacionalización
- Utilizar el sistema de `next-intl` ya configurado en el proyecto para gestionar las traducciones.
- Crear los archivos de traducción necesarios (o añadir las claves al archivo existente, según cómo esté organizado el proyecto) con el contenido completo de la política en **español** e **inglés**.
- El idioma se debe resolver automáticamente según la configuración existente de `next-intl` (detección por navegador). No añadir selector de idioma manual en esta página.

### Contenido de la política de privacidad
El contenido completo en ambos idiomas está adjunto en los archivos `privacy-es.md` y `privacy-en.md`. Usa esos textos íntegramente como fuente para las traducciones.

### Diseño y maquetación
- Página con diseño limpio y legible, centrada, con ancho máximo de lectura (~720px).
- Tipografía clara con jerarquía visual para los encabezados (h1, h2, h3).
- Las tablas de la sección "Servicios de terceros" deben ser responsivas (scroll horizontal en móvil o adaptarse a columnas apiladas).
- Incluir la fecha de última actualización visible al inicio.
- Respetar los estilos y sistema de diseño existentes en el proyecto (Tailwind CSS). No añadir CSS custom si no es necesario.
- Incluir un enlace para volver a la página principal o a la app.

### SEO y metadata
- Añadir metadata apropiada con `next-intl` y el sistema de metadata de Next.js:
  - `title`: "Política de Privacidad | Finnon" / "Privacy Policy | Finnon"
  - `description`: descripción breve de la política en cada idioma
  - `robots`: `index, follow` (queremos que Google la indexe)

### Consideraciones importantes
- **No modifiques** ninguna otra página o funcionalidad existente.
- **No instales** dependencias nuevas. Usa solo lo que ya está en el proyecto (`next-intl`, Tailwind).
- Revisa el middleware (`middleware.ts`) para asegurarte de que `/privacy` es accesible sin autenticación y que `next-intl` la procesa correctamente.
- Si el proyecto usa un layout que incluye navegación autenticada (sidebar, header con usuario, etc.), esta página debe usar un **layout independiente** o público que no requiera sesión.

## Archivos adjuntos
- `privacy-es.md` — Contenido completo en español
- `privacy-en.md` — Contenido completo en inglés

## Resultado esperado
Al terminar, `finnon.app/privacy` debe mostrar la política de privacidad completa en el idioma del navegador del usuario, con un diseño limpio y profesional, accesible sin autenticación.
