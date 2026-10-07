/**
 * Límite de intentos fallidos de PIN, en memoria (se reinicia al reiniciar el servidor).
 *
 * Clave del cliente: NO se confía en `x-forwarded-for`. Next completa ese encabezado con la IP real solo si el
 * cliente no lo mandó; si lo manda, respeta el valor recibido. Confiar en él permitía evadir el límite inventando
 * una IP distinta en cada intento. Sin un proxy de confianza no hay forma fiable de distinguir equipos, así que
 * todos comparten la clave "local". Con `TRUST_PROXY=1` (solo si hay un proxy que reescribe el encabezado) se usa
 * la IP que informa el proxy.
 *
 * Bloqueo escalonado: cada MAX_FALLOS fallos seguidos se bloquea, y cada bloqueo dura el doble que el anterior
 * (1, 2, 4, 8 y hasta 15 minutos). Con un PIN de 4 dígitos eso deja unos 10 intentos cada 15 minutos (~1.000 por
 * día): recorrer las 10.000 combinaciones lleva días. Un login correcto, o una hora sin fallos, reinicia la escala.
 *
 * Compensación aceptada: como la clave es compartida, alguien en la red podría mantener bloqueado el login de todos
 * fallando a propósito. Es preferible a un límite que se evade con un encabezado.
 */
export const MAX_FALLOS = 10;
export const BLOQUEO_INICIAL_MS = 60 * 1000;
export const BLOQUEO_MAXIMO_MS = 15 * 60 * 1000;
/** Sin fallos durante este tiempo, la escala de bloqueos vuelve a empezar. */
export const OLVIDO_MS = 60 * 60 * 1000;

interface Entrada {
  fallos: number;
  bloqueos: number;
  bloqueadoHasta: number;
  ultimoFallo: number;
}

const g = globalThis as unknown as { __loginIntentos?: Map<string, Entrada> };
const intentos: Map<string, Entrada> = (g.__loginIntentos ??= new Map());

export function claveCliente(req: Request): string {
  if (process.env.TRUST_PROXY !== '1') return 'local';
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0].trim() || 'local';
}

/** Segundos que faltan para poder reintentar (0 = no bloqueado). */
export function segundosBloqueado(clave: string, ahora: number = Date.now()): number {
  const e = intentos.get(clave);
  if (!e || e.bloqueadoHasta <= ahora) return 0;
  return Math.ceil((e.bloqueadoHasta - ahora) / 1000);
}

const enCurso = new Map<string, number>();

/**
 * Reserva un intento ANTES de verificar el PIN. Sin esto, una ráfaga de peticiones simultáneas pasa todas la
 * comprobación de bloqueo (los fallos se registran recién después de `await`) y recorre los 10.000 PIN de una vez.
 * Devuelve los segundos de espera (0 = intento reservado; hay que llamar a `liberarIntento` al terminar).
 */
export function reservarIntento(clave: string, ahora: number = Date.now()): number {
  const espera = segundosBloqueado(clave, ahora);
  if (espera > 0) return espera;
  const activos = enCurso.get(clave) ?? 0;
  if ((intentos.get(clave)?.fallos ?? 0) + activos >= MAX_FALLOS) return 1;
  enCurso.set(clave, activos + 1);
  return 0;
}

export function liberarIntento(clave: string): void {
  const n = (enCurso.get(clave) ?? 0) - 1;
  if (n > 0) enCurso.set(clave, n);
  else enCurso.delete(clave);
}

export function registrarFallo(clave: string, ahora: number = Date.now()): void {
  if (intentos.size > 1000) {
    for (const [k, v] of intentos) if (v.bloqueadoHasta <= ahora && ahora - v.ultimoFallo > OLVIDO_MS) intentos.delete(k);
  }
  let e = intentos.get(clave);
  if (!e || ahora - e.ultimoFallo > OLVIDO_MS) {
    e = { fallos: 0, bloqueos: 0, bloqueadoHasta: 0, ultimoFallo: ahora };
    intentos.set(clave, e);
  }
  e.ultimoFallo = ahora;
  e.fallos += 1;
  if (e.fallos >= MAX_FALLOS) {
    const duracion = Math.min(BLOQUEO_INICIAL_MS * 2 ** e.bloqueos, BLOQUEO_MAXIMO_MS);
    e.bloqueadoHasta = ahora + duracion;
    e.bloqueos += 1;
    e.fallos = 0;
  }
}

export function registrarExito(clave: string): void {
  intentos.delete(clave);
}

/** Solo para tests. */
export function reiniciarLimites(): void {
  intentos.clear();
  enCurso.clear();
}
