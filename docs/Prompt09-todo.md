# Prompt 9: Sistema de Invitaciones - Mejoras Futuras

Este documento registra las mejoras y funcionalidades pendientes para implementar en futuras iteraciones del sistema de invitaciones.

## Fase 1: UI de Gestión de Invitaciones

### Implementación Web
- [ ] Crear página `/settings/invites` con lista de invitaciones
- [ ] Agregar botón "Crear Invitación" con modal de formulario
- [ ] Mostrar invitaciones activas en tabla con:
  - Rol (viewer/contributor/admin)
  - Fecha de expiración
  - Usos (actuales/máximo)
  - Creado por
  - Fecha de creación
  - Acciones (Copiar link, Revocar, Eliminar)
- [ ] Implementar copy-to-clipboard con notificación toast
- [ ] Agregar funcionalidad de revocar invitación (setea `revoked_at`)
- [ ] Agregar funcionalidad de eliminar invitación (soft delete o hard delete)
- [ ] Filtrar invitaciones por estado (activas, expiradas, revocadas)

### Implementación Mobile
- [ ] Crear pantalla de Settings con sección de gestión de invitaciones
- [ ] Implementar native share sheet para links de invitación
- [ ] Agregar pull-to-refresh para lista de invitaciones
- [ ] Usar React Native Share API para compartir multi-plataforma

## Fase 2: Analítica de Invitaciones

- [ ] Trackear quién se unió vía cada invitación (agregar columna `joined_via_invite_id` a `account_members`)
- [ ] Crear dashboard de analíticas mostrando:
  - Total de invitaciones enviadas
  - Tasa de aceptación
  - Miembros activos por fuente de invitación
  - Métricas de tiempo-hasta-aceptación
- [ ] Agregar atribución de invitación a lista de miembros

## Fase 3: Funcionalidades Avanzadas de Invitación

- [ ] **Mensajes personalizados**: Agregar campo `message` a tabla invites
- [ ] **Invitaciones por email**: Enviar links de invitación vía email (integrar con servicio de email)
- [ ] **Landing pages específicas por rol**: Diferentes flujos de onboarding para viewer/contributor/admin
- [ ] **Templates de invitación**: Configuraciones predefinidas de invitación (ej: "acceso viewer 24h")
- [ ] **Invitaciones masivas**: Subir CSV de emails y auto-generar invitaciones
- [ ] **Recordatorios de expiración**: Notificar a admins sobre invitaciones próximas a expirar

## Fase 4: Mejoras Post-Join

- [ ] **Workflow de upgrade de rol**: Permitir que miembros soliciten actualización de rol
- [ ] **Completar perfil de miembro**: Prompt para usuarios anónimos de "reclamar cuenta" agregando email
- [ ] **Tour de bienvenida**: Flujo de onboarding para nuevos miembros explicando features de la app
- [ ] **Switcher de cuentas**: Selector rápido para usuarios en múltiples cuentas

## Fase 5: Mejoras de Seguridad

- [ ] **Rate limiting**: Prevenir abuso de invitaciones con límites de tasa en endpoint accept
- [ ] **Tracking de IP**: Loguear direcciones IP de aceptaciones de invitación para auditorías de seguridad
- [ ] **Restricciones de dominio**: Permitir invitaciones solo para dominios de email específicos (ej: @company.com)
- [ ] **Verificación de dos factores**: Requerir verificación de email antes de aceptar invitación
- [ ] **Protección con contraseña**: Contraseña opcional para invitaciones sensibles

## Fase 6: Deep Linking en Mobile

- [ ] Configurar Expo Linking para `finnon://join?token=...` deep links
- [ ] Agregar universal links para iOS (asociar dominio web)
- [ ] Agregar App Links para Android
- [ ] Manejar routing de deep link en `_layout.tsx`

## Fase 7: Testing y Documentación

- [ ] Escribir unit tests para utilidades de invitación (generación de tokens, hashing)
- [ ] Escribir integration tests para rutas API
- [ ] Agregar E2E tests para flujo de invitación (Playwright/Cypress)
- [ ] Documentar API de invitaciones en especificación OpenAPI
- [ ] Crear guía de usuario para feature de invitación

## Deuda Técnica

- [ ] Implementar manejo apropiado de transacciones para aceptación de invitación (usar Supabase Edge Functions o Postgres RPC)
- [ ] Agregar índices de base de datos para performance (`invites.expires_at`, `invites.account_id`)
- [ ] Implementar cron job de limpieza de invitaciones (eliminar invitaciones expiradas mayores a 30 días)
- [ ] Agregar monitoreo y alertas para fallos de aceptación de invitación
- [ ] Implementar protección CSRF para rutas API

## Limitaciones Conocidas

1. **Sin transacciones atómicas**: El cliente de Supabase no soporta transacciones, por lo que la aceptación de invitación usa actualizaciones optimistas
2. **Configuración CORS**: La app mobile llamando a la API web requiere configuración CORS (alternativa: acceso directo a DB)
3. **Limpieza de usuarios anónimos**: No hay limpieza automatizada de usuarios anónimos que nunca reclaman su cuenta
4. **Seguridad de link de invitación**: Tokens en URL pueden ser logueados en historial del navegador/logs del servidor (considerar aceptación basada en POST)

## Ideas para Exploración

- [ ] **Invitaciones con QR code**: Generar códigos QR para links de invitación
- [ ] **Invitaciones con cuenta regresiva**: Mostrar cuenta regresiva visual en página de invitación
- [ ] **Cadenas de invitación**: Trackear cadenas de referidos (quién invitó a quién)
- [ ] **Gamificación**: Recompensar usuarios por invitar a otros (puntos, badges)
- [ ] **Integración con plataformas sociales**: Compartir invitaciones vía WhatsApp, Telegram, etc.

---

## Próximos Pasos Inmediatos

1. Testear exhaustivamente el flujo de creación y aceptación de invitaciones en web
2. Testear el mismo flujo en mobile
3. Validar políticas RLS con queries directas
4. Probar casos edge (doble-join, joins concurrentes, etc.)
5. Documentar cualquier hallazgo durante testing y agregarlo a este archivo
