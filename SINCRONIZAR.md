# Fuente única (reemplaza al antiguo procedimiento de sincronización)

Decisión del 2026-10-07: **`D:\BaseConocimiento\` es la única fuente.** Ya no hay dos copias que mantener.

- `C:\Users\Jose\.claude\CLAUDE.md` (global) manda leer esta carpeta al iniciar un proyecto y registrar aquí las lecciones.
- En `C:\Users\Jose\.claude\conocimiento\` quedaron solo avisos de "MOVIDO" (`LECCIONES-APRENDIDAS.md`, `GUIA-APP-ROBUSTA.md`,
  `README.md`) para que cualquier referencia vieja (p. ej. el `CLAUDE.md` del proyecto restaurante-san-andres) lleve aquí.
  Su `graphify-out/` no se tocó.
- Al cerrar un bloque de trabajo: lección nueva → `01-fundamentos/LECCIONES-APRENDIDAS.md`; cambio de procedimiento →
  `01-fundamentos/GUIA-APP-ROBUSTA.md`; anotar en `CHANGELOG.md`.

Por qué esta ubicación y no la de `~/.claude`: es visible y fácil de respaldar, se puede copiar a otro equipo o a un
repositorio propio, y contiene también documentos largos (código de referencia, grafos) que no conviene tener ocultos
en la configuración de la herramienta. Respaldar la carpeta (ideal: repositorio Git privado).
