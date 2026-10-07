import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const etiquetas = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];
const revisar = async (page) => (await new AxeBuilder({ page }).withTags(etiquetas).analyze()).violations;
const resumen = (v) => v.map((x) => `${x.id}: ${x.nodes.length} nodo(s) · ${x.help}`).join('\n');

test('axe: pantalla inicial sin violaciones', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('list')).toBeVisible();
  const v = await revisar(page);
  expect(v, resumen(v)).toEqual([]);
});

test('axe: con un error visible (región role=alert)', async ({ page }) => {
  await page.goto('/');
  await page.route('**/api/pedidos', (r) => (r.request().method() === 'POST' ? r.abort() : r.continue()));
  await page.getByLabel('Cliente o mesa').fill('A11y');
  await page.getByRole('button', { name: 'Crear pedido' }).click();
  await expect(page.getByRole('alert')).toBeVisible();
  const v = await revisar(page);
  expect(v, resumen(v)).toEqual([]);
});

test('axe: modo oscuro (contraste)', async ({ browser }) => {
  const ctx = await browser.newContext({ colorScheme: 'dark', baseURL: 'http://127.0.0.1:3100' });
  const page = await ctx.newPage();
  await page.goto('/');
  await expect(page.getByRole('list')).toBeVisible();
  const v = await revisar(page);
  expect(v, resumen(v)).toEqual([]);
  await ctx.close();
});

test('teclado: se puede crear y cobrar solo con teclado', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  await expect(page.getByLabel('Cliente o mesa')).toBeFocused();
  await page.keyboard.type('Teclado');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Teclado').first()).toBeVisible();
});
