# Transacciones atómicas e integridad de datos

> Objetivo: que ninguna operación de negocio pueda dejar la base a medias, duplicada o inconsistente, aunque haya
> dos usuarios a la vez, un fallo de red o un reinicio en medio.
> Complementa L-010, L-011, L-012, L-013 de `01-fundamentos/LECCIONES-APRENDIDAS.md`.

## 1. ACID en una línea cada uno

- **Atomicidad:** todo o nada. Un fallo a mitad de camino deshace todo.
- **Consistencia:** la base pasa de un estado válido a otro válido (restricciones, claves foráneas, `CHECK`).
- **Aislamiento:** las transacciones simultáneas no se ven a medias. El grado depende del nivel de aislamiento.
- **Durabilidad:** lo confirmado (`COMMIT`) sobrevive a un corte de luz.

## 2. Qué va dentro de UNA transacción

Regla: **una operación de negocio = una transacción**. Si el negocio dice "cobrar", entonces cobrar + registrar la venta +
liberar la mesa + descontar stock + registrar movimientos van juntos (L-011).

Dentro de la transacción **NO** va:
- Llamadas a servicios externos (correo, pasarela de pago, HTTP): son lentas e imposibles de deshacer. Ver Outbox (§7).
- Esperas del usuario (nada de abrir la transacción y esperar un clic).
- Trabajo pesado que no necesita atomicidad (generar PDFs, redimensionar imágenes).
- Emisión de eventos en tiempo real **antes** del `COMMIT`: se emiten solo después de que la transacción terminó bien.

Dónde se **abre** la transacción: en la **capa de aplicación** (el caso de uso), porque ahí se sabe qué debe tener éxito o
fallar junto. El repositorio no abre transacciones propias: no sabe si forma parte de una operación mayor. La mecánica
(`BEGIN`/`COMMIT`) vive en infraestructura detrás de una abstracción (Unit of Work, `transaccion(fn)`, `ExecuteInTransaction`).

## 3. Niveles de aislamiento y qué anomalías previenen

| Anomalía | Read Committed | Repeatable Read / Snapshot | Serializable |
|---|---|---|---|
| Lectura sucia (leer datos no confirmados) | Evitada | Evitada | Evitada |
| Lectura no repetible | Posible | Evitada | Evitada |
| Fantasmas (filas nuevas en el rango) | Posible | Depende del motor (PostgreSQL la evita) | Evitada |
| **Actualización perdida** (leer, calcular, escribir) | **Posible** | PostgreSQL falla con error de serialización; otros motores no siempre | Evitada |
| Sesgo de escritura (*write skew*) | Posible | Posible | Evitada |

Guía de elección:
- **Read Committed (defecto en PostgreSQL y SQL Server):** alcanza si cada escritura crítica usa **condición en el
  `UPDATE`** o bloqueo explícito (§4). Es el 90 % de los casos.
- **Repeatable Read / Snapshot:** para reportes consistentes que leen varias tablas sin que cambien a mitad.
- **Serializable:** cuando la invariante involucra varias filas y no se puede expresar con una restricción (p. ej.
  "al menos un médico de guardia"). **Exige reintentar.**

> En PostgreSQL, los fallos de serialización llevan `SQLSTATE 40001` y los deadlocks `40P01`. La aplicación debe
> **reintentar la transacción completa** (incluida la lógica que decide qué SQL emitir). PostgreSQL no reintenta solo.
> En SQL Server son los errores 1205 (deadlock) y 3960 (conflicto de snapshot); en MySQL, 1213 y 1205.
> Fuente: [PostgreSQL – Serialization Failure Handling](https://www.postgresql.org/docs/18/mvcc-serialization-failure-handling.html).

## 4. Los cuatro patrones para evitar el "leer y después escribir" (check-then-act)

Este es el error más frecuente (L-010): dos peticiones leen "pendiente" y ambas cobran.

### 4.1 Escritura condicional (el preferido)
Reclamar el estado con **un solo `UPDATE` con condición** y mirar cuántas filas cambió:

```sql
UPDATE pedido SET estado = 'pagado'
WHERE id = :id AND estado IN ('abierto','servido');
-- filas afectadas = 0  →  otro ya lo cobró o el estado no lo permite  →  rechazar (409)
```
En Prisma: `updateMany({ where: { id, estado: { in: [...] } }, data })` y `if (count === 0) throw …`.
Es atómico en cualquier motor y no necesita bloqueos explícitos. **Va al inicio de la transacción.**

### 4.2 Concurrencia optimista (versión de fila)
Columna `version` (o `rowversion` en SQL Server, `xmin` en PostgreSQL). Se lee con la versión y se escribe condicionado a ella:

```sql
UPDATE producto SET precio = :nuevo, version = version + 1
WHERE id = :id AND version = :version_leida;
-- 0 filas → alguien lo modificó mientras editabas → devolver 409 "los datos cambiaron, recargá"
```
Ideal para formularios de edición (ABM): evita que el segundo usuario pise los cambios del primero sin saberlo.
EF Core: `[Timestamp]`/`IsRowVersion()` → `DbUpdateConcurrencyException`. Prisma: campo `version Int` y `updateMany` condicional.

### 4.3 Bloqueo pesimista
`SELECT ... FOR UPDATE` (PostgreSQL/MySQL) o `WITH (UPDLOCK, ROWLOCK)` (SQL Server): bloquea la fila hasta el `COMMIT`.
Usarlo cuando la contención es alta y reintentar sería costoso. Reglas:
- Bloquear siempre en **el mismo orden** (por id ascendente) para evitar deadlocks.
- Mantener la transacción corta.
- Para colas de trabajo: `FOR UPDATE SKIP LOCKED`.
- SQLite no tiene `FOR UPDATE`: usa `BEGIN IMMEDIATE` o serializa las escrituras en el proceso (§6).

### 4.4 Restricciones de la base como última defensa
Lo que la base puede garantizar, que lo garantice ella (no solo el código):
- `UNIQUE` (incluidos únicos parciales: un solo pedido abierto por mesa).
- `CHECK` (`stock >= 0`, `total >= 0`, `estado IN (...)`).
- `FOREIGN KEY` con la acción correcta (`RESTRICT` por defecto; `CASCADE` solo en dependientes puros).
- `NOT NULL` por defecto; `NULL` solo si "no aplica" es un estado real.

Una invariante protegida solo por código falla cuando entra una segunda ruta de escritura (script, otro servicio, importación).

## 5. Operaciones reversibles (contabilidad y stock)

- Los asientos **no se editan ni se borran**: se corrigen con un asiento inverso (anulación) (L-004).
- Todo movimiento automático (stock, saldo) se registra con **origen** (`MovimientoStock` con venta/pedido de origen),
  para poder revertir exactamente ese movimiento.
- Estados finales: máquina de estados explícita con la tabla de transiciones permitidas (L-012). Rechazar el resto con 4xx.
- Los ajustes manuales son **deltas con motivo**, nunca reemplazar el valor (queda rastro y se pueden auditar).

## 6. Bases de un solo escritor (SQLite)

Problema real (L-013): cinco cobros simultáneos dieron `[500, 500, 500, 200, 500]` porque cada transacción interactiva
esperaba el bloqueo de las otras hasta vencer el *timeout*.
- **WAL** (`journal_mode=WAL`): las lecturas no bloquean la escritura.
- **`busy_timeout`** razonable para esperas cortas.
- **Fila de escrituras dentro del proceso** (`transaccion()` de `05-referencia.../codigo/transaccion.ts`): cada escritura
  empieza cuando terminó la anterior. Válido porque hay **un solo proceso servidor**. Con varios procesos escritores se
  necesita `BEGIN IMMEDIATE` + reintento con retroceso o cambiar de motor.
- Las lecturas no pasan por la fila.
- Un test de integración contra SQLite **real** con N operaciones en paralelo demuestra que funciona. Una base simulada
  serializa por diseño y nunca muestra este error.

## 7. Efectos fuera de la base: Outbox e idempotencia

Cuando una operación debe además enviar un correo, publicar un mensaje o llamar a una API:

**Outbox transaccional:** en la **misma transacción** se guarda el cambio de negocio y una fila en la tabla `outbox`
(evento + carga + estado). Un trabajador aparte lee las filas pendientes, publica y las marca como enviadas. Garantiza
"al menos una vez"; por eso el consumidor debe ser idempotente. Para varios trabajadores: reclamar filas con
`FOR UPDATE SKIP LOCKED` o con un `UPDATE` de reclamo.

**Idempotencia:** repetir la misma petición no repite el efecto.
- Clave de idempotencia (`Idempotency-Key`) por operación creadora (pagos, pedidos): tabla con `UNIQUE(clave, ámbito)`
  y el resultado guardado; si llega repetida, se devuelve el resultado guardado.
- Naturalmente idempotente: escrituras condicionales por estado (§4.1).
- Mensajes: id de evento estable y tabla de procesados con `UNIQUE`.

Fuentes: [Where do transactions belong in Clean Architecture?](https://milanjovanovic.tech/blog/transactions-clean-architecture),
[Unit of Work con EF Core](https://milanjovanovic.tech/blog/unit-of-work-pattern-ef-core),
[Patrones de idempotencia](https://www.techinterview.org/post/3233473028/lld-idempotency-patterns/),
[Outbox](https://gravitee.io/corpus/gen-1019/online-transaction-processing/outbox-pattern.html).

## 8. Reintentos

Reintentar **solo** errores transitorios: deadlock, fallo de serialización, `SQLITE_BUSY`, pérdida de conexión.
- Reintentar la **transacción entera**, no una sentencia.
- Máximo 3–5 intentos, con retroceso exponencial y *jitter* aleatorio.
- La operación debe ser idempotente o estar protegida por escritura condicional.
- Nunca reintentar errores de negocio (400/409/422): darían siempre el mismo resultado.

```ts
// Esqueleto (TypeScript)
async function conReintentos<T>(fn: () => Promise<T>, intentos = 4): Promise<T> {
  for (let i = 1; ; i++) {
    try { return await fn(); }
    catch (e) {
      if (!esTransitorio(e) || i >= intentos) throw e;
      await esperar(2 ** i * 25 + Math.random() * 25);
    }
  }
}
```

## 9. Errores comunes y cómo se detectan

| Error | Síntoma | Prueba que lo detecta |
|---|---|---|
| Transacción sin reclamar el estado al inicio | Cobro duplicado con 2 peticiones simultáneas | N peticiones en paralelo: exactamente una gana |
| Efecto externo dentro de la transacción | Correo enviado y luego `ROLLBACK` | Fallo inyectado después del efecto |
| Evento emitido antes del `COMMIT` | La pantalla muestra algo que luego se deshizo | Test: ante fallo, no se emite ningún evento |
| `Float` para dinero | Arqueos que no cierran | Ida y vuelta de importes con decimales |
| Transacciones anidadas con la misma fila en distinto orden | Deadlocks esporádicos | Prueba de carga con orden cruzado |
| Transacción abierta durante una llamada lenta | Bloqueos largos, *timeouts* | Revisar que dentro no haya `await` externos |
| `catch` que traga el error y hace `COMMIT` igual | Datos a medias | Fallo inyectado en cada paso: la base queda igual que antes |

## 10. Lista de verificación (antes de dar por cerrada una operación de escritura)

- [ ] ¿Es una sola transacción con todo lo que debe ser atómico?
- [ ] ¿El estado se reclama al inicio con escritura condicional o versión?
- [ ] ¿Las restricciones de la base (`UNIQUE`, `CHECK`, `FK`) respaldan la regla?
- [ ] ¿Hay un test de concurrencia (N en paralelo) contra el **motor real**?
- [ ] ¿Hay un test de fallo inyectado que prueba que se deshace todo?
- [ ] ¿Los eventos y efectos externos ocurren después del `COMMIT` (o por Outbox)?
- [ ] ¿La operación es idempotente o tiene clave de idempotencia?
- [ ] ¿Se registra el movimiento (auditoría / asiento inverso posible)?

---

> **Validado en laboratorio (2026-10-07, PostgreSQL 18.4):** escritura condicional con 50 cobros simultáneos, sin sobreventa de stock,
> lost update (error y arreglo con `FOR UPDATE`), versión de fila, idempotencia con `ON CONFLICT`, Outbox con rollback,
> `SKIP LOCKED` con 10 workers, write skew con `SERIALIZABLE` + reintento y deadlock por orden de bloqueos.
> Código: `08-laboratorios/lab1-postgres-concurrencia/`. Lecciones L-060, L-061, L-062.
