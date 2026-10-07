# Commit 10 — Recetas de productos e inventario conectado a las ventas

`feat(inventario): recetas de productos, descuento de stock al cobrar y reintegro al anular`

**Archivos principales:** `prisma/schema.prisma` (modelos `RecetaItem` y `MovimientoStock`), `src/lib/stock.ts` (nuevo),
`src/lib/migraciones.ts` (paso 2), `src/app/api/productos/[id]/receta/route.ts` (nuevo),
`src/app/api/inventario/route.ts` (POST), `src/app/api/checkout/pay/route.ts`, `src/app/api/ventas/[id]/anular/route.ts`,
`src/lib/catalogo.ts`, `src/app/admin/menu/RecetaModal.tsx` (nuevo), `src/app/admin/menu/page.tsx`,
`src/app/admin/inventario/page.tsx`.

---

## Hallazgo AT-12 (completo) — Inventario desconectado de las ventas

**Ubicación:** Base de datos y API | `Insumo`, `Producto`, cobro y anulación
**Tipo:** Funcionalidad / Integridad de datos
**Descripción:** No existía ninguna relación entre lo que se vende (`Producto`) y lo que se consume (`Insumo`). El stock
solo cambiaba si alguien lo editaba a mano.

**Evidencia simplificada:**
```prisma
model Producto { ... }   // sin relación con Insumo
model Insumo   { stockActual Float  stockMinimo Float ... }   // nada lo descuenta al vender
```
```text
POST /api/inventario  → no existía: los insumos solo se podían crear desde el seed de desarrollo
```

**Problema identificado:** El inventario no reflejaba el consumo real y no se podía calcular el costo de cada plato.

**Consecuencias:**
- El stock no bajaba al vender y la alerta de "stock mínimo" no avisaba a tiempo.
- No se conocía el costo de los insumos ni el margen de cada producto.
- Al cancelar o anular no había nada que reintegrar (por eso AT-09 había quedado parcial).
- En una instalación nueva no había forma de cargar insumos.

**Principios afectados:**
- Los datos de inventario deben derivarse de las operaciones, no de cargas manuales.
- Toda operación que mueve stock debe ser trazable y reversible.

**Recomendación (aplicada), según las decisiones tomadas:**
- **Recetas** (`RecetaItem`): cada producto declara cuánto de cada insumo consume **una unidad vendida**, en la
  unidad del insumo (`0.2` = 200 g si el insumo se mide en kg).
- **El stock se descuenta al cobrar**, dentro de la misma transacción que crea la venta: si algo falla, no queda ni la
  venta sin descuento ni el descuento sin venta. Si varios productos usan el mismo insumo, se suma en un solo movimiento.
- **Se reintegra al anular la venta**, revirtiendo **exactamente los movimientos de ese cobro** (`MovimientoStock`), no
  recalculando con la receta actual: si la receta cambió después de la venta, igual se devuelve lo que se descontó.
- **Cancelar un pedido sin cobrar no toca el stock**: nunca se descontó.
- **Trazabilidad:** `MovimientoStock` registra cada consumo (`VENTA`, negativo) y cada reintegro (`ANULACION`,
  positivo), con la venta y el usuario.
- **El stock puede quedar negativo.** Una venta real no se bloquea porque el inventario cargado esté desactualizado; el
  insumo aparece como "bajo stock" y avisa que hay que corregir el conteo.
- Las cantidades se redondean a 4 decimales para no acumular ruido de punto flotante (`1 − 3 × 0,2 = 0,4`).
- **Alta de insumos:** `POST /api/inventario` (solo ADMIN), con precio en pesos (se guarda en centavos, ver commit 9).
- **Costo del plato:** la receta devuelve `costoEstimado` (insumos de una unidad, en pesos).

**Impacto:** Medio
**Esfuerzo estimado:** Medio

### Contrato de `/api/productos/[id]/receta` (solo ADMIN)

| Caso | Respuesta |
|------|-----------|
| `GET` | `200 { productoId, items: [{ insumoId, cantidad, insumo: { id, nombre, unidad, precioUnitario } }], costoEstimado }` |
| `PUT { items: [{ insumoId, cantidad }] }` | Reemplaza la receta completa (lista vacía = sin receta). Responde igual que `GET`. |
| Insumo repetido, cantidad ≤ 0 o no numérica, más de 50 insumos | `400` con `error` |
| Insumo inexistente | `400` "El insumo N no existe" |
| Producto inexistente / id inválido | `404` / `400` |

### Contrato de `POST /api/inventario` (solo ADMIN)

Body: `{ nombre, unidad?, stockActual?, stockMinimo?, precioUnitario?, proveedorId? }`. Por defecto `unidad: "unidad"`,
stocks y precio en 0. Responde `201` con el insumo (montos en pesos). Errores `400` con `error`.

---

## Hallazgo AT-09 (completo) — Cancelación sin controles

El commit 4 dejó resuelto el estado y la transacción; faltaba el stock. Con este commit queda definido y cubierto:
cancelar un pedido **no cobrado** no mueve el stock (no se había descontado) y **anular** una venta reintegra lo que su
cobro descontó.

---

## Pantallas (mínimas)
- **Menú:** botón **Receta** (ícono de portapapeles) en cada producto. Abre un modal para elegir insumos y cantidades,
  con el costo de los insumos y el margen frente al precio de venta. Muestra los errores del servidor.
- **Inventario:** botón **Nuevo insumo** (nombre, unidad, precio, stock actual y mínimo, proveedor opcional). Además,
  la barra de stock ya no se rompe con stock mínimo 0 (dividía por cero) ni con stock negativo.

## Base de datos
Dos tablas nuevas (`RecetaItem`, `MovimientoStock`). Se crean solas al arrancar (paso 2 de `src/lib/migraciones.ts`);
no hace falta `db:push`. El SQL es el que genera Prisma y el test verifica que la base quede idéntica al esquema.

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| Cobro y anulación | **Sin cambios de forma.** Mueven el stock por debajo. |
| Endpoints nuevos | `GET/PUT /api/productos/[id]/receta`, `POST /api/inventario`. |
| Productos sin receta | Se venden igual; no mueven el stock (comportamiento anterior). |
| Stock negativo | Posible tras vender sin stock cargado; Inventario lo muestra como "Bajo". |

## Cómo verificar
```bash
npm test        # 677 tests (stock-recetas.test.ts: 29 casos; migraciones.test.ts incluye el paso 2)
npm run build
npm run dev     # en la consola: "[DB] Migración aplicada: Recetas de productos y movimientos de stock (AT-12)"
```
Prueba hecha sobre la `dev.db` de desarrollo (por API):
1. Se creó el insumo "Bacon" a $8.999,99 por kg (`POST /api/inventario`).
2. Receta de la Hamburguesa Doble: 0,4 kg de carne + 1 pan + 0,05 kg de bacon → `costoEstimado` $2.080.
3. Pedido de 3 hamburguesas y cobro: carne 25 → **23,8**, pan 48 → **45**, bacon 5 → **4,85**.
4. Anulación de esa venta: el stock volvió a **25 / 48 / 5** y quedaron 3 movimientos `VENTA` y 3 `ANULACION`.
5. `prisma migrate diff` contra el esquema: "No difference detected".

Prueba manual sugerida en la interfaz (Admin): Inventario → **Nuevo insumo**; Menú → botón **Receta** de un producto,
agregar el insumo y guardar; cobrar un pedido con ese producto y ver el stock bajar en Inventario; anular la venta
(cuando exista el botón en Caja, o por API) y ver el stock volver.

## Pendiente y limitaciones
- **Sin pantalla de movimientos:** los movimientos se guardan pero no hay una vista de historial de stock.
- **Ajustes manuales sin movimiento:** editar el stock a mano en Inventario no registra un `MovimientoStock`.
- **No hay borrado de insumos** (ni antes ni ahora). Un insumo usado en recetas o movimientos no podría borrarse sin
  antes quitarlo de las recetas.
- **El botón "Anular" en Caja** sigue pendiente en el frontend (commit 4).
- Las cantidades de stock siguen siendo `Float` (con redondeo a 4 decimales en cada movimiento).
