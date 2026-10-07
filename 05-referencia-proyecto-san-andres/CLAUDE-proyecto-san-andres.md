@AGENTS.md

# Convenciones del proyecto

- **Dinero en centavos enteros** en la base (`Int`); la API habla en pesos. Entrada: esquemas zod con `aCentavos`; salida (JSON y eventos SSE): `enPesos()`. Todo cálculo en centavos. Máximo por monto: `MAX_MONTO_PESOS`; totales calculados con `dentroDeRango()` (`src/lib/money.ts`).
- **Autenticación:** toda ruta empieza con `requireAuth([...roles])` (verifica origen, firma, usuario activo y rol desde la base). Una ruta nueva va en la matriz de `src/__tests__/api-guards.test.ts`.
- **Transacciones de escritura:** siempre con `transaccion()` de `src/lib/transaccion.ts` (las pone en fila: SQLite tiene un solo escritor), nunca `prisma.$transaction` directo en las rutas. Las transiciones de estado se reclaman con `updateMany` condicional al inicio.
- **Estados de pedido:** solo los de `TRANSICIONES` (`src/lib/pedidos.ts`); `pagado` y `cancelado` son finales; las correcciones de cobro se hacen anulando la venta.
- **Stock:** se descuenta al cobrar y se reintegra al anular, siempre con `MovimientoStock`; los ajustes manuales van por `POST /api/inventario/ajuste` (delta + motivo), nunca reemplazando el valor.
- **Cambios de esquema:** agregar un paso al final de `PASOS` en `src/lib/migraciones.ts` (detecta por estado, transaccional, SQL de `prisma migrate diff`) y su test con fixture en `migraciones.test.ts`. No correr `prisma format` sobre el archivo entero.
- **Archivos del framework** (`route.ts`, `page.tsx`, `proxy.ts`): exportan solo lo que Next espera; constantes y lógica compartida van en `src/lib/`.
- **Tests:** todo test que importa rutas simula `@/lib/prisma` (nunca tocar la `dev.db`). Lo que depende del motor (concurrencia, migraciones) se prueba contra SQLite real. Cada arreglo lleva un test `REGRESIÓN:`. Antes de cerrar: `npm test`, `npm run build`, `npx eslint .`, `npx tsc --noEmit` (y `npm run test:e2e` si se tocó login, rutas o pantallas de entrada). En desarrollo: `npm run test:rapido`. Si una pantalla cambia lo que envía o espera, actualizar `src/__tests__/contratos-pantallas.test.ts`. Guía completa en `docs/pruebas.md`.
- **Documentación:** un commit por grupo de hallazgos, con su documento en `docs/auditoria/` (plantilla de hallazgo + "Cambios visibles para el frontend") y la fila en el índice `docs/auditoria/README.md`.
- **Lecciones:** toda corrección hecha a mano se registra en `docs/lecciones-aprendidas.md` y, generalizada, en `~/.claude/conocimiento/LECCIONES-APRENDIDAS.md`.
- **División de trabajo:** backend = `src/app/api/**`, `src/lib/**`, `prisma/**`, `src/proxy.ts`, `electron/**`, `src/__tests__/**`, `scripts/**`; frontend (Agus) = páginas, layouts, `src/components`, `src/hooks`, `src/types`, `src/utils`, y los valores de `CONOCIDAS` en `e2e/accesibilidad.spec.ts` (el resto de `e2e/`, `playwright.config.ts` y `stryker.config.json` son del backend; si hay que tocarlos, se avisa). `src/utils/**` son funciones puras sin framework: el backend puede importarlas (p. ej. `formatPesos`, un solo formateador de pesos para pantallas e historial) pero no cambiarlas sin avisar. Un cambio de contrato de la API se avisa antes.
- El usuario escribe en español: responder en español.
