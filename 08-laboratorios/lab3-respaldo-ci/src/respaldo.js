import { createHash } from 'node:crypto';
import { mkdirSync, writeFileSync, readFileSync, cpSync, rmSync } from 'node:fs';
import { join } from 'node:path';

/** Orden de tablas respetando claves foráneas: padres antes que hijos. */
export const TABLAS = ['pedido', 'cobro', 'outbox'];

export const ESQUEMA = `
CREATE TABLE pedido (id serial PRIMARY KEY, estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cobrado','anulado')), total_centavos bigint NOT NULL);
CREATE TABLE cobro (id serial PRIMARY KEY, pedido_id int NOT NULL REFERENCES pedido(id), clave text NOT NULL UNIQUE);
CREATE TABLE outbox (id serial PRIMARY KEY, evento text NOT NULL, procesado boolean NOT NULL DEFAULT false);
`;

const sha = (txt) => createHash('sha256').update(txt).digest('hex');

/** Respaldo lógico: un JSON por tabla + manifiesto con conteos y SHA-256 (detecta archivos alterados o truncados). */
export async function respaldoLogico(pool, carpeta) {
  mkdirSync(carpeta, { recursive: true });
  const manifiesto = { creado: new Date().toISOString(), tablas: {} };
  const c = await pool.connect();
  try {
    await c.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY'); // foto consistente de todas las tablas
    for (const t of TABLAS) {
      const { rows } = await c.query(`SELECT * FROM ${t} ORDER BY id`);
      const texto = JSON.stringify(rows);
      writeFileSync(join(carpeta, `${t}.json`), texto);
      manifiesto.tablas[t] = { filas: rows.length, sha256: sha(texto) };
    }
    await c.query('COMMIT');
  } finally { c.release(); }
  writeFileSync(join(carpeta, 'manifiesto.json'), JSON.stringify(manifiesto, null, 2));
  return manifiesto;
}

/** Restaura en una base vacía. Verifica el manifiesto ANTES de escribir nada y las cuentas DESPUÉS. */
export async function restaurarLogico(pool, carpeta) {
  const m = JSON.parse(readFileSync(join(carpeta, 'manifiesto.json'), 'utf8'));
  const datos = {};
  for (const t of TABLAS) {
    const texto = readFileSync(join(carpeta, `${t}.json`), 'utf8');
    if (sha(texto) !== m.tablas[t].sha256) throw new Error(`Respaldo corrupto: ${t} no coincide con el manifiesto`);
    datos[t] = JSON.parse(texto);
    if (datos[t].length !== m.tablas[t].filas) throw new Error(`Respaldo incompleto: ${t}`);
  }
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(ESQUEMA);
    for (const t of TABLAS) {
      for (const fila of datos[t]) {
        const cols = Object.keys(fila);
        await c.query(`INSERT INTO ${t}(${cols.join(',')}) VALUES (${cols.map((_, i) => `$${i + 1}`).join(',')})`, cols.map((k) => fila[k]));
      }
      await c.query(`SELECT setval(pg_get_serial_sequence('${t}','id'), COALESCE((SELECT max(id) FROM ${t}), 1))`); // que los nuevos ids no choquen
    }
    for (const t of TABLAS) {
      const { rows } = await c.query(`SELECT count(*)::int n FROM ${t}`);
      if (rows[0].n !== m.tablas[t].filas) throw new Error(`Conteo distinto tras restaurar ${t}`);
    }
    await c.query('COMMIT');
  } catch (e) {
    await c.query('ROLLBACK');
    throw e;
  } finally { c.release(); }
}

/** Respaldo físico en frío: el servidor debe estar detenido (copia consistente del directorio de datos). */
export function copiarDirectorio(origen, destino) {
  rmSync(destino, { recursive: true, force: true });
  cpSync(origen, destino, { recursive: true });
}
