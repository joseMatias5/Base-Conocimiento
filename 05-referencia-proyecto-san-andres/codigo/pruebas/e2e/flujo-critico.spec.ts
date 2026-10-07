import { expect, test } from '@playwright/test';
import { json, sesionDe } from './ayudas';

/**
 * Recorrido de negocio completo sobre la app REAL (producción, SQLite temporal, sesiones firmadas de verdad):
 * mozo toma el pedido → cocina lo prepara → se sirve → mozo cobra → (reintento idempotente) → solo el admin anula.
 * Los valores esperados son literales (precios del seed: Papas Fritas $3.200, Coca-Cola 500ml $1.800).
 * No se repite acá cada regla (están en los tests de rutas): este test prueba que las piezas funcionan juntas.
 */
test('pedido → cocina → cobro → anulación, con tres roles y la base real', async ({ playwright, baseURL }) => {
  const mozo = await sesionDe(playwright, baseURL!, 'MOZO');
  const cocina = await sesionDe(playwright, baseURL!, 'COCINERO');
  const admin = await sesionDe(playwright, baseURL!, 'ADMIN');

  // Mesa libre y productos del catálogo.
  const mesas = (await (await mozo.get('/api/mesas')).json()) as { id: number; numero: number; pedidos: unknown[] }[];
  const mesa = mesas.find((m) => m.pedidos.length === 0);
  expect(mesa, 'el seed trae mesas libres').toBeTruthy();
  const productos = (await (await mozo.get('/api/productos')).json()) as { id: number; nombre: string; precio: number }[];
  const papas = productos.find((p) => p.nombre === 'Papas Fritas')!;
  const coca = productos.find((p) => p.nombre === 'Coca-Cola 500ml')!;
  expect([papas.precio, coca.precio]).toEqual([3200, 1800]);

  // 1. El mozo toma el pedido. Manda un precio falso: el servidor lo ignora (L-002).
  const alta = await mozo.post('/api/pedidos', {
    data: { mesaId: mesa!.id, items: [{ productoId: papas.id, cantidad: 2, precio: 1 }, { productoId: coca.id, cantidad: 1 }] },
  });
  expect(alta.status()).toBe(201);
  const pedido = await json(alta);
  expect(pedido.total).toBe(8200); // 2 × 3200 + 1800, no 2 × 1 + 1800

  // 2. La cocina lo prepara y lo deja listo; el administrador lo marca entregado. Un salto de estado se rechaza.
  const saltoInvalido = await cocina.patch('/api/pedidos', { data: { id: pedido.id, estado: 'entregado' } });
  expect(saltoInvalido.status()).toBe(400);
  expect((await cocina.patch('/api/pedidos', { data: { id: pedido.id, estado: 'preparando' } })).status()).toBe(200);
  expect((await cocina.patch('/api/pedidos', { data: { id: pedido.id, estado: 'listo' } })).status()).toBe(200);
  expect((await admin.patch('/api/pedidos', { data: { id: pedido.id, estado: 'entregado' } })).status()).toBe(200);

  // 3. El mozo cobra con propina. Total: 8200 + 10,50 = 8210,50.
  const cobro = await mozo.post('/api/checkout/pay', {
    data: { pedidoId: pedido.id, mesaId: mesa!.id, metodoPago: 'efectivo', propina: 10.5 },
  });
  expect(cobro.status()).toBe(200);
  const venta = await json(cobro);
  expect(venta.ticketInterno.total).toBe(8210.5);
  expect(venta.ticketInterno.propina).toBe(10.5);
  const ventaId = venta.ticketInterno.ventaId as number;

  // 4. Reintento del mismo cobro (se cortó la red antes de la respuesta): misma venta, no una segunda.
  const reintento = await mozo.post('/api/checkout/pay', {
    data: { pedidoId: pedido.id, mesaId: mesa!.id, metodoPago: 'efectivo', propina: 10.5 },
  });
  expect(reintento.status()).toBe(200);
  expect((await json(reintento)).ticketInterno.ventaId).toBe(ventaId);

  // 5. Anular: el mozo no puede; el administrador sí, con motivo; una segunda anulación se rechaza.
  expect((await mozo.post(`/api/ventas/${ventaId}/anular`, { data: { motivo: 'prueba' } })).status()).toBe(403);
  expect((await admin.post(`/api/ventas/${ventaId}/anular`, { data: { motivo: 'cobro duplicado' } })).status()).toBe(200);
  expect((await admin.post(`/api/ventas/${ventaId}/anular`, { data: { motivo: 'otra vez' } })).status()).toBe(400);

  // 6. Un pedido ya pagado es final: no se puede reabrir.
  expect((await cocina.patch('/api/pedidos', { data: { id: pedido.id, estado: 'preparando' } })).status()).toBe(400);

  await Promise.all([mozo.dispose(), cocina.dispose(), admin.dispose()]);
});

test('sin sesión no se puede operar: la API responde 401', async ({ playwright, baseURL }) => {
  const anonimo = await playwright.request.newContext({ baseURL });
  expect((await anonimo.get('/api/pedidos')).status()).toBe(401);
  expect((await anonimo.post('/api/checkout/pay', { data: { pedidoId: 1, mesaId: 1 } })).status()).toBe(401);
  await anonimo.dispose();
});
