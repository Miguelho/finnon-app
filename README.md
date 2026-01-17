# Finnon

## Invitaciones in-app (v1)

Flujo
- Admin (web) > Settings > Compartir cuenta: email, rol, enviar. Opcional: generar codigo corto.
- Invitado (web/mobile): ve invitaciones en-app, acepta o rechaza sin links.
- Al aceptar, se crea membership y la cuenta aparece en el selector.

Decisiones
- Se extendio `invites` con `status`, `invited_email` y `code_hash` para soportar inbox in-app.
- Aceptar/rechazar/join-by-code se valida en endpoints server con service role.
- Codigo corto se devuelve una sola vez; en DB solo se guarda el hash.
