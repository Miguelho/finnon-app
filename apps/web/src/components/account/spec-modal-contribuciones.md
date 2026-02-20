# Spec: Modal de detalle de contribuciones

## Referencia visual

El wireframe `wireframe-balance-visual.html` es la referencia de diseño para este componente. Incluye versión web y móvil.

---

## 1. Descripción

Modal que muestra el desglose visual del balance de contribuciones entre los miembros de una cuenta compartida. Se activa al hacer click en el banner de contribución situado debajo del balance total en "Tu Cuenta".

El objetivo es hacer transparente el cálculo que produce el mensaje del banner (ej: "Ana contribuyó en €1.023,97 más que Carlos este mes"), eliminando el efecto "caja negra".

---

## 2. Trigger

- **Elemento clickable:** el banner de contribución (pill con mini-avatar + mensaje de refuerzo positivo).
- **Cursor:** pointer en web.
- **Feedback visual:** el banner debe tener un hover state sutil (ligero oscurecimiento del fondo o scale 1.02) para indicar que es interactivo.
- **Solo disponible** en cuentas con 2+ miembros activos.

---

## 3. Componente modal

### 3.1 Tipo

- **Web:** modal centrado con overlay semitransparente (rgba(0,0,0,0.3)). Max-width: 560px.
- **Móvil:** bottom sheet que sube desde abajo, con drag handle para cerrar. Border-radius top: 20px.
- Cerrar con: click en overlay (web), botón X, swipe down (móvil), tecla Escape (web).

### 3.2 Contenido

El modal muestra para **cada miembro** de la cuenta (contributor/admin, excluyendo viewers):

```
[Avatar] Nombre completo                    [Badge saldo: +€512,47 / -€511,50]

Pagó             [========barra sólida========]     €1.318,97
Le corresponde   [=====barra opacidad 30%=====]       €806,50
```

#### Detalle de cada elemento:

**Header por usuario:**
- Avatar (28px web, 24px móvil) con color del usuario.
- Nombre completo del miembro.
- Badge de saldo neto a la derecha:
  - Positivo (ha pagado más de lo que le toca): fondo verde sutil, texto verde, prefijo "+".
  - Negativo (ha pagado menos de lo que le toca): fondo rojo sutil, texto rojo, prefijo "-".
  - Cálculo: `saldo = total_pagado - total_que_le_corresponde`.

**Barras duales:**
- **Barra "Pagó":** color sólido del avatar del usuario. Ancho proporcional al total pagado respecto al máximo entre todos los valores (pagado y correspondiente de todos los usuarios).
- **Barra "Le corresponde":** mismo color del avatar pero con opacidad 30%. Ancho proporcional al total que le corresponde respecto al mismo máximo.
- **Labels:** "Pagó" / "Le corresponde" a la izquierda de cada barra (ancho fijo: 72px web, 56px móvil).
- **Importes:** alineados a la derecha de cada barra.

**Escala de las barras:**
Todas las barras del modal comparten la misma escala para que sean comparables visualmente:

```typescript
const maxValue = Math.max(
  ...members.flatMap(m => [m.totalPagado, m.totalResponsable])
);
// Cada barra: width = (valor / maxValue) * 100%
```

**Separador:**
Entre cada usuario, línea sutil (1px, color card-border).

**Mensaje resumen:**
Al final del modal, el mismo mensaje del banner: pill con mini-avatar + texto de refuerzo positivo. Actúa como cierre/confirmación visual.

---

## 4. Datos necesarios

El modal consume el mismo `BalanceResult[]` que ya se calcula para el banner:

```typescript
interface BalanceResult {
  userId: string;
  userName: string;
  avatarColor: string;
  totalPagado: number;
  totalResponsable: number;
  saldoNeto: number;  // totalPagado - totalResponsable
}
```

No requiere queries adicionales. El cálculo ya existe en la función `calcularBalance` de la spec principal.

---

## 5. Internacionalización

| Key | ES | EN |
|-----|----|----|
| `balance_detail.title` | Detalle de contribuciones | Contribution details |
| `balance_detail.paid` | Pagó | Paid |
| `balance_detail.responsibility` | Le corresponde | Owes |
| `balance_detail.period_context` | Este {period} | This {period} |

Reutilizar del spec principal:
- `account.contribution_banner` / `account.contribution_banner_equal` para el mensaje resumen.
- `account.period_week` / `period_month` / `period_quarter` / `period_year` para el período.

---

## 6. Versión web

- Modal centrado, max-width 560px, padding 24px.
- Overlay: rgba(0,0,0,0.3), click para cerrar.
- Border-radius: 16px.
- Animación de entrada: fade in + scale de 0.95 a 1 (200ms ease-out).
- Animación de salida: fade out + scale a 0.95 (150ms ease-in).
- Botón cerrar (X): esquina superior derecha, 32px, icono existente de la app.
- Bar labels: 72px de ancho fijo.
- Barras: 12px de altura, border-radius 6px.
- Avatares: 28px.
- Saldo badge: font-size 14px, padding 3px 10px, border-radius 100px.

---

## 7. Versión móvil

- Bottom sheet desde abajo, border-radius top 20px.
- Drag handle centrado arriba: 36px × 4px, border-radius 2px, color grey-light.
- Animación: slide up (250ms ease-out).
- Cerrar: swipe down, tap en overlay, botón X.
- Max-height: 80vh, scroll si hay muchos miembros.
- Bar labels: 56px de ancho fijo, font-size 10px.
- Barras: 10px de altura.
- Avatares: 24px.
- Importes: font-size 10px.
- Saldo badge: font-size 12px.
- Mensaje resumen: font-size 11px, texto corto (ej: "Ana contribuyó €1.023,97 más").

---

## 8. Cuentas con N > 2 miembros

El modal escala verticalmente: un bloque de avatar + barras duales + saldo por cada miembro, separados por líneas. El mensaje resumen compara los dos extremos (mayor contribuidor vs menor contribuidor).

Si hay más de 4 miembros, el contenido hace scroll dentro del modal.

---

## 9. Criterios de aceptación

1. El banner de contribución es clickable y muestra hover state.
2. Click abre modal (web) o bottom sheet (móvil).
3. El modal muestra un bloque por cada miembro contributor/admin.
4. Cada bloque tiene avatar, nombre, badge de saldo, barra "Pagó" y barra "Le corresponde".
5. Las barras usan el color del avatar del usuario. "Le corresponde" tiene opacidad 30%.
6. Todas las barras comparten la misma escala (proporcional al valor máximo global).
7. El saldo badge es verde/positivo cuando el usuario pagó más de lo que le corresponde, rojo/negativo cuando pagó menos.
8. El mensaje resumen al final coincide con el texto del banner.
9. Los importes y barras reflejan el período seleccionado (semana/mes/trimestre/año).
10. Copys disponibles en ES y EN.
11. Modal se cierra con overlay click, botón X, Escape (web), swipe down (móvil).
12. En cuentas con 1 miembro, el banner no existe y este modal no es accesible.
