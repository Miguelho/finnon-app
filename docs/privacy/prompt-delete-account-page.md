# Tarea: Crear página pública /delete-account en la app Next.js (App Router)

## Contexto
Finnon es una app Next.js con App Router (`app/`) desplegada en Vercel. Usa `next-intl` para internacionalización sin prefijo de idioma en la URL (detección automática por navegador). Google Play Store exige un enlace público donde los usuarios puedan solicitar la eliminación de su cuenta y datos. La app ya tiene funcionalidad de eliminación de cuenta integrada (self-service desde dentro de la app).

## Requisitos

### Ruta y estructura
- Crear la ruta `/delete-account` siguiendo el mismo patrón de App Router y `next-intl` que las demás páginas del proyecto (y el mismo patrón que `/privacy` si ya se ha implementado).
- La página debe ser **pública** (no requiere autenticación). Asegurarse de que el middleware no bloquee ni redirija esta ruta.
- Server Component con contenido estático.

### Internacionalización
- Utilizar `next-intl` con el sistema ya configurado.
- Crear las claves de traducción en español e inglés (o añadirlas al archivo existente según la estructura del proyecto).

### Contenido de la página
El contenido completo en ambos idiomas está adjunto en los archivos `delete-account-es.md` y `delete-account-en.md`. Usa esos textos íntegramente como fuente para las traducciones.

### Diseño y maquetación
- Mismo estilo y layout que la página `/privacy`: diseño limpio, centrado, ancho máximo ~720px.
- Los pasos deben mostrarse como lista numerada clara.
- Incluir un enlace para volver a la página principal.
- Respetar los estilos y Tailwind CSS existentes.

### SEO y metadata
- `title`: "Eliminar cuenta | Finnon" / "Delete Account | Finnon"
- `description`: descripción breve en cada idioma
- `robots`: `index, follow`

### Consideraciones importantes
- **No modifiques** ninguna otra página o funcionalidad existente.
- **No instales** dependencias nuevas.
- Si `/privacy` ya se implementó con un layout público, reutilizar ese mismo layout.
- Verificar que la ruta esté excluida de autenticación en el middleware.

## Nota importante
Revisa la funcionalidad actual de eliminación de cuenta en la app y ajusta los pasos si la navegación real difiere de lo descrito aquí (por ejemplo, si "Eliminar cuenta" está dentro de un submenú específico en Ajustes, detalla la ruta exacta).

## Archivos adjuntos
- `delete-account-es.md` — Contenido completo en español
- `delete-account-en.md` — Contenido completo en inglés

## Resultado esperado
Al terminar, `finnon.app/delete-account` debe mostrar instrucciones claras de cómo eliminar la cuenta, en el idioma del navegador, accesible sin autenticación.
