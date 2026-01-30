Flujo de invitados; invitar a un usuario no funciona. cuando el usuario ve que tiene una invitación, le pide el código de acceso. Hay dos flujos:
1. mediante código: yo admin doy a un tercero un código que puede introducir
2. a través de invitación: si al usuario le llega, la aplicación debería permitir acceder sin tener que hacer nada más. Actualmente, si te llega una invitación no puedes acceder con la invitación, sino que tienes que meter también el código.

Cómo debería ser?
- Si el usuario NO tiene ninguna cuenta, la invitación se muestra en el selector de cuentas.
- Si el usuario ya tiene una cuenta activa, puede encontrar la invitación en el menú de invitaciones.
- En el buzón de invitaciones, el usuario puede aceptar la invitación o cancelarla.
  - Aceptar: redirige automáticamente al selector de cuenta.
  - Cancelar: deja la invitación pendiente hasta que caduque.
- Rechazar invitación: se hace desde el menú de tres puntos.

Definir estados y reglas del flujo
Estados: pendiente, aceptada, cancelada, caducada.
Regla clave: si llega invitación válida, no solicitar código; permitir aceptar/cancelar desde el buzón.
Unificar UX del buzón de invitaciones
Listado de invitaciones pendientes con CTA: “Aceptar” y “Cancelar”.
Al “Aceptar”: marcar invitación como aceptada y redirigir a selector de cuenta.
Al “Cancelar”: dejarla pendiente (si así se desea) o marcar como cancelada explícitamente; definir cuál es el comportamiento esperado.
Backend/API (si aplica)
Endpoint para listar invitaciones activas del usuario.
Endpoint para aceptar invitación (validación, expiración).
Endpoint para cancelar/rechazar invitación (opcionalmente mantiene pendiente hasta caducidad).
Reglas de seguridad y expiración
Validar que la invitación no esté caducada ni ya usada.
Manejar expiración automática y mostrar mensaje si caducó.
Actualizar documentación
Documentar ambos flujos: por código y por invitación.
Aclarar que el flujo por invitación no requiere código extra.
Pruebas
Caso feliz: invitación válida → aceptar → selector de cuenta.
Casos límite: invitación caducada, ya aceptada, usuario sin invitaciones.

Admin introduce email → Crea invitación
Se muestra inmediatamente el código como opción secundaria
El usuario puede aceptar por invitación in-app O usar el código si no le llega
El código está ligado al email - solo ese usuario puede usarlo