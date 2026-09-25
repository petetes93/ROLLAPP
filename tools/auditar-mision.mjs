/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-mision.mjs
 * ---------------------------------------------------------------------------
 * ¿Hay algo que hacer desde el turno 1, y cada turno devuelve la palabra?
 *
 * La apertura era atmósfera y lore sin un objetivo, y la narración terminaba
 * en un pájaro cruzando el cielo: el jugador no sabía por dónde tirar ni si le
 * tocaba hablar. Aquí se sujetan las dos cosas:
 *
 *   · 50 aperturas con semillas distintas: siempre hay misión principal con un
 *     lugar del mapa, alguien con nombre y oficio, y una pista.
 *   · La pregunta de mesa: toda narración termina en pregunta, sin duplicarla.
 *
 *   node tools/auditar-mision.mjs
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { principalDesdeHistoria } from '../src/quests/QuestGenerator.js';
import { preguntaDeMesa, cerrarConPregunta, terminaEnPregunta, candidatas } from '../src/ai/Pregunta.js';
import { GestorRNG } from '../src/core/RNG.js';
import { obtenerLugar, LUGARES } from '../src/data/locations.data.js';
import { TurnResolver } from '../src/engine/TurnResolver.js';

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

/* ── 50 aperturas ────────────────────────────────────────────────────────── */

const HISTORIAS = [
  'Perdí la forja de mi padre en un incendio. Busco a quien lo provocó.',
  'Mi hermana cruzó el Umbral con nuestro medallón. La busco desde entonces.',
  'Me robaron el anillo de mi madre en el camino del norte.',
  'Juré proteger el templo y fallé.',
  'Tengo un medallón que no sé de dónde viene.',
  'Busco a mi maestro, que se marchó sin decir nada.',
  'Crecí en el vado entre barqueros y nunca he salido de él.',
  '',
];

// Lugares de salida posibles: los asentamientos de partida.
const SALIDAS = Object.values(LUGARES)
  .filter((l) => l.tipo === 'asentamiento')
  .map((l) => l.refId);

const problemas = [];

for (let i = 0; i < 50; i += 1) {
  const lore = HISTORIAS[i % HISTORIAS.length];
  const salida = SALIDAS[i % SALIDAS.length];
  const r = principalDesdeHistoria(new GestorRNG(9000 + i).flujo('mundo'), {
    lugar: salida, lore, clase: 'Rastreador', orden: 1,
  });

  const fallo = (motivo) => problemas.push(`#${i} (${salida}, «${lore.slice(0, 30)}»): ${motivo}`);

  if (!r?.mision) { fallo('sin misión'); continue; }
  if (r.mision.tipo !== 'principal') fallo(`tipo ${r.mision.tipo}`);

  // Un lugar real del mapa, con gente.
  const lugar = obtenerLugar(r.mision.lugar);
  if (!lugar) fallo(`lugar inexistente: ${r.mision.lugar}`);
  else if (!r.mision.resumen.includes(lugar.nombre.replace(/^(El|La|Los|Las)\s/, ''))) fallo('el resumen no nombra el lugar');

  // Alguien con nombre y oficio, nombrado en el resumen.
  if (!r.npc?.nombre || !r.npc?.rol) fallo('sin PNJ con nombre y oficio');
  else if (!r.mision.resumen.includes(r.npc.nombre)) fallo('el resumen no nombra al PNJ');

  // Objetivos que el motor sabe cerrar: sin «libres», que solo cierra un modelo.
  if (r.mision.objetivos.some((o) => o.clase === 'libre')) fallo('tiene objetivos libres');
  if (!r.mision.objetivos.some((o) => o.clase === 'hablar' && o.objetivo === r.npc.refId)) fallo('no hay «Hablar con» su PNJ');

  // Nada de artículos en mayúscula a media frase.
  if (/\s(en|a|de|por|hacia)\s(El|La|Los|Las)\s/.test(r.mision.resumen)) fallo(`artículo en mayúscula: ${r.mision.resumen}`);
}

comprobar(!problemas.length, '50 aperturas: siempre misión con lugar, PNJ con nombre y pista',
  problemas.slice(0, 4).join('\n     '));

/* ── La pregunta de mesa ─────────────────────────────────────────────────── */

const escenas = [
  {},
  { npcs: [{ nombre: 'Corlin' }] },
  { enemigos: [{ nombre: 'Saqueador B' }] },
  { franja: 'noche' },
  { npcs: [{ nombre: 'Maela' }], franja: 'alba' },
];

const todas = escenas.flatMap((e) => candidatas(e));
comprobar(todas.every((p) => /\?$/.test(p)), 'toda pregunta candidata termina en «?»',
  todas.filter((p) => !/\?$/.test(p)).join(' | '));

comprobar(candidatas({}).includes('¿Qué haces?'), 'la forma corta existe');

comprobar(candidatas({ npcs: [{ nombre: 'Corlin' }] }).some((p) => p.includes('Corlin')),
  'con alguien delante, hay pregunta que lo nombra');

comprobar(preguntaDeMesa({ npcs: [{ nombre: 'Corlin' }] }, { anterior: '¿Qué haces?' }) !== '¿Qué haces?',
  'no repite la pregunta anterior');

// Cerrar: en su propia línea, y nunca dos preguntas.
const cerrado = cerrarConPregunta('El viento arrastra hojas secas.', '¿Qué haces?');
comprobar(cerrado === 'El viento arrastra hojas secas.\n¿Qué haces?', 'la pregunta va en su propia línea', cerrado);

const yaPreguntaba = cerrarConPregunta('Corlin te mira. «¿Quién eres tú?»', '¿Qué haces?');
comprobar(yaPreguntaba === 'Corlin te mira. «¿Quién eres tú?»', 'si ya termina en pregunta, no se añade otra', yaPreguntaba);

comprobar(terminaEnPregunta('Algo.\n¿Qué haces?') && !terminaEnPregunta('Algo.\nNada.'),
  'reconoce si un texto termina en pregunta');

/* ── «Hablar con…» se cumple al hablar, aunque la frase haga otra cosa ──── */

{
  // Salió en el playtest: «busco a Dadar y le pregunto por el hierro» se leyó
  // como una búsqueda y el objetivo «Hablar con Dadar» no avanzó.
  const turnos = Object.create(TurnResolver.prototype);
  const estado = { npcs: { presentes: ['npc_dadar', 'npc_ulket'], conocidos: { porId: {
    npc_dadar: { refId: 'npc_dadar', nombre: 'Dadar' }, npc_ulket: { refId: 'npc_ulket', nombre: 'Ulket' },
  } } } };
  turnos.leer = (ruta, d) => ruta.split('.').reduce((o, k) => o?.[k], estado) ?? d;
  const conQuien = (accion, tipo) => {
    const dichos = [];
    turnos.emitir = (evento, datos) => { if (evento === 'npc:talked') dichos.push(datos.refId); };
    turnos._registrarConversacion({ events: [] }, tipo, accion);
    return dichos;
  };

  comprobar(conQuien('busco a Dadar, el herrero, y le pregunto por el hierro marcado', 'accion').includes('npc_dadar'),
    'preguntar a alguien nombrado cuenta como hablar con él, aunque el turno sea otra cosa');
  comprobar(!conQuien('busco a Dadar', 'accion').length, 'buscar a alguien no es hablar con él');
  comprobar(!conQuien('le pregunto por el hierro', 'accion').length, 'sin nombre, fuera del diálogo no se adivina con quién');

  // La pregunta de cierre solo nombra a quien se ha hablado. Tras hablar con
  // la posadera cerraba «Ulket te mira, esperando», y Ulket no pintaba nada.
  turnos.rng = null;
  turnos.leer = (ruta, d) => ({ 'npcs.presentes': ['npc_dadar', 'npc_ulket'], 'combat.activo': false, 'world.tiempo.franja': 'manana' })[ruta]
    ?? ruta.split('.').reduce((o, k) => o?.[k], estado) ?? d;
  const nombra = (interlocutor) => {
    const salidas = new Set();
    for (let i = 0; i < 12; i += 1) {
      turnos._ultimaPregunta = [...salidas].at(-1) ?? null;
      salidas.add(turnos._preguntar(interlocutor));
    }
    return [...salidas];
  };
  const sinNadie = nombra(null);
  comprobar(!sinNadie.some((p) => /Dadar|Ulket/.test(p)), 'sin interlocutor, la pregunta no nombra a los presentes', sinNadie.join(' | '));
  const conDadar = nombra({ nombre: 'Dadar' });
  comprobar(conDadar.some((p) => /Dadar/.test(p)) && !conDadar.some((p) => /Ulket/.test(p)),
    'tras hablar con Dadar, la pregunta puede nombrarle a él y a nadie más', conDadar.join(' | '));
}

console.log(`\n${fallos ? `${fallos} fallos.` : 'Todo correcto.'}`);
process.exit(fallos ? 1 : 0);
