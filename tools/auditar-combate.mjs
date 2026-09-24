/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · tools/auditar-combate.mjs
 * ---------------------------------------------------------------------------
 * ¿Es justo el primer combate?
 *
 * Nace de un playtest concreto. Una enana de nivel 1 con 26 PV escribió «ataco
 * al primer bandido que vea» y le salió una patrulla de dos guardias corruptos
 * de 28 PV cada uno. Murió en la ronda 2 habiendo actuado UNA vez. Eso no es
 * dificultad: es no haber jugado.
 *
 * Lo que se sujeta aquí no es el equilibrio fino —eso se afina jugando— sino
 * las dos cosas que no pueden pasar:
 *
 *   · Que buscar pelea traiga un grupo imposible de vencer.
 *   · Que el jugador caiga sin haber podido actuar.
 *
 * Se simula con matemática, no con el motor entero: interesa el TAMAÑO del
 * grupo que el juego elige, que es donde estaba el fallo. El intercambio de
 * golpes se modela con las medias de daño, que basta para ver si una pelea es
 * un combate o un atropello.
 *
 *   node tools/auditar-combate.mjs
 *   node tools/auditar-combate.mjs --ver
 * ═══════════════════════════════════════════════════════════════════════════
 */

import * as Tablas from '../src/world/EncounterTables.js';
import { ActionRouter } from '../src/engine/ActionRouter.js';
import { obtenerEnemigo } from '../src/data/enemies.data.js';
import { DIRECCION } from '../src/config/balance.config.js';

const VER = process.argv.includes('--ver');

/** Un jugador de nivel 1 recién creado, en números redondos. */
const JUGADOR = { vida: 26, danoMedio: 5.5, aciertos: 0.6 };

/** Terrenos donde se puede empezar una pelea buscándola. */
const TERRENOS = ['camino', 'bosque', 'montana', 'pantano', 'ruinas', 'ciudad'];

const vidaDe = (refId) => obtenerEnemigo(refId)?.vida ?? 0;

/**
 * Qué grupos puede sacar el juego cuando el jugador busca pelea.
 *
 * Reproduce lo que hace `ActionRouter._atacar`: hostiles del terreno, cada uno
 * ajustado al jugador. El motor sortea entre ellos por peso, así que aquí se
 * devuelven TODOS: si uno solo de los posibles es injusto, el jugador acabará
 * encontrándoselo.
 */
function gruposAlBuscarPelea(terreno, peligro, factor) {
  return Tablas.candidatos({ terreno, peligro, familia: 'hostil' })
    .filter((e) => e.combate)
    .map((e) => Tablas.ajustarAlJugador(e, { vidaJugador: JUGADOR.vida, factor, vidaDe }))
    .filter(Boolean);
}

const vidaTotalDe = (grupo) => (grupo.combate.enemies ?? [])
  .reduce((s, x) => s + vidaDe(x.refId) * (x.count ?? 1), 0);

/**
 * Dados con semilla fija.
 *
 * Promediar el daño da siempre el mismo resultado, y un combate que solo puede
 * acabar de una manera no prueba nada. Con tiradas de verdad la tasa de
 * victoria tiene dispersión, que es lo que el umbral del 70 % mide.
 */
function dados(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * Simula el intercambio de golpes tirando los dados.
 *
 * El jugador tiene la iniciativa porque ha atacado él: es lo que garantiza
 * `playerAmbush`, y por eso aquí pega siempre primero.
 *
 * @returns {{gana: boolean, actuaciones: number}}
 */
function simular(grupo, tirar) {
  const enemigos = [];

  for (const e of grupo.combate.enemies ?? []) {
    const plantilla = obtenerEnemigo(e.refId);
    for (let i = 0; i < (e.count ?? 1); i += 1) {
      enemigos.push({
        vida: plantilla?.vida ?? 10,
        dano: (plantilla?.ataques?.[0]?.dano?.medio) ?? 4,
        aciertos: 0.55,
      });
    }
  }

  let vidaJugador = JUGADOR.vida;
  let actuaciones = 0;

  for (let ronda = 0; ronda < 40; ronda += 1) {
    // El jugador, primero.
    actuaciones += 1;
    const vivo = enemigos.find((e) => e.vida > 0);
    if (!vivo) return { gana: true, actuaciones };

    if (tirar() < JUGADOR.aciertos) {
      // El daño varía un 50 % arriba y abajo, como un dado.
      vivo.vida -= JUGADOR.danoMedio * (0.5 + tirar());
    }

    if (!enemigos.some((e) => e.vida > 0)) return { gana: true, actuaciones };

    for (const e of enemigos.filter((x) => x.vida > 0)) {
      if (tirar() < e.aciertos) vidaJugador -= e.dano * (0.5 + tirar());
    }

    if (vidaJugador <= 0) return { gana: false, actuaciones };
  }

  return { gana: false, actuaciones };
}

/* ═══════════════════════════════════════════════════════════════════════════
   PRUEBA
   ═══════════════════════════════════════════════════════════════════════════ */

const factor = DIRECCION.preajustes?.equilibrado ?? 1;

// Semilla fija: dos ejecuciones seguidas dan el mismo veredicto.
const tirar = dados(20260924);

let combates = 0;
let victorias = 0;
let sinActuar = 0;
const sinGrupo = [];
const excesivos = [];

// 200 combates: cada grupo posible de cada terreno y nivel de peligro.
for (let vuelta = 0; vuelta < 5; vuelta += 1) {
  for (const terreno of TERRENOS) {
    for (let peligro = 1; peligro <= 5; peligro += 1) {
      const grupos = gruposAlBuscarPelea(terreno, peligro, factor);

      if (!grupos.length) { sinGrupo.push(`${terreno}/${peligro}`); continue; }

      for (const grupo of grupos) {
        const vidaTotal = vidaTotalDe(grupo);
        const techo = JUGADOR.vida * Tablas.HOLGURA_VIDA * factor;

        if (vidaTotal > techo + 0.001) {
          excesivos.push(`${terreno}/${peligro}: ${grupo.refId} con ${vidaTotal} PV (techo ${techo.toFixed(1)})`);
        }

        const r = simular(grupo, tirar);
        combates += 1;
        if (r.gana) victorias += 1;
        if (!r.gana && r.actuaciones < 2) sinActuar += 1;

        if (VER && vuelta === 0) {
          const cuantos = (grupo.combate.enemies ?? []).map((x) => `${x.count ?? 1}×${x.refId}`).join(', ');
          console.log(`  ${terreno}/${peligro}: ${cuantos} · ${vidaTotal} PV · ${r.gana ? 'gana' : 'pierde'} en ${r.actuaciones}`);
        }
      }
    }
  }
}

const tasa = combates ? victorias / combates : 0;

console.log(`\ncombates simulados: ${combates}`);
console.log(`victorias: ${victorias} (${(tasa * 100).toFixed(1)} %)`);
console.log(`derrotas sin poder actuar dos veces: ${sinActuar}`);
if (sinGrupo.length) console.log(`sin hostiles en tabla: ${[...new Set(sinGrupo)].join(', ')}`);

let fallos = 0;

if (excesivos.length) {
  fallos += 1;
  console.log('\nMAL  hay grupos por encima del techo de vida:');
  for (const e of [...new Set(excesivos)]) console.log(`     ${e}`);
} else {
  console.log('OK   ningún grupo supera el techo de vida del jugador');
}

// El jugador tiene la iniciativa y el grupo está acotado: por debajo de esto
// es que algo se ha desajustado en las tablas o en el recorte.
if (tasa < 0.7) {
  fallos += 1;
  console.log(`MAL  el jugador gana el ${(tasa * 100).toFixed(1)} %, por debajo del 70 %`);
} else {
  console.log('OK   el jugador gana al menos el 70 %');
}

// Esto es lo que de verdad no puede pasar: morir sin haber jugado.
if (sinActuar > 0) {
  fallos += 1;
  console.log(`MAL  ${sinActuar} derrotas sin haber actuado dos veces`);
} else {
  console.log('OK   nunca cae sin haber actuado al menos dos veces');
}

/* ════════════════════════════════════════════════════════════════════════════
   ¿ATACA A QUIEN DIJO?
   ════════════════════════════════════════════════════════════════════════════ */

// El método no depende del estado, solo del catálogo: se puede probar sin
// arrancar el juego entero.
const router = Object.create(ActionRouter.prototype);

const CASOS = [
  { frase: 'ataco al primer bandido que vea', terreno: 'camino', peligro: 2, espera: 'saqueador' },
  { frase: 'ataco a los guardias', terreno: 'ciudad', peligro: 2, espera: 'guardia_corrupto' },
  { frase: 'me lanzo contra los lobos', terreno: 'bosque', peligro: 3, espera: 'lobo_ceniciento' },
];

console.log('');

for (const caso of CASOS) {
  const posibles = gruposAlBuscarPelea(caso.terreno, caso.peligro, factor);
  const elegidos = router._loQueNombro(posibles, caso.frase) ?? posibles;

  const todosEncajan = elegidos.length > 0 && elegidos.every(
    (e) => (e.combate.enemies ?? []).some((x) => x.refId === caso.espera),
  );

  if (todosEncajan) {
    console.log(`OK   «${caso.frase}» trae ${caso.espera}`);
  } else {
    fallos += 1;
    const salio = elegidos.map((e) => e.refId).join(', ') || '(nada)';
    console.log(`MAL  «${caso.frase}» esperaba ${caso.espera} y salió: ${salio}`);
  }
}

console.log(`\n${fallos ? `${fallos} fallos.` : 'Todo correcto.'}`);
process.exit(fallos ? 1 : 0);
