# Recursos visuales curados (colores, tipografía, íconos, ilustraciones, imágenes, herramientas CSS)

**Para qué sirve:** cuando una pantalla necesita un ícono, una fuente, una paleta, una imagen o una herramienta de ayuda, elegir de aquí
en vez de improvisar o dejar que el modelo invente. Complementa `02-sistema-naranja-senal.md` (la marca) con **dónde conseguir las piezas**.

**Fuentes:** `yurimutti/recursos-frontend` (la mayor parte, ~400 enlaces en portugués, sin actualizar hace tiempo),
`vanessamarely/recursos-frontend` y `requestly/awesome-frontend-resources` (sobre todo aprendizaje: ver `04-recursos-aprendizaje-frontend.md`).
Revisados el 2026-10-09.

> **Estado de los enlaces (probados el 2026-10-09 con un script):** de 182 enlaces, la mayoría responde; los que respondían 403/401 son bloqueos a bots (sitios vivos). Se quitaron los que no existen (commercecream.com, acefrontend.com, free-css.com no resuelve) y se corrigieron cssmatic y drawkit. No se puede garantizar el contenido de cada página.
> Marqué con ⚠ lo que sé (por conocimiento general, no por prueba) que cambió o murió. Antes de depender de un recurso, abrirlo.
> Lo no marcado se conserva porque es estable (estándares, MDN, bibliotecas muy usadas), no porque lo haya comprobado hoy.

## Reglas de uso (lo que importa más que la lista)

1. **Licencia antes que belleza.** Un recurso "gratis" puede exigir atribución o prohibir uso comercial. Preferir MIT/CC0/OFL y anotar la licencia en el proyecto.
   Las apps de gestión del usuario son comerciales: «gratis para uso personal» **no** alcanza.
2. **Un solo set de íconos por proyecto.** Mezclar sets rompe el trazo y el peso visual (síntoma de UI genérica; ver `01-diseno-sin-aspecto-generico.md`).
3. **Fuentes: autoalojar** (descargar WOFF2 y servir desde el proyecto) en vez de enlazar a un CDN externo: mejor rendimiento, privacidad y la app funciona sin red (relevante para un POS local).
4. **Íconos como SVG inline o componentes**, nunca emoji ni fuentes de íconos (no heredan bien `currentColor` y fallan en accesibilidad). Todo ícono solo-ícono lleva `aria-label`.
5. **Contraste:** verificar toda combinación de color con un comprobador (abajo) — norma AA 4.5:1 texto normal, 3:1 texto grande/UI. Ya costó una lección (L-075).
6. **Imágenes:** comprimir y usar formatos modernos (WebP/AVIF) antes de subirlas; definir `width`/`height` para evitar saltos de maquetación.
7. **No dejar servicios de placeholder en producción** (hotlinking de imágenes de terceros): se caen y filtran visitas.

## Íconos (elegir **uno**)

| Set | Licencia | Notas |
|---|---|---|
| [Lucide](https://lucide.dev/) | ISC | **Recomendado por defecto.** Paquetes oficiales para React/Vue/Svelte/Angular, tree-shaking, trazo consistente. |
| [Tabler Icons](https://tablericons.com/) | MIT | ~1.200+ íconos, trazo personalizable; mejor cobertura para apps de gestión (facturas, mesas, impresoras). |
| [Heroicons](https://heroicons.com/) | MIT | Del equipo de Tailwind; encaja con Tailwind. (el enlace del repo origen `heroicons.dev` es antiguo) |
| [Phosphor](https://phosphoricons.com/) | MIT | Alternativa con 6 pesos por ícono (no estaba en los repos; agregada por conocimiento general). |
| [Radix Icons](https://icons.radix-ui.com/) | MIT | 15×15, sobrios; solo si ya se usa Radix. ⚠ el repo cita `icons.modulz.app` (dominio viejo). |
| [Feather](https://feathericons.com/) | MIT | Base original de Lucide; Lucide es su continuación activa. |
| [Remix Icon](https://remixicon.com/), [Boxicons](https://boxicons.com/), [Ionicons](https://ionicons.com/), [Eva](https://akveo.github.io/eva-icons/) | mayormente libres | Válidos; revisar licencia de cada uno. |
| [Simple Icons](https://simpleicons.org/) | CC0 | Logotipos de marcas (medios de pago, redes) en SVG monocromo. |
| [SVGOMG / SVGO](https://jakearchibald.github.io/svgomg/) | — | Optimiza SVG antes de incrustar (no figura en los repos; recomendado). |

Utilidades: [Real Favicon Generator](https://realfavicongenerator.net) (todos los tamaños de favicon/iconos de app), [SVG→JSX](https://svg2jsx.com/), [Transform Tools](https://transform.tools/) (conversor poliglota).
**Cuidado:** Flaticon, Freepik, Icons8, Iconfinder, Noun Project suelen exigir **atribución** o plan de pago para uso comercial sin crédito; no usarlos sin leer la licencia por ícono. Font Awesome Free es válido pero el set gratis es limitado.

## Tipografía

- **Fuentes:** [Google Fonts](https://fonts.google.com) (la mayoría bajo OFL; descargar y autoalojar), [Fontsource](https://fontsource.org/) (paquetes npm para autoalojar; agregado por conocimiento general), [FontSquirrel](https://www.fontsquirrel.com) (licencia comercial verificada a mano), [Fonts In Use](https://fontsinuse.com/) (ver cómo se usan en diseño real).
- **Pares y criterio:** [FontPair](https://fontpair.co), [Font Combinations (Canva)](https://www.canva.com/font-combinations).
- **Sin cargar nada:** [System Font Stack](https://systemfontstack.com/) y [CSS Font Stack](https://www.cssfontstack.com) — válido para apps internas donde el rendimiento pesa más que la identidad.
- **Escala tipográfica:** [Modular Scale](https://www.modularscale.com) (razón entre tamaños; coherente con los tokens `--text-*` de `tokens.css`), [CSS Typeset](http://csstypeset.com/index.htm) para probar interlineado/medida.
- **Conversión a web:** [Transfonter](https://transfonter.org) (TTF/OTF → WOFF2 + `@font-face`).
- Adobe Fonts exige suscripción Creative Cloud: no apto para entregar a un cliente sin su licencia.

## Color y contraste

| Necesidad | Herramienta |
|---|---|
| Paleta desde cero / inspiración | [Coolors](https://coolors.co), [Color Hunt](https://colorhunt.co), [Adobe Color](https://color.adobe.com), [Paletton](http://paletton.com) |
| **Escala 50–950 estilo Tailwind desde un color de marca** | [UI Colors](https://uicolors.app/) (exporta JSON/SCSS/SVG) — la más útil para derivar tokens |
| Aclarar/oscurecer, tonos y sombras | [0to255](https://www.0to255.com), [Tint & Shade Generator](https://maketintsandshades.com), [ColorKit](https://colorkit.io) |
| **Contraste WCAG** | [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/), [Contrast Ratio](https://contrast-ratio.com), [Color.review](https://color.review) |
| Nombre de un color | [Name that Color](https://chir.ag/projects/name-that-color/) |
| Gradientes | [CSS Gradient](https://cssgradient.io), [uiGradients](https://uigradients.com), [ColorZilla](https://www.colorzilla.com) |
| Paletas de marcas conocidas | [Brand Palettes](https://brandpalettes.com) |
| Extraer colores de un sitio | extensión Site Palette / ColorZilla |

Regla de la base: el color de marca (naranja) debe pasar contraste como texto **y** como fondo del texto del botón; derivar la escala completa con UI Colors y validar cada par, no solo el 500.

## CSS: referencia y generadores

- **Compatibilidad:** [Can I Use](https://caniuse.com) (consultar antes de usar una propiedad nueva), [MDN CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference).
- **Layout:** [CSS Layout](https://csslayout.io/) (patrones sin framework), [How To Center](http://howtocenterincss.com), [Flexbox Froggy](https://flexboxfroggy.com) y [Grid Garden](https://cssgridgarden.com) (aprendizaje), [Echoplex Flexbox](https://the-echoplex.net/flexyboxes/).
- **Especificidad:** [Specificity Calculator](https://specificity.keegan.st) — para depurar "mi estilo no se aplica".
- **Animación:** [Animate.css](https://animate.style), [Animista](https://animista.net), [Easings.net](https://easings.net), [Cubic Bezier](https://cubic-bezier.com). Respetar `prefers-reduced-motion`.
- **Formas/fondos SVG:** [Shape Divider](https://www.shapedivider.app), [Get Waves](https://getwaves.io), [Blob Maker](https://www.blobmaker.app), [Haikei](https://app.haikei.app/), [Fancy Border Radius](https://9elements.github.io/fancy-border-radius/), [Clippy](https://bennettfeely.com/clippy/) (clip-path).
- **Sombras/bordes:** [CSSmatic](https://www.cssmatic.com/). Para esta base, preferir los tokens de sombra de `tokens.css` en lugar de sombras generadas ad hoc.
- **Calidad:** [W3C CSS Validator](https://jigsaw.w3.org/css-validator), [W3C HTML Validator](https://validator.w3.org), [Autoprefixer](https://autoprefixer.github.io) (hoy ya incluido en los bundlers modernos).
- Evitar copiar CSS de generadores sin entenderlo: suele traer prefijos y valores obsoletos.

## Ilustraciones y estados vacíos

Útiles para estados vacíos, errores 404/500 y onboarding (no para pantallas operativas densas). Preferir los de licencia clara:

- **Licencia libre / comercial sin atribución (según el sitio, verificar):** [unDraw](https://undraw.co/illustrations) (color de marca editable → encaja con los tokens), [Open Doodles](https://www.opendoodles.com/), [Open Peeps](https://www.openpeeps.com/), [Humaaans](https://www.humaaans.com/), [Mega Doodles Pack](https://github.com/MariaLetta/mega-doodles-pack), [Illustrations.co](https://illlustrations.co/), [Storyset](https://storyset.com) (pide atribución en plan gratis), [Blush](https://blush.design/), [DrawKit](https://www.drawkit.com/), [Lukasz Adam](https://lukaszadam.com/illustrations) (CC0), [Absurd Design](https://absurd.design/), [Manypixels](https://www.manypixels.co/gallery/), [Control](https://control.rocks).
- **404:** [404 illustrations (Kapwing)](https://www.kapwing.com/404-illustrations), [error404.fun](https://error404.fun/).
- **Generar:** [Blobmaker](https://www.blobmaker.app/), [Get Waves](https://getwaves.io).
- Criterio: una sola familia de ilustración por proyecto, recolorear con el color de marca, optimizar el SVG. En apps de gestión del estilo «Naranja señal» (sobrio, técnico) las ilustraciones cartoon de personajes suelen desentonar; usar formas simples o ninguna.

## Imágenes (fotos, fondos, compresión)

- **Bancos con licencia permisiva:** [Unsplash](https://unsplash.com), [Pexels](https://www.pexels.com), [Pixabay](https://pixabay.com), [StockSnap](https://stocksnap.io), [Kaboompics](https://kaboompics.com), [Gratisography](https://www.gratisography.com), [Burst](https://burst.shopify.com) (agregado), [Openverse](https://openverse.org) (⚠ el repo cita "CC Search", hoy renombrado Openverse). Fotos de comida: [Foodiesfeed](https://www.foodiesfeed.com).
- **Evitar:** 123RF, Shutterstock, Fotolia (⚠ cerrado), Envato, PhotoDune, Death to Stock — son de pago aunque el repo los liste. Sitios de "PNG transparentes" (CleanPNG, PNGTree, StickPNG, PNGAll, GratisPNG) mezclan material con derechos de terceros: no usarlos en producto comercial.
- **Compresión y formatos:** [Squoosh](https://squoosh.app/) (recomendado, WebP/AVIF local), [TinyPNG](https://tinypng.com/), [Responsive Breakpoints](https://www.responsivebreakpoints.com/) (generar `srcset`).
- **Edición:** [Photopea](https://www.photopea.com/), [Canva](https://www.canva.com/); **quitar fondo:** [remove.bg](https://www.remove.bg) (⚠ es de pago por resolución completa), [Clipping Magic](https://clippingmagic.com).
- **Placeholder:** ⚠ Lorempixel y Placekitten están muertos o inestables; usar [Picsum](https://picsum.photos/) (agregado) solo en desarrollo, o generar un SVG/gris propio.

## Prototipado, UI kits, sistemas de diseño

- **Prototipado:** [Figma](https://www.figma.com/) (estándar). ⚠ Adobe XD ya no se desarrolla activamente y InVision cerró en 2024 (por conocimiento general); no basar nada nuevo en ellos. Alternativas libres: [Penpot](https://penpot.app/) (agregado).
- **UI kits gratis:** [Figma Freebies](https://figmafreebies.com), [Freebie Supply](https://freebiesupply.com), [Uplabs](https://uplabs.com), Sketch Repo (solo si se usa Sketch).
- **Sistemas de diseño de referencia:** [Design Systems Surf](https://designsystems.surf/design-systems) (catálogo). Para estudiar uno completo: Material, Carbon, Polaris, Primer (agregados; no estaban en los repos). Componentes sin estilo y accesibles recomendados para estas apps: Radix UI / shadcn/ui (este último sí aparece como proyecto destacado en `requestly`).
- **Plantillas HTML/CSS:** [HTML5 UP](https://html5up.net/), [Templatemo](https://templatemo.com/), [Bootswatch](https://bootswatch.com/). Son para landing pages, **no** para apps de gestión; no copiar sin revisar accesibilidad.

## Inspiración (para el bucle «mirar referencias → decidir», no para copiar)

[Awwwards](https://www.awwwards.com/), [Land-book](https://land-book.com), [Lapa Ninja](https://www.lapa.ninja/), [One Page Love](https://onepagelove.com/), [CSS Nectar](https://cssnectar.com), [Httpster](https://httpster.net), [Best Website Gallery](https://bestwebsite.gallery), [Collect UI](https://collectui.com), [Dribbble](https://dribbble.com), [Abduzeedo](https://abduzeedo.com), [ecomm.design](https://ecomm.design/) (comercio). Casi todas son de landing pages y marketing; para **paneles y apps de gestión** buscar con términos "dashboard", "admin", "POS", "kitchen display" (en Dribbble/Behance) y guardar 3 referencias en el proyecto antes de diseñar (ver el bucle en `01-diseno-sin-aspecto-generico.md`).

## Rendimiento y accesibilidad (herramientas)

| Qué | Herramienta |
|---|---|
| Rendimiento | [PageSpeed Insights](https://pagespeed.web.dev/), [WebPageTest](https://www.webpagetest.org), [GTmetrix](https://gtmetrix.com), Lighthouse (en DevTools) |
| Análisis de imágenes | [Cloudinary Image Analysis](https://webspeedtest.cloudinary.com) |
| Accesibilidad | extensión [axe DevTools](https://www.deque.com/axe/) (el proyecto ya usa axe en los e2e), [WAVE](https://wave.webaim.org/), [WebAIM Contrast Checker](https://webaim.org/resources/contrastchecker/) |
| Responsive | [BrowserStack Responsive](https://www.browserstack.com/responsive), DevTools modo dispositivo |
| Minificar | cssnano, CSSO, html-minifier (los bundlers modernos ya lo hacen; manual solo para casos sueltos) |
| Extensiones de navegador útiles | WhatFont / Fonts Ninja (identificar tipografía), Page Ruler (medir), GoFullPage (captura completa; útil para el bucle de capturas), JSON Viewer, Wappalyzer |

## Bibliotecas JavaScript de interfaz (decisión rápida)

| Necesidad | Opción razonable | Evitar |
|---|---|---|
| Animación | [Motion](https://motion.dev)/GSAP (⚠ GSAP cambió de licencia; revisar), [anime.js](https://animejs.com) | Velocity, Skrollr, Wow.js, Waypoints (abandonados) |
| Carrusel | [Swiper](https://swiperjs.com) | Owl Carousel, Slick (dependen de jQuery) |
| Fechas | [date-fns](https://date-fns.org/), `Temporal` cuando esté disponible | ⚠ Moment.js (en modo mantenimiento, pesado) |
| Dinero | [Dinero.js](https://dinerojs.com/) o enteros en centavos (ver regla de dinero en `LECCIONES-APRENDIDAS.md`) | `number` con decimales |
| Scroll/parallax | CSS (`scroll-timeline`, `position: sticky`) primero | Rellax, ScrollMagic, Parallax.js salvo caso justificado |
| 3D | [Three.js](https://threejs.org) | — |
| Capturas de código para docs | [Carbon](https://carbon.now.sh), [Ray.so](https://ray.so) | — |
| Regex | [Regex101](https://regex101.com) | — |
| Alternativa a jQuery | [You Might Not Need jQuery](http://youmightnotneedjquery.com/) | jQuery en proyecto nuevo |

## Hospedaje del frontend (resumen; despliegue es una brecha de la base)

Opciones con plan gratuito vigente según el repo: GitHub Pages, Cloudflare Pages, Netlify, Vercel, Render, Railway, Fly.io. ⚠ Heroku ya no tiene plan gratuito y 000webhost/InfinityFree son de calidad dudosa: no usar para algo de un cliente. Para una app con base de datos local (como el restaurante) esto no aplica; el despliegue real sigue sin cubrir (ver README, «Brechas»).

## Qué hacer con esto en un proyecto

1. En el `CLAUDE.md` de diseño del proyecto (`CLAUDE-diseno.md.plantilla`) fijar: **set de íconos elegido**, **fuentes (autoalojadas)** y **fuente de imágenes/ilustraciones con su licencia**.
2. Derivar la escala de color de la marca con UI Colors y validar contraste con WebAIM antes de escribir los tokens.
3. Registrar cada recurso externo usado (nombre, URL, licencia) en `docs/` del proyecto.
