# Lecciones aprendidas (globales)

Correcciones que hubo que hacer "a mano" en desarrollos reales, convertidas en reglas para no repetirlas.
Se leen ANTES de desarrollar y se actualizan AL TERMINAR cada bloque de trabajo (ver `README.md`).

Formato de cada lección: **Error** (qué pasó) → **Regla** (qué hacer siempre) → **Cómo verificarlo**.
Origen: proyecto y referencia, para poder ver el caso concreto.

---

## A. Dinero y cálculos de negocio

### L-001 · Dinero en punto flotante
- **Error:** montos guardados como `Float`; sumas con error binario (0.1 + 0.2 = 0.30000000000000004) y arqueos que no cierran. Se parcheó con redondeos y después hubo que migrar toda la base.
- **Regla:** dinero SIEMPRE en enteros de la unidad mínima (centavos) desde el día 1. La API puede hablar en pesos; la conversión va en un único módulo (`aCentavos` / `aPesos`) aplicado solo en los bordes (entrada validada y salida serializada, incluidos los eventos en tiempo real).
- **Verificar:** test de ida y vuelta (19,99 → 1999 → 19,99; 1,005 → 101); ningún `Float` en columnas de dinero.
- Origen: restaurante-san-andres, AT-13 (commit 9).

### L-002 · El cliente decide precios o totales
- **Error:** la API aceptaba el precio y el total que mandaba el navegador.
- **Regla:** todo valor de negocio (precio, total, descuento, stock) se calcula en el servidor desde la fuente de verdad. Lo que manda el cliente se ignora o se valida, nunca se usa como verdad.
- **Verificar:** test que manda `precio: 0` y comprueba que se cobra el precio real.
- Origen: restaurante-san-andres, AT-04.

### L-003 · Períodos de fechas corridos un día
- **Error:** "Hoy" calculado como `ahora − days` incluía las ventas de ayer.
- **Regla:** definir los períodos como intervalos semiabiertos `[inicio, fin)` desde las 00:00 locales, y escribir el criterio en un comentario. Un mismo criterio en todos los reportes.
- **Verificar:** test con una venta ayer a las 23:59 y otra hoy a las 00:01.
- Origen: restaurante-san-andres, AT-19.

### L-004 · Operaciones que deben ser reversibles
- **Error:** un cobro no se podía corregir sin reabrir el pedido (y reabrir permitía cobrar dos veces); el stock no se podía devolver porque nunca se registró qué se descontó.
- **Regla:** las operaciones contables se corrigen con asientos inversos, nunca editando o borrando. Todo movimiento automático (stock, saldo) se registra con su origen, para poder revertir exactamente ese movimiento.
- **Verificar:** test "anular devuelve exactamente lo descontado aunque la configuración haya cambiado después".
- Origen: restaurante-san-andres, AT-18 y AT-12.

## B. Concurrencia e integridad

### L-010 · Leer y después escribir (check-then-act)
- **Error:** dos cobros simultáneos leían "pendiente" y ambos registraban la venta.
- **Regla:** la transición de estado se reclama con UNA escritura condicional al inicio de la transacción (`updateMany where estado in [...]` → si `count === 0`, rechazar). Todo lo demás, dentro de la misma transacción.
- **Verificar:** test con dos peticiones en paralelo: exactamente una gana.
- Origen: restaurante-san-andres, AT-05.

### L-011 · Operaciones de varios pasos sin transacción
- **Regla:** crear pedido + ocupar mesa, cobrar + liberar mesa + descontar stock, etc. van en una sola transacción. Un fallo a mitad de camino debe dejar todo como estaba (test con fallo inyectado).
- Origen: restaurante-san-andres, AT-06.

### L-012 · Estados finales que se pueden reabrir
- **Regla:** modelar la máquina de estados explícitamente (estados finales y transiciones permitidas) y rechazar todo lo demás con 400. Probar cada transición prohibida.
- Origen: restaurante-san-andres, AT-18.

### L-013 · Base de un solo escritor (SQLite) con transacciones en paralelo
- **Error:** con varias transacciones interactivas a la vez, cada una esperó el bloqueo de las otras hasta superar el límite de Prisma (5 s): 5 cobros simultáneos dieron [500, 500, 500, 200, 500]. La base simulada de los tests serializaba por diseño y nunca lo mostró.
- **Regla:** con SQLite (un escritor), poner las transacciones de escritura en fila dentro del proceso desde el esqueleto (`transaccion()`), y probar la concurrencia contra el motor real.
- **Verificar:** test de integración con N operaciones en paralelo sobre la base real: todas 200 y una sola escritura donde corresponde.
- Origen: restaurante-san-andres, AT-35 (commit 14).

## C. Seguridad

### L-020 · Sesión que se puede fabricar
- **Regla:** sesión firmada (HMAC) o del servidor, cookie `httpOnly` + `SameSite`, con vencimiento. Nunca JSON plano legible y editable.
- Origen: restaurante-san-andres, AT-01.

### L-021 · Sesión no revocable
- **Error:** un usuario desactivado seguía operando hasta que vencía la cookie (12 h).
- **Regla:** en cada petición, verificar que el usuario siga activo y tomar el rol de la base, no del token. Lo mismo en el canal de tiempo real (revalidar periódicamente y cortar).
- Origen: restaurante-san-andres, AT-24 y AT-25.

### L-022 · Confiar en `X-Forwarded-For`
- **Error:** el límite de intentos usaba esa IP; el cliente la inventaba en cada intento y lo evadía. Next solo completa el encabezado si el cliente NO lo mandó.
- **Regla:** no confiar en encabezados que el cliente controla salvo detrás de un proxy de confianza configurado explícitamente (`TRUST_PROXY`). Límite de intentos con bloqueo escalonado.
- **Verificar:** test que inventa una IP distinta en cada intento y sigue bloqueado.
- Origen: restaurante-san-andres, AT-21.

### L-023 · Secretos por defecto en el repositorio
- **Regla:** sin secreto configurado → en producción fallar cerrado; en desarrollo usar uno aleatorio por proceso. Nunca un texto fijo en el código.
- Origen: restaurante-san-andres, AT-26.

### L-024 · CSRF con SameSite=Lax "alcanza"
- **Error:** para una IP, "mismo sitio" incluye cualquier puerto; y un formulario `text/plain` puede armar JSON válido.
- **Regla:** además de la cookie, rechazar peticiones con `Sec-Fetch-Site` cross/same-site u `Origin` de otro host, también en el login.
- Origen: restaurante-san-andres, AT-27.

### L-025 · Endpoints que devuelven de más o quedan públicos
- **Regla:** matriz de permisos de TODA la API en un test que falla si aparece una ruta nueva sin clasificar. Las respuestas no exponen identidades, hashes ni datos que la pantalla no necesita.
- Origen: restaurante-san-andres, AT-02, AT-22, AT-23.

### L-026 · Credenciales débiles o en texto plano
- **Regla:** PIN/contraseñas con hash lento y sal (scrypt/argon2), comparación en tiempo constante, migración automática de valores viejos al primer login.
- Origen: restaurante-san-andres, AT-07.

### L-027 · Subida de archivos
- **Regla:** validar por contenido (magic bytes), límite de tamaño antes de leer todo el cuerpo, nombre generado por el servidor, `nosniff`.
- Origen: restaurante-san-andres, AT-11.

## D. Datos, esquema y despliegue

### L-030 · Sin migraciones para instalaciones existentes
- **Error:** la app de escritorio copiaba la base plantilla solo la primera vez; ningún cambio de esquema llegaba a quien ya la usaba.
- **Regla:** desde el primer release, un mecanismo de migraciones que se aplica solo al arrancar, transaccional, idempotente (detecta el estado real), con copia de seguridad previa y test contra la base real (SQLite real, no simulada) que compare con el esquema esperado.
- Origen: restaurante-san-andres, AT-20.

### L-031 · Validación de entrada que rompe el frontend
- **Error:** un esquema nuevo rechazó el emoji que el formulario manda por defecto; la pantalla no mostraba el error y "no pasaba nada".
- **Regla:** antes de endurecer una validación, leer el payload EXACTO que manda cada pantalla y agregar un test con ese payload. Las pantallas siempre muestran `data.error`.
- Origen: restaurante-san-andres, commit 6 (corrección posterior).

### L-032 · Seeds y scripts que nadie ejecuta
- **Error:** el seed usaba campos inexistentes y fallaba al final; `tsx` no chequea tipos.
- **Regla:** los scripts de datos se tipan (`tsc --noEmit` los incluye) o se ejecutan en CI contra una base descartable.
- Origen: restaurante-san-andres, commit 9.

## E. Tests

### L-040 · Tests que tocan la base real sin querer
- **Error:** tres archivos de test no simulaban la base y consultaban la `dev.db` del desarrollador; pasaban "por casualidad" porque existía el usuario 1.
- **Regla:** todo test que importa rutas o lógica con acceso a datos simula la base explícitamente, o usa una base temporal creada en el test. Chequeo automático: listar los tests que importan rutas sin mock.
- Origen: restaurante-san-andres, commit 11.

### L-041 · La base simulada diverge del ORM real
- **Error:** el mock ignoraba `select` dentro de `include`; un test fallaba por el mock, no por el código.
- **Regla:** el mock imita lo mínimo pero fielmente; y al menos un test de integración por flujo crítico corre contra el motor real (concurrencia, transacciones, migraciones).
- Origen: restaurante-san-andres, commits 9 y 10.

### L-042 · Tests intermitentes por carga
- **Regla:** tests pesados (hash de contraseñas, base real, CLIs) con tiempo límite propio; correr la suite dos veces seguidas antes de dar algo por terminado.
- Origen: restaurante-san-andres, commit 9.

### L-043 · Cada arreglo con su test de regresión
- **Regla:** el test reproduce primero el error (nombre `REGRESIÓN: ...`), después se arregla. Probar también los caminos de error (rollback, 4xx sin filtrar detalles, sin efectos secundarios como eventos emitidos).
- Origen: todos los commits de restaurante-san-andres.

### L-044 · `vi.resetModules()` duplica el estado de los módulos
- **Error:** un test recargó los módulos para leer una variable de entorno nueva; las rutas quedaron con otra instancia del helper de sesión (otro registro de cookies y otro secreto aleatorio) y todo daba 401.
- **Regla:** después de `vi.resetModules()`, importar dinámicamente TODO lo que comparte estado con el código bajo prueba (helpers de sesión, singletons), no usar los imports estáticos del principio.
- Origen: restaurante-san-andres, commit 14.

### L-059 · Un test que pasa a la primera no prueba nada hasta que se lo rompe
- **Error:** las pruebas basadas en propiedades (valores al azar) del módulo de dinero pasaron todas a la primera, pero
  el mutation testing mostró dos defectos que no detectaban: el valor EXACTO del límite (`<=` vs `<`: el generador al azar casi
  nunca cae justo en el borde) y la comprobación de tipo (sin ella, un `null` se convertía en `0` y se perdía el dato).
- **Regla:** las propiedades cubren la forma general; los **bordes exactos** (mínimo, máximo, máximo+1, 0, vacío, nulo)
  se escriben como ejemplos explícitos. Sobre el código de negocio (dinero, estados, permisos) correr mutation testing
  (Stryker, PIT, mutmut) de forma periódica y, antes de confiar en un test nuevo, romper el código a propósito y comprobar que falle.
- **Cómo verificarlo:** `npm run test:mutacion` (puntaje por archivo; los mutantes sobrevivientes se convierten en casos nuevos).
- Origen: restaurante-san-andres, commit 15 (`money.ts` pasó de 95 % a 100 % de mutantes eliminados).

## F. Proceso de trabajo

### L-050 · Afirmar sin verificar
- **Regla:** antes de documentar un comportamiento ("si falla, el servidor no arranca"), provocarlo y mirarlo. Antes de asumir cómo se comporta un framework, leer su código o su documentación instalada (`node_modules/<paquete>/dist/docs`).
- Origen: restaurante-san-andres, commits 9 y 11.

### L-051 · Trabajo en paralelo que choca
- **Error:** el frontend agregó eventos en archivos que el backend estaba reescribiendo; los commits locales no estaban subidos.
- **Regla:** dividir por carpetas desde el inicio; subir seguido; antes de unir, simular la unión (`git merge-tree`) y resolver sobre la versión revisada; agregar tests a lo que trajo la otra rama.
- Origen: restaurante-san-andres, merge `a531548`.

### L-052 · Cambios de contrato sin coordinar
- **Regla:** todo cambio en lo que recibe o devuelve la API se lista en "Cambios visibles para el frontend" y se avisa antes de mezclar. Si se puede, mantener el contrato y convertir en el borde.
- Origen: restaurante-san-andres, todos los documentos de auditoría.

### L-053 · Diffs ruidosos
- **Regla:** no correr formateadores sobre archivos enteros (`prisma format`, `prettier`) dentro de un cambio funcional; si hace falta, en un commit aparte.
- Origen: restaurante-san-andres, commit 9.

### L-054 · Entorno Windows + bash
- **Regla:** para editar archivos con muchas comillas o barras, escribir un script a un archivo y ejecutarlo (no heredocs con escapes); evitar texto con tildes en comandos de consola; borrar archivos con el lenguaje del script, no con `Remove-Item` sobre rutas construidas.
- **Se repitió (2026-10-07):** un heredoc de bash se comió la barra invertida de una expresión regular y rompió un script; un código de escape octal (barra invertida + 01)
  dentro de una cadena de Python (no cruda) se convirtió en un carácter de control dentro de un archivo. **Regla reforzada:** todo archivo con
  barras invertidas, comillas o regex se crea con la herramienta de escritura de archivos (no `cat <<EOF` ni `sed`); en Python, cadenas crudas
  (`r'...'`) y, para rutas, `replaceAll('\\', '/')` (dos barras en el código fuente) o `pathlib` en vez de regex con barras. Leer el archivo resultante antes de ejecutarlo.
- Origen: restaurante-san-andres, sesiones del 2026-10-06 y 2026-10-07.

### L-055 · Decisiones de diseño que son del usuario
- **Regla:** preguntar ANTES de implementar cuando hay alternativas con consecuencias (centavos vs decimal, cuándo descontar stock, si hay datos reales en producción). Registrar la decisión y el porqué en el documento del cambio.
- Origen: restaurante-san-andres, AT-12 y AT-13.

### L-056 · Convenciones del framework que rompen el build
- **Error:** dos veces casi se exportó una constante propia desde un archivo de ruta de Next (`route.ts` solo admite los handlers y la configuración de segmento); se detectó antes de compilar.
- **Regla:** la lógica y las constantes compartidas van en `src/lib/`; los archivos con convenciones del framework (`route.ts`, `page.tsx`, `proxy.ts`) exportan solo lo que el framework espera. Correr `npm run build`, no solo los tests, antes de dar algo por terminado.
- Origen: restaurante-san-andres, commits 11 y 13.

### L-057 · Editar por script sin mirar el código actual
- **Error:** varios reemplazos automáticos fallaron (o se aplicaron a medias) porque el código ya no era el que se suponía (otro import, otro nombre de variable, el mismo texto repetido).
- **Regla:** leer el fragmento real justo antes de editarlo; los reemplazos exigen coincidencia única y el script aborta si algo no coincide (nunca aplicar a medias en silencio). Ante un fallo, releer y editar a mano.
- Origen: restaurante-san-andres, sesión del 2026-10-06.

### L-058 · Reemplazo masivo que rompe sintaxis o ignora CRLF
- **Error:** un script que envolvía llamadas en una lambda dejó `await` dentro de una función no async, y los reemplazos con `\n` no coincidían en archivos CRLF.
- **Regla:** tras un cambio automático, compilar/testear antes de seguir; usar `\r?\n` en regex; sacar los `await` de la lambda antes de envolver.
- **Cómo verificarlo:** `npm test` y `npm run build` tras cada script.
- Origen: restaurante-san-andres, cierre de calidad del 2026-10-06.

### L-060 · Una carrera se demuestra primero: escribir el test que falla sin la protección
- **Error probable:** afirmar "FOR UPDATE evita el lost update" sin haber visto el error. Si el test no puede fallar, no prueba nada.
- **Regla:** por cada mecanismo de concurrencia (bloqueo, versión, SERIALIZABLE, orden de bloqueos) escribir dos tests: uno que **demuestra el bug** sin la protección
  (con una espera artificial dentro de la transacción para forzar el solapamiento) y otro que muestra que con la protección desaparece.
- **Cómo verificarlo:** Lab 1, `lab1-postgres-concurrencia/test/concurrencia.test.js` (lost update 10 → <1000 sin bloqueo, 1000 con `FOR UPDATE`; write skew; deadlock).
- Origen: Lab 1 (2026-10-07), PostgreSQL 18.4 real.

### L-061 · Reintentar 40001 y 40P01 es parte de la transacción, no un parche
- **Regla:** con `SERIALIZABLE` (o bloqueos en ciclo) PostgreSQL aborta una transacción con `40001`/`40P01` **por diseño**; el helper de transacciones debe reintentarla
  entera. Con orden consistente de bloqueos (p. ej. por `id` ascendente) el deadlock no ocurre. Las esperas para provocarlo deben superar `deadlock_timeout` (1 s por defecto).
- **Cómo verificarlo:** Lab 1, pruebas "write skew" y "deadlock por orden inverso".
- Origen: Lab 1 (2026-10-07).

### L-062 · Probar con el motor real no exige instalarlo: motores embebidos y limpieza en Windows
- **Regla:** si no hay Docker, un paquete que descarga el binario real (p. ej. `embedded-postgres` de npm) sirve para tests de integración en directorio temporal y puerto aleatorio.
  En Windows, `stop()` puede lanzar `EBUSY` al borrar la carpeta temporal aunque el servidor ya se detuvo: capturar solo ese código y comprobar con `tasklist` que no quedan procesos huérfanos.
- Origen: Lab 1 (2026-10-07); en este equipo no hay Docker ni PostgreSQL instalados.

### L-054 (refuerzo) · Dos heredocs largos fallaron otra vez en la sesión del Lab 1
- Con `cat <<'EOF'` de varios cientos de líneas el shell devolvió `unexpected EOF`. Se resolvió escribiendo los archivos con la herramienta Write. La regla de L-054 se cumple: **archivos de código siempre con Write**.

### L-063 · Los ejemplos numéricos de la documentación también se prueban
- **Error:** el ejemplo "3 × $1.250,50 con 10 % de descuento = $3.375,35" del prompt inicial estaba mal (correcto: **$3.376,35**). Lo detectó un test unitario del Lab 2 al convertir el ejemplo en aserción.
- **Regla:** todo ejemplo numérico que aparezca en una guía o prompt debe existir como test en algún proyecto de referencia; la aritmética de documentación no se confía a la memoria.
- **Cómo verificarlo:** `Linea_3_por_1250_50_con_10_por_ciento_da_3376_35` en `08-laboratorios/lab2-csharp-cobros`.
- Origen: Lab 2 (2026-10-07).

### L-064 · Procesos hijos que heredan tuberías cuelgan la lectura de su salida
- **Error:** un fixture de pruebas ejecutaba `pg_ctl start` con la salida redirigida y `ReadToEnd()`; el servidor arrancado heredó la tubería y la lectura no terminó nunca (la suite se colgó 10 minutos).
- **Regla:** a procesos que dejan un demonio en segundo plano (`pg_ctl start`, `docker run` sin `-d`, etc.) no se les redirige la salida; se usa `-l archivo` y se espera con tiempo límite (`WaitForExit(ms)` + `Kill`). Toda espera de proceso lleva timeout.
- Origen: Lab 2 (2026-10-07).

### L-065 · Configuración leída en `Program.cs` no se puede sobrescribir desde `WebApplicationFactory`
- **Regla:** en ASP.NET Core con hosting mínimo, `builder.Configuration` se lee antes de que `WithWebHostBuilder` aplique cambios; en los tests de API fijar la configuración con **variables de entorno** (`ConnectionStrings__Base`) antes de crear la fábrica, o inyectarla por servicios.
- Origen: Lab 2 (2026-10-07).

### L-054 (segundo refuerzo) · Un script de Python con cadena no cruda convierte `\n` en salto real
- Un script de Python que editaba un `.cs` insertó un salto de línea dentro de una cadena de C# (error CS1039); otro script falló por comillas triples dentro del texto. Regla de L-054: editar código y documentos con Edit/Write, no con scripts que reescriben texto con barras invertidas o comillas.

### L-066 · Aserciones sobre códigos de error, no sobre mensajes
- **Error:** un test esperaba el texto `foreign key` y falló porque el servidor responde en el idioma del equipo ("viola la llave foránea").
- **Regla:** comprobar el SQLSTATE (`23503` clave foránea, `23505` único, `23514` check, `40001` serialización, `40P01` deadlock) o el código del error de la aplicación, nunca el texto del mensaje.
- Origen: Lab 3 (2026-10-07).

### L-067 · Un respaldo no existe hasta que se restauró y se comparó
- **Regla:** todo respaldo lleva un manifiesto (conteos y SHA-256) que se verifica **antes** de restaurar; la restauración se hace en una transacción, reajusta las secuencias (`setval`) y compara conteos al final. La prueba real es: respaldar → provocar un desastre (borrar datos, eliminar una tabla) → restaurar → comparar con el estado original.
- **Límites conocidos:** un respaldo físico en frío exige detener el servidor; para respaldo en caliente y recuperación a un punto en el tiempo hacen falta `pg_basebackup` y archivado de WAL (no probados todavía, ver Lab 3 README).
- **Cómo verificarlo:** `08-laboratorios/lab3-respaldo-ci/test/respaldo.test.js`.
- Origen: Lab 3 (2026-10-07).

### L-068 · Un pipeline no ejecutado es una hipótesis
- **Regla:** el YAML del CI puede estar perfecto y no haberse ejecutado nunca. Mantener un script local equivalente (`npm run ci`) que se ejecuta de verdad y declarar explícitamente en el README qué piezas están "escritas pero no ejecutadas" (workflow, Dockerfile). Un pipeline falla rápido y marca como "no ejecutada" cada compuerta posterior.
- Origen: Lab 3 (2026-10-07).

### L-069 · El color de marca se mide, no se elige a ojo: texto blanco sobre naranja no pasa AA
- **Error:** el primer instinto fue botón naranja `#E8590C` con texto blanco; medido da 3,6:1 (AA exige 4,5:1 en texto pequeño).
- **Regla:** al definir tokens, calcular el contraste de cada par texto/fondo y escribir en el propio CSS cuál se usa (texto sobre acento = tinta oscura, 5,0:1; acento como texto sobre claro = versión oscurecida `#C2410C`, 5,2:1). Un acento necesita dos variantes: relleno y texto.
- **Cómo verificarlo:** script de razón de contraste WCAG sobre los tokens, más axe en el e2e (ver L-059).
- Origen: sistema «Naranja señal», `09-diseno-visual/` (2026-10-07).

### L-070 · Una captura de móvil con Edge headless a menos de ~500 px recorta, no reacomoda
- **Error:** con `--window-size=390` la página parecía desbordar (tarjetas cortadas); el ancho real de maquetación era ~500 px y la captura solo recortaba. Además el plugin `playwright` no arrancó porque busca Chrome en una ruta que no existe.
- **Regla:** antes de "arreglar" un desborde visto en captura, confirmar el ancho real de la ventana; probar el móvil a 500 px o con emulación de dispositivo. Si Playwright no tiene Chrome, usar Edge headless (`msedge --headless=new --screenshot=…`) o `npx playwright install chrome`.
- Origen: `09-diseno-visual/` (2026-10-07).

### L-069 · Recargar datos no debe borrar el error de la acción anterior
- **Error:** la pantalla mostraba el error de red y, un instante después, la recarga de la lista exitosa lo ocultaba: el usuario nunca lo veía. Lo detectó el e2e "si la API falla…", no la revisión manual.
- **Regla:** el mensaje de error solo se limpia cuando una acción nueva del usuario tiene éxito, no cuando se refrescan datos de fondo. Todo estado de error tiene un test e2e que lo hace aparecer y comprueba que **sigue visible** y que el botón se rehabilita.
- **Cómo verificarlo:** Lab 4, `e2e.spec.js` "si la API falla, la pantalla muestra el error y sigue funcionando".
- Origen: Lab 4 (2026-10-07).

### L-070 · Un servidor HTTP que rechaza el cuerpo no debe destruir el socket antes de responder
- **Error:** al superar el máximo de cuerpo se hacía `req.destroy()`; el cliente veía `socket hang up` en vez de `413`.
- **Regla:** dejar de acumular, responder 413 con `Connection: close` y recién entonces cerrar. Probar los límites (415, 413, 400) con un cliente HTTP real, no solo con la función de validación.
- Origen: Lab 4 (2026-10-07).

### L-071 · Servir archivos: nunca pasar un Buffer por `JSON.stringify`
- **Error:** la página se devolvía como `{"type":"Buffer","data":[…]}`; los tests fallaron todos por timeout (síntoma lejano de la causa).
- **Regla:** ante una falla masiva con timeouts, mirar primero una sola petición con `curl -i` antes de tocar los tests. Un test de humo ("la página carga y tiene un `h1`") va primero en la suite.
- Origen: Lab 4 (2026-10-07).

### L-072 · Los e2e que comparten servidor no comparten datos
- **Error:** el test del doble clic usaba el "pedido 1" fijo; ya cobrado por el proyecto de escritorio, el de móvil esperaba un botón que no existía (30 s de timeout).
- **Regla:** cada test crea sus propios datos con nombre único y mide diferencias (`después − antes`), nunca valores absolutos de un servidor compartido. Para simular dos clics simultáneos usar `evaluate(b => { b.click(); b.click(); })`, porque `dblclick()` espera a que el botón siga actuable.
- Origen: Lab 4 (2026-10-07).

### L-073 · Verificar lo verificable de lo que no se puede ejecutar
- **Regla:** cuando un artefacto (workflow de CI, Dockerfile) no se puede ejecutar en el entorno, verificar al menos sus partes aisladas: sintaxis del YAML con un parser real y los comandos de cada etapa (p. ej. `dotnet publish -c Release`) en local. Declarar el resto como "pendiente externo" y revisar el resultado en el primer push, no asumirlo.
- Origen: Lab 3 (2026-10-07).
