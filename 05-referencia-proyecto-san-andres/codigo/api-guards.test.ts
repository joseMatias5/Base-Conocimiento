/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Matriz de permisos de TODA la API. Es a la vez prueba y documentación del modelo de roles:
 *   sin sesión -> 401 | rol no permitido -> 403 | rol permitido -> pasa el guard (no 401/403).
 * El guard se ejecuta antes que cualquier acceso a datos, por eso Prisma queda sin simular, salvo la búsqueda del
 * usuario de la sesión que hace el propio guard (requireAuth verifica en la base que siga activo).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loginAs, logout, resetCookies } from './helpers/session';

vi.mock('@/lib/prisma', async () => {
  const { usuarioDeLaCookie } = await import('./helpers/session');
  const usuario = {
    findUnique: async ({ where }: any) => {
      const u = usuarioDeLaCookie();
      return u && u.id === where.id ? { ...u, activo: true } : null;
    },
  };
  return { default: { usuario }, prisma: { usuario } };
});
vi.mock('@/lib/events', () => ({ default: { emit: vi.fn(), on: vi.fn(() => () => {}) } }));
vi.mock('next/headers', async () => (await import('./helpers/session')).nextHeadersMock());

const ROLES = ['ADMIN', 'COCINERO', 'MOZO'] as const;
const ADMIN = ['ADMIN'];
const SALA = ['ADMIN', 'MOZO'];
const COCINA = ['ADMIN', 'COCINERO'];
const TODOS = ['ADMIN', 'COCINERO', 'MOZO'];

type Caso = [ruta: string, metodo: string, permitidos: string[], cargar: () => Promise<any>];

const CASOS: Caso[] = [
  ['/api/admin/usuarios', 'GET', ADMIN, () => import('@/app/api/admin/usuarios/route')],
  ['/api/admin/usuarios/[id]/pin', 'PATCH', ADMIN, () => import('@/app/api/admin/usuarios/[id]/pin/route')],
  ['/api/auth/check-admin-pin', 'POST', TODOS, () => import('@/app/api/auth/check-admin-pin/route')],
  ['/api/caja', 'GET', ADMIN, () => import('@/app/api/caja/route')],
  ['/api/categorias', 'GET', TODOS, () => import('@/app/api/categorias/route')],
  ['/api/checkout/pay', 'POST', SALA, () => import('@/app/api/checkout/pay/route')],
  ['/api/costos', 'GET', ADMIN, () => import('@/app/api/costos/route')],
  ['/api/costos', 'POST', ADMIN, () => import('@/app/api/costos/route')],
  ['/api/costos', 'DELETE', ADMIN, () => import('@/app/api/costos/route')],
  ['/api/events', 'GET', TODOS, () => import('@/app/api/events/route')],
  ['/api/hub-metrics', 'GET', TODOS, () => import('@/app/api/hub-metrics/route')],
  ['/api/inventario', 'GET', ADMIN, () => import('@/app/api/inventario/route')],
  ['/api/inventario', 'POST', ADMIN, () => import('@/app/api/inventario/route')],
  ['/api/inventario', 'PUT', ADMIN, () => import('@/app/api/inventario/route')],
  ['/api/inventario/ajuste', 'POST', ADMIN, () => import('@/app/api/inventario/ajuste/route')],
  ['/api/inventario', 'DELETE', ADMIN, () => import('@/app/api/inventario/route')],
  ['/api/mesas', 'GET', TODOS, () => import('@/app/api/mesas/route')],
  ['/api/mesas', 'POST', ADMIN, () => import('@/app/api/mesas/route')],
  ['/api/mesas', 'PATCH', SALA, () => import('@/app/api/mesas/route')],
  ['/api/mesas/[id]', 'PATCH', ADMIN, () => import('@/app/api/mesas/[id]/route')],
  ['/api/mesas/[id]', 'DELETE', ADMIN, () => import('@/app/api/mesas/[id]/route')],
  ['/api/mesas/layout', 'PUT', ADMIN, () => import('@/app/api/mesas/layout/route')],
  ['/api/metricas', 'GET', ADMIN, () => import('@/app/api/metricas/route')],
  ['/api/pedidos', 'GET', TODOS, () => import('@/app/api/pedidos/route')],
  ['/api/pedidos', 'POST', SALA, () => import('@/app/api/pedidos/route')],
  ['/api/pedidos', 'PATCH', COCINA, () => import('@/app/api/pedidos/route')],
  ['/api/pedidos/history', 'GET', TODOS, () => import('@/app/api/pedidos/history/route')],
  ['/api/pedidos/[id]/cancel', 'PATCH', COCINA, () => import('@/app/api/pedidos/[id]/cancel/route')],
  ['/api/pedidos/[id]/history', 'GET', TODOS, () => import('@/app/api/pedidos/[id]/history/route')],
  ['/api/pedidos/[id]/items', 'PATCH', COCINA, () => import('@/app/api/pedidos/[id]/items/route')],
  ['/api/productos', 'GET', TODOS, () => import('@/app/api/productos/route')],
  ['/api/productos', 'POST', ADMIN, () => import('@/app/api/productos/route')],
  ['/api/productos', 'PUT', ADMIN, () => import('@/app/api/productos/route')],
  ['/api/productos/[id]/receta', 'GET', ADMIN, () => import('@/app/api/productos/[id]/receta/route')],
  ['/api/productos/[id]/receta', 'PUT', ADMIN, () => import('@/app/api/productos/[id]/receta/route')],
  ['/api/productos', 'DELETE', ADMIN, () => import('@/app/api/productos/route')],
  ['/api/proveedores', 'GET', ADMIN, () => import('@/app/api/proveedores/route')],
  ['/api/proveedores', 'POST', ADMIN, () => import('@/app/api/proveedores/route')],
  ['/api/proveedores', 'PUT', ADMIN, () => import('@/app/api/proveedores/route')],
  ['/api/proveedores', 'DELETE', ADMIN, () => import('@/app/api/proveedores/route')],
  ['/api/upload', 'POST', ADMIN, () => import('@/app/api/upload/route')],
  ['/api/ventas/[id]/anular', 'POST', ADMIN, () => import('@/app/api/ventas/[id]/anular/route')],
];

/** Invoca el handler; si lanza (Prisma sin simular) significa que SÍ pasó el guard. */
async function invocar(caso: Caso) {
  const [ruta, metodo, , cargar] = caso;
  const handler = (await cargar())[metodo];
  expect(handler, `${metodo} ${ruta} no existe`).toBeTypeOf('function');
  const req = new Request('http://localhost' + ruta.replace('[id]', '1'), { method: metodo });
  try {
    const res: Response = await handler(req, { params: Promise.resolve({ id: '1' }) });
    // Cortar streams (SSE) para no dejar temporizadores abiertos.
    await res.body?.cancel().catch(() => {});
    return res.status;
  } catch {
    return 'paso-el-guard';
  }
}

beforeEach(() => {
  resetCookies();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('matriz de permisos de la API', () => {
  it('cubre todas las rutas del proyecto (si agregás una ruta nueva, agregala acá)', async () => {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const raiz = path.resolve(__dirname, '../app/api');
    const rutas: string[] = [];
    const recorrer = (dir: string) => {
      for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) recorrer(p);
        else if (e.name === 'route.ts') {
          const src = fs.readFileSync(p, 'utf8');
          const url = '/api/' + path.relative(raiz, path.dirname(p)).split(path.sep).join('/');
          for (const m of src.matchAll(/export async function (GET|POST|PUT|PATCH|DELETE)/g)) {
            rutas.push(`${m[1]} ${url.replace(/\/$/, '')}`);
          }
        }
      }
    };
    recorrer(raiz);

    // Rutas deliberadamente públicas (login, sesión y logout). /api/hub-metrics dejó de serlo.
    const PUBLICAS = ['POST /api/auth/verify-pin', 'GET /api/auth/session', 'POST /api/auth/logout'];
    const cubiertas = CASOS.map(([r, m]) => `${m} ${r}`);
    const sinCubrir = rutas.filter((r) => !cubiertas.includes(r) && !PUBLICAS.includes(r));

    expect(sinCubrir).toEqual([]);
  });

  describe.each(CASOS.map((c) => [`${c[1]} ${c[0]}`, c] as const))('%s', (_nombre, caso) => {
    const [, , permitidos] = caso;

    it('401 sin sesión', async () => {
      logout();
      expect(await invocar(caso)).toBe(401);
    });

    it('401 con una cookie fabricada a mano (rol ADMIN en JSON plano)', async () => {
      const { cookieJar } = await import('./helpers/session');
      cookieJar.session = JSON.stringify({ id: 1, nombre: 'x', rol: 'ADMIN' });
      expect(await invocar(caso)).toBe(401);
    });

    for (const rol of ROLES) {
      if (permitidos.includes(rol)) {
        it(`${rol}: permitido`, async () => {
          await loginAs(rol, 1);
          const r = await invocar(caso);
          expect([401, 403]).not.toContain(r);
        });
      } else {
        it(`${rol}: 403`, async () => {
          await loginAs(rol, 1);
          expect(await invocar(caso)).toBe(403);
        });
      }
    }

    it('un rol desconocido nunca tiene acceso a rutas restringidas', async () => {
      await loginAs('CAJERO', 1);
      const r = await invocar(caso);
      if (permitidos.length === 3) expect([401, 403]).not.toContain(r); // rutas "cualquier sesión válida"
      else expect(r).toBe(403);
    });
  });
});
