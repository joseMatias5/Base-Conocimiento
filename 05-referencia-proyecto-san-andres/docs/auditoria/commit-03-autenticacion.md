# Commit 3 — Sesión firmada, roles en toda la API y PIN con hash

`feat(seguridad): sesión firmada, roles en toda la API y PIN con hash`

**Archivos principales:** `src/lib/session.ts`, `src/lib/auth.ts`, `src/lib/pin.ts`, `src/lib/rate-limit.ts`,
`src/middleware.ts`, `src/app/api/auth/*`, `src/app/api/admin/usuarios/*`, un guard en **cada** ruta de
`src/app/api/**`, `electron/main.js`, `.env.example`.

---

## Hallazgo AT-01 — La sesión se podía fabricar desde el navegador

**Ubicación:** Autenticación | Sesión y middleware | `auth/verify-pin/route.ts`, `middleware.ts`
**Tipo:** Seguridad
**Descripción:** La sesión era una cookie con el JSON `{id, nombre, rol}`, sin firma y legible por JavaScript.

**Evidencia simplificada:**
```ts
cookieStore.set('session', JSON.stringify({ id, nombre, rol }), { httpOnly: false, ... });
// middleware: const session = JSON.parse(cookie.value); if (session.rol !== 'ADMIN') redirect
```

**Problema identificado:** El servidor confiaba en un dato que el propio cliente puede escribir.

**Consecuencias:**
- Cualquiera podía poner `{"rol":"ADMIN"}` en su navegador y abrir `/admin`.
- Un script malicioso (XSS) podía leer la sesión.
- La identidad registrada en el historial de pedidos era falsificable.

**Principios afectados:**
- Never trust the client.
- Defensa en profundidad.
- Mínimo privilegio.

**Recomendación (aplicada):** Cookie firmada con HMAC-SHA256 (`payload.firma`), con expiración de 12 horas, `httpOnly` y `sameSite=lax`. El middleware y las rutas verifican la firma con la misma función. Una cookie alterada o en el formato anterior se rechaza. Sin `SESSION_SECRET` en producción el servidor **falla cerrado** (no inventa un secreto).
**Impacto:** Muy Alto
**Esfuerzo estimado:** Medio

---

## Hallazgo AT-02 — Toda la API era accesible sin iniciar sesión

**Ubicación:** API | Todas las rutas | `middleware.ts` (matcher) y `src/app/api/**`
**Tipo:** Seguridad
**Descripción:** El middleware solo protegía tres rutas de páginas (`/admin`, `/cocina`, `/comandas`). Ninguna ruta de `/api/*` comprobaba sesión ni rol.

**Evidencia simplificada:**
```ts
export const config = { matcher: ['/admin/:path*', '/cocina/:path*', '/comandas/:path*'] };  // sin /api
// ninguna route.ts llamaba a una comprobación de sesión o rol
```

**Problema identificado:** La autorización dependía de lo que mostraba la interfaz, no de lo que permitía el servidor.

**Consecuencias:**
- Un `curl` sin cookie podía cobrar, ver Caja, borrar productos, cambiar PIN de cualquier usuario o leer métricas.
- Con el modo LAN (`0.0.0.0`) lo mismo era posible desde cualquier equipo de la red.

**Principios afectados:**
- Autenticación y autorización en el servidor (OWASP A01: Broken Access Control).
- Mínimo privilegio.

**Recomendación (aplicada):** Un guard `requireAuth(roles?)` al inicio de cada handler (`401` sin sesión, `403` con rol no permitido). Los permisos salen de qué pantalla usa cada endpoint. Un test recorre **todas** las rutas del proyecto y falla si aparece una sin clasificar.
**Impacto:** Muy Alto
**Esfuerzo estimado:** Alto

### Matriz de permisos

| Endpoint | ADMIN | MOZO | COCINERO |
|----------|:-----:|:----:|:--------:|
| `POST /api/auth/verify-pin`, `GET /api/auth/session`, `POST /api/auth/logout`, `GET /api/hub-metrics` | público | público | público |
| `GET`: categorias, productos, mesas, pedidos, pedidos/history, pedidos/[id]/history, events (SSE) | ✅ | ✅ | ✅ |
| `POST /api/pedidos`, `POST /api/checkout/pay`, `PATCH /api/mesas` y `/api/mesas/[id]` | ✅ | ✅ | ❌ |
| `PATCH /api/pedidos`, `/api/pedidos/[id]/cancel`, `/api/pedidos/[id]/items` | ✅ | ❌ | ✅ |
| `POST /api/mesas`, `DELETE /api/mesas/[id]`, `PUT /api/mesas/layout` | ✅ | ❌ | ❌ |
| productos (POST/PUT/DELETE), upload, caja, métricas, costos, proveedores, inventario, admin/usuarios | ✅ | ❌ | ❌ |
| `POST /api/auth/check-admin-pin` | ✅ | ✅ | ✅ (con sesión) |

---

## Hallazgo AT-07 — PIN en texto plano y sin límite de intentos

**Ubicación:** Autenticación | Usuarios | `auth/verify-pin`, `admin/usuarios/[id]/pin`, `prisma/schema.prisma`
**Tipo:** Seguridad
**Descripción:** Los PIN de 4 dígitos se guardaban sin cifrar y se podían probar sin límite.

**Evidencia simplificada:**
```ts
const usuario = await prisma.usuario.findUnique({ where: { pin } });   // PIN en claro, sin límite de intentos
await prisma.usuario.update({ where: { id }, data: { pin } });
```

**Problema identificado:** Credenciales almacenadas en claro y sin defensa contra fuerza bruta (solo 10.000 combinaciones).

**Consecuencias:**
- Quien lea la base de datos conoce todos los PIN.
- Un script puede recorrer los 10.000 PIN en minutos y entrar como administrador.
- `check-admin-pin` permitía esas pruebas sin sesión.

**Principios afectados:**
- Protección de credenciales (OWASP A02/A07).
- Defensa en profundidad.

**Recomendación (aplicada):**
- PIN guardado con **scrypt y sal** (`scrypt1$sal$hash`). Los PIN antiguos en texto plano siguen funcionando y se **migran a hash solos** en el primer login correcto.
- Límite de **10 intentos fallidos / 5 minutos**, después `429` con `Retry-After` durante 60 s. Aplica a `verify-pin` y `check-admin-pin`.
- Como el login es solo por PIN, se comparan los usuarios activos uno a uno; la unicidad del PIN se comprueba en la aplicación (`pinEnUso`), porque la base ya no puede garantizarla.
**Impacto:** Alto
**Esfuerzo estimado:** Medio

---

## Hallazgo AT-15 — Cinco instancias de `PrismaClient`

**Ubicación:** Infraestructura | Acceso a datos | `admin/usuarios`, `admin/usuarios/[id]/pin`, `auth/verify-pin`, `auth/check-admin-pin`, `hub-metrics`
**Tipo:** Mantenibilidad
**Descripción:** Cinco rutas creaban su propio cliente en lugar de usar el singleton de `lib/prisma.ts`.

**Evidencia simplificada:**
```ts
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();      // en 5 archivos (el singleton ya existía)
```

**Problema identificado:** Conexiones duplicadas y configuración repetida (el singleton fija `datasourceUrl`).

**Consecuencias:**
- Más conexiones a SQLite de las necesarias.
- Cada ruta se podía desviar de la configuración central.
- Imposible simular la base en tests.

**Principios afectados:**
- DRY.
- Singleton / inyección de dependencias.

**Recomendación (aplicada):** Todas usan `import prisma from '@/lib/prisma'`. Ya no queda ningún `new PrismaClient()` fuera de `lib/prisma.ts`.
**Impacto:** Medio
**Esfuerzo estimado:** Muy Bajo

---

## Efectos sobre otros hallazgos (parciales)

- **AT-10 (SSE):** `/api/events` ahora exige sesión. Sigue pendiente limpiar el temporizador de heartbeat al cerrarse la conexión.
- **AT-11 (upload):** solo ADMIN puede subir archivos. Sigue pendiente validar el contenido y el tamaño.
- **AT-14 (mesas):** crear, borrar y mover el layout de mesas es solo ADMIN. Siguen pendientes las reglas de negocio (no borrar una mesa con pedidos activos).

---

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| **Sesiones activas** | Al desplegar, las sesiones existentes dejan de valer. Todos deben **volver a iniciar sesión** una vez. |
| `401` / `403` | Cualquier ruta de la API puede responder `{ success: false, error }` con `401` (sin sesión o vencida) o `403` (rol no permitido). **Recomendado:** un interceptor global de `fetch` que ante `401` redirija al inicio. |
| `429` en el login | `verify-pin` puede responder `429` con `Retry-After` y un mensaje con los segundos de espera. Mostrar `data.error`. |
| Cookie `session` | Ahora es `httpOnly`: **no se puede leer con `document.cookie`**. Hoy ninguna pantalla lo hace; el estado del usuario se obtiene con `GET /api/auth/session`. |
| `cajeroId` en `POST /api/checkout/pay` | Se ignora: el cajero es el usuario de la sesión. El frontend puede dejar de enviarlo. |
| Desbloqueo del editor de mesas | Sigue funcionando: `verify-pin` con un PIN de admin **reemplaza la sesión por la del admin** (comportamiento actual, intencionalmente conservado). |
| Respuestas exitosas | Sin cambios de forma. |

## Configuración necesaria

| Entorno | Qué hacer |
|---------|-----------|
| **Desarrollo** (`npm run dev`) | Funciona sin configurar nada, con un secreto de desarrollo y un aviso en consola. Recomendado: poner `SESSION_SECRET` en `.env` (mínimo 32 caracteres). |
| **Producción** (`npm start`) | `SESSION_SECRET` es **obligatorio**. Generar: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| **App de escritorio** (Electron) | Automático: `main.js` genera el secreto una vez y lo guarda en `session.key` dentro de la carpeta de datos del usuario. |

## Cómo verificar
```bash
npm test        # 360 tests acumulados
npm run build
npm run dev
```
Pruebas manuales:
1. Entrar con PIN de **admin**, **mozo** y **cocina**: cada uno llega a su pantalla.
2. Sin sesión, `curl -s -w "\nHTTP %{http_code}\n" http://localhost:3000/api/caja` debe responder `401`.
3. En el navegador, borrar la cookie `session` y recargar `/admin`: redirige al inicio.
4. Fabricar una cookie: en la consola del navegador `document.cookie='session={"id":1,"nombre":"x","rol":"ADMIN"}'` y abrir `/admin`: **debe redirigir** (antes entraba).
5. Con un mozo logueado, `GET /api/caja` debe dar `403`.
6. Equivocarse 10 veces de PIN: el siguiente intento da `429`.
7. **Editor de mesas** (Sala): desbloquear con PIN de admin, mover una mesa, agregar y borrar una mesa, guardar el layout. Debe funcionar igual que antes.
8. Cambiar un PIN desde Admin → Personal e iniciar sesión con el nuevo.

## Pendiente y limitaciones
- **Revocación:** si se desactiva un usuario, su sesión actual sigue valiendo hasta que venza (máximo 12 h). Se puede comprobar el estado del usuario en cada petición si se necesita revocación inmediata.
- **Límite de intentos en memoria y global en LAN:** sin proxy, todos los equipos comparten un contador; alguien podría bloquear el login por 60 s. Se reinicia al reiniciar el servidor.
- **PIN de 4 dígitos:** el hash protege la base de datos, pero el espacio de claves es pequeño. Recomendado a futuro: PIN de 6 dígitos o usuario + contraseña.
- **Cambio de sesión por `verify-pin`:** que un mozo se convierta en admin al desbloquear el editor es un efecto del diseño actual. Una mejora es un endpoint que eleve privilegios por un tiempo corto sin reemplazar la sesión (implica cambios en el frontend).
- **CSRF:** la cookie usa `SameSite=Lax` y las rutas reciben JSON; no hay token CSRF adicional.
- **Cookie `secure`:** solo se activa si la petición es HTTPS, porque en modo LAN (`http://IP:3000`) el navegador descartaría una cookie `secure`.
- **Electron:** el cambio en `electron/main.js` no se pudo ejecutar en el entorno de desarrollo del commit; probar el instalador con `npm run desktop:test`.
