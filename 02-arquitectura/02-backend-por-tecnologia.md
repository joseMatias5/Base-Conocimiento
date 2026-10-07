# Arquitectura de backend por tecnología

> Las reglas de `CLAUDE-arquitectura-base.md` (capas, SOLID, GRASP, GoF, puertos y adaptadores) valen para todos los
> lenguajes. Este documento traduce esas reglas a la estructura concreta, las librerías y los errores típicos de cada
> stack. Elegir el stack con los criterios de §1; después aplicar la receta de su sección.

## 1. Cómo elegir el stack

| Criterio | Inclinarse por |
|---|---|
| El equipo ya domina un lenguaje | Ese lenguaje (el costo de aprender pesa más que la diferencia técnica) |
| Mismo lenguaje en frontend y backend, equipo chico, prototipo rápido | **TypeScript** (Node/Next.js/NestJS) |
| Empresa Microsoft, Windows Server, SQL Server, Active Directory | **C# / ASP.NET Core** |
| Ecosistema corporativo grande, sistemas bancarios, equipos numerosos | **Java/Kotlin + Spring Boot** o **C#** |
| Datos, ciencia, IA, scripts + API | **Python (FastAPI / Django)** |
| Servicios de alto rendimiento, binarios simples, concurrencia intensa | **Go** |
| App de escritorio local con web embebida | **Electron / Tauri** + SQLite |
| Panel de administración sobre una base existente | **Django** (admin integrado) o **Laravel** |

Y siempre: **monolito modular primero**. Microservicios solo cuando hay equipos independientes, escalado distinto por
componente o aislamiento de fallos que justifique el costo de red, despliegue y consistencia distribuida.

## 2. Estructura común (válida en cualquier lenguaje)

```
modulos/<feature>/
  dominio/         entidades, objetos de valor, reglas, errores, eventos      (sin dependencias externas)
  aplicacion/      casos de uso, puertos (interfaces), DTOs                   (orquesta; abre la transacción)
  infraestructura/ repositorios concretos, ORM, clientes externos, mapeadores (implementa los puertos)
  presentacion/    controladores / rutas / validación de formato              (cero lógica de negocio)
compartido/        solo lo usado por 3+ módulos
composicion/       único lugar donde se conectan puertos con implementaciones (Composition Root)
```

Regla de dependencia: **Presentación → Aplicación → Dominio ← Infraestructura**.

### Cuándo NO hace falta toda la estructura
Un CRUD simple sin reglas (tabla de rubros) puede ir directo: ruta → validación → repositorio. Aplicar las capas completas
donde hay reglas de negocio (cobros, stock, estados). Aplicarlas en todos lados es sobre-ingeniería (YAGNI).

---

## 3. C# / ASP.NET Core

**Stack:** .NET 8 (LTS) o superior · ASP.NET Core Web API (controladores o Minimal APIs) · EF Core (escrituras) + Dapper
(consultas de lectura pesadas) · FluentValidation · MediatR (opcional) · Serilog · xUnit + FluentAssertions + Testcontainers.

**Solución:**
```
src/
  MiApp.Domain/          entidades, VO, errores, interfaces de dominio (sin referencias a EF ni ASP.NET)
  MiApp.Application/     casos de uso (handlers), puertos (IRepositorio...), DTOs, validadores, IUnitOfWork
  MiApp.Infrastructure/  DbContext, configuraciones EF, repositorios, migraciones, clientes externos
  MiApp.Api/             Program.cs (composición), controladores/endpoints, filtros, autenticación
tests/ MiApp.Domain.Tests · MiApp.Application.Tests · MiApp.Integration.Tests
```
Referencias: Api → Application, Infrastructure · Infrastructure → Application → Domain. Domain no referencia nada.

**Reglas específicas:**
- `DbContext` ya es Unit of Work: `SaveChangesAsync()` es una transacción. Para operaciones de varios `SaveChanges` o con
  `ExecuteUpdate`, usar `IUnitOfWork.ExecuteInTransactionAsync` definido en Application. La transacción pertenece al caso de uso, no al repositorio.
- Con estrategia de reintentos (`EnableRetryOnFailure`) hay que envolver la transacción manual en `CreateExecutionStrategy().ExecuteAsync(...)`.
- **Concurrencia optimista:** `[Timestamp] byte[] RowVersion` → capturar `DbUpdateConcurrencyException` → `409`.
- **Escritura condicional atómica:** `ExecuteUpdateAsync(s => s.SetProperty(...)).Where(p => p.Id == id && p.Estado == X)` y revisar el conteo.
- **Baja lógica:** `modelBuilder.Entity<T>().HasQueryFilter(e => !e.Eliminado)`; `IgnoreQueryFilters()` solo en casos explícitos.
- **Auditoría:** `SaveChangesInterceptor` que rellena `CreadoEn/ActualizadoEn/Por`.
- **Lectura:** `AsNoTracking()` en consultas de solo lectura; proyectar a DTO con `Select`, no devolver entidades.
- **Dinero:** `decimal` con `HasPrecision(18,2)` o `long` en centavos; nunca `double`.
- **Errores:** `ProblemDetails` (RFC 9457) con un `IExceptionHandler` global; los errores de negocio como `Result<T>` o excepciones de dominio tipadas.
- **Autenticación:** ASP.NET Core Identity o JWT validado; políticas de autorización (`[Authorize(Policy=...)]`) en lugar de roles sueltos.
- **Async:** `async/await` hasta el final; sin `.Result`/`.Wait()`; pasar `CancellationToken`.
- **Migraciones:** `dotnet ef migrations add`; en producción aplicar con un script (`migrations script --idempotent`) o un paso de despliegue.
- **Pruebas de integración:** `WebApplicationFactory` + Testcontainers con el **mismo motor** que producción (no usar el proveedor InMemory para probar transacciones o restricciones: no las aplica).

**Errores típicos:** `DbContext` registrado como singleton; devolver entidades EF desde la API (ciclos, sobre-exposición);
lógica en controladores; `InMemory` para probar concurrencia.

---

## 4. JavaScript / TypeScript (Node.js)

**Dos estilos válidos:**
- **NestJS** (modular, DI nativa): ideal cuando se quiere estructura formal de módulos, controladores, proveedores. Encaja
  bien con arquitectura hexagonal porque los *providers* se inyectan por interfaz/token.
- **Next.js (App Router) / Express / Fastify con módulos propios:** más liviano; la arquitectura la impone el equipo
  (como en el proyecto de referencia `05-referencia-proyecto-san-andres/`).

**Stack:** TypeScript estricto (`strict: true`) · Prisma o Drizzle (Postgres/SQLite) · zod (validación) · Vitest o Jest ·
Pino (logs) · Playwright (e2e).

**Estructura (NestJS):**
```
src/modules/<feature>/
  domain/  application/  infrastructure/  presentation/ (controllers, dto)
  <feature>.module.ts      ← conecta puertos con implementaciones
src/shared/  src/config/
```
**Estructura (Next.js, estilo del proyecto de referencia):**
```
src/app/api/**/route.ts   solo handlers (validar → llamar lógica → responder); sin constantes ni lógica exportada
src/lib/                  lógica de negocio, transacciones, dinero, auth, validación (testeable sin framework)
prisma/ migraciones, seeds   src/__tests__/ pruebas
```

**Reglas específicas:**
- `route.ts`/`page.tsx` exportan **solo** lo que el framework espera; lo compartido va en `src/lib/` (L-056).
- **Validar con zod en el borde** y convertir unidades (pesos → centavos) ahí mismo.
- **Prisma:** `$transaction` interactivo dentro de un helper único (`transaccion()`); con SQLite, escrituras en fila (L-013);
  `updateMany` condicional para reclamar estados; `P2002` → `409`.
- **Errores async:** todo `await` dentro de `try/catch` o un wrapper de rutas; promesas sin manejar tumban el proceso.
- **Tipos:** sin `any`; tipos de entrada derivados del esquema zod (`z.infer`), una sola fuente.
- **Números:** sin `Float` para dinero (L-001); cuidado con `Number.MAX_SAFE_INTEGER`.
- **Sesión/seguridad:** cookie `httpOnly` + `SameSite` + firma; revalidar usuario en cada petición (L-020/L-021).
- **Eventos en tiempo real (SSE/WebSocket):** emitir solo tras el `COMMIT` y con el mismo formato que la API.
- **Entorno:** variables validadas al arrancar (zod sobre `process.env`), falla cerrado en producción (L-023).
- **Node 24 LTS** o la LTS vigente; fijar versión en `.nvmrc`/`engines`.

**Errores típicos:** exportar constantes desde `route.ts`; `prisma.$transaction` directo en cada ruta; confiar en el
frontend para validar; `JSON.parse` sin `try`; mocks que no imitan al ORM (L-041).

---

## 5. Python

**FastAPI** (APIs modernas, tipado, async) o **Django** (todo incluido: ORM, admin, auth, migraciones).

**Stack FastAPI:** Pydantic v2 · SQLAlchemy 2.x (async) + Alembic · pytest + httpx · Ruff + mypy/pyright · uvicorn.

```
app/
  dominio/  aplicacion/  infraestructura/  presentacion/(routers, schemas)
  main.py (composición, inyección con Depends)
tests/ unit/ integration/
```
**Reglas específicas:**
- Un `Session` por petición (dependencia con `yield`); `with session.begin():` para la transacción del caso de uso.
- `version_id_col` para concurrencia optimista; `with_for_update()` para bloqueo pesimista.
- Pydantic en el borde; no pasar modelos ORM a la API (esquemas de salida separados).
- Dinero: `Decimal` (nunca `float`), `NUMERIC` en la base.
- Tipado estático obligatorio (`mypy --strict` o pyright) y `ruff` en CI.
- **Django:** lógica de negocio en una capa de servicios/dominio, no en vistas ni en `save()`; `transaction.atomic()`;
  `select_for_update()`; `F()` para actualizaciones atómicas (`stock=F('stock')-1`); evitar señales para lógica crítica.

**Errores típicos:** sesión compartida entre peticiones; `float` para dinero; lógica en los *serializers*; N+1 por no usar `select_related/prefetch_related`.

---

## 6. Java / Kotlin (Spring Boot)

**Stack:** Spring Boot 3 · Spring Data JPA/Hibernate (o jOOQ) · Flyway/Liquibase · Bean Validation · JUnit 5 + Testcontainers · MapStruct.

```
com.empresa.app.<feature>/
  domain/  application/(usecase, port)  infrastructure/(persistence, web)  
```
**Reglas específicas:**
- `@Transactional` en los **servicios de aplicación** (casos de uso), no en repositorios ni controladores; entender
  que se ignora en llamadas internas (`this.metodo()`) por el proxy.
- `@Version` para concurrencia optimista; `@Lock(PESSIMISTIC_WRITE)` para bloqueos.
- No devolver entidades JPA a la API (DTO/record + MapStruct); cuidado con `LazyInitializationException` y N+1 (`@EntityGraph`, `join fetch`).
- `open-in-view=false`.
- Migraciones con Flyway versionadas; `ddl-auto=validate` (nunca `update` en producción).
- ArchUnit para **verificar automáticamente** que el dominio no depende de infraestructura.

---

## 7. Go

**Stack:** `net/http` + `chi` (o Gin/Echo) · `pgx` + `sqlc` (SQL tipado) o GORM · `goose`/`golang-migrate` · `testing` + testify + testcontainers-go.

```
cmd/api/main.go          composición
internal/<feature>/      dominio, servicio (caso de uso), repositorio (interfaz definida donde se USA), http
```
**Reglas específicas:**
- Interfaces **pequeñas y definidas por el consumidor** (principio de Go), no por el implementador.
- `context.Context` como primer parámetro, con tiempos límite; transacciones con `defer tx.Rollback()` + `tx.Commit()`.
- Errores como valores: `fmt.Errorf("...: %w", err)` y `errors.Is/As`; nunca ignorar un `err`.
- Concurrencia: goroutines con `errgroup`, sin fugas (siempre hay forma de terminarlas); `-race` en las pruebas.

---

## 8. Matriz de equivalencias (qué usar para cada necesidad)

| Necesidad | TypeScript | C# | Python | Java | Go |
|---|---|---|---|---|---|
| Servidor web | Next.js / NestJS / Fastify | ASP.NET Core | FastAPI / Django | Spring Boot | chi / net/http |
| ORM / acceso a datos | Prisma / Drizzle | EF Core / Dapper | SQLAlchemy / Django ORM | JPA / jOOQ | sqlc / pgx |
| Validación | zod | FluentValidation | Pydantic | Bean Validation | go-playground/validator |
| Migraciones | Prisma Migrate | EF migrations | Alembic | Flyway | goose |
| DI | NestJS / manual | `IServiceCollection` nativo | `Depends` / manual | Spring | manual (constructores) |
| Pruebas | Vitest / Jest | xUnit | pytest | JUnit 5 | testing |
| Pruebas con BD real | Testcontainers | Testcontainers | testcontainers-python | Testcontainers | testcontainers-go |
| Logging estructurado | Pino | Serilog | structlog | Logback + JSON | slog |
| Análisis estático | ESLint + `tsc` | analizadores Roslyn | Ruff + mypy | SpotBugs + ArchUnit | `go vet` + staticcheck |

## 9. Verificación automática de la arquitectura (no confiar en la disciplina)

Las reglas que no se verifican se erosionan. Agregar al CI:
- **TypeScript:** `eslint-plugin-boundaries` o `dependency-cruiser` (el dominio no importa de infraestructura; sin ciclos).
- **C#:** `NetArchTest` o `ArchUnitNET`.
- **Java:** `ArchUnit`.
- **Python:** `import-linter`.
- **Go:** `go-arch-lint` / revisión de imports.

## Fuentes consultadas
- [Where Do Transactions Belong in Clean Architecture? (ASP.NET Core)](https://milanjovanovic.tech/blog/transactions-clean-architecture)
- [Unit of Work con EF Core](https://milanjovanovic.tech/blog/unit-of-work-pattern-ef-core)
- [Arquitectura hexagonal con NestJS y TypeScript](https://kisztof.medium.com/hexagonal-architecture-with-nest-js-and-typescript-f181cc7b6452)
- Convenciones del proyecto de referencia (Next.js + Prisma + SQLite): `05-referencia-proyecto-san-andres/`.

---

> **Validado en laboratorio (2026-10-07):** estructura en capas de C# / .NET 8 (`Dominio` → `Aplicacion` con puertos → `Infraestructura` con Npgsql → `Api` mínima)
> con xUnit: reglas de dinero y estados en el dominio, cobro atómico con idempotencia y outbox contra PostgreSQL real, y API con `WebApplicationFactory`.
> Código: `08-laboratorios/lab2-csharp-cobros/`. Lecciones L-063, L-064, L-065. **Pendiente de validar:** Python, Java y Go.
