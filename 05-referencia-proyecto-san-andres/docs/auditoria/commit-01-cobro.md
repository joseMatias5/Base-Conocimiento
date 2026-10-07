# Commit 1 — Cobro atómico e idempotente

`fix(cobro): cobro atómico e idempotente, sin ventas duplicadas`

**Archivos principales:** `src/app/api/checkout/pay/route.ts`, `src/app/api/pedidos/route.ts` (PATCH),
`src/lib/money.ts`, infraestructura de tests (Vitest).

---

## Hallazgo AT-03 — Cada pedido generaba dos ventas

**Ubicación:** API | Pedidos y Cobro | `pedidos/route.ts` (PATCH) y `checkout/pay/route.ts`
**Tipo:** Calidad (integridad de datos de negocio)
**Descripción:** Marcar un pedido como "entregado" en cocina registraba una `Venta` sin ticket, y al cobrarlo en sala se registraba otra.

**Evidencia simplificada:**
```ts
// PATCH /api/pedidos  (antes)
if (estado === 'entregado' || estado === 'pagado') {
  await prisma.venta.create({ data: { total: pedido.total, ... } });   // venta #1, sin ticket
}
// POST /api/checkout/pay  (antes): solo rechazaba 'cancelado' y 'pagado'
//   un pedido 'entregado' pasaba y creaba la venta #2
```

**Problema identificado:** Una venta se registraba en dos lugares distintos y el cobro no comprobaba si ya existía una.

**Consecuencias:**
- Ingresos de Caja y métricas inflados (cada pedido contaba dos veces en el flujo normal cocina → mozo).
- Ventas "fantasma" con `numeroTicket` vacío en la base.
- La mesa se liberaba al marcar "entregado", antes de cobrar.

**Principios afectados:**
- Single Responsibility Principle (cocina cambiaba estados *y* registraba ventas).
- Single Source of Truth (la venta debe nacer en un solo lugar).

**Recomendación (aplicada):** La venta se crea únicamente en `/api/checkout/pay`. `PATCH /api/pedidos` ya no crea ventas y responde 400 si recibe `estado: "pagado"`.
**Impacto:** Muy Alto
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-05 — Dos cobros simultáneos podían pasar los dos

**Ubicación:** API | Cobro | `checkout/pay/route.ts`
**Tipo:** Calidad (concurrencia / idempotencia)
**Descripción:** La lectura del pedido, la comprobación de su estado y el cálculo del número de ticket ocurrían fuera de la transacción.

**Evidencia simplificada:**
```ts
const pedido = await prisma.pedido.findUnique(...);          // fuera de la transacción
if (pedido.estado === 'pagado') return error;                // dos peticiones leen "no pagado"
const n = await prisma.venta.count(...);                     // dos peticiones obtienen el mismo n
await prisma.$transaction(...);                              // las dos escriben
```

**Problema identificado:** Comprobar y luego actuar sin atomicidad (*check-then-act*).

**Consecuencias:**
- Doble cobro del mismo pedido (doble tap en el botón, reintento por red lenta).
- Dos ventas con el mismo número de ticket.

**Principios afectados:**
- Atomicidad / consistencia (ACID).
- Idempotencia de operaciones críticas.

**Recomendación (aplicada):** El primer paso de la transacción es una escritura condicional (`updateMany` donde `estado` no sea `pagado` ni `cancelado`). Si no modifica ninguna fila, el cobro se rechaza (400 o 404). El ticket se numera dentro de la misma transacción, contando solo los `T-AAAAMMDD-*` del día.
**Impacto:** Alto
**Esfuerzo estimado:** Medio

---

## Hallazgo AT-06 (parcial) / AT-08 (parcial) — Cobro sin validación y a medias

**Ubicación:** API | Cobro | `checkout/pay/route.ts`
**Tipo:** Calidad
**Descripción:** `metodoPago`, `propina` y `cajeroId` se usaban sin validar, y el subtotal se tomaba de `pedido.total` (un acumulado que puede desfasarse).

**Evidencia simplificada:**
```ts
const { pedidoId, mesaId, metodoPago, propina, cajeroId } = await request.json();
... metodoPago.toUpperCase()   // 500 si falta
... total: pedido.total + propina
... mesa.update({ estado: 'libre' })   // aunque haya otro pedido activo en la mesa
```

**Problema identificado:** Entrada sin validar y reglas de negocio incompletas.

**Consecuencias:**
- Propina negativa o texto: totales corruptos.
- Un 500 genérico filtraba `error.message` al cliente.
- Cobrar una mesa liberaba la mesa aunque tuviera otro pedido abierto.

**Principios afectados:**
- Fail fast / validación en la frontera.
- Defensa en profundidad.

**Recomendación (aplicada):**
- Validación con `zod` (método de pago permitido, propina ≥ 0, ids enteros positivos, JSON válido).
- Subtotal calculado desde los ítems guardados; si `pedido.total` estaba desfasado, se corrige.
- La mesa solo se libera si no quedan otros pedidos activos.
- Se comprueba que la mesa corresponda al pedido, que el pedido tenga ítems y que el cajero exista.
- Errores 500 con mensaje genérico.
**Impacto:** Alto
**Esfuerzo estimado:** Medio

---

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| Orden de los ingresos | Un pedido "entregado" **ya no suma a Caja** hasta que se cobra. |
| `PATCH /api/pedidos` con `estado: "pagado"` | Ahora responde `400`. El cobro va solo por `/api/checkout/pay`. |
| Errores de validación del cobro | `400` con `{ success: false, error }` (antes `500`). |
| Segundo cobro del mismo pedido | `400` "Este pedido ya fue cerrado o cancelado". |
| Respuesta del cobro | Sin cambios (`success`, `venta`, `ticketCliente`, `ticketInterno`). |

## Cómo verificar
```bash
npm test                  # 28 tests de este commit
npm run dev
```
Crear un pedido → marcarlo *entregado* en cocina → cobrarlo en sala → Caja debe mostrar **una** venta. Segundo cobro por terminal:
```bash
curl -s -X POST http://localhost:3000/api/checkout/pay -H "Content-Type: application/json" -d '{"pedidoId":N,"mesaId":M}'
# {"success":false,"error":"Este pedido ya fue cerrado o cancelado"}  (HTTP 400)
```

## Corrección posterior (importante)

La garantía "un pedido no se puede cobrar dos veces" de este commit **solo valía mientras el pedido seguía
en estado `pagado`**. Una prueba manual mostró que `PATCH /api/pedidos` permitía sacar un pedido de `pagado`
(por ejemplo desde el historial de Cocina), editarlo y volver a cobrarlo, generando una segunda venta.
Este caso no estaba cubierto por los tests y se resuelve en el [commit 4](commit-04-estados-anulacion.md)
(AT-18): `pagado` y `cancelado` pasan a ser estados finales y las correcciones se hacen anulando la venta.

## Pendiente y limitaciones
- **Ventas fantasma históricas:** las bases que ya usaron el sistema tienen ventas duplicadas con `numeroTicket` vacío. No se borraron automáticamente (datos financieros); requieren una revisión manual.
- El cobro no emite eventos SSE (igual que antes), por lo que otras pantallas se actualizan al refrescar.
- Los tests usan una base simulada: la concurrencia real sobre SQLite no está probada automáticamente.
