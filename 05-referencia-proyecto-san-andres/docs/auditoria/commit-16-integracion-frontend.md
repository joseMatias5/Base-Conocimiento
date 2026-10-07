# Commit 16 — Cierre de la integración con el frontend: lint de `release/`, un solo `formatPesos` y contrato de Inventario

`chore(integracion): ignorar release/ en ESLint, un solo formateador de pesos y contrato de Inventario sin el caso pendiente`

**Rama:** `chore/ajustes-finales` (encima de `frontend/ajustes-api` de Agus).
**Archivos principales:** `eslint.config.mjs`, `src/lib/ventas.ts`, `src/app/api/checkout/pay/route.ts`,
`src/app/api/ventas/[id]/anular/route.ts`, `src/__tests__/contratos-pantallas.test.ts`, `src/__tests__/escritura.test.ts`,
`src/__tests__/checkout-pay.test.ts`, `CLAUDE.md`, `HANDOFF.md`.

Origen: el reporte de Agus al subir `frontend/ajustes-api` y sus tres preguntas. Antes de decidir se verificó su rama:
`tsc` sin errores, `eslint` 0 errores, `npm test` 889 verdes, umbrales de cobertura cumplidos, `npm run build` y 18 e2e.
Solo toca páginas, layouts, `src/components`, `src/hooks`, `src/utils` y una línea de `e2e/accesibilidad.spec.ts`.

---

## Decisiones (respuestas a las preguntas de Agus)

1. **ESLint y `release/`:** `desktop-build/` ya estaba ignorado; faltaba `release/` (salida de electron-builder, ya en
   `.gitignore`). Se agregó `release/**` a los ignorados de `eslint.config.mjs`.
2. **Un solo formateador de pesos:** el canónico es `formatPesos` de `src/utils/dinero.ts` (probado, con es-AR y centavos solo
   si los hay). Se **eliminó** `formatoPesos` de `src/lib/ventas.ts`; las dos rutas que lo usaban (cobro y anulación) importan
   `formatPesos`. `src/utils/` pasa a la zona de frontend en `CLAUDE.md`, con la nota de que son funciones puras que el backend
   puede importar pero no cambiar sin avisar.
3. **Orden de mezcla:** las ramas están apiladas, cada una contiene a la anterior. Mezclar hacia `backend` en este orden
   —`fix/revision-pr1`, `chore/calidad-pruebas`, `frontend/ajustes-api`, `chore/ajustes-finales`— con **"Create a merge
   commit"** (con squash o rebase, las siguientes mostrarían commits duplicados y conflictos), y las cuatro en la misma sesión:
   entre la primera y la tercera la pantalla de Inventario recibiría 400.
4. **`e2e/`:** Agus puede editar los valores de `CONOCIDAS` de `e2e/accesibilidad.spec.ts` al corregir accesibilidad (así
   lo hizo); el resto de `e2e/` sigue siendo del backend.

## Cambios en pruebas
- `contratos-pantallas.test.ts`: se quitó el caso "PENDIENTE DEL FRONTEND" (la pantalla ya usa el ajuste). Queda el rechazo
  del `PUT` con otro stock, el contrato `POST /api/inventario/ajuste` (suma y resta) y dos rechazos nuevos (delta 0 y motivo
  corto, sin tocar el stock). 25 tests.
- `checkout-pay.test.ts`: nuevo caso que fija el texto del historial (`Cobro registrado por $3.900,50 — EFECTIVO`).
- `escritura.test.ts`: se quitó el test de `formatoPesos` (la función ya no existe; la cubre `src/utils/dinero.test.ts`).

## Cambios visibles para el frontend
- **Texto de `HistorialPedido.detalle`** de cobros y anulaciones **nuevos**: ahora `$3.900,50` (antes `$3.900,5`, con el `$`
  puesto por la ruta). Los registros viejos no se modifican. Si una pantalla del historial compara o recorta ese texto, revisar.
- Nada más cambia en la API.

## Verificación
Ejecutado el 2026-10-07 sobre este commit (incluye el trabajo de Agus): `npx tsc --noEmit` sin errores; `npx eslint .` 0 errores
(11 avisos del frontend, ya existentes); `npm run test:cobertura` **32 archivos, 890 tests verdes**, líneas 95,23 % y ramas
93,56 %, umbrales cumplidos; `npm run build` verde; `npm run test:e2e` **18 verdes** (escritorio y móvil).

## Pendientes
- AT-36 (resto): contraste de color en el modal del PIN (1 elemento) y en Comandas (4); los `button-name` ya los corrigió Agus.
- AT-37 (dependencias) y el CI sin ejecutar en GitHub siguen abiertos.
