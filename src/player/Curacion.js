/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · player/Curacion.js
 * ---------------------------------------------------------------------------
 * «Vendo la herida», «bebo la poción», dentro y fuera de combate.
 *
 * Si lleva algo para curarse, lo usa. Si no, se venda como puede: una tirada
 * de medicina, y con éxito recupera un poco. No se cura sin tirar ni sin
 * gastar nada, que es lo que haría de una frase un botón de «curar gratis».
 *
 * Recibe el sistema que la llama (combate o enrutador) para despachar con sus
 * permisos; no guarda estado.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Frases que piden curarse. */
export const PIDE_CURAR = /\b(vendo|vendarme|me vendo|me curo|curarme|me trato la herida|tratarme|taponar|taponarme|primeros auxilios|me coso|coserme)\b/;

/**
 * Cura al jugador con lo que tenga a mano.
 *
 * @param {Object} sistema Un SystemBase: `despachar` y `sistema('rules')`.
 * @param {Object|null} objeto Un consumible para curarse, si lo lleva.
 * @returns {{curado: boolean, texto: string, cantidad: number}}
 */
export function curarConTexto(sistema, objeto = null) {
  if (objeto) {
    sistema.despachar('inventory/consumir', { idObjeto: objeto.id });
    return { curado: true, cantidad: 0, texto: `Te tomas ${objeto.nombre.toLowerCase()}.` };
  }

  const tirada = sistema.sistema('rules').resolver({ habilidad: 'medicina', umbral: 'moderada' });
  const dados = `(d20 ${tirada.natural}: ${tirada.total} contra ${tirada.umbral})`;

  if (!tirada.exito) {
    return { curado: false, cantidad: 0, texto: `Intentas cerrarte la herida, pero ahora mismo no hay manera. ${dados}` };
  }

  // Poca cosa, y sale de la tirada: vendarse no es una poción.
  const cantidad = 2 + (tirada.natural % 4);
  sistema.despachar('player/curar', { cantidad, origen: 'primeros auxilios' });

  return { curado: true, cantidad, texto: `Te vendas como puedes y recuperas ${cantidad} de vida. ${dados}` };
}

export default { curarConTexto, PIDE_CURAR };
