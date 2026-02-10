# Refactor: Settings de cuenta — Sidebar + Sub-rutas

## Contexto

La pantalla de configuración de cuenta (`/account/[id]/settings`) es una sola página plana con todo el contenido apilado (detalles, miembros, categorías). Necesitamos refactorizarla en **3 sub-rutas** con un **sidebar lateral** de navegación, siguiendo la estética actual de la app (ver wireframe adjunto `finnon-settings-v2.html`).

**Lo que ya existe y funciona:**
- CRUD completo de categorías (crear, editar, eliminar)
- Flujo de invitaciones (invitar, reenviar, cancelar)
- Gestión de miembros (cambiar rol, eliminar)
- Design tokens / theme centralizado
- Componentes compartidos en `@poleursus/shared`

**Lo que hay que hacer:** Reorganizar la UI existente en la nueva estructura. No se implementa funcionalidad nueva, solo se redistribuye y se mejora el diseño visual.

---

## Estructura de rutas (Next.js)

```
app/account/[id]/settings/
├── layout.tsx          ← Sidebar + wrapper
├── page.tsx            ← Redirect a /general
├── general/
│   └── page.tsx        ← Config básica + zona de peligro
├── members/
│   └── page.tsx        ← Lista de miembros + invitaciones
└── categories/
    └── page.tsx        ← CRUD categorías agrupadas
```

Para React Native/Expo, replicar con stack navigation equivalente.

---

## 1. Layout con Sidebar (`layout.tsx`)

El layout envuelve las 3 sub-rutas con un sidebar lateral fijo a la izquierda.

### Sidebar — Estructura:
- **Link "Volver":** flecha ← + "Volver a Tu Cuenta". Navega a `/account/[id]` (el dashboard de la cuenta).
- **Header de cuenta:** icono de la cuenta (emoji) + nombre + "Cuenta · {moneda}". Solo lectura, no interactivo.
- **Navegación:** 3 links verticales con icono + label:
  - ⚙️ General → `/account/[id]/settings/general`
  - 👥 Miembros → `/account/[id]/settings/members`
  - 🏷️ Categorías → `/account/[id]/settings/categories`
- El link activo se determina con `usePathname()` y se resalta con fondo, peso de fuente 600 y shadow sutil.

### Estilos del sidebar:
- Ancho fijo: 240px
- Borde derecho: 1px solid `border` del theme
- Sticky: top igual a la altura del navbar, height `calc(100vh - navbar)`
- Padding: 32px 16px 32px 24px

### Responsive:
- En pantallas < 768px el sidebar se oculta. Considerar un menú desplegable o tabs horizontales como fallback en mobile web (no bloquear, implementar después si es necesario).

### Layout wrapper:
```
display: flex
max-width: 1080px
margin: 0 auto
```

### Área de contenido:
```
flex: 1
padding: 40px 48px 80px
max-width: 720px
```

---

## 2. Panel General (`general/page.tsx`)

### Título de página:
- `<h1>` "General" — font-size 22px, weight 700, letter-spacing -0.5px
- Subtítulo: "Configuración básica de tu cuenta" — font-size 14px, color `text-tertiary`
- Margin bottom: 36px

### Sección "Detalles de la cuenta":
Un card (`surface` bg, border `border`, border-radius `radius-lg`) con filas de formulario inline:

| Campo | Tipo | Detalle |
|-------|------|---------|
| Icono | Emoji picker (o input text por ahora) | 48x48px, border, border-radius, fondo `bg`, centrado |
| Nombre | Input text | Valor actual de la cuenta |
| Moneda | Select | Opciones de moneda disponibles |

Cada fila: `display: flex`, align center, padding 16px 20px, label a la izquierda (width 140px, font-size 13px, weight 500, color `text-secondary`), input/select a la derecha (flex 1).

Separador entre filas: pseudo-element `::after`, 1px solid `border-light`, inset left 20px right 20px.

**Botón "Guardar cambios":** debajo del card, margin-top 20px. Fondo `accent`, color blanco, padding 10px 24px, font-size 14px, weight 600, border-radius `radius-sm`.

### Sección "Zona de peligro":
Separada visualmente del formulario:
- margin-top: 48px
- padding-top: 32px
- border-top: 1px solid `border`

Título: "ZONA DE PELIGRO" — font-size 12px, uppercase, letter-spacing 0.5px, color `expense-text`.

Card con:
- Lado izquierdo: título "Eliminar cuenta" (14px, weight 600) + descripción "Se eliminarán permanentemente todos los movimientos, categorías y configuraciones." (12px, `text-tertiary`)
- Lado derecho: botón "Eliminar" — border 1px `expense-badge`, color `expense-text`, sin fondo. Hover: fondo `expense-bg`, border `expense-text`.

---

## 3. Panel Miembros (`members/page.tsx`)

### Título de página:
- "Miembros" + "Gestiona quién tiene acceso a esta cuenta"

### Lista de miembros activos:

Subsección con header "Miembros activos" (14px, weight 600).

Card con lista de miembros. Cada miembro:
- **Avatar:** 38x38px, circular, con iniciales. Colores de fondo asignados por índice (un array de colores predefinidos). El usuario actual ("Tú") usa fondo `accent` con texto blanco.
- **Info:** nombre (14px, weight 600) + email debajo (12px, `text-tertiary`).
- **Badge de rol:** pill con texto uppercase. Admin: fondo `blue-light`, color `blue`. Viewer: fondo `surface-hover`, color `text-tertiary`.
- **Acciones (hover):** dos botones icon-only que aparecen con opacity transition al hacer hover sobre la fila:
  - Editar rol (icono lápiz)
  - Eliminar (icono X) — hover en rojo (`expense-bg` + `expense-text`)
- **El usuario actual ("Tú") NO muestra acciones** — no puedes eliminarte ni cambiarte el rol a ti mismo.

Separadores entre filas: pseudo-element, inset left 56px right 20px.

### Sección de invitaciones:

Header con:
- Izquierda: "Invitaciones" + badge "· N pendientes" (12px, `text-tertiary`)
- Derecha: botón "Invitar" — fondo `blue-light`, color `blue`, icono + texto. Hover: fondo más oscuro.

Card con lista de invitaciones pendientes. Cada invitación:
- **Icono:** 38x38px circular, fondo `amber-bg`, emoji ✉️.
- **Info:** email (14px, weight 500) + meta "Enviada hace X días · Rol: {rol}" (12px, `text-tertiary`).
- **Badge estado:** pill "PENDIENTE" — fondo `amber-bg`, color `amber-text`.
- **Acciones (siempre visibles, no hover):**
  - Botón "Reenviar" — outline, font-size 11px
  - Botón cancelar (icono X)

**Estado vacío:** Si no hay invitaciones pendientes, mostrar texto centrado "No hay invitaciones pendientes" (13px, `text-tertiary`, padding 32px).

---

## 4. Panel Categorías (`categories/page.tsx`)

### Título de página:
- "Categorías" + "Organiza tus movimientos por tipo de gasto o ingreso"

### Estructura: dos secciones apiladas

Cada sección (Gastos e Ingresos) tiene:

**Header de sección:**
- Dot circular (8x8px): `expense-text` para gastos, `income-text` para ingresos
- Label uppercase (13px, weight 600, letter-spacing 0.5px): color correspondiente
- Conteo "· N categorías" (12px, `text-tertiary`)
- Margin bottom: 12px

**Card con lista de categorías:**

Cada categoría:
- **Icono:** 36x36px, border-radius `radius-sm`. Fondo `expense-bg` para gastos, `income-bg` para ingresos. Emoji centrado.
- **Nombre:** 14px, weight 500, flex 1.
- **Acciones (hover):** editar (lápiz) + eliminar (X). Mismos estilos que en miembros.

**Botón "Añadir categoría"** al final de cada card:
- Full width dentro del card
- Icono + + texto "Añadir categoría de gasto" / "Añadir categoría de ingreso"
- Color `text-tertiary`, font-size 13px, weight 500
- Hover: fondo `surface-hover`, color `text-secondary`

Separadores entre categorías: pseudo-element, inset left 56px right 20px.

---

## Tokens de color referencia

Estos son los colores usados en el wireframe. Mapear a los design tokens existentes del proyecto:

| Token | Valor | Uso |
|-------|-------|-----|
| bg | #fafaf8 | Fondo de página |
| surface | #ffffff | Cards, sidebar |
| surface-hover | #f7f7f5 | Hover states |
| border | #e8e6e1 | Bordes principales |
| border-light | #f0eee9 | Separadores internos |
| text-primary | #1a1a1a | Texto principal |
| text-secondary | #6b6b6b | Labels, texto secundario |
| text-tertiary | #9a9a9a | Metadatos, hints |
| expense-bg | #fff5f3 | Fondo iconos gasto |
| expense-text | #c4442a | Texto/color gasto |
| income-bg | #f0f7f1 | Fondo iconos ingreso |
| income-text | #2d7a3a | Texto/color ingreso |
| blue-light | #eef3ff | Fondo badges admin |
| blue | #4a6cf7 | Texto badges admin, botón invitar |
| amber-bg | #fff8eb | Fondo invitaciones pendientes |
| amber-text | #a16207 | Texto invitaciones pendientes |

---

## Notas de implementación

1. **Reusar componentes existentes:** El CRUD de categorías, el flujo de invitaciones y la gestión de miembros ya funcionan. Mover la lógica existente a los nuevos `page.tsx` sin reescribirla.
2. **`page.tsx` raíz:** Debe hacer redirect a `/general` con `redirect()` de Next.js.
3. **Datos por panel:** Cada panel solo carga los datos que necesita. General carga config de cuenta, Members carga miembros + invitaciones, Categories carga categorías. No cargar todo en el layout.
4. **Acciones hover vs siempre visibles:** En categorías y miembros las acciones se muestran solo al hover (opacity 0 → 1). En invitaciones las acciones son siempre visibles porque son más urgentes/accionables.
5. **Mobile web:** El sidebar se oculta en < 768px. Por ahora no implementar alternativa mobile — se hará en un siguiente paso.
6. **Animaciones:** Transiciones sutiles en hover states (0.12s-0.15s ease). No hacer animaciones de entrada en los paneles.
