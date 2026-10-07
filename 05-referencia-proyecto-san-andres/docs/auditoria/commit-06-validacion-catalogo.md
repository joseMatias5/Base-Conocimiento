# Commit 6 — Validación de entrada en productos, costos, proveedores, inventario y consultas

`fix(validacion): productos, costos, proveedores, inventario y consultas con entrada validada`

**Archivos principales:** `src/lib/catalogo.ts` (nuevo), `src/lib/validacion.ts` (nuevo),
`src/app/api/{productos,costos,proveedores,inventario}/route.ts`, `src/app/api/caja/route.ts`,
`src/app/api/pedidos/history/route.ts`, `src/app/api/pedidos/[id]/history/route.ts`.

---

## Hallazgo AT-08 (completo) — Rutas de administración sin validar la entrada

**Ubicación:** API | Catálogo y administración | `productos`, `costos`, `proveedores`, `inventario`
**Tipo:** Calidad (robustez) y Seguridad (integridad de datos)
**Descripción:** Estas rutas guardaban el cuerpo de la petición sin validar tipos, rangos ni existencia de las referencias.

**Evidencia simplificada:**
```ts
const body = await request.json();
await prisma.producto.create({ data: { nombre: body.nombre, precio: body.precio, categoriaId: body.categoriaId, imagen: body.imagen || '' } });
await prisma.producto.delete({ where: { id: parseInt(id) } });     // 500 si el producto ya se vendió; parseInt("abc") → NaN
await prisma.insumo.update({ data: { stockActual: body.stockActual, ... } });   // acepta negativos y texto
```

**Problema identificado:** Cualquier valor llegaba a la base de datos; los fallos se manifestaban como `500` genéricos.

**Consecuencias:**
- Productos con precio 0 o negativo: con precios definidos por el servidor (AT-04), un precio vacío convertido en `0` por la pantalla dejaba el producto **gratis** sin avisar.
- `imagen` aceptaba cualquier texto (`javascript:`, `data:`, `//sitio-externo`).
- Stock e importes negativos o con texto; correos de proveedores inválidos.
- Crear un producto sin categoría válida, o eliminar uno ya vendido, terminaba en `500`.
- `parseInt` sin comprobación: `?id=abc` o `?categoriaId=abc` producían errores de base de datos.

**Principios afectados:**
- Fail fast (validar en la frontera).
- Integridad referencial controlada por la aplicación.
- Mensajes de error accionables.

**Recomendación (aplicada):** Validación con `zod`, con los esquemas en `src/lib/catalogo.ts`:
- **Productos:** nombre obligatorio (1–100), `precio` **mayor que 0**, `categoriaId` existente, `imagen` vacía, un **emoji** de reemplazo (la pantalla usa `🍽️` como "sin imagen"), ruta propia (`/uploads/...`) o URL `http(s)`. `PUT` valida solo los campos presentes. **Eliminar** un producto con pedidos registrados responde `400` y sugiere marcarlo como no disponible.
- **Costos:** concepto obligatorio, `monto` mayor que 0, `tipo` (`fijo`/`variable`) y `periodicidad` (`diario`/`semanal`/`mensual`) con valores por defecto si llegan vacíos.
- **Proveedores:** solo el nombre es obligatorio; correo válido o vacío; longitudes máximas.
- **Inventario:** stock, mínimo y precio no negativos (hasta 1.000.000.000), `proveedorId` existente o `null`, y se descartan los campos de más que envía la pantalla (`proveedor` anidado, fechas).
- **Siempre:** JSON inválido → `400`; id inexistente → `404`; id faltante → `400 "ID requerido"` (mensaje de siempre); id inválido → `400`.
**Impacto:** Alto
**Esfuerzo estimado:** Medio

---

## Corrección posterior (importante)

La primera versión de esta validación **rechazaba el emoji `🍽️`** que la pantalla de Menú carga como imagen por
defecto al abrir "Nuevo Producto". Resultado: crear un producto sin subir una foto respondía `400` y, como la
pantalla no revisa `res.ok`, el producto simplemente no aparecía. Se detectó en una prueba manual. Se corrige
aceptando un texto corto formado solo por caracteres no ASCII (emojis), y se agregan tests con el payload exacto
del formulario. Se revisaron además el resto de formularios (proveedores, costos, inventario, pedidos e ítems de
cocina) contra las validaciones, sin encontrar otros desajustes.

---

## Hallazgo AT-08 (consultas) — Parámetros de lectura sin validar

**Ubicación:** API | Consultas | `caja`, `pedidos/history`, `pedidos/[id]/history`
**Tipo:** Calidad
**Descripción:** `days`, `mesaNumero` y el id del historial se convertían con `parseInt` sin comprobar el resultado.

**Evidencia simplificada:**
```ts
const days = parseInt(daysStr);  since.setDate(since.getDate() - days);   // days=abc → fecha inválida → 500
where.mesa = { numero: parseInt(mesaNumero, 10) };
```

**Problema identificado:** Un valor no numérico producía un error interno en lugar de una respuesta clara.

**Consecuencias:**
- `GET /api/caja?days=abc` y similares terminaban en `500`.
- Rangos absurdos (`days=100000`) generaban consultas innecesariamente grandes.

**Principios afectados:**
- Fail fast.

**Recomendación (aplicada):** `days` es un entero entre 1 y 366; `mesaNumero`, entre 1 y 9999; los ids, enteros positivos. Cualquier otro valor: `400` con un mensaje claro. Sin parámetros, el comportamiento no cambia.
**Impacto:** Bajo
**Esfuerzo estimado:** Muy Bajo

---

## Hallazgo AT-19 (hallado aquí, **resuelto en el [commit 7](commit-07-periodo-caja-y-limpieza.md)**) — "Hoy" en Caja incluye las ventas de ayer

**Ubicación:** API | Caja | `caja/route.ts`
**Tipo:** Calidad (cálculo)
**Descripción:** El período se calcula como `fecha_actual − days` días, a las 00:00. Con `days=1` ("Hoy") eso es el **inicio de ayer**.

**Evidencia simplificada:**
```ts
const since = new Date();
since.setDate(since.getDate() - days);   // days = 1  →  ayer
since.setHours(0, 0, 0, 0);              // desde las 00:00 de ayer
```

**Problema identificado:** El inicio del período está desplazado un día respecto de lo que muestra la etiqueta.

**Consecuencias:**
- El total y el arqueo de "Hoy" suman también las ventas de ayer.
- "Últimos 7 días" cubre en realidad 8 días calendario.

**Principios afectados:**
- Corrección de los cálculos de negocio.

**Recomendación:** Calcular `since` con `days - 1` (así "Hoy" es desde las 00:00 de hoy y "Últimos 7 días" incluye hoy y los 6 anteriores). Se corrigió en el commit 7, tras confirmar el criterio (además, el dashboard ya usaba ese criterio).
**Impacto:** Medio
**Esfuerzo estimado:** Muy Bajo

---

## Cambios visibles para el frontend

| Qué cambia | Detalle |
|------------|---------|
| **Las pantallas no muestran los errores** | Menú, Costos, Proveedores e Inventario no revisan `res.ok`. Si el servidor rechaza un dato (`400`/`404`), el usuario no ve nada y parece que "no pasó nada". **Recomendado:** mostrar `data.error`, como ya hace la subida de imágenes. |
| **Producto sin precio o sin categoría** | El formulario arranca con `precio: 0` y `categoriaId: 0`. Ahora guardar sin completarlos responde `400` ("precio: debe ser mayor que 0", "categoriaId: ..."). **Recomendado:** deshabilitar "Guardar" hasta que estén completos. |
| **Eliminar un producto ya vendido** | `400` con "No se puede eliminar un producto con pedidos registrados. Marcalo como no disponible." (antes `500`). Conviene ofrecer "no disponible" en ese caso. |
| **Costos y proveedores** | Monto mayor que 0; correo válido o vacío. |
| **Inventario** | No se admiten stocks negativos. |
| **Consultas** | `days` entre 1 y 366; valores inválidos → `400`. |
| Respuestas exitosas | Sin cambios de forma. Sin cambios de esquema. |

## Cómo verificar
```bash
npm test        # 605 tests acumulados
npm run build
npm run dev
```
Prueba manual (Admin):
1. **Menú:** crear un producto completo (debe funcionar). Intentar guardar con precio 0: no debe crearse (no habrá mensaje; revisar la terminal: `POST /api/productos 400`).
2. **Menú:** intentar eliminar un producto que ya se vendió: no se elimina (`DELETE /api/productos 400`).
3. **Costos / Proveedores:** crear uno válido; probar un proveedor con correo mal escrito (`400` en la terminal).
4. **Inventario:** editar un stock con un número normal (debe funcionar).
5. Terminal: `curl -s -b /tmp/cookies.txt "http://localhost:3000/api/caja?days=abc"` debe responder `400` (con sesión de admin).

## Pendiente y limitaciones
- Un producto con precio 0 ya existente en una base real no podría **editarse** sin corregir antes el precio (el formulario envía el precio actual).
- Se siguen sin validar parámetros de rutas que no reciben entradas del usuario (p. ej. `hub-metrics`).
- Los tests usan una base simulada; no sustituyen una prueba con SQLite real.
