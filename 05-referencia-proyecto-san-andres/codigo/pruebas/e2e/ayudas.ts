import { expect, type APIResponse, type Page, type PlaywrightWorkerArgs } from '@playwright/test';

export const PIN = { ADMIN: '1111', COCINERO: '2222', MOZO: '3333' } as const;
export type RolDePrueba = keyof typeof PIN;

const MODULO_DE_ROL = { ADMIN: 'admin', COCINERO: 'cocina', MOZO: 'comandas' } as const;
const TECLA_DE_MODULO = { comandas: '1', cocina: '2', admin: '3' } as const;

/** Abre el modal del PIN de un módulo con su atajo de teclado y teclea el PIN, como lo haría el usuario en el teclado. */
export async function ingresarPin(page: Page, modulo: keyof typeof TECLA_DE_MODULO, pin: string) {
  await page.goto('/');
  // La pantalla es estática: hay que esperar a que React la haya hidratado antes de que el atajo de teclado funcione.
  await expect(page.getByRole('heading', { name: 'Restaurante San Andrés' })).toBeVisible();
  await page.waitForLoadState('networkidle');
  await page.keyboard.press(TECLA_DE_MODULO[modulo]);
  for (const digito of pin) await page.keyboard.press(digito);
}

/** Sesión real de un rol contra la API (mismo endpoint que usa la pantalla). Cada rol tiene su propio contexto de cookies. */
export async function sesionDe(playwright: PlaywrightWorkerArgs['playwright'], baseURL: string, rol: RolDePrueba) {
  const api = await playwright.request.newContext({ baseURL });
  const res = await api.post('/api/auth/verify-pin', { data: { pin: PIN[rol], module: MODULO_DE_ROL[rol] } });
  expect(res.status(), `login de ${rol}`).toBe(200);
  return api;
}

export async function json(res: APIResponse) {
  return (await res.json()) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
}
