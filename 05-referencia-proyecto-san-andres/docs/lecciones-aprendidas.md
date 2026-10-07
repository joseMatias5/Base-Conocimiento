# Lecciones aprendidas — Restaurante San Andrés POS

Casos concretos de este proyecto en los que algo salió mal y hubo que corregirlo "a mano". Cada uno remite a la regla
general (L-xxx) de la base de conocimiento global (`~/.claude/conocimiento/LECCIONES-APRENDIDAS.md`) y al cambio donde
se resolvió. Sirve para no repetir los errores y para que el procedimiento mejore en cada proyecto.

Al cerrar un bloque de trabajo: si hubo una corrección a mano, agregar una fila acá y la regla generalizada en la base global.

| # | Qué salió mal | Corrección | Regla | Dónde |
|---|---------------|------------|-------|-------|
| 1 | Montos en `Float`: diferencias de centavos; se parcheó con `roundMoney` y después hubo que migrar la base entera. | Centavos enteros en la base; la API sigue en pesos (`src/lib/money.ts`). | L-001 | commit 9, AT-13 |
| 2 | El navegador definía precios y totales. | Precio siempre desde `Producto.precio`; total recalculado desde los ítems. | L-002 | commit 2, AT-04 |
| 3 | "Hoy" en Caja sumaba las ventas de ayer. | Período desde las 00:00 de hoy (`days - 1`). | L-003 | commit 7, AT-19 |
| 4 | Un pedido cobrado se podía reabrir y volver a cobrar. | Estados finales; corrección por anulación con asiento inverso. | L-004, L-012 | commit 4, AT-18 |
| 5 | Stock imposible de reintegrar: nunca se registró qué se descontó. | `MovimientoStock` por venta; la anulación revierte esos movimientos. | L-004 | commit 10, AT-12 |
| 6 | Dos cobros simultáneos registraban dos ventas. | Escritura condicional al inicio de la transacción. | L-010 | commit 1, AT-05 |
| 7 | Sesión en JSON plano, editable desde el navegador. | Sesión firmada HMAC, `httpOnly`. | L-020 | commit 3, AT-01 |
| 8 | Usuario desactivado seguía operando 12 h; SSE abierto tras vencer la sesión. | `sesionVigente()` consulta la base; el heartbeat revalida. | L-021 | commit 11, AT-24/25 |
| 9 | El límite de PIN se evadía inventando `X-Forwarded-For`. | Se ignora salvo `TRUST_PROXY=1`; bloqueo escalonado. | L-022 | commit 11, AT-21 |
| 10 | Secreto de desarrollo fijo y publicado en el código. | Aleatorio por proceso. | L-023 | commit 11, AT-26 |
| 11 | CSRF posible desde otro puerto de la misma IP. | Verificación de `Origin` / `Sec-Fetch-Site`. | L-024 | commit 11, AT-27 |
| 12 | La app instalada nunca recibía cambios de esquema. | Migraciones automáticas al arrancar (`src/lib/migraciones.ts`). | L-030 | commit 9, AT-20 |
| 13 | La validación nueva rechazó el emoji por defecto del formulario de Menú. | Se acepta; test con el payload exacto del formulario. | L-031 | commit 6 (corrección) |
| 14 | `prisma/seed.ts` usaba campos inexistentes en `Venta`. | Campos corregidos. | L-032 | commit 9 |
| 15 | Tests de proxy, SSE y subidas consultaban la `dev.db` real. | Prisma simulado en esos tests. | L-040 | commit 11 |
| 16 | La base simulada ignoraba `select` dentro de `include`. | Mock corregido. | L-041 | commit 10 |
| 17 | Tests de PIN intermitentes al correr con los de migración. | `testTimeout` de 20 s. | L-042 | commit 9 |
| 18 | El evento SSE del cobro llevaba el total sin recalcular. | Se emite el subtotal recalculado. Lo encontró un test nuevo. | L-043 | merge `a531548` |
| 19 | La documentación afirmaba que el servidor no arranca si falla la migración, sin haberlo probado; al probarlo apareció un error al serializar `BigInt`. | Probado con una base que fuerza el fallo; mensaje corregido. | L-050 | commit 9 |
| 20 | La rama `frontend` cambió archivos del backend en paralelo; 7 commits estaban sin subir. | Unión simulada con `git merge-tree` y resuelta sobre la versión auditada; división por carpetas. | L-051 | merge `a531548` |
| 21 | `prisma format` reformateó todo el esquema dentro de un cambio funcional. | Revertido; solo los cambios necesarios. | L-053 | commit 9 |
| 22 | Scripts con heredoc rotos por escapes; nombres con tilde rotos en consola. | Scripts a archivo; búsquedas sin tildes. | L-054 | sesión 2026-10-06 |
| 23 | 5 cobros simultáneos daban `[500, 500, 500, 200, 500]` en SQLite real; la base simulada no podía mostrarlo. | Transacciones de escritura en fila (`src/lib/transaccion.ts`) + `integracion-sqlite.test.ts`. | L-013, L-041 | commit 14, AT-35 |
| 24 | El test de integración daba 401 en todo: `vi.resetModules()` dejó dos instancias del helper de sesión y del secreto. | Importar el helper después de recargar los módulos. | L-044 | commit 14 |
| 25 | Casi se exportaron constantes desde archivos `route.ts` (no permitido por Next); se detectó antes de compilar. | Constantes a `src/lib/` (`pedidos.ts`, `transaccion.ts`). | L-056 | commits 11 y 13 |
| 26 | Reemplazos por script que no coincidían con el código real (import distinto, texto repetido) y se aplicaban a medias. | Releer el fragmento y editar a mano; scripts que abortan ante cualquier diferencia. | L-057 | sesión 2026-10-06 |
| 27 | El evento de cancelación anunciaba la mesa con el estado leído antes de liberarla. | Emitir la mesa ya actualizada y solo si cambió. | L-043 | commit 13, AT-32 |
| 28 | Las pruebas basadas en propiedades de `money.ts` pasaban a la primera, pero Stryker mostró dos mutantes vivos: el valor exacto del límite (`<=` vs `<`) y la comprobación de tipo de `enPesos`. | Casos explícitos de borde y de valores no numéricos; `money.ts` pasó a 100 % de mutantes eliminados. | L-059 | commit 15 |
| 29 | Escribí en un test que el precio de las Papas Fritas era $32; el seed usa pesos (`aCentavos(3200)` = $3.200). | Releer el seed y corregir los valores esperados antes de dar el test por bueno. | L-050 | commit 15 |
| 30 | Un heredoc de bash se comió una barra invertida de una expresión regular (la barra invertida del patrón desapareció y el script no compilaba) y un escape octal (barra invertida + 01) en una cadena de Python se volvió un carácter de control dentro de un archivo de memoria. | Archivos con la herramienta de escritura de archivos; sin regex con barras (`replaceAll` con dos barras en el código fuente); cadenas de Python crudas. | L-054 | commit 15 |


## Reemplazos masivos con script (cierre de calidad, 2026-10-06)
- **Error:** un script que envolvía `prisma.X.create(...)` en `escritura(() => ...)` dejó `await` dentro de una lambda no async, y los reemplazos con `\n` no coincidían porque los archivos son CRLF.
- **Regla:** tras un cambio automático, correr el compilador antes de seguir; en regex sobre archivos del repo usar `\r?\n`; sacar los `await` de la lambda antes de envolverla.
- **Cómo verificarlo:** `npm test` + `npm run build` (el build detectó además `readonly string[]` incompatible con `notIn`).
