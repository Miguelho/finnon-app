Estado por defecto (OFF) — compacto

En vez de una card grande, usa una fila dentro de una card pequeña (o dentro de la card “Fecha” si prefieres):

Label: Obligación
Right: [toggle OFF]
Subtexto: ninguno (o opcional: un icono i)

Icono info (opcional):

Tocar i abre tooltip/bottom-sheet mini:

Título: ¿Qué es una obligación?

Texto: Un pago pendiente o programado que aún no has pagado.

Resultado: ocupa lo mismo que una row normal, no un bloque completo.

Estado ON — aparece configuración inline (mini panel)

Al activar el toggle, se despliega debajo (animación suave) un mini panel con 2–3 controles máximo:

Tipo de obligación (segmented compact)

Pendiente | Programada

Fecha prevista (solo si “Programada”)

Botón compacto: Elegir fecha

Valor en texto: mié, 28 ene 2026

Resumen visible (si no quieres ver el panel siempre)

Alternativa: en vez del panel siempre abierto, al activar ON se abre un bottom sheet para configurar y luego se muestra un chip resumen:

Obligación: Programada · 28 ene [Editar]

Recomendación: inline si son 2 campos, chip + editar si crece a futuro.

Copy exacto
Fila compacta

Obligación

(tooltip) Un pago pendiente o programado que aún no has pagado.

Segmented

Pendiente

Programada

Chips resumen (si lo usas)

Obligación: Pendiente

Obligación: Programada · 28 ene

Sugerencia contextual (solo cuando aplica)

Cuando el usuario selecciona una fecha futura y obligación está OFF:

Texto:

Esta fecha es futura. ¿Quieres guardarlo como obligación?

Acciones:

[Marcar como obligación] (primaria sutil)

[Ahora no] (link)

Si el usuario acepta:

Toggle pasa a ON

Tipo por defecto: Programada

Fecha prevista = la fecha ya seleccionada

Reglas de comportamiento

Default

is_obligation = false

No se muestra panel de configuración.

Toggle ON

Si la fecha actual del movimiento es futura → set obligation_type = Programada y scheduled_date = movement_date

Si la fecha es hoy o pasada → set obligation_type = Pendiente (sin fecha prevista)

Toggle OFF

Oculta panel

Limpia campos: obligation_type = null, scheduled_date = null

(Opcional) Si había datos, mostrar toast: Obligación eliminada

Cambio de fecha

Si el usuario cambia a futura y obligación OFF → mostrar sugerencia contextual una vez (no spamear).

Si obligación ON y tipo Programada → scheduled_date se sincroniza con la fecha del movimiento solo si el usuario no editó explícitamente la fecha prevista (flag scheduled_date_overridden).

Detalles UI finos

La fila compacta debe tener el mismo padding que el resto de cards.

El panel desplegable debe tener:

separador fino arriba (o spacing extra)

controles “compact” (altura menor que inputs grandes)

Animación: height + opacity en 150–200ms.

DoD (Definition of Done)

 Obligación OFF ocupa una sola fila (no card alta)

 Toggle ON muestra configuración (inline o bottom sheet) y guarda datos

 Sugerencia aparece solo con fecha futura y se puede descartar

 Estado persistente al editar un movimiento existente

 Accesibilidad: labels claros, toggle con texto, targets > 44px

 chip resumen + “Editar”. Así lo dejaría, directo y sin comerse espacio.

UI
Estado OFF (compacto)

Fila: Obligación …… [toggle OFF]
Sin descripción larga (si quieres ayuda: icono i).

Al activar ON

Se abre bottom sheet/modal “Configurar obligación”

Al guardar, el bottom sheet se cierra y aparece un chip resumen debajo de la fila:

Chip: Obligación: Programada · 28 ene [Editar] (y opcional ❌ para quitar)

Si el tipo es pendiente: Obligación: Pendiente

Bottom sheet: “Configurar obligación”

Tipo (segmented):

Pendiente | Programada

Fecha prevista (solo si Programada):

selector de fecha

CTA:

Guardar (primario)

Cancelar (secundario)

Defaults:

Si la fecha del movimiento es futura → Programada + fecha prevista = esa fecha.

Si es hoy/pasada → Pendiente.

Comportamiento

Toggle ON sin configuración previa ⇒ abre el bottom sheet.

Toggle ON con configuración existente ⇒ no abre; solo muestra el chip.

Tap en Editar ⇒ abre el bottom sheet precargado.

Toggle OFF ⇒ desaparece el chip y se limpian campos de obligación.