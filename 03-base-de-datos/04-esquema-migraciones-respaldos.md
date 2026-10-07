# Diseño del esquema, migraciones, respaldos y rendimiento

> Complementa `01-eleccion-de-base-de-datos.md`, `02-transacciones-y-atomicidad.md` y `03-abm-robusto.md`.

## 1. Modelado

1. **Entidades y relaciones primero** (diagrama entidad-relación en `docs/`), después las tablas.
2. **Normalizar hasta 3FN** por defecto: cada dato en un solo lugar. Desnormalizar solo con una razón medida
   (rendimiento de un reporte) y documentada.
3. **Copiar, no referenciar, lo histórico:** un ítem de venta guarda nombre y precio de ese momento. Cambiar el precio
   del producto no debe alterar ventas pasadas.
4. **Estados como máquina explícita:** columna `estado` con `CHECK (estado IN (...))` y una tabla de transiciones en el código (L-012).
5. **Relaciones muchos a muchos:** tabla intermedia con clave compuesta o `UNIQUE(a_id, b_id)`.
6. **Catálogos chicos** (rubros, métodos de pago): tabla propia con clave foránea, no texto libre repetido.
7. **Claves:** `INTEGER` autoincremental para sistemas locales; `UUID` v7 (ordenable por tiempo) cuando los datos se
   generan en varios nodos o los ids no deben ser adivinables. No exponer ids secuenciales en recursos sensibles sin autorización por fila.
8. **Multi-tenant:** columna `tenant_id` en toda tabla, índice compuesto empezando por ella, filtro obligatorio en el
   repositorio (o RLS en PostgreSQL) y un test que intenta leer datos de otro tenant.

## 2. Tipos de datos: tabla de decisión

| Dato | Usar | Evitar |
|---|---|---|
| Dinero | `INTEGER/BIGINT` en centavos, o `NUMERIC(18,2)` | `FLOAT`, `DOUBLE`, `MONEY` de SQL Server |
| Cantidades físicas (kg, litros) | `NUMERIC` con escala definida, o entero en la unidad mínima (gramos) | `FLOAT` si se compara por igualdad |
| Fechas con hora | `TIMESTAMPTZ` / `datetime2` / UTC en texto ISO (SQLite) | `datetime` sin zona; guardar hora local |
| Fecha sin hora (cumpleaños) | `DATE` | Timestamp a medianoche |
| Booleano | `BOOLEAN` (SQLite: `INTEGER` 0/1 con `CHECK`) | Texto 'S'/'N' |
| Identificador | `INTEGER`/`BIGINT`/`UUID` | Texto libre como clave |
| Texto con longitud acotada | `VARCHAR(n)`/`TEXT` + `CHECK` de longitud | Sin límite |
| JSON | `JSONB` (PostgreSQL) para datos auxiliares | Guardar entidades relacionales como JSON |
| Contraseñas / PIN | Hash lento con sal (argon2, scrypt, bcrypt) | Texto plano, SHA simple (L-026) |

Rango: un `INT` de 32 bits llega a 2.147.483.647; en centavos son ~$21 millones. Limitar cada monto o usar `BIGINT` (ver `money.ts`).

## 3. Índices

- Uno por cada **clave foránea** (los motores no los crean solos, salvo MySQL/InnoDB).
- Uno por cada patrón frecuente de `WHERE` + `ORDER BY`. Orden de columnas: primero igualdad, después rango/orden.
- **Índices parciales** (`WHERE activo = 1`, `WHERE estado = 'abierto'`) para filas "vivas" y únicos con baja lógica.
- **Cubrientes** (`INCLUDE`) para listados críticos.
- Medir con `EXPLAIN` / `EXPLAIN ANALYZE` / plan de ejecución antes y después. Un índice no usado solo cuesta escrituras.
- Búsqueda `LIKE '%texto%'` no usa índice: usar full-text (PostgreSQL `tsvector`, SQLite FTS5) cuando importe.

## 4. Migraciones

Reglas (L-030):
- **Versionadas, en el repositorio, hacia adelante.** Una migración aplicada a datos reales no se edita: se agrega otra.
- **Automáticas al arrancar** en apps de escritorio o locales; en servidores, paso explícito del despliegue
  (`migrate deploy`), **nunca** `migrate dev` ni `db push` en producción.
- **Transaccionales e idempotentes:** detectan el estado real de la base antes de aplicar.
- **Copia de seguridad automática antes** de migrar datos existentes.
- **Probarlas contra la base real** (no simulada): crear una base con el esquema viejo, con datos, migrar y comparar con el esquema esperado.
- **Cambios compatibles en dos pasos (expandir y contraer)** cuando hay varias versiones conviviendo:
  1. *Expandir:* agregar columna/tabla nueva (nullable o con valor por defecto), el código escribe en ambas.
  2. *Migrar datos* en lotes.
  3. *Contraer:* en un release posterior, eliminar lo viejo.
- **Operaciones peligrosas:** renombrar columna, cambiar tipo, agregar `NOT NULL` sin valor por defecto, índices en tablas
  grandes (usar `CREATE INDEX CONCURRENTLY` en PostgreSQL). Cada una con plan y reversión.
- **Sin formateadores sobre archivos enteros** dentro de un cambio funcional (L-053).
- SQLite: `ALTER TABLE` es limitado; cambios complejos = crear tabla nueva, copiar, borrar, renombrar, **dentro de una transacción** y con `foreign_keys` desactivado temporalmente.

## 5. Respaldos y recuperación

- **Regla 3-2-1:** 3 copias, 2 medios distintos, 1 fuera del lugar.
- Un respaldo **no probado no existe:** restaurar periódicamente en un entorno aparte.
- **SQLite:** copiar con la API de respaldo o `VACUUM INTO` / `.backup`, no copiando el archivo mientras se escribe (con WAL, copiar también `-wal` y `-shm` o usar la API).
- **PostgreSQL:** `pg_dump` (lógico) + archivado WAL / `pg_basebackup` para recuperación a un punto en el tiempo (PITR).
- **SQL Server:** respaldos completos + diferenciales + de registro de transacciones.
- Definir **RPO** (cuánto dato se puede perder) y **RTO** (cuánto se puede tardar en volver) con el cliente.
- Antes de cualquier migración o depuración masiva: respaldo automático.

## 6. Rendimiento y conexiones

- **Pool de conexiones** con tamaño acotado (no uno por petición). En serverless, un pool externo (PgBouncer, Prisma Accelerate o similar).
- **Tiempos límite** en consultas y transacciones; transacciones cortas.
- **Consultas:** parametrizadas, con `LIMIT`, sin `SELECT *` en rutas calientes, sin N+1.
- **Reportes pesados** sobre réplica de lectura o vistas materializadas; no sobre la base que cobra.
- **Caché** solo de lo que se puede reconstruir; invalidación definida; nunca de datos que deben estar al instante (stock en el momento de cobrar).
- **Mantenimiento:** `VACUUM`/`ANALYZE` (PostgreSQL), reorganizar índices (SQL Server), `PRAGMA optimize` (SQLite).

## 7. Seguridad de datos

- Consultas siempre parametrizadas (inyección SQL). Nunca concatenar entrada del usuario.
- Usuario de base con el **mínimo privilegio** (la app no es dueña del esquema ni superusuario).
- Cifrado en tránsito (TLS) y, para datos sensibles, en reposo.
- Secretos fuera del código y del repositorio (L-023).
- Datos personales: minimizar, enmascarar en logs, política de retención.
- La base de desarrollo nunca contiene datos reales de producción sin anonimizar.

## 8. Pruebas de la capa de datos

| Qué | Cómo | Contra qué |
|---|---|---|
| Reglas de negocio y rutas | Mocks fieles del acceso a datos | Base simulada (nunca la `dev.db`, L-040) |
| Concurrencia (N en paralelo, una gana) | Test de integración | **Motor real** (L-013, L-041) |
| Atomicidad (fallo inyectado en cada paso) | Test de integración | Motor real |
| Migraciones (esquema viejo con datos → nuevo) | Fixture + comparación con el esquema esperado | Motor real |
| Restricciones (`UNIQUE`, `CHECK`, `FK`) | Insertar datos inválidos y esperar el rechazo | Motor real |
| Rendimiento de consultas críticas | `EXPLAIN` + volumen de prueba | Motor real con datos sintéticos |
| Contenedores | Testcontainers (PostgreSQL, SQL Server, MySQL) para usar el mismo motor que producción | Motor real |

## 9. Lista de verificación del diseño de datos

- [ ] Motor elegido con ADR y condiciones de reevaluación.
- [ ] Diagrama entidad-relación y máquinas de estado escritos.
- [ ] Dinero en enteros/`NUMERIC`; fechas en UTC.
- [ ] `NOT NULL`, `UNIQUE`, `CHECK` y `FK` declarados (y `PRAGMA foreign_keys=ON` si es SQLite).
- [ ] Índices por clave foránea y por consultas frecuentes, verificados con `EXPLAIN`.
- [ ] Migraciones versionadas, automáticas o en el despliegue, con respaldo previo y test contra motor real.
- [ ] Respaldo probado con una restauración real.
- [ ] Pool de conexiones y tiempos límite configurados.
- [ ] Usuario de base con mínimo privilegio; secretos fuera del repositorio.
