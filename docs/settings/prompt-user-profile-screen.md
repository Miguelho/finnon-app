# Prompt: Pantalla de Perfil de Usuario — Finnon

## Contexto

Finnon es una app de finanzas personales para parejas y compañeros de piso. Stack: React Native (Expo managed) para móvil, Next.js para web, Supabase como backend, Zustand para state management, monorepo con shared packages, TypeScript, i18n para traducciones.

Necesito implementar la pantalla de **perfil de usuario** (`UserProfileScreen`). Esta pantalla reemplaza la actual pantalla de "Detalles del usuario" que solo mostraba email, ID y avatar con botón de editar. El nuevo diseño agrupa toda la configuración personal del usuario en una sola pantalla con secciones card.

Adjunto un wireframe HTML interactivo como referencia visual (`finnon-user-settings-wireframe-v3.html`). Úsalo como guía de layout, jerarquía y comportamiento, pero sigue los design tokens y componentes existentes del proyecto.

---

## Secciones (en este orden)

### 1. Avatar

- Muestra un círculo con las **2 primeras letras del email** (antes del `@`), en mayúsculas, sobre un fondo de color.
- Junto al avatar: el email del usuario (texto principal) y un subtítulo: "Se muestra junto a tus movimientos".
- Debajo: selector de **6 colores** de avatar. Los colores son:
  - `blue`: bg `#D4E4F7`, texto `#3A6EA5`
  - `green`: bg `#D4EDDA`, texto `#2D7A3F`
  - `coral`: bg `#FAD9D4`, texto `#B85450`
  - `purple`: bg `#E8D8F0`, texto `#7B4F9E`
  - `amber`: bg `#F5E6CC`, texto `#9A7030`
  - `slate`: bg `#DDE1E8`, texto `#4A5568`
- Al crear una cuenta, se asigna automáticamente un color que **no repita** con otros miembros de la misma cuenta compartida. El usuario puede cambiarlo manualmente aquí.
- Persistencia: campo `avatar_color TEXT DEFAULT 'blue'` en la tabla `profiles` de Supabase.

**Lógica de iniciales:**
```typescript
function getAvatarInitials(email: string): string {
  const local = email.split('@')[0];
  return local.substring(0, 2).toUpperCase();
}
```

**Limitación conocida:** dos usuarios cuyo email empiece por las mismas 2 letras tendrán las mismas iniciales. El color diferente los distingue visualmente. No resolver ahora.

### 2. Invitaciones pendientes

- Lista de invitaciones recibidas por el usuario para unirse a cuentas de otros.
- Cada tarjeta de invitación muestra:
  - Avatar del invitante (2 letras de su email + su color de avatar)
  - Nombre de la cuenta a la que se le invita
  - Email del invitante (texto secundario: "de xxx@xxx.com")
  - Dos botones: **Rechazar** (outlined, secundario) y **Aceptar** (filled, primario)
- **Empty state:** cuando no hay invitaciones, mostrar un estado vacío centrado con icono de sobre y texto "No tienes invitaciones pendientes". **No ocultar la sección**, para que el usuario sepa que la funcionalidad existe.
- **Query:** la tabla `invitations` ya existe para el flujo de invitaciones salientes (ajustes de cuenta). Las entrantes se obtienen filtrando `invited_email = auth.user().email AND status = 'pending'`.
- **Badge en navbar:** el icono de notificaciones/correo del navbar principal debe mostrar un badge numérico con el count de invitaciones pendientes. Esto es un cambio **fuera de esta pantalla** pero necesario para que el usuario descubra que tiene invitaciones sin tener que entrar al perfil.

### 3. Tema

- **2 temas:** Grafito y Océano.
  - **Grafito:** primario `#1A1A1A`, fondo claro `#F7F7F5`, superficie `#E5E4E0`. Neutro y sobrio.
  - **Océano:** primario `#4A6FA5`, fondo claro `#EBF0F7`, superficie `#C8D8E8`. Calma y confianza.
- Cada tema se presenta como una card seleccionable con una vista previa de 3 swatches de color, nombre y descripción corta.
- **3 modos** en un toggle segmentado debajo: Claro, Oscuro, Sistema.
  - "Sistema" aplica `prefers-color-scheme` del OS (iOS/Android).
- Persistencia: `theme TEXT DEFAULT 'grafito'` y `color_mode TEXT DEFAULT 'system'` en la tabla `profiles`.
- **Arquitectura de tokens:** cada tema debe definir un set completo de design tokens (colores de texto, fondos, bordes, estados) para modo claro y modo oscuro. Usar CSS custom properties (web) y un theme provider (React Native). La estructura debe permitir **añadir más temas en el futuro** sin refactorizar — un nuevo tema es solo un nuevo objeto de tokens.

```typescript
// Ejemplo de estructura de tokens
type ThemeTokens = {
  primary: string;
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  // ... más tokens según necesidad
};

type ThemeDefinition = {
  id: 'grafito' | 'oceano';
  name: string;
  description: string;
  preview: [string, string, string]; // 3 colores para la preview
  light: ThemeTokens;
  dark: ThemeTokens;
};
```

### 4. Idioma

- **Configuración de usuario**, persiste en backend: campo `locale TEXT DEFAULT 'es'` en la tabla `profiles`.
- 2 idiomas: Español (🇪🇸) e Inglés (🇬🇧).
- Cada opción es una fila seleccionable con: bandera (emoji), nombre del idioma, y check (✓) en la opción activa.
- Al cambiar idioma: actualizar `profiles.locale` en Supabase y recargar las traducciones i18n inmediatamente (sin necesidad de recargar la app).
- Al iniciar sesión desde cualquier dispositivo, la app carga el locale del perfil del usuario.

### 5. Cerrar sesión

- Botón aislado (no dentro de una card/sección) con texto rojo "Cerrar sesión" y subtítulo "Cierra sesión en este dispositivo".
- Hover/press state con fondo rojo claro (`#FEF2F2`) y borde rojo (`#FCA5A5`).
- Al pulsar: ejecutar `supabase.auth.signOut()` y redirigir al login.

---

## Esquema de base de datos

Campos nuevos a añadir en la tabla `profiles`:

```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS avatar_color TEXT DEFAULT 'blue',
  ADD COLUMN IF NOT EXISTS theme TEXT DEFAULT 'grafito',
  ADD COLUMN IF NOT EXISTS color_mode TEXT DEFAULT 'system',
  ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'es';
```

---

## Comportamiento y UX

- **Guardado automático:** todos los cambios (color de avatar, tema, modo, idioma) se persisten inmediatamente al seleccionar, sin botón de guardar. Feedback visual: la UI refleja el cambio al instante (optimistic update) y si falla el guardado en Supabase, revertir y mostrar un toast de error.
- **Jerarquía de secciones:** el orden es intencionado por frecuencia de uso esperada. Avatar y invitaciones arriba (setup y acciones), personalización en medio, cierre de sesión abajo y aislado visualmente.
- **Responsive:** esta pantalla debe funcionar en móvil (React Native) y en web (Next.js). El layout es single-column, max-width ~640px centrado en web.

---

## Fuera de alcance (no implementar)

- Subida de fotos de avatar
- Más de 2 temas
- Más de 2 idiomas
- Campo de nombre/alias de usuario
- ID de usuario (eliminado del diseño)
