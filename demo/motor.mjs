#!/usr/bin/env node
/**
 * ARCANUM · demo/motor.mjs
 * Demostración de los módulos puros del motor, sin navegador.
 */

import { GestorRNG } from '../src/core/RNG.js';
import { tirar, evaluar } from '../src/core/Dice.js';
import { interpretar } from '../src/engine/IntentParser.js';
import * as Comb from '../src/combat/Combatant.js';
import * as Ataques from '../src/combat/AttackResolver.js';
import * as Estados from '../src/combat/StatusEffects.js';
import * as Iniciativa from '../src/combat/InitiativeTracker.js';
import * as IA from '../src/combat/EnemyAI.js';
import * as Registro from '../src/combat/CombatLog.js';
import * as Mapa from '../src/world/MapGraph.js';
import * as Precios from '../src/economy/PriceModel.js';
import * as Tablas from '../src/world/EncounterTables.js';
import { obtenerEnemigo } from '../src/data/enemies.data.js';
import { obtenerLugar } from '../src/data/locations.data.js';
import { combinarEfectos } from '../src/data/events.data.js';

const L = (s = '') => console.log(s);
const T = (t) => { L(); L('─'.repeat(66)); L('  ' + t); L('─'.repeat(66)); };

// Semilla fija: la demo es reproducible.
const rng = new GestorRNG('demostracion-arcanum');

/* ══════════════════════════════════════════════════════════════════════ */
T('1 · INTERPRETACIÓN DE TEXTO LIBRE');

const frases = [
  'ataco al lobo con la espada',
  'intento colarme por la ventana sin que me vean',
  'le pregunto a la posadera qué se cuenta por aquí',
  'registro la habitación a fondo',
  'me bebo la poción',
  'amenazo al guardia para que nos deje pasar',
];

for (const frase of frases) {
  const i = interpretar(frase);
  const hab = i.habilidad ? ` · ${i.habilidad}` : '';
  const obj = i.objetivo ? ` · objetivo: ${i.objetivo}` : '';
  L(`  «${frase}»`);
  L(`     → ${i.tipo}${hab}${obj} · confianza ${(i.confianza * 100).toFixed(0)}%`);
}

/* ══════════════════════════════════════════════════════════════════════ */
T('2 · TIRADAS: EL MOTOR DECIDE, NO EL NARRADOR');

const mods = [
  { fuente: 'Destreza', valor: 3 },
  { fuente: 'Competencia en sigilo', valor: 2 },
  { fuente: 'Carga pesada', valor: -2 },
];

L('  Prueba de sigilo contra dificultad 15');
L('  Modificadores: ' + mods.map((m) => `${m.fuente} ${m.valor > 0 ? '+' : ''}${m.valor}`).join(', '));
L();

for (let i = 0; i < 5; i++) {
  const t = tirar(rng.dados, { modificadores: mods, umbral: 15 });
  const veredicto = t.pifia ? 'PIFIA' : t.critico ? 'CRÍTICO' : t.exito ? 'éxito' : 'fracaso';
  L(`   d20=${String(t.natural).padStart(2)} + ${t.modificador} = ${String(t.total).padStart(2)} vs 15  →  ${veredicto} (margen ${t.margen > 0 ? '+' : ''}${t.margen})`);
}

/* ══════════════════════════════════════════════════════════════════════ */
T('3 · COMBATE: TRES LOBOS CONTRA UN PERSONAJE');

const jugador = Comb.desdeJugador(
  {
    nombre: 'Kelra', nivel: 4,
    vida: { actual: 38, max: 38 },
    atributos: { vigor: 15, destreza: 14, temple: 13, intelecto: 10, astucia: 12, carisma: 11 },
    estados: [],
  },
  {
    defensa: 4, reduccion: 2,
    armaPrincipal: {
      objeto: { nombre: 'Espada corta' },
      stats: { dano: { notacion: '1d6+2', tipo: 'cortante' }, bonoAtaque: 1, bonoDano: 2 },
    },
  },
);

const lobos = Comb.crearGrupo([{ refId: 'lobo_ceniciento', count: 3 }], { flujo: rng.combate });

L(`  ${jugador.nombre}: ${jugador.vida.actual} pv · defensa ${Comb.defensaEfectiva(jugador)} · esquiva ${(Comb.esquivaEfectiva(jugador) * 100).toFixed(0)}%`);
for (const l of lobos) L(`  ${l.nombre}: ${l.vida.actual} pv · táctica «${l.tactica}»`);

const orden = Iniciativa.tirarIniciativa(rng.combate, [jugador, ...lobos]);
L();
L('  Iniciativa: ' + orden.tiradas.map((t) => `${t.nombre} (${t.total})`).join(' → '));

// Mapa de combatientes
const enJuego = Object.fromEntries(orden.combatientes.map((c) => [c.id, c]));

L();
L('  ── Ronda 1 ──');

let ronda = 1;
const bitacora = [];

for (const id of orden.orden) {
  let actor = enJuego[id];
  if (!actor.vivo) continue;

  if (actor.esJugador) {
    // El jugador ataca al más débil.
    const objetivo = Object.values(enJuego)
      .filter((c) => c.vivo && c.bando === 'enemigo')
      .sort((a, b) => a.vida.actual - b.vida.actual)[0];

    if (!objetivo) continue;

    const r = Ataques.resolver(rng.combate, {
      atacante: actor, objetivo, ataque: actor.ataques[0], ronda,
    });

    enJuego[r.atacante.id] = r.atacante;
    enJuego[r.objetivo.id] = r.objetivo;

    const entrada = Registro.entradaAtaque(r, { ronda, atacante: actor, objetivo, ataque: actor.ataques[0] });
    bitacora.push(entrada);
    L('   ' + Registro.paraJugador(entrada));

  } else {
    // La IA decide.
    const decision = IA.decidir(rng.combate, { actor, combatientes: enJuego, ronda, historial: bitacora });

    if (decision.accion !== 'atacar') {
      L(`   ${IA.describir(decision, actor, enJuego)}`);
      continue;
    }

    const objetivo = enJuego[decision.objetivo];
    const r = Ataques.resolver(rng.combate, {
      atacante: actor, objetivo, ataque: decision.ataque, ronda,
    });

    enJuego[r.atacante.id] = r.atacante;
    enJuego[r.objetivo.id] = r.objetivo;

    const entrada = Registro.entradaAtaque(r, { ronda, atacante: actor, objetivo, ataque: decision.ataque });
    bitacora.push(entrada);
    L('   ' + Registro.paraJugador(entrada));
  }
}

L();
L('  Estado tras la ronda:');
for (const c of Object.values(enJuego)) {
  const i = Comb.paraInterfaz(c);
  const est = i.estados.length ? ` [${i.estados.map((e) => e.nombre).join(', ')}]` : '';
  L(`   ${i.nombre.padEnd(20)} ${String(c.vida.actual).padStart(3)}/${c.vida.max} · ${i.condicion}${est}`);
}

L();
L('  Lo que recibe el DIRECTOR (sin números):');
L('   «' + Registro.paraDirector(bitacora) + '»');

/* ══════════════════════════════════════════════════════════════════════ */
T('4 · NAVEGACIÓN: EL MAPA ES UN GRAFO REAL');

const rutas = [
  ['vado_yunque', 'forja_alta'],
  ['vado_yunque', 'oasis_sal'],
];

for (const [a, b] of rutas) {
  const r = Mapa.ruta(a, b);
  L(`  ${obtenerLugar(a).nombre} → ${obtenerLugar(b).nombre}`);
  L(`   ${r.ruta.map((x) => obtenerLugar(x).nombre).join(' → ')}`);
  L(`   ${Mapa.describir(r)}`);
  const p = Mapa.provisionesNecesarias(r);
  L(`   Necesitas ${p.raciones} raciones y ${p.agua} odres de agua.`);
  L();
}

L('  El mismo destino, tres criterios distintos:');
for (const alt of Mapa.alternativas('vado_yunque', 'forja_alta')) {
  L(`   ${alt.nombre.padEnd(16)} ${alt.ruta.map((x) => obtenerLugar(x).nombre).join(' → ')}`);
  L(`   ${''.padEnd(16)} ${alt.distanciaTotal} h · peligro máximo ${alt.peligroMaximo}`);
}

L();
const invierno = Mapa.ruta('camino_norte', 'forja_alta', { estacion: 'invierno' });
L('  En invierno: ' + (invierno.encontrada ? 'abierto' : `CERRADO — ${invierno.motivo}`));

/* ══════════════════════════════════════════════════════════════════════ */
T('5 · ECONOMÍA: EL MISMO OBJETO, DISTINTO PRECIO');

const odre = { refId: 'odre_agua', nombre: 'Odre de agua', categoria: 'consumible', valor: 5 };

L('  Odre de agua (valor base 5 de oro)');
L();

for (const region of ['valle_central', 'montanas_yunque', 'dunas_rojas']) {
  const compra = Precios.precioCompra(odre, { region });
  const venta = Precios.precioVenta(odre, { region });
  const nombre = { valle_central: 'Valle Central', montanas_yunque: 'Montañas del Yunque', dunas_rojas: 'Dunas Rojas' }[region];
  L(`   ${nombre.padEnd(22)} comprar: ${String(compra.precio).padStart(3)}   vender: ${String(venta.precio).padStart(3)}`);
}

L();
L('  Comprar y vender lo mismo SIEMPRE pierde: no hay bucle de oro.');

L();
L('  Efectos de eventos, que se multiplican:');
const soloFeria = combinarEfectos(['feria']);
const soloCosecha = combinarEfectos(['buena_cosecha']);
const ambos = combinarEfectos(['feria', 'buena_cosecha']);
L(`   feria .................. precios ×${soloFeria.precios}`);
L(`   buena cosecha .......... precios ×${soloCosecha.precios}`);
L(`   las dos a la vez ....... precios ×${ambos.precios.toFixed(3)}  →  ${Math.round(ambos.precios * 100)}% del valor base`);
L('   (nadie programó esa combinación: sale sola)');

/* ══════════════════════════════════════════════════════════════════════ */
T('6 · ENCUENTROS: HABLAR VALE MÁS QUE PELEAR');

L('  Experiencia según cómo resuelvas un encuentro de peligro 3:');
L();
const vias = ['mediacion', 'persuasion', 'intimidacion', 'combate', 'soborno', 'huida'];
for (const via of vias.sort((a, b) => Tablas.xpPorResolucion(b, 3) - Tablas.xpPorResolucion(a, 3))) {
  const xp = Tablas.xpPorResolucion(via, 3);
  const barra = '█'.repeat(Math.round(xp / 4));
  L(`   ${via.padEnd(14)} ${String(xp).padStart(3)} xp  ${barra}`);
}

L();
L('  Encuentros generados en tres terrenos distintos:');
L();
for (const [terreno, peligro] of [['bosque', 2], ['pantano', 4], ['camino', 1]]) {
  const e = Tablas.elegir(rng.flujo('mundo'), { terreno, peligro });
  if (!e) continue;
  L(`   ${terreno.padEnd(9)} (peligro ${peligro})  →  ${e.nombre} [${e.familia}]`);
  L(`   ${''.padEnd(9)} «${e.apertura}»`);
  L(`   ${''.padEnd(9)} vías: ${e.resolucionesPosibles.join(', ')}`);
  L();
}

/* ══════════════════════════════════════════════════════════════════════ */
T('RESUMEN');

L('  Todo lo anterior se ha ejecutado de verdad, con semilla fija.');
L('  Vuelve a lanzarlo y saldrá exactamente igual.');
L();
