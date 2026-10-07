import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Servidor } from '../src/servidor.js';
import { ESQUEMA, respaldoLogico, restaurarLogico, copiarDirectorio } from '../src/respaldo.js';
import { ejecutar } from '../src/ci.mjs';

let origen, destino, tmp;
const foto = async (pool) => (await pool.query(`
  SELECT (SELECT json_agg(p ORDER BY id) FROM pedido p) AS pedidos,
         (SELECT json_agg(c ORDER BY id) FROM cobro c) AS cobros,
         (SELECT json_agg(o ORDER BY id) FROM outbox o) AS outbox`)).rows[0];

beforeAll(async () => {
  tmp = mkdtempSync(join(tmpdir(), 'lab3-resp-'));
  origen = await Servidor.crear();
  destino = await Servidor.crear();
  await origen.pool.query(ESQUEMA);
  await origen.pool.query("INSERT INTO pedido(estado,total_centavos) SELECT CASE WHEN g%3=0 THEN 'cobrado' ELSE 'abierto' END, g*1000 FROM generate_series(1,200) g");
  await origen.pool.query("INSERT INTO cobro(pedido_id,clave) SELECT id,'k'||id FROM pedido WHERE estado='cobrado'");
  await origen.pool.query("INSERT INTO outbox(evento) SELECT 'pedido.cobrado:'||pedido_id FROM cobro");
}, 180000);
afterAll(async () => {
  await origen?.detener(); await destino?.detener();
  for (const d of [tmp, origen?.dir, destino?.dir]) try { rmSync(d, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* temporal */ }
}, 60000);

describe('Respaldo lógico con manifiesto', () => {
  it('respaldar y restaurar en una base vacía deja los datos idénticos, con restricciones y secuencias', async () => {
    const carpeta = join(tmp, 'logico');
    const m = await respaldoLogico(origen.pool, carpeta);
    expect(m.tablas.pedido.filas).toBe(200);
    await restaurarLogico(destino.pool, carpeta);
    expect(await foto(destino.pool)).toEqual(await foto(origen.pool));
    // La restauración conserva las restricciones: la FK sigue protegiendo y la secuencia continúa sin chocar.
    try {
      // Se comprueba el código SQLSTATE (23503 = foreign_key_violation), no el texto: el mensaje depende del idioma del servidor (L-066).
      await expect(destino.pool.query("INSERT INTO cobro(pedido_id,clave) VALUES (99999,'x')")).rejects.toMatchObject({ code: '23503' });
      await destino.pool.query('INSERT INTO pedido(total_centavos) VALUES (1)');
      expect((await destino.pool.query('SELECT max(id)::int m FROM pedido')).rows[0].m).toBe(201);
    } finally {
      await destino.pool.query('DROP TABLE IF EXISTS outbox, cobro, pedido');
    }
  });

  it('un respaldo alterado se rechaza ANTES de escribir nada', async () => {
    const carpeta = join(tmp, 'alterado');
    await respaldoLogico(origen.pool, carpeta);
    const f = join(carpeta, 'pedido.json');
    writeFileSync(f, readFileSync(f, 'utf8').replace('"total_centavos":"1000"', '"total_centavos":"9"'));
    await expect(restaurarLogico(destino.pool, carpeta)).rejects.toThrow(/corrupto/);
    const { rows } = await destino.pool.query("SELECT to_regclass('pedido') t");
    expect(rows[0].t).toBeNull(); // no quedó nada a medias
  });

  it('el respaldo es una foto consistente aunque se escriba durante la copia', async () => {
    const carpeta = join(tmp, 'concurrente');
    const escritura = (async () => { for (let i = 0; i < 20; i++) await origen.pool.query('UPDATE outbox SET procesado = NOT procesado WHERE id <= 10'); })();
    const m = await respaldoLogico(origen.pool, carpeta);
    await escritura;
    expect(m.tablas.cobro.filas).toBe(66);
    expect(m.tablas.outbox.filas).toBe(66);
  });
});

describe('Respaldo físico en frío (copia del directorio de datos)', () => {
  it('tras un desastre (tabla borrada y datos corruptos) se restaura el estado exacto del respaldo', async () => {
    const antes = await foto(origen.pool);
    await origen.detener();
    const copia = join(tmp, 'fisico');
    copiarDirectorio(origen.dir, copia);
    await origen.iniciar();

    // Desastre: alguien borra datos y elimina una tabla.
    await origen.pool.query('DELETE FROM outbox');
    await origen.pool.query('DROP TABLE cobro');
    await origen.pool.query("UPDATE pedido SET total_centavos = 0");
    expect(await foto(origen.pool).catch(() => 'roto')).toBe('roto');

    // Restauración: detener, reponer el directorio, arrancar y comparar.
    await origen.detener();
    copiarDirectorio(copia, origen.dir);
    await origen.iniciar();
    expect(await foto(origen.pool)).toEqual(antes);
  }, 120000);
});

describe('Pipeline: falla rápido y no deja nada sin reportar', () => {
  it('se detiene en la primera compuerta que falla y marca el resto como no ejecutadas', () => {
    const { ok, resultados } = ejecutar([
      { nombre: 'a', cmd: 'node', args: ['-e', '"process.exit(0)"'], cwd: tmp },
      { nombre: 'b', cmd: 'node', args: ['-e', '"process.exit(3)"'], cwd: tmp },
      { nombre: 'c', cmd: 'node', args: ['-e', '"process.exit(0)"'], cwd: tmp },
    ], { silencioso: true });
    expect(ok).toBe(false);
    expect(resultados.map((r) => r.estado)).toEqual(['ok', 'falla', 'no ejecutada']);
  });
});
