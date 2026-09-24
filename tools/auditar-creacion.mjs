/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-creacion.mjs
 * ---------------------------------------------------------------------------
 * «¿Te gusta así o quieres cambiar algo?»
 *
 * Fija el lector de correcciones de la revelación: qué entiende, qué cambia y,
 * sobre todo, qué NO toca. Lo delicado es el sexo: «enana guerrera de barba
 * trenzada pelirroja» tiene que pasar a «enano guerrero» y dejar la barba
 * pelirroja, porque «pelirroja» va con la barba. Y el retrato tiene que decir
 * «a man» después, que es lo que de verdad se pinta.
 *
 *   node tools/auditar-creacion.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { aplicarCorreccion, cambiarSexo, resumenPersonaje, sexoDescrito } from '../src/player/Correccion.js';
import { encargoRetrato, urlRetrato } from '../src/art/retrato-ia.js';

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

const BRUNHILDA = Object.freeze({
  id: 'pj-prueba', nombre: 'Brunhilda', genero: 'f', raza: 'ferrano', clase: 'rastreador',
  retrato: 'enana guerrera de barba trenzada pelirroja, hacha a la espalda',
  lore: 'Perdí la forja de mi padre en un incendio. Busco a quien lo provocó.',
  semillaRetrato: 124684,
});

const corregir = (texto, p = BRUNHILDA) => aplicarCorreccion(p, texto);

/* ── «mejor que sea hombre», el caso de la regresión ──────────────────────── */

{
  const r = corregir('mejor que sea hombre');
  const p = r.personaje;
  comprobar(p.genero === 'm', 'el sexo cambia', `genero=${p.genero}`);
  comprobar(p.nombre === 'Brunhilda', 'el nombre se conserva', p.nombre);
  comprobar(p.retrato === 'enano guerrero de barba trenzada pelirroja, hacha a la espalda',
    'la descripción cambia la persona y no la barba', p.retrato);
  comprobar(/\ba man\b/.test(encargoRetrato(p)) && !/\ba woman\b/.test(encargoRetrato(p)),
    'el retrato pide «a man»', encargoRetrato(p));
  comprobar(new URL(urlRetrato(p)).searchParams.get('seed') === String(BRUNHILDA.semillaRetrato),
    'con la misma semilla: cambia lo pedido, no la cara');
  comprobar(p.id === BRUNHILDA.id && p.raza === BRUNHILDA.raza && p.clase === BRUNHILDA.clase && p.lore === BRUNHILDA.lore,
    'lo que no se menciona no se toca');
}

/* ── El resto de correcciones ─────────────────────────────────────────────── */

const CASOS = [
  ['que se llame Brun', (p) => p.nombre === 'Brun'],
  ['que sea elfa', (p) => /^elfa guerrera/.test(p.retrato) && p.genero === 'f'],
  ['que sea un enano', (p) => /^enano guerrero/.test(p.retrato) && p.genero === 'm'],
  ['ponle una cicatriz en el ojo', (p) => /cicatriz en el ojo$/.test(p.retrato) && /scar over one eye/.test(encargoRetrato(p))],
  ['quítale la barba', (p) => p.retrato === 'enana guerrera, hacha a la espalda'],
  ['sin hacha', (p) => p.retrato === 'enana guerrera de barba trenzada pelirroja'],
  ['que sea más joven', (p) => /joven$/.test(p.retrato) && /young/.test(encargoRetrato(p))],
  ['que sea de linaje albar', (p) => p.raza === 'albar'],
  ['mejor glifista', (p) => p.clase === 'glifista'],
  ['que sea hombre y que se llame Brun', (p) => p.genero === 'm' && p.nombre === 'Brun'],
  // Lo que lleva encima: salió en la prueba de entrega y no se entendía.
  ['que lleve una capa roja', (p) => /con una capa roja$/.test(p.retrato) && p.genero === 'f'],
  ['que se llame Brun y lleva un escudo de roble', (p) => p.nombre === 'Brun' && /con un escudo de roble$/.test(p.retrato)],
];

for (const [texto, bien] of CASOS) {
  const r = corregir(texto);
  comprobar(r.entendido && bien(r.personaje), `«${texto}»`,
    `${r.cambios.join(' ') || '(no entendido)'} → ${JSON.stringify({ n: r.personaje.nombre, g: r.personaje.genero, raza: r.personaje.raza, clase: r.personaje.clase, d: r.personaje.retrato })}`);
}

/* ── Confirmar y no entender ─────────────────────────────────────────────── */

for (const texto of ['sí', 'vale', 'así está bien', 'empezamos', 'vale, empezamos', '¡Adelante!']) {
  comprobar(corregir(texto).confirmar, `«${texto}» arranca la partida`);
}

const raro = corregir('hazla azul');
comprobar(!raro.entendido && !raro.confirmar && raro.personaje.retrato === BRUNHILDA.retrato,
  'lo que no entiende no lo toca, y lo dice');

/* ── Cambiar de sexo sin romper lo demás ─────────────────────────────────── */

const SEXO = [
  ['enana guerrera, pelirroja y alta, con hacha', 'm', 'enano guerrero, pelirrojo y alto, con hacha'],
  ['elfo explorador, delgado', 'f', 'elfa exploradora, delgada'],
  ['mujer de pelo largo y trenza rubia', 'm', 'hombre de pelo largo y trenza rubia'],
];
for (const [antes, g, despues] of SEXO) {
  const real = cambiarSexo(antes, g);
  comprobar(real === despues, `«${antes}» → ${g}`, real);
}

comprobar(sexoDescrito('enana guerrera') === 'f' && sexoDescrito('de barba espesa') === null,
  'la descripción marca el sexo solo cuando lo dice');

/* ── El resumen del narrador ─────────────────────────────────────────────── */

const resumen = resumenPersonaje(BRUNHILDA);
comprobar(/^Brunhilda, rastreadora de linaje ferrano\./.test(resumen),
  'el resumen concuerda oficio con la persona y linaje con «linaje»', resumen);
comprobar(resumen.includes('«Perdí la forja de mi padre en un incendio»'),
  'la historia se cita con sus palabras, sin cambiarle la persona', resumen);

console.log(`\n${fallos ? `${fallos} fallos.` : 'Todo correcto.'}`);
process.exit(fallos ? 1 : 0);
