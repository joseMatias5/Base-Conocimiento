/**
 * Sesión firmada (HMAC-SHA256) con Web Crypto: funciona tanto en el proxy como en las rutas.
 * Formato del token: base64url(payload JSON) + "." + base64url(firma).
 * Cualquier modificación del payload invalida la firma; el payload incluye expiración.
 */
export const SESSION_COOKIE = 'session';
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 horas

export interface SessionUser {
  id: number;
  nombre: string;
  rol: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();
const buf = (u: Uint8Array) => u as unknown as BufferSource;

// Sin SESSION_SECRET fuera de producción: secreto ALEATORIO por proceso (antes era un texto fijo publicado en el
// repositorio, con el que cualquiera podía firmar una sesión de ADMIN en un servidor de desarrollo en la red).
// Consecuencia aceptable: al reiniciar `npm run dev` hay que volver a ingresar el PIN.
// Se guarda en globalThis: el proxy y las rutas son bundles distintos y las recargas en caliente reevalúan el módulo;
// con una constante por módulo cada uno tendría un secreto diferente y la sesión no validaría.
const gs = globalThis as unknown as { __devSessionSecret?: string };
const DEV_SECRET = (gs.__devSessionSecret ??= Array.from(crypto.getRandomValues(new Uint8Array(32)), (b) =>
  b.toString(16).padStart(2, '0')
).join(''));
let warnedDevSecret = false;

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret && secret.length >= 32) return secret;
  if (process.env.NODE_ENV === 'production') {
    // Falla cerrado: sin secreto no se puede emitir ni validar ninguna sesión.
    throw new Error('SESSION_SECRET no está configurado (mínimo 32 caracteres).');
  }
  if (!warnedDevSecret && process.env.NODE_ENV !== 'test') {
    warnedDevSecret = true;
    console.warn('[auth] SESSION_SECRET no definido: usando un secreto aleatorio de desarrollo (las sesiones no sobreviven a un reinicio).');
  }
  return DEV_SECRET;
}

function toB64Url(bytes: Uint8Array): string {
  let s = '';
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64Url(str: string): Uint8Array {
  const b64 = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(b64);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function hmacKey(): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', buf(enc.encode(getSecret())), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

export async function signSession(user: SessionUser, now: number = Date.now()): Promise<string> {
  const payload = {
    id: user.id,
    nombre: user.nombre,
    rol: user.rol,
    exp: Math.floor(now / 1000) + SESSION_MAX_AGE,
  };
  const body = toB64Url(enc.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(), buf(enc.encode(body)));
  return `${body}.${toB64Url(new Uint8Array(sig))}`;
}

/** Devuelve el usuario de la sesión, o null si el token falta, está alterado, es inválido o expiró. */
export async function verifySession(
  token: string | undefined | null,
  now: number = Date.now()
): Promise<SessionUser | null> {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  try {
    const valid = await crypto.subtle.verify(
      'HMAC',
      await hmacKey(),
      buf(fromB64Url(parts[1])),
      buf(enc.encode(parts[0]))
    );
    if (!valid) return null;
    const p = JSON.parse(dec.decode(fromB64Url(parts[0])));
    if (
      typeof p.id !== 'number' ||
      typeof p.nombre !== 'string' ||
      typeof p.rol !== 'string' ||
      typeof p.exp !== 'number' ||
      p.exp * 1000 <= now
    ) {
      return null;
    }
    return { id: p.id, nombre: p.nombre, rol: p.rol };
  } catch (e) {
    // Un secreto ausente en producción debe verse en el log, no ocultarse como "sin sesión".
    if (e instanceof Error && e.message.includes('SESSION_SECRET')) throw e;
    return null;
  }
}
