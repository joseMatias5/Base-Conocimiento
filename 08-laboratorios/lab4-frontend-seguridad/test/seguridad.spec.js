import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3100';
const propio = { Origin: BASE };

test('cabeceras de seguridad en la página y en la API', async ({ request }) => {
  for (const ruta of ['/', '/api/pedidos']) {
    const h = (await request.get(BASE + ruta)).headers();
    expect(h['content-security-policy'], ruta).toContain("default-src 'self'");
    expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
    expect(h['x-content-type-options']).toBe('nosniff');
    expect(h['referrer-policy']).toBe('no-referrer');
    expect(h['x-powered-by']).toBeUndefined();
  }
  expect((await request.get(BASE + '/api/pedidos')).headers()['cache-control']).toBe('no-store');
});

test('CSRF: una petición de otro origen o sin origen que cambia datos se rechaza con 403', async ({ request }) => {
  const cuerpo = { data: { cliente: 'evil' }, headers: { 'Content-Type': 'application/json' } };
  expect((await request.post(BASE + '/api/pedidos', { ...cuerpo, headers: { ...cuerpo.headers, Origin: 'http://evil.example' } })).status()).toBe(403);
  expect((await request.post(BASE + '/api/pedidos', cuerpo)).status()).toBe(403);
  const lista = await (await request.get(BASE + '/api/pedidos')).json();
  expect(lista.pedidos.some((p) => p.cliente === 'evil')).toBe(false);
});

test('validación de tipo y tamaño: 415, 413 y 400 con forma { error }', async ({ request }) => {
  const r415 = await request.post(BASE + '/api/pedidos', { data: 'cliente=x', headers: { ...propio, 'Content-Type': 'text/plain' } });
  expect(r415.status()).toBe(415);
  const r413 = await request.post(BASE + '/api/pedidos', { data: { cliente: 'x'.repeat(5000) }, headers: propio });
  expect(r413.status()).toBe(413);
  const r400 = await request.post(BASE + '/api/pedidos', { data: '{no es json', headers: { ...propio, 'Content-Type': 'application/json' } });
  expect(r400.status()).toBe(400);
  for (const r of [r415, r413, r400]) expect(Object.keys(await r.json())).toEqual(['error']);
});

test('los errores no filtran detalles internos', async ({ request }) => {
  const r = await request.get(BASE + '/api/no-existe');
  expect(r.status()).toBe(404);
  const texto = await r.text();
  expect(texto).not.toMatch(/at .*\.mjs|node_modules|stack|ENOENT|[A-Z]:\\/);
});

test('un pedido inexistente da 404 y uno ya cobrado da 409 (no se cobra dos veces)', async ({ request }) => {
  expect((await request.post(BASE + '/api/pedidos/9999/cobrar', { data: {}, headers: propio })).status()).toBe(404);
  const p = await (await request.post(BASE + '/api/pedidos', { data: { cliente: 'Doble' }, headers: propio })).json();
  expect((await request.post(`${BASE}/api/pedidos/${p.id}/cobrar`, { data: {}, headers: propio })).status()).toBe(200);
  expect((await request.post(`${BASE}/api/pedidos/${p.id}/cobrar`, { data: {}, headers: propio })).status()).toBe(409);
});

test('límite de intentos: tras 5 peticiones llega 429 con Retry-After, aunque se falsee X-Forwarded-For', async ({ request }) => {
  const LIM = 'http://127.0.0.1:3101';
  const estados = [];
  for (let i = 0; i < 8; i++) {
    const r = await request.post(LIM + '/api/pedidos', { data: { cliente: `n${i}` }, headers: { Origin: LIM, 'X-Forwarded-For': `10.0.0.${i}` } });
    estados.push(r.status());
    if (r.status() === 429) expect(r.headers()['retry-after']).toBe('60');
  }
  expect(estados.slice(0, 5).every((s) => s === 201)).toBe(true);
  expect(estados.slice(5).every((s) => s === 429)).toBe(true);
});
