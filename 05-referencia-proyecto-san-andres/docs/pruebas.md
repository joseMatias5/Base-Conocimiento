# Guía de pruebas del proyecto

Cómo correr cada tipo de prueba, qué demuestra y cuándo usarla. La norma general (TDD, pirámide, dobles, antipatrones)
está en `D:\BaseConocimiento\06-pruebas\01-TESTING-guia-tdd.md`; el contraste con este proyecto, en `02-pruebas-del-proyecto-y-brechas.md`.

## Comandos

| Comando | Qué corre | Cuándo | Duración aprox. |
|---|---|---|---|
| `npm run test:rapido` | Todos los tests **menos** los de motor real (integración SQLite y migraciones) | Mientras se desarrolla | 20–30 s |
| `npm run test:integracion` | Solo los de motor real: concurrencia (`integracion-sqlite`) y migraciones | Al tocar transacciones, estados o el esquema | ~65 s (dominada por migraciones e integración) |
| `npm test` | La suite completa | **Al cerrar un bloque de trabajo** (dos veces seguidas, L-042) | 30–70 s según la carga del equipo |
| `npm run test:cobertura` | La suite completa + cobertura con umbrales | Al cerrar un bloque y en CI | 35–80 s |
| `npm run test:e2e` | Pruebas de punta a punta con Playwright (escritorio y móvil) | Al cambiar rutas, login o pantallas de entrada. **Antes: `npm run build`** | ~1 min |
| `npm run test:mutacion` | Mutation testing (Stryker) sobre `src/lib` | De vez en cuando y semanal en CI; no en cada cambio | ~10 min (452 mutantes) |
| `npm run test:watch` | Vitest en modo observación | Desarrollo | — |

Antes de dar un bloque por terminado (CLAUDE.md): `npm test`, `npm run build`, `npx eslint .` y `npx tsc --noEmit`.

## Qué hay y qué demuestra

| Archivo / carpeta | Tipo | Demuestra |
|---|---|---|
| `src/__tests__/*.test.ts` (rutas) | Integración ligera con base simulada (`helpers/fakeDb.ts`) | Permisos, validación, reglas de negocio, rollback, eventos |
| `src/__tests__/api-guards.test.ts` | Matriz de permisos | Toda ruta tiene su permiso declarado; una ruta nueva sin clasificar hace fallar el test |
| `src/__tests__/integracion-sqlite.test.ts` | Integración con **SQLite real** | N operaciones en paralelo: una gana |
| `src/__tests__/migraciones.test.ts` | Integración con **SQLite real** | Cada estado histórico de la base migra al esquema actual sin perder datos |
| `src/__tests__/money-propiedades.test.ts` | Basadas en propiedades (`fast-check`) | Dinero en centavos y máquina de estados para miles de entradas al azar + los bordes exactos |
| `src/__tests__/contratos-pantallas.test.ts` | Contrato con el frontend | La API acepta lo que cada pantalla envía (incluido el reenvío del `GET`) y devuelve lo que lee |
| `e2e/*.spec.ts` | Punta a punta (Playwright) | La app real arranca y funciona: ingreso con PIN por teclado, flujo pedido → cocina → cobro → anulación con tres roles, 401 sin sesión, accesibilidad |
| `stryker.config.json` | Mutation testing | Si los tests detectan cambios en la lógica (lista de archivos en `mutate`) |

## Cobertura

`vitest.config.ts` mide `src/lib`, las rutas de la API y `src/proxy.ts`. Medido el 2026-10-07 (837 tests):
líneas 95,23 %, ramas 93,56 %, funciones 98,02 %. Los umbrales (líneas/sentencias 92, ramas 90, funciones 95) están unos puntos por
debajo para que **no retroceda**; no son una meta. Sin cubrir hoy: `api-cliente.ts` y `formatDate.ts` (helpers del frontend),
`uploads.ts` (50 %) y `hub-metrics` (64 %).

## E2E

- `e2e/arrancar-servidor.mjs` crea una base **temporal** (`e2e/.tmp/e2e.db`, ignorada por git), le aplica el esquema y el
  seed (PIN 1111 ADMIN, 2222 COCINERO, 3333 MOZO) y levanta `next start` en el puerto 3100. Nunca toca la `dev.db`.
- Requiere un build de producción previo (`npm run build`) y Chromium (`npx playwright install chromium`, una vez).
- El ingreso se prueba por el teclado (atajos `1`, `2`, `3` y los cuatro dígitos), que es lo más estable de la pantalla.
- **Accesibilidad (`e2e/accesibilidad.spec.ts`):** axe (WCAG A/AA). Las violaciones que ya existían están anotadas con su
  cantidad en `CONOCIDAS`; la prueba falla ante una violación nueva **o** ante una cantidad distinta (más o menos). Cubre inicio, modal del PIN, Comandas, Cocina y las 8 pantallas de `/admin` (36 e2e en total entre escritorio y móvil). Una pantalla nueva de `/admin` va en `PANTALLAS_ADMIN`. Al
  corregir una, actualizar la cantidad. Detalle de lo encontrado en `docs/auditoria/commit-15-calidad-de-pruebas.md`.

## Mutation testing

Línea base (2026-10-07): **84,3 %** de mutantes eliminados; el archivo más débil es `rate-limit.ts` (68,8 %).

`npm run test:mutacion` modifica el código (`<=` por `<`, `&&` por `||`, quitar una condición…) y comprueba que algún test
falle. Un mutante que **sobrevive** es una conducta que ningún test protege. El informe HTML queda en
`reports/mutation/index.html` (ignorado por git). Cada sobreviviente se convierte en un caso de prueba nuevo (L-059).

## CI

`.github/workflows/ci.yml`: en cada PR corren tipos, lint, la suite completa con umbrales de cobertura y el build; en
trabajo aparte, los e2e (con informe adjunto si fallan). La mutación corre cada lunes o a pedido. **Aún no se ejecutó en GitHub**
(solo se validó la sintaxis del YAML y que `npm ci` sea consistente con el `package-lock.json`).

## Reglas al agregar pruebas

1. Todo test que importa rutas simula `@/lib/prisma`; nunca la `dev.db` (L-040).
2. Lo que depende del motor (concurrencia, migraciones, restricciones) se prueba contra SQLite real (L-041).
3. Cada arreglo lleva un test `REGRESIÓN:` que primero se ve fallar.
4. Si una pantalla cambia lo que envía o espera, actualizar `contratos-pantallas.test.ts` y avisar del cambio de contrato.
5. Una ruta nueva va en la matriz de `api-guards.test.ts`.
