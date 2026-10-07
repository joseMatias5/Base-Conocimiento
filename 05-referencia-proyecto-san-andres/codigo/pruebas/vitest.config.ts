import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Los tests de PIN (scrypt) y los de migración (SQLite real + CLI de Prisma) son pesados en CPU:
    // corriendo en paralelo pueden superar los 5 s por defecto sin que haya un error.
    testTimeout: 20_000,
    coverage: {
      provider: 'v8',
      // La lógica de negocio vive en src/lib; las rutas (src/app/api) se miden aparte para ver qué tan cubiertas están.
      include: ['src/lib/**/*.ts', 'src/app/api/**/route.ts', 'src/proxy.ts'],
      reporter: ['text-summary', 'text', 'json-summary'],
      reportsDirectory: 'coverage',
      // Medido el 2026-10-07: líneas 95,2 %, ramas 93,4 %, funciones 98 %. El umbral queda unos puntos por debajo para que
      // la cobertura no retroceda sin que alguien lo decida; no es una meta a perseguir (TESTING.md §9, §10).
      thresholds: { lines: 92, statements: 92, branches: 90, functions: 95 },
    },
  },
});
