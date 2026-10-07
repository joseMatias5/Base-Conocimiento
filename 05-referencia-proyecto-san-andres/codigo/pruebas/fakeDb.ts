/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Base de datos en memoria que imita lo mínimo de Prisma que usan las rutas bajo prueba.
 *
 * LIMITACIÓN (importante): modela SQLite con un único escritor (las transacciones se serializan
 * con un mutex) y rollback completo ante una excepción. NO reemplaza una prueba contra SQLite real:
 * valida la lógica de la ruta, no el comportamiento del motor.
 *
 * Los pedidos del seed pueden traer `items` embebidos (cada uno con `producto: { nombre }` opcional);
 * se normalizan a las tablas `items` y `productos`.
 */
import { usuarioDeLaCookie } from './session';

type Row = Record<string, any>;
type Seed = Partial<
  Record<
    | 'pedidos'
    | 'mesas'
    | 'usuarios'
    | 'ventas'
    | 'historial'
    | 'productos'
    | 'items'
    | 'categorias'
    | 'costos'
    | 'proveedores'
    | 'insumos'
    | 'recetas'
    | 'movimientos',
    Row[]
  >
>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([key, cond]) => {
    const value = row[key];
    if (cond !== null && typeof cond === 'object' && !(cond instanceof Date)) {
      if ('in' in cond) return cond.in.includes(value);
      if ('notIn' in cond) return !cond.notIn.includes(value);
      if ('not' in cond) return value !== cond.not;
      if ('startsWith' in cond) return typeof value === 'string' && value.startsWith(cond.startsWith);
      if (['gte', 'gt', 'lte', 'lt'].some((k) => k in cond)) {
        // Rangos combinados (p. ej. { gte: inicio, lt: fin }): se cumplen todos los límites presentes.
        return (
          (!('gte' in cond) || value >= cond.gte) &&
          (!('gt' in cond) || value > cond.gt) &&
          (!('lte' in cond) || value <= cond.lte) &&
          (!('lt' in cond) || value < cond.lt)
        );
      }
      if ('contains' in cond) return typeof value === 'string' && value.toLowerCase().includes(String(cond.contains).toLowerCase());
    }
    return value === cond;
  });
}

export function createFakeDb(seed: Seed = {}) {
  const state = {
    pedidos: [] as Row[],
    mesas: [...(seed.mesas ?? [])] as Row[],
    // Usuarios sembrados: activos salvo que el test diga lo contrario (como el default de Prisma).
    usuarios: (seed.usuarios ?? []).map((u) => ({ activo: true, ...u })) as Row[],
    ventas: [...(seed.ventas ?? [])] as Row[],
    historial: [...(seed.historial ?? [])] as Row[],
    productos: [...(seed.productos ?? [])] as Row[],
    items: [...(seed.items ?? [])] as Row[],
    categorias: [...(seed.categorias ?? [])] as Row[],
    costos: [...(seed.costos ?? [])] as Row[],
    proveedores: [...(seed.proveedores ?? [])] as Row[],
    insumos: [...(seed.insumos ?? [])] as Row[],
    recetas: [...(seed.recetas ?? [])] as Row[],
    movimientos: [...(seed.movimientos ?? [])] as Row[],
  };
  let nextId = 1000;
  const failOn = new Set<string>();

  const addPedido = (p: Row) => {
    const { items = [], ...pedido } = p;
    state.pedidos.push(pedido);
    for (const it of items) {
      const { producto, ...item } = it;
      if (producto && !state.productos.some((x) => x.id === item.productoId)) {
        state.productos.push({ id: item.productoId, disponible: true, precio: item.precio, ...producto });
      }
      state.items.push({ id: nextId++, pedidoId: pedido.id, notas: '', ...item });
    }
  };
  (seed.pedidos ?? []).forEach(addPedido);

  const aplicar = (row: Row, data: Row) => {
    for (const [k, v] of Object.entries(data)) {
      row[k] = v && typeof v === 'object' && 'increment' in (v as any) ? row[k] + (v as any).increment : v;
    }
  };

  // Restricción única de Mesa.numero (la base real devuelve el error P2002).
  const verificarNumeroUnico = (id: number | undefined, numero: unknown) => {
    if (numero !== undefined && state.mesas.some((m) => m.id !== id && m.numero === numero)) {
      throw Object.assign(new Error('Unique constraint failed on numero'), { code: 'P2002' });
    }
  };

  const noExiste = (que: string) => Object.assign(new Error(`${que} no existe`), { code: 'P2025' });
  const buscar = (tabla: Row[], where: Row) => tabla.find((r) => matches(r, where));
  // Imita `select` de Prisma: solo las columnas pedidas (sin select, la fila completa).
  const elegir = (row: Row | undefined, select?: Row) =>
    row && select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]])) : row && { ...row };
  const sinUndefined = (data: Row) => Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined));
  const productoConRel = (p: Row | undefined, include?: Row) =>
    p
      ? {
          ...p,
          ...(include?.categoria ? { categoria: state.categorias.find((c) => c.id === p.categoriaId) ?? null } : {}),
        }
      : null;
  const insumoConRel = (i: Row | undefined, include?: Row) =>
    i
      ? {
          ...i,
          ...(include?.proveedor ? { proveedor: state.proveedores.find((p) => p.id === i.proveedorId) ?? null } : {}),
        }
      : null;

  const guard = (name: string) => {
    if (failOn.has(name)) throw new Error(`fallo simulado en ${name}`);
  };

  const itemWithRel = (it: Row, include?: Row) => ({
    ...it,
    ...(include?.producto ? { producto: state.productos.find((p) => p.id === it.productoId) } : {}),
  });

  const withRelations = (p: Row | undefined, include?: Row) => {
    if (!p) return null;
    const out: Row = { ...p };
    if (include?.mesa) out.mesa = state.mesas.find((m) => m.id === p.mesaId);
    if (include?.historial) out.historial = state.historial.filter((h) => h.pedidoId === p.id).map((h) => ({ ...h }));
    if (include?.items) {
      out.items = state.items
        .filter((i) => i.pedidoId === p.id)
        .map((i) => itemWithRel(i, include.items.include));
    }
    return out;
  };

  const api: any = {
    pedido: {
      updateMany: async ({ where, data }: any) => {
        const rows = state.pedidos.filter((r) => matches(r, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
      findUnique: async ({ where, include, select }: any) => {
        const row = state.pedidos.find((r) => matches(r, where));
        if (select && row) return { id: row.id, estado: row.estado };
        return withRelations(row, include);
      },
      create: async ({ data, include }: any) => {
        guard('pedido.create');
        const { items, ...rest } = data;
        const row = { id: nextId++, ...rest };
        state.pedidos.push(row);
        for (const it of items?.create ?? []) state.items.push({ id: nextId++, pedidoId: row.id, ...it });
        return withRelations(row, include);
      },
      update: async ({ where, data, include }: any) => {
        const row = state.pedidos.find((r) => matches(r, where));
        if (!row) throw new Error('Pedido no existe');
        Object.assign(row, data);
        return withRelations(row, include);
      },
      count: async ({ where }: any) => state.pedidos.filter((r) => matches(r, where)).length,
      findMany: async ({ where, include }: any = {}) => {
        const { mesa, ...resto } = where ?? {};
        return state.pedidos
          .filter((r) => matches(r, resto))
          .filter((r) => !mesa || state.mesas.find((m) => m.id === r.mesaId)?.numero === mesa.numero)
          .map((r) => withRelations(r, include));
      },
    },
    itemPedido: {
      create: async ({ data }: any) => {
        guard('itemPedido.create');
        const row = { id: nextId++, ...data };
        state.items.push(row);
        return row;
      },
      findUnique: async ({ where, include }: any) => {
        const row = state.items.find((r) => matches(r, where));
        return row ? itemWithRel(row, include) : null;
      },
      findMany: async ({ where }: any) => state.items.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      count: async ({ where }: any = {}) => state.items.filter((r) => matches(r, where)).length,
      update: async ({ where, data }: any) => {
        const row = state.items.find((r) => matches(r, where));
        if (!row) throw new Error('Item no existe');
        Object.assign(row, data);
        return row;
      },
      delete: async ({ where }: any) => {
        const idx = state.items.findIndex((r) => matches(r, where));
        if (idx < 0) throw new Error('Item no existe');
        return state.items.splice(idx, 1)[0];
      },
    },
    categoria: {
      findUnique: async ({ where }: any) => buscar(state.categorias, where) ?? null,
      findMany: async ({ where }: any = {}) => state.categorias.filter((r) => matches(r, where)).map((r) => ({ ...r })),
    },
    producto: {
      findMany: async ({ where, include }: any = {}) =>
        state.productos.filter((r) => matches(r, where)).map((r) => productoConRel(r, include)),
      findUnique: async ({ where, include }: any) => productoConRel(buscar(state.productos, where), include),
      create: async ({ data, include }: any) => {
        guard('producto.create');
        const row = { id: nextId++, disponible: true, descripcion: '', imagen: '', ...data };
        state.productos.push(row);
        return productoConRel(row, include);
      },
      update: async ({ where, data, include }: any) => {
        const row = buscar(state.productos, where);
        if (!row) throw noExiste('Producto');
        Object.assign(row, sinUndefined(data));
        return productoConRel(row, include);
      },
      delete: async ({ where }: any) => {
        const idx = state.productos.findIndex((r) => matches(r, where));
        if (idx < 0) throw noExiste('Producto');
        return state.productos.splice(idx, 1)[0];
      },
    },
    costoFijo: {
      findMany: async () => state.costos.map((r) => ({ ...r })),
      create: async ({ data }: any) => {
        const row = { id: nextId++, ...data };
        state.costos.push(row);
        return { ...row };
      },
      delete: async ({ where }: any) => {
        const idx = state.costos.findIndex((r) => matches(r, where));
        if (idx < 0) throw noExiste('Costo');
        return state.costos.splice(idx, 1)[0];
      },
    },
    proveedor: {
      findMany: async () => state.proveedores.map((r) => ({ ...r, _count: { insumos: 0 } })),
      findUnique: async ({ where }: any) => buscar(state.proveedores, where) ?? null,
      create: async ({ data }: any) => {
        const row = { id: nextId++, ...data };
        state.proveedores.push(row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const row = buscar(state.proveedores, where);
        if (!row) throw noExiste('Proveedor');
        Object.assign(row, sinUndefined(data));
        return { ...row };
      },
      delete: async ({ where }: any) => {
        const idx = state.proveedores.findIndex((r) => matches(r, where));
        if (idx < 0) throw noExiste('Proveedor');
        return state.proveedores.splice(idx, 1)[0];
      },
    },
    insumo: {
      findMany: async ({ where, include }: any = {}) =>
        state.insumos.filter((r) => matches(r, where)).map((r) => insumoConRel(r, include)),
      findUnique: async ({ where }: any) => {
        const row = buscar(state.insumos, where);
        return row ? { ...row } : null;
      },
      create: async ({ data, include }: any) => {
        const row = { id: nextId++, ...data };
        state.insumos.push(row);
        return insumoConRel(row, include);
      },
      update: async ({ where, data, include }: any) => {
        const row = buscar(state.insumos, where);
        if (!row) throw noExiste('Insumo');
        Object.assign(row, sinUndefined(data));
        return insumoConRel(row, include);
      },
      delete: async ({ where }: any) => {
        const idx = state.insumos.findIndex((r) => matches(r, where));
        if (idx < 0) throw noExiste('Insumo');
        return state.insumos.splice(idx, 1)[0];
      },
    },
    recetaItem: {
      findMany: async ({ where, include }: any = {}) =>
        state.recetas
          .filter((r) => matches(r, where))
          .sort((a, b) => a.id - b.id)
          .map((r) => ({
            ...r,
            ...(include?.insumo ? { insumo: elegir(state.insumos.find((i) => i.id === r.insumoId), include.insumo.select) } : {}),
          })),
      deleteMany: async ({ where }: any) => {
        const antes = state.recetas.length;
        state.recetas.splice(0, antes, ...state.recetas.filter((r) => !matches(r, where)));
        return { count: antes - state.recetas.length };
      },
      createMany: async ({ data }: any) => {
        guard('recetaItem.createMany');
        for (const d of data) state.recetas.push({ id: nextId++, ...d });
        return { count: data.length };
      },
    },
    movimientoStock: {
      findMany: async ({ where }: any = {}) => state.movimientos.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      count: async ({ where }: any = {}) => state.movimientos.filter((r) => matches(r, where)).length,
      create: async ({ data }: any) => {
        guard('movimientoStock.create');
        const row = { id: nextId++, createdAt: new Date(), ...data };
        state.movimientos.push(row);
        return { ...row };
      },
    },
    venta: {
      count: async ({ where }: any) => state.ventas.filter((r) => matches(r, where)).length,
      findMany: async ({ where }: any = {}) => state.ventas.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      findUnique: async ({ where }: any) => {
        const row = state.ventas.find((r) => matches(r, where));
        return row ? { ...row } : null;
      },
      updateMany: async ({ where, data }: any) => {
        const rows = state.ventas.filter((r) => matches(r, where));
        rows.forEach((r) => aplicar(r, data));
        return { count: rows.length };
      },
      create: async ({ data }: any) => {
        guard('venta.create');
        const row = { id: nextId++, fechaCobro: new Date(), ...data };
        state.ventas.push(row);
        return row;
      },
    },
    mesa: {
      findUnique: async ({ where }: any) => {
        const row = state.mesas.find((r) => matches(r, where));
        return row ? { ...row } : null;
      },
      findMany: async ({ where }: any = {}) => state.mesas.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      create: async ({ data }: any) => {
        guard('mesa.create');
        verificarNumeroUnico(undefined, data.numero);
        const row = { id: nextId++, estado: 'libre', activa: true, ...data };
        state.mesas.push(row);
        return { ...row };
      },
      update: async ({ where, data }: any) => {
        const row = state.mesas.find((r) => matches(r, where));
        if (!row) throw new Error('Mesa no existe');
        verificarNumeroUnico(row.id, data.numero);
        Object.assign(row, Object.fromEntries(Object.entries(data).filter(([, v]) => v !== undefined)));
        return { ...row };
      },
      updateMany: async ({ where, data }: any) => {
        const rows = state.mesas.filter((r) => matches(r, where));
        rows.forEach((r) => aplicar(r, data));
        return { count: rows.length };
      },
      delete: async ({ where }: any) => {
        const idx = state.mesas.findIndex((r) => matches(r, where));
        if (idx < 0) throw new Error('Mesa no existe');
        return state.mesas.splice(idx, 1)[0];
      },
    },
    usuario: {
      findUnique: async ({ where }: any) => {
        const row = state.usuarios.find((r) => matches(r, where));
        if (row) {
          // Un usuario sembrado sin rol toma el de la sesión (tests anteriores a que requireAuth leyera la base).
          const sesion = usuarioDeLaCookie();
          return { ...row, rol: row.rol ?? (sesion?.id === row.id ? sesion.rol : undefined) };
        }
        // Tests que no siembran usuarios: el usuario con el que se inició sesión existe y está activo.
        // Si el test siembra usuarios, solo existen esos (así se puede probar un usuario desactivado o borrado).
        const sesion = usuarioDeLaCookie();
        if (!seed.usuarios && sesion && where?.id === sesion.id) return { ...sesion, activo: true };
        return null;
      },
      findMany: async ({ where }: any = {}) => state.usuarios.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      update: async ({ where, data }: any) => {
        const row = state.usuarios.find((r) => matches(r, where));
        if (!row) throw new Error('Usuario no existe');
        Object.assign(row, data);
        return row;
      },
    },
    historialPedido: {
      findMany: async ({ where }: any = {}) => state.historial.filter((r) => matches(r, where)).map((r) => ({ ...r })),
      create: async ({ data }: any) => {
        const row = { id: nextId++, ...data };
        state.historial.push(row);
        return row;
      },
    },
  };

  // Mutex: una transacción a la vez (single-writer), con rollback si lanza.
  let lock: Promise<unknown> = Promise.resolve();
  api.$transaction = (cb: (tx: any) => Promise<unknown>) => {
    const run = async () => {
      const snapshot = structuredClone(state);
      try {
        return await cb(api);
      } catch (e) {
        (Object.keys(snapshot) as (keyof typeof state)[]).forEach((k) => {
          state[k].splice(0, state[k].length, ...snapshot[k]);
        });
        throw e;
      }
    };
    const result = lock.then(run, run);
    lock = result.catch(() => undefined);
    return result;
  };

  return { prisma: api, state, failOn, addPedido };
}
