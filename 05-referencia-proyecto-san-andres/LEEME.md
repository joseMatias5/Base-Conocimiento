# Referencia: restaurante-san-andres

Copia de solo lectura (tomada el 2026-10-07; código de `fix/revision-pr1` en `b282e3c` y pruebas de `chore/calidad-pruebas` en `af22d6d`) de lo que sirve como ejemplo.
**No es código para pegar tal cual:** es el ejemplo verificado de cada patrón. Adaptar nombres y stack.

Stack del proyecto: Next.js (App Router, versión con cambios incompatibles: leer `node_modules/next/dist/docs/`) +
Prisma + SQLite + Electron + Vitest.

| Archivo (`codigo/`) | Patrón que ilustra | Lecciones |
|---|---|---|
| `transaccion.ts` | Cola de escrituras en proceso + `transaccion()` para un motor de un solo escritor | L-013 |
| `money.ts` | Dinero en centavos: `aCentavos`, `enPesos`, rango máximo `dentroDeRango` | L-001 |
| `pedidos.ts` | Máquina de estados explícita (`TRANSICIONES`) | L-012 |
| `migraciones.ts` + `migraciones.test.ts` | Migraciones automáticas, transaccionales, idempotentes, con test contra SQLite real | L-030 |
| `auth.ts`, `session.ts` | `requireAuth(roles)`, sesión firmada, usuario activo y rol desde la base | L-020, L-021, L-024 |
| `rate-limit.ts` | Límite de intentos con bloqueo escalonado | L-022 |
| `validacion.ts`, `api-error.ts` | Validación en el borde y forma única de error | L-031 |
| `api-guards.test.ts` | Matriz de permisos de toda la API | L-025 |
| `integracion-sqlite.test.ts` | N operaciones en paralelo contra el motor real | L-013, L-041 |
| `schema.prisma` | Modelo del dominio (pedidos, ventas, stock, recetas, movimientos) | L-001, L-004 |

`docs/auditoria/` contiene los 15 documentos de cambio (plantilla de hallazgo + "Cambios visibles para el frontend")
y `docs/lecciones-aprendidas.md` las lecciones concretas del proyecto.
`CLAUDE-proyecto-san-andres.md` es el CLAUDE.md del proyecto (ejemplo de convenciones concretas).

Limitaciones a tener presentes: SQLite con un solo proceso escritor; la matriz de permisos está escrita para ese proyecto.

## Pruebas (`codigo/pruebas/`, commit `af22d6d`)

| Archivo | Para qué sirve como ejemplo |
|---|---|
| `e2e/arrancar-servidor.mjs`, `playwright.config.ts` | App real en producción con base temporal y dos viewports (escritorio y móvil) |
| `e2e/ayudas.ts`, `ingreso.spec.ts`, `flujo-critico.spec.ts`, `accesibilidad.spec.ts` | Ingreso por teclado; flujo con tres roles y reintento idempotente; axe con violaciones conocidas por cantidad |
| `money-propiedades.test.ts` | Pruebas de propiedades con `fast-check` + bordes exactos hallados por mutación |
| `contratos-pantallas.test.ts` | Contrato: payload exacto de cada pantalla y reenvío del `GET`; caso "PENDIENTE DEL FRONTEND" |
| `fakeDb.ts` | Fake de la base en memoria (un escritor, rollback), con su limitación declarada |
| `stryker.config.json`, `vitest.config.ts` | Mutation testing por módulos y cobertura con umbral que no deja retroceder |
| `ci.yml` | CI: tipos, lint, cobertura, build; e2e aparte; mutación semanal (sin ejecutar aún en GitHub) |
