/**
 * Dinero en CENTAVOS ENTEROS.
 *
 * La base guarda todos los montos como enteros en centavos ($1.250,50 = 125050): las sumas son exactas y no
 * acumulan el error de punto flotante (0.1 + 0.2 = 0.30000000000000004). La API sigue hablando en PESOS con el
 * frontend, así que la conversión ocurre solo en los bordes:
 *   - Entrada (body de una petición en pesos)  → aCentavos()   (los esquemas zod de lib/catalogo.ts ya lo hacen)
 *   - Salida (JSON de respuesta o evento SSE)   → enPesos()
 * Todo el cálculo intermedio (subtotales, totales, resúmenes de Caja) se hace en centavos.
 */

/**
 * Rango de los montos. Prisma guarda `Int` como entero de 32 bits: el máximo es 2.147.483.647 centavos (~$21,4 millones).
 * Un monto mayor hacía fallar la escritura con un error 500. Se limita cada monto cargado a $10.000.000 y cualquier
 * total calculado (pedido, cobro) se verifica con `dentroDeRango` antes de guardarlo.
 */
export const MAX_MONTO_PESOS = 10_000_000;
export const MAX_CENTAVOS_DB = 2_147_483_647;

export function dentroDeRango(centavos: number): boolean {
  return Number.isSafeInteger(centavos) && Math.abs(centavos) <= MAX_CENTAVOS_DB;
}

/** Pesos (lo que escribe el usuario) → centavos enteros. 19.99 → 1999, 1250.5 → 125050. */
export function aCentavos(pesos: number): number {
  // toPrecision(15) descarta el ruido binario antes de redondear (1.005 * 100 = 100.49999999999999 → 100.5 → 101).
  return Math.round(Number((pesos * 100).toPrecision(15)));
}

/** Centavos enteros → pesos para mostrar o responder. 1999 → 19.99. */
export function aPesos(centavos: number): number {
  return centavos / 100;
}

/**
 * Campos de dinero de los modelos de Prisma: Producto.precio, ItemPedido.precio, Pedido.total, Venta.total,
 * Venta.propina, CostoFijo.monto e Insumo.precioUnitario. Ningún otro modelo usa estos nombres.
 */
const CAMPOS_MONTO = new Set(['precio', 'total', 'propina', 'monto', 'precioUnitario']);

type Plano = Record<string, unknown>;

/**
 * Copia de un resultado de Prisma (objeto, lista o anidado con include) con los campos de dinero en pesos.
 * Usar SOLO sobre datos que salen de la base: en otros objetos `total` puede no ser dinero (p. ej. un conteo).
 */
export function enPesos<T>(dato: T): T {
  if (Array.isArray(dato)) return dato.map((d) => enPesos(d)) as T;
  if (dato === null || typeof dato !== 'object' || dato instanceof Date) return dato;
  const copia: Plano = {};
  for (const [clave, valor] of Object.entries(dato as Plano)) {
    copia[clave] = CAMPOS_MONTO.has(clave) && typeof valor === 'number' ? aPesos(valor) : enPesos(valor);
  }
  return copia as T;
}

/** Suma de precio × cantidad, en centavos. */
export function subtotalCentavos(lineas: { precio: number; cantidad: number }[]): number {
  return lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0);
}
