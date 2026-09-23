/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · player/CharacterRandom.js
 * ---------------------------------------------------------------------------
 * Ficha aleatoria para «Nueva partida».
 *
 * Una pulsación elige linaje, oficio, pasado y nombre de golpe; otra lo vuelve
 * a tirar todo. El jugador conserva la última palabra: después escribe su
 * propio nombre, su aspecto y su historia.
 *
 * Funciones puras: reciben un generador opcional para poder repetir tiradas.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { RAZAS } from '../data/races.data.js';
import { CLASES } from '../data/classes.data.js';
import { TRASFONDOS } from '../data/backgrounds.data.js';
import { SILABAS_NOMBRE } from '../data/names.data.js';

const elegir = (lista, azar) => lista[Math.floor(azar() * lista.length) % lista.length];

/**
 * Nombre aleatorio con el sonido del linaje.
 * @param {string} raza
 * @param {'m'|'f'} [genero]
 * @param {() => number} [azar]
 * @returns {string}
 */
export function nombreAleatorio(raza, genero, azar = Math.random) {
  const pila = SILABAS_NOMBRE[raza] ?? SILABAS_NOMBRE.valdes;
  const g = genero ?? (azar() < 0.5 ? 'f' : 'm');
  const nombre = elegir(pila.inicio, azar) + elegir(g === 'f' ? pila.finalF : pila.final, azar);
  return nombre.charAt(0).toUpperCase() + nombre.slice(1).toLowerCase();
}

/**
 * Ficha completa al azar: uno de los ocho linajes, oficio, pasado y nombre.
 * @param {() => number} [azar]
 * @returns {{raza: string, clase: string, trasfondo: string, nombre: string, genero: 'm'|'f'}}
 */
export function fichaAleatoria(azar = Math.random) {
  const raza = elegir(Object.keys(RAZAS), azar);
  const genero = azar() < 0.5 ? 'f' : 'm';
  return {
    raza,
    clase: elegir(Object.keys(CLASES), azar),
    trasfondo: elegir(Object.keys(TRASFONDOS), azar),
    genero,
    nombre: nombreAleatorio(raza, genero, azar),
  };
}

export default { nombreAleatorio, fichaAleatoria };
