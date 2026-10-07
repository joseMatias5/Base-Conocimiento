import http from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const publico = resolve(dirname(fileURLToPath(import.meta.url)), '../public');
const PUERTO = Number(process.env.PORT ?? 3100);
const LIMITE = Number(process.env.LAB4_LIMITE ?? 1000);   // peticiones que cambian datos por minuto y por IP
const RETARDO = Number(process.env.LAB4_RETARDO_MS ?? 0); // simula una API lenta (para probar el doble envío)
const MAX_CUERPO = 1024;

const pedidos = [
  { id: 1, cliente: 'Mesa 1', estado: 'abierto' },
  { id: 2, cliente: 'Mesa 2', estado: 'abierto' },
];
let siguiente = 3;
let cobrosRegistrados = 0;

const CABECERAS = {
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

const intentos = new Map(); // ip -> { desde, n }. La IP sale del socket, nunca de X-Forwarded-For (L-022).
function excedeLimite(ip) {
  const ahora = Date.now();
  const e = intentos.get(ip);
  if (!e || ahora - e.desde > 60_000) { intentos.set(ip, { desde: ahora, n: 1 }); return false; }
  return ++e.n > LIMITE;
}

function responder(res, estado, cuerpo, tipo = 'application/json; charset=utf-8', extra = {}) {
  res.writeHead(estado, { ...CABECERAS, 'Content-Type': tipo, ...extra });
  res.end(typeof cuerpo === 'string' || Buffer.isBuffer(cuerpo) ? cuerpo : JSON.stringify(cuerpo));
}
const error = (res, estado, mensaje, extra) => responder(res, estado, { error: mensaje }, undefined, extra); // forma única { error }

function leerCuerpo(req) {
  return new Promise((ok, fallo) => {
    let tam = 0; const trozos = [];
    // Al superar el máximo se deja de acumular y se responde 413 con Connection: close (destruir el socket impedía contestar).
    req.on('data', (t) => { tam += t.length; if (tam > MAX_CUERPO) fallo(Object.assign(new Error('grande'), { estado: 413 })); else if (tam <= MAX_CUERPO) trozos.push(t); });
    req.on('end', () => ok(Buffer.concat(trozos).toString('utf8')));
    req.on('error', fallo);
  });
}

/** CSRF: toda petición que cambia datos debe venir del mismo origen (L-024). */
function origenValido(req) {
  const origen = req.headers.origin;
  return origen === `http://${req.headers.host}`;
}

const ESTATICOS = { '/': ['index.html', 'text/html; charset=utf-8'], '/app.js': ['app.js', 'text/javascript; charset=utf-8'], '/estilos.css': ['estilos.css', 'text/css; charset=utf-8'] };

export const servidor = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, 'http://x');
    if (req.method === 'GET' && ESTATICOS[url.pathname]) {
      const [archivo, tipo] = ESTATICOS[url.pathname];
      return responder(res, 200, readFileSync(resolve(publico, archivo)), tipo, { 'Cache-Control': 'no-cache' });
    }
    if (req.method === 'GET' && url.pathname === '/api/pedidos') return responder(res, 200, { pedidos, cobrosRegistrados }, undefined, { 'Cache-Control': 'no-store' });

    const cobrar = url.pathname.match(/^\/api\/pedidos\/(\d+)\/cobrar$/);
    const crear = url.pathname === '/api/pedidos';
    if (req.method === 'POST' && (cobrar || crear)) {
      if (!origenValido(req)) return error(res, 403, 'Origen no permitido');
      if (excedeLimite(req.socket.remoteAddress)) return error(res, 429, 'Demasiados intentos, probá en un minuto', { 'Retry-After': '60' });
      if (!(req.headers['content-type'] ?? '').startsWith('application/json')) return error(res, 415, 'Se requiere application/json');
      let datos;
      try { datos = JSON.parse((await leerCuerpo(req)) || '{}'); } catch (e) { return e.estado === 413 ? error(res, 413, 'Cuerpo demasiado grande', { Connection: 'close' }) : error(res, 400, 'JSON inválido'); }
      if (RETARDO) await new Promise((r) => setTimeout(r, RETARDO));

      if (crear) {
        const cliente = typeof datos.cliente === 'string' ? datos.cliente.trim() : '';
        if (cliente.length < 1 || cliente.length > 40) return error(res, 400, 'El cliente debe tener entre 1 y 40 caracteres');
        const p = { id: siguiente++, cliente, estado: 'abierto' };
        pedidos.push(p);
        return responder(res, 201, p);
      }
      const p = pedidos.find((x) => x.id === Number(cobrar[1]));
      if (!p) return error(res, 404, 'Pedido inexistente');
      if (p.estado !== 'abierto') return error(res, 409, 'El pedido ya fue cobrado'); // reclamar estado: solo uno gana
      p.estado = 'cobrado'; cobrosRegistrados++;
      return responder(res, 200, p);
    }
    return error(res, url.pathname.startsWith('/api/') ? 404 : 404, 'No encontrado');
  } catch {
    return error(res, 500, 'Error interno'); // sin detalles internos
  }
});

servidor.listen(PUERTO, '127.0.0.1');
