# Herramientas, plugins y skills disponibles: cuándo usar cada uno

Inventario real de lo instalado en Claude Code de este equipo (verificado el 2026-10-07 en la lista de skills de la sesión y
en `~/.claude/plugins`). **Regla general:** si una tarea cae en la columna "Usar cuando", usar la herramienta *antes* de
improvisar; si no hay herramienta, seguir esta base de conocimiento. Las herramientas complementan las guías, no las reemplazan:
las reglas del proyecto (`CLAUDE.md`, `TESTING.md`) siguen mandando.

## 1. Por fase de la guía (`GUIA-APP-ROBUSTA.md`)

| Fase | Herramienta | Usar cuando |
|---|---|---|
| 0 Entender | `engineering:architecture` | Hay 2–3 opciones técnicas (motor de BD, stack, cola): produce el ADR |
| 0–1 Diseño | `engineering:system-design` | Definir servicios, API y modelo de datos de algo nuevo |
| 0–6 Contexto | `graphify` (`/graphify`) | Preguntas sobre un código o carpeta grande; existe `graphify-out/` o `07-grafos/` |
| 2–3 Funcionalidad | `feature-dev:feature-dev` (+ agentes `code-explorer`, `code-architect`) | Agregar una funcionalidad a un proyecto existente: entender el código, diseñar y construir por pasos |
| 3 Código C/C++/Java/Kotlin/Python/Rust | `karellen-lsp-mcp:lsp-register` / `lsp-investigate` | Rastrear referencias, jerarquías de llamadas, impacto de un cambio sin leer archivos enteros |
| 3 TypeScript | plugin `typescript-native-lsp` | Navegación y diagnósticos de tipos en TS |
| 4 Pruebas | `engineering:testing-strategy` | Diseñar el plan de pruebas de un módulo nuevo (qué capa prueba qué) |
| 4 Pruebas | `anthropic-skills:backend-audit-testing` | Auditar/probar un backend existente por capas: reglas, API, BD, concurrencia, seguridad |
| 4 Pruebas e2e | plugin `playwright` (`browser_*`) | Recorrer la app real, capturas, consola, red, accesibilidad; verificar a mano lo que el e2e aún no cubre |
| 4 Calidad Python | `quick-gate-python:quick-gate-python` | Compuerta determinista Ruff + Pyright + pytest antes de entregar un proyecto Python |
| 5 Revisión | `code-review:code-review` / `engineering:code-review` | Antes de abrir un PR o cerrar un bloque: bugs, seguridad, rendimiento |
| 5 Seguridad | `security-review` | Revisión de seguridad de los cambios de la rama (obligatoria antes de entregar) |
| 5 Limpieza | `simplify`, `engineering:tech-debt` | Reducir duplicación y priorizar deuda técnica |
| 5 UI | `frontend-design:frontend-design`, `dataviz` | Pantallas nuevas y gráficos/dashboards (colores accesibles, jerarquía) |
| 3/5 UI (marca propia) | `09-diseno-visual/` + `frontend-design` | Toda pantalla nueva: tokens «Naranja señal», plantilla de CLAUDE.md, captura de verificación. **Playwright falló el 2026-10-07 (no hay Chrome):** usar Edge headless (receta en `09-diseno-visual/01`) o `npx playwright install chrome`. Superdesign (`/superdesign`) no está instalado: opcional |
| 6 Entrega | `engineering:deploy-checklist` | Antes de desplegar: migraciones, CI, aprobaciones, plan de reversión |
| 6 Documentación | `engineering:documentation`, `init` | README, runbooks, onboarding; generar el `CLAUDE.md` de un repo existente |
| Producción | `engineering:incident-response`, `engineering:debug` | Caída o falla en producción; error sin causa obvia (reproducir → aislar → arreglar) |
| Cierre | `engineering:standup` | Resumen de lo hecho (commits, PRs) para el equipo |

## 2. Soporte de la propia sesión

| Herramienta | Usar cuando |
|---|---|
| `token-usage:report` y herramientas `session_cost`, `insights`, `top_consumers`, `history` | Saber cuánto costó una sesión o un laboratorio, detectar gasto anómalo. **Probado el 2026-10-07:** `session_cost` funciona y devuelve costo estimado por actividad |
| `token-saver:*` | Sesiones largas: snapshot de la conversación y archivo de Q&A por concepto |
| `loop`, `schedule` | Tareas repetidas o programadas (p. ej. revisar el CI cada N minutos, mutación semanal) |
| `fewer-permission-prompts`, `update-config` | Reducir confirmaciones; hooks y permisos en `settings.json` |
| `claude-api` | El proyecto usa la API de Claude/Anthropic: leerla **antes** de abrir el archivo |
| `anthropic-skills:docx / pdf / xlsx / pptx` | El entregable es un archivo Word, PDF, Excel o PowerPoint |
| Agente `Explore` | Búsquedas amplias en muchos archivos cuando solo se necesita la conclusión |

## 3. Conectores que requieren autenticación (no usables hasta que el usuario los conecte)

Context7 (documentación actualizada de librerías), Atlassian/Jira, Linear, Notion, Slack, Datadog y Google Drive.
**Context7 es el más valioso para esta base:** permite verificar la API vigente de una librería antes de escribir
código contra ella (evita recetas obsoletas). Pedir al usuario que lo conecte la primera vez que haga falta.
Datadog sería la pieza de monitoreo en producción (brecha conocida del README).

## 4. Reglas de uso

1. **Elegir por la tarea, no por costumbre.** Una corrección de una línea no necesita `feature-dev`; una funcionalidad con
   transacciones y permisos sí necesita revisión (`code-review` + `security-review`).
2. **Obligatorias antes de entregar:** `security-review` y `code-review` sobre la rama (Fase 5), con la salida a la vista.
3. **Verificar que la herramienta funciona** antes de depender de ella (el servidor `karellen-lsp-mcp` falló al conectar el
   2026-10-07: si una herramienta falla, decirlo y seguir con alternativa: leer código y `Grep`).
4. **Subagentes solo si hace falta:** cada uno arranca sin contexto; usarlos para revisiones independientes o búsquedas
   amplias, no para trabajo que cabe en la conversación.
5. **Lo que una herramienta descubre y cuesta corregir a mano → lección** en `LECCIONES-APRENDIDAS.md`.
6. Este inventario cambia: al instalar o quitar un plugin, actualizar esta tabla y anotarlo en `CHANGELOG.md`.
