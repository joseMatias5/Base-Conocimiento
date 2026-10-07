// Pipeline local equivalente a .github/workflows/ci.yml: ejecuta cada compuerta en orden y se detiene en la primera que falla.
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const COMPUERTAS = [
  { nombre: 'Lab 1 · PostgreSQL concurrencia', cmd: 'npm', args: ['test'], cwd: resolve(raiz, 'lab1-postgres-concurrencia') },
  { nombre: 'Lab 2 · C# build', cmd: 'dotnet', args: ['build', '--nologo', '-warnaserror'], cwd: resolve(raiz, 'lab2-csharp-cobros') },
  { nombre: 'Lab 2 · C# tests', cmd: 'dotnet', args: ['test', '--no-build', '--nologo'], cwd: resolve(raiz, 'lab2-csharp-cobros') },
  { nombre: 'Lab 3 · respaldo y restauración', cmd: 'npm', args: ['test'], cwd: resolve(raiz, 'lab3-respaldo-ci') },
];

/** Devuelve { ok, resultados }; no continúa tras el primer fallo (falla rápido) y deja constancia de lo no ejecutado. */
export function ejecutar(compuertas, { silencioso = false } = {}) {
  const resultados = [];
  let ok = true;
  for (const g of compuertas) {
    if (!ok) { resultados.push({ nombre: g.nombre, estado: 'no ejecutada' }); continue; }
    const t0 = Date.now();
    const r = spawnSync(g.cmd, g.args, { cwd: g.cwd, shell: true, encoding: 'utf8', timeout: 600_000, windowsHide: true });
    const paso = r.status === 0;
    if (!silencioso) console.log(`${paso ? 'OK  ' : 'FALLA'} ${g.nombre} (${((Date.now() - t0) / 1000).toFixed(1)} s)`);
    if (!paso && !silencioso) console.log((r.stdout ?? '').slice(-1500), (r.stderr ?? '').slice(-500));
    resultados.push({ nombre: g.nombre, estado: paso ? 'ok' : 'falla' });
    ok = paso;
  }
  return { ok, resultados };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { ok } = ejecutar(COMPUERTAS);
  console.log(ok ? '\nPIPELINE VERDE' : '\nPIPELINE ROJO');
  process.exit(ok ? 0 : 1);
}
