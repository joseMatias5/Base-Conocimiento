import { z } from 'zod';

/** Error de negocio con status HTTP. Lanzado dentro de una transacción de Prisma, la revierte. */
export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

/** Cantidad máxima por línea de pedido (cota de sensatez contra datos erróneos o abusivos). */
export const MAX_CANTIDAD_ITEM = 100;

/** Cantidad de una línea de pedido: entero de 1 a MAX_CANTIDAD_ITEM, con mensajes en español. */
export const cantidadItem = z.coerce
  .number({ invalid_type_error: 'debe ser un número' })
  .int('debe ser un número entero')
  .min(1, 'debe ser al menos 1')
  .max(MAX_CANTIDAD_ITEM, `no puede superar ${MAX_CANTIDAD_ITEM}`);
