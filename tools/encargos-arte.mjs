#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · tools/encargos-arte.mjs
 * ---------------------------------------------------------------------------
 * Cuaderno de encargos para generar el arte con un modelo de imagen.
 *
 * Escribe los 40 prompts —8 linajes, 13 criaturas, 19 lugares— con el ancla de
 * estilo REPETIDA palabra por palabra en cada uno, y con el nombre de archivo
 * exacto que espera `assets/manifest.json`.
 *
 * Se genera desde los catálogos en vez de escribirse a mano por una razón: si
 * añades un linaje a `races.data.js` y los prompts están sueltos en un
 * documento, ese linaje se queda sin encargo y nadie se entera hasta que sale
 * un hueco en la pantalla de creación.
 *
 * Los prompts salen en DOS idiomas, y es deliberado:
 *
 *   · El estilo y el encuadre, en inglés. Los modelos de imagen se entrenan
 *     mayoritariamente con descripciones en inglés y obedecen bastante mejor
 *     términos como «cel shading» o «three-quarter view» que sus traducciones.
 *     Y es la parte que DEBE salir idéntica en las 40 piezas.
 *   · El sujeto, literal del catálogo y por tanto en español. Traducirlo
 *     exigiría mantener a mano una traducción de cada `aspecto` y cada
 *     `descripcion`, que es justo lo que se desincroniza. Y el objetivo es que
 *     el retrato concuerde con lo que el juego le dice al jugador por escrito.
 *
 * Los modelos actuales manejan bien esa mezcla. Si alguno no, la solución es
 * traducir el sujeto en el prompt concreto, no cambiar el ancla.
 *
 * Uso:
 *   node tools/encargos-arte.mjs                 → dist/encargos.md
 *   node tools/encargos-arte.mjs --familia retratos
 *   node tools/encargos-arte.mjs --json          → para automatizar
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const AQUI = dirname(fileURLToPath(import.meta.url));
const RAIZ = resolve(AQUI, '..');

const modulo = (r) => import(pathToFileURL(resolve(RAIZ, r)).href);

const { RAZAS } = await modulo('src/data/races.data.js');
const { LUGARES } = await modulo('src/data/locations.data.js');
const { ENEMIGOS } = await modulo('src/data/enemies.data.js');

const argv = process.argv.slice(2);
const leer = (b, d) => { const i = argv.indexOf(b); return i >= 0 ? (argv[i + 1] ?? d) : d; };

const familiaPedida = leer('--familia', 'todas');
const comoJson = argv.includes('--json');
const salida = leer('--salida', comoJson ? 'dist/encargos.json' : 'dist/encargos.md');

/* ═══════════════════════════════════════════════════════════════════════════
   EL ANCLA DE ESTILO
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Va literal en los 40 encargos, sin variar una palabra.
 *
 * Es lo único que impide que 40 imágenes generadas por separado parezcan de 40
 * juegos distintos. Si se reescribe para una, hay que reescribirla para todas
 * y volver a generar la serie entera.
 */
const ANCLA = 'Anime cel animation still, flat cel shading, hard shadow shapes, '
  + 'visible ink outlines, limited muted palette of ash grey, iron blue and '
  + 'oxidised bronze, overcast light, dark low fantasy.';

/* ═══ Lo aprendido peleándose con el modelo ═══════════════════════════════
   Tres lecciones, cada una pagada con una tanda de imágenes malas:

   1. EL ESTILO VA PRIMERO. Con el ancla al final salieron una foto de
      paisaje, un render 3D y un retrato realista. Delante, anime a la primera.

   2. NEGAR INVOCA. «quadruped, not bipedal, no human features» dio un humano
      bípedo con espada tres veces seguidas; «a grey wolf standing on all
      fours» dio un lobo a la primera. Lo mismo con «no frame»: nombrar el
      marco lo pintaba. Hay que decir lo que SÍ se quiere, con sustantivos
      concretos, y no mencionar jamás lo que se quiere evitar.

   3. LAS PROPORCIONES EXTREMAS SE ENMARCAN. A 1200x480 (5:2) el modelo
      añadía un paspartú crema dentro de la imagen. A 1024x576 (16:9)
      desaparece. El recorte a 5:2 lo hace el CSS, que ya recortaba igual.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Lo que NO queremos.
 *
 * Se guarda pero **el endpoint anónimo no acepta negativos**, así que hoy no se
 * envía. Está aquí para el día que se use un servicio que sí los admita, y para
 * que quede escrito qué se está intentando evitar. La defensa real contra el
 * realismo es que el ancla vaya PRIMERO en el prompt, no este campo.
 */
const NEGATIVO = 'photorealistic, 3d render, oil painting, western comic style, '
  + 'chibi, sketch, unfinished lineart, text, watermark, signature, letterboxing, '
  + 'multiple panels, collage';

/* ═══════════════════════════════════════════════════════════════════════════
   ENCUADRES
   ═══════════════════════════════════════════════════════════════════════════ */

const ENCUADRES = {
  retratos: {
    carpeta: 'retratos',
    proporcion: '5:6 vertical (800x960)',
    marco: 'Bust portrait, head and shoulders, three-quarter view, '
      + 'plain flat background, soft light from the left.',
  },
  criaturas: {
    carpeta: 'criaturas',
    proporcion: '1:1 cuadrado (800x800)',
    marco: 'Full body view, dark empty background.',
  },
  paisajes: {
    carpeta: 'paisajes',
    proporcion: '16:9 (1024x576), el CSS lo recorta a banda',
    marco: 'Wide landscape view, misty depth, low horizon.',
  },
};

/* ═══════════════════════════════════════════════════════════════════════════
   CONSTRUCCIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/** Recorta a una frase útil sin cortar una palabra por la mitad. */
function resumir(texto, tope = 220) {
  const limpio = String(texto ?? '').replace(/\s+/g, ' ').trim();
  if (limpio.length <= tope) return limpio;

  const corte = limpio.slice(0, tope);
  return `${corte.slice(0, corte.lastIndexOf(' '))}…`;
}

/**
 * Monta un encargo completo.
 *
 * **El ancla va PRIMERO.** Los modelos pesan mucho más los primeros tokens, y
 * la primera tanda de pruebas lo demostró por la vía dura: con el estilo al
 * final salieron una foto de paisaje, un render 3D y un retrato realista. Con
 * el estilo delante, las mismas descripciones dieron anime a la primera.
 *
 * El orden del resto DEPENDE DE LA FAMILIA, y no por capricho:
 *
 *   · Criaturas y paisajes → estilo, SUJETO, encuadre. Con el encuadre en
 *     medio se comía al sujeto: «standing, full body, near-silhouette»
 *     convertía al lobo en un espadachín y «layered depth, distant band»
 *     borraba el pueblo del paisaje.
 *
 *   · Retratos → estilo, ENCUADRE, sujeto. Aquí es al revés: con el encuadre
 *     al final el modelo devolvía una lámina de cuatro caras en vez de un
 *     retrato. «Bust portrait, head and shoulders» tiene que ir pronto para
 *     imponer que el sujeto es UNO.
 */
function encargo(familia, clave, sujeto, nombre) {
  const e = ENCUADRES[familia];

  const cuerpo = familia === 'retratos'
    ? `${e.marco} ${sujeto}`
    : `${sujeto} ${e.marco}`;

  return {
    familia,
    clave,
    nombre,
    archivo: `${e.carpeta}/${clave}.jpg`,
    proporcion: e.proporcion,
    prompt: `${ANCLA} ${cuerpo}`,
    negativo: NEGATIVO,
  };
}

/**
 * Matices en inglés, por `refId`.
 *
 * El sujeto NO puede ir en español: la primera tanda lo demostró. Con
 * «cuernos curvos y piel gris azulada» en español salió una dama de blanco sin
 * cuernos; con lo mismo en inglés salió a la primera.
 *
 * Están escritos a mano y no traducidos automáticamente, así que pueden
 * quedarse desfasados si cambias un catálogo. Es un mal menor asumido: una
 * entrada que falte cae en el prompt genérico de su tipo, que sigue siendo
 * correcto, solo menos específico. Nunca deja un hueco.
 */
const MATICES = Object.freeze({
  /* ── Linajes ───────────────────────────────────────────────────────────
     Cortos a propósito. Con el volcado largo del catálogo —y en español— el
     modelo devolvía una lámina de cuatro cabezas en vez de un retrato: prompt
     largo y difuso, sujeto múltiple. Una línea concreta basta. */
  valdes: 'olive to bronze skin, dark hair, layered practical clothing',
  sombracorteza: 'tall and gaunt, grey-brown bark-veined skin, solid black eyes',
  ferrano: 'broad shouldered, ruddy weathered skin, thick braided beard',
  albar: 'slender, angular pale features, faint moonlit sheen on the skin',
  griscuerno: 'very tall, grey-blue skin, curved horns growing from the temples',
  menudo: 'small and slight, bright eyes, curly hair, well fed',
  brumal: 'translucent bluish skin, hair drifting as if underwater',
  crisol: 'body of pale alloy with faint glowing mineral veins, fixed face',

  /* ── Criaturas ─────────────────────────────────────────────────────── */
  rata_gigante: 'a giant rat, teeth far too long for its skull',
  carronero: 'a scrawny hyena-like scavenger, matted clumped fur, nervous',
  saqueador: 'ill-fitting stolen clothing, holding a weapon awkwardly',
  lobo_ceniciento: 'a grey wolf, ash-grey fur, calculating eyes, snarling',
  guardia_corrupto: 'official city uniform, the face of someone paid by both sides',
  espectro_menor: 'a shape that remembers being someone, edges dissolving',
  bruto_griscuerno: 'two and a half metres of muscle, curved horns, enormous mace',
  tejedora_de_umbral: 'eight overlong legs, web that does not reflect light',
  ejecutor_albar: 'pale alloy body with dimmed veins, still obeying an old order',
  devorador_de_brumas: 'a mass that condenses and disperses, fog curdling around it',
  cazadora_silente: 'you never hear her coming, already far too close',
  guardian_de_la_puerta: 'four metres of engraved alloy, immobile, very old',
  senora_del_pantano: 'as tall as a young tree, made of roots and black water',

  /* ── Lugares ───────────────────────────────────────────────────────── */
  vado_yunque: 'a stone bridge over a river, with the village that grew around it',
  camino_norte: 'packed earth road between wheat fields, long open sightlines',
  saucedo: 'twenty adobe houses around one enormous willow in the square',
  tumbas_bajas: 'a burial mound with a stone door someone opened and never closed',
  linde_cenizo: 'where open field turns into grey-barked trees',
  arboleda_madre: 'houses built among roots that have stood for centuries',
  claro_quemado: 'a perfect circle of dead earth in the middle of the forest',
  senda_raices: 'a tunnel of interwoven roots descending toward something',
  paso_yunque: 'a corridor between rock walls where the wind never stops',
  forja_alta: 'a town dug into the hillside, smoke from a hundred chimneys',
  galerias_hondas: 'kilometres of tunnels dug out and then sealed',
  mina_abandonada: 'a mine mouth walled up with stone and haste',
  pilotes_brumal: 'a whole village on black wooden stilts joined by walkways',
  espejo_negro: 'a lagoon of motionless water reflecting what is not in front of it',
  puerto_lodo: 'a harbour of murky water where no questions are asked',
  umbral_albar: 'a thirty-metre arch still standing, holding nothing up',
  sala_sellada: 'a corridor descending to a door nobody has opened',
  oasis_sal: 'palm trees, water, and a bazaar where the whole south converges',
  pozos_hondos: 'salt wells descending far deeper than a well needs to',
});

const encargos = [];

/* ── Linajes ──────────────────────────────────────────────────────────────
   El sujeto sale del campo `aspecto` del catálogo, que es lo que el juego le
   dice al jugador por escrito. Si el retrato no concuerda con ese texto, el
   jugador nota la costura. */
if (familiaPedida === 'todas' || familiaPedida === 'retratos') {
  for (const r of Object.values(RAZAS)) {
    encargos.push(encargo(
      'retratos', r.refId,
      `One single person, ${MATICES[r.refId] ?? 'weathered features'}, `
        + 'tired face, plain worn work clothes.',
      r.nombre,
    ));
  }
}

/* ── Criaturas ────────────────────────────────────────────────────────────── */
if (familiaPedida === 'todas' || familiaPedida === 'criaturas') {
  // El tamaño se expresa SIN nombrar a una persona cuando la criatura es un
  // animal. Con «human-sized» el modelo dibujaba un humano bípedo con espada
  // en lugar de un lobo: la palabra «human» pesa más que «animal anatomy».
  const TAMANOS = {
    bestia: {
      pequeno: 'small, dog-sized', mediano: 'the size of a large wolf',
      grande: 'massive for an animal', enorme: 'gigantic, monstrous scale',
    },
    otros: {
      pequeno: 'small, waist-height', mediano: 'adult height',
      grande: 'towering, clearly taller than a person',
      enorme: 'colossal, several times a person’s height',
    },
  };

  const TIPOS = {
    // Sin negaciones y con el animal nombrado en `MATICES`: es lo único que
    // saca un cuadrúpedo de este modelo.
    bestia: 'a wild animal in profile, standing on all fours, wildlife',
    humanoide: 'a humanoid figure standing upright',
    no_muerto: 'an undead apparition, edges dissolving into nothing',
    aberracion: 'an aberration, asymmetric and wrong, too many limbs',
    construido: 'a constructed statue-like being of pale alloy, rigid and blocky',
  };

  for (const e of Object.values(ENEMIGOS)) {
    const escala = (e.tipo === 'bestia' ? TAMANOS.bestia : TAMANOS.otros);

    encargos.push(encargo(
      'criaturas', e.refId,
      `${TIPOS[e.tipo] ?? 'a creature'}, ${escala[e.tamano] ?? 'adult height'}`
        + `${MATICES[e.refId] ? `, ${MATICES[e.refId]}` : ''}.`,
      e.nombre,
    ));
  }
}

/* ── Lugares ──────────────────────────────────────────────────────────────── */
if (familiaPedida === 'todas' || familiaPedida === 'paisajes') {
  const TERRENOS = {
    camino: 'open farmland and packed-earth road',
    bosque: 'grey-barked forest',
    montana: 'high stone mountains',
    pantano: 'still black-water marsh',
    ruinas: 'ancient ruins on open ground',
    desierto: 'salt desert with dunes',
    mazmorra: 'underground vaulted corridor lit by a single torch',
  };

  const TIPOS = {
    asentamiento: 'A small inhabited settlement is visible, rooftops and chimney smoke.',
    ruina: 'Broken walls and a standing arch that supports nothing.',
    mazmorra: 'No sky: this is underground.',
    natural: 'Untouched by building of any kind.',
    punto: 'Empty of buildings, just the land.',
  };

  for (const l of Object.values(LUGARES)) {
    encargos.push(encargo(
      'paisajes', l.refId,
      `${TERRENOS[l.terreno] ?? 'open country'}`
        + `${MATICES[l.refId] ? `: ${MATICES[l.refId]}` : ''}. `
        + `${TIPOS[l.tipo] ?? ''}`,
      l.nombre,
    ));
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   SALIDA
   ═══════════════════════════════════════════════════════════════════════════ */

const destino = resolve(RAIZ, salida);
await mkdir(dirname(destino), { recursive: true });

if (comoJson) {
  await writeFile(destino, JSON.stringify(encargos, null, 2), 'utf-8');
} else {
  const porFamilia = {};
  for (const e of encargos) (porFamilia[e.familia] ??= []).push(e);

  const partes = [
    '# ARCANUM · encargos de arte',
    '',
    `${encargos.length} imágenes. Generado por \`tools/encargos-arte.mjs\` desde`,
    'los catálogos de `src/data/`. **No editar a mano**: se regenera.',
    '',
    '## Cómo usarlo',
    '',
    '1. Genera cada imagen con su prompt. El **ancla de estilo va repetida**',
    '   palabra por palabra en los 40; no la cambies para una sola pieza.',
    '2. Guarda el resultado con la ruta exacta de la columna «archivo»,',
    '   dentro de `assets/`.',
    '3. Declara la pieza en `assets/manifest.json`. Ver `assets/README.md`.',
    '',
    'Las piezas sin generar siguen saliendo en vector, así que se puede ir',
    'sustituyendo de una en una sin romper nada.',
    '',
    '## Ancla de estilo',
    '',
    '```',
    ANCLA,
    '```',
    '',
    '### Negativo',
    '',
    '```',
    NEGATIVO,
    '```',
    '',
  ];

  const titulos = {
    retratos: 'Linajes', criaturas: 'Criaturas', paisajes: 'Lugares',
  };

  for (const [familia, lista] of Object.entries(porFamilia)) {
    partes.push(`## ${titulos[familia] ?? familia} · ${lista.length}`, '');
    partes.push(`Proporción: **${ENCUADRES[familia].proporcion}**`, '');

    for (const e of lista) {
      partes.push(
        `### ${e.nombre}`,
        '',
        `\`assets/${e.archivo}\` · clave \`${e.clave}\``,
        '',
        '```',
        e.prompt,
        '```',
        '',
      );
    }
  }

  await writeFile(destino, partes.join('\n'), 'utf-8');
}

console.log(`Encargos listos: ${salida}`);
console.log(`  ${encargos.length} imágenes`);

for (const f of ['retratos', 'criaturas', 'paisajes']) {
  const n = encargos.filter((e) => e.familia === f).length;
  if (n) console.log(`    ${f}: ${n}`);
}
