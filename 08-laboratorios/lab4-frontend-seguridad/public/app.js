const $ = (id) => document.getElementById(id);
const estado = $('estado'), errorEl = $('error'), lista = $('lista'), form = $('nuevo');

function mostrarError(mensaje) { errorEl.textContent = mensaje; errorEl.hidden = !mensaje; }

/** Una sola función de red: siempre muestra data.error, nunca se rompe si la API falla. */
async function api(ruta, opciones) {
  try {
    const r = await fetch(ruta, { headers: { 'Content-Type': 'application/json' }, ...opciones });
    const datos = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(datos.error ?? `Error ${r.status}`);
    return datos;
  } catch (e) {
    throw new Error(e instanceof TypeError ? 'No hay conexión con el servidor' : e.message);
  }
}

function dibujar(pedidos) {
  lista.replaceChildren(...pedidos.map((p) => {
    const li = document.createElement('li');
    const texto = document.createElement('span');
    texto.textContent = `#${p.id} · ${p.cliente} · ${p.estado}`; // textContent: los datos del usuario nunca se interpretan como HTML (XSS)
    li.append(texto);
    if (p.estado === 'abierto') {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = 'Cobrar';
      b.setAttribute('aria-label', `Cobrar pedido ${p.id} de ${p.cliente}`);
      b.addEventListener('click', () => cobrar(p.id, b));
      li.append(b);
    }
    return li;
  }));
}

async function cargar() {
  // Recargar la lista NO borra un error de la acción anterior: solo lo borra el éxito de una acción nueva.
  try { dibujar((await api('/api/pedidos')).pedidos); }
  catch (e) { mostrarError(e.message); }
}

async function cobrar(id, boton) {
  if (boton.disabled) return;
  boton.disabled = true; // evita el doble envío
  estado.textContent = `Cobrando pedido ${id}…`;
  try { await api(`/api/pedidos/${id}/cobrar`, { method: 'POST', body: '{}' }); estado.textContent = `Pedido ${id} cobrado`; mostrarError(''); }
  catch (e) { mostrarError(e.message); estado.textContent = ''; }
  finally { boton.disabled = false; await cargar(); }
}

form.addEventListener('submit', async (ev) => {
  ev.preventDefault();
  const envio = form.querySelector('button');
  envio.disabled = true;
  try { await api('/api/pedidos', { method: 'POST', body: JSON.stringify({ cliente: $('cliente').value }) }); form.reset(); mostrarError(''); estado.textContent = 'Pedido creado'; }
  catch (e) { mostrarError(e.message); }
  finally { envio.disabled = false; await cargar(); }
});

cargar();
