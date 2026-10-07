# Commit 5 — Reglas de mesas, SSE sin fugas y subida segura de imágenes

`fix(mesas): reglas de negocio, SSE sin fugas y subida de imágenes validada`

**Archivos principales:** `src/app/api/mesas/**`, `src/lib/mesas.ts` (nuevo), `src/app/api/events/route.ts`,
`src/lib/events.ts`, `src/app/api/upload/route.ts`, `src/lib/imagen.ts` (nuevo), `src/app/uploads/[...path]/route.ts`.

**Origen:** la prueba manual del commit de seguridad mostró que no se podía renumerar una mesa a un número
que había tenido otra mesa ya eliminada (`PATCH /api/mesas/20 → 400`). Al investigarlo se encontraron
otros problemas en las mismas rutas.

---

## Hallazgo AT-14 — Reglas de negocio de las mesas

**Ubicación:** API | Mesas | `mesas/route.ts`, `mesas/[id]/route.ts`, `mesas/layout/route.ts`
**Tipo:** Calidad (reglas de negocio e integridad)
**Descripción:** Las rutas de mesas no validaban la entrada y tenían reglas incompletas.

**Evidencia simplificada:**
```ts
// DELETE: la baja es lógica (activa:false) y conserva el número, que es único
const activeOrders = mesa.pedidos.some(p => ['pendiente','preparando','listo'].includes(p.estado)); // falta 'entregado'
// PATCH /api/mesas/[id]: el número "en uso" incluye a las mesas ya eliminadas
const exists = await prisma.mesa.findUnique({ where: { numero } });  if (exists && exists.id !== id) return 400;
// PATCH /api/mesas: data: { estado }  // cualquier texto, aunque haya pedidos en curso
```

**Problema identificado:** No se consideraban las bajas lógicas al renumerar, el borrado ignoraba los pedidos entregados sin cobrar, y los estados y datos de entrada no se validaban.

**Consecuencias:**
- No se podía renumerar una mesa a un número usado antes por una mesa eliminada (el caso reportado).
- Se podía eliminar una mesa con un pedido **entregado y sin cobrar**: la mesa desaparecía de Sala y ese cobro quedaba inalcanzable.
- Se podía marcar `libre` una mesa con pedidos en curso, o guardar un estado inventado.
- Números de mesa 0, negativos o decimales; sectores y formas inexistentes; posiciones no numéricas.
- Mover el plano con un id inexistente fallaba a medias con `500`.

**Principios afectados:**
- Invariantes de dominio.
- Atomicidad (ACID).
- Fail fast.

**Recomendación (aplicada):**
1. **Renumerar a un número de una mesa eliminada:** el número se libera. Si esa mesa **no tiene historial** (ni pedidos ni ventas) se borra definitivamente; si **tiene historial** se archiva con un número negativo único (`-id`), reservado para ese fin. Todo en una transacción.
2. **Eliminar:** también lo bloquea un pedido `entregado` sin cobrar. Guard atómico dentro de una transacción. Eliminar una mesa **ya eliminada** responde `200` sin cambios (DELETE idempotente).
3. **Estado:** `PATCH /api/mesas` solo acepta `libre`, `ocupada` o `esperando`, y no permite `libre` con pedidos `pendiente`/`preparando`/`listo`.
4. **Validación con `zod`:** número 1–9999, capacidad 1–50, sector `salon`/`barra`, forma `round`/`square`/`tall-bar`, posiciones numéricas. El objeto mesa completo que envía el frontend se acepta; los campos que no se editan por esa vía se descartan.
5. **Layout:** todo o nada; si una mesa no existe responde `400` y no mueve ninguna.
6. **Alta:** una alta simultánea con el mismo número responde `400` en vez de `500`; reactivar una mesa eliminada la deja `libre`.
**Impacto:** Alto
**Esfuerzo estimado:** Medio

> **Corrección a un comentario anterior:** se había señalado que `DELETE` dos veces sobre la misma mesa respondía `200` como un problema. No lo es: un `DELETE` idempotente es correcto. Se deja ese comportamiento y se prueba explícitamente.

---

## Hallazgo AT-10 — Conexiones SSE que dejaban recursos abiertos

**Ubicación:** API | Tiempo real | `events/route.ts`, `lib/events.ts`
**Tipo:** Calidad (recursos y robustez)
**Descripción:** Cada conexión SSE creaba un temporizador de *heartbeat* que no se cancelaba al cerrarse.

**Evidencia simplificada:**
```ts
start(controller) { ...; const heartbeat = setInterval(...); }   // variable local: nadie puede limpiarla
cancel() { if (unsubscribe) unsubscribe(); }                     // el temporizador sigue corriendo
```

**Problema identificado:** Al desconectarse un cliente quedaba un `setInterval` vivo por cada conexión, y un listener que fallaba podía interrumpir el envío a los demás.

**Consecuencias:**
- Fuga de memoria y CPU creciente con cada recarga de pantalla o reconexión.
- Un fallo al notificar un evento, después de guardar en la base, podía hacer responder `500` a una operación que ya se había realizado.

**Principios afectados:**
- Gestión de recursos (todo lo que se abre se cierra).
- Aislamiento de fallos.

**Recomendación (aplicada):** Una función `limpiar()` idempotente (cancela el temporizador y da de baja el listener) se ejecuta al cancelar el stream, al abortar la petición (el cliente se fue) y ante un error de escritura. `emit()` aísla cada listener con `try/catch`.
**Impacto:** Medio
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-11 — Subida de imágenes sin validar el contenido

**Ubicación:** API | Archivos | `upload/route.ts`, `uploads/[...path]/route.ts`
**Tipo:** Seguridad
**Descripción:** Solo se comprobaba la extensión del nombre del archivo, y no había límite de tamaño.

**Evidencia simplificada:**
```ts
const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
if (!['png','jpg','jpeg','webp'].includes(extension)) return 400;
const filename = `prod-${Date.now()}.${extension}`;     // sin tamaño máximo; sin mirar el contenido
```

**Problema identificado:** El nombre y el tipo de un archivo los controla quien lo sube.

**Consecuencias:**
- Un HTML o un ejecutable renombrado `.png` se guardaba y se servía desde el propio sitio.
- Archivos enormes podían llenar la memoria o el disco.
- Dos subidas en el mismo milisegundo se pisaban.
- Un campo `file` enviado como texto producía un `500`.

**Principios afectados:**
- Validar el contenido, no el nombre.
- Defensa en profundidad.

**Recomendación (aplicada):**
- El formato se determina por los **primeros bytes** (PNG, JPEG o WebP). La extensión guardada sale del contenido real; SVG no se admite.
- Máximo **5 MB** (`413`), con rechazo temprano por `Content-Length`.
- Nombre `prod-<tiempo>-<aleatorio>.<ext>` y escritura que no sobrescribe.
- Formulario inválido, archivo vacío o campo de texto: `400`.
- Las imágenes se sirven con `X-Content-Type-Options: nosniff`.
**Impacto:** Medio
**Esfuerzo estimado:** Bajo

---

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| **Renumerar mesas** | Ahora se puede renumerar una mesa al número de una eliminada. Si el número lo usa otra mesa **activa**, sigue siendo `400` "El número de mesa ya está en uso". |
| **Mensajes de error al editar una mesa** | La pantalla de Sala muestra siempre "Error al actualizar" en el `PATCH`. **Recomendado:** mostrar `data.error`, como ya hace al crear. |
| **Eliminar mesa** | Con un pedido entregado sin cobrar responde `400` "No se puede eliminar una mesa con pedidos activos o pendientes de cobro". |
| **Validaciones de mesas** | Número entero entre 1 y 9999 (los negativos están reservados), capacidad 1–50, sector `salon`/`barra`, forma `round`/`square`/`tall-bar`. Fuera de eso: `400` con `error`. |
| **Subida de imágenes** | Mismo formato de respuesta (`{ success, url }`). Nuevos errores: `413` por tamaño y `400 "Formato no permitido (solo PNG, JPG o WebP)"` por contenido. La pantalla de Menú ya muestra `data.error` en un `alert`, así que no requiere cambios; conviene avisar del límite de 5 MB. |
| **Historial de ventas** | Las ventas de una mesa archivada siguen guardando el número original en `mesaNumero`. **Recomendado:** que Caja muestre `v.mesaNumero` antes que `v.mesa.numero`; de lo contrario esas ventas viejas mostrarían la mesa con número negativo. |
| Respuestas exitosas | Sin cambios de forma. Sin cambios de esquema. |

## Cómo verificar
```bash
npm test        # 507 tests acumulados
npm run build
npm run dev
```
Pruebas manuales (Sala, desbloqueando el editor con el PIN de admin):
1. Eliminar la mesa 18 (libre). Crear una mesa nueva cualquiera, y **renumerarla a 18**: debe funcionar.
2. Cobrar un pedido y, antes de eso, intentar eliminar esa mesa estando el pedido *entregado*: debe rechazarlo.
3. En Admin → Menú, subir una imagen válida (debe funcionar) y un archivo `.txt` renombrado a `.png` (debe rechazarlo).
4. Con el servidor corriendo, abrir y cerrar Cocina varias veces; no debe haber errores en la terminal.

## Pendiente y limitaciones
- Una mesa archivada (con historial) aparece con **número negativo** en datos que lean directamente `pedido.mesa.numero`; las ventas no se ven afectadas gracias a `mesaNumero`.
- Las imágenes subidas no se **re-codifican** ni se les quitan metadatos (EXIF), y las que dejan de usarse no se borran del disco.
- La sesión del SSE se valida **al conectar**; una conexión abierta no se corta cuando la sesión vence.
- Los tests usan una base simulada y archivos temporales; no sustituyen una prueba con SQLite real.
