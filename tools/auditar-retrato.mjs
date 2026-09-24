/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-retrato.mjs
 * ---------------------------------------------------------------------------
 * ¿El retrato pinta lo que escribió el jugador?
 *
 * Nace de un playtest. Con «enana guerrera de barba trenzada pelirroja, hacha
 * a la espalda» el encargo a Pollinations salió con "grey-blue skin, curved
 * horns from the temples": la ficha aleatoria era Griscuerno y sus rasgos se
 * colaban. En otra partida el panel lateral enseñaba una pelirroja joven sin
 * barba ni hacha.
 *
 * Lo que se sujeta aquí es el ENCARGO, no la imagen: la imagen la pinta un
 * servicio de fuera y no se puede auditar sin red. Pero si el encargo es
 * correcto, lo que queda es cosa del modelo; y si es incorrecto, ningún
 * modelo lo arregla.
 *
 *   node tools/auditar-retrato.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { encargoRetrato, urlRetrato, especieNombrada } from '../src/art/retrato-ia.js';
import { RAZAS } from '../src/data/races.data.js';
import { encargoEscena, urlEscena } from '../src/art/escena-ia.js';
import { PALETA } from '../src/art/retrato-ia.js';

let fallos = 0;

function comprobar(bien, texto, detalle = '') {
  if (bien) {
    console.log(`OK   ${texto}`);
  } else {
    fallos += 1;
    console.log(`MAL  ${texto}`);
    if (detalle) console.log(`     ${detalle}`);
  }
}

const ENANA = 'enana guerrera de barba trenzada pelirroja, hacha a la espalda';

/* ── La especie escrita manda sobre la ficha ─────────────────────────────── */

const conCuernos = encargoRetrato({ raza: 'griscuerno', descripcion: ENANA });

comprobar(!/grey-blue|horns?/.test(conCuernos),
  'con especie escrita no se cuelan piel ni cuernos del linaje de la ficha',
  conCuernos);

comprobar(/\bdwarf\b/.test(conCuernos), 'la especie escrita llega al encargo', conCuernos);

// La misma descripción debe dar el mismo sujeto sea cual sea el dado.
const encargos = new Set(Object.keys(RAZAS).map((raza) => encargoRetrato({ raza, descripcion: ENANA })));
comprobar(encargos.size === 1,
  `con especie escrita el encargo es igual para los ${Object.keys(RAZAS).length} linajes`,
  `salieron ${encargos.size} encargos distintos`);

/* ── Lo que distingue al personaje, delante ─────────────────────────────── */

const pos = (t) => conCuernos.indexOf(t);

comprobar(pos('braided beard') > 0 && pos('battle axe') > 0,
  'la barba y el hacha están en el encargo', conCuernos);

comprobar(pos('braided beard') < pos('red hair') && pos('battle axe') < pos('red hair'),
  'la barba y el hacha van antes que el pelo',
  `barba ${pos('braided beard')}, hacha ${pos('battle axe')}, pelo ${pos('red hair')}`);

// El sujeto sigue siendo lo primero: la barba no puede adelantar a «a woman».
comprobar(pos('a woman') < pos('braided beard'), 'el sexo sigue delante de los rasgos', conCuernos);

const cicatriz = encargoRetrato({ raza: 'valdes', descripcion: 'herrero con delantal de cuero, ojos grises y cicatriz en la ceja' });
comprobar(cicatriz.indexOf('scar') < cicatriz.indexOf('eyes'),
  'la cicatriz va antes que los ojos', cicatriz);

/* ── Sin especie escrita, el linaje sí cuenta ───────────────────────────── */

const sinEspecie = encargoRetrato({ raza: 'griscuerno', descripcion: 'guerrera de pelo rojo y cicatriz en la ceja' });
comprobar(/horns/.test(sinEspecie),
  'sin especie escrita, el linaje de la ficha sigue aportando sus rasgos', sinEspecie);

const neutro = encargoRetrato({ raza: 'valdes', descripcion: 'con cicatriz y barba espesa y ojos grises' });
comprobar(/one person/.test(neutro) && neutro.indexOf('one person') < neutro.indexOf('beard'),
  'sin sexo ni especie, el encargo empieza por un sujeto y no por un rasgo suelto', neutro);

/* ── Qué especie ha nombrado ────────────────────────────────────────────── */

const ESPECIES = [
  ['enana guerrera de barba trenzada', 'enana'],
  ['Elfa exploradora de ojos verdes', 'elfa'],
  ['un orco enorme con colmillos', 'orco'],
  ['mediana ladrona muy rápida', 'mediana'],
  ['guerrera pelirroja con hacha', null],
];

for (const [texto, espera] of ESPECIES) {
  const sale = especieNombrada(texto);
  comprobar(sale === espera, `«${texto}» nombra ${espera ?? 'ninguna especie'}`, `salió ${sale}`);
}

/* ── Un personaje, un retrato ───────────────────────────────────────────── */

// La revelación, el panel lateral y las miniaturas piden el retrato por
// separado. Si la URL no es idéntica, son tres imágenes distintas.
const a = urlRetrato({ raza: 'griscuerno', descripcion: ENANA });
const b = urlRetrato({ raza: 'griscuerno', descripcion: ENANA, nombre: 'Brunhilda' });
comprobar(a && a === b, 'el mismo personaje da siempre la misma URL, se pida desde donde se pida');

// Con la especie escrita, el dado de la ficha no pinta: volver a tirar no
// puede cambiar la cara ni lanzar otra generación.
const urls = new Set(Object.keys(RAZAS).map((raza) => urlRetrato({ raza, descripcion: ENANA })));
comprobar(urls.size === 1, 'con especie escrita, cambiar de linaje no cambia el retrato',
  `salieron ${urls.size} URL distintas`);

// Sin especie escrita el linaje sí aporta rasgos, y la semilla lo refleja.
const sinEsp = 'guerrera de pelo rojo con cicatriz';
comprobar(urlRetrato({ raza: 'albar', descripcion: sinEsp }) !== urlRetrato({ raza: 'griscuerno', descripcion: sinEsp }),
  'sin especie escrita, cada linaje tiene su retrato');

/* ── La ilustración de escena casa con la escena ────────────────────────── */

// Mismo servicio y mismo libro que los retratos: la escena lleva la paleta
// del juego y dice dónde, cuándo y con quién.
{
  const taberna = encargoEscena({ terreno: 'ciudad', interior: 'taberna', franja: 'noche', clima: 'lluvia',
    npcs: [{ rol: 'posadera' }], motivo: 'pnj' });
  comprobar(taberna.includes('inside a crowded tavern') && taberna.includes('at night') && taberna.includes('an innkeeper'),
    'la escena de la taberna dice dónde, cuándo y con quién', taberna);
  comprobar(!taberna.includes('in the rain'), 'dentro de un interior no llueve', taberna);
  comprobar(taberna.endsWith(PALETA), 'la escena lleva la paleta de los retratos', taberna);

  const camino = encargoEscena({ terreno: 'camino', franja: 'ocaso', clima: 'niebla', motivo: 'combate' });
  comprobar(camino.includes('at sunset') && camino.includes('in thick fog') && camino.includes('weapons drawn'),
    'las franjas del reloj («ocaso») y el motivo llegan al encargo', camino);

  const escena = { lugar: 'vado_yunque', sublugar: null, terreno: 'ciudad', franja: 'alba', clima: 'despejado', motivo: 'llegada' };
  comprobar(urlEscena(escena) === urlEscena({ ...escena, npcs: [] }),
    'la misma escena en el mismo momento da la misma imagen');
  comprobar(urlEscena(escena) !== urlEscena({ ...escena, franja: 'noche' }),
    'la misma escena de noche es otra imagen');
}

console.log(`\n${fallos ? `${fallos} fallos.` : 'Todo correcto.'}`);
process.exit(fallos ? 1 : 0);
