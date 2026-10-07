# Commit 7 — Período de Caja, datos del comercio configurables y limpieza del repositorio

`fix(caja): período "Hoy" correcto, datos del comercio configurables y limpieza del repositorio`

**Archivos principales:** `src/app/api/caja/route.ts`, `src/lib/negocio.ts` (nuevo),
`src/app/api/checkout/pay/route.ts`, `electron/main.js`, `README.md`, `.gitattributes` (nuevo), `.env.example`.

---

## Hallazgo AT-19 — "Hoy" en Caja incluía las ventas de ayer

**Ubicación:** API | Caja | `caja/route.ts`
**Tipo:** Calidad (cálculo de negocio)
**Descripción:** El período se calculaba como `fecha_actual − days` días, a las 00:00. Con `days=1` ("Hoy") eso es el **inicio de ayer**.

**Evidencia simplificada:**
```ts
const since = new Date();
since.setDate(since.getDate() - days);   // days = 1  →  ayer
since.setHours(0, 0, 0, 0);              // desde las 00:00 de AYER
// /api/metricas (dashboard) sí usa: new Date(año, mes, día)  →  las 00:00 de HOY
```

**Problema identificado:** El inicio del período estaba desplazado un día, y además **contradecía al dashboard**, que sí empieza el día a las 00:00 de hoy.

**Consecuencias:**
- El total y el arqueo de "Hoy" sumaban también las ventas de ayer (el arqueo imprime "Periodo: Hoy").
- "Últimos 7 días" abarcaba 8 días calendario, y "Últimos 30 días", 31.
- Dos pantallas del mismo sistema mostraban cifras distintas para "Hoy".

**Principios afectados:**
- Corrección de los cálculos de negocio.
- Consistencia entre vistas (misma definición de "Hoy").

**Recomendación (aplicada):** El período **incluye hoy**: `days=1` es desde las 00:00 de hoy; `days=7`, hoy y los 6 días anteriores; `days=30`, hoy y los 29 anteriores. Coincide con el criterio del dashboard.
**Impacto:** Medio
**Esfuerzo estimado:** Muy Bajo

---

## Hallazgo AT-16 — Datos del comercio fijos en el ticket

**Ubicación:** API | Cobro | `checkout/pay/route.ts`
**Tipo:** Mantenibilidad
**Descripción:** El nombre, el CUIT y la dirección que se imprimen en el ticket al cliente estaban escritos en el código, con valores de ejemplo.

**Evidencia simplificada:**
```ts
restaurante: 'Restaurante San Andrés',
cuit: '30-12345678-9',                       // CUIT de ejemplo impreso en los tickets reales
direccion: 'Av. San Martín 1234, San Andrés',
```

**Problema identificado:** Cambiar un dato del comercio exigía modificar el código y generar un instalador nuevo.

**Consecuencias:**
- Tickets con un CUIT ficticio hasta que alguien edite el código.
- Imposible usar el mismo sistema para otro local.

**Principios afectados:**
- Separación de configuración y código.
- Open/Closed (cambiar datos sin tocar el código).

**Recomendación (aplicada):** Los datos salen de `datosNegocio()` (`src/lib/negocio.ts`), que lee `NEGOCIO_NOMBRE`, `NEGOCIO_CUIT` y `NEGOCIO_DIRECCION`. En la app de escritorio, `electron/main.js` los toma de la sección `negocio` del `config.json` de cada instalación. Si falta alguno, se usan los valores de siempre: **no cambia nada hasta que se configure**.
**Impacto:** Bajo
**Esfuerzo estimado:** Bajo

---

## Hallazgo AT-17 (parcial) — Residuos y documentación del repositorio

**Ubicación:** Repositorio | Raíz | `README.md`, `temp.tsx`, fines de línea
**Tipo:** Mantenibilidad
**Descripción:** README genérico de `create-next-app`, un archivo de trabajo sin uso y ningún control de fines de línea.

**Evidencia simplificada:**
```text
README.md   → texto de plantilla ("This is a Next.js project bootstrapped with create-next-app")
temp.tsx    → 721 líneas, UTF-16 con BOM, no importado por ningún archivo (≈62 % igual a comandas/page.tsx)
(sin .gitattributes)  → archivos que aparecen "modificados" solo por CRLF/LF al pasar por Windows o un ZIP
```

**Problema identificado:** Quien llega al proyecto no sabe cómo ponerlo en marcha, y hay ruido en el repositorio y en los diffs.

**Consecuencias:**
- Onboarding lento y dependiente de que alguien explique.
- Falsos "cambios" en el control de versiones por saltos de línea.
- Un archivo de 721 líneas con otra codificación que nadie mantiene.

**Principios afectados:**
- Documentación como parte del producto.
- Higiene del repositorio.

**Recomendación (aplicada y pendiente):**
- ✅ **README propio:** requisitos, puesta en marcha, comandos, roles y permisos, configuración del comercio y límites de los tests.
- ✅ **`.gitattributes`:** `* text=auto` y archivos binarios marcados; en el repositorio siempre LF.
- ⏳ **`temp.tsx`: no se tocó.** Es una copia antigua de la pantalla de Sala, sin referencias. Sugerencia: borrarlo (queda en el historial de git y es recuperable). Pendiente de decisión del equipo.
- ⏳ **Avisos que aparecen en cada arranque** (no bloquean): `middleware` → `proxy` (Next 16, `npx @next/codemod@canary middleware-to-proxy .`) y `package.json#prisma` → `prisma.config.ts` (Prisma 7). Se dejan para un cambio aparte, porque tocan el arranque de la app y conviene probarlos en el entorno real.
**Impacto:** Bajo
**Esfuerzo estimado:** Bajo

---

## Cambios visibles para el frontend y para quien opera

| Qué cambia | Detalle |
|------------|---------|
| **Caja → "Hoy"** | Ya no incluye ventas de ayer. Los totales de "Hoy", "Últimos 7 días" y "Últimos 30 días" pueden **bajar** respecto de lo que se veía antes: es la corrección. Ahora coinciden con el dashboard. |
| **Tickets** | Sin cambios si no se configura nada. Con `NEGOCIO_*` (o la sección `negocio` del `config.json`) se imprimen los datos reales. La forma del ticket no cambia. |
| **App de escritorio — instalaciones existentes** | Su `config.json` actual no tiene la sección `negocio`: se usan los valores de ejemplo. Para configurarla, agregar a mano el bloque `"negocio": { "nombre": "...", "cuit": "...", "direccion": "..." }` y reiniciar la app. Las instalaciones nuevas lo reciben escrito. |
| **Fines de línea** | Tras aplicar `.gitattributes` no debe aparecer ningún archivo "modificado" por saltos de línea. |

## Cómo verificar
```bash
npm test        # 615 tests acumulados
npm run build
npm run dev
```
Pruebas manuales:
1. **Período de Caja:** abrir `npm run db:studio`, tabla `Venta`, y cambiar la `fechaCobro` de una venta a ayer a las 23:00. En Caja, **"Hoy" no debe contarla** y "Últimos 7 días" sí.
2. **Datos del comercio:** agregar a `.env` `NEGOCIO_NOMBRE=Mi Local`, `NEGOCIO_CUIT=20-11111111-1` y `NEGOCIO_DIRECCION=Mi calle 123`; reiniciar `npm run dev`; cobrar un pedido e imprimir el ticket del cliente: deben salir esos datos.
3. **Fines de línea:** `git status` debe seguir limpio.

## Pendiente
- ~~**`temp.tsx`:** decisión de borrarlo o conservarlo.~~ Eliminado en el [commit 8](commit-08-borrar-temp.md).
- **Avisos de arranque** (`middleware` → `proxy`, `prisma.config.ts`).
- **AT-12** (inventario conectado a los productos) y **AT-13** (dinero con tipo decimal): requieren cambios en el esquema de la base de datos; necesitan aprobación y coordinación antes de empezar.
- **Productos repetidos y precios equivocados** (conversación posterior): bloqueo de duplicados, confirmación de cambios de precio y registro de cambios; y que las pantallas de administración muestren los errores del servidor.
- Los tests usan una base simulada; no sustituyen una prueba con SQLite real.
