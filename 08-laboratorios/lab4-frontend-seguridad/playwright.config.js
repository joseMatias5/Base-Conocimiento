import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './test',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3100', trace: 'retain-on-failure' },
  webServer: [
    { command: 'node src/servidor.mjs', url: 'http://127.0.0.1:3100/api/pedidos', reuseExistingServer: false, env: { PORT: '3100' } },
    // Servidor aparte, con límite bajo, para no contaminar los demás tests con el límite de intentos.
    { command: 'node src/servidor.mjs', url: 'http://127.0.0.1:3101/api/pedidos', reuseExistingServer: false, env: { PORT: '3101', LAB4_LIMITE: '5' } },
    // Servidor aparte con API lenta, para el doble envío.
    { command: 'node src/servidor.mjs', url: 'http://127.0.0.1:3102/api/pedidos', reuseExistingServer: false, env: { PORT: '3102', LAB4_RETARDO_MS: '600' } },
  ],
  projects: [
    { name: 'escritorio', testMatch: /(e2e|a11y)\.spec\.js/, use: { ...devices['Desktop Chrome'] } },
    { name: 'movil', testMatch: /(e2e|a11y)\.spec\.js/, use: { ...devices['Pixel 5'] } },
    { name: 'seguridad', testMatch: /seguridad\.spec\.js/, use: { ...devices['Desktop Chrome'] } },
  ],
});
