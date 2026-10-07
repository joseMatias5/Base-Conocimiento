import type { z } from 'zod';

/** Primer mensaje de error de zod, con el nombre del campo. */
export function mensajeZod(error: z.ZodError): string {
  const issue = error.issues[0];
  const campo = issue.path.join('.');
  return campo ? `${campo}: ${issue.message}` : issue.message;
}

export const JSON_INVALIDO = Symbol('json-invalido');

/** Lee el cuerpo JSON; devuelve JSON_INVALIDO si no se puede interpretar (en vez de lanzar un 500). */
export async function leerJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return JSON_INVALIDO;
  }
}

/** Código de error de Prisma (P2002 único, P2003 clave foránea, P2025 no encontrado), si lo hay. */
export function codigoPrisma(error: unknown): string | undefined {
  return (error as { code?: string } | null)?.code;
}

/** Lee un id positivo de la query (?id=). null = inválido; undefined = ausente. */
export function idDeQuery(request: Request, nombre = 'id'): number | null | undefined {
  const valor = new URL(request.url).searchParams.get(nombre);
  if (valor === null || valor === '') return undefined;
  const n = Number(valor);
  return Number.isInteger(n) && n > 0 ? n : null;
}

/** Lee un entero acotado de la query. undefined = ausente; null = inválido o fuera de rango. */
export function enteroDeQuery(request: Request, nombre: string, min: number, max: number): number | null | undefined {
  const valor = new URL(request.url).searchParams.get(nombre);
  if (valor === null || valor === '') return undefined;
  const n = Number(valor);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}
