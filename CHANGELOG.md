# Changelog de la base de conocimiento

## 2026-10-09 (recursos frontend) — Dos documentos nuevos en `09-diseno-visual/`
- Analizados `yurimutti/recursos-frontend`, `vanessamarely/recursos-frontend` y `requestly/awesome-frontend-resources` (clonados y leídos completos).
- `03-recursos-visuales-curados.md`: íconos, tipografía, color/contraste, CSS, ilustraciones, imágenes, prototipado, inspiración, rendimiento y bibliotecas JS, con reglas de uso (licencia, un solo set de íconos, autoalojar fuentes, contraste) y qué evitar.
- `04-recursos-aprendizaje-frontend.md`: referencias canónicas, rutas, práctica, libros, canales en español, y valoración de cada repo.
- Enlaces probados con script (182): 403/401 = bloqueo a bots (vivos); se quitaron commercecream.com, acefrontend.com y free-css.com (no resuelven) y se corrigieron cssmatic y drawkit. Lo obsoleto marcado con ⚠ sale de conocimiento general. Algunos recursos "agregados" (Phosphor, Fontsource, Penpot, Picsum, etc.) no estaban en los repos y se identifican como tales.

## 2026-10-07 (orden de lecciones) — Numeración sin repetidos
- Choque de numeración entre sesiones (L-069 a L-071 usados dos veces; L-054 con "refuerzos" como entradas aparte): las de diseño visual pasaron a L-075 a L-077 (ya citadas así en los documentos), los dos refuerzos de L-054 se plegaron dentro de L-054 como "Se repitió" y de L-069 en adelante las lecciones quedaron en orden numérico.
- Nuevo `herramientas/verificar-lecciones.py`: siguiente número libre, repetidos y referencias `L-nnn` rotas (hoy: 53 lecciones, L-001 a L-078, sin problemas). Regla de numeración en el encabezado de `LECCIONES-APRENDIDAS.md` y en el README.

## 2026-10-07 (diseño visual) — Nueva carpeta `09-diseno-visual/`
- Investigación de los artículos de Superdesign y del skill `frontend-design` instalado → `01-diseno-sin-aspecto-generico.md`
  (causas, herramientas, reglas, bucle de captura, prompt modelo, lista de verificación).
- Sistema de marca personal «Naranja señal» (sobrio y técnico, acento naranja sobre blanco/gris, para apps de gestión):
  `02-sistema-naranja-senal.md`, `tokens.css`, `muestra.html` (verificada en claro/oscuro, escritorio/móvil con Edge headless),
  `CLAUDE-diseno.md.plantilla` para pegar en cada proyecto.
- Lecciones L-075 (contraste del color de marca) y L-076 (captura móvil headless). Playwright falló (falta Chrome): ver `HERRAMIENTAS-Y-PLUGINS.md`.
- Prueba real en la pantalla Cocina del restaurante (probada y luego revertida: el repo del restaurante es solo de lectura; el ejemplo quedó en `09-diseno-visual/ejemplo-cocina/`): documentada en `02-sistema-naranja-senal.md`; lección L-077 (renumeradas: L-069 a L-071 ya las usaba otra sesión).
- Superdesign no se instaló (opcional, de pago); el sistema está validado solo en la muestra, aún no en un proyecto real.

## 2026-10-07 (laboratorios) — Plugins documentados y Lab 1
- Nuevo `01-fundamentos/HERRAMIENTAS-Y-PLUGINS.md`: inventario de plugins/skills instalados y cuándo usar cada uno por fase; enlazado desde README, guía y prompt inicial.
- Nueva carpeta `08-laboratorios/` con cuatro laboratorios (58 tests propios verdes): Lab 1 PostgreSQL 18 real y concurrencia (12), Lab 2 C# / .NET 8 por capas (13),
  Lab 3 respaldo/restauración y pipeline local (5; GitHub Actions y Docker escritos pero NO ejecutados), Lab 4 frontend e2e + axe + seguridad básica (28).
- Lecciones nuevas L-060 a L-073. Corregido el ejemplo numérico del prompt inicial ($3.376,35, no $3.375,35; L-063).
- Documentos marcados "validado en laboratorio": `03-base-de-datos/02` y `02-arquitectura/02` (solo C#).

## 2026-10-07 (noche, 2) — Contraste y accesibilidad ampliada
- Agustín subió `frontend/contraste` (AT-36 cerrado: contraste AA en toda la app); verificado (890 tests, build, 18 e2e dos veces).
- `chore/cierre-at36`: axe cubre también Cocina y las 8 pantallas de `/admin` (36 e2e, dos corridas verdes). Hallazgo AT-38: `<select>`
  sin etiqueta (Caja, Historial) y zonas con scroll no enfocables en móvil. Ramas apiladas: seis.
- Lección de proceso: la revisión manual del frontend (0 violaciones de contraste) no protegía las demás reglas ni las demás
  pantallas; ampliar la prueba automática encontró problemas nuevos (misma idea de L-059: lo que no se mide automáticamente se pierde).

## 2026-10-07 (noche) — Integración del frontend y cadena de ramas
- Agustín subió `frontend/ajustes-api` sobre `chore/calidad-pruebas`; se verificó (tsc, eslint, 889 tests, build, 18 e2e) antes de aceptarla.
- `chore/ajustes-finales` (commit `9c66cc3`): `release/` ignorado en ESLint, un solo formateador de pesos (`src/utils/dinero.ts`),
  contrato de Inventario sin el caso pendiente, `src/utils` en la zona de frontend. 890 tests.
- Cadena apilada `fix/revision-pr1` → `chore/calidad-pruebas` → `frontend/ajustes-api` → `chore/ajustes-finales`; se mezcla con
  merge commit (no squash). Regla de git para equipos con ramas apiladas: comprobar cada PR con `git merge-tree` y mezclar toda la cadena en una sesión.

## 2026-10-07 (tarde) — Plan de pruebas aplicado al proyecto de referencia
- Rama `chore/calidad-pruebas`, commit `af22d6d`, subida a GitHub con la unión `2d248da` que incorpora el commit `f3b1535` de Agus: tests rápidos/integración, cobertura con umbral
  (95,2 % líneas), CI escrito (no ejecutado en GitHub), e2e Playwright en escritorio y móvil (18 verdes), axe, propiedades
  (`fast-check`), mutación (Stryker, línea base 84,3 %), contrato de pantallas (24 tests). Suite de Vitest: 837 verdes.
- Hallazgos: AT-36 (accesibilidad del frontend), AT-37 (25 vulnerabilidades de dependencias, sin tocar); el contrato dejó
  explícito el pendiente de Inventario.
- Lecciones: L-059 (un test que pasa a la primera hay que romperlo; bordes exactos) y refuerzo de L-054 (el shell se come barras invertidas).
- Guía Fase 4 ampliada; `06-pruebas/02` con el estado aplicado; `05-.../codigo/pruebas/` con el código de ejemplo.

## 2026-10-07 — Pruebas, grafos y fuente única
- `06-pruebas/`: TESTING.md descargado (sin modificar) + contraste con los 799 tests del proyecto (medidos con
  `npx vitest run`: 21 archivos, todos verdes, 68 s), tensiones resueltas, recetas de pruebas de datos y plan de mejora
  (cobertura, e2e, CI y mutation testing no existen aún en el proyecto).
- `02-arquitectura/CLAUDE-arquitectura-base.md` reemplazado por `CLAUDE_1.md` (diferencia: §7 apunta a TESTING.md).
- `07-grafos/`: informes y grafos de graphify copiados (proyecto y lecciones, foto del 2026-10-06).
- Fuente única: `D:\BaseConocimiento\`. El `CLAUDE.md` global manda leerla al iniciar proyectos; `~/.claude/conocimiento/`
  quedó con avisos de mudanza. `SINCRONIZAR.md` reescrito.

## 2026-10-07 — Creación
- Estructura inicial (`01` a `05`).
- Copiados: lecciones L-001…L-058, guía de 7 fases, CLAUDE.md de arquitectura descargado (sin modificar), documentación
  y código de referencia del proyecto restaurante-san-andres (commit `b282e3c`).
- Nuevos: elección de base de datos, transacciones y atomicidad, ABM robusto, esquema/migraciones/respaldos,
  arquitectura backend por tecnología (C#, TypeScript, Python, Java, Go), diseño de API y seguridad, plantillas.
- Pendiente: validar con pruebas reales las recetas de PostgreSQL/SQL Server/MySQL y de otros lenguajes (ver README, "Brechas").
