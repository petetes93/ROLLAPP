/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · app/app.js
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

import { fichaAleatoria } from '../src/player/CharacterRandom.js';
import {
  listarPersonajes, obtenerPersonaje, guardarPersonaje,
} from '../src/persistence/CharacterRoster.js';
import { RAZAS } from '../src/data/races.data.js';
import { CLASES } from '../src/data/classes.data.js';
import { TRASFONDOS } from '../src/data/backgrounds.data.js';
import { obtenerLugar } from '../src/data/locations.data.js';
import * as Comb from '../src/combat/Combatant.js';
import { PROVEEDORES } from '../src/config/ai.config.js';
import {
  rodarDado, numeroDano, sacudir, destello, rotuloMomento,
} from './efectos.js';

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

/** Señala que una pieza procedural se está recomponiendo, sin bloquear la UI. */
function animarGeneracion(nodo, etiqueta = 'Tejiendo rasgos') {
  if (!nodo) return;
  nodo.dataset.generando = etiqueta;
  nodo.classList.remove('se-esta-generando');
  void nodo.offsetWidth;
  nodo.classList.add('se-esta-generando');
  clearTimeout(nodo._finGeneracion);
  nodo._finGeneracion = setTimeout(() => nodo.classList.remove('se-esta-generando'), 720);
}

/** Muestra un fallo en pantalla en vez de dejar la página muda. */
function avisarFallo(donde, error) {
  console.error('[arcanveil] ' + donde, error);

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

  const activa = document.querySelector(`section[data-pantalla="${pantalla}"]`);
  if (activa) {
    activa.classList.remove('pantalla-entrando');
    void activa.offsetWidth;
    activa.classList.add('pantalla-entrando');
  }
}

/* ── inicio ───────────────────────────────────────────────────────────── */

/**
 * Pantalla de título, como la de cualquier videojuego: Continuar solo se
 * enciende si hay algo que continuar.
 */
function pintarInicio() {
  const saves = sistema('saves');
  const reciente = partidaMasReciente();

  const caja = $('#inicio-acciones');
  vaciar(caja);

  caja.append(
    el('button', {
      class: 'btn btn--grande menu-btn', id: 'menu-continuar',
      disabled: reciente ? null : 'disabled',
      title: reciente ? `${reciente.cabecera?.nombre ?? ''} · nivel ${reciente.cabecera?.nivel ?? 1}` : 'Aún no hay partidas guardadas',
      onClick: protegido('continuar', () => continuar()),
    },
      el('span', { text: 'Continuar' }),
      reciente ? el('small', { class: 'menu-btn__nota', text: `${reciente.cabecera?.nombre ?? ''} · ${reciente.cabecera?.lugar ?? ''}` }) : null,
    ),
    el('button', {
      class: 'btn menu-btn', id: 'menu-nueva',
      onClick: protegido('nueva partida', () => abrirNuevaPartida()),
    }, 'Nueva partida'),
    el('button', {
      class: 'btn menu-btn', id: 'menu-cargar',
      disabled: saves && partidasGuardadas().length ? null : 'disabled',
      onClick: protegido('cargar', () => { mostrar('cargar'); pintarCargar(); }),
    }, 'Cargar'),
    el('button', {
      class: 'btn btn--fantasma menu-btn', id: 'menu-ajustes',
      onClick: protegido('ajustes', () => abrirAjustes()),
    }, 'Ajustes'),
  );
}

/* ── partidas guardadas ───────────────────────────────────────────────── */

/** Clave de la preferencia que recuerda que el jugador quiso guardar. */
const CLAVE_PERSISTENCIA = 'arcanveil:prefs:persistencia';

/**
 * Enciende el guardado en el navegador. Se llama al empezar una partida: quien
 * pulsa «Nueva partida» en un juego con «Continuar» está pidiendo que se
 * recuerde. El autoguardado propio del motor se apaga porque aquí cada
 * partida tiene su ranura y se guarda al final de cada turno.
 */
function activarPersistencia() {
  try { localStorage.setItem(CLAVE_PERSISTENCIA, '1'); } catch { /* modo privado */ }
  store.fijar('settings.persistencia', true);
  store.fijar('settings.autoguardado', false);
  bus.emit('settings:change', { id: 'persistencia', valor: true });
}

/** Al arrancar: si antes se guardó algo, se vuelve a poder leer y guardar. */
function recuperarPersistencia() {
  let recordada = false;
  try {
    recordada = localStorage.getItem(CLAVE_PERSISTENCIA) === '1'
      || Object.keys(localStorage).some((k) => k.startsWith('arcanveil:partida:'));
  } catch { /* sin almacenamiento */ }
  if (recordada) activarPersistencia();
}

function partidasGuardadas() {
  return (sistema('saves')?.listar?.() ?? [])
    .filter((r) => !r.vacia && r.abrible !== false)
    .sort((a, b) => (b.guardadoEn ?? 0) - (a.guardadoEn ?? 0));
}

function partidaMasReciente() {
  return partidasGuardadas()[0] ?? null;
}

/** Primera ranura libre; si no queda ninguna, la más antigua. */
function ranuraParaPartidaNueva() {
  const todas = (sistema('saves')?.listar?.() ?? []).filter((r) => !r.automatica);
  const libre = todas.find((r) => r.vacia);
  if (libre) return libre.ranura;
  return [...todas].sort((a, b) => (a.guardadoEn ?? 0) - (b.guardadoEn ?? 0))[0]?.ranura ?? '1';
}

/** Guarda la partida en curso en su ranura, sin avisos. */
function guardarPartidaActual({ silencioso = true } = {}) {
  if (!ver('player.raza')) return null;
  const ranura = ver('meta.ranura') ?? ranuraParaPartidaNueva();
  store.fijar('meta.ranura', ranura);
  return sistema('saves')?.guardar(ranura, { silencioso, nota: 'crónica' }) ?? null;
}

function cargarRanura(ranura) {
  const r = sistema('saves').cargar(ranura);
  if (!r.exito) {
    avisarFallo('cargar partida', new Error(r.motivo));
    return;
  }
  store.fijar('meta.ranura', ranura);
  mostrar('juego');
  refrescarTodo();
  bitacoraSinAnimar();
  programarSugerencias();
}

function continuar() {
  const reciente = partidaMasReciente();
  if (reciente) cargarRanura(reciente.ranura);
}

function pintarCargar() {
  const caja = $('#cargar-lista');
  vaciar(caja);

  const partidas = partidasGuardadas();
  if (!partidas.length) {
    caja.append(el('p', { class: 'cargar__vacio', text: 'No hay partidas guardadas todavía.' }));
    return;
  }

  for (const p of partidas) {
    const c = p.cabecera ?? {};
    const cara = el('div', { class: 'tarjeta-pj__cara' });
    const fecha = p.guardadoEn ? new Date(p.guardadoEn).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }) : '';

    caja.append(el('div', { class: 'tarjeta-pj tarjeta-pj--partida' },
      el('button', {
        class: 'tarjeta-pj__abrir', dataset: { ranura: p.ranura },
        onClick: protegido('cargar partida', () => cargarRanura(p.ranura)),
      },
        cara,
        el('span', { class: 'tarjeta-pj__texto' },
          el('strong', { class: 'tarjeta-pj__nombre', text: c.nombre ?? 'Sin nombre' }),
          el('span', { class: 'tarjeta-pj__dato', text: `Nivel ${c.nivel ?? 1} · ${RAZAS[c.raza]?.nombre ?? ''} · ${CLASES[c.clase]?.nombre ?? ''}` }),
          el('span', { class: 'tarjeta-pj__dato tarjeta-pj__dato--tenue', text: `${c.lugar ?? ''} · día ${c.dia ?? 1} · ${fecha}` }),
        ),
      ),
      el('button', {
        class: 'btn btn--pequeno btn--peligro tarjeta-pj__borrar', title: 'Borrar esta partida',
        onClick: protegido('borrar partida', () => {
          if (!confirm(`¿Borrar la partida de ${c.nombre ?? 'este personaje'}? No se puede deshacer.`)) return;
          sistema('saves').borrar(p.ranura);
          pintarCargar();
          pintarInicio();
        }),
      }, 'Borrar'),
    ));

    pintarRetrato(cara, { raza: c.raza, nombre: c.nombre, descripcion: c.retrato });
  }
}

/* ── nueva partida: personajes ────────────────────────────────────────── */

/**
 * Si ya existe algún personaje, «Nueva partida» lo ofrece a nivel 1 con un
 * botón para crear otro. Si no, va directo al generador.
 */
function abrirNuevaPartida() {
  if (!listarPersonajes().length) {
    abrirCreacion();
    return;
  }
  mostrar('personajes');
  pintarPersonajes(null);
}

function pintarPersonajes(elegidoId) {
  const caja = $('#personajes-lista');
  const pie = $('#personajes-pie');
  vaciar(caja);
  vaciar(pie);

  const personajes = listarPersonajes();
  const elegido = personajes.find((p) => p.id === elegidoId) ?? null;

  // Con un personaje elegido solo queda él y «Comenzar partida».
  for (const p of elegido ? [elegido] : personajes) {
    const cara = el('div', { class: 'tarjeta-pj__cara' });
    caja.append(el('button', {
      class: 'tarjeta-pj' + (elegido ? ' es-elegida' : ''),
      dataset: { personaje: p.id },
      onClick: protegido('elegir personaje', () => pintarPersonajes(elegido ? null : p.id)),
    },
      cara,
      el('span', { class: 'tarjeta-pj__texto' },
        el('strong', { class: 'tarjeta-pj__nombre', text: p.nombre }),
        el('span', { class: 'tarjeta-pj__dato', text: `Nivel 1 · ${RAZAS[p.raza]?.nombre ?? ''} · ${CLASES[p.clase]?.nombre ?? ''}` }),
        elegido && p.lore ? el('span', { class: 'tarjeta-pj__lore', text: p.lore.slice(0, 220) + (p.lore.length > 220 ? '…' : '') }) : null,
      ),
    ));
    pintarRetrato(cara, { raza: p.raza, nombre: p.nombre, descripcion: p.retrato });
  }

  if (elegido) {
    pie.append(
      el('button', { class: 'btn btn--fantasma', id: 'personajes-otro', onClick: () => pintarPersonajes(null) }, 'Elegir otro'),
      el('button', {
        class: 'btn btn--grande', id: 'personajes-comenzar',
        onClick: protegido('comenzar partida', () => comenzarPartida(elegido)),
      }, 'Comenzar partida'),
    );
  } else {
    pie.append(
      el('button', { class: 'btn btn--fantasma', onClick: () => mostrar('inicio') }, 'Atrás'),
      el('button', {
        class: 'btn', id: 'personajes-nuevo',
        onClick: protegido('nuevo personaje', () => abrirCreacion()),
      }, 'Nuevo personaje'),
    );
  }
}

/* ── creación: generador aleatorio ────────────────────────────────────── */

const borrador = {
  nombre: '', raza: 'valdes', clase: 'rastreador', trasfondo: 'errante',
  genero: 'm', retrato: '', lore: '',
};

/** Personaje recién creado que se enseña con su ilustración. */
let personajeCreado = null;

function tirarFicha() {
  Object.assign(borrador, fichaAleatoria());
}

function abrirCreacion() {
  personajeCreado = null;
  tirarFicha();
  borrador.retrato = '';
  borrador.lore = '';
  mostrar('creacion');
  pintarCreacion();
}

/**
 * Primer paso: ficha al azar y los tres textos del jugador. Aquí no hay
 * retrato a propósito: la ilustración llega cuando el jugador envía su
 * descripción, no antes.
 */
function pintarCreacion() {
  const caja = $('#creacion-cuerpo');
  vaciar(caja);
  $('#creacion-titulo').textContent = '¿Quién eres?';
  $('#creacion-nota').textContent = 'Tira los dados hasta que te guste el origen. Después escribe quién eres: tu descripción será el encargo para la ilustración.';

  caja.append(el('div', { class: 'aleatoria', id: 'ficha-aleatoria' }));
  pintarFichaAleatoria();

  caja.append(
    el('div', { class: 'campo' },
      el('label', { class: 'campo__eti', for: 'nombre', text: 'Nombre' }),
      el('input', {
        id: 'nombre', class: 'campo__entrada', type: 'text',
        maxlength: '28', value: borrador.nombre, autocomplete: 'off',
        onInput: (e) => { borrador.nombre = e.target.value; },
      }),
    ),
    el('div', { class: 'campo retrato-descripcion' },
      el('label', { class: 'campo__eti', for: 'retrato-descripcion', text: 'Descripción' }),
      el('textarea', {
        id: 'retrato-descripcion', class: 'campo__entrada campo__entrada--retrato',
        placeholder: 'Ej.: exploradora de pelo plateado, cicatriz en la ceja, capa violeta y brújula de bronce…',
        maxlength: '360', value: borrador.retrato,
        onInput: (e) => { borrador.retrato = e.target.value; },
      }),
      el('p', { class: 'campo__ayuda', text: 'Es lo que la IA pintará. Aspecto, ropa, rasgos, gesto.' }),
    ),
    el('div', { class: 'campo lore-personaje' },
      el('label', { class: 'campo__eti', for: 'lore-personaje', text: 'Historia' }),
      el('textarea', {
        id: 'lore-personaje', class: 'campo__entrada campo__entrada--retrato campo__entrada--lore',
        placeholder: 'Ej.: crecí junto al Umbral, mi hermana desapareció tras cruzarlo y llevo su medallón. Quiero encontrarla, aunque tema lo que haya al otro lado…',
        maxlength: '1200', value: borrador.lore,
        onInput: (e) => { borrador.lore = e.target.value; },
      }),
      el('p', { class: 'campo__ayuda', text: 'El máster convertirá personas, promesas, lugares y conflictos de esta historia en la campaña.' }),
    ),
  );

  const pie = $('#creacion-pie');
  vaciar(pie);
  pie.append(
    el('button', { class: 'btn btn--fantasma', id: 'creacion-volver', onClick: protegido('volver', () => (listarPersonajes().length ? abrirNuevaPartida() : mostrar('inicio'))) }, 'Atrás'),
    el('button', { class: 'btn btn--grande', id: 'creacion-crear', onClick: protegido('crear personaje', crearPersonajeNuevo) }, 'Crear personaje'),
  );
}

function pintarFichaAleatoria() {
  const caja = $('#ficha-aleatoria');
  if (!caja) return;
  vaciar(caja);

  const raza = RAZAS[borrador.raza];
  const clase = CLASES[borrador.clase];
  const fondo = TRASFONDOS[borrador.trasfondo];
  const inicio = obtenerLugar(LUGAR_INICIAL[borrador.raza] ?? 'vado_yunque');

  caja.append(
    el('div', { class: 'aleatoria__cab' },
      el('p', { class: 'aleatoria__eti', text: 'Tu origen' }),
      el('button', {
        class: 'btn aleatoria__dado', id: 'creacion-aleatorio', type: 'button', title: 'Volver a tirar',
        onClick: protegido('aleatorio', () => {
          const nombreAnterior = borrador.nombre;
          tirarFicha();
          const campo = $('#nombre');
          // El nombre también se tira, salvo que el jugador ya haya escrito el suyo.
          if (campo && campo.value && campo.value !== nombreAnterior) borrador.nombre = campo.value;
          else if (campo) campo.value = borrador.nombre;
          pintarFichaAleatoria();
          caja.classList.remove('se-tira'); void caja.offsetWidth; caja.classList.add('se-tira');
        }),
      }, el('span', { class: 'aleatoria__glifo', text: '⚄' }), ' Aleatorio'),
    ),
    el('div', { class: 'aleatoria__rasgos' },
      el('div', { class: 'aleatoria__rasgo' }, el('small', { text: 'Linaje' }), el('strong', { id: 'aleatoria-raza', text: raza?.nombre ?? '' }), el('span', { text: raza?.lema ?? '' })),
      el('div', { class: 'aleatoria__rasgo' }, el('small', { text: 'Oficio' }), el('strong', { text: clase?.nombre ?? '' }), el('span', { text: clase?.lema ?? (clase?.descripcion ?? '').slice(0, 80) })),
      el('div', { class: 'aleatoria__rasgo' }, el('small', { text: 'Pasado' }), el('strong', { text: fondo?.nombre ?? '' }), el('span', { text: fondo?.lema ?? (fondo?.descripcion ?? '').slice(0, 80) })),
    ),
    inicio ? el('p', { class: 'aleatoria__inicio', text: `Empiezas en ${inicio.nombre}.` }) : null,
  );
}

const LUGAR_INICIAL = {
  ferrano: 'forja_alta', brumal: 'pilotes_brumal', sombracorteza: 'arboleda_madre',
  crisol: 'oasis_sal', albar: 'umbral_albar', griscuerno: 'paso_yunque',
  valdes: 'vado_yunque', menudo: 'saucedo',
};

/**
 * Segundo paso: el personaje queda creado y la IA pinta su ilustración a
 * partir de la descripción. Si el generador local no está encendido, el
 * retrato procedural ocupa su lugar y el juego sigue igual.
 */
function crearPersonajeNuevo() {
  const nombre = ($('#nombre')?.value ?? '').trim();
  const descripcion = ($('#retrato-descripcion')?.value ?? '').trim();
  const lore = ($('#lore-personaje')?.value ?? '').trim();

  const faltan = [];
  if (!nombre) faltan.push(['#nombre', 'Ponle nombre al personaje.']);
  if (descripcion.length < 8) faltan.push(['#retrato-descripcion', 'Describe su aspecto: es lo que pintará la IA.']);
  if (lore.length < 8) faltan.push(['#lore-personaje', 'Cuenta un poco de su historia.']);
  if (faltan.length) {
    $(faltan[0][0])?.focus();
    avisar(faltan[0][1], 'aviso');
    return;
  }

  personajeCreado = guardarPersonaje({ ...borrador, nombre, retrato: descripcion, lore });
  pintarRevelacion(personajeCreado);
}

function pintarRevelacion(p) {
  const caja = $('#creacion-cuerpo');
  vaciar(caja);
  $('#creacion-titulo').textContent = p.nombre;
  $('#creacion-nota').textContent = `${RAZAS[p.raza]?.nombre ?? ''} · ${CLASES[p.clase]?.nombre ?? ''} · ${TRASFONDOS[p.trasfondo]?.nombre ?? ''} · nivel 1`;

  const cara = el('div', { class: 'eleccion__cara revelacion__cara', id: 'creacion-cara' });
  const estado = el('p', { class: 'revelacion__estado', id: 'retrato-estado', text: 'La IA está pintando tu retrato…' });

  caja.append(el('div', { class: 'revelacion' },
    el('div', { class: 'revelacion__marco' }, cara, estado),
    el('div', { class: 'revelacion__texto' },
      el('p', { class: 'revelacion__eti', text: 'Descripción' }),
      el('p', { class: 'revelacion__cita', text: p.retrato }),
      el('p', { class: 'revelacion__eti', text: 'Historia' }),
      el('p', { class: 'revelacion__cita', text: p.lore }),
    ),
  ));

  // Dos generadores compiten por el mismo hueco: el puente local, que casi
  // nunca está encendido, y el remoto, que no necesita instalar nada. El
  // rótulo cuenta lo mejor que haya pasado, no lo último que pasó: si el
  // remoto pintó el retrato, da igual que el local esté apagado, y decir
  // «generador apagado» debajo de una imagen recién pintada era mentira.
  const ROTULOS = {
    generando: 'La IA está pintando tu retrato…',
    listo: 'Retrato pintado por la IA a partir de tu descripción.',
    ausente: 'Sin generador disponible: se muestra el retrato procedural.',
    'sin-red': 'Sin generador disponible: se muestra el retrato procedural.',
  };

  let logrado = false;

  const contar = (e) => {
    const es = e.detail?.estado ?? '';

    if (es === 'listo') logrado = true;
    else if (logrado) return;          // ya hay retrato: nada lo desmiente

    if (ROTULOS[es]) estado.textContent = ROTULOS[es];
    estado.dataset.estado = es;
  };

  cara.addEventListener('retrato-local', contar);
  cara.addEventListener('retrato-ia', contar);

  animarGeneracion(cara, 'Pintando retrato');
  pintarRetrato(cara, { raza: p.raza, nombre: p.nombre, descripcion: p.retrato, inmediato: true });

  const pie = $('#creacion-pie');
  vaciar(pie);
  pie.append(
    el('button', { class: 'btn btn--fantasma', id: 'creacion-otro', onClick: protegido('nuevo personaje', () => abrirCreacion()) }, 'Crear otro'),
    el('button', { class: 'btn btn--grande', id: 'creacion-empezar', onClick: protegido('comenzar partida', () => comenzarPartida(p)) }, 'Comenzar partida'),
  );
}

/**
 * Empieza una crónica nueva con un personaje del plantel, siempre a nivel 1.
 *
 * Si en esta sesión ya se jugó otra partida, se recarga la página antes: los
 * sistemas guardan estado propio (mundo, memoria del máster, eventos) y
 * empezar limpio es la única forma segura de no heredar nada de la anterior.
 */
async function comenzarPartida(p) {
  if (ver('player.raza')) {
    try { sessionStorage.setItem('arcanveil:comenzar', p.id); } catch { /* sin sesión */ }
    guardarPartidaActual();
    location.reload();
    return;
  }

  activarPersistencia();
  store.fijar('meta.ranura', ranuraParaPartidaNueva());
  store.fijar('meta.personajeId', p.id);

  store.dispatch('player/crear', {
    borrador: {
      nombre: p.nombre, raza: p.raza, clase: p.clase, trasfondo: p.trasfondo,
      retrato: p.retrato ?? '', lore: p.lore ?? '',
    },
  });

  await new Promise((r) => setTimeout(r, 0));

  mostrar('juego');
  refrescarTodo();

  const turns = sistema('turns');
  await turns?.abrirCronica?.();

  refrescarTodo();
  guardarPartidaActual();
  programarSugerencias();
}

/** Tras la recarga de `comenzarPartida`, arranca directamente la crónica. */
function comenzarPendiente() {
  let id = null;
  try { id = sessionStorage.getItem('arcanveil:comenzar'); sessionStorage.removeItem('arcanveil:comenzar'); } catch { /* sin sesión */ }
  const p = id ? obtenerPersonaje(id) : null;
  if (!p) return false;
  comenzarPartida(p);
  return true;
}

/* ── ajustes ──────────────────────────────────────────────────────────── */

const AJUSTES_DEFECTO = { velocidadTexto: 'normal', esperaSugerencias: 7 };

function leerAjustes() {
  try { return { ...AJUSTES_DEFECTO, ...JSON.parse(localStorage.getItem('arcanveil:prefs:juego') ?? '{}') }; } catch { return { ...AJUSTES_DEFECTO }; }
}

function guardarAjustes(cambios) {
  const nuevos = { ...leerAjustes(), ...cambios };
  try { localStorage.setItem('arcanveil:prefs:juego', JSON.stringify(nuevos)); } catch { /* sin almacenamiento */ }
  return nuevos;
}

function abrirAjustes() {
  const a = leerAjustes();
  const caja = $('#ajustes-cuerpo');
  vaciar(caja);

  const grupo = (titulo, clave, opciones) => el('div', { class: 'ajuste' },
    el('p', { class: 'sub-eti', text: titulo }),
    el('div', { class: 'ajuste__opciones' }, ...opciones.map(([valor, eti]) => el('button', {
      class: 'ficha ajuste__opcion' + (String(a[clave]) === String(valor) ? ' es-elegida' : ''),
      dataset: { ajuste: clave, valor: String(valor) },
      onClick: () => { guardarAjustes({ [clave]: valor }); abrirAjustes(); },
    }, eti))),
  );

  caja.append(
    grupo('Aparición del texto', 'velocidadTexto', [['lenta', 'Pausada'], ['normal', 'Normal'], ['rapida', 'Rápida'], ['instantanea', 'Instantánea']]),
    grupo('Sugerencias si no escribes', 'esperaSugerencias', [[5, 'A los 5 s'], [7, 'A los 7 s'], [10, 'A los 10 s'], [0, 'Nunca']]),
    el('div', { class: 'ajuste' },
      el('p', { class: 'sub-eti', text: 'Máster' }),
      el('button', { class: 'btn', onClick: () => { $('#ajustes-modal').hidden = true; abrirNarrador(); } }, 'Elegir narrador e IA'),
    ),
    el('div', { class: 'ajuste' },
      el('p', { class: 'sub-eti', text: 'Datos' }),
      el('button', {
        class: 'btn btn--peligro',
        onClick: protegido('borrar datos', () => {
          if (!confirm('¿Borrar todas las partidas y personajes guardados en este navegador?')) return;
          sistema('saves')?.borrarTodo?.();
          try { Object.keys(localStorage).filter((k) => k.startsWith('arcanveil:')).forEach((k) => localStorage.removeItem(k)); } catch { /* nada */ }
          $('#ajustes-modal').hidden = true;
          pintarInicio();
        }),
      }, 'Borrar partidas y personajes'),
    ),
  );

  $('#ajustes-modal').hidden = false;
}

function abrirNarrador() {
  pintarDirectores();
  $('#ia-url').value = ver('settings.urlLocal', 'http://127.0.0.1:11435');
  $('#ia-modelo').value = ver('settings.modeloLocal', 'gemini-3.5-flash');
  $('#director-modal').hidden = false;
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
  // Las entradas de región son ilustraciones clave. El resto del viaje usa
  // paisaje 100% procedural; en estas seis, el raster recibe encima la misma
  // hora, clima y partículas del mundo vivo.
  const hitosRegion = new Set([
    'vado_yunque', 'arboleda_madre', 'forja_alta',
    'pilotes_brumal', 'umbral_albar', 'oasis_sal',
  ]);
  const momentoClave = hitosRegion.has(lugar.refId);

  pintarLugar($('#escena-lienzo'), lugar, { franja: t.franja, clima, momentoClave });

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

/* ── sugerencias ──────────────────────────────────────────────────────── */

/**
 * La interfaz base es una caja de texto libre. Las sugerencias solo aparecen
 * si el jugador lleva unos segundos sin escribir, en un pop-up discreto con
 * tres frases que encajan con lo que está pasando.
 */
let temporizadorSugerencias = null;

function ocultarSugerencias() {
  clearTimeout(temporizadorSugerencias);
  const capa = $('#sugerencias');
  if (capa) capa.hidden = true;
}

function programarSugerencias() {
  ocultarSugerencias();
  const espera = Number(leerAjustes().esperaSugerencias) || 0;
  if (!espera) return;
  temporizadorSugerencias = setTimeout(mostrarSugerencias, espera * 1000);
}

function mostrarSugerencias() {
  const capa = $('#sugerencias');
  const campo = $('#entrada');
  if (!capa || document.body.dataset.activeScreen !== 'juego') return;
  // Si el jugador escribe o pelea, no se le interrumpe. Si el máster aún
  // narra, se espera a que termine y se vuelve a mirar.
  if (campo?.value.trim() || ver('combat.activo', false)) return;
  if (campo?.disabled || escribiendo) {
    temporizadorSugerencias = setTimeout(mostrarSugerencias, 1000);
    return;
  }

  const opciones = (ver('narrative.opciones', []) ?? []).slice(0, 3);
  if (!opciones.length) return;

  const lista = $('#sugerencias-lista');
  vaciar(lista);
  for (const o of opciones) {
    lista.append(el('button', {
      class: 'sugerencia',
      dataset: { intent: String(o.intent ?? o.intencion ?? 'accion').toLowerCase() },
      onClick: protegido('sugerencia', () => enviar(o.label, o.intent)),
    }, o.label));
  }
  capa.hidden = false;
}

/* Compatibilidad: el motor sigue llamando a pintarOpciones al refrescar. */
function pintarOpciones() {
  const caja = $('#opciones');
  if (caja) { vaciar(caja); caja.hidden = true; }
}

/* ── aparición del texto ──────────────────────────────────────────────── */

/** Caracteres por segundo de cada velocidad. */
const VELOCIDADES = { lenta: 40, normal: 85, rapida: 170, instantanea: Infinity };

/** Entradas de la bitácora que ya se han enseñado enteras. */
let entradasVistas = 0;
let firmaBitacora = '';

/**
 * Id de la última tirada cuyo dado ya rodó.
 *
 * La bitácora se repinta entera en cada refresco, así que sin recordar esto
 * los dados ya vistos volverían a rodar turno tras turno.
 */
let ultimaTiradaAnimada = null;
/** Cola de párrafos pendientes de escribirse. */
const colaEscritura = [];
let escribiendo = false;

/** Al cargar una partida, lo ya jugado aparece entero, sin efecto. */
function bitacoraSinAnimar() {
  entradasVistas = (ver('narrative.entradas', []) ?? []).length;
  firmaBitacora = '';
  colaEscritura.length = 0;
  pintarBitacora();
}

/** Termina de golpe todo lo que se estaba escribiendo. */
function completarEscritura() {
  for (const t of colaEscritura.splice(0)) t.nodo.textContent = t.texto;
  escribiendo = false;
  const caja = $('#bitacora');
  if (caja) caja.scrollTop = caja.scrollHeight;
}

function escribirSiguiente() {
  const tarea = colaEscritura[0];
  const caja = $('#bitacora');
  if (!tarea) { escribiendo = false; programarSugerencias(); return; }

  escribiendo = true;
  const cps = VELOCIDADES[leerAjustes().velocidadTexto] ?? VELOCIDADES.normal;
  if (!Number.isFinite(cps) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
    completarEscritura();
    programarSugerencias();
    return;
  }

  const inicio = performance.now();
  tarea.nodo.classList.add('se-escribe');
  const paso = (ahora) => {
    if (colaEscritura[0] !== tarea) return;          // se completó de golpe
    const n = Math.min(tarea.texto.length, Math.floor(((ahora - inicio) / 1000) * cps) + 1);
    tarea.nodo.textContent = tarea.texto.slice(0, n);
    if (caja) caja.scrollTop = caja.scrollHeight;
    if (n < tarea.texto.length) { requestAnimationFrame(paso); return; }
    tarea.nodo.classList.remove('se-escribe');
    colaEscritura.shift();
    setTimeout(escribirSiguiente, 140);
  };
  requestAnimationFrame(paso);
}

/* ── bitácora ─────────────────────────────────────────────────────────── */

function pintarBitacora() {
  const caja = $('#bitacora');
  if (!caja) return;

  const entradas = ver('narrative.entradas', []) ?? [];

  // Refrescar sin cambios no repinta: así no se corta lo que se está escribiendo.
  const firma = `${entradas.length}|${entradas.at(-1)?.texto ?? ''}`;
  if (firma === firmaBitacora) return;
  firmaBitacora = firma;

  // Lo que se estaba escribiendo se da por leído antes de repintar.
  if (colaEscritura.length) completarEscritura();
  vaciar(caja);
  const primeraNueva = Math.max(0, entradas.length - 60);

  const visibles = entradas.slice(-60);
  const desdeReciente = Math.max(0, visibles.length - 3);

  for (const [indice, e] of visibles.entries()) {
    // El motor etiqueta esta voz como `roll`, no como `tirada`. Al buscar solo
    // `tirada` no coincidía nunca y las fichas de dados NO SE DIBUJABAN: el
    // juego resolvía las tiradas y no enseñaba ni una, que es justo lo que el
    // proyecto promete («el motor tira los dados y el director narra lo que ya
    // está decidido»). Se aceptan los dos nombres para no depender de cuál
    // emita cada sistema.
    if (e.voz === 'roll' || e.voz === 'tirada') {
      // El dado solo rueda para la tirada que acaba de ocurrir, y una sola
      // vez. La bitácora se repinta entera en cada refresco: sin este
      // candado, cada turno harían rodar de nuevo todos los dados visibles.
      const esNueva = Boolean(e.id) && e.id !== ultimaTiradaAnimada;

      const ficha = fichaTirada(e.meta?.tirada, {
        animar: esNueva && indice >= desdeReciente,
      });

      if (esNueva && indice >= desdeReciente) ultimaTiradaAnimada = e.id;

      if (indice >= desdeReciente) ficha.classList.add('es-reciente');
      caja.append(ficha);
      continue;
    }

    // Mismo desajuste con la voz del jugador: el motor dice `player` y aquí
    // solo estaba `jugador`, así que sus líneas perdían su estilo y salían
    // como texto corriente, indistinguibles de la narración.
    const clase = {
      dm: 'linea linea--dm',
      player: 'linea linea--jugador',
      jugador: 'linea linea--jugador',
      system: 'linea linea--sistema',
      sistema: 'linea linea--sistema',
      combat: 'linea linea--combate',
      combate: 'linea linea--combate',
    }[e.voz] ?? 'linea';

    // Solo la voz del máster se escribe; la acción del jugador aparece ya.
    const esNueva = primeraNueva + indice >= entradasVistas;
    const seEscribe = esNueva && (e.voz === 'dm' || e.voz === 'narrador');

    for (const parrafo of String(e.texto ?? '').split('\n')) {
      if (!parrafo.trim()) continue;
      const nodo = el('p', { class: clase + (indice >= desdeReciente ? ' es-reciente' : ''), text: seEscribe ? '' : parrafo });
      caja.append(nodo);
      if (seEscribe) colaEscritura.push({ nodo, texto: parrafo });
    }
  }

  entradasVistas = entradas.length;
  caja.scrollTop = caja.scrollHeight;
  if (colaEscritura.length && !escribiendo) escribirSiguiente();
}

function fichaTirada(t, { animar = false } = {}) {
  if (!t) return el('span');

  const clase = t.pifia ? 'pifia' : t.critico ? 'critico' : t.exito ? 'exito' : 'fracaso';
  const etiqueta = t.pifia ? 'pifia' : t.critico ? 'crítico' : t.exito ? 'éxito' : 'fracaso';

  const dado = el('span', { class: 'tirada__dado', text: `d20 ${t.natural}` });

  const ficha = el('div', { class: `tirada tirada--${clase}` },
    dado,
    el('span', { class: 'tirada__cuenta', text: `${t.total} vs ${t.umbral}` }),
    el('span', { class: 'tirada__veredicto', text: etiqueta }),
    t.nombreHabilidad ? el('span', { class: 'tirada__hab', text: t.nombreHabilidad }) : null,
  );

  // Solo rueda la tirada recién ocurrida. Repintar la bitácora vuelve a crear
  // las fichas viejas, y verlas rodar todas de golpe cada turno sería absurdo.
  if (animar) {
    rodarDado(dado, t.natural, () => {
      // El crítico y la pifia son los dos momentos en que la tirada deja de
      // ser un trámite. Se subrayan al asentarse el dado, no antes.
      if (t.critico) sacudir(ficha, 'suave');
      if (t.pifia) sacudir(ficha, 'fuerte');
    });
  }

  return ficha;
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
    el('span', { class: 'cab__lugar', text: j.nombre ?? 'ARCANVEIL' }),
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
  pintarRetrato($('#retrato-pj'), { raza: j.raza, nombre: j.nombre, descripcion: j.retrato });

  caja.append(
    el('div', { class: 'ficha-pj' },
      el('span', { class: 'ficha-pj__nombre', text: j.nombre ?? '—' }),
      el('span', { class: 'ficha-pj__clase', text: `nivel ${j.nivel ?? 1}` }),
    ),
  );

  const atributos = j.atributos ?? {};
  const nombresAtributo = { fuerza:'FUE', destreza:'DES', constitucion:'CON', inteligencia:'INT', sabiduria:'SAB', carisma:'CAR' };
  caja.append(el('div', { class: 'medallones-atributos' },
    ...Object.entries(nombresAtributo).map(([clave, eti]) => {
      const valor = atributos[clave] ?? 10;
      const mod = Math.floor((valor - 10) / 2);
      return el('div', { class: 'medallon-atributo' },
        el('span', { class: 'medallon-atributo__eti', text: eti }),
        el('strong', { text: String(valor) }),
        el('span', { class: 'medallon-atributo__mod', text: mod >= 0 ? `+${mod}` : String(mod) }),
      );
    }),
  ));

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
let mercaderActivo = null;

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
      el('p', { class: 'mision__recompensa', text: `${m.recompensa?.xp ?? 0} XP · ${m.recompensa?.oro ?? 0} oro` }),
      m.objetivos.every((o) => o.hecho) ? el('button', {
        class: 'btn btn--pequeno', text: 'Entregar encargo',
        onClick: protegido('entregar misión', () => {
          const r = quests.completar(m.refId);
          avisar(r.aplicada ? 'Encargo completado' : r.motivo, r.aplicada ? 'exito' : 'aviso');
          refrescarTodo();
        }),
      }) : null,
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
      el('div', { class: 'persona__acciones' },
        el('button', {
          class: 'btn btn--pequeno',
          onClick: protegido('hablar', () => enviar(`Hablo con ${n.nombre}`)),
          text: 'Hablar',
        }),
        n.esMercader ? el('button', {
          class: 'btn btn--pequeno',
          onClick: protegido('comerciar', () => abrirComercio(n.refId)),
          text: 'Comerciar',
        }) : null,
      ),
    ));
  }
}

/* ── opciones sugeridas ───────────────────────────────────────────────── */

function abrirComercio(refId) {
  mercaderActivo = refId;
  sistema('merchants')?.abrir(refId);
  pintarComercio();
  $('#comercio-modal').hidden = false;
}

function pintarComercio() {
  const caja = $('#comercio-cuerpo');
  const mercado = sistema('merchants');
  const economia = sistema('economy');
  const catalogo = mercado?.catalogoParaInterfaz(mercaderActivo);
  if (!caja || !catalogo) return;
  vaciar(caja);
  $('#comercio-titulo').textContent = catalogo.mercader.nombre;
  $('#comercio-nota').textContent = `Tu oro: ${ver('player.oro', 0)} · Su oro: ${catalogo.oro}`;
  const compra = el('section', { class: 'comercio__seccion' }, el('h3', { text: 'Comprar' }));
  for (const o of catalogo.objetos) compra.append(el('div', { class: 'comercio__fila' },
    el('span', { class: 'comercio__nombre', text: `${o.nombre}${o.stock > 1 ? ` ×${o.stock}` : ''}` }),
    el('span', { class: 'comercio__precio', text: `${o.precio} oro` }),
    el('button', { class: 'btn btn--pequeno', text: 'Comprar', onClick: protegido('comprar', () => {
      const r = economia.comprar({ refIdMercader: mercaderActivo, objeto: o, cantidad: 1, stock: o.stock });
      avisar(r.exito ? `Comprado: ${o.nombre}` : r.mensaje, r.exito ? 'exito' : 'aviso'); pintarComercio(); refrescarTodo();
    }) })));
  caja.append(compra);
  const vendibles = mercado.vendibleA(mercaderActivo);
  if (vendibles.length) {
    const venta = el('section', { class: 'comercio__seccion' }, el('h3', { text: 'Vender' }));
    for (const o of vendibles) venta.append(el('div', { class: 'comercio__fila' },
      el('span', { class: 'comercio__nombre', text: `${o.nombre}${o.cantidad > 1 ? ` ×${o.cantidad}` : ''}` }),
      el('span', { class: 'comercio__precio', text: `${o.precio} oro` }),
      el('button', { class: 'btn btn--pequeno', text: 'Vender', onClick: protegido('vender', () => {
        const r = economia.vender({ refIdMercader: mercaderActivo, idObjeto: o.id, cantidad: 1 });
        avisar(r.exito ? `Vendido: ${o.nombre}` : r.mensaje, r.exito ? 'exito' : 'aviso'); pintarComercio(); refrescarTodo();
      }) })));
    caja.append(venta);
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
  if (campo) { campo.value = ''; ajustarAltoEntrada(); }
  ocultarSugerencias();
  completarEscritura();

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
  guardarPartidaActual();
  $('#entrada')?.focus();
  if (!escribiendo) programarSugerencias();
}

/** La caja crece con el texto hasta un tope, como un chat. */
function ajustarAltoEntrada() {
  const campo = $('#entrada');
  if (!campo || campo.tagName !== 'TEXTAREA') return;
  campo.style.height = 'auto';
  campo.style.height = `${Math.min(campo.scrollHeight, 180)}px`;
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

      const jefes = new Set(['devorador_de_brumas', 'guardian_de_la_puerta', 'senora_del_pantano']);
      pintarCriatura(marco, { ...plantilla, momentoClave: jefes.has(plantilla.refId) });
    }
  }

  const lista = el('div', { class: 'combate__lista' });

  for (const c of datos.combatientes) {
    const frac = Math.round(c.fraccionVida * 100);

    // El id permite que un golpe encuentre a SU objetivo en pantalla y le
    // lance el número encima. Sin esto, el daño saldría en un sitio genérico
    // y el jugador no vería a quién le pasó, que es media información.
    lista.append(el('div', {
      class: 'luchador' + (c.vivo ? '' : ' es-caido'),
      dataset: { luchador: c.id },
    },
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
    capa.append(el('div', { class: 'combate__libre' },
      el('input', { id: 'combate-entrada', class: 'entrada', type: 'text', placeholder: 'Describe cómo actúas…', maxlength: '180', onKeydown: (e) => { if (e.key === 'Enter') accionCombateLibre(); } }),
      el('button', { class: 'btn', onClick: protegido('acción libre de combate', accionCombateLibre) }, 'Hacerlo'),
    ));
    capa.append(el('p', { class: 'combate__ayuda', text: 'También puedes escribir tu movimiento con tus propias palabras.' }));
    capa.append(el('div', { class: 'combate__acciones' },
      el('button', { class: 'btn btn--peligro', onClick: protegido('atacar', () => accionCombate('atacar')) }, 'Atacar'),
      el('button', { class: 'btn', onClick: protegido('defender', () => accionCombate('defender')) }, 'Defender'),
      el('button', { class: 'btn btn--fantasma', onClick: protegido('huir', () => accionCombate('huir')) }, 'Huir'),
    ));
  } else {
    capa.append(el('p', { class: 'combate__espera', text: 'El enemigo actúa…' }));
  }
}

async function accionCombateLibre() {
  const texto = ($('#combate-entrada')?.value ?? '').trim();
  if (!texto) return;
  const normal = texto.toLocaleLowerCase('es');
  const tipo = /huir|escap|retir|correr/.test(normal) ? 'huir'
    : /defiend|bloque|cubrir|esquiv|proteg/.test(normal) ? 'defender' : 'atacar';
  bus.emit('narrative:direct', { texto: `Intentas: ${texto}`, voz: 'player' });
  await accionCombate(tipo);
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


async function probarIALocal() {
  const url = ($('#ia-url')?.value ?? '').trim();
  const modelo = ($('#ia-modelo')?.value ?? '').trim();
  const estado = $('#ia-estado'); const activar = $('#ia-activar');
  const dm = sistema('dungeonmaster'); const local = dm?.proveedor(PROVEEDORES.LOCAL);
  local?.configurar({ url, modelo });
  if (!url || !modelo) { estado.textContent = 'Indica la dirección y el modelo instalados.'; activar.disabled = true; return; }
  estado.textContent = 'Comprobando el modelo local…'; activar.disabled = true;
  const r = await local.probar();
  if (!r.ok) { estado.textContent = r.motivo; return; }
  estado.textContent = r.modelos.includes(modelo) ? `Conectado a ${modelo}.` : `Servidor conectado. Modelos: ${r.modelos.join(', ') || 'ninguno'}`;
  activar.disabled = !r.modelos.includes(modelo);
}

function activarIALocal() {
  const dm = sistema('dungeonmaster');
  const url = ($('#ia-url')?.value ?? '').trim(); const modelo = ($('#ia-modelo')?.value ?? '').trim();
  dm?.proveedor(PROVEEDORES.LOCAL)?.configurar({ url, modelo });
  const r = dm?.cambiar(PROVEEDORES.LOCAL);
  if (!r?.exito || r.motivo) { avisar(r?.motivo ?? 'No se pudo activar la IA local', 'aviso'); return; }
  store.fijar('settings.urlLocal', url); store.fijar('settings.modeloLocal', modelo); store.fijar('settings.proveedor', PROVEEDORES.LOCAL);
  avisar('IA local activa: cada acción pasará por el modelo', 'exito'); $('#director-modal').hidden = true;
}

function pintarDirectores() {
  const dm = sistema('dungeonmaster');
  const caja = $('#director-opciones');
  if (!dm || !caja) return;
  vaciar(caja);
  for (const opcion of dm.catalogo()) {
    const id = opcion.id ?? opcion.refId;
    caja.append(el('button', {
      class: 'director-opcion' + (dm.inspeccionar().elegido === id ? ' es-activo' : ''),
      onClick: protegido('cambiar narrador', () => {
        const r = dm.cambiar(id);
        store.fijar('settings.proveedor', id);
        avisar(r.motivo ?? `Narrador: ${opcion.nombre}`, r.motivo ? 'aviso' : 'exito');
        pintarDirectores();
        $('#director-modal').hidden = true;
      }),
    }, el('strong', { text: opcion.nombre }), el('span', { text: opcion.resumen ?? opcion.detalle ?? '' })))
  }
}

function abrirPuente({ prompt }) {
  $('#puente-prompt').value = prompt ?? '';
  $('#puente-respuesta').value = '';
  $('#puente-error').hidden = true;
  $('#puente-modal').hidden = false;
}

function aplicarPuente() {
  const dm = sistema('dungeonmaster');
  const puente = dm?.proveedor(PROVEEDORES.PUENTE);
  const r = puente?.recibir($('#puente-respuesta')?.value ?? '');
  if (!r?.aceptada) {
    const error = $('#puente-error'); error.textContent = r?.motivo ?? 'La respuesta no es válida.'; error.hidden = false;
    return;
  }
  $('#puente-modal').hidden = true;
}

function conectarEventos() {
  $('#comercio-cerrar')?.addEventListener('click', () => { $('#comercio-modal').hidden = true; mercaderActivo = null; });
  $('#director')?.addEventListener('click', () => abrirNarrador());
  $('#ia-probar')?.addEventListener('click', protegido('probar IA local', probarIALocal));
  $('#ia-activar')?.addEventListener('click', protegido('activar IA local', activarIALocal));
  $('#director-cerrar')?.addEventListener('click', () => { $('#director-modal').hidden = true; });
  $('#puente-copiar')?.addEventListener('click', async () => { await navigator.clipboard.writeText($('#puente-prompt').value); avisar('Encargo copiado', 'exito'); });
  $('#puente-aplicar')?.addEventListener('click', protegido('respuesta del puente', aplicarPuente));
  $('#puente-cancelar')?.addEventListener('click', () => sistema('dungeonmaster')?.proveedor(PROVEEDORES.PUENTE)?.cancelar());
  bus.on('bridge:open', abrirPuente);
  bus.on('bridge:close', () => { $('#puente-modal').hidden = true; });

  // Entrada de texto.
  $('#enviar')?.addEventListener('click', protegido('enviar', () => enviar()));

  $('#entrada')?.addEventListener('input', () => { ajustarAltoEntrada(); ocultarSugerencias(); if (!$('#entrada').value.trim()) programarSugerencias(); });
  $('#bitacora')?.addEventListener('click', () => { if (escribiendo) { completarEscritura(); programarSugerencias(); } });
  $('#sugerencias-cerrar')?.addEventListener('click', () => ocultarSugerencias());
  bus.on('combat:start', () => ocultarSugerencias());
  bus.on('combat:end', () => { guardarPartidaActual(); programarSugerencias(); });
  $('#entrada')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      enviar();
    }
  });

  $('#cargar-volver')?.addEventListener('click', () => { mostrar('inicio'); pintarInicio(); });
  $('#ajustes-cerrar')?.addEventListener('click', () => { $('#ajustes-modal').hidden = true; });
  $('#menu')?.addEventListener('click', protegido('menú', () => {
    guardarPartidaActual();
    // Volver al título recargando deja el motor limpio para la próxima partida.
    location.reload();
  }));

  $('#guardar')?.addEventListener('click', protegido('guardar', () => {
    const saves = sistema('saves');
    store.fijar('settings.persistencia', true);
    bus.emit('settings:change', { id: 'persistencia', valor: true });

    const r = guardarPartidaActual({ silencioso: true });
    avisar(r?.exito ? 'Partida guardada' : (r?.motivo ?? 'No se pudo guardar'),
      r?.exito ? 'exito' : 'aviso');
  }));

  // El motor avisa; la interfaz lo muestra.
  bus.on('ui:notice', ({ mensaje, tipo }) => avisar(mensaje, tipo));
  bus.on('achievement:unlocked', ({ nombre }) => avisar(`Hazaña: ${nombre}`, 'exito'));
  // Subir de nivel merece más que un aviso en la esquina: es de las pocas
  // cosas que cambian lo que puedes intentar.
  bus.on('player:levelup', ({ nivel }) => {
    rotuloMomento(`NIVEL ${nivel}`, 'oro');
    avisar(`Has subido a nivel ${nivel}`, 'exito');
  });

  // Cualquier cambio del mundo redibuja lo que corresponda.
  for (const evento of ['combat:start', 'combat:end', 'combat:turn', 'combat:awaiting', 'combat:log']) {
    bus.on(evento, () => { pintarCombate(); pintarBitacora(); });
  }

  // El golpe, en pantalla. Una barra que baja dice que pasó algo; esto dice
  // cuánto y a quién. Se engancha a `combat:attack`, que ya trae el daño
  // resuelto por el motor: aquí no se calcula nada, solo se enseña.
  bus.on('combat:attack', (golpe) => {
    if (!golpe?.dano?.total) return;

    // El repintado del panel ocurre en el mismo tic; se espera a que el
    // objetivo exista en el DOM o el número saldría sobre un nodo muerto.
    setTimeout(() => {
      const objetivo = $(`[data-luchador="${golpe.objetivo?.id}"]`);
      if (!objetivo) return;

      const critico = Boolean(golpe.tirada?.critico);

      numeroDano(objetivo, golpe.dano.total, {
        critico,
        esJugador: golpe.objetivo?.esJugador,
      });

      destello(objetivo, 'dano');

      // La sacudida se reserva: el crítico y el golpe que derriba. Si todo
      // tiembla, el temblor deja de significar nada.
      if (critico || golpe.cayo) {
        sacudir($('#combate'), golpe.cayo ? 'fuerte' : 'suave');
      }
    }, 30);
  });

  bus.on('narrative:direct', () => setTimeout(pintarBitacora, 10));
  bus.on('world:arrived', () => refrescarTodo());
  bus.on('player:defeated', () => {
    rotuloMomento('HAS CAÍDO', 'sangre');
    avisar('Has caído. La crónica termina aquí.', 'aviso');
  });
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
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('../sw.js').catch((e) => console.warn('[arcanveil] modo offline no disponible', e));
  }
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

    if (pantalla === 'juego') refrescarTodo();
  });

  try {
    recuperarPersistencia();
    conectarEventos();
    pintarInicio();
    mostrar('inicio');
    arranqueListo();
    comenzarPendiente();
  } catch (e) {
    // Aunque la interfaz falle, la pantalla se descubre: es mejor ver el
    // error que un vacío.
    arranqueListo();
    arranqueFallido('interfaz', e);
  }

  // Para inspeccionar desde la consola del navegador.
  window.ARCANVEIL = {
    motor, store, bus, ver,
    sistema,
    jugar: (t) => enviar(t),
    interfaz: { mostrarSugerencias, completarEscritura, estado: () => ({ escribiendo, cola: colaEscritura.length, temporizador: Boolean(temporizadorSugerencias) }) },
    inspeccionar: (n) => (n ? sistema(n)?.inspeccionar?.() : motor.registry?.inspeccionar?.()),
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', arrancar);
} else {
  arrancar();
}
