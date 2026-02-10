# Refactor: Settings de cuenta — Integración en Drawer + Sub-rutas

## Contexto

La pantalla de configuración de cuenta actualmente es una sola página plana con todo el contenido apilado (detalles, miembros, categorías). Necesitamos refactorizarla en **3 sub-rutas** integradas en el **drawer de Ajustes existente**, reemplazando las opciones actuales de la sección CUENTA.

**Referencia visual:** Adjuntar `finnon-settings-v2.html` — usar como referencia de diseño para los 3 paneles de contenido (General, Miembros, Categorías). El sidebar del wireframe NO se implementa; la navegación se integra en el drawer existente.

**Lo que ya existe y funciona (NO reescribir):**
- CRUD completo de categorías (crear, editar, eliminar)
- Flujo de invitaciones (invitar, reenviar, cancelar)
- Gestión de miembros (cambiar rol, eliminar)
- Design tokens / theme centralizado
- Componentes compartidos en `@poleursus/shared`
- Drawer de Ajustes con secciones USUARIO, CUENTA, ACCIONES

**Lo que hay que hacer:**
1. Modificar el drawer para reemplazar las opciones de CUENTA
2. Crear la estructura de sub-rutas
3. Redistribuir la UI existente en los 3 paneles con el nuevo diseño

---

## 1. Modificación del Drawer de Ajustes

### Estructura actual del drawer (sección CUENTA):
```
CUENTA
├── Configuración de la cuenta    → Gestiona los detalles, participantes y categorías
└── Invitaciones                  → Gestionar links de invitación
```

### Nueva estructura (sección CUENTA):
```
CUENTA
├── General       → Nombre, moneda e icono de la cuenta
├── Miembros      → Gestiona accesos e invitaciones
└── Categorías    → Organiza gastos e ingresos
```

### Cambios en el drawer:
- **Eliminar** la opción "Configuración de la cuenta"
- **Eliminar** la opción "Invitaciones" (ahora vive dentro de Miembros)
- **Añadir** 3 nuevas opciones: General, Miembros, Categorías
- Cada opción navega a su sub-ruta correspondiente (`/account/[id]/settings/general`, etc.)
- El **link activo** se resalta igual que las demás opciones del drawer (usar `usePathname()` para detectar la ruta actual)
- Las secciones USUARIO y ACCIONES **no cambian**

### Iconos para las nuevas opciones:
- General: icono de engranaje/settings (⚙️)
- Miembros: icono de personas/grupo (👥)
- Categorías: icono de etiqueta/grid (🏷️)

Usar los mismos iconos del sistema de iconos existente en la app — no emojis.

---

## 2. Estructura de rutas (Next.js)

```
app/account/[id]/settings/
├── layout.tsx          ← Wrapper del área de contenido (sin sidebar propio)
├── page.tsx            ← Redirect a /general
├── general/
│   └── page.tsx        ← Config básica + zona de peligro
├── members/
│   └── page.tsx        ← Lista de miembros + invitaciones
└── categories/
    └── page.tsx        ← CRUD categorías agrupadas
```

**`layout.tsx`:** Solo envuelve el contenido. NO incluye sidebar. El drawer de Ajustes ya existe a nivel superior y maneja la navegación.

```tsx
// layout.tsx — wrapper simple
export default function SettingsLayout({ children }) {
  return (
    <div style={{ maxWidth: 720, padding: '40px 48px 80px' }}>
      {children}
    </div>
  );
}
```

**`page.tsx` raíz:** Redirect a `/general`:
```tsx
import { redirect } from 'next/navigation';
export default function SettingsPage({ params }) {
  redirect(`/account/${params.id}/settings/general`);
}
```

Para **React Native/Expo**, replicar con stack navigation equivalente.

---

## 3. Panel General (`general/page.tsx`)

### Título de página:
- `<h1>` "General" — font-size 22px, weight 700, letter-spacing -0.5px
- Subtítulo: "Configuración básica de tu cuenta" — font-size 14px, color `text-tertiary`
- Margin bottom: 36px

### Sección "Detalles de la cuenta":

Título de sección: "Detalles de la cuenta" — font-size 14px, weight 600, margin-bottom 16px.

Un card (fondo `surface`, border 1px `border`, border-radius `radius-lg`) con filas de formulario inline:

| Campo | Tipo | Detalle |
|-------|------|---------|
| Icono | Emoji picker (o input text por ahora) | 48x48px, border, border-radius `radius-sm`, fondo `bg`, centrado |
| Nombre | Input text | Valor actual de la cuenta, fondo `bg`, border `border` |
| Moneda | Select | Opciones de moneda disponibles, fondo `bg` |

Cada fila:
- `display: flex`, align center
- Padding: 16px 20px
- Label a la izquierda: width 140px, font-size 13px, weight 500, color `text-secondary`
- Input/select a la derecha: flex 1, padding 9px 14px, border-radius `radius-sm`, font-size 14px
- Focus state: border-color `blue`, fondo `surface`

Separador entre filas: pseudo-element `::after`, 1px solid `border-light`, inset left 20px right 20px.

**Botón "Guardar cambios":** debajo del card, margin-top 20px. Fondo `accent`, color blanco, padding 10px 24px, font-size 14px, weight 600, border-radius `radius-sm`. Hover: opacity 0.85.

### Sección "Zona de peligro":

Separada visualmente:
- margin-top: 48px
- padding-top: 32px
- border-top: 1px solid `border`

Título: "ZONA DE PELIGRO" — font-size 12px, uppercase, letter-spacing 0.5px, color `expense-text`.

Card (fondo `surface`, border `border`, border-radius `radius-lg`, padding 20px 24px) con layout flex space-between:
- Izquierda: "Eliminar cuenta" (14px, weight 600) + "Se eliminarán permanentemente todos los movimientos, categorías y configuraciones." (12px, `text-tertiary`)
- Derecha: botón "Eliminar" — border 1px `expense-badge`, color `expense-text`, sin fondo. Hover: fondo `expense-bg`, border `expense-text`.

---

## 4. Panel Miembros (`members/page.tsx`)

### Título de página:
- "Miembros" + "Gestiona quién tiene acceso a esta cuenta"

### Sección "Miembros activos":

Header: "Miembros activos" (14px, weight 600), margin-bottom 14px.

Card (fondo `surface`, border `border`, border-radius `radius-lg`) con lista. Cada miembro:

- **Avatar:** 38x38px, circular, con iniciales (2 letras). Colores de fondo por índice desde un array predefinido. El usuario actual ("Tú"): fondo `accent`, texto blanco.
- **Info:** nombre o email (14px, weight 600) + email debajo (12px, `text-tertiary`).
- **Badge de rol:** pill (padding 4px 10px, border-radius 100px, font-size 11px, weight 600, uppercase, letter-spacing 0.3px):
  - Admin: fondo `blue-light`, color `blue`
  - Viewer: fondo `surface-hover`, color `text-tertiary`
- **Acciones (aparecen en hover, opacity 0 → 1, transition 0.15s):**
  - Cambiar rol: icono lápiz, 30x30px, hover fondo `border-light`
  - Eliminar: icono X, 30x30px, hover fondo `expense-bg` + color `expense-text`
- **El usuario actual ("Tú") NO muestra acciones.**

Separadores: pseudo-element `::after`, 1px `border-light`, inset left 56px right 20px.

### Sección "Invitaciones":

Header flex space-between:
- Izquierda: "Invitaciones" (14px, weight 600) + "· N pendientes" (12px, `text-tertiary`)
- Derecha: botón "+ Invitar" — fondo `blue-light`, color `blue`, font-size 13px, weight 600, border-radius `radius-sm`. Hover: fondo #dfe8ff.

Card con lista de invitaciones. Cada invitación:
- **Icono:** 38x38px circular, fondo `amber-bg` (#fff8eb), emoji ✉️
- **Info:** email (14px, weight 500) + "Enviada hace X días · Rol: {rol}" (12px, `text-tertiary`)
- **Badge:** pill "PENDIENTE" — fondo `amber-bg`, color `amber-text` (#a16207)
- **Acciones (siempre visibles, NO hover):**
  - Botón "Reenviar": outline (border `border`), font-size 11px, weight 500. Hover: border `text-tertiary`.
  - Botón cancelar: icono X, mismos estilos que eliminar miembro.

**Estado vacío:** "No hay invitaciones pendientes" — 13px, `text-tertiary`, centrado, padding 32px.

---

## 5. Panel Categorías (`categories/page.tsx`)

### Título de página:
- "Categorías" + "Organiza tus movimientos por tipo de gasto o ingreso"

### Dos secciones apiladas: Gastos e Ingresos

Cada sección tiene:

**Header de sección** (margin-bottom 12px):
- Dot: 8x8px circular (`expense-text` para gastos, `income-text` para ingresos)
- Label: 13px, weight 600, uppercase, letter-spacing 0.5px, color correspondiente
- Conteo: "· N categorías" (12px, `text-tertiary`)

**Card con lista de categorías** (fondo `surface`, border `border`, border-radius `radius-lg`):

Cada categoría:
- **Icono:** 36x36px, border-radius `radius-sm`. Fondo `expense-bg` (#fff5f3) para gastos, `income-bg` (#f0f7f1) para ingresos. Emoji del icono de la categoría centrado, font-size 16px.
- **Nombre:** 14px, weight 500, flex 1
- **Acciones (hover):** editar (lápiz) + eliminar (X), mismos estilos que en miembros.

**Botón "Añadir categoría"** al final de cada card:
- Full width, padding 14px 20px
- Icono + + texto "Añadir categoría de gasto" / "Añadir categoría de ingreso"
- Color `text-tertiary`, 13px, weight 500
- Hover: fondo `surface-hover`, color `text-secondary`

Separadores: pseudo-element `::after`, 1px `border-light`, inset left 56px right 20px.

Espacio entre sección Gastos y sección Ingresos: margin-bottom 28px.

---

## Tokens de color referencia

Mapear a los design tokens existentes del proyecto:

| Token | Valor | Uso |
|-------|-------|-----|
| bg | #fafaf8 | Fondo de página, inputs |
| surface | #ffffff | Cards |
| surface-hover | #f7f7f5 | Hover states |
| border | #e8e6e1 | Bordes principales |
| border-light | #f0eee9 | Separadores internos |
| text-primary | #1a1a1a | Texto principal |
| text-secondary | #6b6b6b | Labels, texto secundario |
| text-tertiary | #9a9a9a | Metadatos, hints |
| accent | #1a1a1a | Botones principales, avatar "Tú" |
| expense-bg | #fff5f3 | Fondo iconos gasto |
| expense-text | #c4442a | Texto/color gasto, zona peligro |
| expense-badge | #f8d7cf | Border botón eliminar cuenta |
| income-bg | #f0f7f1 | Fondo iconos ingreso |
| income-text | #2d7a3a | Texto/color ingreso |
| blue-light | #eef3ff | Fondo badges admin, botón invitar |
| blue | #4a6cf7 | Texto badges admin, botón invitar |
| amber-bg | #fff8eb | Fondo invitaciones pendientes |
| amber-text | #a16207 | Texto invitaciones pendientes |

---

## Notas de implementación

1. **Reusar componentes existentes:** El CRUD de categorías, el flujo de invitaciones y la gestión de miembros ya funcionan. Mover la lógica existente a los nuevos `page.tsx` sin reescribirla.
2. **`page.tsx` raíz:** Redirect a `/general` con `redirect()` de Next.js.
3. **Drawer:** Solo se modifica la sección CUENTA del drawer existente. Las secciones USUARIO y ACCIONES no se tocan.
4. **Datos por panel:** Cada panel carga solo sus datos. General carga config de cuenta, Members carga miembros + invitaciones, Categories carga categorías.
5. **Acciones hover vs siempre visibles:** En categorías y miembros las acciones se muestran solo al hover (opacity 0 → 1, transition 0.15s). En invitaciones las acciones son siempre visibles.
6. **Mobile web:** El drawer ya tiene su propio comportamiento responsive. No añadir lógica adicional para mobile en este paso.
7. **Transiciones:** Solo hover states sutiles (0.12s-0.15s ease). No animaciones de entrada en los paneles.
8. **El sidebar independiente del wireframe NO se implementa.** La navegación entre paneles la maneja el drawer.
