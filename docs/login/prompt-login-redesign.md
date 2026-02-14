# Rediseño pantalla de Login — Finnon

## Contexto

Finnon es una app de gestión financiera colaborativa (parejas, compañeros de piso, individuos). El login usa **Supabase Auth OTP** (ya configurado y funcional). No hay distinción entre crear cuenta e iniciar sesión — es el mismo flujo.

El stack es **React Native (Expo managed)** para móvil y **Next.js** para web, con un módulo compartido `@poleursus/shared`. Zustand para estado global, Expo Router para navegación, Tailwind para estilos web.

## Referencia visual

Adjunto el archivo `finnon-login-redesign.html` como wireframe interactivo. Tiene un toggle para alternar entre vista móvil y web. **Este es el diseño a implementar.** Abrir en navegador para ver ambas versiones.

## Qué hay que hacer

Rediseñar la pantalla de login existente en ambas plataformas. No tocar la lógica de autenticación de Supabase — solo la capa de presentación.

## Estructura general

### Móvil (React Native)

Una sola pantalla vertical con tres bloques:

1. **Logo + bienvenida** — Logo de Finnon (72x72, borderRadius 18), título "Finnon", subtítulo "Tus finanzas en equipo, sin complicaciones. Empieza ya con tu correo."
2. **Formulario** — Input de email, botón "Continuar", texto explicativo "Te enviaremos un enlace mágico. Sin contraseñas, sin complicaciones.", y debajo un link discreto: "¿Problemas con el enlace? Prueba con un código"
3. **Footer** — Divider con texto "hecho para dos o más", dos feature pills: "Cuentas compartidas" y "Objetivos en equipo"

Motivo decorativo: dos círculos (uno oscuro, uno azul muted) con ligero solapamiento, posicionados abajo a la derecha, opacidad muy baja (~0.06). Referencia visual: los dos puntos del icono de Finnon.

### Web (Next.js) — Split screen

- **Panel izquierdo (flex: 1, fondo oscuro ~#1A1A1A):** Logo + wordmark arriba a la izquierda. Headline grande: "Tus finanzas en equipo." Subtítulo + tres value props con dots azules: "Cuentas compartidas con control individual", "Objetivos de ahorro en equipo", "Insights que motivan, no que venden"
- **Panel derecho (flex: 0 0 440px, fondo claro ~#F6F5F1):** Título "Bienvenido", subtítulo, formulario idéntico al móvil. Footer con texto "Finnon no se conecta a tu banco. Tú decides qué compartir." Círculos decorativos abajo a la derecha del panel, mismos colores que en móvil.

## Comportamiento del formulario

El flujo por defecto es **magic link**:

1. Usuario introduce email → pulsa "Continuar"
2. Se llama a `supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } })`
3. Feedback visual: botón pasa a "Enviando..." → "Enlace enviado ✓"

**Fallback a código:** Si el usuario pulsa "Prueba con un código":

1. El botón cambia a "Enviar código"
2. Se llama al mismo `signInWithOtp` pero gestionando la verificación por código
3. Se navega a una pantalla de verificación de código (o inline, a criterio del desarrollador)

## Tokens de diseño

Usar los valores que ya existan en el sistema de diseño del proyecto. Como referencia del wireframe:

- Fondo general: `#F6F5F1`
- Texto primario: `#1A1A1A`
- Texto secundario: `#6B6B6B`
- Texto terciario: `#9A9A9A`
- Bordes: `#E5E3DE`
- Acento (botón): `#2D2D2D`
- Azul muted (dots decorativos): `#B0BEC5`
- Border radius inputs/botones: 14
- Border radius logo: 18
- Tipografía: DM Sans (o la que ya use el proyecto)

## Copy exacto

- Título: "Finnon"
- Subtítulo móvil: "Tus finanzas en equipo, sin complicaciones. Empieza ya con tu correo."
- Label input: "Correo electrónico"
- Placeholder: "tu@email.com"
- Botón: "Continuar"
- Helper: "Te enviaremos un enlace mágico." + "Sin contraseñas, sin complicaciones."
- Fallback: "¿Problemas con el enlace? Prueba con un código"
- Divider móvil: "hecho para dos o más"
- Features: "Cuentas compartidas" / "Objetivos en equipo"
- Headline web: "Tus finanzas en equipo."
- Subtítulo web panel derecho: "Empieza directamente con tu correo electrónico."
- Footer web: "Finnon no se conecta a tu banco. Tú decides qué compartir."

## Lo que NO hay que hacer

- No añadir login con Google, Apple, ni ningún proveedor social
- No separar "crear cuenta" de "iniciar sesión"
- No tocar la configuración de Supabase Auth
- No añadir validación de email más allá de formato básico
- No cambiar la navegación post-login existente

## Animaciones

Fade-up sutil al cargar la pantalla, escalonado por bloques (logo → formulario → footer). Transiciones suaves en focus del input y estados del botón. Nada excesivo.
