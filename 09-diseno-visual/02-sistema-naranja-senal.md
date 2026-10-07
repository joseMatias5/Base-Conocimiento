# Sistema de diseño personal: «Naranja señal»

Marca visual propia para **apps de gestión y paneles** (tablas, formularios, tableros). Elegida el 2026-10-07 con el
usuario: sensación **sobria y técnica**, acento **naranja** sobre **blanco y gris**. Implementación: `tokens.css`;
ejemplo vivo: `muestra.html` (verificado en claro, oscuro, escritorio y móvil).

## Idea en una frase

Una herramienta de trabajo precisa en grises de grafito, con **una sola señal naranja** que marca lo que importa: dónde estás,
qué está seleccionado, cuál es la acción principal.

## Decisiones y por qué

| Eje | Decisión | Razón |
|---|---|---|
| Neutros | Grafito **frío** (`#F4F5F6` fondo, `#FFFFFF` papel, `#16181D` tinta) | El naranja destaca más sobre gris frío; evita el crema cálido que el skill señala como tic de la IA |
| Acento | `#E8590C` (relleno) y `#C2410C` (texto/enlace) | **No** es el terracota `#D97757` (acento de Anthropic: delata origen). Más saturado y rojizo → "señal" |
| Texto sobre acento | **Tinta** `#16181D` (5,0:1), no blanco (3,6:1, no pasa AA) | Medido: blanco sobre `#E8590C` falla en texto pequeño |
| Tipografía | IBM Plex Sans (300 / 400 / 500 / 700) + Plex Mono solo para códigos/IDs | Carácter técnico y legible, no es Inter. Cifras con `tabular-nums` en la propia sans (la mono para etiquetas es un tic) |
| Jerarquía | Título de pantalla 40 px **peso 300**, secciones 24 px peso 500, tabla 14 px | Contraste de peso y salto de tamaño en vez de sombras |
| Forma | Un radio (4 px), bordes de 1 px, **sin sombras** | Sobriedad; la jerarquía la dan fondo y borde |
| Densidad | Filas de 32 px, ritmo de 8 px | Paneles con muchos datos |
| **Elemento memorable** | **Barra naranja de 4 px a la izquierda** de lo actual/seleccionado (ítem de menú, fila, cifra principal) | Codifica información ("aquí estás") y es la firma; el resto se queda callado |
| Estados | Verde `#1F7A4D`, ámbar `#8A5A00`, rojo `#B42318` solo como texto de estado | No compiten con el naranja; en oscuro se aclaran |
| Oscuro | Mismas reglas, acento `#FF7A2F` sobre `#101216`/`#1A1D23` | Contrastes medidos (tinta 15:1, acento 7:1) |

## Contrastes medidos (WCAG)

| Par | Razón | Uso |
|---|---|---|
| Tinta / papel | 17,8 | Texto principal |
| Apagado `#5B616B` / papel | 6,2 | Texto secundario |
| Acento-texto `#C2410C` / papel | 5,2 | Enlaces |
| Tinta / acento `#E8590C` | 5,0 | Botón primario |
| Acento-tinta `#9A3412` / acento-suave `#FFEDD5` | 6,4 | Fila seleccionada |
| Acento oscuro `#FF7A2F` / `#101216` | 7,2 | Modo oscuro |

Regla: **nunca texto blanco sobre `--acento`**; si se necesita blanco, usar `--acento-texto` como fondo (5,2:1).

## Cómo usarlo en un proyecto

1. Copiar `tokens.css` a `src/styles/` e importarlo primero.
2. Pegar el contenido de `CLAUDE-diseno.md.plantilla` en el `CLAUDE.md` del proyecto.
3. Cargar IBM Plex desde Google Fonts o, mejor, autoalojarla (sin dependencia externa en producción).
4. Pedir pantallas con el prompt de `01-diseno-sin-aspecto-generico.md` §5 y verificar con §4 y §6.
5. Con shadcn/ui: mapear sus variables a estos tokens y no dejar el tema por defecto.

## Cómo evoluciona (perfeccionarlo)

Es un **punto de partida v1**, no un sello cerrado. Cada proyecto debe devolver aquí lo aprendido:
qué tokens faltaron (p. ej. gráficos: usar la skill `dataviz` con el naranja como primer color), qué se vio mal en una
captura real, qué parte se sintió genérica. Registrar cada cambio en el `CHANGELOG.md` y la lección en `LECCIONES-APRENDIDAS.md`.

Pendientes conocidos: logotipo/monograma; escala para gráficos; componentes de formulario más completos (fechas, tabs,
diálogos); probar la marca en un proyecto real (hoy solo está validada en la muestra); decidir si se autoaloja la tipografía.
