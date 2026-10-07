# Commit 13 — Máquina de estados, eventos de mesa, reintento de cobro y ajuste de stock

`fix(pedidos): transiciones de estado explícitas, eventos de mesa correctos, cobro idempotente y ajuste de stock`

**Rama:** `fix/revision-pr1`.
**Archivos principales:** `src/lib/pedidos.ts` (nuevo), `src/app/api/pedidos/route.ts`,
`src/app/api/pedidos/[id]/cancel/route.ts`, `src/app/api/checkout/pay/route.ts`, `src/lib/stock.ts`,
`src/app/api/inventario/route.ts`, `src/app/api/inventario/ajuste/route.ts` (nuevo), `src/lib/catalogo.ts`,
`prisma/schema.prisma` (`MovimientoStock.detalle`), `src/lib/migraciones.ts` (paso 3).

---

## Hallazgo AT-31 — Cualquier salto entre estados abiertos del pedido

**Ubicación:** API | `PATCH /api/pedidos`
**Tipo:** Calidad / Integridad
**Descripción:** Se aceptaba pasar de cualquier estado abierto a cualquier otro: `entregado → pendiente`,
`pendiente → entregado` sin pasar por cocina, etc. El guard atómico solo impedía tocar estados finales.

**Recomendación (aplicada):** Máquina de estados explícita (`TRANSICIONES` en `src/lib/pedidos.ts`), construida a partir
de lo que usa la pantalla de Cocina:

| Desde | Puede pasar a |
|-------|---------------|
| `pendiente` | `preparando` |
| `preparando` | `listo` |
| `listo` | `entregado`, `preparando` (corregir un "listo" por error) |
| `entregado` | `preparando` (reabrir sin cobrar) |

Todo lo demás: `400` "Un pedido "X" no puede pasar a "Y"". El guard atómico ahora reclama el **estado exacto** que se
validó; si otra petición lo cambió en el medio, `409` "El pedido cambió de estado mientras tanto".

**Impacto:** Medio
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-32 — Eventos `mesa:actualizada` ausentes o con el estado viejo

**Ubicación:** API | pedidos, cancelación, cobro
**Tipo:** Calidad (tiempo real)
**Descripción:**
- Cancelar emitía la mesa leída **antes** de liberarla (salía "ocupada") y la emitía aunque no hubiera cambiado.
- Crear un pedido (mesa → ocupada) y cambiar su estado (mesa → libre/esperando/ocupada) no emitían `mesa:actualizada`.
- La lista de "pedidos que ocupan la mesa" estaba repetida en tres rutas.

**Recomendación (aplicada):** Cada ruta emite `mesa:actualizada` con la mesa **ya actualizada** y **solo si cambió**.
Las tres rutas usan `PEDIDOS_QUE_OCUPAN_MESA` de `src/lib/mesas.ts`.

**Impacto:** Bajo
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-33 — El reintento de un cobro exitoso respondía error

**Ubicación:** API | `POST /api/checkout/pay`
**Tipo:** Calidad / Operación
**Descripción:** Si el cobro se registraba pero la respuesta no llegaba (corte de Wi-Fi), el reintento recibía
`400 "Este pedido ya fue cerrado"`: el mozo creía que había fallado y el ticket no se imprimía.

**Recomendación (aplicada):** Cobro **idempotente**. Si el pedido ya está pagado, es de la misma mesa y su venta no fue
anulada, se responde `200` con **la misma venta y los mismos tickets** y `reintento: true`. No se crea otra venta, no
se descuenta stock y no se emiten eventos. Con una venta anulada, o desde otra mesa, sigue siendo `400`. Los tickets
ahora se arman desde la venta guardada (misma fecha y números en el original y en el reintento).

**Impacto:** Medio
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-34 — Editar el stock pisaba las ventas y no dejaba registro

**Ubicación:** API | `PUT /api/inventario`
**Tipo:** Integridad de datos
**Descripción:** La pantalla enviaba el stock como valor **absoluto**. Las ventas cobradas entre que se abrió la pantalla
y se guardó quedaban pisadas, y el cambio no quedaba registrado en ningún lado.

**Recomendación (aplicada):**
- `POST /api/inventario/ajuste` (solo ADMIN) con `{ insumoId, delta, motivo }`: **suma o resta** sobre el valor actual
  de la base y registra un `MovimientoStock` `AJUSTE` con el motivo (nueva columna `detalle`) y el usuario.
- `PUT /api/inventario` ya no cambia el stock: si llega el mismo valor que tiene (la pantalla manda el insumo completo)
  se ignora; si llega uno distinto, `400` indicando que se use "Ajustar stock".
- La columna `detalle` se agrega sola al arrancar (paso 3 de las migraciones, probado contra SQLite real).

**Impacto:** Medio
**Esfuerzo estimado:** Bajo

---

## Otros cambios
- `pedidos/history`: el filtro dejó de usar `any` (`Prisma.PedidoWhereInput`). El lint de `src/lib`, `src/app/api`,
  `src/__tests__`, `src/proxy.ts` y `src/instrumentation.ts` queda sin errores.

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| Cambios de estado no permitidos | `400` con `error`. La pantalla de Cocina usa solo transiciones permitidas. |
| Cambio de estado concurrente | `409` "El pedido cambió de estado mientras tanto": recargar los pedidos. |
| `POST /api/checkout/pay` repetido | `200` con la misma venta y `reintento: true` (antes `400`). Se puede reintentar ante un error de red sin miedo a cobrar dos veces. |
| `mesa:actualizada` | Ahora también al crear un pedido y al cambiar su estado; siempre con el estado nuevo. |
| **Inventario (coordinado)** | `PUT` con un stock distinto → `400`. **La pantalla de Inventario debe pasar a "Ajustar stock"** (`POST /api/inventario/ajuste` con `{ insumoId, delta, motivo }`) y dejar de enviar `stockActual` en la edición. **No mezclar esta rama sin ese cambio del frontend**: hoy la pantalla edita el stock por `PUT`. |

## Cómo verificar
```bash
npm test        # 787 tests
npm run build
```

## Pendiente
- Si el cocinero puede cancelar pedidos ya entregados: pendiente de decisión.
- No hay pantalla de historial de movimientos de stock (ventas, anulaciones y ajustes quedan registrados).
