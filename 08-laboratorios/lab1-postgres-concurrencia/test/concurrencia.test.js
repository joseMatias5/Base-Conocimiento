import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { iniciarBase, conTransaccion } from '../src/db.js';

let db, pool;
beforeAll(async () => { db = await iniciarBase(); pool = db.pool; }, 120000);
afterAll(async () => { await db?.cerrar(); }, 60000);
beforeEach(async () => { await db.reiniciar(); });

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));
const uno = async (sql) => (await pool.query(sql)).rows[0];

describe('Escritura condicional (reclamar estado)', () => {
  it('50 cobros simultáneos del mismo pedido: exactamente uno gana', async () => {
    await pool.query('INSERT INTO pedido(total_centavos) VALUES (10000)');
    const cobrar = () => conTransaccion(pool, async (c) => {
      const r = await c.query("UPDATE pedido SET estado='cobrado' WHERE id=1 AND estado='abierto'");
      if (r.rowCount === 0) return false;
      await c.query('INSERT INTO cobro(pedido_id) VALUES (1)');
      return true;
    });
    const res = await Promise.all(Array.from({ length: 50 }, cobrar));
    expect(res.filter(Boolean)).toHaveLength(1);
    expect((await uno('SELECT count(*)::int n FROM cobro')).n).toBe(1);
  });

  it('sin sobreventa: 100 compras de 1 unidad sobre stock 30 => 30 éxitos y stock 0', async () => {
    await pool.query("INSERT INTO producto(nombre, stock) VALUES ('agua', 30)");
    const comprar = () => conTransaccion(pool, async (c) =>
      (await c.query('UPDATE producto SET stock = stock - 1 WHERE id=1 AND stock >= 1')).rowCount === 1);
    const res = await Promise.all(Array.from({ length: 100 }, comprar));
    expect(res.filter(Boolean)).toHaveLength(30);
    expect((await uno('SELECT stock FROM producto')).stock).toBe(0);
  });
});

describe('Lost update: el error y su arreglo', () => {
  const leerModificarEscribir = (bloqueo) => () => conTransaccion(pool, async (c) => {
    const { rows } = await c.query(`SELECT saldo_centavos FROM cuenta WHERE id=1 ${bloqueo}`);
    await esperar(20);
    await c.query('UPDATE cuenta SET saldo_centavos=$1 WHERE id=1', [Number(rows[0].saldo_centavos) + 100]);
  });
  const saldo = async () => Number((await uno('SELECT saldo_centavos FROM cuenta')).saldo_centavos);

  it('SIN bloqueo (leer-modificar-escribir en la app) se pierden actualizaciones', async () => {
    await pool.query('INSERT INTO cuenta(saldo_centavos) VALUES (0)');
    await Promise.all(Array.from({ length: 10 }, leerModificarEscribir('')));
    expect(await saldo()).toBeLessThan(1000); // el bug existe: se esperaba 1000
  });

  it('CON SELECT ... FOR UPDATE no se pierde ninguna', async () => {
    await pool.query('INSERT INTO cuenta(saldo_centavos) VALUES (0)');
    await Promise.all(Array.from({ length: 10 }, leerModificarEscribir('FOR UPDATE')));
    expect(await saldo()).toBe(1000);
  });

  it('actualización atómica en SQL (saldo = saldo + x) tampoco pierde', async () => {
    await pool.query('INSERT INTO cuenta(saldo_centavos) VALUES (0)');
    await Promise.all(Array.from({ length: 50 }, () => pool.query('UPDATE cuenta SET saldo_centavos = saldo_centavos + 100 WHERE id=1')));
    expect(await saldo()).toBe(5000);
  });
});

describe('Concurrencia optimista (versión de fila)', () => {
  it('dos ediciones con la misma versión: una gana, la otra recibe conflicto', async () => {
    await pool.query("INSERT INTO producto(nombre, stock) VALUES ('pan', 5)");
    const editar = (nombre) => pool.query('UPDATE producto SET nombre=$1, version=version+1 WHERE id=1 AND version=1', [nombre]);
    const [a, b] = await Promise.all([editar('pan A'), editar('pan B')]);
    expect([a.rowCount, b.rowCount].sort()).toEqual([0, 1]);
    expect((await uno('SELECT version FROM producto')).version).toBe(2);
  });
});

describe('Idempotencia por clave', () => {
  it('20 reintentos con la misma clave crean un solo cobro', async () => {
    await pool.query('INSERT INTO pedido(total_centavos) VALUES (500)');
    const enviar = () => pool.query("INSERT INTO cobro(pedido_id, clave) VALUES (1, 'clave-abc') ON CONFLICT (clave) DO NOTHING RETURNING id");
    const res = await Promise.all(Array.from({ length: 20 }, enviar));
    expect(res.filter((r) => r.rowCount === 1)).toHaveLength(1);
    expect((await uno('SELECT count(*)::int n FROM cobro')).n).toBe(1);
  });
});

describe('Outbox (evento y dato en la misma transacción)', () => {
  it('si la transacción falla no queda ni el dato ni el evento', async () => {
    await pool.query('INSERT INTO pedido(total_centavos) VALUES (500)');
    await expect(conTransaccion(pool, async (c) => {
      await c.query("UPDATE pedido SET estado='cobrado' WHERE id=1");
      await c.query("INSERT INTO outbox(evento) VALUES ('pedido.cobrado')");
      await c.query('INSERT INTO cobro(pedido_id) VALUES (999)'); // viola FK
    })).rejects.toThrow();
    expect((await uno('SELECT estado FROM pedido')).estado).toBe('abierto');
    expect((await uno('SELECT count(*)::int n FROM outbox')).n).toBe(0);
  });

  it('si la transacción sale bien quedan ambos', async () => {
    await pool.query('INSERT INTO pedido(total_centavos) VALUES (500)');
    await conTransaccion(pool, async (c) => {
      await c.query("UPDATE pedido SET estado='cobrado' WHERE id=1");
      await c.query("INSERT INTO outbox(evento) VALUES ('pedido.cobrado')");
    });
    expect((await uno('SELECT count(*)::int n FROM outbox')).n).toBe(1);
  });
});

describe('Cola de trabajo con FOR UPDATE SKIP LOCKED', () => {
  it('10 workers toman 100 tareas: cada tarea se toma exactamente una vez', async () => {
    await pool.query('INSERT INTO tarea(estado) SELECT $1 FROM generate_series(1,100)', ['pendiente']);
    const worker = async (id) => {
      let tomadas = 0;
      for (;;) {
        const n = await conTransaccion(pool, async (c) => {
          const { rows } = await c.query("SELECT id FROM tarea WHERE estado='pendiente' ORDER BY id LIMIT 1 FOR UPDATE SKIP LOCKED");
          if (!rows.length) return 0;
          await c.query("UPDATE tarea SET estado='hecha', tomada_por=$1 WHERE id=$2", [id, rows[0].id]);
          return 1;
        });
        if (!n) return tomadas;
        tomadas += n;
      }
    };
    const por = await Promise.all(Array.from({ length: 10 }, (_, i) => worker(i + 1)));
    expect(por.reduce((a, b) => a + b, 0)).toBe(100);
    expect((await uno("SELECT count(*)::int n FROM tarea WHERE estado='hecha'")).n).toBe(100);
  });
});

describe('Aislamiento SERIALIZABLE y deadlocks', () => {
  it('write skew: con READ COMMITTED se rompe la regla; con SERIALIZABLE + reintento se respeta', async () => {
    // Regla: debe quedar al menos 1 de 2 cajeros de guardia.
    const preparar = async () => { await db.reiniciar(); await pool.query('INSERT INTO guardia VALUES (1,true),(2,true)'); };
    const retirarse = (id, aislamiento) => conTransaccion(pool, async (c) => {
      const { rows } = await c.query('SELECT count(*)::int n FROM guardia WHERE activo');
      await esperar(50);
      if (rows[0].n >= 2) await c.query('UPDATE guardia SET activo=false WHERE id=$1', [id]);
    }, { aislamiento });
    const activos = async () => (await uno('SELECT count(*)::int n FROM guardia WHERE activo')).n;

    await preparar();
    await Promise.all([retirarse(1, 'READ COMMITTED'), retirarse(2, 'READ COMMITTED')]);
    expect(await activos()).toBe(0); // bug demostrado

    await preparar();
    await Promise.all([retirarse(1, 'SERIALIZABLE'), retirarse(2, 'SERIALIZABLE')]);
    expect(await activos()).toBe(1); // regla respetada gracias al reintento
  });

  it('deadlock por orden inverso es detectado (40P01); con orden consistente no ocurre', async () => {
    await pool.query('INSERT INTO cuenta(saldo_centavos) VALUES (1000),(1000)');
    const transferir = (de, a, ordenar) => {
      const ids = ordenar ? [de, a].sort((x, y) => x - y) : [de, a];
      return conTransaccion(pool, async (c) => {
        await c.query('SELECT 1 FROM cuenta WHERE id=$1 FOR UPDATE', [ids[0]]);
        await esperar(1200); // supera deadlock_timeout (1 s) para que se detecte el ciclo
        await c.query('SELECT 1 FROM cuenta WHERE id=$1 FOR UPDATE', [ids[1]]);
        await c.query('UPDATE cuenta SET saldo_centavos=saldo_centavos-10 WHERE id=$1', [de]);
        await c.query('UPDATE cuenta SET saldo_centavos=saldo_centavos+10 WHERE id=$1', [a]);
      }, { reintentos: 0 });
    };
    const sinOrden = await Promise.allSettled([transferir(1, 2, false), transferir(2, 1, false)]);
    expect(sinOrden.some((r) => r.status === 'rejected' && r.reason.code === '40P01')).toBe(true);
    const conOrden = await Promise.allSettled([transferir(1, 2, true), transferir(2, 1, true)]);
    expect(conOrden.every((r) => r.status === 'fulfilled')).toBe(true);
    expect(Number((await uno('SELECT sum(saldo_centavos) s FROM cuenta')).s)).toBe(2000); // el dinero se conserva
  }, 30000);
});
