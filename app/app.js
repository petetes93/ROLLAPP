/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · app/app.js
 * ---------------------------------------------------------------------------
 * La aplicación de juego.
 *
 * Arranca el motor directamente —sin pasar por main.js ni UIManager— y dibuja
 * su propia interfaz. Tres pantallas: inicio, creación y partida.
 *
 * Todo lo que se ve sale del motor real: las tiradas, el mundo, el combate y
 * la narración del director interno.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { store } from '../src/core/Store.js';
import { bus } from '../src/core/EventBus.js';
import { Registry } from '../src/core/Registry.js';
import { GestorRNG } from '../src/core/RNG.js';

import { Clock } from '../src/core/Clock.js';
import { Player } from '../src/player/Player.js';
import { Inventory } from '../src/inventory/Inventory.js';
import { TimeSystem } from '../src/world/TimeSystem.js';
import { WeatherSystem } from '../src/world/WeatherSystem.js';
import { DynamicEvents } from '../src/world/DynamicEvents.js';
import { Travel } from '../src/world/Travel.js';
import { Exploration } from '../src/world/Exploration.js';
import { World } from '../src/world/World.js';
import { RelationshipSystem } from '../src/npc/RelationshipSystem.js';
import { ReputationSystem } from '../src/npc/ReputationSystem.js';
import { FactionSystem } from '../src/npc/FactionSystem.js';
import { DialogueSystem } from '../src/npc/DialogueSystem.js';
import { MerchantSystem } from '../src/npc/MerchantSystem.js';
import { EconomySystem } from '../src/economy/EconomySystem.js';
import { QuestSystem } from '../src/quests/QuestSystem.js';
import { StatsTracker } from '../src/progression/StatsTracker.js';
import { AchievementSystem } from '../src/progression/AchievementSystem.js';
import { Milestones } from '../src/progression/Milestones.js';
import { SaveManager } from '../src/persistence/SaveManager.js';
import { RulesEngine } from '../src/engine/RulesEngine.js';
import { EffectApplier } from '../src/engine/EffectApplier.js';
import { CombatManager } from '../src/combat/CombatManager.js';
import { DungeonMaster } from '../src/ai/DungeonMaster.js';
import { ActionRouter } from '../src/engine/ActionRouter.js';
import { ConsequenceEngine } from '../src/engine/ConsequenceEngine.js';
import { DifficultyDirector } from '../src/engine/DifficultyDirector.js';
import { TurnResolver } from '../src/engine/TurnResolver.js';

import {
  pintarLugar, pintarRetrato, pintarCriatura, cargarManifiesto,
} from '../src/art/index.js';
import { obtenerEnemigo } from '../src/data/enemies.data.js';

import { previsualizar } from '../src/player/CharacterFactory.js';
import { RAZAS } from '../src/data/races.data.js';
import { CLASES } from '../src/data/classes.data.js';
import { TRASFONDOS } from '../src/data/backgrounds.data.js';
import { obtenerLugar } from '../src/data/locations.data.js';
import * as Comb from '../src/combat/Combatant.js';

/* ═══════════════════════════════════════════════════════════════════════════
   UTILIDADES DE DOM
   ═══════════════════════════════════════════════════════════════════════════ */

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

function el(tag, attrs = {}, ...hijos) {
  const n = document.createElement(tag);

  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') n.className = v;
    else if (k === 'text') n.textContent = String(v);
    else if (k === 'html') n.innerHTML = v;
    else if (k.startsWith('on')) n.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'dataset') Object.assign(n.dataset, v);
    else n.setAttribute(k, String(v));
  }

  for (const h of hijos.flat()) {
    if (h === null || h === undefined || h === false) continue;
    n.append(h.nodeType ? h : document.createTextNode(String(h)));
  }

  return n;
}

function vaciar(nodo) {
  if (nodo) nodo.innerHTML = '';
}

/** Muestra un fallo en pantalla en vez de dejar la página muda. */
function avisarFallo(donde, error) {
  console.error('[arcanum] ' + donde, error);

  let caja = $('#fallos');
  if (!caja) {
    caja = el('div', { id: 'fallos', class: 'fallos' },
      el('p', { class: 'fallos__titulo', text: 'Algo ha fallado' }));
    document.body.prepend(caja);
  }

  caja.append(el('pre', {
    class: 'fallos__linea',
    text: `${donde} → ${error?.message ?? error}\n${String(error?.stack ?? '').split('\n').slice(1, 3).join('\n')}`,
  }));
}

// Cualquier error que se escape queda escrito en pantalla.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    document.body?.classList.add('esta-listo');

    const err = e.error ?? new Error(e.message);

    // Si el motor aún no arrancó, el fallo se pinta en el rótulo, que es lo
    // único visible en ese momento.
    if (!motor.listo) arranqueFallido('error no capturado', err);
    else avisarFallo('error no capturado', err);
  });

  window.addEventListener('unhandledrejection', (e) => {
    document.body?.classList.add('esta-listo');
    avisarFallo('promesa rechazada', e.reason);
  });
}

const protegido = (donde, fn) => (...args) => {
  try { return fn(...args); } catch (e) { avisarFallo(donde, e); return null; }
};

/* ═══════════════════════════════════════════════════════════════════════════
   MOTOR
   ═══════════════════════════════════════════════════════════════════════════ */

const motor = { registry: null, rng: null, listo: false };

async function arrancarMotor() {
  motor.rng = new GestorRNG();
  store.fijar('meta.semilla', motor.rng.semillaMaestra);

  motor.registry = new Registry({ store, bus, rng: motor.rng });

  // Se informa del avance: si un sistema cuelga el arranque, su nombre queda
  // en pantalla en vez de un rótulo mudo.
  const decir = (t) => {
    const n = document.getElementById('arranque-texto');
    if (n) n.textContent = t;
  };

  bus.on?.('system:started', ({ nombre }) => decir(`Iniciando ${nombre}…`));
  decir('Registrando sistemas…');

  motor.registry.registrarTodos([
    Clock, Player, Inventory,
    TimeSystem, WeatherSystem, DynamicEvents, Travel, Exploration, World,
    RelationshipSystem, ReputationSystem, FactionSystem, DialogueSystem,
    MerchantSystem, EconomySystem, QuestSystem,
    StatsTracker, AchievementSystem, Milestones, SaveManager,
    RulesEngine, EffectApplier, CombatManager,
    DungeonMaster, ActionRouter, ConsequenceEngine, DifficultyDirector,
    TurnResolver,
  ]);

  await motor.registry.iniciar();

  if (typeof motor.registry.arrancar === 'function') {
    await motor.registry.arrancar();
  }

  motor.listo = true;

  return motor.registry;
}

const sistema = (nombre) => motor.registry?.obtener(nombre) ?? null;
const ver = (ruta, defecto) => store.select(ruta, defecto);

/* ═══════════════════════════════════════════════════════════════════════════
   PANTALLAS
   ═══════════════════════════════════════════════════════════════════════════ */

function mostrar(pantalla) {
  // Se acota a las secciones a propósito. La marca del cuerpo va en OTRO
  // atributo (`data-active-screen`, el mismo que usa ui.config.js) porque con
  // el mismo nombre el body entraba en esta lista en la segunda llamada, no
  // coincidía con el destino y se ponía `hidden` a sí mismo: el juego entero
  // desaparecía al pasar de la portada a la creación.
  for (const s of $$('section[data-pantalla]')) {
    s.hidden = s.dataset.pantalla !== pantalla;
  }

  document.body.setAttribute('data-active-screen', pantalla);
}

/* ── inicio ───────────────────────────────────────────────────────────── */

function pintarInicio() {
  const saves = sistema('saves');
  const hay = saves?.hayPartidas?.() ?? { hay: false };

  const caja = $('#inicio-acciones');
  vaciar(caja);

  caja.append(
    el('button', {
      class: 'btn btn--grande',
      onClick: protegido('nueva partida', () => { mostrar('creacion'); pintarCreacion(); }),
    }, 'Nueva crónica'),
  );

  if (hay.hay) {
    caja.append(el('button', {
      class: 'btn btn--fantasma',
      onClick: protegido('continuar', () => continuar()),
    }, 'Continuar'));
  }
}

function continuar() {
  const saves = sistema('saves');
  const reciente = saves?.hayPartidas?.().masReciente;
  if (!reciente) return;

  const r = saves.cargar(reciente.ranura);

  if (!r.exito) {
    avisarFallo('cargar partida', new Error(r.motivo));
    return;
  }

  mostrar('juego');
  refrescarTodo();
}

/* ── creación ─────────────────────────────────────────────────────────── */

const borrador = {
  nombre: '',
  raza: 'valdes',
  clase: 'rastreador',
  trasfondo: 'errante',
};

function pintarCreacion() {
  const caja = $('#creacion-cuerpo');
  vaciar(caja);

  // ── Nombre ──────────────────────────────────────────────────────────
  caja.append(
    el('div', { class: 'campo' },
      el('label', { class: 'campo__eti', for: 'nombre', text: 'Nombre' }),
      el('input', {
        id: 'nombre', class: 'campo__entrada', type: 'text',
        placeholder: 'Kelra', maxlength: '28', value: borrador.nombre,
        onInput: (e) => { borrador.nombre = e.target.value; },
      }),
    ),
  );

  // ── Linaje, con el rostro al lado ───────────────────────────────────
  // El retrato manda: es lo que hace que elegir linaje sea una decisión
  // visual y no una lista de nombres.
  const cara = el('div', { class: 'eleccion__cara', id: 'creacion-cara' });

  caja.append(
    el('div', { class: 'eleccion' },
      cara,
      el('div', {}, grupoEleccion('Linaje', RAZAS, 'raza')),
    ),
  );

  pintarRetrato(cara, { raza: borrador.raza, nombre: RAZAS[borrador.raza]?.nombre });

  // ── Resto de elecciones ─────────────────────────────────────────────
  caja.append(
    grupoEleccion('Oficio', CLASES, 'clase'),
    grupoEleccion('Pasado', TRASFONDOS, 'trasfondo'),
  );

  // ── Resumen ─────────────────────────────────────────────────────────
  caja.append(el('div', { id: 'creacion-resumen', class: 'resumen' }));
  pintarResumen();
}

function grupoEleccion(titulo, catalogo, clave) {
  const opciones = Object.values(catalogo);

  return el('div', { class: 'grupo' },
    el('p', { class: 'grupo__eti', text: titulo }),
    el('div', { class: 'fichas' },
      ...opciones.map((o) => el('button', {
        class: 'ficha' + (borrador[clave] === o.refId ? ' es-elegida' : ''),
        dataset: { clave, valor: o.refId },
        onClick: protegido('elección', () => {
          borrador[clave] = o.refId;
          pintarCreacion();
        }),
      },
        el('span', { class: 'ficha__nombre', text: o.nombre }),
        el('span', { class: 'ficha__nota', text: (o.lema ?? o.descripcion ?? '').slice(0, 68) }),
      )),
    ),
  );
}

function pintarResumen() {
  const caja = $('#creacion-resumen');
  if (!caja) return;

  vaciar(caja);

  const raza = RAZAS[borrador.raza];
  const clase = CLASES[borrador.clase];
  const fondo = TRASFONDOS[borrador.trasfondo];

  const inicio = obtenerLugar({
    ferrano: 'forja_alta', brumal: 'pilotes_brumal', sombracorteza: 'arboleda_madre',
    crisol: 'oasis_sal', albar: 'umbral_albar', griscuerno: 'paso_yunque',
    valdes: 'vado_yunque', menudo: 'saucedo',
  }[borrador.raza] ?? 'vado_yunque');

  caja.append(
    el('p', { class: 'resumen__linea', text: raza?.promptLore?.slice(0, 180) ?? '' }),
    el('p', { class: 'resumen__linea resumen__linea--tenue' },
      el('strong', { text: clase?.nombre ?? '' }), ' · ', fondo?.nombre ?? '',
      inicio ? el('span', { text: ` · empiezas en ${inicio.nombre}` }) : null,
    ),
  );
}

async function empezarPartida() {
  const nombre = ($('#nombre')?.value ?? '').trim();

  if (!nombre) {
    $('#nombre')?.focus();
    avisarFallo('creación', new Error('Ponle nombre al personaje.'));
    return;
  }

  // El sistema de jugador construye el personaje y avisa a los demás: aquí
  // solo se le pasa el borrador.
  store.dispatch('player/crear', { borrador: { ...borrador, nombre } });

  // Se deja que la microcola entregue el aviso antes de dibujar.
  await new Promise((r) => setTimeout(r, 0));

  mostrar('juego');
  refrescarTodo();

  // El director abre la crónica.
  const turns = sistema('turns');
  await turns?.abrirCronica?.();

  refrescarTodo();
}

/* ═══════════════════════════════════════════════════════════════════════════
   PANTALLA DE JUEGO
   ═══════════════════════════════════════════════════════════════════════════ */

function refrescarTodo() {
  pintarEscena();
  pintarBitacora();
  pintarPersonaje();
  pintarLateral();
  pintarOpciones();
  pintarCabecera();
  pintarCombate();
}

/* ── escena ───────────────────────────────────────────────────────────── */

/** Nombres legibles de las franjas horarias. */
const FRANJAS_TEXTO = {
  madrugada: 'madrugada', alba: 'al alba', manana: 'por la mañana',
  mediodia: 'a mediodía', tarde: 'por la tarde', ocaso: 'al ocaso',
  noche: 'de noche',
};

/**
 * Pinta la ilustración del lugar y su rótulo.
 *
 * El arte depende del lugar, de la franja y del clima, así que esto se llama
 * en cada refresco. `pintarLugar` compara una firma y no repinta si nada ha
 * cambiado, que es lo que evita el parpadeo turno a turno.
 */
function pintarEscena() {
  const lugar = obtenerLugar(ver('world.ubicacion'));
  if (!lugar) return;

  const t = ver('world.tiempo', {}) ?? {};
  const clima = ver('world.clima.actual', 'despejado');

  pintarLugar($('#escena-lienzo'), lugar, { franja: t.franja, clima });

  const rotulo = $('#escena-rotulo');
  if (!rotulo) return;

  vaciar(rotulo);

  rotulo.append(
    el('span', { class: 'escena__lugar', text: lugar.nombre }),
    el('span', { class: 'escena__dato', text: `día ${t.dia ?? 1}` }),
    el('span', { class: 'escena__sep', text: '·' }),
    el('span', { class: 'escena__dato', text: FRANJAS_TEXTO[t.franja] ?? '' }),
    el('span', { class: 'escena__sep', text: '·' }),
    el('span', { class: 'escena__dato', text: clima }),
  );
}

/* ── bitácora ─────────────────────────────────────────────────────────── */

function pintarBitacora() {
  const caja = $('#bitacora');
  if (!caja) return;

  const entradas = ver('narrative.entradas', []) ?? [];
  vaciar(caja);

  for (const e of entradas.slice(-60)) {
    if (e.voz === 'tirada') {
      caja.append(fichaTirada(e.meta?.tirada));
      continue;
    }

    const clase = {
      dm: 'linea linea--dm',
      jugador: 'linea linea--jugador',
      system: 'linea linea--sistema',
      sistema: 'linea linea--sistema',
      combate: 'linea linea--combate',
    }[e.voz] ?? 'linea';

    for (const parrafo of String(e.texto ?? '').split('\n')) {
      if (!parrafo.trim()) continue;
      caja.append(el('p', { class: clase, text: parrafo }));
    }
  }

  caja.scrollTop = caja.scrollHeight;
}

function fichaTirada(t) {
  if (!t) return el('span');

  const clase = t.pifia ? 'pifia' : t.critico ? 'critico' : t.exito ? 'exito' : 'fracaso';
  const etiqueta = t.pifia ? 'pifia' : t.critico ? 'crítico' : t.exito ? 'éxito' : 'fracaso';

  return el('div', { class: `tirada tirada--${clase}` },
    el('span', { class: 'tirada__dado', text: `d20 ${t.natural}` }),
    el('span', { class: 'tirada__cuenta', text: `${t.total} vs ${t.umbral}` }),
    el('span', { class: 'tirada__veredicto', text: etiqueta }),
    t.nombreHabilidad ? el('span', { class: 'tirada__hab', text: t.nombreHabilidad }) : null,
  );
}

/* ── cabecera ─────────────────────────────────────────────────────────── */

function pintarCabecera() {
  const caja = $('#cabecera-info');
  if (!caja) return;

  const lugar = obtenerLugar(ver('world.ubicacion'));
  const j = ver('player', {}) ?? {};

  vaciar(caja);

  // El lugar, el día y el clima viven ahora en el rótulo de la escena, encima
  // de la ilustración. Repetirlos aquí era ruido; la cabecera lleva lo que la
  // escena no dice: en qué región estás y quién eres.
  caja.append(
    el('span', { class: 'cab__lugar', text: j.nombre ?? 'ARCANUM' }),
    el('span', { class: 'cab__sep', text: '·' }),
    el('span', { text: `nivel ${j.nivel ?? 1}` }),
    lugar?.region ? el('span', { class: 'cab__sep', text: '·' }) : null,
    lugar?.region ? el('span', { text: String(lugar.region).replace(/_/g, ' ') }) : null,
  );
}

/* ── personaje ────────────────────────────────────────────────────────── */

function pintarPersonaje() {
  const caja = $('#panel-personaje');
  if (!caja) return;

  const j = ver('player', {}) ?? {};
  vaciar(caja);

  // El retrato depende del linaje y del nombre, así que solo se repinta al
  // crear el personaje o al cargar otra partida.
  pintarRetrato($('#retrato-pj'), { raza: j.raza, nombre: j.nombre });

  caja.append(
    el('div', { class: 'ficha-pj' },
      el('span', { class: 'ficha-pj__nombre', text: j.nombre ?? '—' }),
      el('span', { class: 'ficha-pj__clase', text: `nivel ${j.nivel ?? 1}` }),
    ),
  );

  const barras = [
    ['Vida', j.vida?.actual ?? 0, j.vida?.max ?? 1, 'vida'],
    j.mana?.max ? ['Ánima', j.mana.actual, j.mana.max, 'mana'] : null,
    ['Hambre', j.hambre ?? 100, 100, 'hambre'],
    ['Sed', j.sed ?? 100, 100, 'sed'],
    ['Vigor', j.fatiga ?? 100, 100, 'fatiga'],
  ].filter(Boolean);

  for (const [eti, actual, max, clave] of barras) {
    const frac = Math.max(0, Math.min(1, actual / Math.max(1, max)));

    caja.append(el('div', { class: 'barra-caja' },
      el('div', { class: 'barra-caja__fila' },
        el('span', { text: eti }),
        el('span', { class: 'barra-caja__cifra', text: `${Math.round(actual)}/${max}` }),
      ),
      el('div', { class: 'barra' },
        el('div', {
          class: `barra__relleno barra__relleno--${clave}`,
          style: `width:${Math.round(frac * 100)}%`,
        }),
      ),
    ));
  }

  caja.append(el('div', { class: 'oro' },
    el('span', { text: 'Oro' }),
    el('span', { class: 'oro__cifra', text: String(j.oro ?? 0) }),
  ));

  // Estados alterados.
  const estados = j.estados ?? [];
  if (estados.length) {
    caja.append(el('div', { class: 'etiquetas' },
      ...estados.map((e) => el('span', { class: 'etiqueta etiqueta--mal', text: e.refId })),
    ));
  }
}

/* ── lateral: inventario, mapa, misiones ──────────────────────────────── */

let pestanaActiva = 'inventario';

function pintarLateral() {
  const caja = $('#panel-lateral');
  if (!caja) return;

  vaciar(caja);

  const pestanas = [
    ['inventario', 'Bolsa'],
    ['mapa', 'Mapa'],
    ['misiones', 'Encargos'],
    ['gente', 'Gente'],
  ];

  caja.append(el('div', { class: 'pestanas' },
    ...pestanas.map(([clave, eti]) => el('button', {
      class: 'pestana' + (pestanaActiva === clave ? ' es-activa' : ''),
      onClick: protegido('pestaña', () => { pestanaActiva = clave; pintarLateral(); }),
      text: eti,
    })),
  ));

  const cuerpo = el('div', { class: 'lateral__cuerpo' });
  caja.append(cuerpo);

  try {
    if (pestanaActiva === 'inventario') pintarInventario(cuerpo);
    else if (pestanaActiva === 'mapa') pintarMapa(cuerpo);
    else if (pestanaActiva === 'misiones') pintarMisiones(cuerpo);
    else pintarGente(cuerpo);
  } catch (e) {
    avisarFallo('panel ' + pestanaActiva, e);
  }
}

function pintarInventario(caja) {
  const objetos = Object.values(ver('inventory.objetos.porId', {}) ?? {});

  if (!objetos.length) {
    caja.append(el('p', { class: 'vacio', text: 'No llevas nada.' }));
    return;
  }

  for (const o of objetos) {
    caja.append(el('button', {
      class: 'objeto' + (o.equipado ? ' es-equipado' : ''),
      onClick: protegido('usar objeto', () => usarObjeto(o)),
    },
      el('span', { class: 'objeto__nombre', text: o.nombre }),
      o.cantidad > 1 ? el('span', { class: 'objeto__cant', text: `×${o.cantidad}` }) : null,
      o.equipado ? el('span', { class: 'objeto__marca', text: 'puesto' }) : null,
    ));
  }
}

function usarObjeto(o) {
  if (o.categoria === 'consumible') {
    store.dispatch('inventory/consumir', { idObjeto: o.id });
  } else if (['arma', 'armadura', 'escudo'].includes(o.categoria)) {
    store.dispatch(o.equipado ? 'inventory/desequipar' : 'inventory/equipar', {
      idObjeto: o.id,
      ranura: o.equipado ? Object.keys(ver('inventory.equipado', {}) ?? {})
        .find((r) => ver('inventory.equipado')[r] === o.id) : undefined,
    });
  }

  refrescarTodo();
}

function pintarMapa(caja) {
  const world = sistema('world');
  const destinos = world?.destinos() ?? [];

  const lugar = obtenerLugar(ver('world.ubicacion'));

  caja.append(el('p', { class: 'lugar-actual', text: lugar?.nombre ?? '—' }));

  if (lugar?.descripcion) {
    caja.append(el('p', { class: 'vacio', text: lugar.descripcion }));
  }

  if (!destinos.length) {
    caja.append(el('p', { class: 'vacio', text: 'No hay adónde ir desde aquí.' }));
    return;
  }

  caja.append(el('p', { class: 'sub-eti', text: 'Puedes ir a' }));

  for (const d of destinos) {
    caja.append(el('button', {
      class: 'destino',
      onClick: protegido('viajar', () => viajar(d.refId)),
    },
      el('span', { text: d.nombre }),
      el('span', {
        class: 'destino__dato' + (d.peligro >= 3 ? ' es-peligro' : d.peligro >= 2 ? ' es-aviso' : ''),
        text: `${d.distancia} h`,
      }),
    ));
  }
}

async function viajar(refId) {
  const travel = sistema('travel');
  if (!travel) return;

  const plan = travel.planificar(refId);

  if (!plan.viable) {
    bus.emit('narrative:direct', { texto: plan.motivo, voz: 'system' });
    refrescarTodo();
    return;
  }

  if (plan.sinProvisiones
    && !confirm(`No llevas provisiones para el camino a ${obtenerLugar(refId)?.nombre}. ¿Salir igualmente?`)) {
    return;
  }

  bloquear(true);
  await travel.viajar(refId, { forzar: true });
  bloquear(false);

  refrescarTodo();
}

function pintarMisiones(caja) {
  const quests = sistema('quests');
  const datos = quests?.paraInterfaz() ?? { activas: [], ofrecidas: [] };

  if (!datos.ofrecidas.length && !datos.activas.length) {
    caja.append(el('p', { class: 'vacio', text: 'Nadie te ha encargado nada todavía.' }));
    return;
  }

  for (const m of datos.ofrecidas) {
    caja.append(el('div', { class: 'mision mision--oferta' },
      el('p', { class: 'mision__titulo', text: m.titulo }),
      el('p', { class: 'mision__texto', text: m.resumen }),
      el('button', {
        class: 'btn btn--pequeno',
        onClick: protegido('aceptar misión', () => { quests.aceptar(m.refId); pintarLateral(); }),
        text: 'Aceptar',
      }),
    ));
  }

  for (const m of datos.activas) {
    caja.append(el('div', { class: 'mision' },
      el('p', { class: 'mision__titulo', text: m.titulo }),
      ...m.objetivos.map((o) => el('p', {
        class: 'mision__obj' + (o.hecho ? ' es-hecho' : ''),
        text: (o.hecho ? '✓ ' : '· ') + o.texto,
      })),
    ));
  }
}

function pintarGente(caja) {
  const npcs = sistema('npcs');
  const presentes = npcs?.paraInterfaz() ?? [];

  if (!presentes.length) {
    caja.append(el('p', { class: 'vacio', text: 'No hay nadie cerca.' }));
    return;
  }

  for (const n of presentes) {
    caja.append(el('div', { class: 'persona' },
      el('p', { class: 'persona__nombre', text: n.nombre }),
      el('p', { class: 'persona__rol', text: `${n.rol} · ${n.etiquetaActitud}` }),
      el('button', {
        class: 'btn btn--pequeno',
        onClick: protegido('hablar', () => enviar(`Hablo con ${n.nombre}`)),
        text: 'Hablar',
      }),
    ));
  }
}

/* ── opciones sugeridas ───────────────────────────────────────────────── */

function pintarOpciones() {
  const caja = $('#opciones');
  if (!caja) return;

  vaciar(caja);

  const opciones = ver('narrative.opciones', []) ?? [];

  for (const o of opciones.slice(0, 4)) {
    caja.append(el('button', {
      class: 'opcion',
      onClick: protegido('opción', () => enviar(o.label, o.intent)),
      text: o.label,
    }));
  }
}

/* ── entrada ──────────────────────────────────────────────────────────── */

function bloquear(si) {
  const campo = $('#entrada');
  const boton = $('#enviar');

  if (campo) campo.disabled = si;
  if (boton) boton.disabled = si;

  $('#pensando').hidden = !si;
}

async function enviar(texto, intencion) {
  const campo = $('#entrada');
  const accion = (texto ?? campo?.value ?? '').trim();

  if (!accion) return;
  if (campo) campo.value = '';

  const turns = sistema('turns');
  if (!turns) return;

  bloquear(true);

  try {
    await turns.procesar(accion, { intencionSugerida: intencion });
  } catch (e) {
    avisarFallo('turno', e);
  } finally {
    bloquear(false);
  }

  refrescarTodo();
  $('#entrada')?.focus();
}

/* ── combate ──────────────────────────────────────────────────────────── */

function pintarCombate() {
  const capa = $('#combate');
  if (!capa) return;

  const activo = ver('combat.activo', false);
  capa.hidden = !activo;

  if (!activo) return;

  const manager = sistema('combat');
  const datos = manager?.paraInterfaz();
  if (!datos) return;

  vaciar(capa);

  capa.append(el('p', { class: 'combate__eti', text: `Combate · ronda ${datos.ronda}` }));

  // Retrato del enemigo vivo más amenazante. Si hay varios, manda el de más
  // nivel: es el que decide cómo va el combate y el que conviene mirar.
  const rival = datos.combatientes
    .filter((c) => !c.esJugador && c.vivo)
    .sort((a, b) => (b.nivel ?? 0) - (a.nivel ?? 0))[0];

  if (rival?.refId) {
    const plantilla = obtenerEnemigo(rival.refId);

    if (plantilla) {
      const marco = el('div', { class: 'combate__criatura' });

      // Cuántos quedan en pie de esa misma plantilla: en un combate contra
      // cuatro lobos importa más «×3 en pie» que cualquier otra cifra.
      const enPie = datos.combatientes
        .filter((c) => !c.esJugador && c.vivo && c.refId === rival.refId).length;

      capa.append(el('div', { class: 'combate__rival' },
        marco,
        el('div', { class: 'combate__quien' },
          el('span', { class: 'combate__nombre', text: plantilla.nombre }),
          el('span', {
            class: 'combate__rasgo',
            text: `${plantilla.tipo} · ${plantilla.tamano}`
              + (enPie > 1 ? ` · ${enPie} en pie` : ''),
          }),
        ),
      ));

      pintarCriatura(marco, plantilla);
    }
  }

  const lista = el('div', { class: 'combate__lista' });

  for (const c of datos.combatientes) {
    const frac = Math.round(c.fraccionVida * 100);

    lista.append(el('div', { class: 'luchador' + (c.vivo ? '' : ' es-caido') },
      el('div', { class: 'luchador__fila' },
        el('span', { text: c.nombre }),
        el('span', { class: 'luchador__cond', text: c.condicion }),
      ),
      el('div', { class: 'barra' },
        el('div', {
          class: 'barra__relleno ' + (c.esJugador ? 'barra__relleno--vida' : 'barra__relleno--enemigo'),
          style: `width:${frac}%`,
        }),
      ),
    ));
  }

  capa.append(lista);

  if (manager.esperandoJugador) {
    capa.append(el('div', { class: 'combate__acciones' },
      el('button', { class: 'btn btn--peligro', onClick: protegido('atacar', () => accionCombate('atacar')) }, 'Atacar'),
      el('button', { class: 'btn', onClick: protegido('defender', () => accionCombate('defender')) }, 'Defender'),
      el('button', { class: 'btn btn--fantasma', onClick: protegido('huir', () => accionCombate('huir')) }, 'Huir'),
    ));
  } else {
    capa.append(el('p', { class: 'combate__espera', text: 'El enemigo actúa…' }));
  }
}

async function accionCombate(tipo) {
  const manager = sistema('combat');
  if (!manager?.esperandoJugador) return;

  bloquear(true);
  await manager.accionJugador({ tipo });
  bloquear(false);

  refrescarTodo();
}

/* ═══════════════════════════════════════════════════════════════════════════
   AVISOS
   ═══════════════════════════════════════════════════════════════════════════ */

function avisar(mensaje, tipo = 'info') {
  const caja = $('#avisos');
  if (!caja) return;

  const nodo = el('div', { class: `aviso aviso--${tipo}`, text: mensaje });
  caja.append(nodo);

  setTimeout(() => nodo.remove(), 4200);
}

/* ═══════════════════════════════════════════════════════════════════════════
   ARRANQUE
   ═══════════════════════════════════════════════════════════════════════════ */

function conectarEventos() {
  // Entrada de texto.
  $('#enviar')?.addEventListener('click', protegido('enviar', () => enviar()));

  $('#entrada')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  });

  $('#creacion-empezar')?.addEventListener('click', protegido('empezar', empezarPartida));
  $('#creacion-volver')?.addEventListener('click', protegido('volver', () => mostrar('inicio')));

  $('#guardar')?.addEventListener('click', protegido('guardar', () => {
    const saves = sistema('saves');
    store.fijar('settings.persistencia', true);
    bus.emit('settings:change', { id: 'persistencia', valor: true });

    const r = saves?.guardar('1');
    avisar(r?.exito ? 'Partida guardada' : (r?.motivo ?? 'No se pudo guardar'),
      r?.exito ? 'exito' : 'aviso');
  }));

  // El motor avisa; la interfaz lo muestra.
  bus.on('ui:notice', ({ mensaje, tipo }) => avisar(mensaje, tipo));
  bus.on('achievement:unlocked', ({ nombre }) => avisar(`Hazaña: ${nombre}`, 'exito'));
  bus.on('player:levelup', ({ nivel }) => avisar(`Has subido a nivel ${nivel}`, 'exito'));

  // Cualquier cambio del mundo redibuja lo que corresponda.
  for (const evento of ['combat:start', 'combat:end', 'combat:turn', 'combat:awaiting', 'combat:log']) {
    bus.on(evento, () => { pintarCombate(); pintarBitacora(); });
  }

  bus.on('narrative:direct', () => setTimeout(pintarBitacora, 10));
  bus.on('world:arrived', () => refrescarTodo());
  bus.on('player:defeated', () => avisar('Has caído. La crónica termina aquí.', 'aviso'));
}

/** Retira la pantalla de arranque y muestra el juego. */
function arranqueListo() {
  const capa = document.getElementById('arranque');

  if (capa) {
    capa.hidden = true;
    // El rótulo trae `display:flex` en línea para verse antes que la hoja de
    // estilos, y eso gana a cualquier regla: hay que apagarlo en línea también
    // o se queda tapando el juego con el motor ya en marcha.
    capa.style.display = 'none';
  }

  document.body.classList.add('esta-listo');
}

/** Deja el fallo escrito en la pantalla de arranque, que sí se ve. */
function arranqueFallido(donde, error) {
  const capa = document.getElementById('arranque');
  if (capa) capa.hidden = false;

  const texto = document.getElementById('arranque-texto');
  if (texto) {
    texto.style.color = '#E5A08C';
    texto.textContent = `No se pudo arrancar · ${donde}`;
  }

  // La traza completa, a la vista: es lo que hace falta para arreglarlo.
  const detalle = document.getElementById('arranque-detalle');
  if (detalle) {
    detalle.style.display = 'block';
    detalle.textContent = `${error?.name ?? 'Error'}: ${error?.message ?? error}\n\n`
      + String(error?.stack ?? '(sin traza)').split('\n').slice(0, 8).join('\n');
  }

  avisarFallo(donde, error);
}

async function arrancar() {
  // Si algo se cuelga, a los ocho segundos se dice en pantalla en vez de
  // dejar al jugador mirando un rótulo eterno.
  const vigilante = setTimeout(() => {
    if (!motor.listo) {
      arranqueFallido('tiempo agotado', new Error('el motor tardó demasiado en arrancar'));
    }
  }, 8000);

  try {
    await arrancarMotor();
  } catch (e) {
    clearTimeout(vigilante);
    arranqueFallido('motor', e);
    return;
  }

  clearTimeout(vigilante);

  // Si hay imágenes declaradas en assets/, sustituirán al arte vectorial. No
  // se espera a que termine: sin manifiesto el juego funciona igual, y hacer
  // que el arranque dependa de una petición que casi siempre falla sería
  // pagar un retraso por nada.
  // La ruta es relativa a `app/index.html`, que es el documento que la pide.
  cargarManifiesto('../assets/manifest.json').then((hubo) => {
    if (!hubo) return;

    // Llega después de que la pantalla ya esté pintada, así que hay que
    // repintar la que esté a la vista para que las imágenes releven al vector.
    const pantalla = document.body.getAttribute('data-active-screen');

    if (pantalla === 'creacion') pintarCreacion();
    else if (pantalla === 'juego') refrescarTodo();
  });

  try {
    conectarEventos();
    pintarInicio();
    mostrar('inicio');
    arranqueListo();
  } catch (e) {
    // Aunque la interfaz falle, la pantalla se descubre: es mejor ver el
    // error que un vacío.
    arranqueListo();
    arranqueFallido('interfaz', e);
  }

  // Para inspeccionar desde la consola del navegador.
  window.ARCANUM = {
    motor, store, bus, ver,
    sistema,
    jugar: (t) => enviar(t),
    inspeccionar: (n) => (n ? sistema(n)?.inspeccionar?.() : motor.registry?.inspeccionar?.()),
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar);
} else {
  arrancar();
}
