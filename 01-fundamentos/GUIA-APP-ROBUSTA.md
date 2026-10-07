# Guía para construir una app robusta desde un solo pedido

Objetivo: que un pedido como "haceme una app de X" termine en una app bien hecha sin rondas de correcciones.
Esta guía es el procedimiento; `LECCIONES-APRENDIDAS.md` son los errores concretos que la originaron (L-xxx).
Cada fase tiene un **criterio de terminado**: no se pasa a la siguiente sin cumplirlo.
Herramientas y plugins por fase (`/code-review`, `/security-review`, `feature-dev`, `engineering:*`, Playwright…): `HERRAMIENTAS-Y-PLUGINS.md`.

---

## Fase 0 · Entender antes de escribir código
1. Releer `LECCIONES-APRENDIDAS.md` completo.
2. Preguntar en UNA tanda (máx. 4 preguntas) solo lo que cambia el diseño: usuarios y roles; si maneja dinero, stock
   o datos personales; dónde corre (web, escritorio, red local, nube); si hay datos existentes que migrar; quién más
   trabaja en el código. Lo demás se decide con defaults razonables y se anota (L-055).
3. Escribir `docs/decisiones.md`: decisiones tomadas y su porqué.

**Terminado cuando:** las preguntas que cambian el diseño están respondidas y anotadas.

## Fase 1 · Modelo de dominio
- Entidades, relaciones y **máquinas de estado explícitas** (estados finales, transiciones permitidas) (L-012).
- Dinero en enteros de la unidad mínima (L-001). Cantidades físicas: decimal con redondeo definido.
- Operaciones contables o de stock: reversibles por asiento inverso y con registro de movimientos (L-004).
- Fechas: guardar en UTC, definir períodos como `[inicio, fin)` en hora local (L-003).

**Terminado cuando:** el esquema existe y cada regla de negocio tiene un lugar donde vive (servidor, no cliente) (L-002).

## Fase 2 · Esqueleto con la infraestructura que después cuesta agregar
Todo esto va ANTES de las pantallas:
- **Autenticación:** sesión firmada, `httpOnly`, vencimiento, revocación en cada petición (usuario activo + rol de la base) (L-020, L-021).
- **Autorización:** un `requireAuth(roles)` único + **test de matriz de permisos** que recorre todas las rutas (L-025).
- **CSRF:** verificación de origen en toda petición que cambia datos y en el login (L-024).
- **Límite de intentos** de login sin confiar en encabezados del cliente (L-022).
- **Secretos:** obligatorios en producción, aleatorios en desarrollo (L-023).
- **Validación de entrada:** esquemas (zod o similar) en el borde de cada ruta; errores 400 con mensaje legible, nunca 500 (L-031).
- **Errores:** forma única `{ error }`, sin filtrar detalles internos; log del lado del servidor.
- **Migraciones automáticas** al arrancar, transaccionales e idempotentes, con test contra la base real (L-030).
- **Transacciones:** helper para operaciones de varios pasos; reclamar estados con escritura condicional (L-010, L-011). Con una base de un solo escritor (SQLite), el helper pone las escrituras en fila (L-013).
- **Tiempo real** (si aplica): eventos emitidos solo tras operaciones exitosas, con el mismo formato que la API, y revalidación de sesión en la conexión.

**Terminado cuando:** la matriz de permisos pasa, hay un test de migración contra la base real, y una ruta de ejemplo
tiene validación, transacción y test.

## Fase 3 · Funcionalidad, una por una
Por cada funcionalidad:
1. Contrato de la API (entrada, salida, errores) escrito antes.
2. Test del camino feliz + reglas de negocio + permisos + errores (rollback, sin efectos colaterales) (L-043).
3. Implementación en el servidor.
4. Pantalla: muestra `data.error`, estado de carga, deshabilita el botón mientras envía (doble envío), y no rompe si la
   API falla.
5. Commit con un documento corto: qué hace, decisiones, cambios visibles para el frontend (L-052).

**Terminado cuando:** tests verdes, **build** verde (detecta violaciones de convenciones del framework, L-056), y probado a mano en la app real.

## Fase 4 · Pruebas
- **Unitarias / de rutas:** con base simulada fiel (L-041) y sin tocar la base del desarrollador (L-040).
- **Integración contra el motor real:** concurrencia (N operaciones en paralelo sobre la base real), transacciones con fallo inyectado, migraciones (L-013, L-041). Cuidado con `vi.resetModules()` (L-044).
- **Regresión:** cada error encontrado tiene su test `REGRESIÓN:` (L-043).
- **Interfaz:** flujo principal de punta a punta (Playwright) en al menos el camino crítico, en viewport móvil y de escritorio, contra la app de producción con base temporal descartable. Accesibilidad automática (axe) en las pantallas de entrada.
- **Contrato con el frontend:** un test que envía el JSON EXACTO de cada pantalla (incluido el reenvío de lo recibido en un `GET`) y comprueba los campos que la pantalla lee (L-031, L-052).
- **Propiedades y mutación:** `fast-check` para dinero y estados; mutation testing (Stryker) sobre la lógica de negocio. Cada mutante sobreviviente es un caso nuevo; los bordes exactos van como ejemplos (L-059).
- **Estabilidad y velocidad:** correr la suite dos veces seguidas; tiempos límite para tests pesados (L-042); separar `test:rapido` (desarrollo) de `test:integracion` (motor real) para no frenar el ciclo diario.
- **Cobertura medida con umbral "que no retroceda"** (unos puntos por debajo de lo medido), no como meta.
- **CI desde el primer commit:** tipos, lint, suite con cobertura y build en cada PR; e2e aparte; mutación semanal.
- **Scripts y seeds** incluidos en el chequeo de tipos o ejecutados en CI (L-032).
- Detalle y recetas: `06-pruebas/` de la base de conocimiento.

## Fase 5 · Calidad y seguridad antes de entregar
- Lint y chequeo de tipos sin errores en TODO el repositorio (incluidos scripts y carpetas de escritorio).
- Revisión de seguridad (`/security-review`) y de código (`/code-review`) sobre la rama.
- Accesibilidad básica: tamaños táctiles de 44 px, `aria-label`, foco en modales, contraste.
- Diseño visual: usar los tokens y reglas de `09-diseno-visual/` (sin aspecto genérico), con captura en escritorio y móvil, claro y oscuro, y contraste medido (L-075, L-077).
- Imprimir o renderizar HTML con datos de usuario: siempre escapado (XSS).
- Un único formateador de moneda y fechas con la configuración regional.

## Fase 6 · Entrega
- README: requisitos, puesta en marcha, configuración, comandos, limitaciones de los tests.
- Probar la app **instalada** (no solo en desarrollo), incluida la actualización sobre una instalación existente.
- Subir la rama, abrir PR, listar lo pendiente explícitamente.

## Al cerrar cada bloque de trabajo
1. ¿Hubo alguna corrección "a mano" (algo que salió mal y hubo que rehacer)? → agregar una lección a
   `LECCIONES-APRENDIDAS.md` (generalizada) y al `docs/lecciones-aprendidas.md` del proyecto (concreta).
2. Si la lección cambia el procedimiento, actualizar esta guía.
3. Reconstruir el grafo (`/graphify` sobre esta carpeta, o `--update`).
