# Graph Report - restaurante-san-andres  (2026-10-06)

## Corpus Check
- 38 files · ~90,342 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 876 nodes · 2014 edges · 37 communities (28 shown, 9 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 36 edges (avg confidence: 0.81)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Catálogo, inventario y montos
- Pantallas del frontend
- Cobro y tests de flujo
- Pedidos y mesas
- Autenticación y sesión
- Arquitectura y auditoría (commits 3 y 5)
- Migraciones de esquema
- Recetas y stock
- Subidas y empaquetado
- Commit 3 - Sesion firmada, roles y PIN c
- Manifiesto del paquete
- test-sse-comandas.js
- Caja y limpieza
- Seguridad (revisión PR #1)
- App de escritorio (Electron)
- Configuración de electron-builder
- Configuración de TypeScript
- Dependencias de desarrollo
- prepare-desktop.mjs
- Dinero en centavos
- integracion-sqlite.test.ts
- Scripts npm
- Commit 13: fix(pedidos): transiciones, e
- Lecciones aprendidas
- Dependencias
- after-pack.js
- eventEmitter
- ESLint
- Tipos del plano
- Reglas para agentes
- PostCSS
- Logos Next/Vercel
- File Icon (Next.js template SVG)
- Globe Icon (Next.js template SVG)
- Restaurant App Icon (crossed fork and kn
- Browser Window Icon (Next.js template SV

## God Nodes (most connected - your core abstractions)
1. `Auditoría técnica del backend` - 49 edges
2. `requireAuth()` - 47 edges
3. `next` - 37 edges
4. `Lecciones aprendidas` - 29 edges
5. `Commit 11: seguridad (revisión del PR #1)` - 25 edges
6. `transaccion()` - 24 edges
7. `vitest` - 22 edges
8. `enPesos()` - 21 edges
9. `Commit 9: dinero en centavos y migración automática` - 21 edges
10. `useApi()` - 19 edges

## Surprising Connections (you probably didn't know these)
- `Renumber to deleted table number (hard delete or archive with -id)` --references--> `Table / SalonTable entity`  [INFERRED]
  docs/auditoria/commit-05-mesas-sse-uploads.md → ARCHITECTURE.md
- `Single PrismaClient from lib/prisma.ts` --references--> `Prisma ORM + SQLite persistence`  [INFERRED]
  docs/auditoria/commit-03-autenticacion.md → ARCHITECTURE.md
- `Roles ADMIN / MOZO / COCINERO` --conceptually_related_to--> `requireAuth (src/lib/auth.ts)`  [INFERRED]
  README.md → docs/auditoria/commit-11-seguridad-revision-pr1.md
- `/api/checkout/pay (cobro)` --calls--> `datosNegocio() (src/lib/negocio.ts)`  [INFERRED]
  CLAUDE_HANDOFF.md → docs/auditoria/commit-07-periodo-caja-y-limpieza.md
- `src/lib/pin.ts (PIN con hash scrypt)` --implements--> `AT-07 PIN en texto plano y sin límite de intentos`  [INFERRED]
  CLAUDE_HANDOFF.md → docs/auditoria/README.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Anulación de venta reversible (asiento inverso + reintegro de stock)** — docs_auditoria_commit_04_estados_anulacion_asiento_inverso, docs_auditoria_commit_04_estados_anulacion_post_api_ventas_id_anular, docs_auditoria_commit_10_recetas_y_stock_movimientostock, docs_auditoria_commit_10_recetas_y_stock_reintegro_exacto, docs_auditoria_readme_at_18, docs_auditoria_readme_at_12 [EXTRACTED 1.00]
- **Authentication and authorization hardening (commit 3)** — docs_auditoria_commit_03_autenticacion_hmac_signed_session, docs_auditoria_commit_03_autenticacion_require_auth_guard, docs_auditoria_commit_03_autenticacion_scrypt_pin_hash, docs_auditoria_commit_03_autenticacion_rate_limit, docs_auditoria_commit_03_autenticacion_middleware [EXTRACTED 1.00]
- **Migración a centavos enteros al arrancar** — docs_auditoria_commit_09_dinero_en_centavos_src_lib_money_ts, docs_auditoria_commit_09_dinero_en_centavos_centavos_enteros, docs_auditoria_commit_09_dinero_en_centavos_src_lib_migraciones_ts, docs_auditoria_commit_09_dinero_en_centavos_src_instrumentation_ts, docs_auditoria_commit_09_dinero_en_centavos_migracion_por_deteccion, docs_auditoria_readme_at_13, docs_auditoria_readme_at_20 [EXTRACTED 1.00]
- **Corrección de métricas del commit 12** — docs_auditoria_commit_12_propinas_costos_rango_commit, docs_auditoria_commit_12_propinas_costos_rango_montomensualcentavos, docs_auditoria_commit_12_propinas_costos_rango_ingreso_sin_propinas, docs_auditoria_commit_12_propinas_costos_rango_max_monto_pesos_dentroderango, docs_auditoria_readme_at_28, docs_auditoria_readme_at_29, docs_auditoria_readme_at_30 [EXTRACTED 1.00]
- **Real-time LAN sync pipeline** — architecture_core_servidor, architecture_eventemitter_pubsub, architecture_sse_api_events, architecture_terminales, architecture_prisma_sqlite [EXTRACTED 1.00]
- **Cadena de autenticación por petición (requireAuth, sesionVigente, origen, proxy)** — docs_auditoria_commit_11_seguridad_revision_pr1_requireauth, docs_auditoria_commit_11_seguridad_revision_pr1_sesionvigente, docs_auditoria_commit_11_seguridad_revision_pr1_src_lib_origen_ts, src_proxy, docs_auditoria_commit_11_seguridad_revision_pr1_api_events [EXTRACTED 1.00]
- **Arreglo de concurrencia SQLite (AT-35)** — docs_auditoria_commit_14_sqlite_concurrencia_commit, docs_auditoria_commit_14_sqlite_concurrencia_transaccion, src_tests_integracion_sqlite_test, docs_auditoria_readme_at_35, docs_lecciones_aprendidas_leccion_23 [EXTRACTED 1.00]
- **Cobro robusto: atómico, idempotente y en fila** — docs_auditoria_commit_01_cobro_commit, docs_auditoria_readme_at_05, docs_auditoria_commit_13_estados_eventos_cobro_stock_cobro_idempotente, docs_auditoria_commit_14_sqlite_concurrencia_transaccion, src_tests_integracion_sqlite_test [INFERRED 0.85]
- **create-next-app default public assets (boilerplate)** — public_file_file_icon, public_globe_globe_icon, public_window_window_icon, public_next_next_js_logo, public_vercel_vercel_logo [INFERRED 0.85]

## Communities (37 total, 9 thin omitted)

### Community 0 - "Catálogo, inventario y montos"
Cohesion: 0.05
Nodes (75): nextConfig, next, GET(), GET(), DELETE(), error(), GET(), POST() (+67 more)

### Community 1 - "Pantallas del frontend"
Cohesion: 0.05
Nodes (65): lucide-react, react, recharts, CajaData, CajaPage(), VentaAnulable, VentaCaja, CostoFijo (+57 more)

### Community 2 - "Cobro y tests de flujo"
Cohesion: 0.05
Nodes (63): vitest, GET(), armarTickets(), POST(), ventaVigenteDelPedido(), GET(), GET(), ingreso() (+55 more)

### Community 3 - "Pedidos y mesas"
Cohesion: 0.05
Nodes (55): zod, bodySchema, CobroError, INCLUIR_PEDIDO, METODOS_PAGO, PedidoConDetalle, Venta, DELETE() (+47 more)

### Community 4 - "Autenticación y sesión"
Cohesion: 0.08
Nodes (42): PATCH(), GET(), POST(), POST(), POST(), origenPermitido(), autenticarPin(), hashPin() (+34 more)

### Community 5 - "Arquitectura y auditoría (commits 3 y 5)"
Cohesion: 0.08
Nodes (28): Category entity, ARCHITECTURE.md - Enterprise POS Architecture, EventEmitter PubSub module, Modifier entity (future), Order entity, OrderItem entity, Product entity, SSE stream /api/events (+20 more)

### Community 6 - "Migraciones de esquema"
Cohesion: 0.07
Nodes (25): prisma, prisma, @prisma/client, register(), columnas(), COLUMNAS_MONTO, comillas(), Conexion (+17 more)

### Community 7 - "Recetas y stock"
Cohesion: 0.13
Nodes (20): prisma/schema.prisma, Commit 4: estados finales, cancelación segura y anulación, POST /api/ventas/[id]/anular, GET/PUT /api/productos/[id]/receta, Commit 10: recetas y stock conectado a las ventas, MovimientoStock, POST /api/inventario, RecetaItem (receta de producto) (+12 more)

### Community 8 - "Subidas y empaquetado"
Cohesion: 0.13
Nodes (13): POST(), dynamic, GET(), MIME, detectarImagen(), MAX_IMAGEN_BYTES, PNG, TipoImagen (+5 more)

### Community 9 - "Commit 3 - Sesion firmada, roles y PIN c"
Cohesion: 0.16
Nodes (16): src/lib/pin.ts (PIN con hash scrypt), Commit 3: feat(seguridad): sesión firmada, roles y PIN con hash, Commit 3 - Sesion firmada, roles y PIN con hash, Electron main.js generates session.key, src/middleware.ts session verification, Endpoint permission matrix by role, Commit 5: fix(mesas): reglas, SSE sin fugas y uploads validados, Commit 5 - Mesas, SSE y uploads (+8 more)

### Community 10 - "Manifiesto del paquete"
Cohesion: 0.09
Nodes (21): main, name, prisma, seed, private, version, concurrently, copyfiles (+13 more)

### Community 11 - "test-sse-comandas.js"
Cohesion: 0.12
Nodes (18): electron, api(), { app, BrowserWindow, session }, check(), COOKIE, counters(), crypto, fs (+10 more)

### Community 12 - "Caja y limpieza"
Cohesion: 0.18
Nodes (17): Commit 6: fix(validacion): entrada validada en catálogo, Commit 7: período de Caja, datos del comercio y limpieza, datosNegocio() (src/lib/negocio.ts), .gitattributes (fines de línea LF), Variables NEGOCIO_NOMBRE / NEGOCIO_CUIT / NEGOCIO_DIRECCION, Commit 8: eliminar temp.tsx, temp.tsx (copia sin uso de ComandasPage), Commit 12: fix(metricas): propinas, costos por periodicidad y rango (+9 more)

### Community 13 - "Seguridad (revisión PR #1)"
Cohesion: 0.17
Nodes (16): /api/events (SSE heartbeat), /api/hub-metrics, POST /api/auth/check-admin-pin, Commit 11: seguridad (revisión del PR #1), requireAuth (src/lib/auth.ts), sesionVigente(), src/lib/origen.ts (verificación Origin / Sec-Fetch-Site), POST /api/auth/verify-pin (+8 more)

### Community 14 - "App de escritorio (Electron)"
Cohesion: 0.12
Nodes (17): { app, BrowserWindow, Menu, dialog, shell, utilityProcess }, createWindow(), crypto, dataDir, dbPath, DEFAULT_CONFIG, fatal(), fs (+9 more)

### Community 15 - "Configuración de electron-builder"
Cohesion: 0.10
Nodes (20): build, afterPack, appId, asar, directories, files, npmRebuild, nsis (+12 more)

### Community 16 - "Configuración de TypeScript"
Cohesion: 0.11
Nodes (18): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+10 more)

### Community 17 - "Dependencias de desarrollo"
Cohesion: 0.11
Nodes (18): devDependencies, concurrently, copyfiles, electron, electron-builder, eslint, eslint-config-next, picocolors (+10 more)

### Community 18 - "prepare-desktop.mjs"
Cohesion: 0.12
Nodes (13): CLAUDE_HANDOFF (traspaso del proyecto), Empaquetado .exe (Next standalone + Electron utilityProcess), scripts/test-sse-comandas.js (npm run test:sse), Stack: Next.js 16, Prisma + SQLite, Electron, Vitest, copyResolved(), env, findFiles(), leftoverLinks (+5 more)

### Community 19 - "Dinero en centavos"
Cohesion: 0.23
Nodes (12): Commit 9: dinero en centavos y migración automática, migraciones.test.ts (SQLite real), roundMoney() (parche eliminado), src/instrumentation.ts register(), src/lib/migraciones.ts (migraciones automáticas), src/lib/money.ts (aCentavos / enPesos), AT-13 Dinero en Float, AT-20 Instalaciones existentes sin migración de esquema (+4 more)

### Community 20 - "integracion-sqlite.test.ts"
Cohesion: 0.21
Nodes (10): Commit 14: fix(concurrencia): transacciones en fila para SQLite, transaccion() (src/lib/transaccion.ts), AT-35 Cobros simultáneos fallaban con 500 en SQLite real, anular(), cancelar(), ctx(), dir, json() (+2 more)

### Community 21 - "Scripts npm"
Cohesion: 0.12
Nodes (17): scripts, build, db:push, db:seed, db:setup, db:studio, desktop:prepare, desktop:test (+9 more)

### Community 22 - "Commit 13: fix(pedidos): transiciones, e"
Cohesion: 0.29
Nodes (9): Commit 13: fix(pedidos): transiciones, eventos de mesa, cobro idempotente, ajuste de stock, MovimientoStock.detalle (migración paso 3), PEDIDOS_QUE_OCUPAN_MESA (src/lib/mesas.ts), POST /api/inventario/ajuste, TRANSICIONES (src/lib/pedidos.ts), AT-31 Cualquier salto entre estados abiertos del pedido, AT-32 Eventos mesa:actualizada ausentes o con estado viejo, AT-33 Reintento de un cobro exitoso respondía error (+1 more)

### Community 23 - "Lecciones aprendidas"
Cohesion: 0.23
Nodes (3): Lecciones aprendidas, Merge a531548, Sesión 2026-10-06

### Community 24 - "Dependencias"
Cohesion: 0.22
Nodes (9): dependencies, date-fns, lucide-react, next, @prisma/client, react, react-dom, recharts (+1 more)

### Community 25 - "after-pack.js"
Cohesion: 0.33
Nodes (3): fs, path, REQUIRED

### Community 27 - "ESLint"
Cohesion: 0.50
Nodes (3): eslintConfig, eslint, eslint-config-next

### Community 28 - "Tipos del plano"
Cohesion: 0.50
Nodes (3): SalonTable, TableShape, TableStatus

## Knowledge Gaps
- **266 isolated node(s):** `Plano`, `VentaMinima`, `CajaData`, `CostoFijo`, `Pedido` (+261 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 318 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `Catálogo, inventario y montos` to `Pantallas del frontend`, `Cobro y tests de flujo`, `Pedidos y mesas`, `Autenticación y sesión`, `Subidas y empaquetado`, `Manifiesto del paquete`?**
  _High betweenness centrality (0.135) - this node is a cross-community bridge._
- **What connects `Plano`, `VentaMinima`, `CajaData` to the rest of the system?**
  _266 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Catálogo, inventario y montos` be split into smaller, more focused modules?**
  _Cohesion score 0.053267326732673266 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `Cobro y tests de flujo` to `Catálogo, inventario y montos`, `Pantallas del frontend`, `Pedidos y mesas`, `Autenticación y sesión`, `Migraciones de esquema`, `Subidas y empaquetado`, `Manifiesto del paquete`, `integracion-sqlite.test.ts`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Should `Pantallas del frontend` be split into smaller, more focused modules?**
  _Cohesion score 0.05299145299145299 - nodes in this community are weakly interconnected._
- **Why does `Auditoría técnica del backend` connect `Caja y limpieza` to `Arquitectura y auditoría (commits 3 y 5)`, `Recetas y stock`, `Commit 3 - Sesion firmada, roles y PIN c`, `Seguridad (revisión PR #1)`, `Dinero en centavos`, `integracion-sqlite.test.ts`, `Commit 13: fix(pedidos): transiciones, e`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Should `Cobro y tests de flujo` be split into smaller, more focused modules?**
  _Cohesion score 0.05183861082737487 - nodes in this community are weakly interconnected._