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
import { leerJugada } from '../src/combat/Jugada.js';

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

/* ═══════════════════════════════════════════════════════════════════════════
   LA JUGADA ESCRITA: 20 JUGADAS CON SU BONO
   ═══════════════════════════════════════════════════════════════════════════ */

// Una escena fija: dos saqueadores, uno medio muerto, y un guardia cegado.
// Lleva un hacha de mano (la de siempre), una cuerda, una antorcha y una
// poción. Con la misma escena, la misma frase da siempre el mismo bono.
const ENEMIGOS = [
  { id: 'a', nombre: 'Saqueador A', vida: { actual: 16, max: 16 }, estados: [] },
  { id: 'b', nombre: 'Saqueador B', vida: { actual: 5, max: 16 }, estados: [] },
  { id: 'g', nombre: 'Guardia corrupto', vida: { actual: 28, max: 28 }, estados: [{ refId: 'cegado' }] },
];
const INVENTARIO = [
  { id: 'o1', nombre: 'Hacha de mano', categoria: 'arma' },
  { id: 'o2', nombre: 'Cuerda', categoria: 'util' },
  { id: 'o3', nombre: 'Antorcha', categoria: 'util' },
  { id: 'o4', nombre: 'Poción de curación', categoria: 'consumible' },
];
const ESCENA_COMBATE = { enemigos: ENEMIGOS, inventario: INVENTARIO, arma: 'Hacha de mano', marcado: 'a' };
const TRAS_CEGAR = { ...ESCENA_COMBATE, anterior: { estado: 'cegado' } };

/** [frase, contexto, tipo, bono, objetivo esperado o null si no importa, qué más] */
const JUGADAS = [
  ['ataco al saqueador A', ESCENA_COMBATE, 'atacar', 0, 'a'],
  ['salto sobre la roca y descargo el hacha sobre su cabeza', ESCENA_COMBATE, 'atacar', 1, 'a'],
  ['le lanzo arena a los ojos y le golpeo', ESCENA_COMBATE, 'atacar', 1, 'a', (j) => j.estado?.refId === 'cegado'],
  ['le lanzo arena a los ojos', ESCENA_COMBATE, 'maniobra', 1, 'a', (j) => j.estado?.refId === 'cegado'],
  ['empujo al saqueador A al río', ESCENA_COMBATE, 'maniobra', 1, 'a', (j) => j.estado?.refId === 'derribado'],
  ['ataco al herido', ESCENA_COMBATE, 'atacar', 1, 'b'],
  ['le rodeo el cuello con la cuerda', ESCENA_COMBATE, 'atacar', 1, 'a', (j) => j.objeto?.id === 'o2'],
  ['le prendo fuego con la antorcha', ESCENA_COMBATE, 'atacar', 1, 'a', (j) => j.objeto?.id === 'o3'],
  ['salto desde la mesa con la antorcha y golpeo al guardia, que está cegado', ESCENA_COMBATE, 'atacar', 3, 'g'],
  ['desde la mesa, con la antorcha, aprovecho que el guardia está cegado y le golpeo', TRAS_CEGAR, 'atacar', 3, 'g'],
  ['aprovecho que está ciego y le golpeo al guardia', TRAS_CEGAR, 'atacar', 2, 'g'],
  ['saco una pistola láser y le disparo', ESCENA_COMBATE, 'atacar', -2, null, (j) => /No hay pistolas/.test(j.aviso ?? '')],
  ['le clavo la espada al saqueador B', ESCENA_COMBATE, 'atacar', -2, 'b', (j) => /No llevas espada/.test(j.aviso ?? '')],
  ['huyo hacia el bosque', ESCENA_COMBATE, 'huir', 0, null],
  ['me cubro detrás del carro', ESCENA_COMBATE, 'defender', 0, null],
  ['bebo la poción', ESCENA_COMBATE, 'curar', 0, null, (j) => j.objeto?.id === 'o4'],
  ['ataco al jefe', ESCENA_COMBATE, 'atacar', 0, 'g'],
  ['ataco al de la derecha', ESCENA_COMBATE, 'atacar', 0, 'g'],
  ['ataco a la b con el hacha', ESCENA_COMBATE, 'atacar', 0, 'b'],
  ['le doy una patada en la rodilla', ESCENA_COMBATE, 'atacar', 0, 'a'],
];

console.log('');
for (const [frase, ctx, tipo, bono, objetivo, extra] of JUGADAS) {
  const j = leerJugada(frase, ctx);
  const bien = j.tipo === tipo
    && j.creatividad.valor === bono
    && (objetivo === null || j.objetivo === objetivo)
    && (!extra || extra(j));

  if (bien) {
    console.log(`OK   ${bono >= 0 ? '+' : ''}${bono}  «${frase}»`);
  } else {
    fallos += 1;
    console.log(`MAL  «${frase}»`);
    console.log(`     esperado ${tipo} ${bono} → ${objetivo ?? '-'}; salió ${j.tipo} ${j.creatividad.valor} → ${j.objetivo ?? '-'} (${j.creatividad.motivos.join(', ')}) ${j.aviso ?? ''}`);
  }
}

// El techo es +3 aunque se sumen más motivos.
{
  const todo = leerJugada('desde la mesa, con la antorcha, aprovecho que el guardia está cegado y le golpeo', TRAS_CEGAR);
  if (todo.creatividad.valor !== 3) { fallos += 1; console.log(`MAL  el bono no se queda en +3: ${todo.creatividad.valor}`); }
  else console.log('OK   el bono tiene techo en +3 aunque se sumen cuatro motivos');
}

console.log(`\n${fallos ? `${fallos} fallos.` : 'Todo correcto.'}`);
process.exit(fallos ? 1 : 0);
