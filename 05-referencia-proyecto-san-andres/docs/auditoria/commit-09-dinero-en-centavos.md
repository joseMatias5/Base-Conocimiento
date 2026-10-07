# Commit 9 — Dinero en centavos enteros y migración automática del esquema

`fix(dinero): montos en centavos enteros y migración automática de la base al arrancar`

**Archivos principales:** `prisma/schema.prisma`, `src/lib/money.ts`, `src/lib/migraciones.ts` (nuevo),
`src/instrumentation.ts` (nuevo), `src/lib/catalogo.ts`, `src/lib/ventas.ts`, rutas de `productos`, `pedidos`,
`pedidos/[id]/items`, `pedidos/[id]/cancel`, `pedidos/history`, `mesas`, `checkout/pay`, `ventas/[id]/anular`,
`caja`, `metricas`, `costos` e `inventario`; `prisma/seed.ts`.

---

## Hallazgo AT-13 (completo) — Dinero guardado como número de punto flotante

**Ubicación:** Base de datos | Esquema | `Producto.precio`, `ItemPedido.precio`, `Pedido.total`, `Venta.total`,
`Venta.propina`, `CostoFijo.monto`, `Insumo.precioUnitario`
**Tipo:** Calidad (cálculo) / Integridad de datos
**Descripción:** Todos los montos eran `Float`. El punto flotante binario no representa exactamente la mayoría de
los decimales, así que las sumas acumulan error. El commit 1 agregó un redondeo a centavos en los cálculos, que
tapaba el síntoma, pero en la base se seguía guardando un `Float`.

**Evidencia simplificada:**
```ts
0.1 + 0.2                    // 0.30000000000000004
precio  Float                // schema.prisma: $1.250,50 se guardaba como 1250.5 (aproximado en binario)
roundMoney(subtotal + propina)  // parche en cada cálculo, fácil de olvidar en uno nuevo
```

**Problema identificado:** Un tipo inexacto para dinero obliga a redondear en cada operación; cualquier cálculo
nuevo que lo olvide produce diferencias de centavos.

**Consecuencias:**
- Arqueos de Caja que no cierran por centavos y totales que se muestran como `1249.9999999`.
- Dos reportes que suman lo mismo por caminos distintos pueden dar resultados diferentes.

**Principios afectados:**
- Usar un tipo exacto para dinero.
- Una sola fuente de verdad para las reglas de cálculo.

**Recomendación (aplicada):** Guardar los montos como **enteros en centavos** (`Int`): $1.250,50 = `125050`.
Se eligió en lugar de `Decimal` porque SQLite no tiene un tipo decimal real (lo puede guardar como flotante) y
porque los enteros no obligan a manejar objetos `Decimal` en todo el código.
- **La API sigue hablando en pesos**: el frontend no cambia. La conversión ocurre solo en los bordes
  (`src/lib/money.ts`): los esquemas zod convierten la entrada con `aCentavos()` y cada respuesta o evento SSE
  pasa por `enPesos()`.
- Todo el cálculo intermedio (subtotales, total del pedido, cobro, anulación, resumen de Caja, métricas) se hace
  con enteros: la suma es exacta y desaparece `roundMoney()`.
- `aCentavos()` corrige el ruido binario antes de redondear: `1.005` se convierte en `101` centavos, no en `100`.
- Un monto que redondea a 0 centavos (p. ej. `0,001`) se rechaza como precio o costo.

**Impacto:** Medio
**Esfuerzo estimado:** Medio

---

## Hallazgo nuevo AT-20 — La base de una instalación existente nunca recibía cambios de esquema

**Ubicación:** App de escritorio | `electron/main.js` → `prepareDatabase()`
**Tipo:** Operación / Despliegue
**Descripción:** Electron copia `template.db` **solo en el primer arranque**. Si la instalación ya tiene su base,
la usa tal cual. No existía ningún mecanismo de migración: cualquier cambio de esquema (como el de este commit)
haría fallar a las instalaciones existentes con el Prisma Client nuevo.

**Problema identificado:** Actualizar la app rompía la base de datos de quien ya la estaba usando.

**Consecuencias:**
- Imposible evolucionar el esquema sin pedir a cada cliente que borre su base (y pierda sus datos).

**Recomendación (aplicada):** Migraciones automáticas al arrancar el servidor:
- `src/instrumentation.ts`: Next.js llama a `register()` una vez al iniciar, antes de atender peticiones.
- `src/lib/migraciones.ts`: lista ordenada de pasos. Cada paso **detecta** si hace falta mirando la base
  (`PRAGMA table_info`), sin número de versión: una base nueva creada con `prisma db push` no se toca, y correr
  las migraciones dos veces no hace nada la segunda vez.
- El paso de centavos reconstruye cada tabla (SQLite no permite cambiar el tipo de una columna), partiendo de la
  definición real de la tabla en esa base y copiando los montos con `CAST(ROUND(x * 100) AS INTEGER)`. Es el mismo
  procedimiento que usa Prisma Migrate.
- Todo el paso corre en **una transacción** con las claves foráneas desactivadas (si no, `DROP TABLE Pedido`
  dispararía el `ON DELETE CASCADE` y borraría los ítems). Antes de confirmar se ejecuta `PRAGMA foreign_key_check`:
  si la migración dejó **más** relaciones rotas que las que la base ya tenía, se hace rollback y la base queda como
  estaba (las filas huérfanas previas no bloquean la migración para siempre).
- Si la migración falla, el servidor no atiende peticiones (Next informa "An error occurred while loading
  instrumentation hook" con el detalle) en lugar de operar con un esquema incompatible. Electron, además, ya hace
  una copia de seguridad de la base en cada arranque. *Verificado:* con una base que forzaba el fallo, el servidor
  no respondió y la tabla quedó intacta (`REAL`, mismos valores).
- Para el siguiente cambio de esquema basta con agregar un paso al final de `PASOS`.

**Impacto:** Alto
**Esfuerzo estimado:** Medio

---

## Otros cambios
- `prisma/seed.ts`: montos en centavos con `aCentavos()`. Además, la carga de **ventas históricas** usaba campos que
  no existen en `Venta` (`fecha`, `mesa`) y fallaba al final de `npm run db:seed`; ahora usa `fechaCobro` y `mesaNumero`.
- `vitest.config.ts`: tiempo límite de los tests en 20 s. Los tests de PIN (scrypt) y los de migración (SQLite real)
  son pesados en CPU y, en paralelo, podían superar los 5 s por defecto.

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| Respuestas y eventos SSE | **Sin cambios de forma ni de unidad**: todos los montos siguen en pesos. |
| Montos con más de 2 decimales | Se redondean a centavos al guardarse (`19.999` → `20.00`). |
| Precio o monto que redondea a 0 | `400` "precio: debe ser mayor que 0" (antes, `0.001` se aceptaba). |
| Base de datos | **Cambio de esquema.** Se migra sola al arrancar (`npm run dev`, `npm start` o la app de escritorio). |

## Cómo verificar
```bash
npm test        # 629 tests (incluye migraciones.test.ts contra SQLite real)
npm run build
npm run dev     # en la consola: "[DB] Migración aplicada: Montos de dinero en centavos enteros (AT-13)" (solo la 1.ª vez)
```
Pruebas hechas sobre una copia de la `dev.db` de desarrollo:
1. La migración convirtió `Producto.precio` de `REAL` a `INTEGER` (`5500.0` → `550000`) y `prisma migrate diff`
   contra el esquema actual responde **"No difference detected"**.
2. `GET /api/productos`, `/api/caja` y `/api/metricas` devuelven los mismos importes en pesos que antes de migrar.
3. Pedido de 3 × $5.500 + 1 × $1.800, cobrado con propina de $150,75: venta de **$18.450,75** en la respuesta y
   `1845075` (entero) en la base. La anulación registró exactamente `-1845075`.

El test `migraciones.test.ts` reproduce lo mismo de forma automática: crea una base con el esquema anterior, carga
montos con decimales (incluidos negativos de anulación), migra y verifica tipos, valores, que no se pierdan filas
hijas, que el Prisma Client nuevo lea la base, que quede idéntica al esquema actual, que una base nueva no se toque,
que una fila huérfana previa no la bloquee y que un paso que rompe relaciones se deshaga entero.

## Pendiente y limitaciones
- **Desarrollo:** si alguien corre `npm run db:push` sobre una `dev.db` vieja *antes* de arrancar el servidor, Prisma
  propone convertir las columnas sin multiplicar por 100 (y avisa de pérdida de datos). Arrancar primero
  `npm run dev` (que migra) o recrear la base con `npm run db:setup`.
- Las cantidades de stock (`Insumo.stockActual`, `stockMinimo`) siguen siendo `Float`: no son dinero.
- La app de escritorio debe probarse con un instalador nuevo sobre una instalación existente (`npm run desktop:test`).
