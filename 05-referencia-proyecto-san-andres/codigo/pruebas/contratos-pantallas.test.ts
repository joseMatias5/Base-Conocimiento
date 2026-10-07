/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * CONTRATO con las pantallas: cada caso arma el JSON EXACTO que la pantalla manda (copiado de su código, con los
 * valores por defecto de sus formularios y con los campos de más que reenvía al hacer `{ ...objetoQueRecibió }`) y
 * comprueba dos cosas: que la API lo acepta, y que la respuesta tiene los campos que la pantalla lee.
 *
 * Por qué existe (L-031): un esquema más estricto rechazó el emoji que el formulario manda por defecto y la pantalla
 * no mostraba nada. Si una pantalla cambia lo que envía, hay que actualizar el caso correspondiente (y avisar si el
 * cambio rompe el contrato). Origen de cada payload: el archivo de la pantalla anotado en cada `describe`.
 *
 * Los casos "ida y vuelta" piden primero el GET real y reenvían lo recibido, como hacen las pantallas de edición.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeDb } from './helpers/fakeDb';
import { loginAs, resetCookies } from './helpers/session';
import { hashPin } from '@/lib/pin';

let db: ReturnType<typeof createFakeDb>;
vi.mock('@/lib/prisma', () => ({
  default: new Proxy({}, { get: (_t, prop) => (db.prisma as any)[prop] }),
}));
vi.mock('@/lib/events', () => ({ default: { emit: vi.fn(), on: vi.fn(() => () => {}) } }));
vi.mock('next/headers', async () => (await import('./helpers/session')).nextHeadersMock());

import * as PRODUCTOS from '@/app/api/productos/route';
import * as PROVEEDORES from '@/app/api/proveedores/route';
import * as COSTOS from '@/app/api/costos/route';
import * as INVENTARIO from '@/app/api/inventario/route';
import * as AJUSTE from '@/app/api/inventario/ajuste/route';
import * as MESAS from '@/app/api/mesas/route';
import * as MESA from '@/app/api/mesas/[id]/route';
import * as LAYOUT from '@/app/api/mesas/layout/route';
import * as PEDIDOS from '@/app/api/pedidos/route';
import * as ITEMS from '@/app/api/pedidos/[id]/items/route';
import * as CANCELAR from '@/app/api/pedidos/[id]/cancel/route';
import * as PAGAR from '@/app/api/checkout/pay/route';
import * as ANULAR from '@/app/api/ventas/[id]/anular/route';
import * as RECETA from '@/app/api/productos/[id]/receta/route';
import * as PIN from '@/app/api/admin/usuarios/[id]/pin/route';
import * as VERIFICAR_PIN from '@/app/api/auth/verify-pin/route';

const pedir = (method: string, body?: unknown, url = 'http://localhost/api/x') =>
  new Request(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
const conId = (id: number) => ({ params: Promise.resolve({ id: String(id) }) });
/** Lo que la pantalla recibe del GET: el JSON ya serializado, como llega por la red. */
const recibir = async (res: Response) => JSON.parse(JSON.stringify(await res.json()));

/** Comprueba el código HTTP y, si falla, muestra el cuerpo de la respuesta para ver el motivo. */
async function estado(res: Response, esperado: number) {
  const cuerpo = await res.clone().text();
  expect(res.status, `respuesta: ${cuerpo}`).toBe(esperado);
}

beforeEach(async () => {
  db = createFakeDb({
    usuarios: [
      { id: 1, nombre: 'Admin', pin: await hashPin('1111'), rol: 'ADMIN', activo: true },
      { id: 2, nombre: 'Mozo', pin: await hashPin('3333'), rol: 'MOZO', activo: true },
    ],
    categorias: [{ id: 1, nombre: 'Comidas', orden: 1 }],
    productos: [
      { id: 10, nombre: 'Milanesa', descripcion: 'Napolitana', precio: 720000, categoriaId: 1, disponible: true, imagen: '🍽️' },
      { id: 11, nombre: 'Gaseosa', descripcion: '', precio: 180000, categoriaId: 1, disponible: true, imagen: '' },
    ],
    proveedores: [{ id: 3, nombre: 'Distribuidora Sur', contacto: 'Ana', telefono: '1', email: 'ventas@distribuidorasur.com', direccion: 'X', notas: '' }],
    insumos: [{ id: 7, nombre: 'Harina', unidad: 'kg', stockActual: 10, stockMinimo: 5, precioUnitario: 90000, proveedorId: 3 }],
    costos: [{ id: 5, concepto: 'Alquiler', monto: 50000000, tipo: 'fijo', periodicidad: 'mensual' }],
    mesas: [
      { id: 1, numero: 1, capacidad: 4, sector: 'salon', forma: 'round', posX: 10, posY: 10, estado: 'libre', activa: true },
      { id: 2, numero: 2, capacidad: 4, sector: 'salon', forma: 'round', posX: 30, posY: 10, estado: 'ocupada', activa: true },
    ],
    pedidos: [
      {
        id: 100,
        mesaId: 2,
        estado: 'entregado',
        total: 900000,
        items: [{ id: 1, productoId: 10, cantidad: 1, precio: 720000, producto: { nombre: 'Milanesa' } }, { id: 2, productoId: 11, cantidad: 1, precio: 180000, producto: { nombre: 'Gaseosa' } }],
      },
    ],
  });
  resetCookies();
  await loginAs('ADMIN', 1);
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('Menú (src/app/admin/menu/page.tsx)', () => {
  it('editar: el formulario se arma con lo que devolvió el GET y se reenvía con el id', async () => {
    const lista = await recibir(await PRODUCTOS.GET(pedir('GET')));
    const p = lista.find((x: any) => x.id === 10);
    // abrirModal(producto): solo estos seis campos, más el id al guardar.
    const form = { nombre: p.nombre, descripcion: p.descripcion, precio: p.precio, categoriaId: p.categoriaId, disponible: p.disponible, imagen: p.imagen };
    const res = await PRODUCTOS.PUT(pedir('PUT', { id: p.id, ...form, precio: 80 }));
    await estado(res, 200);
    expect(await res.json()).toMatchObject({ id: 10, precio: 80, imagen: '🍽️' });
  });

  it('marcar como no disponible: solo { id, disponible: false }', async () => {
    await estado(await PRODUCTOS.PUT(pedir('PUT', { id: 10, disponible: false })), 200);
    expect(db.state.productos.find((x) => x.id === 10)!.disponible).toBe(false);
  });

  it('nuevo producto con los valores por defecto del formulario (emoji como imagen)', async () => {
    const res = await PRODUCTOS.POST(pedir('POST', { nombre: 'Flan', descripcion: '', precio: 3200, categoriaId: 1, disponible: true, imagen: '🍽️' }));
    await estado(res, 201);
  });

  it('nuevo producto sin completar (precio 0 por defecto): si se rechaza, el error es un texto que la pantalla muestra', async () => {
    const res = await PRODUCTOS.POST(pedir('POST', { nombre: 'Flan', descripcion: '', precio: 0, categoriaId: 1, disponible: true, imagen: '🍽️' }));
    if (res.status >= 400) expect(typeof (await res.json()).error).toBe('string');
    else await estado(res, 201);
  });

  it('receta (RecetaModal.tsx): { items: [{ insumoId, cantidad }] }', async () => {
    const res = await RECETA.PUT(pedir('PUT', { items: [{ insumoId: 7, cantidad: 0.25 }] }), conId(10));
    await estado(res, 200);
  });
});

describe('Proveedores (src/app/admin/proveedores/page.tsx)', () => {
  it('editar: ida y vuelta del GET con los seis campos del formulario', async () => {
    const lista = await recibir(await PROVEEDORES.GET(pedir('GET')));
    const prov = lista[0];
    const form = { nombre: prov.nombre, contacto: prov.contacto, telefono: prov.telefono, email: prov.email, direccion: prov.direccion, notas: prov.notas };
    await estado(await PROVEEDORES.PUT(pedir('PUT', { id: prov.id, ...form, telefono: '99' })), 200);
  });

  it('nuevo proveedor con el formulario vacío salvo el nombre', async () => {
    const res = await PROVEEDORES.POST(pedir('POST', { nombre: 'Nuevo', contacto: '', telefono: '', email: '', direccion: '', notas: '' }));
    await estado(res, 201);
  });
});

describe('Costos (src/app/admin/costos/page.tsx)', () => {
  it('nuevo costo con el formulario: { concepto, monto, tipo, periodicidad }', async () => {
    const res = await COSTOS.POST(pedir('POST', { concepto: 'Luz', monto: 15000.5, tipo: 'variable', periodicidad: 'mensual' }));
    await estado(res, 201);
    expect(await res.json()).toMatchObject({ concepto: 'Luz', monto: 15000.5 });
  });
});

describe('Inventario (src/app/admin/inventario/page.tsx)', () => {
  it('editar un insumo SIN cambiar el stock: la pantalla reenvía el insumo ENTERO del GET y se acepta', async () => {
    const lista = await recibir(await INVENTARIO.GET(pedir('GET')));
    const insumo = lista[0];
    const res = await INVENTARIO.PUT(pedir('PUT', { ...insumo, stockMinimo: 8 }));
    await estado(res, 200);
    expect(db.state.insumos[0].stockMinimo).toBe(8);
    expect(db.state.insumos[0].stockActual).toBe(10); // el stock no se tocó
  });

  it('PUT con otro stock sigue rechazado (la pantalla ya no lo manda desde el commit 16)', async () => {
    const lista = await recibir(await INVENTARIO.GET(pedir('GET')));
    const res = await INVENTARIO.PUT(pedir('PUT', { ...lista[0], stockActual: 12.5 }));
    await estado(res, 400);
    expect((await res.json()).error).toContain('Ajustar stock');
    expect(db.state.insumos[0].stockActual).toBe(10);
  });

  it('"Ajustar stock" (AjusteStockModal): POST /api/inventario/ajuste con { insumoId, delta, motivo }; suma y resta', async () => {
    const res = await AJUSTE.POST(pedir('POST', { insumoId: 7, delta: 2.5, motivo: 'Recuento del depósito' }));
    await estado(res, 200);
    expect(db.state.insumos[0].stockActual).toBe(12.5);
  });

  it('nuevo insumo como lo arma la pantalla (textos con coma decimal convertidos, proveedor vacío = null)', async () => {
    const numero = (v: string) => (v.trim() === '' ? 0 : Number(v.replace(',', '.')));
    const res = await INVENTARIO.POST(
      pedir('POST', {
        nombre: 'Aceite',
        unidad: 'litro',
        stockActual: numero('3,5'),
        stockMinimo: numero(''),
        precioUnitario: numero('1250,75'),
        proveedorId: null,
      }),
    );
    await estado(res, 201);
  });
  it('"Ajustar stock" rechaza un delta 0 y un motivo demasiado corto, sin tocar el stock', async () => {
    await estado(await AJUSTE.POST(pedir('POST', { insumoId: 7, delta: 0, motivo: 'Recuento del depósito' })), 400);
    await estado(await AJUSTE.POST(pedir('POST', { insumoId: 7, delta: 1, motivo: 'ok' })), 400);
    expect(db.state.insumos[0].stockActual).toBe(10);
  });
});

describe('Comandas: mesas (src/app/comandas/page.tsx)', () => {
  it('editar mesa: la pantalla reenvía la mesa entera del GET (con pedidos y demás) con un campo cambiado', async () => {
    const lista = await recibir(await MESAS.GET());
    const mesa = lista.find((m: any) => m.id === 1);
    const res = await MESA.PATCH(pedir('PATCH', { ...mesa, capacidad: 6 }), conId(1));
    await estado(res, 200);
    expect(db.state.mesas.find((m) => m.id === 1)!.capacidad).toBe(6);
  });

  it('nueva mesa: { numero, capacidad, sector, forma, posX: 50, posY: 50 }', async () => {
    const res = await MESAS.POST(pedir('POST', { numero: 3, capacidad: 4, sector: 'salon', forma: 'round', posX: 50, posY: 50 }));
    await estado(res, 200); // la pantalla solo mira res.ok
    expect(await res.json()).toMatchObject({ numero: 3, posX: 50, posY: 50 });
  });

  it('guardar el plano: { mesas: [{ id, posX, posY }] }', async () => {
    const res = await LAYOUT.PUT(pedir('PUT', { mesas: [{ id: 1, posX: 20, posY: 25 }, { id: 2, posX: 40, posY: 25 }] }));
    await estado(res, 200);
  });

  it('entrar al modo editor: verify-pin SIN módulo, y la respuesta trae user.rol', async () => {
    // La pantalla manda solo { pin } y lee data.user.rol === 'ADMIN'.
    db = createFakeDb({ usuarios: [{ id: 1, nombre: 'Admin', rol: 'ADMIN', activo: true, pin: '1111' }] });
    const res = await VERIFICAR_PIN.POST(pedir('POST', { pin: '1111' }));
    await estado(res, 200);
    expect((await res.json()).user.rol).toBe('ADMIN');
  });
});

describe('Comandas: pedido, cobro y anulación', () => {
  it('enviar comanda: cada ítem lleva los campos de más del carrito y notas "" (el servidor los ignora)', async () => {
    // enviarComanda(): items = comanda.map(item => ({ ...item, notas: notaItem[item.productoId] || '' }))
    const carrito = { productoId: 11, nombre: 'Gaseosa', precio: 1800, cantidad: 2, imagen: '', categoriaId: 1 };
    const res = await PEDIDOS.POST(pedir('POST', { mesaId: 1, items: [{ ...carrito, notas: '' }] }));
    await estado(res, 201);
    const pedido = await res.json();
    expect(pedido.total).toBe(3600); // precio del catálogo, no el que mandó la pantalla
  });

  it('cocina: cambiar estado { id, estado }', async () => {
    db.state.pedidos[0].estado = 'listo';
    const res = await PEDIDOS.PATCH(pedir('PATCH', { id: 100, estado: 'entregado' }));
    await estado(res, 200);
  });

  it('cocina: modificar ítems con las tres acciones y el motivo por defecto', async () => {
    const motivo = 'Modificado desde cocina';
    await estado(await ITEMS.PATCH(pedir('PATCH', { action: 'UPDATE_QUANTITY', motivo, itemId: 1, cantidad: 2 }), conId(100)), 200);
    await estado(await ITEMS.PATCH(pedir('PATCH', { action: 'ADD_ITEM', motivo, productoId: 11, cantidad: 1 }), conId(100)), 200);
    await estado(await ITEMS.PATCH(pedir('PATCH', { action: 'REMOVE_ITEM', motivo, itemId: 2 }), conId(100)), 200);
  });

  it('cocina: cancelar pedido { motivo }', async () => {
    const res = await CANCELAR.PATCH(pedir('PATCH', { motivo: 'El cliente se fue' }), conId(100));
    await estado(res, 200);
  });

  it('cobrar: { pedidoId, mesaId, metodoPago, propina } y la respuesta trae los dos tickets que la pantalla imprime', async () => {
    const res = await PAGAR.POST(pedir('POST', { pedidoId: 100, mesaId: 2, metodoPago: 'tarjeta', propina: 0 }));
    await estado(res, 200);
    const data = await res.json();
    // Campos que lee la pantalla (comandas/page.tsx → setTicketData) y los que imprime el ticket.
    expect(data.ticketCliente).toMatchObject({ tipo: 'CLIENTE', mesa: 2, total: 9000, metodoPago: 'tarjeta' });
    expect(data.ticketInterno).toMatchObject({ tipo: 'INTERNO', ventaId: expect.any(Number), total: 9000 });
    expect(Array.isArray(data.ticketCliente.items)).toBe(true);
    expect(data.ticketCliente.items[0]).toEqual(expect.objectContaining({ nombre: expect.any(String), cantidad: expect.any(Number), precioUnit: expect.any(Number), subtotal: expect.any(Number) }));
  });

  it('anular venta (admin/caja): { motivo }', async () => {
    const pago = await (await PAGAR.POST(pedir('POST', { pedidoId: 100, mesaId: 2 }))).json();
    const res = await ANULAR.POST(pedir('POST', { motivo: 'Error de carga' }), conId(pago.ticketInterno.ventaId));
    await estado(res, 200);
  });
});

describe('Administración de usuarios (src/app/admin/usuarios/page.tsx)', () => {
  it('cambiar PIN: { pin } de cuatro dígitos', async () => {
    const res = await PIN.PATCH(pedir('PATCH', { pin: '4321' }), conId(2));
    await estado(res, 200);
  });
});

describe('Errores: la forma que las pantallas muestran', () => {
  it('toda respuesta de error trae { error: string } no vacío (así lo lee enviar() en lib/api-cliente.ts)', async () => {
    const respuestas = await Promise.all([
      PRODUCTOS.POST(pedir('POST', { nombre: '' })),
      PROVEEDORES.POST(pedir('POST', {})),
      COSTOS.POST(pedir('POST', { concepto: '', monto: -1 })),
      INVENTARIO.POST(pedir('POST', { nombre: '' })),
      MESAS.POST(pedir('POST', { numero: -1 })),
      PEDIDOS.POST(pedir('POST', { mesaId: 1, items: [] })),
      PAGAR.POST(pedir('POST', { pedidoId: 0 })),
    ]);
    for (const res of respuestas) {
      await estado(res, 400);
      const data = await res.json();
      expect(typeof data.error).toBe('string');
      expect(data.error.length).toBeGreaterThan(0);
    }
  });
});
