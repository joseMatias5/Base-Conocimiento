# Lab 4 · Frontend, accesibilidad y seguridad básica

Caja de restaurante mínima (servidor `node:http` sin dependencias + página estática) probada con Playwright en **escritorio y móvil (Pixel 5)**.

| Qué se probó | Cómo | Estado |
|---|---|---|
| Flujo crítico crear → cobrar, validación, estados de error, doble envío con API lenta | `test/e2e.spec.js` | **28/28 en dos corridas seguidas** |
| XSS (nombre con HTML se ve como texto, no ejecuta) | e2e | Probado |
| Accesibilidad WCAG 2 A/AA con axe (inicial, con error, modo oscuro) y uso solo con teclado, objetivos táctiles ≥ 44 px, sin desborde horizontal | `test/a11y.spec.js` + e2e | Probado |
| Cabeceras (CSP, nosniff, frame-ancestors, referrer), CSRF por `Origin`, 415/413/400 con forma `{ error }`, sin filtrar detalles, 404/409, límite de intentos (429) sin confiar en `X-Forwarded-For` | `test/seguridad.spec.js` | Probado |
| Dependencias vulnerables | `npm audit --audit-level=high` | 0 vulnerabilidades |
| Pruebas de penetración reales, escaneo con ZAP, autenticación y sesiones, subida de archivos | — | **No probado** (la app del laboratorio no tiene login ni archivos) |

Correr: `npm install` y `npm test`. Usa el Chromium ya instalado de Playwright.
Errores reales que encontró el laboratorio en la propia app: L-069 a L-072.
