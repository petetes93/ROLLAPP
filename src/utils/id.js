/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · utils/id.js
 * ---------------------------------------------------------------------------
 * Generación de identificadores.
 *
 * Dos familias, con propósitos distintos:
 *   · id()        → efímero, para elementos del DOM y claves de render.
 *   · idEntidad() → persistente, va dentro del guardado y debe sobrevivir a
 *                   recargas y migraciones.
 *
 * Los identificadores de entidad llevan prefijo por tipo ('npc_', 'itm_') para
 * que un vistazo al estado o a un volcado diga de qué se está hablando sin
 * tener que buscarlo.
 *
 * Sin dependencias.
 * ═══════════════════════════════════════════════════════════════════════════
 */

/** Contador monótono, garantiza unicidad dentro de la sesión. */
let contador = 0;

/** Alfabeto sin caracteres ambiguos (0/O, 1/l/I), por si un id se lee en voz alta. */
const ALFABETO = '23456789abcdefghjkmnpqrstuvwxyz';

/**
 * Prefijos por tipo de entidad. Usar el enumerado en vez de cadenas sueltas
 * evita que aparezca 'npc_' en un sitio y 'pnj_' en otro.
 * @readonly
 * @enum {string}
 */
export const TIPO = Object.freeze({
  ENTRADA: 'ent',      // entrada de la bitácora
  OBJETO: 'itm',
  NPC: 'npc',
  MISION: 'qst',
  COMBATIENTE: 'cbt',
  LUGAR: 'loc',
  FACCION: 'fac',
  EVENTO: 'evt',
  EFECTO: 'efx',
  OPCION: 'opt',
  PARTIDA: 'gam',
});

/**
 * Identificador corto y único dentro de la sesión.
 * Pensado para atributos `id` del DOM y claves de reconciliación; no se guarda.
 *
 * @param {string} [prefijo='e'] Prefijo legible.
 * @returns {string} 'e7', 'btn12'…
 */
export function id(prefijo = 'e') {
  return `${prefijo}${++contador}`;
}

/**
 * Cadena aleatoria del alfabeto seguro.
 *
 * @param {number} [longitud=8]
 * @returns {string}
 */
export function aleatoria(longitud = 8) {
  let salida = '';
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = crypto.getRandomValues(new Uint8Array(longitud));
    for (let i = 0; i < longitud; i++) salida += ALFABETO[bytes[i] % ALFABETO.length];
    return salida;
  }
  for (let i = 0; i < longitud; i++) {
    salida += ALFABETO[Math.floor(Math.random() * ALFABETO.length)];
  }
  return salida;
}

/**
 * Identificador persistente de entidad. Va al guardado.
 *
 * Formato: `tipo_base36temporal_aleatorio`. La parte temporal hace que los
 * identificadores sean naturalmente ordenables por antigüedad, lo que resulta
 * cómodo al depurar un estado con cientos de entidades.
 *
 * @param {string} [tipo=TIPO.EVENTO] Prefijo de TIPO.
 * @returns {string} 'npc_lz3k9q_a7fx2m'
 */
export function idEntidad(tipo = TIPO.EVENTO) {
  return `${tipo}_${Date.now().toString(36)}_${aleatoria(6)}`;
}

/**
 * Extrae el tipo de un identificador de entidad.
 *
 * @param {string} valor
 * @returns {string|null} El prefijo, o null si no tiene forma de id de entidad.
 */
export function tipoDe(valor) {
  if (typeof valor !== 'string') return null;
  const guion = valor.indexOf('_');
  return guion > 0 ? valor.slice(0, guion) : null;
}

/**
 * Comprueba si un identificador pertenece a un tipo.
 *
 * @param {string} valor
 * @param {string} tipo
 * @returns {boolean}
 */
export function esTipo(valor, tipo) {
  return tipoDe(valor) === tipo;
}

/**
 * Identificador estable derivado de un texto. La misma entrada produce siempre
 * la misma salida, lo que permite deduplicar contenido generado por el director
 * sin mantener un registro aparte.
 *
 * @param {string} texto
 * @param {string} [tipo=TIPO.EVENTO]
 * @returns {string}
 */
export function idEstable(texto, tipo = TIPO.EVENTO) {
  let h = 0x811c9dc5;
  for (let i = 0; i < texto.length; i++) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return `${tipo}_${(h >>> 0).toString(36)}`;
}

/** Reinicia el contador de sesión. Solo para pruebas. */
export function reiniciarContador() {
  contador = 0;
}

export default { id, aleatoria, idEntidad, idEstable, tipoDe, esTipo, TIPO };
