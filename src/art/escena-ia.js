/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · art/escena-ia.js
 * ---------------------------------------------------------------------------
 * La ilustración de una escena, pedida solo cuando la escena cambia.
 *
 * Antes se repintaba el paisaje en cada turno. Ahora hay ilustración nueva al
 * llegar a un sitio, al entrar o salir de un interior, al empezar o acabar un
 * combate, o cuando aparece alguien importante; entre medias se queda la que
 * hay. Cada una queda además en la bitácora, para hojear la partida como un
 * libro ilustrado.
 *
 * Mismo servicio y mismo estilo que los retratos (`retrato-ia.js`): anime de
 * trazo limpio y la paleta del juego. El encargo va en inglés por lo mismo que
 * allí: el modelo ignora el español.
 *
 * Funciones puras, salvo la URL, que solo arma una cadena.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { PALETA } from './retrato-ia.js';

const SERVICIO = 'https://image.pollinations.ai/prompt/';
const MODELO = 'sana';

// Apaisada, para la cabecera. Un poco más alta de lo que se ve, como los
// retratos: la marca de agua cae por abajo y el encuadre la recorta.
const ANCHO = 1024;
const ALTO = 640;

// «Medieval» va en la cabeza y no solo en los sitios que lo piden: con «a
// lonely dirt road» a secas el modelo pintó una carretera asfaltada con las
// líneas del carril.
const CABEZA = 'Anime cel shaded landscape illustration of a medieval fantasy world, wide establishing shot of';

/** Lo que el modelo tiende a colar y aquí no existe. */
const SIN_MODERNIDAD = 'No text, no letters, no asphalt, no cars, no power lines, no modern buildings.';

/** El sitio, por su terreno o su tipo. */
const TERRENO = Object.freeze({
  camino: 'a rutted dirt cart track through open country',
  bosque: 'a dense old forest',
  montana: 'a rocky mountain pass',
  pantano: 'a misty swamp with dead trees',
  ruinas: 'crumbling ancient ruins',
  ciudad: 'a walled medieval town',
  desierto: 'a salt desert with dunes',
  mazmorra: 'a dark underground hall',
  oceano: 'a grey windswept coast',
  rio: 'a shallow river ford',
});

/** Los interiores, por su tipo. */
const INTERIOR = Object.freeze({
  taberna: 'inside a crowded tavern with a hearth',
  posada: 'inside a warm inn with wooden beams',
  forja: 'inside a smoky forge with glowing coals',
  templo: 'inside a quiet stone temple with candles',
  mercado: 'at a busy market square',
  mina: 'inside a narrow mine tunnel',
});

/** Las franjas del reloj del juego (ver TimeSystem). */
const FRANJA = Object.freeze({
  madrugada: 'before dawn', alba: 'at dawn', manana: 'in the morning', mediodia: 'at noon',
  tarde: 'in the afternoon', ocaso: 'at sunset', noche: 'at night',
});

const CLIMA = Object.freeze({
  despejado: 'under a clear sky', nublado: 'under a heavy grey sky', lluvia: 'in the rain',
  tormenta: 'during a storm', niebla: 'in thick fog', nieve: 'in falling snow',
  ventisca: 'in a blizzard', calorSofocante: 'in shimmering heat',
});

/** Por qué cambió la escena: lo que tiene que contar la imagen. */
const MOTIVO = Object.freeze({
  combate: 'a tense fight breaking out, weapons drawn',
  fin_combate: 'the quiet after a fight, fallen weapons on the ground',
  encuentro: 'strangers appearing on the path',
  pnj: 'someone important stepping forward',
  hallazgo: 'a hidden discovery half revealed',
});

/** Oficios, para poner a la gente que hay delante. */
const OFICIO = Object.freeze([
  [/herrer/, 'a blacksmith'], [/posader|taberner/, 'an innkeeper'], [/barquer/, 'a ferryman'],
  [/cazador/, 'a hunter'], [/guardia|soldad/, 'a guard'], [/sacerdot|oficiant/, 'a priest'],
  [/mercader/, 'a merchant'],
]);

const llano = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/**
 * El encargo de una escena.
 *
 * @param {Object} escena
 * @param {string} [escena.terreno]
 * @param {string} [escena.interior] Tipo del sublugar, si está dentro.
 * @param {string} [escena.franja]
 * @param {string} [escena.clima]
 * @param {Array<{rol: string}>} [escena.npcs]
 * @param {string} [escena.motivo]
 * @returns {string}
 */
export function encargoEscena(escena = {}) {
  const sitio = INTERIOR[escena.interior] ?? TERRENO[escena.terreno] ?? 'a quiet village';

  const gente = (escena.npcs ?? [])
    .map((n) => OFICIO.find(([re]) => re.test(llano(n.rol)))?.[1] ?? 'a villager')
    .slice(0, 2);

  const partes = [
    sitio,
    FRANJA[llano(escena.franja)] ?? null,
    escena.interior ? null : (CLIMA[escena.clima] ?? null),
    gente.length ? `with ${gente.join(' and ')}` : null,
    MOTIVO[escena.motivo] ?? null,
  ].filter(Boolean);

  return `${CABEZA} ${partes.join(', ')}. ${SIN_MODERNIDAD} ${PALETA}`;
}

/** Semilla estable: la misma escena en el mismo momento da la misma imagen. */
function semilla(texto) {
  let h = 2166136261;
  for (let i = 0; i < texto.length; i += 1) {
    h ^= texto.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) % 2_000_000;
}

/**
 * La URL de la ilustración de una escena.
 *
 * @param {Object} escena Ver `encargoEscena`, más `lugar` y `sublugar`.
 * @returns {string}
 */
export function urlEscena(escena = {}) {
  const prompt = encargoEscena(escena);
  const clave = [escena.lugar, escena.sublugar, escena.franja, escena.clima, escena.motivo].join('|');

  const parametros = new URLSearchParams({
    width: String(ANCHO),
    height: String(ALTO),
    seed: String(semilla(clave)),
    nologo: 'true',
    model: MODELO,
  });

  return `${SERVICIO}${encodeURIComponent(prompt)}?${parametros}`;
}

export default { encargoEscena, urlEscena };
