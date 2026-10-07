/**
 * Máquina de estados del pedido para PATCH /api/pedidos (cobrar y cancelar tienen sus propias rutas).
 * Cada estado indica a cuáles puede pasar; lo que no está acá es 400. Antes se aceptaba cualquier salto entre estados
 * abiertos (p. ej. entregado → pendiente, o pendiente → entregado sin pasar por cocina).
 *   pendiente  → preparando                (cocina lo toma)
 *   preparando → listo                     (terminado)
 *   listo      → entregado | preparando    (se sirve, o se corrige un "listo" marcado por error)
 *   entregado  → preparando                (reabrir un pedido entregado y todavía sin cobrar)
 * `pagado` y `cancelado` son finales: no aparecen como origen.
 */
export const TRANSICIONES: Record<string, readonly string[]> = {
  pendiente: ['preparando'],
  preparando: ['listo'],
  listo: ['entregado', 'preparando'],
  entregado: ['preparando'],
};

/** Estados de los que un pedido ya no sale (ver TRANSICIONES). */
export const ESTADOS_FINALES: string[] = ['pagado', 'cancelado'];
