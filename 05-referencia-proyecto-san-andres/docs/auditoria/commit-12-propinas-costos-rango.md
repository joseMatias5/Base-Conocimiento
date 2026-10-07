# Commit 12 — Propinas fuera del ingreso, costos mensualizados y rango de montos

`fix(metricas): propinas fuera del ingreso, costos por periodicidad y montos dentro del rango de la base`

**Rama:** `fix/revision-pr1`.
**Archivos principales:** `src/app/api/metricas/route.ts`, `src/lib/costos.ts` (nuevo), `src/lib/ventas.ts`,
`src/app/api/caja/route.ts`, `src/lib/money.ts`, `src/lib/catalogo.ts`, `src/app/api/checkout/pay/route.ts`,
`src/app/api/pedidos/route.ts`, `src/app/api/pedidos/[id]/items/route.ts`.

---

## Hallazgo AT-28 — Las propinas se contaban como ingreso del negocio

**Ubicación:** API | `/api/metricas` (dashboard)
**Tipo:** Calidad (cálculo)
**Descripción:** `Venta.total` es consumo + propina. El dashboard sumaba `total` como "ventas" y lo usaba para el
balance del mes.

**Problema identificado:** La propina es del personal; contarla inflaba las ventas y el balance.

**Recomendación (aplicada):** Ingreso por venta = `total − propina` en ventas del día, semana, mes, por día y por
semana, y en el balance. Las propinas del mes se informan aparte (`propinasMes`). Las anulaciones restan también su
propina (asiento inverso). En Caja, `totalRecaudado` sigue incluyendo propinas (es lo que hay en caja, sirve para el
arqueo) y se agrega `totalVentas` (sin propinas).

**Impacto:** Medio
**Esfuerzo estimado:** Muy Bajo

---

## Hallazgo AT-29 — Costos sumados sin mirar la periodicidad

**Ubicación:** API | `/api/metricas`
**Tipo:** Calidad (cálculo)
**Descripción:** `costosMensuales` sumaba los montos tal cual: un costo diario de $1.000 contaba $1.000 por mes.

**Recomendación (aplicada):** `montoMensualCentavos()` (`src/lib/costos.ts`): diario × 365/12, semanal × 52/12,
mensual × 1. El balance usa ese total.

**Impacto:** Medio
**Esfuerzo estimado:** Muy Bajo

---

## Hallazgo AT-30 — Montos fuera del rango de la columna (error 500)

**Ubicación:** API | validación de montos y totales calculados
**Tipo:** Integridad de datos
**Descripción:** Prisma guarda `Int` como entero de **32 bits** (máximo 2.147.483.647 centavos, ~$21,4 millones). La
validación aceptaba montos de hasta $1.000.000.000, y un pedido con varios productos caros también podía superar el
máximo al sumar.

**Problema identificado:** La escritura fallaba con un error 500 en lugar de un mensaje claro.

**Recomendación (aplicada):** Cada monto cargado (precio, costo, precio de insumo, propina) admite hasta
**$10.000.000** (`MAX_MONTO_PESOS`). Los totales calculados (pedido nuevo, ítems modificados, cobro) se verifican con
`dentroDeRango()` antes de guardar: si no entran, `400` "supera el máximo que se puede registrar" y rollback.

**Impacto:** Bajo
**Esfuerzo estimado:** Muy Bajo

---

## Otros cambios
- `/api/metricas`: se quitó una consulta sin uso (`insumoBajoStock`) que comparaba dos columnas de una forma que la base
  simulada de los tests no soporta; las alertas de stock ya se calculaban en memoria.
- Base simulada de los tests: soporta rangos combinados (`{ gte, lt }`), necesarios para las ventas por día y semana.

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| Dashboard: ventas y balance | **Bajan** respecto de antes: ya no incluyen propinas. Es la corrección. |
| Dashboard: `propinasMes` | Campo nuevo (pesos). Opcional mostrarlo. |
| Dashboard: `costosMensuales` | Ahora es el equivalente mensual según la periodicidad de cada costo. |
| Caja: `resumen.totalVentas` | Campo nuevo: lo cobrado sin propinas. `totalRecaudado` no cambia. |
| Montos mayores a $10.000.000 | `400` con mensaje ("no puede superar $10.000.000"). |

## Cómo verificar
```bash
npm test        # 751 tests (metricas.test.ts nuevo)
```

## Pendiente
- El ranking de platos más vendidos sigue contando pedidos `entregado` sin cobrar y no descuenta ventas anuladas.
