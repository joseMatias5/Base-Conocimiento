import { NextResponse } from 'next/server';
import { cookies, headers } from 'next/headers';
import prisma from '@/lib/prisma';
import { origenPermitido } from '@/lib/origen';
import { SESSION_COOKIE, verifySession, type SessionUser } from '@/lib/session';

export type Rol = 'ADMIN' | 'COCINERO' | 'MOZO';

export type AuthResult =
  | { ok: true; session: SessionUser }
  | { ok: false; response: NextResponse };

/**
 * Usuario de un token de sesión, SOLO si sigue vigente: firma válida, no vencido, y el usuario todavía existe y
 * está activo en la base. El rol y el nombre se toman de la base (no del token), así que desactivar a un usuario
 * o cambiarle el rol tiene efecto en la siguiente petición, sin esperar a que venza la cookie (12 h).
 */
export async function sesionVigente(token: string | undefined | null): Promise<SessionUser | null> {
  const firmada = await verifySession(token);
  if (!firmada) return null;
  const usuario = await prisma.usuario.findUnique({
    where: { id: firmada.id },
    select: { id: true, nombre: true, rol: true, activo: true },
  });
  if (!usuario || !usuario.activo) return null;
  return { id: usuario.id, nombre: usuario.nombre, rol: usuario.rol };
}

/**
 * Exige: petición del mismo origen (CSRF), sesión vigente y, opcionalmente, uno de los roles indicados.
 * Uso:  const auth = await requireAuth(['ADMIN']); if (!auth.ok) return auth.response;
 */
export async function requireAuth(roles?: readonly Rol[]): Promise<AuthResult> {
  if (!origenPermitido(await headers())) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'Origen de la petición no permitido' }, { status: 403 }),
    };
  }
  const store = await cookies();
  const session = await sesionVigente(store.get(SESSION_COOKIE)?.value);
  if (!session) {
    return { ok: false, response: NextResponse.json({ success: false, error: 'No autenticado' }, { status: 401 }) };
  }
  if (roles && !roles.includes(session.rol as Rol)) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: 'No autorizado para esta acción' }, { status: 403 }),
    };
  }
  return { ok: true, session };
}
