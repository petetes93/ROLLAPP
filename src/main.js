/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANVEIL · main.js
 * ---------------------------------------------------------------------------
 * Punto de entrada. Ensambla el núcleo, arranca los sistemas y entrega el
 * control a la interfaz.
 *
 * Secuencia de arranque:
 *   1. Preferencias del documento (tema, densidad, tamaño de lectura)
 *   2. Núcleo: RNG → Store → Registry
 *   3. Sistemas registrados (en Fase 1, sólo Clock)
 *   4. Interfaz (a partir de la Fase 2; aquí se detecta y se omite si falta)
 *   5. Pantalla inicial
 *
 * Ante un fallo irrecuperable, se muestra el panel de error definido en
 * index.html en lugar de dejar la pantalla en blanco.
 *
 * Dependencias: todo el núcleo.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { APP, ENTORNO, TIEMPOS, DEPURACION, PERSISTENCIA } from './config/app.config.js';
import { PANTALLAS, PANTALLA_INICIAL, SELECTORES, TEXTOS, ATRIBUTOS_DOC, TEMA_DEFECTO } from './config/ui.config.js';

import { Logger, crearCanal } from './core/Logger.js';
import { normalizar, registrar, SEVERIDAD } from './core/Errors.js';
import { bus } from './core/EventBus.js';
import { store } from './core/Store.js';
import { GestorRNG } from './core/RNG.js';
import { Registry } from './core/Registry.js';
import { Clock } from './core/Clock.js';

// — Sistemas de juego —
// El Registry resuelve el orden real por dependencias declaradas; el orden de
// esta lista solo importa para leerla.
import { Player } from './player/Player.js';
import { Inventory } from './inventory/Inventory.js';

import { TimeSystem } from './world/TimeSystem.js';
import { WeatherSystem } from './world/WeatherSystem.js';
import { DynamicEvents } from './world/DynamicEvents.js';
import { Travel } from './world/Travel.js';
import { Exploration } from './world/Exploration.js';
import { World } from './world/World.js';

import { RelationshipSystem } from './npc/RelationshipSystem.js';
import { ReputationSystem } from './npc/ReputationSystem.js';
import { FactionSystem } from './npc/FactionSystem.js';
import { PartySystem } from './npc/PartySystem.js';
import { SceneSystem } from './world/SceneSystem.js';
import { DialogueSystem } from './npc/DialogueSystem.js';
import { MerchantSystem } from './npc/MerchantSystem.js';
import { EconomySystem } from './economy/EconomySystem.js';

import { QuestSystem } from './quests/QuestSystem.js';

import { StatsTracker } from './progression/StatsTracker.js';
import { AchievementSystem } from './progression/AchievementSystem.js';
import { Milestones } from './progression/Milestones.js';
import { SaveManager } from './persistence/SaveManager.js';

import { RulesEngine } from './engine/RulesEngine.js';
import { EffectApplier } from './engine/EffectApplier.js';
import { CombatManager } from './combat/CombatManager.js';

import { DungeonMaster } from './ai/DungeonMaster.js';
import { ActionRouter } from './engine/ActionRouter.js';
import { ConsequenceEngine } from './engine/ConsequenceEngine.js';
import { DifficultyDirector } from './engine/DifficultyDirector.js';

// TurnResolver va el último: consulta a los demás por nombre durante el turno.
import { TurnResolver } from './engine/TurnResolver.js';

const log = crearCanal('core');

/* ═══════════════════════════════════════════════════════════════════════════
   ESTADO DE ARRANQUE
   ═══════════════════════════════════════════════════════════════════════════ */

/** Referencias vivas del motor, compartidas tras el arranque. */
const motor = {
  /** @type {GestorRNG|null} */ rng: null,
  /** @type {Registry|null} */ registry: null,
  store,
  bus,
  /** @type {Object|null} */ ui: null,
  arrancado: false,
};

/* ═══════════════════════════════════════════════════════════════════════════
   UTILIDADES DE ARRANQUE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Actualiza el mensaje de la pantalla de arranque.
 * @param {string} texto
 */
function estadoArranque(texto) {
  const el = document.querySelector(SELECTORES.arranque.estado);
  if (el) el.textContent = texto;
  log.debug(`arranque: ${texto}`);
}

/**
 * Cambia la pantalla activa escribiendo el atributo que gobierna layout.css.
 * En la Fase 2, UIManager asumirá esta responsabilidad con validación de
 * transiciones; hasta entonces, main.js la ejerce directamente.
 * @param {string} pantalla
 */
function mostrarPantalla(pantalla) {
  const app = document.querySelector(SELECTORES.app);
  if (!app) return;
  app.setAttribute(ATRIBUTOS_DOC.pantallaActiva, pantalla);
  store.fijar('ui.pantalla', pantalla);
}

/**
 * Muestra el panel de error fatal. Reutiliza la función que index.html deja
 * publicada en window, de modo que el mensaje sea idéntico venga de donde venga
 * el fallo.
 * @param {string} mensaje
 * @param {string} [detalle]
 */
function fatal(mensaje, detalle = '') {
  const mostrar = /** @type {any} */ (window).__ARCANVEIL_FATAL__;
  if (typeof mostrar === 'function') mostrar(mensaje, detalle);
  else console.error(mensaje, detalle);
}

/**
 * Espera un mínimo de tiempo. Evita que la pantalla de arranque parpadee
 * durante 40 ms en un equipo rápido, que se ve peor que una espera honesta.
 * @param {number} ms
 * @returns {Promise<void>}
 */
function esperar(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Aplica al documento las preferencias visuales guardadas en el estado.
 * @param {Object} ajustes
 */
function aplicarPreferencias(ajustes) {
  const raiz = document.documentElement;
  raiz.setAttribute(ATRIBUTOS_DOC.tema, TEMA_DEFECTO);
  raiz.setAttribute(ATRIBUTOS_DOC.densidad, ajustes.densidad ?? 'normal');
  raiz.setAttribute(ATRIBUTOS_DOC.lectura, ajustes.tamanoLectura ?? 'normal');
  raiz.style.setProperty('--t-typewriter', `${ajustes.velocidadTexto ?? 14}ms`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CARGA OPCIONAL DE LA INTERFAZ
   ---------------------------------------------------------------------------
   La capa de interfaz llega en la Fase 2. Hasta entonces el motor arranca
   igualmente: se intenta importar UIManager y, si no existe, se continúa con
   un aviso. Así cada fase es ejecutable sin esperar a la siguiente.
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * @returns {Promise<Object|null>} La instancia de UIManager, o null si aún no existe.
 */
async function cargarInterfaz() {
  try {
    const modulo = await import('./ui/UIManager.js');
    const UIManager = modulo.UIManager ?? modulo.default;
    if (!UIManager) return null;
    const ui = new UIManager({ store, bus, registry: motor.registry });
    await ui.iniciar();
    return ui;
  } catch (e) {
    // Un módulo inexistente es lo esperado en la Fase 1; cualquier otro fallo
    // sí merece quedar registrado con detalle.
    const esperado = e instanceof TypeError || /Failed to fetch|not found|404|Cannot find/i.test(String(e?.message));
    if (esperado) {
      log.aviso('Capa de interfaz no disponible todavía (llega en la Fase 2). El núcleo funciona.');
    } else {
      registrar(e, 'ui');
    }
    return null;
  }
}

/* ═══════════════════════════════════════════════════════════════════════════
   ARRANQUE
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Ensambla y pone en marcha la aplicación.
 * @returns {Promise<void>}
 */
async function arrancar() {
  const inicio = performance.now();

  log.info(`${APP.nombre} ${APP.version} · ${APP.fase}`);
  log.debug('Entorno', {
    local: ENTORNO.esLocal,
    desarrollo: ENTORNO.desarrollo,
    protocolo: window.location.protocol,
  });

  // — 1. Preferencias visuales —
  estadoArranque(TEXTOS.arranque.faroles);
  aplicarPreferencias(store.select('settings'));
  store.subscribe('settings', (ajustes) => aplicarPreferencias(ajustes));

  // — 2. Núcleo —
  estadoArranque(TEXTOS.arranque.forjando);

  const semilla = DEPURACION.semillaFija ?? undefined;
  motor.rng = new GestorRNG(semilla);
  store.fijar('meta.semilla', motor.rng.semillaMaestra);

  motor.registry = new Registry({ store, bus, rng: motor.rng });

  // — 3. Sistemas —
  // El Registry ordena por dependencias declaradas, pero la lista se escribe
  // en el orden en que se leen mejor: núcleo, mundo, gente, reglas, director.
  motor.registry.registrarTodos([
    Clock,
    Player, Inventory,

    TimeSystem, WeatherSystem, DynamicEvents, Travel, Exploration, World,

    RelationshipSystem, ReputationSystem, FactionSystem, DialogueSystem,
    MerchantSystem, EconomySystem,

    QuestSystem, PartySystem, SceneSystem,

    StatsTracker, AchievementSystem, Milestones, SaveManager,

    RulesEngine, EffectApplier, CombatManager,

    DungeonMaster, ActionRouter, ConsequenceEngine, DifficultyDirector,

    TurnResolver,
  ]);

  await motor.registry.iniciar();

  // — 4. Interfaz —
  estadoArranque(TEXTOS.arranque.convocando);
  motor.ui = await cargarInterfaz();

  // — 5. Errores no capturados: se anotan, pero no tumban la partida —
  window.addEventListener('error', (e) => {
    const err = normalizar(e.error ?? e.message);
    registrar(err, 'core');
    if (err.severidad === SEVERIDAD.FATAL) fatal('Se ha roto un conjuro.', err.message);
  });

  window.addEventListener('unhandledrejection', (e) => {
    registrar(normalizar(e.reason), 'core');
  });

  // — 6. Aviso de persistencia —
  if (!PERSISTENCIA.activadaPorDefecto) {
    log.info('Guardado desactivado: la partida vive sólo en memoria.');
  }

  // — 7. Pantalla inicial —
  estadoArranque(TEXTOS.arranque.listo);
  const transcurrido = performance.now() - inicio;
  if (transcurrido < TIEMPOS.arranqueMin) await esperar(TIEMPOS.arranqueMin - transcurrido);

  mostrarPantalla(motor.ui ? PANTALLA_INICIAL : PANTALLAS.ARRANQUE);

  if (!motor.ui) {
    estadoArranque('Núcleo en marcha. La interfaz llega en la Fase 2.');
  }

  motor.arrancado = true;
  bus.emit('app:ready', { version: APP.version, ms: Math.round(performance.now() - inicio) });
  log.info(`Arranque completado en ${Math.round(performance.now() - inicio)} ms`);
}

/* ═══════════════════════════════════════════════════════════════════════════
   CONSOLA DE DEPURACIÓN
   ═══════════════════════════════════════════════════════════════════════════ */

/**
 * Publica el motor en window.ARCANVEIL para poder inspeccionarlo y toquetearlo
 * desde la consola del navegador. Sólo en desarrollo.
 */
function exponerGlobal() {
  if (!DEPURACION.exponerGlobal) return;

  /** @type {any} */ (window).ARCANVEIL = {
    version: APP.version,
    store,
    bus,
    get rng() { return motor.rng; },
    get registry() { return motor.registry; },
    get ui() { return motor.ui; },
    log: Logger,

    /** Estado completo. */
    estado: () => store.getState(),
    /** Lectura por ruta: ARCANVEIL.ver('player.vida') */
    ver: (ruta) => store.select(ruta),
    /** Ejecuta un turno: ARCANVEIL.turno() */
    turno: (opciones) => motor.registry?.exigir('clock').turno(opciones),
    /** Tirada rápida de prueba: ARCANVEIL.dado('2d6+3') */
    dado: async (notacion = '1d20') => {
      const { evaluar } = await import('./core/Dice.js');
      return evaluar(motor.rng.dados, notacion);
    },
    /** Radiografía completa del motor. */
    inspeccionar: () => ({
      store: store.inspeccionar(),
      bus: bus.inspeccionar(),
      registry: motor.registry?.inspeccionar(),
    }),
    /** Volcado de diagnóstico como texto. */
    diagnostico: () => Logger.volcar(),
  };

  log.info('Consola de depuración disponible en window.ARCANVEIL');
}

/* ═══════════════════════════════════════════════════════════════════════════
   PUESTA EN MARCHA
   ═══════════════════════════════════════════════════════════════════════════ */

exponerGlobal();

arrancar().catch((e) => {
  const err = registrar(e, 'core');
  fatal(
    'El motor no ha podido arrancar.',
    `${err.code}\n${err.message}\n\n${err.stack ?? ''}`,
  );
});

export default motor;
