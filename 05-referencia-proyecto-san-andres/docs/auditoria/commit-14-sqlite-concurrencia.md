# Commit 14 — Transacciones serializadas para SQLite y tests de integración con la base real

`fix(concurrencia): transacciones de escritura en fila para SQLite y tests de integración contra la base real`

**Rama:** `fix/revision-pr1`.
**Archivos principales:** `src/lib/transaccion.ts` (nuevo), todas las rutas con transacciones,
`src/__tests__/integracion-sqlite.test.ts` (nuevo).

---

## Hallazgo AT-35 — Cobros simultáneos fallaban con error 500 en SQLite real

**Ubicación:** API | todas las rutas con `prisma.$transaction`
**Tipo:** Concurrencia / Disponibilidad
**Descripción:** SQLite admite **un solo escritor a la vez**. Con varias transacciones interactivas en paralelo, cada
una esperaba el bloqueo de las otras hasta superar el límite de Prisma (5 s) y fallaba.

**Evidencia (test de integración, antes del arreglo):**
```text
5 cobros a la vez del mismo pedido      → [500, 500, 500, 200, 500]
8 cobros a la vez de pedidos distintos  → 7 × 500
Transaction API error: Transaction already closed: ... The timeout for this transaction was 5000 ms,
however 5648 ms passed since the start of the transaction.
```

**Problema identificado:** La base simulada de los tests serializa las transacciones por diseño, así que nunca pudo
mostrar el problema. Recién apareció al probar contra SQLite real.

**Consecuencias:**
- Dos mozos que cobran al mismo tiempo en hora pico podían recibir un error y no imprimir el ticket. El dato no se
  corrompía (las transacciones hacían rollback), pero la operación fallaba.

**Recomendación (aplicada):** `transaccion()` (`src/lib/transaccion.ts`) pone las transacciones de escritura **en fila
dentro del proceso**: cada una empieza cuando terminó la anterior, así nunca compiten por el bloqueo. El servidor es un
único proceso (app de escritorio o `npm start`), y las operaciones son de milisegundos. Las 12 transacciones de las rutas
la usan. Límite de cada transacción: 15 s.

**Impacto:** Alto
**Esfuerzo estimado:** Bajo

---

## Tests de integración contra SQLite real

`src/__tests__/integracion-sqlite.test.ts` crea una base temporal con el esquema actual y ejecuta las rutas reales con el
Prisma Client de verdad:

| Caso | Resultado esperado (verificado) |
|------|--------------------------------|
| 5 cobros a la vez del **mismo** pedido | Todos `200`, una sola venta, un solo descuento de stock; 4 respuestas son `reintento`. |
| 8 cobros a la vez de pedidos **distintos** | 8 ventas con números de ticket únicos. |
| Cobro y cancelación a la vez (×5) | Gana exactamente uno: pagado con venta, o cancelado sin venta. Nunca los dos. |
| Dos anulaciones a la vez de la misma venta | Una sola anulación; el stock se reintegra una vez. |
| Cobrar de nuevo tras anular | `400` (no se trata como reintento). |

## Cambios visibles para el frontend
Ninguno de contrato. Los cobros simultáneos dejan de fallar.

## Cómo verificar
```bash
npm test        # 792 tests (incluye integracion-sqlite.test.ts)
```

## Limitaciones
- La fila es por proceso: si alguna vez se corrieran **dos** servidores contra el mismo archivo SQLite, volvería a haber
  contención. No es el caso de la app de escritorio ni del modo LAN (un solo servidor).
