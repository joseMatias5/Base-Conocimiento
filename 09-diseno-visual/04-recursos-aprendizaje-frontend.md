# Recursos de aprendizaje y referencia de frontend

**Fuentes:** `vanessamarely/recursos-frontend` (español/inglés, orientado a quien aprende), `requestly/awesome-frontend-resources` (inglés, rutas y cursos) y la sección de desafíos/JS de `yurimutti/recursos-frontend`. Revisados el 2026-10-09.
Para recursos visuales (íconos, fuentes, colores, imágenes) ver `03-recursos-visuales-curados.md`.

> **Estado:** enlaces tomados de los repos; probados con un script el 2026-10-09 (los muertos se quitaron). Lo marcado ⚠ es una advertencia por conocimiento general.
> Esta lista es para **consultar** (referencia que Claude y el usuario pueden abrir), no para memorizar. La regla: **documentación oficial y MDN primero**, tutoriales de terceros después.

## Referencias canónicas (consultar antes de adivinar)

| Tema | Fuente |
|---|---|
| HTML / CSS / JS / Web APIs | [MDN](https://developer.mozilla.org/es/) (hay versión en español), [web.dev/learn](https://web.dev/learn/) (CSS, responsive, PWA, accesibilidad) |
| JavaScript explicado a fondo | [javascript.info](https://es.javascript.info/), [You Don't Know JS Yet](https://github.com/getify/You-Dont-Know-JS), [Eloquent JavaScript](https://eloquentjavascript.net/) |
| TypeScript | [The TypeScript Handbook](https://www.typescriptlang.org/docs/handbook/intro.html) |
| React | [react.dev](https://react.dev/reference/react) (⚠ el repo en español enlaza `es.reactjs.org`, el sitio antiguo) |
| Vue / Angular / Node | [vuejs.org](https://vuejs.org/guide/introduction.html), [angular.dev](https://angular.dev/overview), [nodejs.org](https://nodejs.org/docs/latest/api/) |
| Compatibilidad entre navegadores | [Can I Use](https://caniuse.com) |
| Patrones de diseño | [Refactoring.guru](https://refactoring.guru/es/design-patterns), [patterns.dev](https://www.patterns.dev/), [JavaScript Patterns (Lydia Hallie)](https://javascriptpatterns.vercel.app/patterns) |
| Buenas prácticas Node | [nodebestpractices](https://github.com/goldbergyoni/nodebestpractices) (relevante para el backend TypeScript de la base) |
| Código limpio en JS | [clean-code-javascript](https://github.com/ryanmcdermott/clean-code-javascript) (versión en español: `andersontr15/clean-code-javascript-es`) |
| Accesibilidad | [WebAIM](https://webaim.org/), [WAVE](https://wave.webaim.org/), guías WCAG |
| PWA / Service Workers | [web.dev/learn/pwa](https://web.dev/learn/pwa/), [Service Workies](https://serviceworkies.com/) |
| Cheatsheets | [Emmet](https://docs.emmet.io/cheat-sheet/), [DevDocs](https://devdocs.io/) (referencia offline de HTML/CSS/JS), [Frontend Checklist](https://frontendchecklist.io/) (lista de verificación previa a publicar) |

## Rutas y mapas de aprendizaje (para saber qué falta saber)

- [roadmap.sh](https://roadmap.sh/frontend): rutas por rol y tecnología (Frontend, Full Stack, JavaScript, TypeScript, React, Vue, Angular, Node.js, **Software Design & Architecture**, **Code Review**, Data Structures, Android, iOS, Flutter). Los dos últimos de ingeniería se alinean con lo que cubre `02-arquitectura/` y el skill `code-review`.
- Uso en esta base: contrastar el stack de un proyecto contra el roadmap correspondiente para detectar temas no cubiertos (la base declara en el README que tiene pocas lecciones de frontend).

## Práctica y desafíos

- **Proyectos con diseño real:** [Frontend Mentor](https://www.frontendmentor.io/), [Codewell](https://www.codewell.cc/), [Front-end Challenges](https://github.com/felipefialho/frontend-challenges).
- **CSS:** [CSSBattle](https://cssbattle.dev), [30 days CSS](https://30dayscss.vercel.app/challengesList), CSS Diner, Flexbox Froggy / Defense / Zombies, Grid Garden.
- **JavaScript:** [JavaScript30](https://javascript30.com/), [Exercism](https://exercism.org/tracks/javascript), [JSchallenger](https://www.jschallenger.com/), [javascript-questions](https://github.com/lydiahallie/javascript-questions).
- **Ideas de proyectos:** [App Ideas](https://github.com/florinpop17/app-ideas), [50projects50days](https://github.com/bradtraversy/50projects50days), 40 proyectos JS (freeCodeCamp en español).
- **Cursos completos gratuitos:** [freeCodeCamp](https://www.freecodecamp.org/espanol/learn/), [The Odin Project](https://www.theodinproject.com/), [Full Stack Open](https://fullstackopen.com/en/) (Universidad de Helsinki: React, Node, TypeScript, GraphQL, **testing** — alineado con `06-pruebas/`), [Web Dev for Beginners (Microsoft)](https://github.com/microsoft/Web-Dev-For-Beginners).

## Libros gratuitos y listas

[free-programming-books](https://github.com/EbookFoundation/free-programming-books) (índice enorme por idioma), [Pro Git](https://git-scm.com/book/es/v2), You Don't Know JS Yet, Eloquent JavaScript, [Mostly Adequate Guide to Functional Programming](https://mostly-adequate.gitbook.io/mostly-adequate-guide), [97 Things Every Programmer Should Know](https://97-things-every-x-should-know.gitbooks.io/97-things-every-programmer-should-know/content/en/). En español: «JavaScript, ¡Inspírate!» (Leanpub), «Cómo ser front-end sin fallar en el intento».

## Creadores y canales en español (para sugerirle al usuario)

Lenguaje CSS / Lenguaje HTML / Lenguaje JS (Manz), MiduDev, Jonathan MirCha, HolaMundo (Nicolás Schurmann), Carlos Azaustre, freeCodeCamp Español, Dominicode (TypeScript), Majo Ledesma (apuntes en PDF). En inglés: Traversy Media, Academind, Programming with Mosh, Fireship (agregado), Codevolution (React Native).

## Comunidades

dev.to, r/Frontend, r/learnjavascript, r/javascript. Para ver proyectos open source de referencia en UI: **Storybook** (desarrollar componentes aislados, relevante para pruebas visuales), **shadcn/ui** (componentes accesibles copiables), **Docusaurus** (documentación), **Mermaid** (diagramas en Markdown; útil para `docs/` de los proyectos).

## Herramientas de desarrollo (playgrounds)

[CodePen](https://codepen.io/), [JSFiddle](https://jsfiddle.net/), [Playcode](https://playcode.io/new), [Regex101](https://regex101.com), [Carbon](https://carbon.now.sh) / [Ray.so](https://ray.so) (imágenes de código), [StackEdit](https://stackedit.io) / Typora (Markdown).

## Cómo usar esta lista en la práctica

1. **Antes de escribir un componente o una API web que no se domina**, abrir MDN/web.dev/react.dev y citar lo leído en lugar de usar de memoria (reduce errores como los de `LECCIONES-APRENDIDAS.md`).
2. **Antes de entregar una pantalla**, pasar el *Frontend Checklist* y las herramientas de accesibilidad y rendimiento de `03-recursos-visuales-curados.md`.
3. **Al enseñar o documentar** para el usuario, enlazar a recursos en español de la tabla anterior.
4. Lo que **no** aportan estos repos y sigue siendo una brecha de la base: gestión de estado en apps reales, pruebas de componentes, rendimiento de renderizado, internacionalización, formularios complejos, diseño para impresión de tickets/comandas. Si hace falta, investigar aparte y documentar con ejemplo probado.

## Observaciones sobre los repos analizados (para decidir si volver a ellos)

| Repo | Tamaño / estado | Valor |
|---|---|---|
| `yurimutti/recursos-frontend` | 1 README de ~63 KB, 28 categorías, tablas «Link / Descripción / Grátis»; el propio autor avisa que no recibe actualizaciones frecuentes | **Alto** para recursos visuales, pero con enlaces envejecidos y licencias sin revisar → ver `03` |
| `vanessamarely/recursos-frontend` | Sitio Astro con ~15 páginas de contenido (HTML, CSS, JS, TS, HTTP, navegadores, React/Vue/Angular, Git, libros), en español, con ejercicios | **Medio**: bueno como lista en español para aprender; poco para producción |
| `requestly/awesome-frontend-resources` | 1 README de ~14 KB, en inglés, con descripciones por enlace | **Medio-bajo**: rutas y cursos; casi todo se solapa con los otros dos |
