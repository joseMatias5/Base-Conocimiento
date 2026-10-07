import { PrismaClient } from '@prisma/client';

/**
 * Migraciones de esquema que se aplican solas al arrancar el servidor (ver src/instrumentation.ts).
 *
 * Por qué existen: la app de escritorio copia `template.db` SOLO en el primer arranque. Una instalación que ya
 * tiene su base nunca recibía los cambios de esquema, y con un Prisma Client nuevo fallaría al consultar.
 *
 * Cada paso DETECTA si hace falta mirando la base (no lleva un número de versión): así una base nueva creada
 * con `prisma db push` (que ya tiene el esquema actual) no se toca, y correr las migraciones dos veces no hace
 * nada la segunda vez. Todo el paso corre en una transacción: si algo falla, la base queda como estaba.
 */

type Fila = Record<string, unknown>;

interface Conexion {
  consultar(sql: string): Promise<Fila[]>;
  ejecutar(sql: string): Promise<void>;
  /**
   * Ejecuta las sentencias en una transacción. Si al final hay MÁS claves foráneas rotas que antes de empezar
   * (`previas`), hace rollback: la migración no debe introducir inconsistencias, pero tampoco quedar bloqueada
   * por filas huérfanas que la base ya tenía.
   */
  transaccion(sentencias: string[], previas: number): Promise<void>;
}

interface Paso {
  nombre: string;
  necesario(db: Conexion): Promise<boolean>;
  sentencias(db: Conexion): Promise<string[]>;
}

const comillas = (nombre: string) => `"${nombre.replace(/"/g, '""')}"`;

async function columnas(db: Conexion, tabla: string): Promise<{ name: string; type: string }[]> {
  const filas = await db.consultar(`PRAGMA table_info(${comillas(tabla)})`);
  return filas.map((f) => ({ name: String(f.name), type: String(f.type).toUpperCase() }));
}

/* ───────────── Paso 1: montos en centavos enteros (AT-13) ───────────── */

/** Columnas de dinero que pasaron de REAL (pesos) a INTEGER (centavos). */
export const COLUMNAS_MONTO: Record<string, string[]> = {
  Producto: ['precio'],
  Pedido: ['total'],
  ItemPedido: ['precio'],
  Insumo: ['precioUnitario'],
  CostoFijo: ['monto'],
  Venta: ['total', 'propina'],
};

async function tablasConMontosEnPesos(db: Conexion): Promise<string[]> {
  const pendientes: string[] = [];
  for (const [tabla, montos] of Object.entries(COLUMNAS_MONTO)) {
    const cols = await columnas(db, tabla);
    if (cols.some((c) => montos.includes(c.name) && c.type !== 'INTEGER')) pendientes.push(tabla);
  }
  return pendientes;
}

/**
 * SQLite no permite cambiar el tipo de una columna: la tabla se reconstruye (el mismo procedimiento que usa
 * Prisma Migrate). Se parte de la definición REAL de la tabla en esta base (sqlite_master), cambiando solo el
 * tipo de las columnas de dinero, y se copian los datos multiplicando esos montos por 100.
 */
async function reconstruirConCentavos(db: Conexion, tabla: string): Promise<string[]> {
  const [definicion] = await db.consultar(
    `SELECT sql FROM sqlite_master WHERE type = 'table' AND name = '${tabla}'`
  );
  const indices = await db.consultar(
    `SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = '${tabla}' AND sql IS NOT NULL`
  );
  const nueva = `new_${tabla}`;
  const montos = COLUMNAS_MONTO[tabla];

  let ddl = String(definicion.sql).replace(
    new RegExp(`^CREATE TABLE\\s+"?${tabla}"?`),
    `CREATE TABLE ${comillas(nueva)}`
  );
  for (const col of montos) {
    ddl = ddl.replace(new RegExp(`("${col}"\\s+)(REAL|DOUBLE|FLOAT|DECIMAL|NUMERIC)\\b`, 'i'), '$1INTEGER');
  }

  const cols = (await columnas(db, tabla)).map((c) => c.name);
  const destino = cols.map(comillas).join(', ');
  const origen = cols
    .map((c) => (montos.includes(c) ? `CAST(ROUND(${comillas(c)} * 100) AS INTEGER)` : comillas(c)))
    .join(', ');

  return [
    ddl,
    `INSERT INTO ${comillas(nueva)} (${destino}) SELECT ${origen} FROM ${comillas(tabla)}`,
    `DROP TABLE ${comillas(tabla)}`,
    `ALTER TABLE ${comillas(nueva)} RENAME TO ${comillas(tabla)}`,
    ...indices.map((i) => String(i.sql)),
  ];
}

const montosEnCentavos: Paso = {
  nombre: 'Montos de dinero en centavos enteros (AT-13)',
  necesario: async (db) => (await tablasConMontosEnPesos(db)).length > 0,
  sentencias: async (db) => {
    const sentencias: string[] = [];
    for (const tabla of await tablasConMontosEnPesos(db)) {
      sentencias.push(...(await reconstruirConCentavos(db, tabla)));
    }
    return sentencias;
  },
};

/* ───────────── Paso 2: recetas y movimientos de stock (AT-12) ───────────── */

async function existeTabla(db: Conexion, tabla: string): Promise<boolean> {
  const filas = await db.consultar(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = '${tabla}'`);
  return filas.length > 0;
}

// DDL generado por `prisma migrate diff` (idéntico al que crea `prisma db push`).
const DDL_RECETAS = [
  `CREATE TABLE "RecetaItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productoId" INTEGER NOT NULL,
    "insumoId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    CONSTRAINT "RecetaItem_productoId_fkey" FOREIGN KEY ("productoId") REFERENCES "Producto" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RecetaItem_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
)`,
  `CREATE UNIQUE INDEX "RecetaItem_productoId_insumoId_key" ON "RecetaItem"("productoId", "insumoId")`,
];
const DDL_MOVIMIENTOS = [
  `CREATE TABLE "MovimientoStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "insumoId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL DEFAULT '',
    "ventaId" INTEGER,
    "usuarioId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoStock_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoStock_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
)`,
  `CREATE INDEX "MovimientoStock_ventaId_idx" ON "MovimientoStock"("ventaId")`,
];

const recetasYStock: Paso = {
  nombre: 'Recetas de productos y movimientos de stock (AT-12)',
  necesario: async (db) => !(await existeTabla(db, 'RecetaItem')) || !(await existeTabla(db, 'MovimientoStock')),
  sentencias: async (db) => [
    ...((await existeTabla(db, 'RecetaItem')) ? [] : DDL_RECETAS),
    ...((await existeTabla(db, 'MovimientoStock')) ? [] : DDL_MOVIMIENTOS),
  ],
};

/* ───────────── Paso 3: detalle de los movimientos de stock (ajustes manuales) ───────────── */

// Reconstrucción generada por `prisma migrate diff` (la columna nueva va en su posición del esquema).
const DDL_MOVIMIENTOS_CON_DETALLE = [
  `CREATE TABLE "new_MovimientoStock" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "insumoId" INTEGER NOT NULL,
    "cantidad" REAL NOT NULL,
    "motivo" TEXT NOT NULL,
    "detalle" TEXT NOT NULL DEFAULT '',
    "ventaId" INTEGER,
    "usuarioId" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "MovimientoStock_insumoId_fkey" FOREIGN KEY ("insumoId") REFERENCES "Insumo" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "MovimientoStock_ventaId_fkey" FOREIGN KEY ("ventaId") REFERENCES "Venta" ("id") ON DELETE SET NULL ON UPDATE CASCADE
)`,
  `INSERT INTO "new_MovimientoStock" ("cantidad", "createdAt", "id", "insumoId", "motivo", "usuarioId", "ventaId") SELECT "cantidad", "createdAt", "id", "insumoId", "motivo", "usuarioId", "ventaId" FROM "MovimientoStock"`,
  `DROP TABLE "MovimientoStock"`,
  `ALTER TABLE "new_MovimientoStock" RENAME TO "MovimientoStock"`,
  `CREATE INDEX "MovimientoStock_ventaId_idx" ON "MovimientoStock"("ventaId")`,
];

const detalleDeMovimientos: Paso = {
  nombre: 'Detalle en los movimientos de stock (ajustes manuales)',
  necesario: async (db) =>
    (await existeTabla(db, 'MovimientoStock')) &&
    !(await columnas(db, 'MovimientoStock')).some((c) => c.name === 'detalle'),
  sentencias: async () => DDL_MOVIMIENTOS_CON_DETALLE,
};

/** Pasos en orden de aplicación. Los siguientes cambios de esquema se agregan al final. */
export const PASOS: Paso[] = [montosEnCentavos, recetasYStock, detalleDeMovimientos];

/* ───────────── Ejecución ───────────── */

function conexionPrisma(prisma: PrismaClient): Conexion {
  return {
    consultar: (sql) => prisma.$queryRawUnsafe<Fila[]>(sql),
    ejecutar: async (sql) => {
      // PRAGMA devuelve filas en algunos casos: se usa queryRaw para que Prisma no lo rechace.
      await prisma.$queryRawUnsafe(sql);
    },
    transaccion: async (sentencias, previas) => {
      await prisma.$transaction(
        async (tx) => {
          for (const s of sentencias) await tx.$executeRawUnsafe(s);
          const rotas = await tx.$queryRawUnsafe<Fila[]>('PRAGMA foreign_key_check');
          if (rotas.length > previas) {
            const detalle = rotas.map((r) => `${r.table} fila ${r.rowid} → ${r.parent}`).join('; ');
            throw new Error(`La migración dejaría claves foráneas inválidas: ${detalle}`);
          }
        },
        { timeout: 120_000 }
      );
    },
  };
}

/** Agrega connection_limit=1: los PRAGMA de claves foráneas valen por conexión. */
function urlDeUnaConexion(url: string): string {
  if (/[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes('?') ? '&' : '?'}connection_limit=1`;
}

/**
 * Aplica los pasos pendientes sobre la base de `url` (por defecto DATABASE_URL).
 * Devuelve los nombres de los pasos aplicados (vacío si la base ya estaba al día).
 */
export async function migrarBase(url = process.env.DATABASE_URL): Promise<string[]> {
  if (!url) return [];
  const prisma = new PrismaClient({ datasourceUrl: urlDeUnaConexion(url), log: ['error'] });
  const db = conexionPrisma(prisma);
  const aplicados: string[] = [];
  try {
    for (const paso of PASOS) {
      if (!(await paso.necesario(db))) continue;
      const sentencias = await paso.sentencias(db);
      const previas = (await db.consultar('PRAGMA foreign_key_check')).length;
      // Con las claves foráneas activas, DROP TABLE dispararía los ON DELETE CASCADE de las tablas hijas
      // (p. ej. borraría los ítems al reconstruir Pedido). Se desactivan solo durante la reconstrucción.
      await db.ejecutar('PRAGMA foreign_keys = OFF');
      try {
        await db.transaccion(sentencias, previas);
      } finally {
        await db.ejecutar('PRAGMA foreign_keys = ON');
      }
      aplicados.push(paso.nombre);
    }
  } finally {
    await prisma.$disconnect();
  }
  return aplicados;
}
