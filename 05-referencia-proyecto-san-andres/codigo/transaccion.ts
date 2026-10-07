import type { Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';

/**
 * Escrituras SERIALIZADAS dentro del proceso.
 *
 * SQLite admite un solo escritor a la vez. Con varias transacciones interactivas en paralelo (dos mozos cobrando al
 * mismo tiempo), cada una esperaba el bloqueo de las otras hasta superar el límite de Prisma y fallaba con un 500
 * ("Transaction already closed ... timeout"). Lo encontró el test de integración contra SQLite real; la base simulada
 * no podía verlo.
 *
 * Como el servidor es un único proceso, las escrituras se ponen en fila: cada una empieza cuando terminó la anterior,
 * así nunca compiten por el bloqueo. Son operaciones cortas (milisegundos), por lo que la espera es imperceptible.
 * Las lecturas no pasan por la fila. Las escrituras sueltas (un create/update/delete) usan `escritura()`: sin eso
 * competían por el bloqueo con la transacción en curso y podían fallar con SQLITE_BUSY.
 */
const g = globalThis as unknown as { __colaEscritura?: Promise<void> };

export const TIMEOUT_TRANSACCION_MS = 15_000;

/** Ejecuta `fn` cuando terminaron las escrituras anteriores. No debe llamarse desde dentro de otra `escritura`/`transaccion`. */
export async function escritura<T>(fn: () => Promise<T>): Promise<T> {
  const anterior = g.__colaEscritura ?? Promise.resolve();
  let liberar!: () => void;
  const turno = new Promise<void>((resolve) => (liberar = resolve));
  // La fila nunca queda rechazada: cada eslabón espera al anterior y se libera en el finally, falle o no.
  g.__colaEscritura = anterior.then(() => turno);
  await anterior;
  try {
    return await fn();
  } finally {
    liberar();
  }
}

export function transaccion<T>(fn: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  return escritura(() => prisma.$transaction(fn, { timeout: TIMEOUT_TRANSACCION_MS, maxWait: TIMEOUT_TRANSACCION_MS }));
}
