# Elección de la base de datos según el sistema

> Regla de oro: **empezar por los requisitos, no por el motor**. La base se elige con las preguntas de §1 y se registra
> en un ADR (`docs/adr/NNNN-base-de-datos.md`) con contexto, opciones, decisión y consecuencias. Cambiar de motor
> después es caro: la elección se hace en la Fase 0 de `GUIA-APP-ROBUSTA.md`.

## 1. Las 8 preguntas que deciden el motor

| # | Pregunta | Por qué importa |
|---|---|---|
| 1 | ¿Hay dinero, stock, contabilidad o cualquier dato donde un error es un daño real? | Exige ACID completo, restricciones e integridad referencial → **relacional**. |
| 2 | ¿Cuántos escritores simultáneos habrá (usuarios y procesos que escriben a la vez)? | SQLite = un escritor. Más de unos pocos escritores concurrentes sostenidos → servidor (PostgreSQL / SQL Server / MySQL). |
| 3 | ¿Dónde corre? (un solo equipo, LAN, nube, varios servidores) | Embebida (SQLite) solo si la app y la base viven en la misma máquina/proceso. |
| 4 | ¿Cuántos datos y qué consultas? (reportes, joins, agregados, búsqueda de texto, geografía) | Reportes y joins complejos → relacional con buen planificador. Geo → PostGIS. |
| 5 | ¿El esquema es estable o cambia mucho (documentos heterogéneos)? | Datos realmente sin esquema fijo → documental. Casi siempre `JSONB` en PostgreSQL alcanza. |
| 6 | ¿Hay requisitos de disponibilidad, réplicas, copias de seguridad en caliente? | Servidor con replicación; SQLite necesita copias controladas del archivo. |
| 7 | ¿Qué sabe operar el equipo y qué ofrece el hosting/cliente? | Un motor que nadie sabe operar es un riesgo. Un cliente con licencia SQL Server o stack .NET empuja a SQL Server. |
| 8 | ¿Licencia y costo? | PostgreSQL/MySQL/SQLite: gratis. SQL Server/Oracle: licencias (hay ediciones gratuitas con límites). |

## 2. Guía rápida por tipo de sistema

| Sistema | Motor recomendado | Motivo | Cuidado |
|---|---|---|---|
| Local único en una sola PC o caja (POS, taller, consultorio, app de escritorio) | **SQLite** (WAL) | Cero administración, un archivo, rapidísimo para uno o pocos usuarios. | Un solo escritor: serializar escrituras (L-013); copia de seguridad del archivo; migraciones automáticas (L-030). |
| Gestión de un negocio en red local con varios puestos que escriben | **PostgreSQL** (o SQL Server si el entorno es Microsoft) | Varios escritores reales, ACID, roles, replicación. | Instalar y respaldar el servidor. |
| Sistema web SaaS / multi-cliente | **PostgreSQL** | Transacciones robustas, `JSONB`, índices parciales, RLS (seguridad por fila) para multi-tenant. | Definir estrategia de tenant desde el inicio. |
| Contable / financiero / inventario valorizado | **PostgreSQL** o **SQL Server** | Integridad, `SERIALIZABLE` cuando haga falta, `NUMERIC` exacto. | Dinero en enteros de la unidad mínima o `NUMERIC`, nunca `FLOAT` (L-001). |
| Ecosistema .NET empresarial / Windows Server | **SQL Server** | Integración con EF Core, herramientas, soporte corporativo. | Licencias. |
| Hosting compartido barato, CMS (WordPress, WooCommerce) | **MySQL / MariaDB** | Es lo que asume el ecosistema. | Activar modo estricto (`STRICT_ALL_TABLES`), motor InnoDB. |
| Catálogo de documentos heterogéneos, contenido, eventos con forma variable | **MongoDB** o PostgreSQL con `JSONB` | Esquema flexible. | Transacciones multi-documento existen pero son más limitadas; no usar para dinero salvo que se sepa por qué. |
| Caché, sesiones, colas livianas, contadores, rate-limit | **Redis** (complemento, no base principal) | Memoria, TTL. | Los datos pueden perderse: nunca es la fuente de verdad. |
| Búsqueda de texto avanzada | **PostgreSQL FTS** primero; **OpenSearch/Elasticsearch** solo si el volumen lo exige | Evitar un motor más que operar. | Es un índice derivado, no la fuente de verdad. |
| Series de tiempo (sensores, métricas) | **TimescaleDB** (extensión de PostgreSQL) o InfluxDB | Compresión y consultas por tiempo. | — |
| Geográfico (mapas, GIS) | **PostgreSQL + PostGIS** | Estándar de facto. | — |
| Grafos de relaciones profundas (recomendaciones, redes) | **Neo4j** (solo si el caso es realmente de grafos) | Recorridos eficientes. | La mayoría de los casos se resuelven con SQL recursivo (`WITH RECURSIVE`). |
| Analítica pesada / BI sobre históricos | **DuckDB** (local) o un almacén columnar (BigQuery, ClickHouse) | Lecturas masivas. | Se alimenta desde la base transaccional; no se mezcla con ella. |

**Default cuando hay dudas y el sistema crece o es multiusuario: PostgreSQL.**
**Default cuando es de una sola máquina y pocos usuarios: SQLite.**
La combinación habitual correcta es **una base relacional como fuente de verdad** + componentes derivados (caché, búsqueda,
analítica) que se pueden reconstruir.

## 3. Relacional vs NoSQL: criterio de decisión

Elegir NoSQL solo si se cumple **al menos una** de estas condiciones y se puede justificar por escrito:
- Los datos son documentos autocontenidos que se leen y escriben siempre completos y **no** se relacionan entre sí.
- El volumen o la distribución geográfica exigen escalar escrituras horizontalmente más allá de un nodo relacional.
- El esquema es genuinamente impredecible.

Si hay relaciones, totales, reportes o dinero: **relacional**. "Para no definir el esquema" no es una razón: el esquema
se define igual, pero en el código y sin que nadie lo verifique.

## 4. Tabla comparativa de los motores habituales

| Aspecto | SQLite | PostgreSQL | MySQL/MariaDB | SQL Server | MongoDB |
|---|---|---|---|---|---|
| Modelo | Relacional embebido | Relacional (objeto-relacional) | Relacional | Relacional | Documental |
| Escritores concurrentes | 1 a la vez (WAL permite lecturas simultáneas) | Muchos (MVCC) | Muchos (InnoDB) | Muchos | Muchos |
| Transacciones ACID | Sí | Sí, muy completas | Sí (InnoDB) | Sí | Sí (multi-documento con limitaciones) |
| Niveles de aislamiento | `SERIALIZABLE` efectivo (un escritor) | Read Committed (defecto), Repeatable Read, Serializable (SSI) | Repeatable Read (defecto) | Read Committed (defecto), Snapshot, Serializable | Snapshot en transacciones |
| Tipos exactos para dinero | `INTEGER` (centavos) | `NUMERIC` o `BIGINT` | `DECIMAL` o `BIGINT` | `DECIMAL` / `MONEY` (evitar `MONEY`) | `Decimal128` |
| JSON | Funciones JSON | `JSONB` indexable (excelente) | `JSON` | `JSON` (funciones) | Nativo |
| Restricciones (`CHECK`, `FK`, únicos parciales) | `FK` hay que activarlas (`PRAGMA foreign_keys=ON`) | Completas | `CHECK` desde 8.0.16 | Completas | Validación de esquema opcional |
| Seguridad por fila | No | RLS nativa | No | RLS nativa | No (a nivel de aplicación) |
| Operación | Ninguna | Media | Media | Media (Windows/Linux) | Media |
| Escala vertical típica | Pequeña | Muy alta | Alta | Muy alta | Alta, escala horizontal |

Detalles específicos que han causado errores reales:
- **SQLite:** `PRAGMA foreign_keys=ON` por conexión; `PRAGMA journal_mode=WAL`; `busy_timeout`; un solo escritor (L-013);
  tipado dinámico (una columna `INTEGER` acepta texto si no hay `CHECK`/`STRICT`). Usar tablas `STRICT` cuando sea posible.
- **PostgreSQL:** `Read Committed` por defecto permite anomalías de lectura-modificación-escritura si no se bloquea o se
  usa condición en el `UPDATE`; ver `02-transacciones-y-atomicidad.md`.
- **MySQL:** sin modo estricto, trunca datos en silencio; revisar `sql_mode`.
- **SQL Server:** `READ COMMITTED SNAPSHOT` (RCSI) evita lectores bloqueando escritores; `datetime2` mejor que `datetime`.
- **MongoDB:** las operaciones sobre un solo documento son atómicas; modelar para que las invariantes vivan en un solo documento.

## 5. Plantilla de decisión (ADR de base de datos)

```
# ADR-000X · Base de datos

Contexto: usuarios, escritores simultáneos, dónde corre, datos sensibles, volumen estimado en 1 y 3 años.
Opciones: 2–3 motores con pros y contras en ESTE contexto.
Decisión: motor elegido + versión + modo (p. ej. SQLite en WAL / PostgreSQL 16 con RCSI...).
Consecuencias: qué hay que construir por haberlo elegido (serialización de escrituras, copias de seguridad,
               replicación, migraciones) y bajo qué condiciones se reevalúa (p. ej. "más de 5 puestos escribiendo").
```

## 6. Camino de migración (cuando se queda chico)

SQLite → PostgreSQL es habitual. Para que sea barato:
- Usar un ORM con esquema declarativo (Prisma, EF Core, Drizzle, SQLAlchemy) y **no** SQL específico del motor en el dominio.
- Dinero en enteros, fechas en UTC, ids como `INTEGER`/`UUID` consistentes.
- Mantener las migraciones versionadas y probadas contra la base real (L-030).
- Aislar el acceso a datos tras repositorios o un módulo único (Repository), como en `02-arquitectura/`.

## Fuentes consultadas
- Guías comparativas de selección de motor (PostgreSQL por defecto en sistemas con crecimiento; SQLite para uso local de pocos usuarios):
  [Which database to use in your next fullstack application](https://dev.to/manonja/a-quick-and-comprehensive-guide-on-which-database-to-use-in-your-next-fullstack-application-7po),
  [Choosing Postgres, MySQL, SQLite, MongoDB](https://domainindia.com/support/kb/choosing-postgres-mysql-sqlite-mongodb).
- [DB-Engines: comparación de SQL Server, MongoDB, PostgreSQL y SQLite](https://db-engines.com/en/system/Microsoft+SQL+Server%3BMongoDB%3BPostgreSQL%3BSQLite%3BStardog).
- Experiencia directa del proyecto restaurante-san-andres (L-013, L-030): SQLite con un solo escritor.
