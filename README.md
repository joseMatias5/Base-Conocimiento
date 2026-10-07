# Base de conocimiento para desarrollar software robusto

Creada el 2026-10-07 a partir del proyecto **restaurante-san-andres** (auditoría de backend, 15 commits, 34 lecciones),
la guía de arquitectura descargada (`D:\Descargas\CLAUDE.md`) e investigación sobre arquitectura backend, bases de datos y transacciones.

**Cómo se usa:** en un proyecto nuevo, copiar `04-plantillas/CLAUDE.md.plantilla` a la raíz como `CLAUDE.md`, copiar
`06-pruebas/01-TESTING-guia-tdd.md` como `TESTING.md` y pegar el prompt de `04-plantillas/PROMPT-INICIAL.md`.
Claude lee esta carpeta (el `CLAUDE.md` global lo ordena al iniciar un proyecto) y sigue las fases.

## Mapa

| Carpeta / archivo | Contenido | Cuándo leerlo |
|---|---|---|
| `01-fundamentos/LECCIONES-APRENDIDAS.md` | 34 errores reales → reglas (L-001…L-059) | **Siempre**, antes de escribir código |
| `01-fundamentos/HERRAMIENTAS-Y-PLUGINS.md` | Plugins y skills instalados (graphify, feature-dev, code-review, security-review, engineering:*, playwright, LSP, token-usage…) y cuándo usar cada uno por fase | Al iniciar un proyecto y antes de revisar o entregar |
| `01-fundamentos/GUIA-APP-ROBUSTA.md` | Procedimiento en 7 fases con criterio de terminado | Al iniciar un proyecto y al cerrar cada fase |
| `02-arquitectura/CLAUDE-arquitectura-base.md` | Clean/Hexagonal, SOLID, GRASP, GoF, responsive, antipatrones. Es `CLAUDE_1.md` de Descargas, sin modificar (idéntico al `CLAUDE.md` descargado salvo que su §7 apunta a TESTING.md) | Al diseñar módulos y UI |
| `02-arquitectura/02-backend-por-tecnologia.md` | Estructura, librerías y errores típicos en C#, TypeScript, Python, Java y Go; cómo elegir stack | Al elegir tecnología o estructurar el backend |
| `02-arquitectura/03-diseno-de-api-y-seguridad.md` | REST, errores, autenticación, OWASP, observabilidad | Al diseñar rutas y seguridad |
| `03-base-de-datos/01-eleccion-de-base-de-datos.md` | Qué motor para qué sistema (SQLite, PostgreSQL, MySQL, SQL Server, MongoDB, Redis…) + ADR | Fase 0 de todo proyecto con datos |
| `03-base-de-datos/02-transacciones-y-atomicidad.md` | ACID, aislamiento, escritura condicional, versión de fila, bloqueos, Outbox, idempotencia, reintentos | Al escribir cualquier operación que modifique datos |
| `03-base-de-datos/03-abm-robusto.md` | Alta, consulta, modificación y baja completos; auditoría; equivalentes por tecnología | Al construir cada ABM |
| `03-base-de-datos/04-esquema-migraciones-respaldos.md` | Modelado, tipos, índices, migraciones, respaldos, rendimiento, pruebas de datos | Al diseñar el esquema y al desplegar |
| `04-plantillas/` | `CLAUDE.md.plantilla`, `PROMPT-INICIAL.md`, ADR, documento de cambio, lección, matriz de permisos | Al empezar un proyecto o un cambio |
| `05-referencia-proyecto-san-andres/` | Código real verificado (transacciones, dinero, migraciones, auth, tests de concurrencia y matriz de permisos), documentos de auditoría y su CLAUDE.md | Como ejemplo concreto a imitar |
| `06-pruebas/01-TESTING-guia-tdd.md` | TESTING.md descargado, sin modificar: TDD, pirámide, dobles, F.I.R.S.T., antipatrones, checklist | Al escribir o revisar pruebas (la norma) |
| `06-pruebas/02-pruebas-del-proyecto-y-brechas.md` | Contraste de la norma con los 799 tests del proyecto, tensiones resueltas, recetas de pruebas de datos, plan de mejora | Al decidir qué probar y cómo |
| `08-laboratorios/` | Laboratorios que validan con código real lo que estaba solo investigado (PostgreSQL y concurrencia, C#, respaldos y pipeline local, frontend e2e y seguridad básica; 58 tests) | Para saber qué recetas están ya probadas |
| `09-diseno-visual/` | Cómo evitar UI genérica con Claude Code, sistema de marca personal «Naranja señal» (`tokens.css`, `muestra.html`, plantilla de `CLAUDE.md` de diseño) | Antes de crear o cambiar cualquier pantalla |
| `07-grafos/` | Informes y grafos de graphify (proyecto: 876 nodos; lecciones: 49 nodos), foto del 2026-10-06 | Para navegar el proyecto/lecciones por relaciones |

## Orden de lectura sugerido para un proyecto nuevo

1. `01-fundamentos/LECCIONES-APRENDIDAS.md` → 2. `01-fundamentos/GUIA-APP-ROBUSTA.md` (Fase 0) →
3. `03-base-de-datos/01` (elegir motor, ADR) → 4. `02-arquitectura/02` (elegir stack y estructura) →
5. `04-plantillas/CLAUDE.md.plantilla` → 6. por funcionalidad: `03-base-de-datos/02` y `03`, `02-arquitectura/03`.

## Qué cubre y qué no (honestidad sobre los límites)

**Sólido (probado en el proyecto de referencia):** dinero y cálculos, concurrencia en SQLite, transacciones, estados,
reversibilidad, autenticación y permisos, migraciones, pruebas de regresión y de integración contra el motor real.

**Documentado desde investigación y conocimiento general, aún NO probado en un proyecto propio:** arquitectura en
C#/Python/Java/Go, PostgreSQL/SQL Server/MySQL (niveles de aislamiento, bloqueos `FOR UPDATE`, `SKIP LOCKED`), Outbox,
idempotencia por clave, multi-tenant, concurrencia optimista con versión de fila. Son recetas correctas pero deben
validarse con un test contra el motor real la primera vez que se usen, y la lección resultante se agrega aquí.

**Brechas conocidas:**
- Lecciones de frontend, accesibilidad y pruebas de punta a punta (Playwright): casi inexistentes. El proyecto de
  referencia ya mide cobertura (95 %), tiene e2e en escritorio y móvil, axe, propiedades, mutación (84 %) y un CI escrito; **el CI aún no se ejecutó en GitHub** y el e2e no recorre las pantallas de Comandas/Cocina/Caja con clics (detalle en `06-pruebas/02`).
- Despliegue en la nube, contenedores, CI/CD, monitoreo en producción.
- Cumplimiento legal (facturación electrónica, protección de datos, pagos reales): depende del país y del cliente.
- Una sola fuente de lecciones (un proyecto, un stack): puede haber sesgo hacia Next.js + Prisma + SQLite.

## Mantenimiento

- Al cerrar cada bloque de trabajo: toda corrección "a mano" → lección en `01-fundamentos/LECCIONES-APRENDIDAS.md`
  (formato Error → Regla → Cómo verificarlo → Origen) y la concreta en el `docs/lecciones-aprendidas.md` del proyecto.
- Si una lección cambia el procedimiento, actualizar `GUIA-APP-ROBUSTA.md`.
- **Fuente única:** esta carpeta. `C:\Users\Jose\.claude\conocimiento\` solo tiene avisos de mudanza (ver `SINCRONIZAR.md`).
- **Grafos:** `07-grafos/` es una foto del 2026-10-06 y **no incluye** estos documentos nuevos. Para que el grafo
  cubra toda la base, ejecutar `/graphify D:\BaseConocimiento` (consume el modelo para extraer relaciones de los .md).
- Registrar en `CHANGELOG.md` cada cambio relevante de esta base.
