# Commit 4 — Estados finales de pedido, cancelación segura y anulación de ventas

`fix(pedidos): estados finales, cancelación segura y anulación de ventas por asiento inverso`

**Archivos principales:** `src/app/api/pedidos/route.ts` (PATCH), `src/app/api/pedidos/[id]/cancel/route.ts`,
`src/app/api/ventas/[id]/anular/route.ts` (nuevo), `src/lib/ventas.ts` (nuevo), `src/app/api/caja/route.ts`,
`src/app/api/metricas/route.ts`.

**Origen:** este cambio nace de una prueba manual. Un pedido de 5 ensaladas ($25.000) se cobró, se trajo de
vuelta a *preparando* desde el historial de Cocina, se dejó en 1 ensalada y se cobró de nuevo: Caja pasó
de $178.300 a **$183.300** en vez de bajar. Ver AT-18.

**Decisión de negocio acordada:** un pedido cobrado queda **cerrado**; las correcciones se hacen
**anulando la venta** (solo ADMIN, con motivo obligatorio).

---

## Hallazgo AT-18 — Un pedido cobrado se podía reabrir y volver a cobrar

**Ubicación:** API | Pedidos y Cobro | `pedidos/route.ts` (PATCH), `checkout/pay/route.ts`
**Tipo:** Calidad (integridad de datos de negocio)
**Descripción:** `PATCH /api/pedidos` aceptaba cualquier cambio de estado, incluso sacar un pedido de `pagado`. Al reabrirlo, el guard del cobro (que solo bloquea pedidos `pagado`) dejaba cobrarlo otra vez.

**Evidencia simplificada:**
```ts
// PATCH /api/pedidos (antes): sin mirar el estado actual
const pedido = await prisma.pedido.update({ where: { id }, data: { estado } });
// pagado -> preparando  (permitido)  ->  se edita  ->  entregado  ->  checkout/pay crea una 2.ª Venta
```

**Problema identificado:** Los estados `pagado` y `cancelado` no eran finales, y el sistema no tenía el concepto de anular una venta: Caja solo podía sumar.

**Consecuencias:**
- Dos ventas para un mismo pedido ($25.000 + $5.000 por una cuenta final de $5.000).
- Caja y métricas inflados; no había forma de corregir un cobro desde el sistema.
- Pedidos reabiertos dejaban la mesa en estado `libre`.

**Principios afectados:**
- Invariantes de dominio (los estados finales no se abandonan).
- Trazabilidad contable (no se editan ni se borran asientos; se corrigen con otro asiento).

**Recomendación (aplicada):**
1. `pagado` y `cancelado` son **estados finales**: no se puede salir de ellos (`400` con mensaje explicativo).
2. Nuevo `POST /api/ventas/[id]/anular` (solo ADMIN, motivo obligatorio de 3 a 500 caracteres).
3. La anulación es un **asiento inverso**: la venta original no se toca; se registra otra venta con importe negativo (ticket `A-AAAAMMDD-NNNN`) ligada a la original por `numeroControlInterno = "ANUL-V<id>"`, y una entrada `VENTA_ANULADA` en el historial del pedido (quién, qué, por qué). **No requiere cambios en el esquema de la base.**
4. Caja y métricas calculan el resumen **neto**: las anulaciones restan del total, de las propinas, del desglose por método y de la cantidad de ventas.
**Impacto:** Muy Alto
**Esfuerzo estimado:** Medio

---

## Hallazgo AT-09 — Cancelar un pedido sin controles

**Ubicación:** API | Pedidos | `pedidos/[id]/cancel/route.ts`
**Tipo:** Calidad
**Descripción:** La cancelación no comprobaba el estado actual del pedido.

**Evidencia simplificada:**
```ts
const [pedido] = await prisma.$transaction([ prisma.pedido.update({ data: { estado: 'cancelado' } }), prisma.historialPedido.create(...) ]);
// el conteo de pedidos activos y la liberación de la mesa quedaban FUERA de la transacción
```

**Problema identificado:** Se podía cancelar un pedido ya pagado (dejando una venta sin pedido válido) o ya cancelado (historial duplicado), y la mesa se liberaba en otro paso.

**Consecuencias:**
- Pedido `cancelado` con venta registrada: Caja y pedidos contradictorios.
- Historial duplicado al repetir la petición.
- Mesa libre u ocupada de forma inconsistente si fallaba el último paso.

**Principios afectados:**
- Atomicidad (ACID).
- Idempotencia.

**Recomendación (aplicada):** Una sola transacción con guard atómico: solo se cancela un pedido que no sea `pagado` ni `cancelado` (si está pagado, el mensaje indica anular la venta). La liberación de la mesa y el historial van dentro de la misma transacción. Errores `400`/`404` en vez de `500`; mensaje genérico en los `500`.
**Impacto:** Alto
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-06 (completo) — Cambio de estado en pasos sueltos

**Ubicación:** API | Pedidos | `pedidos/route.ts` (PATCH)
**Tipo:** Calidad (consistencia)
**Descripción:** Actualizar el pedido, escribir el historial y cambiar la mesa eran operaciones independientes.

**Evidencia simplificada:**
```ts
const pedido = await prisma.pedido.update(...);       // 1
await prisma.historialPedido.create(...);              // 2
await prisma.mesa.update(...);                         // 3  (si falla, pedido y mesa quedan desalineados)
```

**Problema identificado:** Sin transacción ni validación del estado de origen.

**Consecuencias:**
- Mesa en un estado que no corresponde al pedido tras un fallo intermedio.
- Reabrir un pedido entregado dejaba la mesa `libre`.
- Doble clic: historial duplicado.

**Principios afectados:**
- Atomicidad (ACID).
- Derivar el estado de la mesa a partir del pedido.

**Recomendación (aplicada):** Todo en una transacción con guard atómico. Estado válido de destino: `pendiente`, `preparando`, `listo`, `entregado`. Pasar al mismo estado no hace nada (sin historial ni eventos). Al volver a `pendiente`/`preparando`, la mesa pasa a `ocupada`. Estado inválido, `pagado` o `cancelado` por esta ruta: `400`.
**Impacto:** Alto
**Esfuerzo estimado:** Medio

---

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| **Historial de Cocina** | Un pedido `pagado` ya no se puede traer a *preparando*: el servidor responde `400` con `error` ("El pedido ya fue cobrado y no puede reabrirse…"). **Recomendado:** mostrar los pedidos pagados solo como lectura (sin botón de reabrir) y mostrar `data.error` cuando el servidor rechaza. Hoy `cambiarEstado` no revisa `res.ok`, por lo que el clic parecería no hacer nada. |
| **Reabrir un pedido `entregado` sin cobrar** | Sigue permitido (a `preparando`). Ahora la mesa pasa a `ocupada`. |
| `PATCH /api/pedidos` | `estado: "cancelado"` → `400` (usar `/api/pedidos/[id]/cancel`). Estado desconocido → `400`. Mismo estado → `200` sin cambios. |
| Cancelar un pedido pagado o ya cancelado | `400`. |
| **Caja:** `GET /api/caja` | Cada fila de `ventas` trae dos campos nuevos: `esAnulacion` (la fila es un asiento de anulación) y `anulada` (la venta ya fue anulada). `resumen` ahora es **neto**. La forma del resto no cambia. |
| **Filas de anulación en Caja** | Aparecen como una fila más, con **total negativo** y ticket `A-AAAAMMDD-NNNN`. **Recomendado:** mostrarlas en rojo y tachar las filas con `anulada: true`. |
| **Botón "Anular"** (a implementar en el frontend) | Solo ADMIN. Modal con motivo obligatorio → `POST /api/ventas/{id}/anular` con `{ "motivo": "..." }`. Respuesta: `{ success, anulacion, ventaOriginal }`. Errores `400`/`404` con `error`. |
| Base de datos | **Sin cambios de esquema.** No hace falta `db:push`. |

### Contrato de `POST /api/ventas/[id]/anular`

| Caso | Respuesta |
|------|-----------|
| OK | `200 { success: true, anulacion, ventaOriginal: { id, numeroTicket, total } }` |
| Sin sesión / no es ADMIN | `401` / `403` |
| Motivo ausente, corto (<3) o largo (>500) | `400` |
| Venta inexistente | `404` |
| Venta ya anulada, o es un asiento de anulación | `400` |

## Cómo verificar
```bash
npm test        # 411 tests acumulados
npm run build
npm run dev
```
Prueba manual (reproduce el caso original):
1. Crear un pedido de varias unidades, llevarlo a *entregado* y cobrarlo. Anotar el total en Caja.
2. En Cocina → historial, intentar traer ese pedido a *preparando*: no debe reabrirse.
3. Con el ADMIN logueado, abrir `/admin/caja` y, en la consola del navegador, listar las ventas:
   ```js
   fetch('/api/caja?days=1').then(r=>r.json()).then(d=>console.table(d.ventas.map(v=>({id:v.id,ticket:v.numeroTicket,total:v.total,anulada:v.anulada}))))
   ```
4. Anular una (cambiar `ID`):
   ```js
   fetch('/api/ventas/ID/anular',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({motivo:'Prueba de anulación'})}).then(r=>r.json()).then(console.log)
   ```
5. Recargar Caja: el total y la cantidad bajan, y aparece una fila con total negativo. Repetir el paso 4: debe responder `400` "Esta venta ya fue anulada".
6. Crear el pedido correcto y cobrarlo: Caja queda con el neto esperado.

## Pendiente y limitaciones
- **Falta la pantalla:** el botón "Anular" y el estilo de las filas anuladas son trabajo de frontend (el backend ya está listo).
- **Anulación total:** no hay devoluciones parciales. Para corregir una cuenta se anula la venta completa y se carga el pedido correcto.
- **El pedido anulado queda `pagado`** (cerrado); su historial muestra `VENTA_ANULADA`. Si el cliente vuelve, se crea un pedido nuevo.
- ~~**El stock no se reintegra** (el inventario sigue desconectado de los productos, AT-12).~~ Resuelto en el [commit 10](commit-10-recetas-y-stock.md): anular reintegra lo que descontó el cobro.
- **El ranking de platos más vendidos** (`/api/metricas`) se calcula desde los pedidos `entregado`/`pagado` y **no descuenta** ventas anuladas.
- **Ventas fantasma históricas** (commit 1): siguen en las bases que ya usaron el sistema. Se pueden anular con este mecanismo, pero conviene revisarlas antes.
- Los tests usan una base simulada; la concurrencia real sobre SQLite no está probada automáticamente.
