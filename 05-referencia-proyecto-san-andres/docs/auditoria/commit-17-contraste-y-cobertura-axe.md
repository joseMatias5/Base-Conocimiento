# Commit 17 — Contraste AA en toda la app (AT-36) y accesibilidad automática en Cocina y Administración

`test(accesibilidad): axe en Cocina y las 8 pantallas de Administración; registrar AT-38`

**Ramas:** `frontend/contraste` (Agus, base `chore/ajustes-finales`) y `chore/cierre-at36` (esta, encima de la anterior).
**Archivos de esta rama:** `e2e/accesibilidad.spec.ts`, `docs/**`, `HANDOFF.md`. No toca código de producción.

---

## Parte 1 — `frontend/contraste` (Agus): AT-36 cerrado

Un commit (`bfd5819`) que toca 15 archivos de frontend (`globals.css`, páginas, `AvisoError`, `ErrorDeCarga`, `AjusteStockModal`)
y la prueba de accesibilidad. Resumen de lo que reportó: `--muted` de `#6b7280` a `#9399a6`; variables nuevas `--danger-text` e
`--info-text` para el texto rojo y azul; fondos un tono más oscuros en `.btn-success`, `.btn-danger` y `.btn-info`; textos del
inicio al 60 % de blanco; filtro activo de Comandas en `indigo-300`; "Anular" de Caja en `red-400`. Además, `violaciones()` espera
a que terminen las animaciones finitas antes de medir (medía en medio del fade-in de los modales y el resultado dependía del
momento).

**Verificado por el backend sobre esa rama:** `tsc` sin errores; `eslint` 0 errores; `npm run test:cobertura` 32 archivos,
**890 tests verdes**, líneas 95,23 %; `npm run build` verde; `npm run test:e2e` **18 verdes dos veces seguidas**; se mezcla limpia con `backend`.
`CONOCIDAS` de inicio, modal del PIN y Comandas quedó vacío: **ya no hay violaciones de contraste en esas pantallas.**

## Parte 2 — Cobertura de axe ampliada (backend)

La revisión manual de Agus (Cocina y las 8 pantallas de Admin: 0 violaciones **de contraste**) no quedaba protegida por ninguna
prueba. `e2e/accesibilidad.spec.ts` ahora también cubre **Cocina** y las **8 pantallas de `/admin`** (`/admin`, `caja`, `costos`,
`historial`, `inventario`, `menu`, `proveedores`, `usuarios`), en escritorio y móvil: **36 e2e verdes dos veces seguidas**
(antes 18). Una pantalla nueva de `/admin` va en `PANTALLAS_ADMIN`.

## Hallazgo AT-38 — Otras violaciones de accesibilidad en Administración (no son de contraste)

**Ubicación:** UI | `src/app/admin/caja/page.tsx`, `src/app/admin/historial/page.tsx`, `src/app/admin/page.tsx` (móvil)
**Tipo:** Accesibilidad
**Descripción:** al ampliar axe aparecieron, medidas con el mismo método:

| Viewport | Pantalla | Regla | Elemento |
|---|---|---|---|
| escritorio y móvil | `/admin/caja` | `select-name` | el `<select>` del filtro (sin etiqueta ni `aria-label`) |
| escritorio y móvil | `/admin/historial` | `select-name` | el `<select>` con clase `input` (sin etiqueta) |
| móvil | `/admin` | `scrollable-region-focusable` | `<main class="flex-1 overflow-y-auto p-6">` |
| móvil | `/admin/historial` | `scrollable-region-focusable` | el contenedor `.overflow-x-auto` de la tabla |

**Consecuencias:** un lector de pantalla anuncia un desplegable sin decir qué filtra; con teclado no se puede desplazar una
zona con scroll que no recibe el foco.
**Recomendación (no aplicada, es del frontend):** `aria-label` (o `<label>`) en los dos `<select>`; `tabIndex={0}` y un
`aria-label` en las zonas con scroll (`<main>` y el contenedor de la tabla).
**Cómo se cierra:** corregir y borrar la entrada en `CONOCIDAS.admin` de `e2e/accesibilidad.spec.ts` (la prueba también falla
si hay **menos** de lo anotado).
**Impacto:** Bajo a Medio · **Esfuerzo estimado:** Bajo

## Cambios visibles para el frontend
- Ninguno en la API ni en las pantallas.
- Las pruebas ahora recorren Cocina y las 8 pantallas de `/admin`: si Agus agrega o renombra una, actualizar `PANTALLAS_ADMIN`.
- AT-38 queda abierto con sus cuatro entradas en `CONOCIDAS.admin`.

## Verificación
Sobre `chore/cierre-at36` (2026-10-07): `npx tsc --noEmit` sin errores; `npx eslint e2e` sin errores; `npm run test:e2e` **36 verdes
dos veces seguidas** (escritorio y móvil). La suite de Vitest no cambió (890 tests).

## Pendientes
- AT-38 (accesibilidad de Admin) y AT-37 (dependencias) abiertos; CI sin ejecutar en GitHub.
- `next start` avisa que no funciona con `output: "standalone"` (viene de `next.config.ts`); los e2e funcionan, pero conviene
  arrancarlos con `node .next/standalone/server.js` si ese aviso cambia de comportamiento en una versión nueva de Next.
