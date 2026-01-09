# Finnon — Color Tokens (v1)

> Fuente de verdad para el uso de color en Finnon.  
> Estos tokens definen **intención**, no decoración.

---

## Principios

- Los tokens son **semánticos**, no descriptivos.
- No se introducen nuevos colores sin justificación funcional.
- El color **no define jerarquía**, solo acción, estado o impacto.
- La consistencia es prioritaria frente a la expresividad.

---

## Light Mode

### Background

| Token | Valor | Uso |
|------|------|-----|
| `color.bg.primary` | `#FFFFFF` | Fondo principal de la aplicación |
| `color.bg.secondary` | `#F7F8FA` | Secciones suaves, agrupaciones |
| `color.bg.surface` | `#FFFFFF` | Paneles, cards, formularios |

---

### Text

| Token | Valor | Uso |
|------|------|-----|
| `color.text.primary` | `#1C1E21` | Texto principal |
| `color.text.secondary` | `#5F6368` | Texto secundario |
| `color.text.muted` | `#9AA0A6` | Texto desactivado o auxiliar |

---

### Action

| Token | Valor | Uso |
|------|------|-----|
| `color.action.primary` | `#5B8DFF` | CTA principal, acciones confirmatorias |
| `color.action.secondary` | `#E8EEFF` | Estados activos suaves, focos |
| `color.action.disabled` | `#C7D2FE` | Acciones no disponibles |

---

### State

| Token | Valor | Uso |
|------|------|-----|
| `color.state.positive` | `#2E7D65` | Confirmaciones, estados correctos |
| `color.state.negative` | `#B23B3B` | Errores, alertas contenidas |
| `color.state.neutral` | `#DADCE0` | Divisores, estados neutros |

---

## Dark Mode

### Background

| Token | Valor | Uso |
|------|------|-----|
| `color.bg.primary` | `#0E0F12` | Fondo principal |
| `color.bg.secondary` | `#15171C` | Secciones suaves |
| `color.bg.surface` | `#1C1F26` | Paneles, cards |

---

### Text

| Token | Valor | Uso |
|------|------|-----|
| `color.text.primary` | `#F1F3F4` | Texto principal |
| `color.text.secondary` | `#B0B3B8` | Texto secundario |
| `color.text.muted` | `#7A7D81` | Texto desactivado |

---

### Action

| Token | Valor | Uso |
|------|------|-----|
| `color.action.primary` | `#FFFFFF` | CTA principal |
| `color.action.secondary` | `#2A2D34` | Estados activos suaves |
| `color.action.disabled` | `#3A3D44` | Acciones no disponibles |

---

### State

| Token | Valor | Uso |
|------|------|-----|
| `color.state.positive` | `#4CAF91` | Confirmaciones |
| `color.state.negative` | `#E57373` | Errores contenidos |
| `color.state.neutral` | `#2A2D34` | Estados neutros |

---

## Tokens Prohibidos

No se deben introducir:
- Gradientes decorativos
- Colores saturados
- Transparencias con fin estético
- Variantes no documentadas de estos tokens

---

## Reglas para el agente de código

- Usar siempre tokens, nunca valores directos.
- No crear tokens nuevos sin revisión de producto.
- No reinterpretar el significado de un token.
- Si hay duda, usar el token más neutro.

---

## Nota final

> El color en Finnon debe sentirse inevitable, no diseñado.
