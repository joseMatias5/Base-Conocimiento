import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SCHEMA = `
CREATE TABLE producto (id serial PRIMARY KEY, nombre text NOT NULL, stock int NOT NULL CHECK (stock >= 0), version int NOT NULL DEFAULT 1);
CREATE TABLE cuenta (id serial PRIMARY KEY, saldo_centavos bigint NOT NULL CHECK (saldo_centavos >= 0));
CREATE TABLE pedido (id serial PRIMARY KEY, estado text NOT NULL DEFAULT 'abierto' CHECK (estado IN ('abierto','cobrado','anulado')), total_centavos bigint NOT NULL);
CREATE TABLE cobro (id serial PRIMARY KEY, pedido_id int NOT NULL REFERENCES pedido(id), clave text UNIQUE);
CREATE TABLE outbox (id serial PRIMARY KEY, evento text NOT NULL, procesado boolean NOT NULL DEFAULT false);
CREATE TABLE tarea (id serial PRIMARY KEY, estado text NOT NULL DEFAULT 'pendiente', tomada_por int);
CREATE TABLE guardia (id int PRIMARY KEY, activo boolean NOT NULL);
`;

export async function iniciarBase() {
  const dir = mkdtempSync(join(tmpdir(), 'lab1-pg-'));
  const port = 54000 + Math.floor(Math.random() * 1000);
  const server = new EmbeddedPostgres({ databaseDir: dir, user: 'lab', password: 'lab', port, persistent: false });
  await server.initialise();
  await server.start();
  const pool = new pg.Pool({ host: 'localhost', port, user: 'lab', password: 'lab', database: 'postgres', max: 60 });
  await pool.query(SCHEMA);
  return {
    pool,
    async reiniciar() {
      await pool.query('TRUNCATE producto, cuenta, pedido, cobro, outbox, tarea, guardia RESTART IDENTITY CASCADE');
    },
    async cerrar() {
      await pool.end();
      try { await server.stop(); } catch (e) { if (e.code !== 'EBUSY') throw e; }
      // En Windows el directorio puede seguir bloqueado un instante tras detener el servidor.
      try { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 300 }); } catch { /* temp: se limpia solo */ }
    },
  };
}

/** Helper de transacción con reintento ante serialization_failure (40001) y deadlock (40P01). */
export async function conTransaccion(pool, fn, { aislamiento = 'READ COMMITTED', reintentos = 5 } = {}) {
  for (let intento = 0; ; intento++) {
    const c = await pool.connect();
    try {
      await c.query(`BEGIN ISOLATION LEVEL ${aislamiento}`);
      const r = await fn(c);
      await c.query('COMMIT');
      return r;
    } catch (e) {
      await c.query('ROLLBACK').catch(() => {});
      if ((e.code === '40001' || e.code === '40P01') && intento < reintentos) continue;
      throw e;
    } finally {
      c.release();
    }
  }
}
