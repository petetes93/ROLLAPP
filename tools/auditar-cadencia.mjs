/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-cadencia.mjs
 * ---------------------------------------------------------------------------
 * Fija el ritmo de la narración.
 *
 * Es lo más fácil de romper sin darse cuenta, porque un cambio en el corte no
 * da error: simplemente el texto empieza a leerse peor y nadie sabe cuándo
 * pasó. Aquí se sujetan las reglas que hacen que se lea como se lee.
 *
 *   node tools/auditar-cadencia.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { enFrases, montar, esGolpe } from '../src/ai/Cadencia.js';

let fallos = 0;

const comprobar = (etiqueta, real, esperado) => {
  const bien = JSON.stringify(real) === JSON.stringify(esperado);
  if (!bien) fallos += 1;
  console.log(`${bien ? 'OK  ' : 'MAL '} ${etiqueta}`);
  if (!bien) console.log(`     esperado: ${JSON.stringify(esperado)}\n     obtenido: ${JSON.stringify(real)}`);
};

/* ── Cortar ─────────────────────────────────────────────────────────────── */

// Una corta seguida de una larga SI se separan: el golpe breve gana fuerza
// justo por quedarse solo antes de la que viene.
comprobar('una frase corta y otra larga se separan',
  enFrases('La criatura cae. Reina el silencio durante un instante largo.'),
  ['La criatura cae.', 'Reina el silencio durante un instante largo.']);

comprobar('dos frases largas se separan',
  enFrases('Un carro volcado corta el paso del camino. Dos hombres discuten junto a los bultos.'),
  ['Un carro volcado corta el paso del camino.', 'Dos hombres discuten junto a los bultos.']);

// Diez lineas de tres palabras no es ritmo, es tartamudeo.
comprobar('dos frases cortas se juntan',
  enFrases('Cae. Silencio.'),
  ['Cae. Silencio.']);

// Cortar una replica en dos parece que hablan dos personas.
comprobar('el dialogo no se parte',
  enFrases('—Ni idea. Aqui cada uno se ocupa de lo suyo.'),
  ['—Ni idea. Aqui cada uno se ocupa de lo suyo.']);

// La replica a media prosa tampoco: se partia por la interrogacion de dentro.
comprobar('una replica entre comillas a mitad de bloque no se parte',
  enFrases('Quien te oye es Corlin. «¿El incendio de la forja? Eso queda lejos de mis asuntos», dice Corlin.'),
  ['Quien te oye es Corlin.', '«¿El incendio de la forja? Eso queda lejos de mis asuntos», dice Corlin.']);

comprobar('un texto vacio no da lineas', enFrases('   '), []);

/* ── Montar ─────────────────────────────────────────────────────────────── */

const bloques = [
  'Te acercas despacio con la mano lejos del arco.',
  'Un carro volcado corta el paso y dos hombres discuten junto a los bultos.',
  'La manana esta entrada y la luz es limpia.',
];

const conGolpe = montar(bloques, { golpe: 'critico', elegir: (l) => l[0] }).split('\n');

comprobar('el sonido cierra el bloque de la accion', conGolpe[1], 'ZAS.');

// El ultimo bloque suele ser el ambiente: anunciar a bombo y platillo que va a
// hacer buen tiempo es justo lo que no se quiere.
const conAntesala = montar(bloques, { antesala: true, elegir: (l) => l[0] }).split('\n');
comprobar('la antesala va antes del giro, no del ambiente', conAntesala[1], 'Y entonces...');

comprobar('sin adornos no se inventa ninguno',
  montar(bloques, { elegir: (l) => l[0] }).split('\n').length, 3);

/* ── Reconocer el golpe ─────────────────────────────────────────────────── */

comprobar('un sonido es golpe', esGolpe('CLANG.'), true);
comprobar('una antesala es golpe', esGolpe('Y entonces...'), true);
comprobar('una frase normal no es golpe', esGolpe('Te acercas despacio al carro.'), false);

// Sin esto, cualquier linea corta de dialogo se pintaria como un golpe.
comprobar('una linea corta cualquiera no es golpe', esGolpe('Miras.'), false);
comprobar('una frase larga en mayusculas no es golpe',
  esGolpe('ESTO ES UNA LINEA DEMASIADO LARGA PARA SER UN GOLPE'), false);

console.log(`\n${fallos ? `${fallos} fallos.` : 'Todo correcto.'}`);
process.exit(fallos ? 1 : 0);
