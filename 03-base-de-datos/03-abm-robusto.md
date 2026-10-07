# ABM robusto (Alta, Baja, Modificación) y consulta

> ABM = lo que casi todo sistema de gestión tiene por entidad: crear, listar/ver, modificar, dar de baja.
> Parece trivial y es donde más se acumulan los errores. Este documento es la receta completa, válida para cualquier
> lenguaje; los ejemplos están en SQL y TypeScript, y §9 da el equivalente .NET y Python.

## 1. Antes de escribir el primer ABM: decisiones por entidad

Para **cada** entidad responder y anotar en el documento del cambio:

| Pregunta | Opciones | Criterio |
|---|---|---|
| ¿Se puede borrar de verdad? | Borrado físico / baja lógica / no se borra | Si hay otras filas o asientos que la referencian, **baja lógica**. Si es contable, **no se borra** (se anula). |
| ¿Cuál es la clave natural y cuál la técnica? | `id` autoincremental o UUID + `UNIQUE` en la clave natural | El `id` técnico nunca cambia; la clave natural (código, DNI, email) lleva `UNIQUE`. |
| ¿Qué campos son obligatorios, únicos, con rango? | `NOT NULL`, `UNIQUE`, `CHECK` | Tanto en la base como en la validación de entrada. |
| ¿Quién puede hacer cada operación? | Matriz rol × operación | Se declara y se prueba (matriz de permisos). |
| ¿Hay concurrencia de edición? | Versión de fila (concurrencia optimista) | Si dos personas pueden editar lo mismo, sí. |
| ¿Hay que auditar cambios? | Campos de auditoría / tabla de historial | Dinero, precios, permisos, datos personales: sí. |
| ¿Qué pasa con lo relacionado al dar de baja? | `RESTRICT` / desactivar / `CASCADE` | Por defecto `RESTRICT` y mensaje claro. |

## 2. Esquema base de toda tabla de negocio

```sql
CREATE TABLE producto (
  id           INTEGER PRIMARY KEY,            -- técnico, inmutable (o UUID)
  codigo       TEXT    NOT NULL,               -- clave natural
  nombre       TEXT    NOT NULL CHECK (length(trim(nombre)) BETWEEN 1 AND 120),
  precio       INTEGER NOT NULL CHECK (precio >= 0),   -- centavos enteros
  stock        INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  activo       INTEGER NOT NULL DEFAULT 1,     -- baja lógica (BOOLEAN en otros motores)
  version      INTEGER NOT NULL DEFAULT 1,     -- concurrencia optimista
  creado_en    TEXT    NOT NULL DEFAULT CURRENT_TIMESTAMP,   -- UTC
  actualizado_en TEXT  NOT NULL DEFAULT CURRENT_TIMESTAMP,
  creado_por   INTEGER REFERENCES usuario(id),
  actualizado_por INTEGER REFERENCES usuario(id)
);
CREATE UNIQUE INDEX ux_producto_codigo ON producto (codigo) WHERE activo = 1;  -- único parcial: permite reusar un código dado de baja
```

Reglas del esquema:
- **Dinero:** entero en la unidad mínima (centavos) o `NUMERIC(p,s)`. Jamás `FLOAT`/`DOUBLE` (L-001).
- **Fechas:** guardar en UTC; mostrar en hora local. Períodos `[inicio, fin)` (L-003).
- **Texto:** definir longitud máxima; normalizar (`trim`, mayúsculas/minúsculas si el criterio de unicidad lo exige).
- **Índices:** uno por cada clave foránea y por cada columna usada en `WHERE`/`ORDER BY` de los listados. Medir antes de agregar más.
- **Nombres:** del lenguaje del negocio, singular, consistentes (`snake_case` en SQL; el ORM mapea).

## 3. Alta (crear)

1. **Autenticar y autorizar** (rol que puede crear).
2. **Validar la entrada** en el borde con un esquema (zod, FluentValidation, Pydantic, Bean Validation): tipos, rangos,
   longitudes, formato. Los errores se devuelven como `400` con el campo y el mensaje legible. Nunca `500`.
3. **Ignorar lo que el cliente no debe decidir:** `id`, `version`, `creado_por`, totales, estados iniciales (L-002).
4. **Regla de negocio** en el dominio (¿ya existe el código? ¿el rubro está activo?).
5. **Insertar** y dejar que la restricción `UNIQUE` sea la defensa final: capturar el error de duplicado y devolver `409`
   con mensaje de negocio ("ya existe un producto con ese código"). No confiar solo en "consultar si existe y luego insertar" (carrera).
6. **Devolver** `201` con el recurso creado (y `Location`), con el dinero ya convertido a la unidad de la API.
7. Si el alta toca varias tablas (cabecera + ítems) → **una transacción** (`02-transacciones-y-atomicidad.md`).
8. Si el cliente puede reenviar (doble clic, red lenta) → **clave de idempotencia** o deshabilitar el botón + `UNIQUE` natural.

## 4. Consulta (listar y ver)

- **Siempre paginar.** Por defecto 20–50, máximo 100–200 impuesto en el servidor. Nunca "traer todo".
- **Paginación por cursor (keyset)** para listas grandes o que cambian: `WHERE (fecha, id) < (:f, :i) ORDER BY fecha DESC, id DESC LIMIT :n`.
  `OFFSET` solo para tablas pequeñas (se vuelve lento y salta/repite filas si hay altas).
- **Orden estable y determinista:** siempre desempatar por `id`.
- **Filtros y orden por lista blanca:** el cliente elige entre campos permitidos; nunca concatenar texto en el SQL (inyección). Parametrizar siempre.
- **Proyección mínima:** devolver solo los campos que la pantalla usa. No exponer hashes, ids internos de otros usuarios ni datos sensibles (L-025).
- **Baja lógica:** las consultas por defecto excluyen lo dado de baja (filtro global en el ORM) y hay un parámetro explícito para incluirlo (solo ADMIN).
- **N+1:** cargar relaciones con un join/`include` o una segunda consulta por lote, no una consulta por fila. Medir con el log del ORM.
- **Reportes:** que sean consultas de agregación en la base, no cargar todo a memoria y sumar en el código. Usar el mismo criterio de períodos en todos.
- Los listados devuelven `{ items, total?, siguienteCursor }`. El `total` exacto es costoso en tablas grandes: ofrecerlo solo si hace falta.

## 5. Modificación

1. Autorizar. Validar con un esquema **parcial** (solo los campos enviados) para `PATCH`; completo para `PUT`.
2. **Campos inmutables** (`id`, `creado_*`, claves que ya tienen movimientos) se rechazan si cambian.
3. **Concurrencia optimista:** el cliente manda la `version` que vio.
   ```sql
   UPDATE producto SET nombre = :n, precio = :p, version = version + 1,
          actualizado_en = CURRENT_TIMESTAMP, actualizado_por = :uid
   WHERE id = :id AND version = :version AND activo = 1;
   -- 0 filas → releer: si no existe, 404; si existe, 409 "otro usuario lo modificó"
   ```
4. **Cambios que afectan a lo ya registrado** (un precio nuevo) no reescriben el pasado: los pedidos y ventas guardan
   su propio precio al momento (copia, no referencia).
5. **Cantidades y saldos** (stock, saldo de cuenta) no se reemplazan: se ajustan con un **delta + motivo** y su
   movimiento registrado (L-004). `UPDATE stock = stock + :delta WHERE id = :id AND stock + :delta >= 0`.
6. **Estados:** solo transiciones permitidas, reclamadas con escritura condicional (L-010, L-012).
7. **Auditoría:** si la entidad es sensible, escribir en la tabla de historial dentro de la **misma transacción**
   (quién, cuándo, qué campo, valor anterior, valor nuevo).
8. Devolver `200` con el recurso actualizado (incluida la nueva `version`).

## 6. Baja

Árbol de decisión:

```
¿La fila tiene o puede tener movimientos, ventas, asientos o referencias?
├─ Sí → NO se borra. Baja lógica (activo = 0 / fecha_baja) y se oculta en listados.
│        ¿Es un hecho contable (venta, pago)? → se ANULA con asiento inverso, no se "da de baja".
└─ No (dato de catálogo sin uso, borrador, token vencido) → borrado físico permitido.
```

Reglas:
- Antes de baja física o lógica, verificar dependencias y responder `409` con un mensaje de negocio
  ("el producto tiene pedidos abiertos"), no con el error crudo de la clave foránea.
- **`ON DELETE CASCADE`** solo para dependientes que no tienen sentido sin el padre (ítems de un borrador). Nunca en datos contables.
- La baja lógica **no rompe la unicidad**: usar índice único parcial (`WHERE activo = 1`) o incluir `fecha_baja` en la clave.
- **Reactivar** es una operación explícita ("alta de lo dado de baja"), con sus validaciones.
- **Usuarios:** nunca se borran; se desactivan, y la sesión se revoca en la siguiente petición (L-021).
- **Borrado masivo o depuración:** proceso aparte, con copia de seguridad previa, en lotes, con registro.
- **Datos personales (GDPR/Ley 25.326 u homólogas):** si se debe poder borrar, anonimizar los campos personales y conservar el asiento.

## 7. Auditoría e historial

Tres niveles, de menor a mayor costo:
1. **Campos de auditoría** en la fila (`creado_en/por`, `actualizado_en/por`): casi siempre.
2. **Tabla de historial/bitácora** (`auditoria`: entidad, id, acción, usuario, fecha, antes, después en JSON): dinero, precios, permisos, datos personales.
3. **Tablas temporales / event sourcing**: solo si el negocio exige reconstruir el estado en cualquier fecha.
La bitácora se escribe en la misma transacción que el cambio y **no se edita ni se borra**.

## 8. Validación en dos capas

| Capa | Qué valida | Ejemplo |
|---|---|---|
| Borde (API) | Forma, tipos, rangos, longitudes, formatos | `precio` es número ≥ 0 y ≤ máximo; `nombre` 1–120 caracteres |
| Dominio | Reglas de negocio e invariantes | no se puede vender sin stock; transición de estado permitida |
| Base de datos | Lo que no puede dejar de cumplirse | `NOT NULL`, `UNIQUE`, `CHECK`, `FK` |

Antes de endurecer una validación, leer el **payload exacto** que manda cada pantalla y probarlo (L-031).

## 9. Equivalentes por tecnología

| Aspecto | Node/TypeScript | .NET (C#) | Python | Java |
|---|---|---|---|---|
| Validación de entrada | zod, class-validator | FluentValidation, DataAnnotations | Pydantic | Bean Validation (Jakarta) |
| ORM | Prisma, Drizzle, TypeORM | EF Core, Dapper (SQL directo) | SQLAlchemy, Django ORM | JPA/Hibernate, jOOQ |
| Concurrencia optimista | campo `version` + `updateMany` condicional | `[Timestamp]` / `IsRowVersion()` → `DbUpdateConcurrencyException` | `version_id_col` (SQLAlchemy) | `@Version` (JPA) |
| Baja lógica | extensión/middleware que filtra | `HasQueryFilter(e => !e.Eliminado)` | filtro en el query base / manager | `@SQLRestriction` / `@Where` |
| Auditoría automática | middleware de Prisma / extensión | `SaveChangesInterceptor` | eventos de SQLAlchemy | Spring Data Auditing |
| Transacción | `$transaction` / helper propio | `SaveChanges` (implícita) o `BeginTransaction` | `session.begin()` | `@Transactional` |
| Migraciones | Prisma Migrate | `dotnet ef migrations` | Alembic / Django migrations | Flyway / Liquibase |
| Errores de duplicado | código `P2002` (Prisma) | `DbUpdateException` con código del motor | `IntegrityError` | `DataIntegrityViolationException` |

## 10. Lista de verificación de un ABM terminado

**Alta:** validación en el borde · campos del servidor no tomados del cliente · `UNIQUE` en la base · `409` legible ante duplicado · transacción si toca varias tablas · idempotencia.
**Consulta:** paginado con tope · orden estable · filtros por lista blanca · sin N+1 · sin datos sensibles · excluye bajas.
**Modificación:** esquema parcial · campos inmutables protegidos · versión de fila · deltas para saldos · estados por transiciones · auditoría.
**Baja:** dependencias verificadas · lógica vs física decidida · unicidad no rota · sin `CASCADE` en contable · mensaje de negocio.
**Pruebas:** camino feliz · permisos por rol · validación (400) · duplicado (409) · conflicto de versión (409) · concurrencia (N en paralelo) · fallo inyectado con rollback · el payload real de la pantalla.
**Documento del cambio:** decisiones de §1 y "Cambios visibles para el frontend".
