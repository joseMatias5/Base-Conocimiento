/**
 * Arranca la app REAL para las pruebas e2e: `next start` (producción) sobre una base SQLite temporal y descartable,
 * con el esquema actual y los datos del seed (PIN 1111 ADMIN, 2222 COCINERO, 3333 MOZO). Nunca toca la dev.db.
 *
 * Requiere `npm run build` previo (el CI lo hace antes). Lo lanza Playwright (`webServer` en playwright.config.ts).
 */
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const puerto = process.env.E2E_PORT ?? '3100';
const dirTmp = join(raiz, 'e2e', '.tmp');
const archivoDb = join(dirTmp, 'e2e.db');

if (!existsSync(join(raiz, '.next', 'BUILD_ID'))) {
  console.error('[e2e] No hay build de producción. Ejecutá `npm run build` antes de `npm run test:e2e`.');
  process.exit(1);
}

rmSync(dirTmp, { recursive: true, force: true });
mkdirSync(dirTmp, { recursive: true });

const env = {
  ...process.env,
  DATABASE_URL: `file:${archivoDb.replaceAll('\\', '/')}`,
  SESSION_SECRET: 'e2e-secreto-solo-para-pruebas-0123456789abcdef0123456789abcdef',
  NODE_ENV: 'production',
  PORT: puerto,
};
// Se invoca a Node directamente con los binarios locales: sin `npx` ni `shell`, nada se concatena en una línea de comandos.
const opciones = { cwd: raiz, env, stdio: 'inherit' };
execFileSync(process.execPath, [join(raiz, 'node_modules', 'prisma', 'build', 'index.js'), 'db', 'push', '--skip-generate'], opciones);
execFileSync(process.execPath, [join(raiz, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'prisma/seed.ts'], opciones);

const servidor = spawn(process.execPath, [join(raiz, 'node_modules', 'next', 'dist', 'bin', 'next'), 'start', '-p', puerto], {
  cwd: raiz,
  env,
  stdio: 'inherit',
});
const cerrar = () => servidor.kill();
process.on('SIGTERM', cerrar);
process.on('SIGINT', cerrar);
servidor.on('exit', (codigo) => process.exit(codigo ?? 0));
