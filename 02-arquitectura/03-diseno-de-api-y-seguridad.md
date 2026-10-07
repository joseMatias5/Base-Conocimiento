# Diseño de API, errores, autenticación y observabilidad

> Contrato entre backend y frontend. Un cambio de contrato se avisa antes de mezclar (L-052).

## 1. Convenciones REST

| Operación | Método y ruta | Éxito | Errores típicos |
|---|---|---|---|
| Listar | `GET /recursos?pagina&limite&orden&filtro` | 200 | 400, 401, 403 |
| Ver | `GET /recursos/{id}` | 200 | 404 |
| Crear | `POST /recursos` | 201 + `Location` | 400, 409 (duplicado), 422 |
| Reemplazar | `PUT /recursos/{id}` | 200 | 404, 409 (versión) |
| Modificar parcial | `PATCH /recursos/{id}` | 200 | 400, 404, 409 |
| Baja | `DELETE /recursos/{id}` | 204 | 404, 409 (tiene dependencias) |
| Acción de negocio | `POST /pedidos/{id}/cobrar` (verbo explícito) | 200 | 409 (estado no permite) |

- Sustantivos en plural y minúscula; las acciones que no son CRUD son `POST` sobre un sub-recurso verbal.
- **Versionar** la API cuando se rompa el contrato (`/v1/`); preferir agregar campos (compatible) antes que cambiarlos.
- **Unidades en la frontera:** la API habla en la unidad del usuario (pesos); la base, en la mínima (centavos) (L-001).
- **Paginación:** parámetros con tope impuesto por el servidor; respuesta `{ items, siguienteCursor }`.
- **Idempotencia:** `PUT`, `DELETE` y las acciones condicionales por estado; `POST` creadores con `Idempotency-Key` si se pueden reenviar.

## 2. Forma única de error

```json
{ "error": "Ya existe un producto con ese código", "codigo": "PRODUCTO_DUPLICADO", "campos": { "codigo": "ya existe" } }
```
(o `application/problem+json` RFC 9457 en .NET/Spring). Reglas:
- Siempre el mismo formato; el frontend muestra `error` al usuario.
- **Códigos HTTP correctos:** 400 formato/validación · 401 sin sesión · 403 sin permiso · 404 no existe · 409 conflicto
  (duplicado, versión, estado) · 422 regla de negocio (opcional) · 429 demasiados intentos · 500 solo para fallos inesperados.
- **Nunca** filtrar trazas, SQL ni rutas internas; el detalle va al log del servidor con un id de correlación.
- Un 500 por entrada inválida es un defecto: validar antes.

## 3. Autenticación y autorización

- **Sesión firmada** (HMAC) o del servidor; cookie `httpOnly`, `Secure`, `SameSite`; vencimiento (L-020).
- **Revocable:** en cada petición verificar usuario activo y tomar el rol de la base, no del token (L-021). Lo mismo en
  conexiones largas (SSE/WebSocket): revalidar periódicamente.
- **JWT:** vida corta + *refresh token* rotativo y revocable; no guardar datos mutables en el token. Si no hay un motivo
  claro para JWT (varios servicios, terceros), una sesión de servidor es más simple y segura.
- **Autorización por defecto negada:** toda ruta empieza con `requireAuth([roles])` o `[Authorize(Policy)]`.
  **Test de matriz de permisos** que recorre todas las rutas y falla si aparece una sin clasificar (L-025).
- **Autorización por fila (propiedad):** verificar que el recurso pertenezca al usuario/tenant, no solo el rol (evita IDOR).
- **Contraseñas/PIN:** argon2id/scrypt/bcrypt con sal; comparación en tiempo constante; migración de hashes viejos en el login (L-026).
- **Límite de intentos** con bloqueo escalonado, sin confiar en `X-Forwarded-For` salvo proxy de confianza declarado (L-022).
- **CSRF:** verificar `Origin`/`Sec-Fetch-Site` en toda petición que cambia datos y en el login (L-024).
- **Secretos:** obligatorios en producción (falla cerrado), aleatorios en desarrollo (L-023).
- **Subidas de archivos:** magic bytes, tamaño máximo antes de leer el cuerpo, nombre generado, `nosniff` (L-027).

## 4. Seguridad: lista mínima (OWASP Top 10 aplicado)

| Riesgo | Defensa |
|---|---|
| Control de acceso roto | Matriz de permisos + autorización por fila + test |
| Fallas criptográficas | TLS, hashes lentos, secretos fuera del repo |
| Inyección | Consultas parametrizadas, validación en el borde, escape al renderizar |
| Diseño inseguro | Cálculos de negocio en el servidor (L-002) |
| Configuración incorrecta | Encabezados de seguridad (CSP, HSTS, `nosniff`), sin modo debug en producción |
| Componentes vulnerables | `npm audit` / `dotnet list package --vulnerable` / `pip-audit` en CI; versiones fijadas |
| Fallas de autenticación | Límite de intentos, sesión revocable, vencimiento |
| Integridad de datos y software | Migraciones controladas, firmas de actualización |
| Registro y monitoreo | Bitácora de eventos de seguridad y de dinero; alertas |
| SSRF | Lista blanca de destinos en llamadas salientes |

## 5. Observabilidad

- **Logs estructurados** (JSON) con nivel, id de correlación, usuario y operación; **nunca** datos sensibles (PIN, tokens, tarjetas).
- **Métricas:** latencia por ruta, tasa de errores, duración de transacciones, cola de escrituras.
- **Verificación de salud:** `/health` (vivo) y `/ready` (base conectada y migrada).
- **Auditoría de negocio** aparte del log técnico (quién anuló qué venta, cuándo, por qué).

## 6. Documentación del contrato

- OpenAPI/Swagger generado desde los esquemas (zod → OpenAPI, Swashbuckle, FastAPI automático).
- Cada cambio de comportamiento visible lleva su sección **"Cambios visibles para el frontend"** en el documento del commit.
- Ejemplos de petición/respuesta reales de cada pantalla; son la base del test del payload exacto (L-031).
