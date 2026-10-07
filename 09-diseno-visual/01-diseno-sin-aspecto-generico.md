# Diseño visual: cómo lograr interfaces sin aspecto genérico con Claude Code

Fuentes: artículos de Superdesign (`how-to-make-claude-code-ui-look-good` y `claude-code-ui-design`; los dos enlaces
recibidos apuntaban al mismo artículo), el `SKILL.md` del plugin `frontend-design` instalado en este equipo y la
verificación hecha en esta sesión (capturas con Edge headless, 2026-10-07). Lo que no se probó aquí se marca *(sin probar)*.

## 1. Por qué la UI sale genérica (4 causas raíz)

| Causa | Qué significa | Contramedida |
|---|---|---|
| Sin ojos | Claude escribe código pero no ve el resultado | Renderizar y mirar una captura (§4) |
| Sin memoria de diseño | Cada sesión parte de cero y vuelve a los valores por defecto | Tokens + bloque de diseño en `CLAUDE.md` (§3) |
| Sin bucle de retroalimentación | Nadie compara con una referencia | Referencia visual real + bucle captura-compara-corrige |
| Valores seguros | Elige lo más probable: Inter, degradado violeta, tres tarjetas iguales | Prohibiciones explícitas y restricciones concretas |

## 2. Herramientas

| Herramienta | Estado en este equipo | Para qué |
|---|---|---|
| `frontend-design:frontend-design` (Anthropic) | **Instalada** (`~/.claude/plugins/.../frontend-design/SKILL.md`) | Obliga a planificar antes de codificar: tokens (4–6 colores con nombre, tipografías con rol, concepto de maquetación, principios), revisar el plan contra "¿esto lo haría para cualquier brief?", construir y autocriticarse |
| `dataviz` | **Instalada** | Gráficos y tableros con paleta validada y accesible |
| Plugin `playwright` | Instalado pero **falló** el 2026-10-07: pide Chrome en `C:\Users\Jose\AppData\Local\Google\Chrome\Application\chrome.exe` y no existe | Capturas. **Alternativa probada:** Edge headless (§4). Arreglo posible: `npx playwright install chrome` |
| Superdesign (`@superdesign/cli`, skill `superdesigndev/superdesign-skill`, comando `/superdesign`) | **No instalado** *(sin probar)*. Requiere `superdesign login`; gratis con límites, ~20 USD/mes completo | Biblioteca de +5.000 prompts/patrones de referencia, lienzo para explorar direcciones, sistema de diseño persistente |
| shadcn/ui | Depende del proyecto | Componentes base accesibles que se restilizan con los tokens (no usarlos "tal cual") |
| Context7 | Pendiente de conectar | Verificar la API vigente de una librería de UI antes de usarla |

**Decisión:** para esta base, el flujo mínimo es `frontend-design` + tokens propios (`tokens.css`) + captura. Superdesign
es opcional; solo vale la pena si se quiere explorar muchas direcciones visuales o necesitar referencias para pantallas nuevas.

## 3. Reglas (para pegar en el `CLAUDE.md` de cada proyecto: ver `CLAUDE-diseno.md.plantilla`)

1. **Operacional, no aspiracional.** "Moderno y limpio" no dice nada. Decir: fuente exacta, un acento, ritmo de 8 px,
   filas de tabla de 32 px, cifras con `tabular-nums`, sin sombras.
2. **Prohibir por nombre lo que delata a la IA:** Inter/Roboto/Arial por defecto, degradado violeta, fila de tres tarjetas
   idénticas, mismo radio y misma sombra gris en todo, mayúsculas espaciadas sobre cada título, "A · B · C" con puntos
   medios, "→" al final de cada enlace, numeración 01/02/03 donde el contenido no es una secuencia, resaltar una sola
   palabra del titular, entradas con fundido-y-deslizamiento en cada sección.
3. **Dos pasadas:** primero el plan de tokens y la maquetación (en palabras o con un esquema ASCII); revisarlo; recién
   después código. Si una parte "la haría igual para cualquier pantalla parecida", cambiarla y decir por qué.
4. **Gastar la audacia en un solo lugar.** Un elemento memorable; el resto, callado. (Aquí: la barra naranja de 4 px.)
5. **La estructura es información.** Bordes, divisores y etiquetas deben codificar algo (seleccionado, estado, secuencia), no decorar.
6. **Jerarquía por contraste de peso y tamaño** (pesos extremos 300 vs 700; saltos de tamaño de ~1,5–2,5×), no por sombras.
7. **Textos de interfaz:** voz activa, el botón dice lo que hace ("Registrar cobro", no "Enviar"), el mismo nombre en todo el
   flujo (botón "Publicar" → aviso "Publicado"), los errores dicen qué pasó y cómo arreglarlo, el vacío invita a actuar.
8. **Piso de calidad sin anunciarlo:** adaptable a móvil, foco visible, `prefers-reduced-motion`, contraste AA, estados
   vacío/cargando/error siempre presentes.
9. **Para UI densa (tableros, tablas) pedir una referencia concreta**; sin ella el resultado vuelve a lo genérico.

## 4. Bucle de verificación visual (probado)

Renderizar → capturar → mirar → corregir con observaciones concretas ("el relleno de la tarjeta es irregular", no "mejóralo") → 2–3 vueltas.

Captura sin Playwright, en Windows (probado el 2026-10-07):

```powershell
$e = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
& $e --headless=new --disable-gpu --window-size=1280,900 --screenshot="$env:TEMP\escritorio.png" "file:///D:/ruta/pagina.html"
```

Notas aprendidas: (a) Edge headless tiene un **ancho mínimo ~500 px**; con `--window-size=390` la captura recorta y parece
desbordar: probar el móvil a 500; (b) el modo oscuro/claro lo decide el sistema: para ver el otro, fijar `data-tema` en `<html>`;
(c) si las tipografías de Google Fonts no cargan (sin red), la captura usa la de reserva: comprobar con red antes de juzgar la letra.

## 5. Prompt modelo (probado en la muestra)

> Construye la pantalla de Caja. Sistema: `09-diseno-visual/tokens.css` (Naranja señal). Restricciones: un acento,
> ritmo 8 px, filas de 32 px, cifras tabulares, sin sombras, un solo radio. Sin héroe, sin degradados, sin tarjetas decorativas.
> Incluye estados vacío, cargando y error, y cómo se reacomoda en móvil. Captura el resultado y compáralo con `muestra.html`.

## 6. Lista de verificación antes de dar por buena una pantalla

- [ ] Usa solo tokens (`var(--…)`); ningún hex suelto en componentes.
- [ ] Un solo acento; los colores de estado aparecen solo donde significan algo.
- [ ] Sin ninguna de las marcas de §3.2.
- [ ] Contraste AA medido (no a ojo) y foco visible con teclado.
- [ ] Estados vacío, cargando y error diseñados.
- [ ] Captura revisada en escritorio y móvil, claro y oscuro.
- [ ] Textos: verbos concretos, mismo nombre en todo el flujo.
- [ ] Si el proyecto tiene axe/Playwright, la prueba de accesibilidad sigue verde (L-059: lo que no se mide se pierde).
