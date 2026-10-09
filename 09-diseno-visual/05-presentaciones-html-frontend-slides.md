# Presentaciones en HTML con el skill `frontend-slides`

**Fuentes:** artículo de Webreactiva (<https://www.webreactiva.com/blog/skill-frontend-slides>) y, para contrastarlo, el repo real
<https://github.com/zarazhangrui/frontend-slides> (autora: Zara Zhang; MIT; ~30 000 estrellas; último push 2026-06-23; leí `SKILL.md` y `viewport-base.css`). Revisado el 2026-10-09.

## Veredicto: útil, pero secundario para esta base
- **Sí aporta** si hace falta una presentación (propuesta a un cliente, entrega de un proyecto, charla): un solo `.html`, sin npm ni build, funciona offline y se ve con la identidad de marca.
- **No aporta** al núcleo de la base (apps robustas con datos): no es una lección de backend ni de pruebas.
- **No lo instalé** (no está en `HERRAMIENTAS-Y-PLUGINS.md`): es un skill de terceros que ejecuta scripts (despliegue a Vercel, exportación a PDF). Si se instala, leer `SKILL.md` y `scripts/` primero y hacerlo a propósito. Para decks que se entregan como archivo, el flujo ya disponible (Artifact tipo slides o skill `pptx`) cubre el caso sin dependencias nuevas.

## Qué hace
Skill para Claude Code (`/frontend-slides`) que genera una presentación en **un único HTML autocontenido**. Tres modos: crear desde cero, convertir un `.pptx` (con `python-pptx`; extrae textos, imágenes y notas) y mejorar un HTML existente.
Flujo: 5 preguntas de descubrimiento (propósito, cantidad de slides, estado del contenido, imágenes, edición en línea) → elegir estilo mirando **3 previsualizaciones HTML reales** (por sensación: impresionado, energizado, calmado, inspirado) o un preset por nombre → generación. 12 presets (Bold Signal, Neon Cyber, Terminal Green, Paper & Ink, Swiss Modern, Dark Botanical, etc.).
Instalación: `npx skills add https://github.com/zarazhangrui/frontend-slides --skill frontend-slides` o copiar `SKILL.md` y `STYLE_PRESETS.md` a `~/.claude/skills/frontend-slides/`.

## El artículo está desactualizado respecto al repo (aprendizaje de contraste)
| Tema | Artículo | Repo actual (leído) |
|---|---|---|
| Tamaño de slide | cada slide = una pantalla, `clamp()` y `100dvh`, reflujo por dispositivo | **Escenario fijo 16:9 de 1920×1080 escalado entero** (`transform: scale`), sin re-maquetar; puede tener bandas |
| Exportación | «no menciona PDF/PPTX» | El `SKILL.md` documenta **exportar a PDF** y **desplegar a Vercel** con scripts, e impresión `@media print` con una slide por página |
| Imágenes | — | Deben viajar con el HTML (rutas relativas; evitar espacios en nombres) |

Lección general: **para una herramienta que cambia rápido, el artículo es una foto vieja; contrastar con el repo antes de documentar.**

## Ideas transferibles a cualquier pantalla (alineadas con `01` y `02` de esta carpeta)
1. **Elegir mirando, no describiendo:** generar 3 variantes reales y que el usuario reaccione. Es el bucle de `01-diseno-sin-aspecto-generico.md` aplicado al estilo.
2. **Anti «AI slop» explícito:** el skill prohíbe fuentes genéricas (Inter, Arial, Roboto) y el gradiente morado sobre blanco, y avisa que el modelo converge en las mismas elecciones (p. ej. Space Grotesk): hay que **forzar variación entre generaciones**.
3. **Variables en `:root`:** colores, tipografía y tiempos agrupados para cambiar la identidad en un punto (coincide con `tokens.css`).
4. **Animación barata y respetuosa:** solo `transform` y `opacity`, Intersection Observer con retardo escalonado y `prefers-reduced-motion` respetado.
5. **Trampas de CSS concretas** (verificadas en el `SKILL.md`):
   - Nunca negar una función CSS directamente: `-clamp()`, `-min()`, `-max()` se **ignoran en silencio**; usar `calc(-1 * clamp(...))`.
   - No alternar `display: none/block` para mostrar/ocultar vistas: una clase posterior (`display: flex`) lo pisa y se ven todas a la vez. Usar `visibility` + `opacity` + `pointer-events` con una clase de estado.
6. **Límites de contenido por slide** (título; 4–6 viñetas o 2 párrafos; ≤ 8–10 líneas de código; cita de ≤ 3 líneas): si no cabe, **dividir**, no encoger.
7. **Que no se filtre el andamiaje a la salida:** prohibido renderizar etiquetas internas («Option A», nombres de preset, notas del pedido) dentro del diseño. Revisar capturas buscando texto de proceso.
8. **Dependencias son deuda:** «un HTML único funcionará dentro de 10 años». Útil como criterio para entregables estáticos.

## Límites
No sirve para gráficos interactivos complejos ni datos en tiempo real; accesibilidad parcial (movimiento reducido, sin revisión de contraste ni lectores de pantalla): si el deck lleva la marca «Naranja señal», validar contraste como en `02` (L-075). No lo probé generando un deck: este documento se basa en leer el artículo y el código del skill.
