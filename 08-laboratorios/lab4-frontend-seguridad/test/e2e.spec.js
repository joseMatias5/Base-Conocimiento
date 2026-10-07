import { test, expect } from '@playwright/test';

const unico = (base) => `${base}-${Date.now()}-${Math.floor(Math.random() * 1e4)}`;

async function crear(page, cliente) {
  await page.getByLabel('Cliente o mesa').fill(cliente);
  await page.getByRole('button', { name: 'Crear pedido' }).click();
  await expect(page.getByText(cliente)).toBeVisible();
}

test.beforeEach(async ({ page }) => { await page.goto('/'); });

test('flujo crítico: crear un pedido y cobrarlo', async ({ page }) => {
  const cliente = unico('Mesa');
  await crear(page, cliente);
  await page.getByRole('button', { name: new RegExp(`Cobrar pedido \\d+ de ${cliente}`) }).click();
  await expect(page.getByRole('status')).toContainText('cobrado');
  await expect(page.getByText(new RegExp(`${cliente} · cobrado`))).toBeVisible();
  await expect(page.getByRole('button', { name: new RegExp(`Cobrar pedido \\d+ de ${cliente}`) })).toHaveCount(0); // un cobrado no se vuelve a cobrar
});

test('validación: cliente vacío no crea nada y el servidor rechaza uno de más de 40 caracteres', async ({ page }) => {
  await page.getByRole('button', { name: 'Crear pedido' }).click(); // `required` lo frena en el navegador
  await expect(page.getByLabel('Cliente o mesa')).toBeFocused();
  const r = await page.request.post('/api/pedidos', { data: { cliente: 'x'.repeat(41) }, headers: { Origin: 'http://127.0.0.1:3100' } });
  expect(r.status()).toBe(400);
  expect(await r.json()).toHaveProperty('error');
});

test('XSS: un nombre con HTML se muestra como texto y no ejecuta nada', async ({ page }) => {
  const payload = '<img src=x onerror="window.__xss=1">';
  await page.getByLabel('Cliente o mesa').fill(payload);
  await page.getByRole('button', { name: 'Crear pedido' }).click();
  await expect(page.getByText(payload, { exact: false }).first()).toBeVisible();
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
  expect(await page.locator('#lista img').count()).toBe(0);
});

test('si la API falla, la pantalla muestra el error y sigue funcionando', async ({ page }) => {
  const cliente = unico('Caida');
  await crear(page, cliente);
  await page.route('**/api/pedidos/*/cobrar', (ruta) => ruta.abort());
  const boton = page.getByRole('button', { name: new RegExp(`Cobrar pedido \\d+ de ${cliente}`) });
  await boton.click();
  await expect(page.getByRole('alert')).toContainText('No hay conexión');
  await expect(boton).toBeEnabled(); // el botón se rehabilita: se puede reintentar
  await page.unroute('**/api/pedidos/*/cobrar');
  await boton.click();
  await expect(page.getByText(new RegExp(`${cliente} · cobrado`))).toBeVisible();
  await expect(page.getByRole('alert')).toBeHidden();
});

test('objetivos táctiles de al menos 44 px', async ({ page }) => {
  await crear(page, unico('Tactil'));
  for (const b of await page.getByRole('button').all()) {
    const caja = await b.boundingBox();
    expect(caja.height).toBeGreaterThanOrEqual(44);
    expect(caja.width).toBeGreaterThanOrEqual(44);
  }
});

test('sin desborde horizontal en el viewport actual', async ({ page }) => {
  const [ancho, vista] = await page.evaluate(() => [document.documentElement.scrollWidth, window.innerWidth]);
  expect(ancho).toBeLessThanOrEqual(vista);
});

test('doble clic rápido con API lenta registra un solo cobro', async ({ browser }) => {
  const ctx = await browser.newContext({ baseURL: 'http://127.0.0.1:3102' });
  const page = await ctx.newPage();
  await page.goto('/');
  const cliente = unico('Lento');
  await crear(page, cliente); // pedido propio: el servidor lo comparten los proyectos escritorio y móvil
  const antes = (await (await page.request.get('/api/pedidos')).json()).cobrosRegistrados;
  const boton = page.getByRole('button', { name: new RegExp(`Cobrar pedido \\d+ de ${cliente}`) });
  await boton.evaluate((b) => { b.click(); b.click(); }); // dos clics en el mismo instante, sin esperar a que el botón siga habilitado
  await expect(page.getByRole('status')).toContainText('cobrado');
  const { cobrosRegistrados } = await (await page.request.get('/api/pedidos')).json();
  expect(cobrosRegistrados - antes).toBe(1);
  await ctx.close();
});
