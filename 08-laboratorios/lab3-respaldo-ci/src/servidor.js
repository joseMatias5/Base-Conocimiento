import { spawnSync, spawn } from 'node:child_process';
import { mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import net from 'node:net';
import pg from 'pg';

const aqui = dirname(fileURLToPath(import.meta.url));
export const BIN = resolve(aqui, '../../lab1-postgres-concurrencia/node_modules/@embedded-postgres/windows-x64/native/bin');

function puertoLibre() {
  return new Promise((ok) => { const s = net.createServer().listen(0, () => { const p = s.address().port; s.close(() => ok(p)); }); });
}

/** Ejecuta un binario con tiempo límite. pg_ctl start NO se captura (el servidor hereda las tuberías, L-064). */
function correr(exe, args, { capturar = true } = {}) {
  const r = spawnSync(join(BIN, exe), args, { encoding: 'utf8', timeout: 60_000, stdio: capturar ? 'pipe' : 'ignore', windowsHide: true });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${exe} ${args.join(' ')} -> ${r.status}\n${r.stderr ?? ''}`);
}

/** Servidor PostgreSQL real, con directorio de datos persistente y control de arranque/parada. */
export class Servidor {
  constructor(dir, puerto) { this.dir = dir; this.puerto = puerto; this.pool = null; }

  static async crear() {
    const dir = mkdtempSync(join(tmpdir(), 'lab3-pg-'));
    const s = new Servidor(dir, await puertoLibre());
    correr('initdb.exe', ['-D', dir, '-U', 'lab', '--auth=trust', '-E', 'UTF8']);
    await s.iniciar();
    return s;
  }

  async iniciar() {
    correr('pg_ctl.exe', ['-D', this.dir, '-o', `-p ${this.puerto}`, '-l', `${this.dir}.log`, '-w', 'start'], { capturar: false });
    this.pool = new pg.Pool({ host: 'localhost', port: this.puerto, user: 'lab', database: 'postgres', max: 10 });
  }

  async detener() {
    await this.pool?.end();
    this.pool = null;
    if (existsSync(join(this.dir, 'postmaster.pid'))) correr('pg_ctl.exe', ['-D', this.dir, '-m', 'fast', '-w', 'stop'], { capturar: false });
  }
}
