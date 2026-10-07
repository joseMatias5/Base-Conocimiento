/**
 * Migración de esquema contra SQLite REAL (no la base simulada): se crea una base con el esquema anterior
 * (montos REAL en pesos), se cargan datos y se verifica que migrarBase() la deje igual a la que crearía
 * `prisma db push` con el esquema actual, con los montos convertidos a centavos y sin perder filas.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { COLUMNAS_MONTO, PASOS, migrarBase } from '@/lib/migraciones';

const raiz = join(__dirname, '..', '..');
const dir = mkdtempSync(join(tmpdir(), 'migraciones-'));
const urlDe = (archivo: string) => `file:${join(dir, archivo).replace(/\\/g, '/')}`;

function prismaCli(args: string[]) {
  return spawnSync('npx', ['prisma', ...args], { cwd: raiz, shell: true, encoding: 'utf8' });
}

async function crearBase(url: string, ddl: string) {
  const db = new PrismaClient({ datasourceUrl: url });
  const sentencias = ddl
    .split(/;\s*$/m)
    .map((s) => s.replace(/^--.*$/gm, '').trim())
    .filter(Boolean);
  for (const s of sentencias) await db.$executeRawUnsafe(s);
  return db;
}

async function tipos(db: PrismaClient, tabla: string) {
  const filas = await db.$queryRawUnsafe<{ name: string; type: string }[]>(`PRAGMA table_info("${tabla}")`);
  return Object.fromEntries(filas.map((f) => [f.name, f.type]));
}

afterAll(() => {
  try {
    rmSync(dir, { recursive: true, force: true });
  } catch {
    // En Windows el motor de Prisma puede tardar en soltar el archivo; es un directorio temporal.
  }
});

describe('migrarBase: montos en pesos (REAL) → centavos (INTEGER)', () => {
  const url = urlDe('vieja.db');
  let db: PrismaClient;
  let aplicados: string[];

  beforeAll(async () => {
    const ddlViejo = readFileSync(join(__dirname, 'fixtures', 'esquema-montos-en-pesos.sql'), 'utf8');
    db = await crearBase(url, ddlViejo);
    const ahora = `'2026-10-06 12:00:00'`;
    for (const sql of [
      `INSERT INTO "Usuario" (id, nombre, pin, rol) VALUES (1, 'Admin', 'x', 'ADMIN')`,
      `INSERT INTO "Mesa" (id, numero, updatedAt) VALUES (1, 1, ${ahora})`,
      `INSERT INTO "Categoria" (id, nombre, updatedAt) VALUES (1, 'Comidas', ${ahora})`,
      `INSERT INTO "Producto" (id, nombre, precio, categoriaId, updatedAt) VALUES (1, 'Milanesa', 1250.5, 1, ${ahora})`,
      `INSERT INTO "Producto" (id, nombre, precio, categoriaId, updatedAt) VALUES (2, 'Caramelo', 0.1, 1, ${ahora})`,
      `INSERT INTO "Pedido" (id, mesaId, estado, total, actualizadoEn) VALUES (1, 1, 'pagado', 1250.8, ${ahora})`,
      `INSERT INTO "ItemPedido" (id, pedidoId, productoId, cantidad, precio) VALUES (1, 1, 1, 1, 1250.5)`,
      `INSERT INTO "ItemPedido" (id, pedidoId, productoId, cantidad, precio) VALUES (2, 1, 2, 3, 0.1)`,
      `INSERT INTO "Venta" (id, pedidoId, mesaId, total, propina, numeroTicket) VALUES (1, 1, 1, 1270.79, 19.99, 'T-1')`,
      `INSERT INTO "Venta" (id, pedidoId, mesaId, total, propina, numeroTicket) VALUES (2, 1, 1, -1270.79, -19.99, 'A-1')`,
      `INSERT INTO "Proveedor" (id, nombre, updatedAt) VALUES (1, 'Don Pedro', ${ahora})`,
      `INSERT INTO "Insumo" (id, nombre, stockActual, precioUnitario, proveedorId, updatedAt) VALUES (1, 'Carne', 2.5, 3200.33, 1, ${ahora})`,
      `INSERT INTO "CostoFijo" (id, concepto, monto, updatedAt) VALUES (1, 'Alquiler', 450000, ${ahora})`,
      `INSERT INTO "HistorialPedido" (id, pedidoId, accion, detalle) VALUES (1, 1, 'COBRADO', 'ok')`,
    ]) {
      await db.$executeRawUnsafe(sql);
    }
    await db.$disconnect();

    aplicados = await migrarBase(url);
    db = new PrismaClient({ datasourceUrl: url });
  }, 60_000);

  afterAll(async () => {
    await db.$disconnect();
  });

  it('aplica los pasos de centavos y de recetas', () => {
    expect(aplicados).toEqual([
      'Montos de dinero en centavos enteros (AT-13)',
      'Recetas de productos y movimientos de stock (AT-12)',
    ]);
  });

  it('todas las columnas de dinero quedan INTEGER', async () => {
    for (const [tabla, montos] of Object.entries(COLUMNAS_MONTO)) {
      const t = await tipos(db, tabla);
      for (const col of montos) expect(`${tabla}.${col}=${t[col]}`).toBe(`${tabla}.${col}=INTEGER`);
    }
    // Las cantidades de stock NO son dinero: siguen siendo REAL.
    expect((await tipos(db, 'Insumo')).stockActual).toBe('REAL');
  });

  it('convierte los montos a centavos exactos (incluidos negativos de anulación)', async () => {
    const productos = await db.$queryRawUnsafe<{ id: number; precio: number }[]>(`SELECT id, precio FROM "Producto" ORDER BY id`);
    expect(productos.map((p) => Number(p.precio))).toEqual([125050, 10]);
    const ventas = await db.$queryRawUnsafe<{ total: number; propina: number }[]>(`SELECT total, propina FROM "Venta" ORDER BY id`);
    expect(ventas.map((v) => [Number(v.total), Number(v.propina)])).toEqual([[127079, 1999], [-127079, -1999]]);
    const [pedido] = await db.$queryRawUnsafe<{ total: number }[]>(`SELECT total FROM "Pedido"`);
    expect(Number(pedido.total)).toBe(125080);
    const items = await db.$queryRawUnsafe<{ precio: number }[]>(`SELECT precio FROM "ItemPedido" ORDER BY id`);
    expect(items.map((i) => Number(i.precio))).toEqual([125050, 10]);
    const [insumo] = await db.$queryRawUnsafe<{ precioUnitario: number; stockActual: number }[]>(`SELECT precioUnitario, stockActual FROM "Insumo"`);
    expect([Number(insumo.precioUnitario), Number(insumo.stockActual)]).toEqual([320033, 2.5]);
    const [costo] = await db.$queryRawUnsafe<{ monto: number }[]>(`SELECT monto FROM "CostoFijo"`);
    expect(Number(costo.monto)).toBe(45000000);
  });

  it('no pierde filas hijas (los ON DELETE CASCADE no se disparan al reconstruir)', async () => {
    const [{ n: items }] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*) AS n FROM "ItemPedido"`);
    const [{ n: historial }] = await db.$queryRawUnsafe<{ n: bigint }[]>(`SELECT COUNT(*) AS n FROM "HistorialPedido"`);
    expect([Number(items), Number(historial)]).toEqual([2, 1]);
    const rotas = await db.$queryRawUnsafe<unknown[]>(`PRAGMA foreign_key_check`);
    expect(rotas).toEqual([]);
  });

  it('el Prisma Client nuevo lee la base migrada', async () => {
    const venta = await db.venta.findUnique({ where: { id: 1 }, include: { pedido: { include: { items: true } } } });
    expect(venta?.total).toBe(127079);
    expect(venta?.pedido?.items).toHaveLength(2);
    // Los ids AUTOINCREMENT siguen desde el último existente.
    const nueva = await db.venta.create({ data: { total: 100, numeroTicket: 'T-2' } });
    expect(nueva.id).toBe(3);
  });

  it('queda idéntica al esquema actual (prisma migrate diff sin diferencias)', () => {
    const r = prismaCli(['migrate', 'diff', '--from-url', `"${url}"`, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']);
    expect(r.stdout + r.stderr).not.toMatch(/ALTER|CREATE|DROP|RedefineTables/);
    expect(r.status).toBe(0);
  }, 60_000);

  it('correrla de nuevo no hace nada', async () => {
    expect(await migrarBase(url)).toEqual([]);
  });
});

describe('migrarBase: base nueva creada con el esquema actual', () => {
  it('no la modifica', async () => {
    const url = urlDe('nueva.db');
    const r = prismaCli(['migrate', 'diff', '--from-empty', '--to-schema-datamodel', 'prisma/schema.prisma', '--script']);
    expect(r.status).toBe(0);
    const db = await crearBase(url, r.stdout);
    await db.$executeRawUnsafe(`INSERT INTO "CostoFijo" (concepto, monto, updatedAt) VALUES ('Luz', 8500000, '2026-10-06 12:00:00')`);
    await db.$disconnect();

    expect(await migrarBase(url)).toEqual([]);

    const db2 = new PrismaClient({ datasourceUrl: url });
    expect((await db2.costoFijo.findFirst())?.monto).toBe(8500000);
    await db2.$disconnect();
  }, 60_000);
});

describe('migrarBase: integridad', () => {
  const ddlViejo = () => readFileSync(join(__dirname, 'fixtures', 'esquema-montos-en-pesos.sql'), 'utf8');

  it('una fila huérfana que la base YA tenía no bloquea la migración', async () => {
    const url = urlDe('huerfana.db');
    const db = await crearBase(url, ddlViejo());
    await db.$executeRawUnsafe('PRAGMA foreign_keys = OFF');
    await db.$executeRawUnsafe(`INSERT INTO "Producto" (id, nombre, precio, categoriaId, updatedAt) VALUES (1, 'Huérfano', 10.5, 999, '2026-10-06 12:00:00')`);
    await db.$disconnect();

    expect(await migrarBase(url)).toHaveLength(2);
    const db2 = new PrismaClient({ datasourceUrl: url });
    const [p] = await db2.$queryRawUnsafe<{ precio: number }[]>(`SELECT precio FROM "Producto"`);
    expect(Number(p.precio)).toBe(1050);
    await db2.$disconnect();
  }, 60_000);

  it('si un paso deja claves foráneas NUEVAS rotas, hace rollback y la base queda como estaba', async () => {
    const url = urlDe('rollback.db');
    const db = await crearBase(url, ddlViejo());
    await db.$executeRawUnsafe(`INSERT INTO "Categoria" (id, nombre, updatedAt) VALUES (1, 'Comidas', '2026-10-06 12:00:00')`);
    await db.$executeRawUnsafe(`INSERT INTO "Producto" (id, nombre, precio, categoriaId, updatedAt) VALUES (1, 'Milanesa', 1250.5, 1, '2026-10-06 12:00:00')`);
    await db.$disconnect();

    const pasoRoto = {
      nombre: 'paso que rompe una relación',
      necesario: async () => true,
      sentencias: async () => [`UPDATE "Producto" SET "categoriaId" = 999`],
    };
    PASOS.push(pasoRoto);
    try {
      await expect(migrarBase(url)).rejects.toThrow(/claves foráneas inválidas: Producto/);
    } finally {
      PASOS.pop();
    }

    // El primer paso (centavos) se confirmó; el roto se deshizo entero.
    const db2 = new PrismaClient({ datasourceUrl: url });
    const [p] = await db2.$queryRawUnsafe<{ precio: number; categoriaId: number }[]>(`SELECT precio, categoriaId FROM "Producto"`);
    expect([Number(p.precio), Number(p.categoriaId)]).toEqual([125050, 1]);
    await db2.$disconnect();
  }, 60_000);
});

describe('migrarBase: base en centavos sin recetas (estado del commit 9)', () => {
  it('solo crea las tablas de recetas y movimientos, sin tocar los montos', async () => {
    const url = urlDe('commit9.db');
    const ddl = readFileSync(join(__dirname, 'fixtures', 'esquema-centavos-sin-recetas.sql'), 'utf8');
    const db = await crearBase(url, ddl);
    await db.$executeRawUnsafe(`INSERT INTO "CostoFijo" (concepto, monto, updatedAt) VALUES ('Luz', 8500050, '2026-10-06 12:00:00')`);
    await db.$disconnect();

    expect(await migrarBase(url)).toEqual(['Recetas de productos y movimientos de stock (AT-12)']);

    const db2 = new PrismaClient({ datasourceUrl: url });
    expect((await db2.costoFijo.findFirst())?.monto).toBe(8500050);
    expect(await db2.recetaItem.count()).toBe(0);
    await db2.$disconnect();

    const r = prismaCli(['migrate', 'diff', '--from-url', `"${url}"`, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']);
    expect(r.status).toBe(0);
  }, 60_000);
});

describe('migrarBase: movimientos de stock sin "detalle" (estado del commit 12)', () => {
  it('agrega la columna conservando los movimientos y queda igual al esquema', async () => {
    const url = urlDe('commit12.db');
    const ddl = readFileSync(join(__dirname, 'fixtures', 'esquema-movimientos-sin-detalle.sql'), 'utf8');
    const db = await crearBase(url, ddl);
    const t = `'2026-10-06 12:00:00'`;
    for (const sql of [
      `INSERT INTO "Insumo" (id, nombre, stockActual, updatedAt) VALUES (1, 'Carne', 23.8, ${t})`,
      `INSERT INTO "Venta" (id, total, numeroTicket) VALUES (1, 1000, 'T-1')`,
      `INSERT INTO "MovimientoStock" (id, insumoId, cantidad, motivo, ventaId) VALUES (1, 1, -1.2, 'VENTA', 1)`,
    ]) {
      await db.$executeRawUnsafe(sql);
    }
    await db.$disconnect();

    expect(await migrarBase(url)).toEqual(['Detalle en los movimientos de stock (ajustes manuales)']);

    const db2 = new PrismaClient({ datasourceUrl: url });
    expect(await db2.movimientoStock.findMany()).toEqual([
      expect.objectContaining({ id: 1, insumoId: 1, cantidad: -1.2, motivo: 'VENTA', ventaId: 1, detalle: '' }),
    ]);
    await db2.$disconnect();

    const r = prismaCli(['migrate', 'diff', '--from-url', `"${url}"`, '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']);
    expect(r.status).toBe(0);
    expect(await migrarBase(url)).toEqual([]);
  }, 60_000);
});
