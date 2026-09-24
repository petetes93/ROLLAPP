/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/Pregunta.js
 * ---------------------------------------------------------------------------
 * La pregunta de mesa con que se cierra cada turno.
 *
 * El rótulo «¿QUÉ HACES?» estaba encima de la caja, pero la narración no lo
 * preguntaba nunca: terminaba en un pájaro cruzando el cielo y el jugador no
 * sabía si el turno había acabado. En una mesa, el máster cierra devolviendo
 * la palabra. Aquí también.
 *
 * Breve y variada. La forma corta es solo «¿Qué haces?»; las demás llevan algo
 * de la escena delante —quién espera, qué se echa encima— para que no suene a
 * formulario. Va en su propia línea y no es un golpe de ritmo: no para el ojo,
 * devuelve el turno.
 *
 * Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** La forma corta. */
export const CORTA = '¿Qué haces?';

/**
 * Candidatas para esta escena.
 *
 * @param {Object} escena
 * @param {Array<{nombre: string}>} [escena.npcs] Quien está delante.
 * @param {Array<{nombre: string}>} [escena.enemigos] En combate.
 * @param {string} [escena.franja] 'noche', 'anochecer'…
 * @returns {string[]}
 */
export function candidatas({ npcs = [], enemigos = [], franja = null } = {}) {
  const lista = [CORTA];

  const enemigo = enemigos.find((e) => e?.nombre)?.nombre;
  if (enemigo) {
    lista.push(
      `${enemigo} no te quita ojo. ¿Qué haces?`,
      `${enemigo} espera tu movimiento. ¿Qué haces?`,
    );
    return lista;
  }

  const npc = npcs.find((n) => n?.nombre)?.nombre;
  if (npc) {
    lista.push(
      `${npc} espera tu respuesta. ¿Qué haces?`,
      `${npc} te mira, esperando. ¿Qué haces?`,
    );
  }

  if (franja === 'noche' || franja === 'anochecer') lista.push('La noche se echa encima. ¿Qué haces?');
  if (franja === 'amanecer') lista.push('El día empieza. ¿Qué haces?');

  lista.push('La decisión es tuya. ¿Qué haces?');
  return lista;
}

/**
 * Elige una sin repetir la anterior.
 *
 * @param {Object} escena Ver `candidatas`.
 * @param {Object} [opciones]
 * @param {string|null} [opciones.anterior]
 * @param {(lista: string[]) => string} [opciones.elegir]
 * @returns {string}
 */
export function preguntaDeMesa(escena = {}, { anterior = null, elegir = (l) => l[0] } = {}) {
  const lista = candidatas(escena);
  const sinRepetir = lista.filter((p) => p !== anterior);
  return elegir(sinRepetir.length ? sinRepetir : lista) ?? CORTA;
}

/**
 * ¿La narración ya termina devolviendo la palabra?
 *
 * Si el narrador ya ha preguntado —un modelo lo hace a menudo—, no se añade
 * otra: dos preguntas seguidas es un máster que no escucha.
 *
 * @param {string} texto
 * @returns {boolean}
 */
export function terminaEnPregunta(texto) {
  const ultima = String(texto ?? '').trim().split('\n').filter((l) => l.trim()).at(-1) ?? '';
  return /\?[»"”]?$/u.test(ultima.trim());
}

/**
 * Cierra la narración con la pregunta, en su propia línea.
 *
 * @param {string} texto
 * @param {string} pregunta
 * @returns {string}
 */
export function cerrarConPregunta(texto, pregunta) {
  const t = String(texto ?? '').trimEnd();
  if (!t) return pregunta;
  if (terminaEnPregunta(t)) return t;
  return `${t}\n${pregunta}`;
}

export default { CORTA, candidatas, preguntaDeMesa, terminaEnPregunta, cerrarConPregunta };
