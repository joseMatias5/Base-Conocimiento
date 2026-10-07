# Commit 15 — Calidad de las pruebas: ejecución rápida, cobertura, CI, e2e, accesibilidad, propiedades, mutación y contrato

`chore(pruebas): separar tests rápidos, medir cobertura, CI, e2e con Playwright, propiedades, mutación y contrato de pantallas`

**Rama:** `chore/calidad-pruebas` (creada a partir de `fix/revision-pr1` para no modificar el PR que está en revisión).
**Archivos principales:** `package.json` (scripts y herramientas de desarrollo), `vitest.config.ts`, `stryker.config.json`,
`playwright.config.ts`, `e2e/**`, `.github/workflows/ci.yml`, `src/__tests__/money-propiedades.test.ts`,
`src/__tests__/contratos-pantallas.test.ts`, `docs/pruebas.md`.
**No se tocó:** código de producción ni frontend (páginas, componentes, hooks).

Origen: el contraste entre `TESTING.md` y las pruebas del proyecto (`D:\BaseConocimiento\06-pruebas\02-...`) mostró lo que
faltaba: cobertura sin medir, sin e2e, sin accesibilidad automática, sin CI y una suite completa lenta para el ciclo diario.

---

## Qué se agregó

| # | Mejora | Cómo se usa | Resultado medido |
|---|---|---|---|
| 1 | Suite partida | `npm run test:rapido` / `test:integracion` / `npm test` | `test:rapido`: **782 tests en 24 s** (la suite completa son 799 y tarda ~68 s) |
| 2 | Cobertura con umbral | `npm run test:cobertura` | **Líneas 95,2 %, ramas 93,4 %, funciones 98 %** (medido antes de los tests nuevos). Umbral: líneas/sentencias 92, ramas 90, funciones 95 |
| 3 | CI (GitHub Actions) | `.github/workflows/ci.yml` | **No se ejecutó en GitHub.** Validado: sintaxis YAML y `npm ci --dry-run` |
| 4 | E2E (Playwright) | `npm run build` y luego `npm run test:e2e` | **18 pruebas pasan** (9 por viewport: escritorio 1280×800 y móvil Pixel 7) |
| 5 | Accesibilidad (axe, WCAG A/AA) | dentro de `test:e2e` | Encontró violaciones reales del frontend (ver AT-36) |
| 6 | Propiedades (`fast-check`) | `npm test` | 14 tests sobre dinero y estados; al romper `money.ts` a propósito una propiedad falló con contraejemplo |
| 7 | Mutation testing (Stryker) | `npm run test:mutacion` **Línea base: 84,3 % de mutantes eliminados** (381 de 452; 58 sobrevivieron, 13 sin cobertura; 10 min 33 s). Por archivo: `money` 100, `pedidos` 100, `costos` 100, `mesas` 100, `ventas` 90,2, `validacion` 86,4, `catalogo` 84,4, `stock` 81,5, **`rate-limit` 68,8** (el más débil). No se persiguió un puntaje: quedan como trabajo futuro. Con el análisis, los tests de propiedades de `money.ts` ganaron 2 casos (L-059) |
| 8 | Contrato de pantallas | `npm test` | 24 tests; al romper a propósito un campo del cobro, falló |

Total de la suite de Vitest tras el commit: ver "Verificación".

### Qué prueba el e2e (`e2e/`)
- `ingreso.spec.ts`: el mozo entra a Comandas y el administrador a Administración con su PIN **por teclado**; un PIN incorrecto
  muestra el error; el mozo no entra a Administración con su propio PIN.
- `flujo-critico.spec.ts`: sobre la app real (`next start`, SQLite temporal, sesiones firmadas) con tres roles:
  el mozo toma un pedido (manda un precio falso y se ignora: total 8.200), la cocina lo prepara (un salto de estado da 400),
  el administrador lo entrega, el mozo cobra con propina (8.210,50), un reintento del cobro devuelve la **misma venta**,
  el mozo no puede anular (403), el administrador anula, una segunda anulación da 400 y el pedido pagado no se reabre.
  También: sin sesión, la API responde 401.
- `accesibilidad.spec.ts`: axe sobre la pantalla de inicio, el modal del PIN y Comandas.
- **Límite:** el flujo de negocio se ejecuta contra la API con sesiones reales tras un ingreso real; **no recorre las
  pantallas de Comandas, Cocina ni Caja con clics** (la interfaz sigue cambiando; eso se agrega cuando se estabilice).

---

## Hallazgos

### AT-36 — Violaciones de accesibilidad en las pantallas de entrada (frontend)
**Ubicación:** UI | `src/app/page.tsx` (inicio y modal del PIN) y `src/app/comandas/page.tsx`
**Tipo:** Accesibilidad
**Descripción:** axe (WCAG 2 A/AA) detectó, en escritorio y en móvil:

| Pantalla | Regla | Elementos |
|---|---|---|
| Inicio | `button-name` (botón sin nombre accesible) | 1: el botón redondo de la esquina superior (ícono de apagar) |
| Modal del PIN | `button-name` | 3: ese mismo botón de apagar, el botón de cerrar (X, arriba a la derecha) y la tecla de borrar dígito |
| Modal del PIN | `color-contrast` (contraste insuficiente) | 1: el texto "Ingreso a Sala" (`text-white/40`) |
| Comandas (tras el ingreso del mozo) | `color-contrast` | 4: el subtítulo "Toque una mesa libre…" y los tres botones de filtro por sector |

(Elementos obtenidos con el reporte detallado de axe, escritorio; las cantidades coinciden en móvil.)

**Consecuencias:** un lector de pantalla anuncia "botón" sin decir cuál (los que solo tienen ícono); el texto de bajo
contraste es difícil de leer con luz del salón.
**Recomendación (no aplicada, es del frontend):** `aria-label` en los tres botones de solo ícono (apagar, cerrar, borrar dígito)
y subir el contraste de los textos atenuados (`text-white/40`, `var(--muted)`) sobre fondos oscuros.
**Cómo se cierra:** corregir y bajar la cantidad en `CONOCIDAS` de `e2e/accesibilidad.spec.ts` (la prueba falla también si hay
**menos** de lo anotado, para que la lista no quede desactualizada).
**Impacto:** Medio · **Esfuerzo estimado:** Bajo

### AT-37 — Vulnerabilidades en dependencias (`npm audit`)
**Ubicación:** `package-lock.json`
**Descripción:** `npm audit` informa 22 vulnerabilidades en el árbol original (9 altas, 4 críticas; con `--omit=dev`, 3 altas
en producción). Las herramientas nuevas, todas de desarrollo, sumaron 3 más (25 en total). **No se actualizó nada** para no
mezclar un cambio de dependencias con este commit.
**Recomendación:** revisar `npm audit --omit=dev` aparte, dependencia por dependencia, y probar. **Impacto:** a evaluar.

### Pendiente ya documentado y ahora verificado por un test — Inventario (frontend)
`actualizarStock()` en `src/app/admin/inventario/page.tsx` sigue editando el stock por `PUT`, que desde el commit 13 responde
400 ("usá Ajustar stock"). `contratos-pantallas.test.ts` lo deja como el caso **"PENDIENTE DEL FRONTEND"** (pasa mientras la
pantalla no cambie) y agrega el contrato nuevo: `POST /api/inventario/ajuste` con `{ insumoId, delta, motivo }`.
Al corregir la pantalla, **borrar** el caso pendiente. Sigue valiendo: *no mezclar la rama sin ese cambio del frontend*.

---

## Cambios visibles para el frontend

- **Ninguno en la API ni en las pantallas.** No se modificó código de producción.
- **Las pruebas ahora dependen de detalles de la interfaz.** Si se cambian, hay que actualizar `e2e/`:
  el título `Restaurante San Andrés` (h1), los atajos de teclado `1`/`2`/`3` y la captura de los 4 dígitos en la pantalla de
  inicio, y los textos de error `PIN incorrecto o usuario inactivo` y `Rol no autorizado para Administración`.
- **`contratos-pantallas.test.ts` replica lo que envía cada pantalla.** Si una pantalla cambia el JSON que manda o los campos
  que lee de la respuesta, actualizar el caso (el archivo del que sale cada payload está anotado en cada `describe`).
- **Accesibilidad:** las cantidades de `CONOCIDAS` fallan también al mejorar; actualizarlas al corregir (AT-36).

---

## Decisiones y por qué

- **Rama aparte:** `fix/revision-pr1` está subida y en revisión de Agustín; agregarle commits cambia lo que revisa.
- **Umbrales de cobertura por debajo de lo medido:** protegen contra retrocesos sin convertir el porcentaje en una meta (TESTING.md §9).
- **E2E por teclado y por API:** la pantalla de inicio se maneja con atajos de teclado (estable); el negocio se recorre por la API
  con las sesiones reales. Se evitó atar las pruebas a clases CSS o a la estructura de pantallas que Agustín sigue cambiando.
- **Base temporal en el e2e:** `e2e/.tmp/e2e.db` se crea y se borra en cada corrida; nunca se usa la `dev.db` (L-040).
- **Sin `shell` ni `npx` en el arranque del e2e:** se invoca `node` con los binarios locales (evita el aviso DEP0190).
- **Mutación sobre 9 módulos de `src/lib`** (dinero, estados, ventas, mesas, costos, stock, validación, catálogo, límite de
  intentos). Quedan fuera las rutas, `migraciones.ts` y `pin.ts` por costo de tiempo (tests de 45–60 s).

## Verificación

Ejecutado el 2026-10-07 sobre este commit:

| Chequeo | Resultado |
|---|---|
| `npx tsc --noEmit` | sin errores |
| `npx eslint .` | 0 errores, 11 avisos (todos del frontend, ya existentes) |
| `npm run test:cobertura` (suite completa) | **23 archivos, 837 tests verdes**; cobertura líneas 95,23 %, ramas 93,56 %, funciones 98,02 %; umbrales cumplidos |
| `npm test` (segunda pasada seguida) | 23 archivos, 837 tests verdes (28,8 s) |
| `npm run build` | verde |
| `npm run test:e2e` | **18 pruebas verdes** (escritorio y móvil) |
| `npm run test:mutacion` | 84,3 % (línea base, arriba) |

Los tiempos varían con la carga del equipo: la suite completa tardó entre 29 y 68 s en distintas corridas. Al agregar
los tests de propiedades y de contrato (+38) la suite pasó de 799 a 837. Para comprobar que los tests nuevos detectan errores
se rompió a propósito `money.ts` (una propiedad falló con contraejemplo) y un campo del cobro (falló el contrato); ambos
archivos se restauraron con `git checkout`.

## Pendientes y límites

- El CI **no se ejecutó en GitHub**: la primera ejecución puede mostrar diferencias de entorno (Linux, versiones).
- El e2e no recorre las pantallas de Comandas/Cocina/Caja con clics.
- `api-cliente.ts` y `formatDate.ts` (0 %), `uploads.ts` (50 %) y `hub-metrics` (64 %) siguen con poca cobertura.
- AT-36 (accesibilidad) y AT-37 (dependencias) están abiertos.
- Lecciones de este bloque: L-059, y el refuerzo de L-054 (ver `docs/lecciones-aprendidas.md`, filas 28 a 30).
