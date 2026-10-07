import { defineConfig, devices } from '@playwright/test';

const puerto = process.env.E2E_PORT ?? '3100';

/**
 * Pruebas de punta a punta contra la app real (producción) con base temporal. Cada prueba corre en dos viewports:
 * escritorio y móvil (TESTING.md §8). Antes: `npm run build`. Después: `npm run test:e2e`.
 */
export default defineConfig({
  testDir: 'e2e',
  testMatch: '**/*.spec.ts',
  // Una sola base compartida y un solo escritor: los flujos corren en serie para no pisarse.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${puerto}`,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'escritorio', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'movil', use: { ...devices['Pixel 7'] } },
  ],
  webServer: {
    command: 'node e2e/arrancar-servidor.mjs',
    url: `http://localhost:${puerto}/api/hub-metrics`,
    reuseExistingServer: false,
    timeout: 180_000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
