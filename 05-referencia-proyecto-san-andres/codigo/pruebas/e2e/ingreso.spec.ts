import { expect, test } from '@playwright/test';
import { PIN, ingresarPin } from './ayudas';

// Cada prueba corre en escritorio y en móvil (proyectos de playwright.config.ts).
test.describe('Ingreso con PIN (pantalla de inicio)', () => {
  test('el mozo entra a Comandas con su PIN', async ({ page }) => {
    await ingresarPin(page, 'comandas', PIN.MOZO);
    await expect(page).toHaveURL(/\/comandas$/);
  });

  test('el administrador entra a Administración con su PIN', async ({ page }) => {
    await ingresarPin(page, 'admin', PIN.ADMIN);
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('un PIN incorrecto muestra el error y no deja pasar', async ({ page }) => {
    await ingresarPin(page, 'comandas', '9999');
    await expect(page.getByText('PIN incorrecto o usuario inactivo')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });

  test('el mozo no puede entrar a Administración aunque sepa su propio PIN', async ({ page }) => {
    await ingresarPin(page, 'admin', PIN.MOZO);
    await expect(page.getByText('Rol no autorizado para Administración')).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
  });
});
