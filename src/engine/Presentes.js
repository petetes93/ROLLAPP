/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · engine/Presentes.js
 * ---------------------------------------------------------------------------
 * ¿Está aquí la persona a la que se refiere el jugador?
 *
 * «Ayudo al carretero a levantar el carro» se narraba como hecho aunque en
 * el pueblo no hubiera ningún carretero: el eco devolvía la frase en segunda
 * persona y el mundo se inventaba a alguien. Con esto, si la acción nombra un
 * oficio y no hay nadie de ese oficio delante, se dice.
 *
 * Funciones puras.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { sinAcentos } from '../utils/text.js';

/** Oficios y papeles que el jugador puede nombrar, en masculino. */
const OFICIOS = [
  'tabernero', 'posadero', 'herrero', 'carretero', 'guardia', 'barquero', 'mercader',
  'sacerdote', 'cazador', 'pastor', 'buhonero', 'alcalde', 'soldado', 'capitan',
  'boticario', 'curandero', 'panadero', 'pescador', 'minero', 'tendero', 'mozo',
  'aprendiz', 'cocinero', 'escriba', 'carnicero', 'molinero', 'leñador', 'nino',
  'encapuchado', 'vigia', 'centinela', 'lavandero',
];

const llano = (t) => sinAcentos(String(t ?? '').toLowerCase());

/** La raíz sin la vocal final: «herrer» vale para herrero y herrera. */
const raiz = (oficio) => oficio.replace(/[oa]$/, '');

/**
 * El oficio al que se refiere el texto y que no tiene a nadie delante.
 *
 * @param {string} texto Lo que hace el jugador.
 * @param {Array<{nombre?: string, rol?: string}>} presentes
 * @returns {string|null} El oficio tal y como lo escribió, o null.
 */
export function oficioAusente(texto, presentes = []) {
  const n = llano(texto);
  const roles = presentes.map((p) => llano(p?.rol));

  for (const oficio of OFICIOS) {
    const r = raiz(sinAcentos(oficio));
    const m = n.match(new RegExp(`\\b(?:al?|el|la|los|las|del|un|una)\\s+(${r}(?:o|a|os|as|e|es)?)\\b`));
    if (!m) continue;
    const hay = roles.some((rol) => new RegExp(`\\b${r}`).test(rol));
    if (!hay) return m[1];
  }
  return null;
}

export default { oficioAusente };
