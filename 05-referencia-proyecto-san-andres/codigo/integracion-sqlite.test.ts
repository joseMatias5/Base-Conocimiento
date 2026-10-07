/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Integración contra SQLite REAL (no la base simulada): las rutas de cobro, cancelación y anulación corren con el Prisma
 * Client de verdad sobre una base temporal con el esquema actual, y se disparan en paralelo para comprobar lo que el
 * mock no puede: transacciones, bloqueos del motor y unicidad bajo concurrencia.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

vi.mock('next/headers', async () => (await import('./helpers/session')).nextHeadersMock());
vi.mock('@/lib/events', () => ({ default: { emit: vi.fn(), on: vi.fn(() => () => {}) } }));

const raiz = join(__dirname, '..', '..');
const dir = mkdtempSync(join(tmpdir(), 'integracion-'));
const url = `file:${join(dir, 'pos.db').replace(/\\/g, '/')}`;

let db: PrismaClient;
let PAGAR: (r: Request) => Promise<Response>;
let CANCELAR: (r: Request, c: any) => Promise<Response>;
let ANULAR: (r: Request, c: any) => Promise<Response>;
// Se importa DESPUÉS de vi.resetModules(): las rutas y el helper tienen que compartir el mismo registro de cookies y el
// mismo secreto de sesión (en desarrollo es aleatorio por instancia del módulo).
let sesion: typeof import('./helpers/session');

const json = (body: unknown) =>
  new Request('http://localhost/api/x', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const ctx = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
const pagar = (pedidoId: number, mesaId = 1) => PAGAR(json({ pedidoId, mesaId, metodoPago: 'efectivo' }));
const cancelar = (pedidoId: number) => CANCELAR(json({ motivo: 'prueba' }), ctx(pedidoId));
const anular = (ventaId: number) => ANULAR(json({ motivo: 'prueba de anulación' }), ctx(ventaId));

beforeAll(async () => {
  // Base nueva con el esquema actual (el mismo SQL que usa `prisma db push`).
  const r = spawnSync('npx', ['prisma', 'migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script'], {
    cwd: raiz,
    shell: true,
    encoding: 'utf8',
  });
  expect(r.status).toBe(0);
  db = new PrismaClient({ datasourceUrl: url });
  for (const s of r.stdout.split(/;\s*$/m).map((x) => x.replace(/^--.*$/gm, '').trim()).filter(Boolean)) {
    await db.$executeRawUnsafe(s);
  }
  await db.usuario.create({ data: { id: 1, nombre: 'Admin', pin: 'x', rol: 'ADMIN' } });
  await db.categoria.create({ data: { id: 1, nombre: 'Comidas' } });
  await db.producto.create({ data: { id: 1, nombre: 'Milanesa', precio: 550000, categoriaId: 1 } });
  await db.insumo.create({ data: { id: 1, nombre: 'Carne', unidad: 'kg', stockActual: 100 } });
  await db.recetaItem.create({ data: { productoId: 1, insumoId: 1, cantidad: 0.2 } });

  // Las rutas usan el singleton de src/lib/prisma, que lee DATABASE_URL al importarse.
  process.env.DATABASE_URL = url;
  vi.resetModules();
  PAGAR = (await import('@/app/api/checkout/pay/route')).POST;
  CANCELAR = (await import('@/app/api/pedidos/[id]/cancel/route')).PATCH;
  ANULAR = (await import('@/app/api/ventas/[id]/anular/route')).POST;
  sesion = await import('./helpers/session');
}, 120_000);

afterAll(async () => {
  await db?.$disconnect();
  const { default: prisma } = await import('@/lib/prisma');
  await prisma.$disconnect();
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // En Windows el motor puede tardar en soltar el archivo; es un directorio temporal.
  }
});

let siguienteMesa = 1;
/** Mesa nueva con un pedido "entregado" de `cantidad` milanesas. */
async function pedidoListoParaCobrar(cantidad = 1) {
  const mesa = await db.mesa.create({ data: { numero: siguienteMesa++, estado: 'ocupada' } });
  const pedido = await db.pedido.create({
    data: {
      mesaId: mesa.id,
      estado: 'entregado',
      total: 550000 * cantidad,
      items: { create: [{ productoId: 1, cantidad, precio: 550000 }] },
    },
  });
  return { pedidoId: pedido.id, mesaId: mesa.id };
}
const stockCarne = async () => (await db.insumo.findUniqueOrThrow({ where: { id: 1 } })).stockActual;

beforeEach(async () => {
  sesion.resetCookies();
  await sesion.loginAs('ADMIN', 1, 'Admin');
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('integración SQLite: cobro concurrente del MISMO pedido', () => {
  it('5 cobros a la vez: una sola venta, un solo descuento de stock, y todos reciben la misma venta', async () => {
    const { pedidoId, mesaId } = await pedidoListoParaCobrar(2);
    const antes = await stockCarne();

    const respuestas = await Promise.all(Array.from({ length: 5 }, () => pagar(pedidoId, mesaId)));
    const datos = await Promise.all(respuestas.map((r) => r.json()));

    expect(respuestas.map((r) => r.status)).toEqual([200, 200, 200, 200, 200]);
    expect(new Set(datos.map((d) => d.venta.id)).size).toBe(1);
    expect(datos.filter((d) => !d.reintento)).toHaveLength(1);
    expect(await db.venta.count({ where: { pedidoId } })).toBe(1);
    expect(await stockCarne()).toBeCloseTo(antes - 0.4, 6);
    expect((await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado).toBe('pagado');
  }, 60_000);
});

describe('integración SQLite: cobros concurrentes de pedidos DISTINTOS', () => {
  it('8 cobros a la vez: 8 ventas con números de ticket únicos y correlativos', async () => {
    const pedidos = await Promise.all(Array.from({ length: 8 }, () => pedidoListoParaCobrar()));
    const respuestas = await Promise.all(pedidos.map((p) => pagar(p.pedidoId, p.mesaId)));

    expect(respuestas.map((r) => r.status)).toEqual(Array(8).fill(200));
    const tickets = (await db.venta.findMany({ where: { pedidoId: { in: pedidos.map((p) => p.pedidoId) } } })).map((v) => v.numeroTicket);
    expect(new Set(tickets).size).toBe(8);
  }, 60_000);
});

describe('integración SQLite: cobro contra cancelación', () => {
  it('a la vez: gana exactamente uno (pagado con venta, o cancelado sin venta), nunca los dos', async () => {
    for (let i = 0; i < 5; i++) {
      const { pedidoId, mesaId } = await pedidoListoParaCobrar();
      const [pago, cancelacion] = await Promise.all([pagar(pedidoId, mesaId), cancelar(pedidoId)]);
      const estado = (await db.pedido.findUniqueOrThrow({ where: { id: pedidoId } })).estado;
      const ventas = await db.venta.count({ where: { pedidoId } });

      if (estado === 'pagado') {
        expect([pago.status, cancelacion.status]).toEqual([200, 400]);
        expect(ventas).toBe(1);
      } else {
        expect(estado).toBe('cancelado');
        expect([pago.status, cancelacion.status]).toEqual([400, 200]);
        expect(ventas).toBe(0);
      }
    }
  }, 60_000);
});

describe('integración SQLite: anulación', () => {
  it('dos anulaciones a la vez de la misma venta: una sola anulación y el stock se reintegra una vez', async () => {
    const { pedidoId, mesaId } = await pedidoListoParaCobrar(3);
    const antes = await stockCarne();
    const venta = (await (await pagar(pedidoId, mesaId)).json()).venta;
    expect(await stockCarne()).toBeCloseTo(antes - 0.6, 6);

    const [a, b] = await Promise.all([anular(venta.id), anular(venta.id)]);

    expect([a.status, b.status].sort()).toEqual([200, 400]);
    expect(await db.venta.count({ where: { numeroControlInterno: `ANUL-V${venta.id}` } })).toBe(1);
    expect(await stockCarne()).toBeCloseTo(antes, 6);
    expect(await db.movimientoStock.count({ where: { motivo: 'ANULACION' } })).toBe(1);
  }, 60_000);

  it('después de anular, volver a cobrar el mismo pedido no lo trata como reintento (400)', async () => {
    const { pedidoId, mesaId } = await pedidoListoParaCobrar();
    const venta = (await (await pagar(pedidoId, mesaId)).json()).venta;
    expect((await anular(venta.id)).status).toBe(200);
    expect((await pagar(pedidoId, mesaId)).status).toBe(400);
    expect(await db.venta.count({ where: { pedidoId } })).toBe(2); // la venta y su asiento inverso
  }, 60_000);
});
