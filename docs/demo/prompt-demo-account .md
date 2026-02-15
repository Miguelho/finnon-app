# Tarea: Crear cuenta demo para la revisión de Google Play Store

## Contexto
Finnon usa Supabase Auth con `signInWithOtp` para autenticación. Google Play Store requiere credenciales de acceso para que su equipo de revisión pueda probar la app. Como la app solo permite login con email + código OTP, necesitamos una cuenta demo con un código OTP fijo que permita al revisor entrar sin recibir un email real.

## Parte 1: Autenticación con OTP fijo para cuenta demo

### Enfoque
Crear un mecanismo que permita que un email específico de demo (`review@finnon.app`) se autentique con un código OTP fijo (`000000`) sin pasar por el flujo real de Supabase OTP.

### Implementación

1. **Variables de entorno:** Crear variables de entorno para las cuentas demo:
   - `DEMO_ACCOUNT_EMAILS=review@finnon.app,review-en@finnon.app`
   - `DEMO_ACCOUNT_OTP=000000`
   - `DEMO_ACCOUNT_PASSWORDS=<contraseñas seguras>`

2. **Crear las cuentas demo en Supabase:**
   - Crear los usuarios `review@finnon.app` y `review-en@finnon.app` en Supabase Auth a través del dashboard o con el Admin SDK.
   - Asignarles contraseñas seguras almacenadas en variables de entorno. Estas contraseñas nunca serán visibles para el usuario — solo se usan internamente.

3. **Modificar el flujo de envío de OTP:**
   - Cuando el usuario introduce un email que está en la lista de emails demo, **no llamar** a `signInWithOtp` de Supabase. En su lugar, simular el envío exitoso (mostrar la pantalla de "introduce tu código" sin enviar email real).
   - Para cualquier otro email, el flujo sigue exactamente igual que ahora.

4. **Modificar el flujo de verificación de OTP:**
   - Cuando el email es uno de los demo y el código introducido es `000000`, **no llamar** a `verifyOtp`. En su lugar, autenticar al usuario usando `signInWithPassword` del Admin SDK o una API route de Next.js que use el Supabase Admin Client con la contraseña correspondiente almacenada en la variable de entorno.
   - La sesión resultante debe ser idéntica a la de cualquier otro usuario autenticado (mismo token, mismas cookies, mismo estado de auth).
   - Para cualquier otro email, el flujo de verificación sigue exactamente igual que ahora.

5. **Seguridad:**
   - La lógica de bypass solo debe activarse cuando `DEMO_ACCOUNT_EMAIL` está definido en las variables de entorno. Si se eliminan las variables, el bypass desaparece automáticamente.
   - Comparar el email de forma case-insensitive y trimmeada.
   - Loguear un warning cuando se usa el flujo demo para tener visibilidad.

### Flujo resumido

```
Usuario introduce email → ¿Está en DEMO_ACCOUNT_EMAILS?
  ├─ SÍ → Mostrar pantalla de código (sin enviar OTP real)
  │        Usuario introduce código → ¿Es DEMO_ACCOUNT_OTP?
  │          ├─ SÍ → signInWithPassword con la contraseña correspondiente → sesión activa
  │          └─ NO → Mostrar error "código incorrecto"
  └─ NO → Flujo normal de signInWithOtp → verifyOtp
```

## Parte 2: Datos de ejemplo (seed) para la cuenta demo

### Enfoque
Crear un script de seed que pueble la cuenta demo con datos realistas para que el revisor pueda ver todas las funcionalidades de la app.

### Requisitos del script
- Debe ser un script ejecutable independiente (por ejemplo `scripts/seed-demo-account.ts` o similar).
- Debe usar el Supabase Admin Client para insertar datos asociados al usuario `review@finnon.app`.
- Debe ser **idempotente**: si se ejecuta varias veces, limpia los datos previos de la cuenta demo antes de insertar.
- Debe respetar todas las foreign keys, RLS policies, y la estructura de datos existente en el proyecto.

### Datos a generar

**Importante:** Revisa los tipos, tablas y relaciones del proyecto antes de crear los datos. Los nombres de campos, tablas y enums que uso aquí son orientativos — adáptalos a la estructura real del código.

Crear dos cuentas demo con datos de seed diferenciados por idioma/mercado:

---

#### Cuenta demo ES — `review@finnon.app` (mercado hispanohablante)

**Movimientos/Transacciones:**
Generar al menos 30 movimientos distribuidos en los últimos 3 meses con variedad de:
- **Gastos comunes:** Mercadona, Carrefour, restaurantes, transporte público (Renfe, metro), suscripciones (Netflix, Spotify, gimnasio), gasolina (Repsol, Cepsa), farmacia, Zara/Primark.
- **Ingresos:** nómina mensual (~2.200€), algún ingreso puntual (Wallapop, devolución de Hacienda).
- **Cantidades realistas en EUR:** supermercado 45-120€, restaurantes 25-60€, transporte 20-50€, etc.
- **Distribución temporal:** más movimientos en días laborables, alguno en fin de semana.
- Descripciones de movimientos en español.

**Pagos recurrentes:**
- Alquiler: 850€/mes
- Electricidad (Iberdrola): ~65€/mes
- Internet (Movistar): 35€/mes
- Netflix: 17,99€/mes
- Spotify: 10,99€/mes
- Gimnasio (Basic-Fit): 39,99€/mes
- Seguro coche (Mapfre): 45€/mes

**Objetivos financieros:**
- "Vacaciones de verano" — objetivo 2.000€, progreso ~60%
- "Fondo de emergencia" — objetivo 6.000€, progreso ~25%
- "Portátil nuevo" — objetivo 1.200€, progreso ~85%

---

#### Cuenta demo EN — `review-en@finnon.app` (mercado angloparlante)

Esta cuenta debe crearse con el mismo mecanismo de bypass de OTP (mismas variables de entorno extendidas o una lista de emails demo). Mismo código OTP fijo `000000`.

**Movimientos/Transacciones:**
Generar al menos 30 movimientos distribuidos en los últimos 3 meses con variedad de:
- **Gastos comunes:** Tesco, Sainsbury's, restaurants, Uber/TfL, suscripciones (Netflix, Spotify, gym), petrol (BP, Shell), pharmacy (Boots), clothing (H&M, Primark).
- **Ingresos:** salary (~£2.400/mes), algún ingreso puntual (eBay sale, tax refund).
- **Cantidades realistas en GBP:** groceries £40-100, restaurants £20-55, transport £15-45, etc.
- **Distribución temporal:** más movimientos en días laborables, alguno en fin de semana.
- Descripciones de movimientos en inglés.

**Pagos recurrentes:**
- Rent: £1.100/month
- Electricity (British Gas): ~£75/month
- Internet (BT): £32/month
- Netflix: £10.99/month
- Spotify: £10.99/month
- Gym (PureGym): £24.99/month
- Car insurance (Admiral): £55/month

**Objetivos financieros:**
- "Summer holiday" — objetivo £1.800, progreso ~60%
- "Emergency fund" — objetivo £5.000, progreso ~25%
- "New laptop" — objetivo £1.000, progreso ~85%

### Ejecución
El script debe poder ejecutarse con un comando simple, por ejemplo:
```bash
npx tsx scripts/seed-demo-account.ts
```

Documentar el comando en un comentario al inicio del script.

## Consideraciones importantes
- **No modifiques** la lógica de autenticación para usuarios normales. El bypass es exclusivamente para el email demo.
- **No hardcodees** credenciales en el código. Todo debe estar en variables de entorno.
- Revisa la estructura actual del proyecto (tipos, tablas, stores, servicios de auth) antes de implementar. Adáptate a lo que existe.
- Si el proyecto tiene diferentes archivos o servicios de autenticación para web y móvil, el bypass debe funcionar en **ambas plataformas**.

## Variables de entorno a crear
```
DEMO_ACCOUNT_EMAILS=review@finnon.app,review-en@finnon.app
DEMO_ACCOUNT_PASSWORDS=<generar contraseña segura para cada cuenta, separadas por coma>
DEMO_ACCOUNT_OTP=000000
```

Alternativamente, si el agente lo considera más limpio, puede usar un JSON o dos sets de variables separadas (`DEMO_ACCOUNT_EMAIL_ES`, `DEMO_ACCOUNT_EMAIL_EN`, etc.). Lo importante es que no estén hardcodeadas en el código.

## Resultado esperado
1. Un revisor de Google Play puede abrir la app, introducir `review@finnon.app` (o `review-en@finnon.app`), recibir la pantalla de código, introducir `000000`, y acceder a la app con una sesión válida.
2. La cuenta `review@finnon.app` muestra datos de ejemplo en español con montos en EUR y referencias al mercado español.
3. La cuenta `review-en@finnon.app` muestra datos de ejemplo en inglés con montos en GBP y referencias al mercado angloparlante.
4. Ambas cuentas tienen datos realistas que demuestran todas las funcionalidades: movimientos variados, pagos recurrentes configurados, y objetivos financieros en diferentes estados de progreso.
