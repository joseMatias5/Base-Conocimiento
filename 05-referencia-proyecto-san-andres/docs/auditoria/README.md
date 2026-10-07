# Auditoría técnica del backend — Restaurante San Andrés

Documentación de los cambios hechos en la rama `backend`, **un documento por commit**, con la
plantilla de hallazgos acordada. Sirve para que quien trabaja en el frontend sepa qué cambió, por qué
y qué debe tener en cuenta.

## Commits documentados

| # | Commit | Documento | Hallazgos |
|---|--------|-----------|-----------|
| 1 | `fix(cobro): cobro atómico e idempotente, sin ventas duplicadas` | [commit-01-cobro.md](commit-01-cobro.md) | AT-03, AT-05, AT-06 (parcial), AT-08 (parcial) |
| 2 | `fix(pedidos): precios y totales calculados en el servidor` | [commit-02-precios-pedidos.md](commit-02-precios-pedidos.md) | AT-04, AT-06 (parcial), AT-08 (parcial) |
| 3 | `feat(seguridad): sesión firmada, roles en toda la API y PIN con hash` | [commit-03-autenticacion.md](commit-03-autenticacion.md) | AT-01, AT-02, AT-07, AT-15, AT-10/11/14 (parcial) |
| 4 | `fix(pedidos): estados finales, cancelación segura y anulación de ventas` | [commit-04-estados-anulacion.md](commit-04-estados-anulacion.md) | AT-18, AT-09, AT-06 (completo), AT-14 (parcial) |
| 5 | `fix(mesas): reglas de negocio, SSE sin fugas y subida de imágenes validada` | [commit-05-mesas-sse-uploads.md](commit-05-mesas-sse-uploads.md) | AT-14 (completo), AT-10, AT-11 |
| 6 | `fix(validacion): productos, costos, proveedores, inventario y consultas con entrada validada` | [commit-06-validacion-catalogo.md](commit-06-validacion-catalogo.md) | AT-08 (completo), AT-19 (hallado) |
| 7 | `fix(caja): período "Hoy" correcto, datos del comercio configurables y limpieza del repositorio` | [commit-07-periodo-caja-y-limpieza.md](commit-07-periodo-caja-y-limpieza.md) | AT-19, AT-16, AT-17 (parcial) |
| 8 | `chore(repo): eliminar temp.tsx, copia sin uso de la pantalla de Comandas` | [commit-08-borrar-temp.md](commit-08-borrar-temp.md) | AT-17 (completo) |
| 9 | `fix(dinero): montos en centavos enteros y migración automática de la base al arrancar` | [commit-09-dinero-en-centavos.md](commit-09-dinero-en-centavos.md) | AT-13 (completo), AT-20 |
| 10 | `feat(inventario): recetas de productos, descuento de stock al cobrar y reintegro al anular` | [commit-10-recetas-y-stock.md](commit-10-recetas-y-stock.md) | AT-12 (completo), AT-09 (completo) |
| 11 | `fix(seguridad): límite de PIN no evadible, sesiones revocables, CSRF y endpoints sin datos de más` (rama `fix/revision-pr1`) | [commit-11-seguridad-revision-pr1.md](commit-11-seguridad-revision-pr1.md) | AT-21 a AT-27 |
| 12 | `fix(metricas): propinas fuera del ingreso, costos por periodicidad y montos dentro del rango de la base` | [commit-12-propinas-costos-rango.md](commit-12-propinas-costos-rango.md) | AT-28 a AT-30 |
| 13 | `fix(pedidos): transiciones de estado explícitas, eventos de mesa correctos, cobro idempotente y ajuste de stock` | [commit-13-estados-eventos-cobro-stock.md](commit-13-estados-eventos-cobro-stock.md) | AT-31 a AT-34 |
| 14 | `fix(concurrencia): transacciones de escritura en fila para SQLite y tests de integración contra la base real` | [commit-14-sqlite-concurrencia.md](commit-14-sqlite-concurrencia.md) | AT-35 |
| 15 | `chore(pruebas): separar tests rápidos, medir cobertura, CI, e2e con Playwright, propiedades, mutación y contrato de pantallas` (rama `chore/calidad-pruebas`) | [commit-15-calidad-de-pruebas.md](commit-15-calidad-de-pruebas.md) | AT-36, AT-37 (hallados; abiertos) |
| 16 | `chore(integracion): ignorar release/ en ESLint, un solo formateador de pesos y contrato de Inventario sin el caso pendiente` (rama `chore/ajustes-finales`) | [commit-16-integracion-frontend.md](commit-16-integracion-frontend.md) | Respuestas a la integración del frontend; AT-36 (parcial) |
| 17 | `test(accesibilidad): axe en Cocina y las 8 pantallas de Administración; registrar AT-38` (ramas `frontend/contraste` y `chore/cierre-at36`) | [commit-17-contraste-y-cobertura-axe.md](commit-17-contraste-y-cobertura-axe.md) | AT-36 (cerrado), AT-38 (hallado; abierto) |

## Estado de los hallazgos

| ID | Hallazgo | Impacto | Estado |
|----|----------|---------|--------|
| AT-01 | Sesión forjable (cookie JSON sin firma, legible por JS) | Muy Alto | ✅ Commit 3 |
| AT-02 | API sin autenticación ni autorización | Muy Alto | ✅ Commit 3 |
| AT-03 | Doble registro de ventas (entregado + cobro) | Muy Alto | ✅ Commit 1 |
| AT-04 | Precios y totales definidos por el cliente | Alto | ✅ Commit 2 |
| AT-05 | Carreras en el cobro (doble cobro, ticket repetido) | Alto | ✅ Commit 1 |
| AT-06 | Operaciones multi-paso sin transacción | Alto | ✅ Commits 1, 2 y 4 |
| AT-07 | PIN en texto plano y sin límite de intentos | Alto | ✅ Commit 3 |
| AT-08 | Sin validación de entrada | Alto | ✅ Commits 1, 2, 4, 5 y 6 |
| AT-09 | Cancelación sin controles (pedido pagado, stock, venta) | Alto | ✅ Commits 4 (estado y transacción) y 10 (stock) |
| AT-10 | SSE sin autenticación y fuga de temporizadores | Medio | ✅ Commits 3 y 5 |
| AT-11 | Subida de archivos débil | Medio | ✅ Commits 3 y 5 |
| AT-12 | Inventario desconectado de las ventas | Medio | ✅ Commit 10 |
| AT-13 | Dinero en `Float` | Medio | ✅ Commits 1 (redondeo) y 9 (centavos enteros) |
| AT-14 | Mesas: estado libre y borrado sin validar | Medio | ✅ Commits 3, 4 y 5 |
| AT-15 | Múltiples instancias de `PrismaClient` | Medio | ✅ Commit 3 |
| AT-16 | Datos del comercio fijos en el ticket | Bajo | ✅ Commit 7 |
| AT-17 | Residuos (`temp.tsx`, README genérico, UTF-16) | Bajo | ✅ Commits 7 y 8 |
| AT-18 | Pedido cobrado reabrible y sin anulación de ventas (hallado en prueba manual) | Muy Alto | ✅ Commit 4 (falta el botón en el frontend) |
| AT-19 | "Hoy" en Caja incluye las ventas de ayer (período desplazado un día) | Medio | ✅ Commit 7 |
| AT-20 | Instalaciones existentes sin migración de esquema (hallado al hacer AT-13) | Alto | ✅ Commit 9 |
| AT-21 | Límite de intentos de PIN evadible con `X-Forwarded-For` (revisión del PR #1) | Alto | ✅ Commit 11 |
| AT-22 | `check-admin-pin` revelaba nombre y rol, y aceptaba roles inexistentes | Medio | ✅ Commit 11 |
| AT-23 | `/api/hub-metrics` sin autenticación | Bajo | ✅ Commit 11 |
| AT-24 | Usuario desactivado o con rol cambiado seguía operando hasta 12 h | Alto | ✅ Commit 11 |
| AT-25 | Conexión SSE abierta tras vencer la sesión | Medio | ✅ Commit 11 |
| AT-26 | Secreto de sesión por defecto publicado en el repositorio | Medio | ✅ Commit 11 |
| AT-27 | Sin protección CSRF más allá de `SameSite=Lax` | Medio | ✅ Commit 11 |
| AT-28 | Propinas contadas como ingreso del negocio | Medio | ✅ Commit 12 |
| AT-29 | Costos sumados sin mirar la periodicidad | Medio | ✅ Commit 12 |
| AT-30 | Montos fuera del rango de la columna (error 500) | Bajo | ✅ Commit 12 |
| AT-31 | Cualquier salto entre estados abiertos del pedido | Medio | ✅ Commit 13 |
| AT-32 | Eventos `mesa:actualizada` ausentes o con el estado viejo | Bajo | ✅ Commit 13 |
| AT-33 | El reintento de un cobro exitoso respondía error | Medio | ✅ Commit 13 |
| AT-34 | Editar el stock pisaba las ventas y no dejaba registro | Medio | ✅ Commit 13 (falta la pantalla) |
| AT-35 | Cobros simultáneos fallaban con 500 en SQLite real (hallado por el test de integración) | Alto | ✅ Commit 14 |
| AT-36 | Violaciones de accesibilidad en inicio, modal del PIN y Comandas: botones sin nombre y contraste (hallado por axe) | Medio | ✅ Commit 16 (botones sin nombre) y `frontend/contraste` (contraste AA en toda la app); cubierto por axe en el commit 17 |
| AT-37 | 25 vulnerabilidades en dependencias según `npm audit` (3 altas en producción); sin actualizar | A evaluar | ⏳ Abierto; registrado en el commit 15 |
| AT-38 | Otras violaciones de accesibilidad en Administración: `<select>` sin etiqueta (Caja, Historial) y zonas con scroll no enfocables en móvil (hallado al ampliar axe) | Bajo a Medio | ⏳ Abierto (frontend); medido en el commit 17 |

## Convenciones

- **Impacto** y **Esfuerzo**: Muy Alto | Alto | Medio | Bajo | Muy Bajo.
- **Contrato con el frontend:** mismas rutas, métodos y forma de respuesta. Cada documento lista
  los cambios visibles (códigos de error nuevos, campos ignorados, permisos).
- **Tests:** `npm test`. Los tests usan una base simulada en memoria (un solo escritor con
  rollback). No sustituyen una prueba contra SQLite real: cada documento indica la prueba manual.
  Excepción: `migraciones.test.ts` corre contra SQLite real.
