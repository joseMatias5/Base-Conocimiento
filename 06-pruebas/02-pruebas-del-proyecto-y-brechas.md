# Cómo se aplican las pruebas: guía TESTING.md vs. lo hecho en restaurante-san-andres

> `01-TESTING-guia-tdd.md` (el TESTING.md descargado, sin modificar) es la **norma**. Este documento la contrasta con las
> pruebas reales del proyecto de referencia (medidas el 2026-10-07: `npx vitest run` → **21 archivos, 799 tests, todos
> verdes, 68 s**), resuelve las tensiones entre ambas y lista lo que **falta**. Sirve para decidir qué hacer en un
> proyecto nuevo y qué mejorar en el actual.

## 0. Actualización (2026-10-07): el plan de mejora se aplicó al proyecto

Las secciones 1 a 4 describen el **estado de partida** (799 tests, sin cobertura, e2e ni CI). Ese mismo día se aplicó el
plan de la sección 5 en la rama `chore/calidad-pruebas` del proyecto (commit `af22d6d`; documento en
`05-referencia-proyecto-san-andres/docs/auditoria/commit-15-calidad-de-pruebas.md`, guía en `docs/pruebas.md` y código de
ejemplo en `05-.../codigo/pruebas/`). Estado final: **837 tests de Vitest + 18 e2e verdes**. Resultado:

| # | Mejora | Estado | Cómo se verificó |
|---|---|---|---|
| 1 | `test:rapido` / `test:integracion` | ✅ Aplicado | `test:rapido`: 782 tests en 24 s; la suite completa tardó entre 29 y 68 s según la carga del equipo |
| 2 | Cobertura con umbral | ✅ Aplicado | Medido: líneas 95,2 %, ramas 93,4 %, funciones 98 %; umbral 92/90/95 |
| 3 | CI en GitHub Actions | ⚠️ Escrito, **no ejecutado en GitHub** | Solo se validó la sintaxis del YAML y `npm ci --dry-run` |
| 4 | E2E con Playwright, móvil y escritorio | ✅ Aplicado | 18 pruebas pasan (9 por viewport). Flujo por API con tres roles tras ingreso por interfaz; no es un recorrido completo por la UI de Comandas |
| 5 | Accesibilidad con axe | ✅ Aplicado | Encontró violaciones reales del frontend (anotadas con su cantidad; ver el documento del commit) |
| 6 | Propiedades (`fast-check`) | ✅ Aplicado | 14 tests; se rompió `money.ts` a propósito y una propiedad falló con contraejemplo |
| 7 | Mutation testing (Stryker) | ✅ Aplicado | Línea base **84,3 %** (381 de 452 mutantes; `rate-limit.ts` 68,8 % el más débil); mostró 2 huecos en los propios tests de propiedades (L-059) |
| 8 | Contrato de pantallas | ✅ Aplicado | 24 tests; se rompió un campo del cobro a propósito y falló. Dejó explícito un pendiente del frontend (Inventario) |

Lecciones de este bloque: L-059 (un test que pasa a la primera hay que romperlo) y el refuerzo de L-054.

---

## 1. Resumen de la comparación

| Exigencia de TESTING.md | En el proyecto | Estado |
|---|---|---|
| Bug corregido → prueba que lo reproduce (§3.1, §11) | Etiqueta `REGRESIÓN:` (15 tests con el nombre exacto) + L-043 | ✅ Cumple |
| Camino feliz, límites y errores (§7) | Cada ruta: permisos, validación 400, rango máximo, estados prohibidos, rollback | ✅ Cumple |
| Integración con la base real (§4, §8) | `integracion-sqlite.test.ts` (concurrencia) y `migraciones.test.ts` (SQLite real + CLI de Prisma) | ✅ Cumple en lo crítico |
| Independientes y repetibles (F.I.R.S.T.) | Base temporal por test; mock de `@/lib/prisma`; regla "correr la suite dos veces" (L-042) | ✅ Cumple |
| Dobles solo en puertos propios; preferir Fakes (§6) | `helpers/fakeDb.ts` es un **Fake** (base en memoria), no un mock con expectativas | ⚠️ Parcial (ver §2.1) |
| Pirámide ~70/20/10 (§4) | Casi todo son pruebas **de ruta** con base simulada (nivel "integración ligera"); pocas unitarias de dominio puro; **0 e2e** | ⚠️ Distinta, ver §2.2 |
| Rápidas (F.I.R.S.T. "Fast") | 799 tests en 68 s, pero 2 archivos pesan 112 s de CPU: migraciones (63 s) e integración SQLite (49 s) | ⚠️ Ver §2.3 |
| Cobertura ≥ 90 % dominio / ≥ 80 % global (§10) | **No se mide** (no hay herramienta de cobertura en `package.json`) | ❌ Falta |
| E2E de flujos críticos en móvil y escritorio (§8) | **No hay** (solo `test:sse`, un script manual de Electron) | ❌ Falta |
| Accesibilidad automática (axe) en componentes (§8) | **No hay** (el frontend es de otra persona) | ❌ Falta |
| Property-based / mutation testing (§10) | **No hay** | ❌ Falta |
| TDD estricto en dominio y casos de uso (§3.1) | Las reglas viven en `src/lib/` y se probaron por la ruta; no hay capa de dominio separada | ⚠️ Parcial |
| CI que bloquea merges en rojo (§10) | No hay CI en el repositorio (el cierre es manual: `npm test`, `build`, `eslint`) | ❌ Falta |

## 2. Tensiones entre la norma y la práctica, y cómo resolverlas

### 2.1 "Solo doblá lo que es tuyo" vs. simular `@/lib/prisma`
TESTING.md pide no doblar librerías externas: envolverlas en un Adapter y probar el adaptador con integración. El proyecto
usa Prisma directamente en las rutas (no hay repositorios) y simula `@/lib/prisma` con un **fake de base en memoria**.

**Resolución (regla para proyectos nuevos):**
- **Con arquitectura por capas (CLAUDE.md §2):** el caso de uso depende de un **puerto** propio (`PedidoRepository`); en las
  pruebas del caso de uso se usa un **Fake en memoria** del puerto. El adaptador SQL se prueba aparte con integración contra el motor real. Es lo que pide la norma.
- **Sin capa de repositorios (como el proyecto actual):** el `fakeDb` es aceptable **si** (a) es un Fake funcional y no un
  mock de expectativas, (b) declara su limitación por escrito (lo hace: "NO reemplaza una prueba contra SQLite real") y
  (c) cada flujo crítico tiene además su prueba de integración real. Esto último evita L-041 (el mock diverge del ORM).
- **Prueba de calidad del fake:** si una prueba falla por culpa del mock y no del código, el mock se corrige y se agrega
  una prueba de integración real del mismo comportamiento.

### 2.2 Pirámide: la forma real depende de la arquitectura
Con rutas finas sobre `src/lib/`, la mayor parte del valor está en probar **rutas completas** (entrada validada →
transacción → respuesta → eventos) contra la base simulada. Eso es el nivel "integración ligera" de TESTING.md §8
(Presentación/API). Recomendación:
- **Mover lógica pura a funciones sin acceso a datos** (cálculo de totales, transiciones, dinero, períodos) y probarla con
  unitarias directas y rápidas; ya hay ejemplos (`money.ts`, `TRANSICIONES`).
- Mantener las pruebas de ruta para permisos, validación, efectos y errores.
- Añadir la punta de la pirámide (e2e del camino crítico) cuando exista el frontend estable.

### 2.3 Velocidad: separar las pruebas pesadas
Las pruebas contra el motor real son lentas **por naturaleza** (la migración compara contra `prisma migrate diff`, 45 s).
No se deben acelerar quitándoles realismo; se **separan** para que el ciclo diario siga siendo rápido:
```jsonc
// package.json (propuesta, aún no aplicada al proyecto)
"test":             "vitest run",                       // todo, para el cierre de bloque
"test:rapido":      "vitest run --exclude '**/integracion-*.test.ts' --exclude '**/migraciones.test.ts'",
"test:integracion": "vitest run integracion-sqlite migraciones"
```
Regla: en desarrollo `test:rapido` (segundos) o `vitest` en modo *watch*; al **cerrar un bloque** y en CI, la suite completa.

### 2.4 Matriz de permisos (253 tests) vs. "sin lógica ni bucles en las pruebas"
`api-guards.test.ts` genera casos a partir de una **tabla** (ruta × método × rol). Es *table-driven testing*, que
TESTING.md recomienda ("parametrizar casos"): los valores esperados son literales en la tabla, no cálculos. Se mantiene.
Condición: el test de **cobertura de rutas** (falla si aparece una ruta sin clasificar) debe seguir ahí (L-025).

### 2.5 "Las pruebas nuevas deben fallar al menos una vez"
Es el control contra el "test que nunca falló". En el cierre de cada arreglo: revertir temporalmente el cambio de producción
(o comentar la línea clave) y confirmar que el test `REGRESIÓN:` se pone en rojo **por el motivo correcto**; después restaurar.
No hay evidencia documentada de que se haya hecho de forma sistemática en el proyecto; agregarlo como paso explícito del checklist.

## 3. Tipos de prueba y cuándo usar cada una en un backend con datos

| Qué se quiere demostrar | Tipo | Contra qué | Ejemplo del proyecto |
|---|---|---|---|
| Un cálculo o regla pura | Unitaria sociable | Memoria | `money.ts` (ida y vuelta de centavos), `TRANSICIONES` |
| Una ruta: permisos, validación, respuesta | Integración ligera | Fake de datos | `checkout-pay`, `catalogo`, `mesas` |
| Todas las rutas tienen permiso declarado | Prueba de matriz | Fake de datos | `api-guards.test.ts` |
| Dos peticiones a la vez: una gana | Integración | **Motor real** | `integracion-sqlite.test.ts` |
| Fallo a mitad de operación → todo se deshace | Integración (fallo inyectado) | Fake con rollback; el motor real solo en migraciones | `checkout-pay` ("reglas de negocio y rollback"), `migraciones` (paso con claves rotas → rollback). **Brecha:** no hay fallo inyectado de cobro contra SQLite real |
| Una migración conserva los datos y deja el esquema esperado | Integración | **Motor real** | `migraciones.test.ts` + fixtures `.sql` |
| Bloqueo por intentos de PIN que expira | Integración ligera con reloj controlado (`vi.useFakeTimers`) | Fake + tiempo simulado | `auth-routes`; `sse-events` (sesión que vence con la conexión abierta) |
| Eventos en tiempo real | Integración ligera | Emisor simulado | `sse-events.test.ts` (no se emite nada si hubo error) |
| Subidas de archivos (contenido, tamaño) | Integración ligera | Sistema de archivos temporal | `upload.test.ts` |
| Un flujo completo de usuario | E2E | App levantada | **No existe aún** |

## 4. Recetas de prueba para datos (genéricas, adaptables a cualquier stack)

### 4.1 Concurrencia: "N a la vez, exactamente una gana"
```ts
it('REGRESIÓN: dos cobros simultáneos del mismo pedido → una sola venta', async () => {
  const pedido = await crearPedidoAbierto();
  const resultados = await Promise.all([cobrar(pedido.id), cobrar(pedido.id), cobrar(pedido.id)]);
  const codigos = resultados.map(r => r.status).sort();
  expect(codigos).toEqual([200, 409, 409]);            // valores literales, sin cálculos
  expect(await contarVentas(pedido.id)).toBe(1);       // y el efecto en la base, no solo la respuesta
});
```
Obligatorio contra el **motor real**. Verificar también el stock/saldo final (no solo los códigos HTTP).

### 4.2 Atomicidad: fallo inyectado en cada paso
Para una operación de K pasos, K pruebas: hacer fallar el paso *i* (mock que lanza en esa llamada) y comprobar que
**la base queda idéntica** (comparar un resumen: filas, stock, estado) y que **no se emitió ningún evento**.

### 4.3 Restricciones de la base
Intentar insertar lo inválido directamente (sin pasar por la API) y esperar el rechazo: duplicado (`UNIQUE`), negativo
(`CHECK`), huérfano (`FK`). Demuestra que la base se defiende aunque el código falle.

### 4.4 Migraciones
Fixture `.sql` con el esquema **anterior** y datos → ejecutar migración → comparar con el esquema actual (`migrate diff`
sin diferencias) → leer los datos con el cliente nuevo. Una fixture por cada estado histórico realmente desplegado.

### 4.5 Permisos
Tabla ruta × método × rol con el código esperado. Incluir "sin sesión → 401" y "rol equivocado → 403". Para recursos por
fila: "usuario B pide el recurso de A → 403/404".

### 4.6 Payload real de la pantalla
Antes de endurecer una validación: copiar el JSON exacto que manda el formulario (con sus valores por defecto, p. ej. el
emoji) y agregarlo como caso (L-031).

## 5. Plan de mejora para cerrar las brechas (ordenado por valor / costo) — aplicado, ver §0

| # | Mejora | Esfuerzo | Valor | Detalle |
|---|---|---|---|---|
| 1 | Separar `test:rapido` / `test:integracion` | Bajo | Alto | §2.3. Mantiene el ciclo diario en segundos. |
| 2 | Medir cobertura (`@vitest/coverage-v8`) con umbral solo en `src/lib/` | Bajo | Medio | Primero **medir** y publicar el número; fijar el umbral después, sin perseguir el 100 % (TESTING §9). |
| 3 | CI (GitHub Actions) con `npm test`, `build` y `eslint` en cada PR | Medio | Alto | Hoy el cierre depende de la disciplina. |
| 4 | E2E con Playwright del camino crítico (login → pedido → cobro → anulación) en viewport móvil y de escritorio | Alto | Alto | Cuando el frontend esté estable; es la brecha más grande. |
| 5 | `axe` en componentes principales | Medio | Medio | Pertenece al frontend (Agus). |
| 6 | Property-based (`fast-check`) para `aCentavos/enPesos` y totales | Bajo | Medio | Encaja con L-001: para todo importe válido, `enPesos(aCentavos(x))` se aproxima a `x` a 2 decimales. |
| 7 | Mutation testing (Stryker) sobre `src/lib/` | Medio | Medio | Mide si los tests detectan cambios; correr de forma periódica, no en cada push. |
| 8 | Test de contrato del payload de cada pantalla | Medio | Medio | Reutiliza los payloads de §4.6. |

> Ninguna de estas mejoras está aplicada al proyecto: son propuestas. Cambiarían `package.json` y la infraestructura de pruebas, que es del backend; se hacen cuando el usuario lo decida.

## 6. Reglas de pruebas para un proyecto nuevo (síntesis)

1. **Las cinco capas se prueban con el tipo correcto** (§3 y TESTING.md §8). Nada de "todo con mocks".
2. **TDD estricto** en dominio, casos de uso, cálculos, estados y **todo bug**. Test-after en adaptadores, UI y *spikes*.
3. **Fakes de puertos propios** en vez de mocks; **motor real** para concurrencia, transacciones, restricciones y migraciones.
4. **Cada arreglo**: test `REGRESIÓN:` que falla primero (verificado revirtiendo el cambio).
5. **Antes de dar algo por terminado:** suite completa verde **dos veces seguidas**, `build` y linter, mostrando la salida.
6. **Medir** cobertura de dominio y casos de uso; **no** perseguir un porcentaje.
7. **CI** desde el primer commit; sin merge con pruebas en rojo ni `skip` sin justificación.
8. **E2E** del camino crítico en móvil y escritorio, y accesibilidad automática, cuando existe la interfaz.
9. Las pruebas que dependen del motor se **separan** de las rápidas para no frenar el desarrollo.
10. Dato/seed/script: incluidos en el chequeo de tipos o ejecutados en CI (L-032).

## 7. Checklist de cierre (TESTING.md §11 + lo aprendido en el proyecto)

- [ ] Cada comportamiento nuevo o modificado tiene al menos una prueba, con nombre en lenguaje de negocio.
- [ ] Todo bug corregido tiene su `REGRESIÓN:` y **se vio fallar** antes del arreglo.
- [ ] Camino feliz, límites (0, 1, máximo, máximo+1, vacío, nulo) y errores esperados.
- [ ] Permisos por rol (y por fila) y ruta nueva clasificada en la matriz.
- [ ] Concurrencia y atomicidad probadas contra el **motor real** si la operación escribe.
- [ ] Migración nueva con fixture del estado anterior.
- [ ] Ningún test toca la base del desarrollador (L-040) ni depende del orden o de la hora real.
- [ ] Suite **completa** verde dos veces seguidas; `build` y linter verdes (salida a la vista).
- [ ] Ningún test saltado o comentado sin justificación.
- [ ] Si algo no se pudo probar, está listado como pendiente.
