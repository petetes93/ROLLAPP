/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · ai/Trasfondo.js
 * ---------------------------------------------------------------------------
 * La historia que escribe el jugador, leída como canon y no como guion.
 *
 * Antes, la biografía se convertía en la campaña: su primera frase era la
 * misión principal del turno 1, las siguientes eran las misiones que venían
 * después, y cada una se abría como hilo cuya urgencia crecía al ignorarla.
 * «Mi padre perdió la forja» acababa en «busca al culpable, está en Saucedo».
 *
 * Aquí la historia se separa en lo que el jugador AFIRMA (hechos), lo que su
 * personaje QUIERE (aspiraciones) y lo que CREE sin saberlo (sospechas). Es
 * canon: no se contradice. Pero no es una lista de tareas: una aspiración se
 * vuelve objetivo solo si el jugador lo decide jugando, y una sospecha no se
 * da por cierta.
 *
 * Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { sinAcentos } from '../utils/text.js';

/** Lo que el personaje quiere, busca o se ha propuesto. */
const ASPIRACION = /\b(?:quiero|quiere|busco|busca|buscando|deseo|desea|sueno|sueña|anhelo|pretendo|me propuse|me propongo|jure|juro|juró|prometi|promet[ií]|debo|tengo que|necesito|voy a|espero (?:encontrar|volver|saber)|mi objetivo)\b/;

/** Lo que cree o le han contado, sin saberlo de cierto. */
const SOSPECHA = /\b(?:creo que|cree que|sospecho|sospecha|dicen que|me dijeron|le dijeron|se rumorea|rumor|quiza|quizas|tal vez|puede que|parece que|al parecer|supuestamente|nadie sabe|no se sabe|no se si)\b/;

/**
 * Parte la historia en frases.
 * @param {string} lore
 * @returns {string[]}
 */
function frases(lore) {
  return String(lore ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(/(?<=[.!?…;])\s+/u)
    .map((f) => f.trim())
    .filter((f) => f.length >= 4);
}

/**
 * Clasifica la historia del jugador.
 *
 * La sospecha gana a la aspiración: «creo que debo volver» es algo que cree,
 * no algo que ha decidido.
 *
 * @param {string} lore
 * @returns {{hechos: string[], aspiraciones: string[], sospechas: string[]}}
 */
export function leerTrasfondo(lore) {
  const r = { hechos: [], aspiraciones: [], sospechas: [] };
  for (const f of frases(lore)) {
    const n = sinAcentos(f.toLowerCase());
    if (SOSPECHA.test(n)) r.sospechas.push(f);
    else if (ASPIRACION.test(n)) r.aspiraciones.push(f);
    else r.hechos.push(f);
  }
  return r;
}

/**
 * La historia, lista para el director: separada y con la regla de uso.
 *
 * @param {string} lore
 * @returns {string} Vacío si no hay historia.
 */
export function trasfondoParaDirector(lore) {
  const t = leerTrasfondo(lore);
  if (!t.hechos.length && !t.aspiraciones.length && !t.sospechas.length) return '';

  const bloques = ['PASADO DEL PERSONAJE, escrito por el jugador. Es canon, no guion:'];
  if (t.hechos.length) bloques.push(`· Hechos que afirma (no los contradigas): ${t.hechos.join(' ')}`);
  if (t.aspiraciones.length) bloques.push(`· Lo que su personaje quiere (NO es una misión; solo lo será si el jugador lo persigue jugando): ${t.aspiraciones.join(' ')}`);
  if (t.sospechas.length) bloques.push(`· Lo que cree o le contaron (no está confirmado; no lo des por cierto): ${t.sospechas.join(' ')}`);
  bloques.push('No conviertas este pasado en el eje de la campaña ni lo traigas a escena por tu cuenta. Puede colorear un detalle si encaja, y vuelve con fuerza solo cuando el jugador lo busca, lo nombra o una situación del mundo lo roza de verdad. No inventes que recuerda, sabe o domina algo que él no ha escrito.');
  return bloques.join('\n');
}

export default { leerTrasfondo, trasfondoParaDirector };
