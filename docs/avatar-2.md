# Prompt para agente de código — Editor de Avatar Fallback (letra + fondo) para evitar colisiones

## Contexto
Actualmente, el fallback de avatar se basa en: inicial del email + color determinista por seed. Esto puede causar:
- Colisión visual (dos usuarios con la misma inicial y color parecido).
- Sensación de “random” cuando hay varios miembros.

Queremos un **editor simple** para que el usuario pueda personalizar el fallback:
- Cambiar la **letra** (1 carácter) y/o el **fondo** (color-token).
- Mantener consistencia web/móvil (mismo copy/strings y misma lógica shared).

---

## Objetivo
1) Añadir un editor de avatar fallback (sin imagen) que permita al usuario:
   - Modificar la letra mostrada (por defecto: inicial del email)
   - Elegir el fondo desde una paleta limitada (tokens), evitando hardcode
2) Usar esta configuración en:
   - Settings (preview)
   - Transactions (avatar del creador)
3) Evitar colisiones: si muchos usuarios comparten inicial, el usuario puede diferenciarse.

---

## Alcance (MVP)
- Editor ligero (modal en web, bottom sheet en mobile).
- Paleta limitada de colores (tokens existentes) con selección por grid.
- Letra: 1 carácter visible (A–Z, 0–9 opcional), uppercase.
- Persistencia en `profiles`.

Fuera de alcance:
- Emojis como letra, stickers, gradientes, tipografías múltiples, borde con color custom, etc.

---

## Datos / Persistencia (Supabase)
### 1) Extender tabla `profiles`
Añadir columnas (si no existen):
- `avatar_fallback_text text null`  -- 1 char; si null => default (inicial email)
- `avatar_fallback_bg_token text null` -- nombre del token permitido; si null => default determinista
- `updated_at timestamptz not null default now()`

Validaciones (DB o app):
- `avatar_fallback_text`: longitud 1 (o 2 si quieres permitir “MH” más adelante, pero MVP 1).
- `avatar_fallback_bg_token`: debe ser uno de los tokens permitidos (enum a nivel app; DB check opcional).

RLS:
- UPDATE solo por el propio usuario (`profiles.user_id = auth.uid()`).
- SELECT por miembros de la misma cuenta (igual que perfiles/avatars).

---

## Shared: catálogo de opciones (sin hardcode visual)
### 2) Crear un catálogo único de tokens permitidos
En shared, definir:
- `ALLOWED_AVATAR_BG_TOKENS: TokenName[]`
  - Ejemplos: `bg.secondary`, `surface`, `action.secondary`, etc.
  - Importante: deben mapear a estilos reales en web y mobile sin hex sueltos.
- `DEFAULT_AVATAR_BG_TOKEN(seed: string): TokenName`
  - Hash determinista (user_id/email) -> índice del array

### 3) Resolver el fallback final
Crear un helper:
- `resolveAvatarFallback(profile, email, userId) -> { text: string; bgToken: TokenName }`

Reglas:
- `text`:
  - si `profile.avatar_fallback_text` existe => usarla
  - si no => inicial del email
- `bgToken`:
  - si `profile.avatar_fallback_bg_token` existe => usarlo
  - si no => `DEFAULT_AVATAR_BG_TOKEN(seed)`

---

## UX / UI — Settings
### 4) Sección “Avatar”
Mostrar:
- Avatar (imagen si existe)
- Si no hay imagen: preview del fallback (text + fondo)

Acción:
- Botón: “Editar avatar”
  - Si hay imagen, el editor permite:
    - “Cambiar foto”
    - “Eliminar foto” (vuelve a fallback)
    - “Personalizar fallback” (si el usuario quiere)
  - Si NO hay imagen:
    - Abre directamente “Personalizar fallback”

### 5) Editor de fallback (modal/bottom sheet)
Contenido:
1) Preview grande del avatar fallback (48–64px).
2) Campo “Letra”:
   - Input de 1 carácter
   - Auto-uppercase
   - Validar: [A-Z0-9] (o solo A-Z si prefieres)
   - Botón “Restablecer” (vuelve a inicial del email)
3) Selector de fondo:
   - Grid de swatches (colores) basados en tokens permitidos
   - Al seleccionar, se actualiza preview
   - Botón “Aleatorio” opcional: aplica un token distinto (pero siempre de la lista)
4) CTA:
   - Primario: “Guardar”
   - Secundario: “Cancelar”
   - Texto pequeño: “Esto solo se usa si no tienes foto.”

Interacciones:
- Guardado optimista (cambia preview al momento).
- Si falla API -> revertir y mostrar toast.

---

## Transactions (web + mobile)
### 6) Mostrar el fallback personalizado del creador
En el componente `UserAvatar`:
- Prioridad:
  1) avatar image si existe y carga
  2) fallback personalizado (`avatar_fallback_text`, `avatar_fallback_bg_token`)
  3) fallback por defecto (inicial + token por hash)

Batch profiles igual que antes (evitar N+1).

---

## Criterios de aceptación (DoD)
- [ ] Usuario puede editar letra y fondo del fallback desde Settings (web y mobile).
- [ ] Persistencia en `profiles` y se refleja en Transactions en ambas plataf
