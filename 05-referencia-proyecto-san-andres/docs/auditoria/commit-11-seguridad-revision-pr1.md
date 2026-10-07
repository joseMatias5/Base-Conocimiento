# Commit 11 — Seguridad (revisión del PR #1)

`fix(seguridad): límite de PIN no evadible, sesiones revocables, CSRF y endpoints sin datos de más`

**Rama:** `fix/revision-pr1` (desde `backend`).
**Archivos principales:** `src/lib/rate-limit.ts`, `src/lib/origen.ts` (nuevo), `src/lib/auth.ts`, `src/lib/session.ts`,
`src/proxy.ts`, `src/app/api/auth/verify-pin`, `check-admin-pin` y `session`, `src/app/api/hub-metrics/route.ts`,
`src/app/api/events/route.ts`.

---

## Hallazgo AT-21 — El límite de intentos de PIN se evadía con `X-Forwarded-For`

**Ubicación:** API | Autenticación | `src/lib/rate-limit.ts`
**Tipo:** Seguridad
**Descripción:** La clave del contador era la IP de `x-forwarded-for`. Next completa ese encabezado con la IP real
**solo si el cliente no lo envió** (`req.headers['x-forwarded-for'] ??= socket.remoteAddress`); si lo envía, respeta
el valor recibido.

**Evidencia simplificada:**
```ts
const forwarded = req.headers.get('x-forwarded-for');   // lo controla el cliente
return forwarded?.split(',')[0].trim() || 'local';      // IP inventada distinta en cada intento → contador nuevo
```

**Problema identificado:** Cambiando el encabezado en cada intento, el límite nunca se alcanzaba.

**Consecuencias:**
- Fuerza bruta sin freno sobre un PIN de 4 dígitos (10.000 combinaciones).

**Recomendación (aplicada):**
- El encabezado se **ignora** salvo que se configure `TRUST_PROXY=1` (solo si hay un proxy que lo reescribe). Sin
  proxy, todos los equipos comparten la clave "local".
- **Bloqueo escalonado:** cada 10 fallos seguidos se bloquea, y cada bloqueo dura el doble que el anterior
  (1, 2, 4, 8 y hasta 15 minutos). Un login correcto, o una hora sin fallos, reinicia la escala. Quedan unos 10
  intentos cada 15 minutos (~1.000 por día).
- **Compensación aceptada:** con la clave compartida, alguien en la red podría mantener bloqueado el login de todos
  fallando a propósito (hasta 15 minutos por ronda). Es preferible a un límite evadible.

**Impacto:** Alto
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-22 — `check-admin-pin` revelaba la identidad y aceptaba roles inexistentes

**Ubicación:** API | `src/app/api/auth/check-admin-pin/route.ts`
**Tipo:** Seguridad
**Descripción:** Respondía `{ success, user: { id, nombre, rol } }` y aceptaba los roles `CAJERO` y `ENCARGADO`, que no
existen en el sistema.

**Problema identificado:** Un mozo que prueba PINs averigua además de quién es cada uno.

**Recomendación (aplicada):** Solo acepta el PIN de un **ADMIN** y responde únicamente `{ success: true }`. No cambia
la sesión de quien lo pide. Comparte el límite de intentos con el login.

**Impacto:** Medio
**Esfuerzo estimado:** Muy Bajo

---

## Hallazgo AT-23 — `/api/hub-metrics` sin autenticación

**Ubicación:** API | `src/app/api/hub-metrics/route.ts`
**Tipo:** Seguridad
**Descripción:** Cualquiera en la red podía consultar la ocupación del salón y los pedidos en cocina sin sesión.

**Recomendación (aplicada):** Exige sesión (cualquier rol). Es la única ruta que dejó de estar en la lista de públicas
de la matriz de permisos.

**Impacto:** Bajo
**Esfuerzo estimado:** Muy Bajo

---

## Hallazgo AT-24 — Un usuario desactivado seguía operando hasta 12 horas

**Ubicación:** API | `src/lib/auth.ts`, `src/proxy.ts`, `/api/auth/session`
**Tipo:** Seguridad
**Descripción:** La sesión solo se validaba por la firma y la fecha de la cookie. Desactivar a un usuario o cambiarle
el rol no tenía efecto hasta que la cookie vencía (12 h).

**Recomendación (aplicada):** `sesionVigente()` verifica la firma **y** que el usuario siga existiendo y activo en la
base, y toma el **rol y el nombre de la base**, no del token. La usan `requireAuth` (toda la API), el proxy de páginas
(Next 16 lo ejecuta en Node.js) y `/api/auth/session`. Es una consulta por petición a SQLite local, por la clave
primaria.

**Impacto:** Alto
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-25 — La conexión en tiempo real seguía abierta con la sesión vencida

**Ubicación:** API | `src/app/api/events/route.ts`
**Tipo:** Seguridad
**Descripción:** La sesión se validaba solo al conectar; la conexión seguía recibiendo eventos aunque la sesión
venciera o el usuario fuera desactivado.

**Recomendación (aplicada):** En cada heartbeat (30 s) se revalida la sesión con `sesionVigente()`. Si ya no es válida,
se envía `{"type":"sesion-vencida"}`, se liberan el listener y el temporizador, y se cierra la conexión.

**Impacto:** Medio
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-26 — Secreto de sesión por defecto publicado en el repositorio

**Ubicación:** `src/lib/session.ts`
**Tipo:** Seguridad
**Descripción:** Sin `SESSION_SECRET` fuera de producción se usaba un texto fijo que está en el código. Un servidor de
desarrollo levantado en la red del local aceptaba sesiones de ADMIN firmadas por cualquiera.

**Recomendación (aplicada):** Sin `SESSION_SECRET` fuera de producción, el secreto es **aleatorio por proceso**. En
producción sigue siendo obligatorio (falla cerrado) y la app de escritorio genera el suyo en `session.key`.
Consecuencia: al reiniciar `npm run dev` hay que volver a ingresar el PIN.

**Impacto:** Medio
**Esfuerzo estimado:** Muy Bajo

---

## Hallazgo AT-27 — Sin protección CSRF más allá de `SameSite=Lax`

**Ubicación:** API | `src/lib/origen.ts`, `requireAuth`, `verify-pin`
**Tipo:** Seguridad
**Descripción:** Para una IP, "mismo sitio" incluye **cualquier puerto**: otra aplicación en `http://IP:8080` podía
enviar formularios a `http://IP:3000` con la cookie. Además, un formulario `text/plain` puede armar un cuerpo que
`request.json()` acepta.

**Recomendación (aplicada):** Se rechaza con `403` toda petición con `Sec-Fetch-Site: cross-site | same-site`, con
`Origin: null`, o con un `Origin` cuyo host no coincide con `Host`. Aplica a toda la API (vía `requireAuth`) y al
login (login CSRF). Las peticiones sin esos encabezados (herramientas, tests) no se bloquean: no vienen de una página.

**Impacto:** Medio
**Esfuerzo estimado:** Bajo

---

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| `POST /api/auth/check-admin-pin` | Responde **solo** `{ success: true }` (sin `user`). Solo PIN de ADMIN. Hoy ninguna pantalla lo usa; Comandas debe pasar a usarlo para el editor de plano (ver abajo). |
| `GET /api/hub-metrics` | `401` sin sesión. La portada ya muestra 0 si la respuesta no es `ok`; conviene mostrar "—" en ese caso. |
| Usuario desactivado o con rol cambiado | `401`/`403` en la **siguiente** petición (antes, hasta 12 h después). `/api/auth/session` devuelve `user: null`. |
| SSE | Nuevo mensaje `{"type":"sesion-vencida"}` antes de cerrar la conexión. `useSSE` debería tratarlo como sesión vencida (ir al inicio) en vez de reconectar. |
| Peticiones desde otro origen | `403` "Origen de la petición no permitido". Las pantallas de la app no se ven afectadas (mismo origen). |
| Bloqueo por PIN | El `429` puede durar hasta 15 minutos (`Retry-After` en segundos). Mostrar `data.error`. |
| Desarrollo | Sin `SESSION_SECRET` en `.env`, reiniciar `npm run dev` cierra las sesiones. |

**Pendiente para el frontend (coordinado):** el editor de plano de Comandas hoy usa `verify-pin`, que **reemplaza la
sesión del mozo por la del admin**. Debe pasar a `check-admin-pin`, que solo confirma el PIN.

## Configuración
- `TRUST_PROXY=1`: **solo** si la app queda detrás de un proxy inverso que reescribe `X-Forwarded-For` y `X-Forwarded-Host`.
  En el uso normal (app de escritorio o `npm start` en la red local) no se configura.

## Cómo verificar
```bash
npm test        # 741 tests
npm run build
```
Tests nuevos: escala de bloqueos (60 → 120 → 240 → 480 → 900 → 900 s) y reinicio tras un login correcto;
`x-forwarded-for` inventado no evade el límite; con `TRUST_PROXY=1` se cuenta por IP; `check-admin-pin` responde solo
`{ success }`; usuario desactivado, borrado o con rol cambiado (API, proxy y `/api/auth/session`); SSE que se corta al
desactivar el usuario y al vencer la cookie; CSRF (otro host, otro puerto de la misma IP, `Sec-Fetch-Site`,
`Origin: null`) y mismo origen permitido; sesión firmada con el secreto fijo viejo rechazada.

Los tests del proxy, del SSE y de subidas consultaban la `dev.db` real sin simular Prisma; ahora la simulan.

## Pendiente y limitaciones
- **PIN de 4 dígitos:** el bloqueo escalonado lo hace lento de adivinar, pero el espacio sigue siendo chico. Pasar a 6
  dígitos queda pendiente de decisión (cambio coordinado con la pantalla de inicio).
- **Bloqueo compartido en la red local** (ver AT-21).
- El límite de intentos vive en memoria: reiniciar el servidor lo borra.
