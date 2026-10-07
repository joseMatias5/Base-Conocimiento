# Commit 2 — Precios y totales calculados en el servidor

`fix(pedidos): precios y totales calculados en el servidor`

**Archivos principales:** `src/app/api/pedidos/route.ts` (POST), `src/app/api/pedidos/[id]/items/route.ts`,
`src/lib/api-error.ts`.

---

## Hallazgo AT-04 — El cliente decidía el precio y el total de la cuenta

**Ubicación:** API | Pedidos | `pedidos/route.ts` (POST) y `pedidos/[id]/items/route.ts` (ADD_ITEM)
**Tipo:** Seguridad (integridad de datos de negocio)
**Descripción:** El servidor guardaba el `precio` que enviaba el navegador y calculaba el total con él.

**Evidencia simplificada:**
```ts
const { mesaId, items } = await request.json();
const total = items.reduce((s, i) => s + i.precio * i.cantidad, 0);   // precio del cliente
await prisma.pedido.create({ data: { total, items: { create: items.map(i => ({ precio: i.precio, ... })) } } });
// ADD_ITEM:  precio: precio || producto.precio
```

**Problema identificado:** Se confiaba en un dato que controla quien llama a la API.

**Consecuencias:**
- Cualquiera podía enviar `precio: 0` y anular o abaratar una cuenta.
- Pedidos con productos inexistentes o retirados del menú.
- Totales inconsistentes con el catálogo.

**Principios afectados:**
- Nunca confiar en la entrada del cliente.
- Single Source of Truth (el precio vive en `Producto`).

**Recomendación (aplicada):** El precio sale siempre de `Producto.precio`. Si el cliente envía `precio`, se **descarta sin error** para no romper el contrato. Se rechazan productos inexistentes o no disponibles y mesas inexistentes o inactivas. Total redondeado a centavos.
**Impacto:** Alto
**Esfuerzo estimado:** Medio

---

## Hallazgo AT-06 (parcial) — Crear y editar pedidos en pasos sueltos

**Ubicación:** API | Pedidos | `pedidos/route.ts` (POST) y `pedidos/[id]/items/route.ts`
**Tipo:** Calidad (consistencia)
**Descripción:** Crear el pedido y ocupar la mesa eran dos operaciones independientes. Al editar ítems, el ítem, el total y el historial también.

**Evidencia simplificada:**
```ts
const pedido = await prisma.pedido.create(...);
await prisma.mesa.update({ data: { estado: 'ocupada' } });    // si falla, pedido sin mesa ocupada
// items: updatedTotal += subtotal  (total incremental: se desfasa con cada error)
```

**Problema identificado:** Sin transacción, un fallo intermedio deja datos a medias; el total acumulado se desfasa.

**Consecuencias:**
- Pedido creado con la mesa aún libre.
- Totales que no coinciden con la suma de los ítems.
- Se podían modificar pedidos ya pagados o cancelados.

**Principios afectados:**
- Atomicidad (ACID).
- Derivar en vez de duplicar datos (el total se calcula, no se acumula).

**Recomendación (aplicada):**
- Crear pedido + ítems + ocupar mesa en **una transacción**.
- Editar ítem + recalcular total + historial en **una transacción**, con guard atómico que rechaza pedidos `pagado` o `cancelado`.
- El total se recalcula siempre sumando los ítems guardados.
**Impacto:** Alto
**Esfuerzo estimado:** Medio

---

## Hallazgo AT-08 (parcial) — Pedidos e ítems sin validación

**Ubicación:** API | Pedidos | `pedidos/route.ts`, `pedidos/[id]/items/route.ts`
**Tipo:** Calidad (robustez)
**Descripción:** Cantidades y estructuras sin validar; los errores de negocio terminaban en `500`.

**Evidencia simplificada:**
```ts
items.reduce(...)                 // TypeError (500) si items no es un array
cantidad: cantidad || 1           // acepta 0, negativos, decimales
if (!producto) throw new Error()  // 500 en vez de 400
```

**Problema identificado:** Falta de validación en la frontera de la API.

**Consecuencias:**
- Pedidos con cantidades negativas o decimales.
- Errores 500 por entradas malformadas, difíciles de diagnosticar.

**Principios afectados:**
- Fail fast.
- Principio de mínima sorpresa (códigos HTTP correctos).

**Recomendación (aplicada):** Validación con `zod`: cantidad entera de 1 a 100, ids positivos, `items` array con al menos un elemento, JSON válido. Errores de negocio como `400`/`404`.
**Impacto:** Alto
**Esfuerzo estimado:** Bajo

---

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| Precio de los ítems | Siempre el del catálogo. El campo `precio` del body se ignora. |
| Productos **no disponibles** | Ya no se pueden pedir (`400`). Conviene ocultarlos o deshabilitarlos en el menú. |
| Cantidad | Entero de 1 a 100. `UPDATE_QUANTITY` con 0 ya no es válido (usar `REMOVE_ITEM`). |
| Errores | `400`/`404` con mensaje legible (`error`), en vez de `500`. |
| Pedidos pagados/cancelados | No se pueden modificar (`400`). |
| Respuestas exitosas | Sin cambios de forma. |

## Cómo verificar
```bash
npm test      # 66 tests acumulados
```
Prueba manual con el servidor corriendo (mesa **libre**):
```bash
curl -s -X POST http://localhost:3000/api/pedidos -H "Content-Type: application/json" \
  -d '{"mesaId":1,"items":[{"productoId":1,"cantidad":1,"precio":0}]}'
# el total debe ser el precio real del producto 1, no 0
```
En Cocina, editar un pedido (sumar/restar cantidades, agregar un plato): el total debe actualizarse bien.

## Pendiente y limitaciones
- Los pedidos que ya estaban abiertos conservan los precios con los que se crearon.
- No hay protección contra el doble envío de "crear pedido" (idempotencia) más allá de la deshabilitación del botón en la interfaz.
- Las rutas se protegen por rol en el commit 3.
