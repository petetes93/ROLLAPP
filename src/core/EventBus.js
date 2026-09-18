/**
 * ═══════════════════════════════════════════════════════════════════════════
 * ARCANUM · core/EventBus.js
 * ---------------------------------------------------------------------------
 * Bus de eventos con espacios de nombres, comodines y prioridades.
 *
 * Es la columna vertebral de la modularidad del motor: ningún sistema importa
 * a otro. CombatManager no conoce a QuestSystem; publica 'combat:ended' y quien
 * tenga algo que decir al respecto, lo dice.
 *
 * Características:
 *   · Comodines por segmento: 'combat:*' escucha todo lo del combate.
 *   · Prioridad: un oyente con prioridad alta se ejecuta antes.
 *   · once(): se da de baja tras la primera emisión.
 *   · Cancelación: un oyente puede detener la propagación.
 *   · Modo asíncrono: emitAsync espera a los oyentes que devuelvan promesa.
 *   · Detección de recursión: corta bucles de eventos que se autoalimentan.
 *
 * Dependencias: Logger, Errors.
 * ═══════════════════════════════════════════════════════════════════════════
 */

import { crearCanal } from './Logger.js';
import { registrar } from './Errors.js';
import { DEPURACION } from '../config/app.config.js';

const log = crearCanal('bus');

/** Profundidad máxima de emisiones anidadas antes de considerar que hay un bucle. */
const PROFUNDIDAD_MAX = 24;

/** Separador de segmentos del nombre de evento. */
const SEP = ':';

/** Comodín de un segmento cualquiera. */
const COMODIN = '*';

/**
 * @typedef {Object} Suscripcion
 * @property {string} patron    Patrón original, con o sin comodines.
 * @property {Function} fn      Función oyente.
 * @property {number} prioridad Mayor se ejecuta antes.
 * @property {boolean} unaVez   Se da de baja tras ejecutarse.
 * @property {string} id        Identificador para depuración.
 */

/**
 * @typedef {Object} Contexto
 * @property {string} evento  Nombre completo del evento emitido.
 * @property {boolean} cancelado
 * @property {() => void} cancelar Detiene la propagación a oyentes posteriores.
 */

export class EventBus {
  constructor() {
    /**
     * Oyentes de patrones exactos, indexados por nombre.
     * @type {Map<string, Suscripcion[]>}
     */
    this._exactos = new Map();

    /**
     * Oyentes con comodín. Se recorren linealmente: son pocos y el coste es
     * despreciable frente a la claridad que aportan.
     * @type {Suscripcion[]}
     */
    this._patrones = [];

    /** Profundidad actual de emisiones anidadas. */
    this._profundidad = 0;

    /** Contador para generar identificadores de suscripción. */
    this._seq = 0;

    /** Historial reciente de eventos, sólo para depuración. */
    this._historial = [];

    /** Longitud máxima del historial. */
    this._historialMax = 120;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     SUSCRIPCIÓN
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Registra un oyente.
   *
   * @param {string} patron Nombre de evento. Admite '*' como segmento comodín
   *   ('combat:*') y '**' como sufijo que captura cualquier profundidad restante.
   * @param {(payload: any, ctx: Contexto) => void|Promise<void>} fn
   * @param {Object} [opciones]
   * @param {number} [opciones.prioridad=0] Mayor se ejecuta antes.
   * @param {boolean} [opciones.unaVez=false]
   * @returns {() => void} Función de baja.
   *
   * @example
   * const baja = bus.on('combat:ended', ({ victoria }) => { … });
   * baja();  // se da de baja
   */
  on(patron, fn, opciones = {}) {
    if (typeof fn !== 'function') {
      registrar(new TypeError(`El oyente de "${patron}" no es una función`), 'bus');
      return () => {};
    }

    const sub = {
      patron,
      fn,
      prioridad: opciones.prioridad ?? 0,
      unaVez: opciones.unaVez ?? false,
      id: `s${++this._seq}`,
    };

    if (patron.includes(COMODIN)) {
      this._patrones.push(sub);
      this._patrones.sort((a, b) => b.prioridad - a.prioridad);
    } else {
      const lista = this._exactos.get(patron) ?? [];
      lista.push(sub);
      lista.sort((a, b) => b.prioridad - a.prioridad);
      this._exactos.set(patron, lista);
    }

    log.traza(`+ oyente ${sub.id} → ${patron}`);
    return () => this.off(patron, fn);
  }

  /**
   * Registra un oyente que se da de baja tras la primera emisión.
   * @param {string} patron
   * @param {Function} fn
   * @param {Object} [opciones]
   * @returns {() => void}
   */
  once(patron, fn, opciones = {}) {
    return this.on(patron, fn, { ...opciones, unaVez: true });
  }

  /**
   * Da de baja un oyente concreto, o todos los de un patrón si se omite fn.
   * @param {string} patron
   * @param {Function} [fn]
   */
  off(patron, fn) {
    if (patron.includes(COMODIN)) {
      this._patrones = this._patrones.filter((s) => s.patron !== patron || (fn && s.fn !== fn));
      return;
    }
    const lista = this._exactos.get(patron);
    if (!lista) return;
    const restantes = fn ? lista.filter((s) => s.fn !== fn) : [];
    if (restantes.length) this._exactos.set(patron, restantes);
    else this._exactos.delete(patron);
  }

  /**
   * Espera a que ocurra un evento, en forma de promesa.
   * Útil para el puente manual: el turno espera a 'bridge:submitted'.
   *
   * @param {string} patron
   * @param {number} [timeoutMs=0] 0 = sin límite.
   * @returns {Promise<any>} Resuelve con el payload del evento.
   */
  esperar(patron, timeoutMs = 0) {
    return new Promise((resolver, rechazar) => {
      let temporizador = null;
      const baja = this.once(patron, (payload) => {
        if (temporizador) clearTimeout(temporizador);
        resolver(payload);
      });
      if (timeoutMs > 0) {
        temporizador = setTimeout(() => {
          baja();
          rechazar(new Error(`Tiempo agotado esperando "${patron}"`));
        }, timeoutMs);
      }
    });
  }

  /* ─────────────────────────────────────────────────────────────────────────
     EMISIÓN
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Emite un evento de forma síncrona.
   * Un oyente que lance no interrumpe a los demás: se registra y se continúa.
   *
   * @param {string} evento Nombre completo, sin comodines.
   * @param {any} [payload]
   * @returns {boolean} false si algún oyente canceló la propagación.
   */
  emit(evento, payload) {
    if (this._profundidad >= PROFUNDIDAD_MAX) {
      registrar(new Error(`Bucle de eventos detectado en "${evento}" (profundidad ${this._profundidad})`), 'bus');
      return false;
    }

    const oyentes = this._resolver(evento);
    this._anotar(evento, oyentes.length);
    if (!oyentes.length) return true;

    const ctx = this._crearContexto(evento);
    this._profundidad++;

    try {
      for (const sub of oyentes) {
        if (ctx.cancelado) break;
        if (sub.unaVez) this.off(sub.patron, sub.fn);
        try {
          sub.fn(payload, ctx);
        } catch (e) {
          registrar(e, 'bus');
        }
      }
    } finally {
      this._profundidad--;
    }

    return !ctx.cancelado;
  }

  /**
   * Emite esperando a los oyentes asíncronos, en orden de prioridad.
   * Se usa cuando el resultado importa: por ejemplo, dar tiempo a que la
   * interfaz termine una animación antes de continuar el turno.
   *
   * @param {string} evento
   * @param {any} [payload]
   * @returns {Promise<boolean>} false si se canceló la propagación.
   */
  async emitAsync(evento, payload) {
    const oyentes = this._resolver(evento);
    this._anotar(evento, oyentes.length, true);
    if (!oyentes.length) return true;

    const ctx = this._crearContexto(evento);
    this._profundidad++;

    try {
      for (const sub of oyentes) {
        if (ctx.cancelado) break;
        if (sub.unaVez) this.off(sub.patron, sub.fn);
        try {
          await sub.fn(payload, ctx);
        } catch (e) {
          registrar(e, 'bus');
        }
      }
    } finally {
      this._profundidad--;
    }

    return !ctx.cancelado;
  }

  /* ─────────────────────────────────────────────────────────────────────────
     INTERNO
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Reúne y ordena todos los oyentes que corresponden a un evento.
   * @param {string} evento
   * @returns {Suscripcion[]}
   * @private
   */
  _resolver(evento) {
    const exactos = this._exactos.get(evento) ?? [];
    const conComodin = this._patrones.filter((s) => this._coincide(s.patron, evento));
    if (!conComodin.length) return exactos;
    return [...exactos, ...conComodin].sort((a, b) => b.prioridad - a.prioridad);
  }

  /**
   * Comprueba si un patrón con comodines cubre un nombre de evento.
   *
   *   'combat:*'      cubre 'combat:start' pero no 'combat:turn:end'
   *   'combat:**'     cubre ambos
   *   '**'            cubre todo
   *
   * @param {string} patron
   * @param {string} evento
   * @returns {boolean}
   * @private
   */
  _coincide(patron, evento) {
    if (patron === '**') return true;

    const p = patron.split(SEP);
    const e = evento.split(SEP);

    for (let i = 0; i < p.length; i++) {
      if (p[i] === '**') return true;          // captura el resto
      if (i >= e.length) return false;
      if (p[i] === COMODIN) continue;          // cualquier segmento
      if (p[i] !== e[i]) return false;
    }
    return p.length === e.length;
  }

  /**
   * Crea el contexto que reciben los oyentes.
   * @param {string} evento
   * @returns {Contexto}
   * @private
   */
  _crearContexto(evento) {
    const ctx = { evento, cancelado: false, cancelar: () => { ctx.cancelado = true; } };
    return ctx;
  }

  /**
   * Anota el evento en el historial de depuración.
   * @param {string} evento
   * @param {number} oyentes
   * @param {boolean} [asincrono]
   * @private
   */
  _anotar(evento, oyentes, asincrono = false) {
    if (DEPURACION.trazarEventos) {
      log.traza(`${asincrono ? '⇄' : '→'} ${evento} (${oyentes} oyente${oyentes === 1 ? '' : 's'})`);
    }
    this._historial.push({ t: Date.now(), evento, oyentes });
    if (this._historial.length > this._historialMax) this._historial.shift();
  }

  /* ─────────────────────────────────────────────────────────────────────────
     DIAGNÓSTICO
     ───────────────────────────────────────────────────────────────────────── */

  /**
   * Radiografía del bus: cuántos oyentes hay y de qué.
   * @returns {{exactos: Record<string, number>, patrones: string[], total: number}}
   */
  inspeccionar() {
    const exactos = {};
    let total = 0;
    for (const [nombre, lista] of this._exactos) {
      exactos[nombre] = lista.length;
      total += lista.length;
    }
    return { exactos, patrones: this._patrones.map((s) => s.patron), total: total + this._patrones.length };
  }

  /** Últimos eventos emitidos, para depurar cadenas de reacciones. */
  get historial() {
    return this._historial.slice();
  }

  /** Elimina todos los oyentes. Se usa al abandonar una partida. */
  limpiar() {
    this._exactos.clear();
    this._patrones = [];
    this._historial = [];
    log.debug('Bus vaciado');
  }
}

/**
 * Instancia compartida por toda la aplicación.
 * Se exporta también la clase, para poder crear buses aislados en pruebas.
 */
export const bus = new EventBus();

export default bus;
